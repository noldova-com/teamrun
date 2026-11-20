/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Message, MessagePage } from "@noldova/teamrun.protocol";

import type { MessageControlState } from "./message-control-state";
import { MessageIndexEntry } from "./message-index-entry";

export class MessageIndex {
  private readonly byId: Map<string, MessageIndexEntry>;
  private readonly kept: Map<string, MessageIndexEntry>;

  public entries: readonly MessageIndexEntry[];

  public constructor() {
    this.byId = new Map();
    this.kept = new Map();
    this.entries = [];
  }

  public find(id: string): MessageIndexEntry | null {
    return this.byId.get(id) ?? this.kept.get(id) ?? null;
  }

  public rememberPage(page: MessagePage): void {
    const first = page.messages[0]?.sequence;
    const last = page.messages.at(-1)?.sequence;
    const start = this.entries[0]?.sequence;
    const end = this.entries.at(-1)?.sequence;
    if (Object.isUndefined(first) || Object.isUndefined(last)
      || (!Object.isUndefined(start) && last + 1 < start) || (!Object.isUndefined(end) && first > end + 1)) {
      for (const entry of this.byId.values())
        if (entry.controls?.hasChanges ?? false)
          this.kept.set(entry.id, entry);
      this.byId.clear();
    }
    if (Object.isUndefined(first) || Object.isUndefined(last))
      this.kept.clear();
    const ids = new Set(page.messages.map(t => t.id));
    for (const entry of [...this.byId.values(), ...this.kept.values()])
      if ((!Object.isUndefined(first) && !Object.isUndefined(last) && entry.sequence >= first && entry.sequence <= last && !ids.has(entry.id))
        || (!page.hasEarlier && !Object.isUndefined(first) && entry.sequence < first)
        || (!page.hasLater && !Object.isUndefined(last) && entry.sequence > last))
        this.forget(entry.id);
    for (const message of page.messages)
      this.add(message);
    this.publish();
  }

  public rememberMessage(message: Message): void {
    if (this.byId.has(message.id))
      return;
    this.add(message);
    this.publish();
  }

  public keep(message: Message, controls: MessageControlState): void {
    const entry = new MessageIndexEntry(message.id, message.sequence);
    entry.controls = controls;
    this.kept.set(message.id, entry);
  }

  public removeFrom(sequence: number): void {
    for (const entry of [...this.byId.values(), ...this.kept.values()])
      if (entry.sequence >= sequence)
        this.forget(entry.id);
    this.publish();
  }

  private add(message: Message): void {
    if (this.byId.has(message.id))
      return;
    this.byId.set(message.id, this.kept.get(message.id) ?? new MessageIndexEntry(message.id, message.sequence));
    this.kept.delete(message.id);
  }

  private forget(id: string): void {
    this.byId.delete(id);
    this.kept.delete(id);
  }

  private publish(): void {
    this.entries = [...this.byId.values()].sort((a, b) => a.sequence - b.sequence);
  }
}
