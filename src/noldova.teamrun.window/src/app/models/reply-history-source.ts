/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { ReplySummary } from "@noldova/teamrun.protocol";
import { VirtualListSource } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";

export class ReplyHistorySource extends VirtualListSource<ReplySummary> {
  private readonly changesSignal: WritableSignal<number> = signal(0);
  private replies: ReplySummary[];

  public readonly changes: Signal<number> = this.changesSignal.asReadonly();

  public constructor(replies: readonly ReplySummary[]) {
    super(replies.length, Resources.replyEstimate);
    this.replies = replies.toReversed();
  }

  public get items(): readonly ReplySummary[] {
    return this.replies;
  }

  public get oldest(): ReplySummary | null {
    return this.replies.at(0) ?? null;
  }

  public override readAsync(start: number, end: number): Promise<readonly ReplySummary[]> {
    return Promise.resolve(this.replies.slice(start, end));
  }

  public override keyOf(item: ReplySummary): string {
    return item.preview.id;
  }

  public has(id: string): boolean {
    return this.replies.some(t => t.preview.id === id);
  }

  public addOlder(older: readonly ReplySummary[]): void {
    const known = new Set(this.replies.map(t => t.preview.id));
    const added = older.filter(t => !known.has(t.preview.id));
    if (added.length === 0)
      return;
    this.replies = [...added.toReversed(), ...this.replies];
    this.changesSignal.update(t => t + 1);
    this.reportInserted(0, added.length);
  }

  public put(reply: ReplySummary): void {
    const index = this.replies.findIndex(t => t.preview.id === reply.preview.id);
    if (index >= 0) {
      this.replies = this.replies.with(index, reply);
      this.changesSignal.update(t => t + 1);
      this.reportUpdated(index, 1);
      return;
    }
    const at = this.replies.findIndex(t => t.preview.sequence > reply.preview.sequence);
    const position = at < 0 ? this.replies.length : at;
    this.replies = this.replies.toSpliced(position, 0, reply);
    this.changesSignal.update(t => t + 1);
    this.reportInserted(position, 1);
  }

  public remove(id: string): void {
    const index = this.replies.findIndex(t => t.preview.id === id);
    if (index < 0)
      return;
    this.replies = this.replies.toSpliced(index, 1);
    this.changesSignal.update(t => t + 1);
    this.reportRemoved(index, 1);
  }
}
