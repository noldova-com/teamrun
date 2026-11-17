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
import { SubAgent } from "../sub-agent.js";

export class SubAgentWaitResult {
  public readonly ended: readonly SubAgent[];
  public readonly running: readonly string[];

  public constructor(ended: readonly SubAgent[], running: readonly string[]) {
    for (const subAgentId of running)
      ArgumentException.throwIfNullOrWhitespace(subAgentId, Resources.runningField);

    this.ended = [...ended];
    this.running = [...running];
  }

  public static fromJson(value: unknown, path?: string): SubAgentWaitResult {
    const reader = JsonReader.fromValue(value, path);
    return new SubAgentWaitResult(reader.readObjectArray(Resources.endedField).map(t => SubAgent.fromJson(t.toJson(), t.path)),
      reader.readStringArray(Resources.runningField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.endedField]: this.ended.map(t => t.toJson()),
      [Resources.runningField]: [...this.running]
    };
  }
}
