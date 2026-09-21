/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class JsonRpcError {
  public readonly code: number;
  public readonly message: string;
  public readonly data: JsonValue;

  public constructor(code: number, message: string, data: JsonValue) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  public static fromJson(value: unknown, path?: string): JsonRpcError {
    const reader = JsonReader.fromValue(value, path);
    const data = reader.hasField(Resources.dataField) ? reader.readValue(Resources.dataField) : null;

    return new JsonRpcError(reader.readInteger(Resources.codeField), reader.readString(Resources.messageField), data);
  }

  public toJson(): JsonObject {
    return { code: this.code, message: this.message, data: this.data };
  }
}
