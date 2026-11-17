/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class SubAgentWaitParams {
  public readonly senderToken: string;
  public readonly subAgentIds: readonly string[];
  public readonly seconds: number;

  public constructor(senderToken: string, subAgentIds: readonly string[], seconds: number) {
    ArgumentException.throwIfNullOrWhitespace(senderToken, Resources.senderTokenField);
    for (const subAgentId of subAgentIds)
      ArgumentException.throwIfNullOrWhitespace(subAgentId, Resources.subAgentIdsField);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > Resources.maximumSubAgentWaitSeconds)
      throw new ArgumentOutOfRangeException(Resources.secondsField, seconds);

    this.senderToken = senderToken;
    this.subAgentIds = [...subAgentIds];
    this.seconds = seconds;
  }

  public static fromJson(value: unknown, path?: string): SubAgentWaitParams {
    const reader = JsonReader.fromValue(value, path);
    return new SubAgentWaitParams(reader.readNonBlankString(Resources.senderTokenField), reader.readStringArray(Resources.subAgentIdsField),
      reader.readInteger(Resources.secondsField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.senderTokenField]: this.senderToken,
      [Resources.subAgentIdsField]: [...this.subAgentIds],
      [Resources.secondsField]: this.seconds
    };
  }
}
