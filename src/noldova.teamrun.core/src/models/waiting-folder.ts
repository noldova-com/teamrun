/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WaitingFolder {
  public readonly chatId: string;
  public readonly waitingId: string;

  public constructor(chatId: string, waitingId: string) {
    this.chatId = chatId;
    this.waitingId = waitingId;
  }
}
