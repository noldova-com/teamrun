/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate } from "@noldova/teamrun.protocol";

export class OrganizationChatRow {
  public readonly chatId: string;
  public readonly teammateId: string;
  public readonly teammate: Teammate | null;
  public readonly name: string;
  public readonly time: string;
  public readonly lastLine: string;
  public readonly status: string | null;
  public readonly unread: number;

  public constructor(chatId: string, teammateId: string, teammate: Teammate | null, name: string, time: string, lastLine: string, status: string | null,
    unread: number) {
    this.chatId = chatId;
    this.teammateId = teammateId;
    this.teammate = teammate;
    this.name = name;
    this.time = time;
    this.lastLine = lastLine;
    this.status = status;
    this.unread = unread;
  }
}
