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
  public readonly organizationId: string;
  public readonly name: string;
  public readonly typeId: string;
  public readonly parent: OrganizationParent;
  public readonly leaderId: string | null;

  public constructor(
    organizationId: string,
    name: string,
    typeId: string,
    parent: OrganizationParent,
    leaderId: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    Department.validateName(name);
    ArgumentException.throwIfNullOrWhitespace(typeId, Resources.typeIdField);
    if (!Object.isNull(leaderId))
      ArgumentException.throwIfNullOrWhitespace(leaderId, Resources.leaderIdField);

    this.organizationId = organizationId;
    this.name = name;
    this.typeId = typeId;
    this.parent = parent;
    this.leaderId = leaderId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentCreateParams {
    const reader = JsonReader.fromValue(value, path);
    const parent = reader.readObject(Resources.parentField);
    return new DepartmentCreateParams(
      reader.readNonBlankString(Resources.organizationIdField),
      Department.readName(reader),
      reader.readNonBlankString(Resources.typeIdField),
      OrganizationParent.fromJson(parent.toJson(), parent.path),
      reader.hasField(Resources.leaderIdField) ? reader.readNullableString(Resources.leaderIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.nameField]: this.name,
      [Resources.typeIdField]: this.typeId,
      [Resources.parentField]: this.parent.toJson(),
      [Resources.leaderIdField]: this.leaderId
    };
  }
}
