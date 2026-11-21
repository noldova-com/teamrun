/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageStatus } from "@noldova/teamrun.protocol";

export class TeammateActivity {
  public readonly messageId: string;
  public readonly chatId: string;
  public readonly status: MessageStatus;
  public readonly startedAt: string;

  public constructor(messageId: string, chatId: string, status: MessageStatus, startedAt: string) {
    this.messageId = messageId;
    this.chatId = chatId;
    this.status = status;
    this.startedAt = startedAt;
  }

  public static sameAll(a: readonly TeammateActivity[], b: readonly TeammateActivity[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
