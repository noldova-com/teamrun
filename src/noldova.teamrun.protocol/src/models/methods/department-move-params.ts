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

export class DepartmentMoveParams {
  public readonly departmentId: string;
  public readonly parentId: string | null;
  public readonly order: number;

  public constructor(
    departmentId: string,
    parentId: string | null,
    order: number) {
    ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);
    if (!Object.isNull(parentId))
      ArgumentException.throwIfNullOrWhitespace(parentId, Resources.parentIdField);
    if (parentId === departmentId)
      throw new ArgumentException(Resources.departmentOwnParent, Resources.parentIdField);
    Department.validateOrder(order);

    this.departmentId = departmentId;
    this.parentId = parentId;
    this.order = order;
  }

  public static fromJson(value: unknown, path?: string): DepartmentMoveParams {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentMoveParams(
      reader.readNonBlankString(Resources.departmentIdField),
      reader.readNullableString(Resources.parentIdField),
      reader.readInteger(Resources.orderField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.departmentIdField]: this.departmentId,
      [Resources.parentIdField]: this.parentId,
      [Resources.orderField]: this.order
    };
  }
}
