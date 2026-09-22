/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import type { ReplyOutcome } from "./reply-outcome.js";

export class LiveCheckReport {
  public readonly provider: string;
  public readonly prompt: string;
  public readonly projectPath: string;
  public readonly outcomes: readonly ReplyOutcome[];
  public readonly durationMilliseconds: number;

  public constructor(provider: string, prompt: string, projectPath: string, outcomes: readonly ReplyOutcome[], durationMilliseconds: number) {
    this.provider = provider;
    this.prompt = prompt;
    this.projectPath = projectPath;
    this.outcomes = [...outcomes];
    this.durationMilliseconds = durationMilliseconds;
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerOption]: this.provider,
      [Resources.promptOption]: this.prompt,
      [Resources.projectPathField]: this.projectPath,
      [Resources.repliesField]: this.outcomes.map(t => t.reply.toJson()),
      [Resources.detailCountField]: this.outcomes.reduce((sum, t) => sum + t.detailCount, 0),
      [Resources.decisionsField]: this.outcomes.flatMap(t => t.decisions),
      [Resources.durationField]: this.durationMilliseconds
    };
  }
}
