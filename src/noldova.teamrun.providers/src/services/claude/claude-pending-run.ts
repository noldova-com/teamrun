/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { ClaudeTurn } from "./claude-turn.js";

export class ClaudePendingRun {
  public readonly turn: ClaudeTurn;
  public readonly uuid: string;
  public readonly done: PromiseWithResolvers<boolean>;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly interrupted: () => void;
  public held: SDKUserMessage | null = null;
  public taken: boolean = false;

  public constructor(turn: ClaudeTurn, uuid: string, done: PromiseWithResolvers<boolean>, environment: Readonly<Record<string, string>>,
    interrupted: () => void) {
    this.turn = turn;
    this.uuid = uuid;
    this.done = done;
    this.environment = environment;
    this.interrupted = interrupted;
  }
}
