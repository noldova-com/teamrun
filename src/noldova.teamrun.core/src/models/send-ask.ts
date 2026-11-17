/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SendAsk {
  public readonly chatId: string;
  public readonly chatTitle: string;
  public readonly title: string;
  public readonly starts: string;

  public constructor(chatId: string, chatTitle: string, title: string, starts: string) {
    this.chatId = chatId;
    this.chatTitle = chatTitle;
    this.title = title;
    this.starts = starts;
  }
}
