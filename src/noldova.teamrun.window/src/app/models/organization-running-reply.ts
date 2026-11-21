/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationRunningReply {
  public readonly chatId: string;
  public readonly text: string;
  public readonly lasted: string;

  public constructor(chatId: string, text: string, lasted: string) {
    this.chatId = chatId;
    this.text = text;
    this.lasted = lasted;
  }
}
