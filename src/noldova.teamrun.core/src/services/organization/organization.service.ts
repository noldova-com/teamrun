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
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  Department, type DepartmentCreateParams, type DepartmentIdParams, DepartmentMember, type DepartmentMemberSetParams, type DepartmentMoveParams,
  type DepartmentUpdateParams, ErrorCode, Organization, Teammate
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
    const members = await transaction.queryAsync(new SqlQuery(Resources.selectDepartmentMembers));
    return new Organization(departments.map(t => Department.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())),
      members.map(t => OrganizationService.readMember(t)));
  }

  public async createAsync(params: DepartmentCreateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      if (!Object.isNull(params.parentId))
        OrganizationService.require(organization, params.parentId);
      const now = new Date().toISOString();
      const department = new Department(Guid.createVersion7().toString(), params.name, params.parentId, null,
        organization.childrenOf(params.parentId).length, now, now);
      const json = JSON.stringify(department.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertDepartment, [department.id, department.parentId, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Insert, json, transaction);
      return department;
    });
  }

  public async updateAsync(params: DepartmentUpdateParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      if (!Object.isNullOrUndefined(params.leaderId)) {
        const leader = await this.requireTeammateAsync(params.leaderId, transaction);
        if (organization.departmentOf(leader.id) !== department.id)
          throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentLeaderNotMember(leader.name, department.name), [leader.id]);
      }
      return await this.saveAsync(params.applyTo(department, new Date().toISOString()), transaction);
    });
  }

  public async moveAsync(params: DepartmentMoveParams): Promise<Department> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      for (let parentId = params.parentId; !Object.isNull(parentId); parentId = OrganizationService.require(organization, parentId).parentId)
        if (parentId === department.id)
          throw new ServiceException(ErrorCode.InvalidParams, Resources.formatDepartmentUnderItself(department.name), [department.id]);
      const now = new Date().toISOString();
      const joined = organization.childrenOf(params.parentId).filter(t => t.id !== department.id);
      const order = Math.min(params.order, joined.length);
      const moved = new Department(department.id, department.name, params.parentId, department.leaderId, order, department.createdAt, now);
      joined.splice(order, 0, moved);
      if (department.parentId !== params.parentId)
        await this.placeAsync(organization.childrenOf(department.parentId).filter(t => t.id !== department.id), now, transaction);
      await this.placeAsync(joined, now, transaction, moved.id);
      return moved;
    });
  }

  public async deleteAsync(params: DepartmentIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      const department = OrganizationService.require(organization, params.departmentId);
      const now = new Date().toISOString();
      const siblings = organization.childrenOf(department.parentId).filter(t => t.id !== department.id);
      const children = organization.childrenOf(department.id)
        .map(t => new Department(t.id, t.name, department.parentId, t.leaderId, t.order, t.createdAt, now));
      siblings.splice(organization.childrenOf(department.parentId).indexOf(department), 0, ...children);
      await this.placeAsync(siblings, now, transaction, ...children.map(t => t.id));
      for (const member of organization.members.filter(t => t.departmentId === department.id)) {
        await this.leaveAsync(member, transaction);
        if (!Object.isNull(department.parentId))
          await this.joinAsync(new DepartmentMember(member.teammateId, department.parentId), transaction);
      }
      await transaction.executeAsync(new SqlQuery(Resources.deleteDepartment, [department.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Department, department.id, ChangeOperation.Delete,
        JSON.stringify(department.toJson()), transaction);
    });
  }

  public async setMemberAsync(params: DepartmentMemberSetParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.listAsync(transaction);
      await this.requireTeammateAsync(params.teammateId, transaction);
      if (!Object.isNull(params.departmentId))
        OrganizationService.require(organization, params.departmentId);
      const current = organization.members.find(t => t.teammateId === params.teammateId);
      if ((current?.departmentId ?? null) === params.departmentId)
        return;
      await this.stopLeadingAsync(organization, params.teammateId, transaction);
      if (!Object.isUndefined(current))
        await this.leaveAsync(current, transaction);
      if (!Object.isNull(params.departmentId))
        await this.joinAsync(new DepartmentMember(params.teammateId, params.departmentId), transaction);
    });
  }

  public async removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<boolean> {
    const organization = await this.listAsync(transaction);
    const current = organization.members.find(t => t.teammateId === teammateId);
    if (Object.isUndefined(current))
      return false;
    await this.stopLeadingAsync(organization, teammateId, transaction);
    await this.leaveAsync(current, transaction);
    return true;
  }

  private async stopLeadingAsync(organization: Organization, teammateId: string, transaction: SqlTransaction): Promise<void> {
    const now = new Date().toISOString();
    for (const led of organization.departments.filter(t => t.leaderId === teammateId))
      await this.saveAsync(new Department(led.id, led.name, led.parentId, null, led.order, led.createdAt, now), transaction);
  }

  private async leaveAsync(member: DepartmentMember, transaction: SqlTransaction): Promise<void> {
    await transaction.executeAsync(new SqlQuery(Resources.deleteDepartmentMember, [member.teammateId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.DepartmentMember, member.teammateId, ChangeOperation.Delete,
      JSON.stringify(member.toJson()), transaction);
  }

  private async joinAsync(member: DepartmentMember, transaction: SqlTransaction): Promise<void> {
    const json = JSON.stringify(member.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.insertDepartmentMember, [member.teammateId, member.departmentId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.DepartmentMember, member.teammateId, ChangeOperation.Insert, json, transaction);
  }

  private async placeAsync(siblings: readonly Department[], now: string, transaction: SqlTransaction, ...moved: readonly string[]): Promise<void> {
    for (const [order, sibling] of siblings.entries())
      if (sibling.order !== order || moved.includes(sibling.id))
        await this.saveAsync(new Department(sibling.id, sibling.name, sibling.parentId, sibling.leaderId, order, sibling.createdAt, now), transaction);
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

  private static require(organization: Organization, departmentId: string): Department {
    const department = organization.departments.find(t => t.id === departmentId);
    if (Object.isUndefined(department))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatDepartmentNotFound(departmentId), [departmentId]);
    return department;
  }

  private static readMember(record: DataRecord): DepartmentMember {
    return new DepartmentMember(record.readString(Resources.teammateIdColumn), record.readString(Resources.departmentIdColumn));
  }
}
