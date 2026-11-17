/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionAsker, PermissionAnswer, type PermissionAsk } from "@noldova/teamrun.core";

export class AnsweringAsker implements IPermissionAsker {
  public readonly asks: PermissionAsk[] = [];
  public readonly sessions: string[] = [];
  private readonly denied: readonly string[];

  public constructor(denied: readonly string[]) {
    this.denied = denied;
  }

  public askPermissionAsync(session: string, _module: string, ask: PermissionAsk, _signal: AbortSignal): Promise<PermissionAnswer> {
    this.asks.push(ask);
    this.sessions.push(session);
    if (this.denied.includes(ask.action))
      return Promise.resolve(PermissionAnswer.Denied);
    return Promise.resolve(ask.remembersInChat ? PermissionAnswer.AllowedAlways : PermissionAnswer.AllowedOnce);
  }
}
