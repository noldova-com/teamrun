/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class Department {
  public readonly id: string;
  public readonly name: string;
  public readonly parentId: string | null;
  public readonly leaderId: string | null;
  public readonly order: number;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  public constructor(
    id: string,
    name: string,
    parentId: string | null,
    leaderId: string | null,
    order: number,
    createdAt: string,
    updatedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    Department.validateName(name);
    if (!Object.isNull(parentId))
      ArgumentException.throwIfNullOrWhitespace(parentId, Resources.parentIdField);
    if (parentId === id)
      throw new ArgumentException(Resources.departmentOwnParent, Resources.parentIdField);
    if (!Object.isNull(leaderId))
      ArgumentException.throwIfNullOrWhitespace(leaderId, Resources.leaderIdField);
    Department.validateOrder(order);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);

    this.id = id;
    this.name = name;
    this.parentId = parentId;
    this.leaderId = leaderId;
    this.order = order;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static validateName(name: string): void {
    if (!Department.allowsName(name))
      throw new ArgumentException(Resources.invalidDepartmentName, Resources.nameField);
  }

  public static readName(reader: JsonReader): string {
    const name = reader.readString(Resources.nameField);
    if (!Department.allowsName(name))
      throw new JsonException(Resources.invalidDepartmentName, `${reader.path}.${Resources.nameField}`);
    return name;
  }

  public static validateOrder(order: number): void {
    if (!Number.isSafeInteger(order) || order < 0)
      throw new ArgumentException(Resources.invalidDepartmentOrder, Resources.orderField);
  }

  public static fromJson(value: unknown, path?: string): Department {
    const reader = JsonReader.fromValue(value, path);
    return new Department(
      reader.readNonBlankString(Resources.idField),
      Department.readName(reader),
      reader.readNullableString(Resources.parentIdField),
      reader.readNullableString(Resources.leaderIdField),
      reader.readInteger(Resources.orderField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.parentIdField]: this.parentId,
      [Resources.leaderIdField]: this.leaderId,
      [Resources.orderField]: this.order,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt
    };
  }

  private static allowsName(name: string): boolean {
    return Resources.departmentNamePattern.test(name) && name.trim().length > 0;
  }
}
