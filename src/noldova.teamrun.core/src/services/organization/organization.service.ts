/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  Department, type DepartmentCreateParams, type DepartmentIdParams, type DepartmentMemberSetParams, type DepartmentMoveParams,
  type DepartmentUpdateParams, ErrorCode, NodeType, type NodeTypeCreateParams, type NodeTypeIdParams, type NodeTypeUpdateParams, Organization, type OrganizationCreateParams, OrganizationIdParams, type OrganizationLayoutSaveParams, OrganizationNodeKind,
  Chat, OrganizationParent, type OrganizationUpdateParams, Teammate,
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

  public async listAsync(transaction?: SqlTransaction): Promise<readonly Organization[]> {
    if (Object.isUndefined(transaction))
      return await this.context.database.connection.runInTransactionAsync(t => this.listAsync(t));
    const organizations: Organization[] = [];
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectOrganizations)))
      organizations.push(await this.withTreeAsync(OrganizationService.read(record), transaction));
    return organizations.sort((a, b) => a.order - b.order);
  }

  public async findAsync(organizationId: string, transaction?: SqlTransaction): Promise<Organization | null> {
    if (Object.isUndefined(transaction))
      return await this.context.database.connection.runInTransactionAsync(t => this.findAsync(organizationId, t));
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectOrganization, [organizationId]));
    return Object.isUndefined(record) ? null : await this.withTreeAsync(OrganizationService.read(record), transaction);
  }

  public async createOrganizationAsync(params: OrganizationCreateParams): Promise<Organization> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const orders = (await transaction.queryAsync(new SqlQuery(Resources.selectOrganizations))).map(t => OrganizationService.read(t).order);
      const now = new Date().toISOString();
      const organization = new Organization(Guid.createVersion7().toString(), params.name, params.folder, Math.max(-1, ...orders) + 1, now, now, [], [], []);
      const json = JSON.stringify(organization.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertOrganization, [organization.id, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Organization, organization.id, ChangeOperation.Insert, json, transaction);
      return organization;
    });
  }

  public async updateOrganizationAsync(params: OrganizationUpdateParams): Promise<Organization> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = params.applyTo(await this.requireAsync(params.organizationId, transaction), new Date().toISOString());
      const json = JSON.stringify(organization.withTree([], []).toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateOrganization, [json, organization.updatedAt, organization.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Organization, organization.id, ChangeOperation.Update, json, transaction);
      return organization;
    });
  }

  public async deleteOrganizationAsync(params: OrganizationIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      if ((await transaction.queryAsync(new SqlQuery(Resources.selectOrganizations))).length < 2)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatLastOrganization(organization.name), [organization.id]);
      const feed = this.context.database.changeFeed;
      await transaction.executeAsync(new SqlQuery(Resources.deleteOrganizationPlacements, [organization.id]));
      for (const placement of organization.placements)
        await feed.appendAsync(ChangeEntity.TeammatePlacement, Resources.formatTeammatePlacementKey(organization.id, placement.teammateId),
          ChangeOperation.Delete, JSON.stringify(placement.toJson()), transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteOrganizationDepartments, [organization.id]));
      for (const department of organization.departments)
        await feed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Delete, JSON.stringify(department.toJson()), transaction);
      for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectOrganizationChats, [organization.id]))) {
        const chat = Chat.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson()).withoutOrganizationChat();
        const json = JSON.stringify(chat.toJson());
        await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, chat.updatedAt, chat.id]));
        await feed.appendAsync(ChangeEntity.Chat, chat.id, ChangeOperation.Update, json, transaction);
      }
      const layout = Resources.formatOrganizationLayoutPreference(organization.id);
      const previous = await this.readLayoutAsync(params, transaction);
      if (!Object.isNull(previous)) {
        await transaction.executeAsync(new SqlQuery(Resources.deletePreference, [layout]));
        await feed.appendAsync(ChangeEntity.Preference, layout, ChangeOperation.Delete, JSON.stringify(previous), transaction);
      }
      await transaction.executeAsync(new SqlQuery(Resources.deleteOrganization, [organization.id]));
      await feed.appendAsync(ChangeEntity.Organization, organization.id, ChangeOperation.Delete, JSON.stringify(organization.withTree([], []).toJson()), transaction);
    });
  }

  public async createAsync(params: DepartmentCreateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      OrganizationService.requireParent(organization, params.parent);
      OrganizationService.requireType(organization, params.typeId);
      const leader = Object.isNull(params.leaderId) ? null : await this.requireTeammateAsync(params.leaderId, transaction);
      if (!Object.isNull(leader) && organization.pathOf(params.parent).some(t => t.equals(OrganizationParent.teammate(leader.id))))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderLeader(leader.name, params.name), [leader.id]);
      const now = new Date().toISOString();
      const department = new Department(Guid.createVersion7().toString(), params.name, params.typeId, params.parent, leader?.id ?? null,
        organization.departmentsUnder(params.parent).length, now, now);
      const json = JSON.stringify(department.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertDepartment, [department.id, organization.id, department.parentId, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Insert, json, transaction);
      if (!Object.isNull(leader))
        await this.moveTeammateAsync(organization, leader.id, OrganizationParent.department(department.id), 0, transaction);
      return department;
    });
  }

  public async updateAsync(params: DepartmentUpdateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      const node = OrganizationParent.department(department.id);
      if (!Object.isUndefined(params.typeId))
        OrganizationService.requireType(organization, params.typeId);
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
      const organization = await this.requireAsync(params.organizationId, transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      OrganizationService.requireParent(organization, params.parent);
      if (!Object.isNull(organization.moveError(OrganizationParent.department(department.id), params.parent)))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderItself(department.name), [department.id]);
      const now = new Date().toISOString();
      const joined = organization.departmentsUnder(params.parent).filter(t => t.id !== department.id);
      const order = Math.min(params.order, joined.length);
      const moved = new Department(department.id, department.name, department.typeId, params.parent, department.leaderId, order, department.createdAt, now);
      joined.splice(order, 0, moved);
      if (!department.parent.equals(params.parent))
        await this.arrangeDepartmentsAsync(organization.departmentsUnder(department.parent).filter(t => t.id !== department.id), now, transaction);
      await this.arrangeDepartmentsAsync(joined, now, transaction, moved.id);
      return moved;
    });
  }

  public async deleteAsync(params: DepartmentIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      await this.liftChildrenAsync(organization, OrganizationParent.department(department.id), department.parent, transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteDepartment, [department.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Delete,
        JSON.stringify(department.toJson()), transaction);
    });
  }

  public async createNodeTypeAsync(params: NodeTypeCreateParams): Promise<NodeType> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      OrganizationService.requireFreeName(organization, params.name, null);
      const now = new Date().toISOString();
      const type = new NodeType(Guid.createVersion7().toString(), params.name, params.icon, params.color, now, now);
      await this.saveTypesAsync(organization, [...organization.nodeTypes, type], now, transaction);
      return type;
    });
  }

  public async updateNodeTypeAsync(params: NodeTypeUpdateParams): Promise<NodeType> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      const now = new Date().toISOString();
      const type = params.applyTo(OrganizationService.requireType(organization, params.typeId), now);
      OrganizationService.requireFreeName(organization, type.name, type.id);
      await this.saveTypesAsync(organization, organization.nodeTypes.map(t => t.id === type.id ? type : t), now, transaction);
      return type;
    });
  }

  public async deleteNodeTypeAsync(params: NodeTypeIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      const type = OrganizationService.requireType(organization, params.typeId);
      const users = organization.departments.filter(t => t.typeId === type.id);
      if (users.length > 0)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatNodeTypeInUse(type.name, users.length), users.map(t => t.id));
      await this.saveTypesAsync(organization, organization.nodeTypes.filter(t => t.id !== type.id), new Date().toISOString(), transaction);
    });
  }

  public async readLayoutAsync(params: OrganizationIdParams, transaction?: SqlTransaction): Promise<JsonObject | null> {
    if (Object.isUndefined(transaction))
      return await this.context.database.connection.runInTransactionAsync(t => this.readLayoutAsync(params, t));
    const organization = await this.requireAsync(params.organizationId, transaction);
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectPreference, [Resources.formatOrganizationLayoutPreference(organization.id)]));
    return Object.isUndefined(record) ? null : JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  public async saveLayoutAsync(params: OrganizationLayoutSaveParams): Promise<JsonObject> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const previous = await this.readLayoutAsync(new OrganizationIdParams(params.organizationId), transaction);
      const name = Resources.formatOrganizationLayoutPreference(params.organizationId);
      const json = JSON.stringify(params.layout);
      await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [name, json, new Date().toISOString()]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, name,
        Object.isNull(previous) ? ChangeOperation.Insert : ChangeOperation.Update, json, transaction);
      return params.layout;
    });
  }

  public async setMemberAsync(params: DepartmentMemberSetParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      const parent = Object.isNull(params.departmentId) ? OrganizationParent.person
        : OrganizationParent.department(OrganizationService.require(organization, params.departmentId).id);
      if (organization.parentOf(OrganizationParent.teammate(params.teammateId))?.equals(parent) ?? false)
        return;
      await this.placeInAsync(organization, params.teammateId, parent, organization.placementsUnder(parent).length, transaction);
    });
  }

  public async placeAsync(params: TeammatePlaceParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.requireAsync(params.organizationId, transaction);
      if (!Object.isNull(params.parent))
        OrganizationService.requireParent(organization, params.parent);
      await this.placeInAsync(organization, params.teammateId, params.parent, params.order, transaction);
    });
  }

  public async removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<readonly string[]> {
    const ids = (await transaction.queryAsync(new SqlQuery(Resources.selectTeammateOrganizations, [teammateId]))).map(t => t.readString(Resources.organizationIdColumn));
    for (const id of ids) {
      const organization = await this.requireAsync(id, transaction);
      for (const placement of organization.placements.filter(t => t.teammateId === teammateId))
        await this.unplaceAsync(organization, placement, transaction);
    }
    return ids;
  }

  private async placeInAsync(organization: Organization, teammateId: string, parent: OrganizationParent | null, order: number,
    transaction: SqlTransaction): Promise<void> {
    const teammate = await this.requireTeammateAsync(teammateId, transaction);
    if (Object.isNull(parent)) {
      for (const placement of organization.placements.filter(t => t.teammateId === teammate.id))
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
    const teammateId = placement.teammateId;
    const node = OrganizationParent.teammate(teammateId);
    await this.stopLeadingAsync(organization, teammateId, null, transaction);
    await this.liftChildrenAsync(organization, node, placement.parent, transaction);
    await transaction.executeAsync(new SqlQuery(Resources.deleteTeammatePlacement, [organization.id, teammateId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.TeammatePlacement, Resources.formatTeammatePlacementKey(organization.id, teammateId),
      ChangeOperation.Delete, JSON.stringify(placement.toJson()), transaction);
  }

  private async liftChildrenAsync(organization: Organization, node: OrganizationParent, parent: OrganizationParent, transaction: SqlTransaction): Promise<void> {
    const now = new Date().toISOString();
    const siblings = organization.departmentsUnder(parent).filter(t => node.kind !== OrganizationNodeKind.Department || t.id !== node.id);
    const index = node.kind === OrganizationNodeKind.Department ? organization.departmentsUnder(parent).findIndex(t => t.id === node.id) : siblings.length;
    const children = organization.departmentsUnder(node).map(t => new Department(t.id, t.name, t.typeId, parent, t.leaderId, t.order, t.createdAt, now));
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
      await this.saveAsync(new Department(led.id, led.name, led.typeId, led.parent, null, led.order, led.createdAt, now), transaction);
  }

  private async arrangeDepartmentsAsync(siblings: readonly Department[], now: string, transaction: SqlTransaction, ...moved: readonly string[]): Promise<void> {
    for (const [order, sibling] of siblings.entries())
      if (sibling.order !== order || moved.includes(sibling.id))
        await this.saveAsync(new Department(sibling.id, sibling.name, sibling.typeId, sibling.parent, sibling.leaderId, order, sibling.createdAt, now), transaction);
  }

  private async arrangePlacementsAsync(organization: Organization, siblings: readonly TeammatePlacement[], transaction: SqlTransaction,
    ...moved: readonly string[]): Promise<void> {
    for (const [order, sibling] of siblings.entries()) {
      if (sibling.order === order && !moved.includes(sibling.teammateId))
        continue;
      const placement = new TeammatePlacement(sibling.teammateId, sibling.parent, order);
      const json = JSON.stringify(placement.toJson());
      const known = organization.placements.some(t => t.teammateId === placement.teammateId);
      await transaction.executeAsync(known ? new SqlQuery(Resources.updateTeammatePlacement, [json, organization.id, placement.teammateId])
        : new SqlQuery(Resources.insertTeammatePlacement, [organization.id, placement.teammateId, json]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.TeammatePlacement,
        Resources.formatTeammatePlacementKey(organization.id, placement.teammateId), known ? ChangeOperation.Update : ChangeOperation.Insert, json, transaction);
    }
  }

  private async saveAsync(department: Department, transaction: SqlTransaction): Promise<Department> {
    const json = JSON.stringify(department.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateDepartment, [department.parentId, json, department.updatedAt, department.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Update, json, transaction);
    return department;
  }

  private async saveTypesAsync(organization: Organization, nodeTypes: readonly NodeType[], now: string, transaction: SqlTransaction): Promise<void> {
    const saved = new Organization(organization.id, organization.name, organization.folder, organization.order, organization.createdAt, now, nodeTypes, [], []);
    const json = JSON.stringify(saved.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateOrganization, [json, now, saved.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Organization, saved.id, ChangeOperation.Update, json, transaction);
  }

  private static requireType(organization: Organization, typeId: string): NodeType {
    const type = organization.nodeTypes.find(t => t.id === typeId);
    if (Object.isUndefined(type))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatNodeTypeNotFound(typeId), [typeId]);
    return type;
  }

  private static requireFreeName(organization: Organization, name: string, typeId: string | null): void {
    const taken = organization.nodeTypes.find(t => t.id !== typeId && t.name.toLowerCase() === name.toLowerCase());
    if (!Object.isUndefined(taken))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatNodeTypeNameTaken(taken.name), [taken.id]);
  }

  private async requireAsync(organizationId: string, transaction: SqlTransaction): Promise<Organization> {
    const organization = await this.findAsync(organizationId, transaction);
    if (Object.isNull(organization))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatOrganizationNotFound(organizationId), [organizationId]);
    return organization;
  }

  private async withTreeAsync(organization: Organization, transaction: SqlTransaction): Promise<Organization> {
    const departments = await transaction.queryAsync(new SqlQuery(Resources.selectDepartments, [organization.id]));
    const placements = await transaction.queryAsync(new SqlQuery(Resources.selectTeammatePlacements, [organization.id]));
    return organization.withTree(departments.map(t => Department.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())),
      placements.map(t => TeammatePlacement.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())));
  }

  private static read(record: DataRecord): Organization {
    return Organization.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
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
