/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

import type { ReplyWork } from "./reply-work.js";

export class HandOffResult {
  public readonly stored: Message;
  public readonly pending: readonly ReplyWork[];
  public readonly waiting: readonly ReplyWork[];
  public readonly joined: boolean;

  public constructor(stored: Message, pending: readonly ReplyWork[], waiting: readonly ReplyWork[], joined: boolean) {
    this.stored = stored;
    this.pending = pending;
    this.waiting = waiting;
    this.joined = joined;
  }
}
