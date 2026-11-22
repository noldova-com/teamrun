/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  Department, type DepartmentCreateParams, type DepartmentIdParams, type DepartmentMemberSetParams, type DepartmentMoveParams,
  type DepartmentUpdateParams, ErrorCode, Organization, type OrganizationLayoutSaveParams, OrganizationNodeKind, OrganizationParent, Teammate,
  TeammatePlacement, type TeammatePlaceParams
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IOrganizationService } from "../../interfaces/i-organization.service.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class OrganizationService implements IOrganizationService {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async listAsync(transaction?: SqlTransaction): Promise<Organization> {
    if (Object.isUndefined(transaction))
      return await this.context.database.connection.runInTransactionAsync(t => this.listAsync(t));
    const departments = await transaction.queryAsync(new SqlQuery(Resources.selectDepartments));
    const placements = await transaction.queryAsync(new SqlQuery(Resources.selectTeammatePlacements));
    return new Organization(departments.map(t => Department.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())),
      placements.map(t => TeammatePlacement.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())));
  }

  public async createAsync(params: DepartmentCreateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      OrganizationService.requireParent(organization, params.parent);
      const leader = Object.isNull(params.leaderId) ? null : await this.requireTeammateAsync(params.leaderId, transaction);
      if (!Object.isNull(leader) && organization.pathOf(params.parent).some(t => t.equals(OrganizationParent.teammate(leader.id))))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderLeader(leader.name, params.name), [leader.id]);
      const now = new Date().toISOString();
      const department = new Department(Guid.createVersion7().toString(), params.name, params.parent, leader?.id ?? null,
        organization.departmentsUnder(params.parent).length, now, now);
      const json = JSON.stringify(department.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertDepartment, [department.id, department.parentId, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Insert, json, transaction);
      if (!Object.isNull(leader))
        await this.moveTeammateAsync(organization, leader.id, OrganizationParent.department(department.id), 0, transaction);
      return department;
    });
  }

  public async updateAsync(params: DepartmentUpdateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      const node = OrganizationParent.department(department.id);
      if (!Object.isNullOrUndefined(params.leaderId)) {
        const leader = await this.requireTeammateAsync(params.leaderId, transaction);
        const teammate = OrganizationParent.teammate(leader.id);
        if (organization.pathOf(node).some(t => t.equals(teammate)))
          throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderLeader(leader.name, department.name), [leader.id]);
        if (!(organization.parentOf(teammate)?.equals(node) ?? false))
          await this.moveTeammateAsync(organization, leader.id, node, organization.placementsUnder(node).length, transaction);
      }
      return await this.saveAsync(params.applyTo(department, new Date().toISOString()), transaction);
    });
  }

  public async moveAsync(params: DepartmentMoveParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      OrganizationService.requireParent(organization, params.parent);
      if (!Object.isNull(organization.moveError(OrganizationParent.department(department.id), params.parent)))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderItself(department.name), [department.id]);
      const now = new Date().toISOString();
      const joined = organization.departmentsUnder(params.parent).filter(t => t.id !== department.id);
      const order = Math.min(params.order, joined.length);
      const moved = new Department(department.id, department.name, params.parent, department.leaderId, order, department.createdAt, now);
      joined.splice(order, 0, moved);
      if (!department.parent.equals(params.parent))
        await this.arrangeDepartmentsAsync(organization.departmentsUnder(department.parent).filter(t => t.id !== department.id), now, transaction);
      await this.arrangeDepartmentsAsync(joined, now, transaction, moved.id);
      return moved;
    });
  }

  public async deleteAsync(params: DepartmentIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      await this.liftChildrenAsync(organization, OrganizationParent.department(department.id), department.parent, transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteDepartment, [department.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Delete,
        JSON.stringify(department.toJson()), transaction);
    });
  }

  public async readLayoutAsync(transaction?: SqlTransaction): Promise<JsonObject | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [Resources.organizationLayoutPreference]));
    return Object.isUndefined(record) ? null : JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  public async saveLayoutAsync(params: OrganizationLayoutSaveParams): Promise<JsonObject> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const previous = await this.readLayoutAsync(transaction);
      const json = JSON.stringify(params.layout);
      await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [Resources.organizationLayoutPreference, json, new Date().toISOString()]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.organizationLayoutPreference,
        Object.isNull(previous) ? ChangeOperation.Insert : ChangeOperation.Update, json, transaction);
      return params.layout;
    });
  }

  public async setMemberAsync(params: DepartmentMemberSetParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const parent = Object.isNull(params.departmentId) ? OrganizationParent.person
        : OrganizationParent.department(OrganizationService.require(organization, params.departmentId).id);
      if (organization.parentOf(OrganizationParent.teammate(params.teammateId))?.equals(parent) ?? false)
        return;
      await this.placeInAsync(organization, params.teammateId, parent, organization.placementsUnder(parent).length, transaction);
    });
  }

  public async placeAsync(params: TeammatePlaceParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      if (!Object.isNull(params.parent))
        OrganizationService.requireParent(organization, params.parent);
      await this.placeInAsync(organization, params.teammateId, params.parent, params.order, transaction);
    });
  }

  public async removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<boolean> {
    const organization = await this.listAsync(transaction);
    const placement = organization.placements.find(t => t.teammateId === teammateId);
    if (Object.isUndefined(placement))
      return false;
    await this.unplaceAsync(organization, placement, transaction);
    return true;
  }

  private async placeInAsync(organization: Organization, teammateId: string, parent: OrganizationParent | null, order: number,
    transaction: SqlTransaction): Promise<void> {
    const teammate = await this.requireTeammateAsync(teammateId, transaction);
    if (Object.isNull(parent)) {
      const placement = organization.placements.find(t => t.teammateId === teammate.id);
      if (!Object.isUndefined(placement))
        await this.unplaceAsync(organization, placement, transaction);
      return;
    }
    if (!Object.isNull(organization.moveError(OrganizationParent.teammate(teammate.id), parent)))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatTeammateUnderItself(teammate.name), [teammate.id]);
    await this.moveTeammateAsync(organization, teammate.id, parent, order, transaction);
  }

  private async moveTeammateAsync(organization: Organization, teammateId: string, parent: OrganizationParent, order: number,
    transaction: SqlTransaction): Promise<void> {
    const current = organization.placements.find(t => t.teammateId === teammateId);
    await this.stopLeadingAsync(organization, teammateId, parent, transaction);
    const joined = organization.placementsUnder(parent).filter(t => t.teammateId !== teammateId);
    const at = Math.min(order, joined.length);
    joined.splice(at, 0, new TeammatePlacement(teammateId, parent, at));
    if (!Object.isUndefined(current) && !current.parent.equals(parent))
      await this.arrangePlacementsAsync(organization, organization.placementsUnder(current.parent).filter(t => t.teammateId !== teammateId), transaction);
    await this.arrangePlacementsAsync(organization, joined, transaction, teammateId);
  }

  private async unplaceAsync(organization: Organization, placement: TeammatePlacement, transaction: SqlTransaction): Promise<void> {
    await this.stopLeadingAsync(organization, placement.teammateId, null, transaction);
    await this.liftChildrenAsync(organization, OrganizationParent.teammate(placement.teammateId), placement.parent, transaction);
    await transaction.executeAsync(new SqlQuery(Resources.deleteTeammatePlacement, [placement.teammateId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.TeammatePlacement, placement.teammateId, ChangeOperation.Delete,
      JSON.stringify(placement.toJson()), transaction);
  }

  private async liftChildrenAsync(organization: Organization, node: OrganizationParent, parent: OrganizationParent, transaction: SqlTransaction): Promise<void> {
    const now = new Date().toISOString();
    const siblings = organization.departmentsUnder(parent).filter(t => node.kind !== OrganizationNodeKind.Department || t.id !== node.id);
    const index = node.kind === OrganizationNodeKind.Department ? organization.departmentsUnder(parent).findIndex(t => t.id === node.id) : siblings.length;
    const children = organization.departmentsUnder(node).map(t => new Department(t.id, t.name, parent, t.leaderId, t.order, t.createdAt, now));
    siblings.splice(index, 0, ...children);
    await this.arrangeDepartmentsAsync(siblings, now, transaction, ...children.map(t => t.id));
    const teammates = organization.placementsUnder(node).map(t => t.teammateId);
    const lifted = [...organization.placementsUnder(parent).filter(t => t.teammateId !== node.id), ...organization.placementsUnder(node)]
      .map(t => new TeammatePlacement(t.teammateId, parent, t.order));
    await this.arrangePlacementsAsync(organization, lifted, transaction, ...teammates);
  }

  private async stopLeadingAsync(organization: Organization, teammateId: string, parent: OrganizationParent | null,
    transaction: SqlTransaction): Promise<void> {
    const now = new Date().toISOString();
    for (const led of organization.departments.filter(t => t.leaderId === teammateId && !(parent?.equals(OrganizationParent.department(t.id)) ?? false)))
      await this.saveAsync(new Department(led.id, led.name, led.parent, null, led.order, led.createdAt, now), transaction);
  }

  private async arrangeDepartmentsAsync(siblings: readonly Department[], now: string, transaction: SqlTransaction, ...moved: readonly string[]): Promise<void> {
    for (const [order, sibling] of siblings.entries())
      if (sibling.order !== order || moved.includes(sibling.id))
        await this.saveAsync(new Department(sibling.id, sibling.name, sibling.parent, sibling.leaderId, order, sibling.createdAt, now), transaction);
  }

  private async arrangePlacementsAsync(organization: Organization, siblings: readonly TeammatePlacement[], transaction: SqlTransaction,
    ...moved: readonly string[]): Promise<void> {
    for (const [order, sibling] of siblings.entries()) {
      if (sibling.order === order && !moved.includes(sibling.teammateId))
        continue;
      const placement = new TeammatePlacement(sibling.teammateId, sibling.parent, order);
      const json = JSON.stringify(placement.toJson());
      const known = organization.placements.some(t => t.teammateId === placement.teammateId);
      await transaction.executeAsync(known ? new SqlQuery(Resources.updateTeammatePlacement, [json, placement.teammateId])
        : new SqlQuery(Resources.insertTeammatePlacement, [placement.teammateId, json]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.TeammatePlacement, placement.teammateId,
        known ? ChangeOperation.Update : ChangeOperation.Insert, json, transaction);
    }
  }

  private async saveAsync(department: Department, transaction: SqlTransaction): Promise<Department> {
    const json = JSON.stringify(department.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateDepartment, [department.parentId, json, department.updatedAt, department.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Update, json, transaction);
    return department;
  }

  private async requireTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<Teammate> {
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectTeammateById, [teammateId]));
    if (Object.isUndefined(record))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(teammateId), [teammateId]);
    return Teammate.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }

  private static requireParent(organization: Organization, parent: OrganizationParent): void {
    const id = parent.id;
    if (Object.isNull(id))
      return;
    if (parent.kind === OrganizationNodeKind.Department)
      OrganizationService.require(organization, id);
    else if (Object.isNull(organization.parentOf(parent)))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotPlaced(id), [id]);
  }

  private static require(organization: Organization, departmentId: string): Department {
    const department = organization.departments.find(t => t.id === departmentId);
    if (Object.isUndefined(department))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatDepartmentNotFound(departmentId), [departmentId]);
    return department;
  }
}
