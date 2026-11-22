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
import { OrganizationParent } from "../organization-parent.js";

export class TeammatePlaceParams {
  public readonly teammateId: string;
  public readonly parent: OrganizationParent | null;
  public readonly order: number;

  public constructor(
    teammateId: string,
    parent: OrganizationParent | null,
    order: number) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(parent) && parent.equals(OrganizationParent.teammate(teammateId)))
      throw new ArgumentException(Resources.organizationNodeUnderItself, Resources.parentField);
    if (!Number.isSafeInteger(order) || order < 0)
      throw new ArgumentException(Resources.invalidOrganizationOrder, Resources.orderField);

    this.teammateId = teammateId;
    this.parent = parent;
    this.order = order;
  }

  public static fromJson(value: unknown, path?: string): TeammatePlaceParams {
    const reader = JsonReader.fromValue(value, path);
    const parent = reader.readNullableObject(Resources.parentField);
    return new TeammatePlaceParams(
      reader.readNonBlankString(Resources.teammateIdField),
      Object.isNull(parent) ? null : OrganizationParent.fromJson(parent.toJson(), parent.path),
      reader.readInteger(Resources.orderField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.parentField]: this.parent?.toJson() ?? null,
      [Resources.orderField]: this.order
    };
  }
}
