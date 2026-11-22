/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";

import type { ReplyWork } from "./reply-work.js";

export class DeliveredWake {
  public readonly stored: Message;
  public readonly item: ReplyWork | null;

  public constructor(stored: Message, item: ReplyWork | null) {
    this.stored = stored;
    this.item = item;
  }
}
