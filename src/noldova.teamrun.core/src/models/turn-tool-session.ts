/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, ProviderMode } from "@noldova/teamrun.protocol";

import type { ITurnToolSession } from "../interfaces/i-turn-tool-session.js";
import type { ReplyRun } from "../services/engine/reply-run.js";
import { ReplyMode } from "./reply-mode.js";
import type { TurnTools } from "./turn-tools.js";

export class TurnToolSession extends ReplyMode {
  public readonly scope: string;
  public readonly member: string;
  public readonly session: ITurnToolSession;
  public readonly tools: TurnTools;
  public readonly run: ReplyRun;
  public readonly sender: string | null;
  public readonly stops: AbortController = new AbortController();
  public stopped: boolean = false;

  public constructor(scope: string, member: string, session: ITurnToolSession, tools: TurnTools, run: ReplyRun, sender: string | null, reply: Message,
    mode: ProviderMode | null) {
    super(reply, mode);
    this.scope = scope;
    this.member = member;
    this.session = session;
    this.tools = tools;
    this.run = run;
    this.sender = sender;
  }
}
