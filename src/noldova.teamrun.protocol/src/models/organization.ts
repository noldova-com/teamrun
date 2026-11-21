/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { OrganizationTargetKind } from "../enums/organization-target-kind.js";
import { Resources } from "../resources.js";
import { Department } from "./department.js";
import { DepartmentMember } from "./department-member.js";
import type { OrganizationTarget } from "./organization-target.js";

export class Organization {
  public static readonly empty: Organization = new Organization([], []);

  public readonly departments: readonly Department[];
  public readonly members: readonly DepartmentMember[];

  public constructor(
    departments: readonly Department[],
    members: readonly DepartmentMember[]) {
    const ids = new Set(departments.map(t => t.id));
    if (ids.size !== departments.length)
      throw new ArgumentException(Resources.duplicateDepartment, Resources.departmentsField);
    if (departments.some(t => !Object.isNull(t.parentId) && !ids.has(t.parentId)))
      throw new ArgumentException(Resources.unknownParentDepartment, Resources.departmentsField);
    if (members.some(t => !ids.has(t.departmentId)))
      throw new ArgumentException(Resources.unknownMemberDepartment, Resources.membersField);
    if (new Set(members.map(t => t.teammateId)).size !== members.length)
      throw new ArgumentException(Resources.teammateInTwoDepartments, Resources.membersField);

    this.departments = [...departments].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    this.members = [...members];
  }

  public childrenOf(parentId: string | null): readonly Department[] {
    return this.departments.filter(t => t.parentId === parentId);
  }

  public departmentOf(teammateId: string): string | null {
    return this.members.find(t => t.teammateId === teammateId)?.departmentId ?? null;
  }

  public managerOf(teammateId: string): string | null {
    const departmentId = this.departmentOf(teammateId);
    let department = this.departments.find(t => t.id === departmentId);
    while (!Object.isUndefined(department)) {
      if (!Object.isNull(department.leaderId) && department.leaderId !== teammateId)
        return department.leaderId;
      const parentId = department.parentId;
      department = this.departments.find(t => t.id === parentId);
    }
    return null;
  }

  public recipientsOf(target: OrganizationTarget, teammateIds: readonly string[]): readonly string[] {
    const known = new Set(teammateIds);
    switch (target.kind) {
      case OrganizationTargetKind.Teammate:
        return teammateIds.filter(t => t === target.id);
      case OrganizationTargetKind.Department: {
        const leaderId = this.departments.find(t => t.id === target.id)?.leaderId ?? null;
        const members = this.members.filter(t => t.departmentId === target.id && known.has(t.teammateId)).map(t => t.teammateId);
        return [...members.filter(t => t === leaderId), ...members.filter(t => t !== leaderId)];
      }
      case OrganizationTargetKind.Leaders: {
        const leaders: string[] = [];
        for (const department of this.departments)
          if (!Object.isNull(department.leaderId) && known.has(department.leaderId))
            leaders.push(department.leaderId);
        return [...leaders, ...teammateIds.filter(t => Object.isNull(this.departmentOf(t)) && !leaders.includes(t))];
      }
      default:
        return [...teammateIds];
    }
  }

  public static fromJson(value: unknown, path?: string): Organization {
    const reader = JsonReader.fromValue(value, path);
    return new Organization(
      reader.readObjectArray(Resources.departmentsField).map(t => Department.fromJson(t.toJson(), t.path)),
      reader.readObjectArray(Resources.membersField).map(t => DepartmentMember.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.departmentsField]: this.departments.map(t => t.toJson()),
      [Resources.membersField]: this.members.map(t => t.toJson())
    };
  }
}
