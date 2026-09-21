/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, ProviderAccount } from "@noldova/teamrun-protocol";
import { ActiveRun } from "./active-run.js";

export class ReplyWork {
  public readonly message: Message;
  public readonly account: ProviderAccount | null;
  public readonly instructions: string | null;
  public readonly run: ActiveRun;

  public constructor(message: Message, account: ProviderAccount | null, instructions: string | null) {
    this.message = message;
    this.account = account;
    this.instructions = instructions;
    this.run = new ActiveRun(message.id);
  }
}
