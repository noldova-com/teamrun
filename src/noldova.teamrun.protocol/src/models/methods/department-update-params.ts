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

import { Resources } from "../../resources.js";
import { Department } from "../department.js";

export class DepartmentUpdateParams {
  public readonly departmentId: string;
  public readonly name: string | undefined;
  public readonly leaderId: string | null | undefined;

  public constructor(
    departmentId: string,
    name: string | undefined,
    leaderId: string | null | undefined) {
    ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);
    if (Object.isUndefined(name) && Object.isUndefined(leaderId))
      throw new ArgumentException(Resources.emptyDepartmentUpdate, Resources.departmentIdField);
    if (!Object.isUndefined(name))
      Department.validateName(name);
    if (!Object.isNullOrUndefined(leaderId))
      ArgumentException.throwIfNullOrWhitespace(leaderId, Resources.leaderIdField);

    this.departmentId = departmentId;
    this.name = name;
    this.leaderId = leaderId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentUpdateParams(
      reader.readNonBlankString(Resources.departmentIdField),
      reader.hasField(Resources.nameField) ? Department.readName(reader) : undefined,
      reader.hasField(Resources.leaderIdField) ? reader.readNullableString(Resources.leaderIdField) : undefined);
  }

  public applyTo(department: Department, updatedAt: string): Department {
    return new Department(department.id, this.name ?? department.name, department.parentId,
      Object.isUndefined(this.leaderId) ? department.leaderId : this.leaderId, department.order, department.createdAt, updatedAt);
  }

  public toJson(): JsonObject {
    return {
      [Resources.departmentIdField]: this.departmentId,
      ...Object.isUndefined(this.name) ? {} : { [Resources.nameField]: this.name },
      ...Object.isUndefined(this.leaderId) ? {} : { [Resources.leaderIdField]: this.leaderId }
    };
  }
}
