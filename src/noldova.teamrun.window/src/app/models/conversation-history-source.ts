/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { Message, MessagePage } from "@noldova/teamrun.protocol";
import { VirtualListSource } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { HistoryReadException } from "../exceptions/history-read.exception";

export class ConversationHistorySource extends VirtualListSource<Message> {
  private readonly rows: Map<number, Message> = new Map();
  private readonly reader: (start: number, end: number) => Promise<readonly Message[]>;
  private readonly revisionSignal: WritableSignal<number> = signal(0);

  public readonly revision: Signal<number> = this.revisionSignal.asReadonly();

  public constructor(page: MessagePage, reader: (start: number, end: number) => Promise<readonly Message[]>) {
    super(page.count, Resources.historyEstimate);
    this.reader = reader;
    this.hold(page);
  }

  public get held(): readonly Message[] {
    return [...this.rows.values()].toSorted((a, b) => a.sequence - b.sequence);
  }

  public find(messageId: string): Message | null {
    for (const message of this.rows.values())
      if (message.id === messageId)
        return message;
    return null;
  }

  public heldAt(sequence: number): Message | null {
    return this.rows.get(sequence) ?? null;
  }

  public holdsNewest(): boolean {
    return !Object.isNull(this.slice(Math.max(0, this.length() - Resources.messagePageSize), this.length()));
  }

  public override async readAsync(start: number, end: number): Promise<readonly Message[]> {
    const messages = this.slice(start, end) ?? await this.readAndHoldAsync(start, end);
    this.forget(start, end);
    return messages;
  }

  public override keyOf(item: Message): string {
    return item.id;
  }

  public upsert(message: Message): void {
    const count = this.length();
    this.rows.set(message.sequence, message);
    this.revisionSignal.update(t => t + 1);
    if (message.sequence >= count)
      this.reportInserted(count, message.sequence - count + 1);
    else
      this.reportUpdated(message.sequence, 1);
  }

  public refresh(page: MessagePage): void {
    const count = this.length();
    this.removeFrom(page.count);
    this.rows.clear();
    this.hold(page);
    this.revisionSignal.update(t => t + 1);
    if (page.count > count)
      this.reportInserted(count, page.count - count);
    const kept = Math.min(count, page.count);
    if (kept > 0)
      this.reportUpdated(0, kept);
  }

  public removeFrom(sequence: number): readonly string[] {
    const count = this.length();
    if (sequence >= count)
      return [];
    const removed: string[] = [];
    for (const [held, message] of [...this.rows])
      if (held >= sequence) {
        removed.push(message.id);
        this.rows.delete(held);
      }
    this.revisionSignal.update(t => t + 1);
    this.reportRemoved(sequence, count - sequence);
    return removed;
  }

  private hold(page: MessagePage): void {
    for (const message of page.messages)
      this.rows.set(message.sequence, message);
  }

  private slice(start: number, end: number): readonly Message[] | null {
    const messages: Message[] = [];
    for (let sequence = start; sequence < end; sequence++) {
      const message = this.rows.get(sequence);
      if (Object.isUndefined(message))
        return null;
      messages.push(message);
    }
    return messages;
  }

  private async readAndHoldAsync(start: number, end: number): Promise<readonly Message[]> {
    const messages = await this.reader(start, end);
    if (messages.length !== end - start || messages.some((t, index) => t.sequence !== start + index))
      throw new HistoryReadException(start, end);
    return messages.map(t => {
      const held = this.rows.get(t.sequence);
      if (!Object.isUndefined(held))
        return held;
      if (t.sequence < this.length())
        this.rows.set(t.sequence, t);
      return t;
    });
  }

  private forget(start: number, end: number): void {
    if (this.rows.size <= Resources.historyHeldRows)
      return;
    const newest = this.length() - Resources.messagePageSize;
    for (const sequence of [...this.rows.keys()])
      if (sequence < newest && (sequence < start - Resources.historyHeldRows || sequence >= end + Resources.historyHeldRows))
        this.rows.delete(sequence);
  }
}
