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

export class SubAgentStopParams {
  public readonly senderToken: string;
  public readonly subAgentId: string;

  public constructor(senderToken: string, subAgentId: string) {
    ArgumentException.throwIfNullOrWhitespace(senderToken, Resources.senderTokenField);
    ArgumentException.throwIfNullOrWhitespace(subAgentId, Resources.subAgentIdField);

    this.senderToken = senderToken;
    this.subAgentId = subAgentId;
  }

  public static fromJson(value: unknown, path?: string): SubAgentStopParams {
    const reader = JsonReader.fromValue(value, path);
    return new SubAgentStopParams(reader.readNonBlankString(Resources.senderTokenField), reader.readNonBlankString(Resources.subAgentIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.senderTokenField]: this.senderToken,
      [Resources.subAgentIdField]: this.subAgentId
    };
  }
}
