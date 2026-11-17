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

export class SharedMcpServerIdParams {
  public readonly serverId: string;

  public constructor(serverId: string) {
    ArgumentException.throwIfNullOrWhitespace(serverId, Resources.serverIdField);

    this.serverId = serverId;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpServerIdParams {
    return new SharedMcpServerIdParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.serverIdField));
  }

  public toJson(): JsonObject {
    return { [Resources.serverIdField]: this.serverId };
  }
}
