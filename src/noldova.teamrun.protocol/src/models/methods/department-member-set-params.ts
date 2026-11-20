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

export class DepartmentMemberSetParams {
  public readonly teammateId: string;
  public readonly departmentId: string | null;

  public constructor(
    teammateId: string,
    departmentId: string | null) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(departmentId))
      ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);

    this.teammateId = teammateId;
    this.departmentId = departmentId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentMemberSetParams {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentMemberSetParams(
      reader.readNonBlankString(Resources.teammateIdField),
      reader.readNullableString(Resources.departmentIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.departmentIdField]: this.departmentId
    };
  }
}
