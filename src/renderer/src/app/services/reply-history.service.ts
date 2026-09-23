/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ConversationRewoundPayload, DetailEventPayload, DetailKind, Event, EventName, Message, MessageAuthor, MessageIdParams,
  MessagePageParams, MethodName, ReplyPage, ReplyPanel, ReplySummary } from "@noldova/teamrun-protocol";

import { ReplyHistoryItem } from "../models/reply-history-item";
import { ReplyIndexEntry } from "../models/reply-index-entry";
import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";
import { ChatStore } from "./chat-store.service";

@Injectable()
export class ReplyHistory {
  private readonly bridge = inject(BridgeService);
  private readonly chat = inject(ChatStore);
  private readonly destroy = inject(DestroyRef);
  private conversationId: string | null = null;
  private panel: ReplyPanel = ReplyPanel.Activity;
  private generation: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly dirty = new Set<string>();
  private readonly revisions = new Map<string, number>();
  private readonly pending = new Map<string, ReplySummary>();
  private readonly refreshing = new Set<string>();
  private readonly indexById = new Map<string, ReplyIndexEntry>();

  public readonly items = signal<readonly ReplyHistoryItem[]>([]);
  public readonly index = signal<readonly ReplyIndexEntry[]>([]);
  public readonly loading = signal(false);
  public readonly hasEarlier = signal(false);
  public readonly hasLater = signal(false);
  public readonly error = signal<string | null>(null);
  public anchorSequence: number | null = null;

  public constructor() {
    const unsubscribe = this.bridge.subscribe(event => this.onEvent(event));
    this.destroy.onDestroy(() => {
      unsubscribe();
      this.resetRequests();
      this.items.set([]);
      this.indexById.clear();
      this.index.set([]);
    });
  }

  public select(conversationId: string | null, panel: ReplyPanel): void {
    this.resetRequests();
    this.conversationId = conversationId;
    this.panel = panel;
    this.anchorSequence = null;
    this.items.set([]);
    this.indexById.clear();
    this.index.set([]);
    this.hasEarlier.set(false);
    this.hasLater.set(false);
    if (!Object.isNull(conversationId))
      void this.load(null, null);
  }

  public async loadNewest(): Promise<void> {
    this.resetRequests();
    await this.load(null, null);
  }

  public async loadOlder(): Promise<void> {
    const last = this.items().at(-1);
    if (!this.loading() && this.hasEarlier() && !Object.isUndefined(last))
      await this.load(last.summary.preview.sequence, null);
  }

  public async loadNewer(): Promise<void> {
    const first = this.items()[0];
    if (!this.loading() && this.hasLater() && !Object.isUndefined(first))
      await this.load(null, first.summary.preview.sequence);
  }

  public async loadAt(sequence: number): Promise<void> {
    if (!this.loading())
      await this.load(sequence + 1, null, true);
  }

  public async retry(): Promise<void> {
    this.resetRequests();
    await this.load(Object.isNull(this.anchorSequence) ? null : this.anchorSequence + 1, null, true);
  }

  private resetRequests(): void {
    this.generation += 1;
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.timer = null;
    this.dirty.clear();
    this.refreshing.clear();
    this.revisions.clear();
    this.pending.clear();
    this.loading.set(false);
    this.error.set(null);
  }

  private async load(before: number | null, after: number | null, replace: boolean = false): Promise<void> {
    if (Object.isNull(this.conversationId) || this.loading())
      return;
    const generation = this.generation;
    this.loading.set(true);
    this.error.set(null);
    try {
      const method = this.panel === ReplyPanel.Activity ? MethodName.MessageActivityPage : MethodName.MessageChangesPage;
      const params = new MessagePageParams(this.conversationId, before, after, Resources.messagePageSize);
      const page = ReplyPage.fromJson(await this.bridge.call(method, params.toJson()));
      if (generation !== this.generation || this.destroy.destroyed)
        return;
      if (replace && !Object.isNull(before) && page.replies.length === 0) {
        this.loading.set(false);
        await this.load(null, null, true);
        return;
      }
      this.rememberExpansions();
      this.rememberPage(page, Object.isNull(before) && Object.isNull(after));
      const previous = new Map(this.items().map(t => [t.summary.preview.id, t]));
      const all = replace || (Object.isNull(before) && Object.isNull(after)) ? new Map<string, ReplyHistoryItem>() : new Map(previous);
      for (const summary of page.replies)
        all.set(summary.preview.id, new ReplyHistoryItem(summary,
          previous.get(summary.preview.id)?.expansion ?? this.indexById.get(summary.preview.id)?.expansion ?? undefined));
      let items = [...all.values()].sort((a, b) => b.summary.preview.sequence - a.summary.preview.sequence);
      if (replace || (Object.isNull(before) && Object.isNull(after))) {
        this.hasEarlier.set(page.hasEarlier);
        this.hasLater.set(page.hasLater);
      } else if (!Object.isNull(before)) {
        this.hasEarlier.set(page.hasEarlier);
        if (items.length > Resources.replyHistoryLimit) {
          items = items.slice(-Resources.replyHistoryLimit);
          this.hasLater.set(true);
        }
      } else {
        this.hasLater.set(page.hasLater);
        if (items.length > Resources.replyHistoryLimit) {
          items = items.slice(0, Resources.replyHistoryLimit);
          this.hasEarlier.set(true);
        }
      }
      this.items.set(items);
      for (const summary of this.pending.values())
        this.applySummary(summary);
      this.pending.clear();
      this.pruneRevisions();
    }
    catch (error) {
      if (generation === this.generation)
        this.error.set(error instanceof Error ? error.message : String(error));
    }
    finally {
      if (generation === this.generation)
        this.loading.set(false);
    }
  }

  private onEvent(event: Event): void {
    if (Object.isNull(this.conversationId))
      return;
    if (event.name === EventName.MessageCreated || event.name === EventName.MessageUpdated) {
      const message = Message.fromJson(event.payload);
      if (message.conversationId !== this.conversationId || message.author !== MessageAuthor.Provider)
        return;
      this.revisions.set(message.id, (this.revisions.get(message.id) ?? 0) + 1);
      const summary = ReplySummary.fromMessage(message);
      if (this.loading())
        this.recordPending(summary);
      this.applySummary(summary);
      this.pruneRevisions();
    } else if (event.name === EventName.DetailAppended || event.name === EventName.DetailUpdated) {
      const detail = DetailEventPayload.fromJson(event.payload);
      if (detail.detail.kind === DetailKind.Text || (!this.items().some(t => t.summary.preview.id === detail.messageId)
        && this.chat.runningReply()?.id !== detail.messageId))
        return;
      this.revisions.set(detail.messageId, (this.revisions.get(detail.messageId) ?? 0) + 1);
      this.dirty.add(detail.messageId);
      this.scheduleRefresh();
    } else if (event.name === EventName.StateResyncRequested) {
      void this.retry();
    } else if (event.name === EventName.ConversationRewound) {
      const rewind = ConversationRewoundPayload.fromJson(event.payload);
      if (rewind.conversationId === this.conversationId) {
        this.resetRequests();
        this.items.update(items => items.filter(t => t.summary.preview.sequence < rewind.fromSequence));
        for (const entry of this.indexById.values())
          if (entry.sequence >= rewind.fromSequence)
            this.indexById.delete(entry.id);
        this.publishIndex();
        this.hasLater.set(false);
        if (this.items().length === 0)
          void this.load(null, null);
      }
    }
  }

  private applySummary(summary: ReplySummary): void {
    const message = summary.preview;
    const items = this.items();
    const held = items.find(t => t.summary.preview.id === message.id);
    if (summary.matches(this.panel)) {
      if (!this.indexById.has(message.id)) {
        this.indexById.set(message.id, new ReplyIndexEntry(message.id, message.sequence));
        this.publishIndex();
      }
    } else if (this.indexById.delete(message.id)) {
      this.publishIndex();
    }
    if (Object.isUndefined(held) && items.length > 0) {
      const newest = items[0]?.summary.preview.sequence ?? message.sequence;
      const oldest = items.at(-1)?.summary.preview.sequence ?? message.sequence;
      if (message.sequence < oldest || (this.hasLater() && message.sequence > newest))
        return;
      if (items.length >= Resources.replyHistoryLimit && !Object.isNull(this.anchorSequence) && message.sequence > newest) {
        this.hasLater.set(true);
        return;
      }
    }
    const next = items.filter(t => t.summary.preview.id !== message.id);
    if (summary.matches(this.panel))
      next.push(new ReplyHistoryItem(summary, held?.expansion));
    next.sort((a, b) => b.summary.preview.sequence - a.summary.preview.sequence);
    if (next.length > Resources.replyHistoryLimit) {
      this.rememberExpansions();
      if (!Object.isNull(this.anchorSequence) && this.anchorSequence <= (next.at(-1)?.summary.preview.sequence ?? 0)) {
        next.shift();
        this.hasLater.set(true);
      } else {
        next.pop();
        this.hasEarlier.set(true);
      }
    }
    this.items.set(next);
  }

  private scheduleRefresh(): void {
    if (!Object.isNull(this.timer))
      return;
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const id of this.dirty) {
        this.dirty.delete(id);
        if (!this.refreshing.has(id))
          void this.refresh(id);
      }
    }, Resources.replyRefreshDelay);
  }

  private async refresh(id: string): Promise<void> {
    const generation = this.generation;
    const revision = this.revisions.get(id);
    this.refreshing.add(id);
    try {
      const value = await this.bridge.call(MethodName.MessageSummary, new MessageIdParams(id).toJson());
      if (generation !== this.generation || this.destroy.destroyed)
        return;
      if (revision !== this.revisions.get(id)) {
        this.dirty.add(id);
        this.scheduleRefresh();
      } else if (!Object.isNull(value)) {
        const summary = ReplySummary.fromJson(value);
        if (this.loading())
          this.recordPending(summary);
        this.applySummary(summary);
      } else {
        this.items.update(items => items.filter(t => t.summary.preview.id !== id));
        if (this.indexById.delete(id))
          this.publishIndex();
      }
    }
    catch (error) {
      if (generation === this.generation)
        this.error.set(error instanceof Error ? error.message : String(error));
    }
    finally {
      if (generation === this.generation)
        this.refreshing.delete(id);
    }
  }

  private pruneRevisions(): void {
    const kept = new Set(this.items().map(t => t.summary.preview.id));
    const running = this.chat.runningReply()?.id;
    for (const id of this.revisions.keys())
      if (!kept.has(id) && id !== running && !this.refreshing.has(id))
        this.revisions.delete(id);
  }

  private recordPending(summary: ReplySummary): void {
    this.pending.delete(summary.preview.id);
    this.pending.set(summary.preview.id, summary);
    if (this.pending.size > Resources.replyHistoryLimit) {
      const first = this.pending.keys().next().value;
      if (!Object.isUndefined(first))
        this.pending.delete(first);
    }
  }

  private rememberExpansions(): void {
    for (const item of this.items())
      this.indexById.get(item.summary.preview.id)?.rememberExpansion(item.expansion);
  }

  private rememberPage(page: ReplyPage, newest: boolean): void {
    const first = page.replies[0]?.preview.sequence;
    const last = page.replies.at(-1)?.preview.sequence;
    const ids = new Set(page.replies.map(t => t.preview.id));
    for (const entry of this.indexById.values()) {
      const inside = !Object.isUndefined(first) && !Object.isUndefined(last) && entry.sequence <= first && entry.sequence >= last;
      const outside = (!page.hasLater && !Object.isUndefined(first) && entry.sequence > first)
        || (!page.hasEarlier && !Object.isUndefined(last) && entry.sequence < last);
      if ((inside && !ids.has(entry.id)) || outside || (newest && page.replies.length === 0))
        this.indexById.delete(entry.id);
    }
    for (const summary of page.replies)
      if (!this.indexById.has(summary.preview.id))
        this.indexById.set(summary.preview.id, new ReplyIndexEntry(summary.preview.id, summary.preview.sequence));
    this.publishIndex();
  }

  private publishIndex(): void {
    this.index.set([...this.indexById.values()].sort((a, b) => b.sequence - a.sequence));
  }
}
