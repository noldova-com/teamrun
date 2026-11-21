/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageAuthor,
  MessageDetailsAfterParams,
  MessageIdParams,
  MessagePageParams,
  MethodName,
  ReplyPage,
  ReplyPanel,
  ReplySummary
} from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ReplyExpansion } from "../models/reply-expansion";
import { ReplyHistorySource } from "../models/reply-history-source";
import { ChatStoreService } from "./chat-store.service";
import { ClockService } from "./clock.service";
import { EngineResync } from "./engine-resync";

@Injectable()
export class ReplyHistoryService {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly sourceSignal: WritableSignal<ReplyHistorySource | null> = signal(null);
  private readonly loadingSignal: WritableSignal<boolean> = signal(false);
  private readonly errorSignal: WritableSignal<string | null> = signal(null);
  private readonly ranCommandsSignal: WritableSignal<boolean> = signal(false);
  private readonly replies: Set<string> = new Set();
  private readonly dirty: Set<string> = new Set();
  private readonly revisions: Map<string, number> = new Map();
  private readonly changed: Map<string, Set<number>> = new Map();
  private readonly expansions: Map<string, ReplyExpansion> = new Map();
  private readonly subscriptions: readonly (() => void)[];
  private panel: ReplyPanel = ReplyPanel.Activity;
  private conversationId: string | null = null;
  private hasEarlier: boolean = false;
  private generation: number = 0;
  private cancelRefresh: (() => void) | null = null;

  public readonly source: Signal<ReplyHistorySource | null> = this.sourceSignal.asReadonly();
  public readonly loading: Signal<boolean> = this.loadingSignal.asReadonly();
  public readonly error: Signal<string | null> = this.errorSignal.asReadonly();
  public readonly ranCommands: Signal<boolean> = this.ranCommandsSignal.asReadonly();

  public constructor() {
    const names = [EventName.MessageCreated, EventName.MessageUpdated, EventName.DetailAppended, EventName.DetailUpdated, EventName.ConversationRewound];
    this.subscriptions = [...names.map(t => this.context.onEvent(Resources.formatQualifiedName(t), u => this.apply(t, u))), EngineResync.on(this.context, () => this.retry())];
    inject(DestroyRef).onDestroy(() => {
      this.reset();
      for (const unsubscribe of this.subscriptions)
        unsubscribe();
    });
  }

  public select(conversationId: string | null, panel: ReplyPanel): void {
    if (conversationId !== this.conversationId || panel !== this.panel)
      this.expansions.clear();
    this.reset();
    this.conversationId = conversationId;
    this.panel = panel;
    this.sourceSignal.set(null);
    if (!Object.isNull(conversationId))
      void this.loadNewest(conversationId);
  }

  public retry(): void {
    this.select(this.conversationId, this.panel);
  }

  public async loadOlder(): Promise<void> {
    const source = this.sourceSignal();
    const oldest = source?.oldest;
    if (Object.isNull(source) || Object.isNullOrUndefined(oldest) || !this.hasEarlier || this.loadingSignal())
      return;
    const page = await this.readPage(this.conversationId!, oldest.preview.sequence);
    if (Object.isNull(page))
      return;
    this.hasEarlier = page.hasEarlier;
    source.addOlder(page.replies);
    this.refreshDirty();
  }

  public async loadAll(): Promise<void> {
    const source = this.sourceSignal();
    while (!Object.isNull(source) && source === this.sourceSignal() && this.hasEarlier && !this.loadingSignal()) {
      const length = source.length();
      await this.loadOlder();
      if (source.length() === length)
        return;
    }
  }

  public async indexOf(messageId: string): Promise<number | null> {
    const source = this.sourceSignal()!;
    for (;;) {
      const index = source.items.findIndex(t => t.preview.id === messageId);
      if (index >= 0 && (index >= Resources.replyEdgeRows || !this.hasEarlier))
        return index;
      const length = source.length();
      await this.loadOlder();
      if (source !== this.sourceSignal() || source.length() === length)
        return null;
    }
  }

  public async readDetails(messageId: string): Promise<Message | null> {
    const value = await this.request(MethodName.MessageDetails, new MessageIdParams(messageId).toJson());
    return Object.isNull(value) ? null : Message.fromJson(value);
  }

  public async readDetailsAfter(messageId: string, afterSequence: number, sequences: readonly number[]): Promise<Message | null> {
    const value = await this.request(MethodName.MessageDetailsAfter, new MessageDetailsAfterParams(messageId, afterSequence, sequences).toJson());
    return Object.isNull(value) ? null : Message.fromJson(value);
  }

  public takeChanged(messageId: string): ReadonlySet<number> {
    const changed = this.changed.get(messageId) ?? new Set<number>();
    this.changed.delete(messageId);
    return changed;
  }

  public restoreChanged(messageId: string, sequences: ReadonlySet<number>): void {
    const changed = this.changed.get(messageId) ?? new Set<number>();
    for (const sequence of sequences)
      changed.add(sequence);
    this.changed.set(messageId, changed);
  }

  public expansionOf(messageId: string): ReplyExpansion {
    const found = this.expansions.get(messageId);
    if (!Object.isUndefined(found))
      return found;
    const expansion = new ReplyExpansion();
    this.expansions.set(messageId, expansion);
    return expansion;
  }

  private async loadNewest(conversationId: string): Promise<void> {
    const generation = this.generation;
    const page = await this.readPage(conversationId, null);
    if (Object.isNull(page) || generation !== this.generation)
      return;
    this.hasEarlier = page.hasEarlier;
    this.ranCommandsSignal.set(page.ranCommands);
    this.sourceSignal.set(new ReplyHistorySource(page.replies));
    this.refreshDirty();
  }

  private async readPage(conversationId: string, before: number | null): Promise<ReplyPage | null> {
    const generation = this.generation;
    const method = Resources.replyPanelPages[this.panel];
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const page = ReplyPage.fromJson(await this.request(method, new MessagePageParams(conversationId, before, null, Resources.replyPageSize).toJson()));
      return generation === this.generation ? page : null;
    }
    catch (error) {
      if (generation === this.generation)
        this.errorSignal.set(error instanceof Error ? error.message : String(error));
      return null;
    }
    finally {
      if (generation === this.generation)
        this.loadingSignal.set(false);
    }
  }

  private apply(name: EventName, payload: JsonValue): void {
    if (Object.isNull(this.conversationId))
      return;
    switch (name) {
      case EventName.MessageCreated:
      case EventName.MessageUpdated: {
        const message = Message.fromJson(payload);
        if (message.conversationId === this.conversationId && message.author === MessageAuthor.Provider) {
          this.replies.add(message.id);
          this.touch(message.id);
        }
        break;
      }
      case EventName.DetailAppended:
      case EventName.DetailUpdated: {
        const detail = DetailEventPayload.fromJson(payload);
        const messageId = detail.messageId;
        if (this.replies.has(messageId) || this.sourceSignal()?.has(messageId) === true || this.store.runningReplyOf(this.conversationId)?.id === messageId) {
          if (name === EventName.DetailUpdated)
            this.restoreChanged(messageId, new Set([detail.detail.sequence]));
          this.touch(messageId);
        }
        break;
      }
      case EventName.ConversationRewound: {
        const rewind = ConversationRewoundPayload.fromJson(payload);
        if (rewind.conversationId === this.conversationId)
          this.retry();
        break;
      }
    }
  }

  private touch(messageId: string): void {
    this.revisions.set(messageId, (this.revisions.get(messageId) ?? 0) + 1);
    this.dirty.add(messageId);
    if (Object.isNull(this.cancelRefresh))
      this.cancelRefresh = this.clock.after(Resources.replyRefreshDelay, () => {
        this.cancelRefresh = null;
        this.refreshDirty();
      });
  }

  private refreshDirty(): void {
    if (Object.isNull(this.sourceSignal()) || this.loadingSignal())
      return;
    for (const id of [...this.dirty]) {
      this.dirty.delete(id);
      void this.refresh(id);
    }
  }

  private async refresh(messageId: string): Promise<void> {
    const generation = this.generation;
    const revision = this.revisions.get(messageId);
    try {
      const value = await this.request(MethodName.MessageSummary, new MessageIdParams(messageId).toJson());
      const source = this.sourceSignal();
      if (generation !== this.generation || Object.isNull(source) || revision !== this.revisions.get(messageId))
        return;
      const summary = Object.isNull(value) ? null : ReplySummary.fromJson(value);
      const oldest = source.oldest?.preview.sequence ?? Number.NEGATIVE_INFINITY;
      if (!Object.isNull(summary) && !Object.isNull(summary.preview.endedAt) && summary.preview.details.some(t => t.kind === DetailKind.Command))
        this.ranCommandsSignal.set(true);
      if (Object.isNull(summary) || !summary.matches(this.panel))
        source.remove(messageId);
      else if (!this.hasEarlier || summary.preview.sequence > oldest)
        source.put(summary);
    }
    catch (error) {
      if (generation === this.generation)
        this.errorSignal.set(error instanceof Error ? error.message : String(error));
    }
  }

  private reset(): void {
    this.generation += 1;
    this.cancelRefresh?.();
    this.cancelRefresh = null;
    this.replies.clear();
    this.dirty.clear();
    this.revisions.clear();
    this.changed.clear();
    this.hasEarlier = false;
    this.ranCommandsSignal.set(false);
    this.loadingSignal.set(false);
    this.errorSignal.set(null);
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }
}
