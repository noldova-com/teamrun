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

import { OrganizationNodeKind } from "../../enums/organization-node-kind.js";
import { Resources } from "../../resources.js";
import { Department } from "../department.js";
import { OrganizationParent } from "../organization-parent.js";

export class DepartmentMoveParams {
  public readonly departmentId: string;
  public readonly parent: OrganizationParent;
  public readonly order: number;

  public constructor(
    departmentId: string,
    parent: OrganizationParent,
    order: number) {
    ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);
    if (parent.kind === OrganizationNodeKind.Department && parent.id === departmentId)
      throw new ArgumentException(Resources.departmentOwnParent, Resources.parentField);
    Department.validateOrder(order);

    this.departmentId = departmentId;
    this.parent = parent;
    this.order = order;
  }

  public static fromJson(value: unknown, path?: string): DepartmentMoveParams {
    const reader = JsonReader.fromValue(value, path);
    const parent = reader.readObject(Resources.parentField);
    return new DepartmentMoveParams(
      reader.readNonBlankString(Resources.departmentIdField),
      OrganizationParent.fromJson(parent.toJson(), parent.path),
      reader.readInteger(Resources.orderField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.departmentIdField]: this.departmentId,
      [Resources.parentField]: this.parent.toJson(),
      [Resources.orderField]: this.order
    };
  }
}
