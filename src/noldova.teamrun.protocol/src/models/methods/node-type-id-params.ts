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

export class NodeTypeIdParams {
  public readonly organizationId: string;
  public readonly typeId: string;

  public constructor(
    organizationId: string,
    typeId: string) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    ArgumentException.throwIfNullOrWhitespace(typeId, Resources.typeIdField);

    this.organizationId = organizationId;
    this.typeId = typeId;
  }

  public static fromJson(value: unknown, path?: string): NodeTypeIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new NodeTypeIdParams(
      reader.readNonBlankString(Resources.organizationIdField),
      reader.readNonBlankString(Resources.typeIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.typeIdField]: this.typeId
    };
  }
}
