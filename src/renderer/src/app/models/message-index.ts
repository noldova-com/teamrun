/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Message, MessagePage } from "@noldova/teamrun-protocol";

import { MessageIndexEntry } from "./message-index-entry";

export class MessageIndex {
  private readonly byId = new Map<string, MessageIndexEntry>();

  public entries: readonly MessageIndexEntry[] = [];

  public find(id: string): MessageIndexEntry | null {
    return this.byId.get(id) ?? null;
  }

  public rememberPage(page: MessagePage): void {
    const first = page.messages[0]?.sequence;
    const last = page.messages.at(-1)?.sequence;
    const start = this.entries[0]?.sequence;
    const end = this.entries.at(-1)?.sequence;
    if (Object.isUndefined(first) || Object.isUndefined(last)
      || (!Object.isUndefined(start) && last + 1 < start) || (!Object.isUndefined(end) && first > end + 1))
      this.byId.clear();
    const ids = new Set(page.messages.map(t => t.id));
    for (const entry of this.byId.values())
      if ((!Object.isUndefined(first) && !Object.isUndefined(last) && entry.sequence >= first && entry.sequence <= last && !ids.has(entry.id))
        || (!page.hasEarlier && !Object.isUndefined(first) && entry.sequence < first)
        || (!page.hasLater && !Object.isUndefined(last) && entry.sequence > last))
        this.byId.delete(entry.id);
    for (const message of page.messages)
      if (!this.byId.has(message.id))
        this.byId.set(message.id, new MessageIndexEntry(message.id, message.sequence));
    this.publish();
  }

  public rememberMessage(message: Message): void {
    if (this.byId.has(message.id))
      return;
    this.byId.set(message.id, new MessageIndexEntry(message.id, message.sequence));
    this.publish();
  }

  public removeFrom(sequence: number): void {
    for (const entry of this.byId.values())
      if (entry.sequence >= sequence)
        this.byId.delete(entry.id);
    this.publish();
  }

  private publish(): void {
    this.entries = [...this.byId.values()].sort((a, b) => a.sequence - b.sequence);
  }
}
