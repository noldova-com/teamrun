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

export class OrganizationTarget {
  public static readonly leaders: OrganizationTarget = new OrganizationTarget(OrganizationTargetKind.Leaders, null);
  public static readonly everyone: OrganizationTarget = new OrganizationTarget(OrganizationTargetKind.Everyone, null);

  public readonly kind: OrganizationTargetKind;
  public readonly id: string | null;

  public constructor(kind: OrganizationTargetKind, id: string | null) {
    const named = kind === OrganizationTargetKind.Teammate || kind === OrganizationTargetKind.Department;
    if (named !== !Object.isNull(id))
      throw new ArgumentException(Resources.targetIdRequired, Resources.idField);
    if (!Object.isNull(id))
      ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.kind = kind;
    this.id = id;
  }

  public static teammate(teammateId: string): OrganizationTarget {
    return new OrganizationTarget(OrganizationTargetKind.Teammate, teammateId);
  }

  public static department(departmentId: string): OrganizationTarget {
    return new OrganizationTarget(OrganizationTargetKind.Department, departmentId);
  }

  public static fromJson(value: unknown, path?: string): OrganizationTarget {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationTarget(
      reader.readOneOf(Resources.kindField, Object.values(OrganizationTargetKind)),
      reader.readNullableString(Resources.idField));
  }

  public equals(other: OrganizationTarget): boolean {
    return this.kind === other.kind && this.id === other.id;
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.idField]: this.id
    };
  }
}
