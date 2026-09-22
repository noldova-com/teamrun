/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Event, Message } from "@noldova/teamrun-protocol";

import type { DecisionPolicy } from "../enums/decision-policy.js";
import type { IConsole } from "../interfaces/i-console.js";
import type { IEventHandler } from "../interfaces/i-event-handler.js";
import type { ReplyOutcome } from "../models/reply-outcome.js";
import type { RuntimeSession } from "./runtime-session.js";
import { ReplyFollower } from "./reply-follower.js";

export class RepliesFollower implements IEventHandler {
  private readonly session: RuntimeSession;
  private readonly console: IConsole;
  private readonly policy: DecisionPolicy;
  private readonly echo: boolean;
  private readonly buffered: Event[] = [];
  private followers: readonly ReplyFollower[] | null = null;

  public constructor(session: RuntimeSession, console: IConsole, policy: DecisionPolicy, echo: boolean) {
    this.session = session;
    this.console = console;
    this.policy = policy;
    this.echo = echo;
  }

  public follow(replies: readonly Message[]): Promise<readonly ReplyOutcome[]> {
    const followers = replies.map(() => new ReplyFollower(this.session, this.console, this.policy, this.echo));
    const results = followers.map((follower, index) => follower.follow(replies[index]!.id));
    this.followers = followers;
    for (const event of this.buffered)
      this.handleEvent(event);
    this.buffered.length = 0;
    return Promise.all(results);
  }

  public handleEvent(event: Event): void {
    if (Object.isNull(this.followers))
      this.buffered.push(event);
    else
      for (const follower of this.followers)
        follower.handleEvent(event);
  }
}
