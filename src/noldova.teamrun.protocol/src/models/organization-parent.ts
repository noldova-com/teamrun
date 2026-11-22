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

import { OrganizationNodeKind } from "../enums/organization-node-kind.js";
import { Resources } from "../resources.js";

export class OrganizationParent {
  public static readonly person: OrganizationParent = new OrganizationParent(OrganizationNodeKind.Person, null);

  public readonly kind: OrganizationNodeKind;
  public readonly id: string | null;

  public constructor(kind: OrganizationNodeKind, id: string | null) {
    if ((kind === OrganizationNodeKind.Person) !== Object.isNull(id))
      throw new ArgumentException(Resources.organizationParentIdRequired, Resources.idField);
    if (!Object.isNull(id))
      ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.kind = kind;
    this.id = id;
  }

  public static teammate(teammateId: string): OrganizationParent {
    return new OrganizationParent(OrganizationNodeKind.Teammate, teammateId);
  }

  public static department(departmentId: string): OrganizationParent {
    return new OrganizationParent(OrganizationNodeKind.Department, departmentId);
  }

  public static departmentOrPerson(departmentId: string | null): OrganizationParent {
    return Object.isNull(departmentId) ? OrganizationParent.person : OrganizationParent.department(departmentId);
  }

  public static fromJson(value: unknown, path?: string): OrganizationParent {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationParent(
      reader.readOneOf(Resources.kindField, Object.values(OrganizationNodeKind)),
      reader.readNullableString(Resources.idField));
  }

  public equals(other: OrganizationParent): boolean {
    return this.kind === other.kind && this.id === other.id;
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.idField]: this.id
    };
  }
}
