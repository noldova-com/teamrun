/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class StoppedCommands {
  private readonly chats: Map<string, Map<string | null, readonly string[]>> = new Map();

  public add(chatId: string, teammateId: string | null, line: string): void {
    const chat = this.chats.get(chatId) ?? new Map<string | null, readonly string[]>();
    this.chats.set(chatId, chat.set(teammateId, [...chat.get(teammateId) ?? [], line]));
  }

  public of(chatId: string, teammateId: string | null): readonly string[] {
    return this.chats.get(chatId)?.get(teammateId) ?? [];
  }

  public told(chatId: string, teammateId: string | null, lines: readonly string[]): void {
    const chat = this.chats.get(chatId);
    const kept = this.of(chatId, teammateId).filter(t => !lines.includes(t));
    if (kept.length > 0)
      chat?.set(teammateId, kept);
    else
      this.drop(chatId, teammateId);
  }

  public forget(chatIds: readonly string[]): void {
    for (const chatId of chatIds)
      this.chats.delete(chatId);
  }

  public forgetTeammate(teammateId: string, chatId: string | null): void {
    for (const id of Object.isNull(chatId) ? [...this.chats.keys()] : [chatId])
      this.drop(id, teammateId);
  }

  private drop(chatId: string, teammateId: string | null): void {
    const chat = this.chats.get(chatId);
    chat?.delete(teammateId);
    if (chat?.size === 0)
      this.chats.delete(chatId);
  }
}
