/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PermissionDetailKind } from "../enums/permission-detail-kind.js";
import { Resources } from "../resources.js";

export class PermissionDetail {
  public readonly label: string;
  public readonly kind: PermissionDetailKind;
  public readonly value: string | null;

  public constructor(label: string, kind: PermissionDetailKind, value: string | null) {
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    if ((kind === PermissionDetailKind.Secret) !== Object.isNull(value))
      throw new ArgumentException(Resources.secretValueMismatch, Resources.valueField);

    this.label = label;
    this.kind = kind;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): PermissionDetail {
    const reader = JsonReader.fromValue(value, path);
    return new PermissionDetail(
      reader.readNonBlankString(Resources.labelField),
      reader.readOneOf(Resources.kindField, Object.values(PermissionDetailKind)),
      reader.readNullableString(Resources.valueField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.labelField]: this.label,
      [Resources.kindField]: this.kind,
      [Resources.valueField]: this.value
    };
  }
}
