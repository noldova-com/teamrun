/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ActiveRun } from "../../models/active-run.js";
import type { ReplyWork } from "../../models/reply-work.js";
import type { TurnToolSession } from "../../models/turn-tool-session.js";
import type { ReplyRun } from "./reply-run.js";

export class TurnState {
  public readonly groups: Map<string, ReplyWork[]> = new Map();
  public readonly turns: Map<string, ReplyWork> = new Map();
  public readonly runs: Map<string, ActiveRun> = new Map();
  public readonly replyRuns: Map<ReplyWork, ReplyRun> = new Map();
  public readonly runWaits: Map<ReplyWork, Set<() => void>> = new Map();
  public readonly sessions: TurnToolSession[] = [];
  public closing: boolean = false;
}
