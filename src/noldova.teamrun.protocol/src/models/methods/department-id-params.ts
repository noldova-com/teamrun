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

export class DepartmentIdParams {
  public readonly organizationId: string;
  public readonly departmentId: string;

  public constructor(
    organizationId: string,
    departmentId: string) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    ArgumentException.throwIfNullOrWhitespace(departmentId, Resources.departmentIdField);

    this.organizationId = organizationId;
    this.departmentId = departmentId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentIdParams(
      reader.readNonBlankString(Resources.organizationIdField),
      reader.readNonBlankString(Resources.departmentIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.departmentIdField]: this.departmentId
    };
  }
}
