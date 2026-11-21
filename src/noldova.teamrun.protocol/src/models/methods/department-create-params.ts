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

export class DepartmentCreateParams {
  public readonly name: string;
  public readonly parentId: string | null;

  public constructor(
    name: string,
    parentId: string | null) {
    Department.validateName(name);
    if (!Object.isNull(parentId))
      ArgumentException.throwIfNullOrWhitespace(parentId, Resources.parentIdField);

    this.name = name;
    this.parentId = parentId;
  }

  public static fromJson(value: unknown, path?: string): DepartmentCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new DepartmentCreateParams(
      Department.readName(reader),
      reader.readNullableString(Resources.parentIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.parentIdField]: this.parentId
    };
  }
}
