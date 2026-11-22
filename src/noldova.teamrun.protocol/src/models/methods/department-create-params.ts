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
import { OrganizationParent } from "../organization-parent.js";

export class DepartmentCreateParams {
  public readonly name: string;
  public readonly parent: OrganizationParent;
  public readonly leaderId: string | null;

  public constructor(
    name: string,
    parent: OrganizationParent,
    leaderId: string | null = null) {
    Department.validateName(name);
    if (!Object.isNull(leaderId))
      ArgumentException.throwIfNullOrWhitespace(leaderId, Resources.leaderIdField);

    this.name = name;
    this.parent = parent;
    this.leaderId = leaderId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentCreateParams {
    const reader = JsonReader.fromValue(value, path);
    const parent = reader.readObject(Resources.parentField);
    return new DepartmentCreateParams(
      Department.readName(reader),
      OrganizationParent.fromJson(parent.toJson(), parent.path),
      reader.hasField(Resources.leaderIdField) ? reader.readNullableString(Resources.leaderIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.parentField]: this.parent.toJson(),
      [Resources.leaderIdField]: this.leaderId
    };
  }
}
