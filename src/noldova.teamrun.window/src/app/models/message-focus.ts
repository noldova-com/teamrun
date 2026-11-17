/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MessageFocus {
  public readonly conversationId: string;
  public readonly messageId: string;
  public readonly sequence: number;
  public readonly isPlan: boolean;
  public readonly step: number | null;

  public constructor(conversationId: string, messageId: string, sequence: number, isPlan: boolean = false, step: number | null = null) {
    this.conversationId = conversationId;
    this.messageId = messageId;
    this.sequence = sequence;
    this.isPlan = isPlan;
    this.step = step;
  }
}
