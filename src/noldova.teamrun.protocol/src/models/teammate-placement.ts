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
import { OrganizationParent } from "./organization-parent.js";

export class TeammatePlacement {
  public readonly teammateId: string;
  public readonly parent: OrganizationParent;
  public readonly order: number;

  public constructor(teammateId: string, parent: OrganizationParent, order: number) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (parent.equals(OrganizationParent.teammate(teammateId)))
      throw new ArgumentException(Resources.organizationNodeUnderItself, Resources.parentField);
    if (!Number.isSafeInteger(order) || order < 0)
      throw new ArgumentException(Resources.invalidOrganizationOrder, Resources.orderField);

    this.teammateId = teammateId;
    this.parent = parent;
    this.order = order;
  }

  public static fromJson(value: unknown, path?: string): TeammatePlacement {
    const reader = JsonReader.fromValue(value, path);
    const parent = reader.readObject(Resources.parentField);
    return new TeammatePlacement(
      reader.readNonBlankString(Resources.teammateIdField),
      OrganizationParent.fromJson(parent.toJson(), parent.path),
      reader.readInteger(Resources.orderField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.parentField]: this.parent.toJson(),
      [Resources.orderField]: this.order
    };
  }
}
