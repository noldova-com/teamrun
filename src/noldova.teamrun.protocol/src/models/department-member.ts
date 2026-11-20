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

export class DepartmentMember {
  public readonly teammateId: string;
  public readonly departmentId: string;

  public constructor(
    teammateId: string,
    departmentId: string) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);

    this.teammateId = teammateId;
    this.departmentId = departmentId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentMember {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentMember(
      reader.readNonBlankString(Resources.teammateIdField),
      reader.readNonBlankString(Resources.departmentIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.departmentIdField]: this.departmentId
    };
  }
}
