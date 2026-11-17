/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class McpToolListParams {
  public readonly token: string;

  public constructor(token: string) {
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);

    this.token = token;
  }

  public static fromJson(value: unknown, path?: string): McpToolListParams {
    return new McpToolListParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.tokenField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.tokenField]: this.token
    };
  }
}
