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

import { Resources } from "../resources.js";
import { Department } from "./department.js";
import { DepartmentMember } from "./department-member.js";

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
