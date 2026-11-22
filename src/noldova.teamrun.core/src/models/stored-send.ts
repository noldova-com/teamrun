/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

import type { ChatWake } from "./chat-wake.js";
import type { ReplyWork } from "./reply-work.js";

export class StoredSend {
  public readonly message: Message;
  public readonly pending: ReplyWork[];
  public readonly wake: ChatWake | null;
  public readonly opening: string | null;
  public readonly joined: boolean;
  public readonly joining: ReplyWork[] | null;

  public constructor(message: Message, pending: ReplyWork[], wake: ChatWake | null, opening: string | null, joined: boolean, joining: ReplyWork[] | null) {
    this.message = message;
    this.pending = pending;
    this.wake = wake;
    this.opening = opening;
    this.joined = joined;
    this.joining = joining;
  }
}
