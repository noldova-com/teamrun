/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun-protocol";

export class ReplyOutcome {
  public readonly reply: Message;
  public readonly detailCount: number;
  public readonly decisions: readonly string[];

  public constructor(reply: Message, detailCount: number, decisions: readonly string[]) {
    this.reply = reply;
    this.detailCount = detailCount;
    this.decisions = [...decisions];
  }
}
