/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, ViewBadge } from "@noldova/desktop.window";
import {
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageAuthor,
  type MessageDetail,
  MessagePageParams,
  ReplyPage,
  ReplyPanel,
  SubAgent
} from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { ChatStoreService } from "./chat-store.service";

export class SubAgentsBadge {
  private static readonly badges: WeakMap<IWindowPartContext, SubAgentsBadge> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly subscriptions: readonly (() => void)[];
  private readonly replies: Set<string> = new Set();
  private readonly running: Map<string, boolean> = new Map();
  private readonly touched: Set<string> = new Set();
  private conversationId: string | null = null;
  private generation: number = 0;
  private count: number = 0;

  private constructor(context: IWindowPartContext, store: ChatStoreService) {
    this.context = context;
    this.store = store;
    this.subscriptions = [
      store.onShownConversationChanged(t => this.select(t)),
      this.on(EventName.StateResyncRequested, () => this.reload()),
      this.on(EventName.ConversationRewound, t => {
        if (ConversationRewoundPayload.fromJson(t).conversationId === this.conversationId)
          this.reload();
      }),
      ...[EventName.MessageCreated, EventName.MessageUpdated].map(t => this.on(t, u => this.note(Message.fromJson(u)))),
      ...[EventName.DetailAppended, EventName.DetailUpdated].map(t => this.on(t, u => this.apply(DetailEventPayload.fromJson(u))))
    ];
    this.select(store.shownConversationId());
  }

  public static register(context: IWindowPartContext, store: ChatStoreService): void {
    SubAgentsBadge.badges.set(context, new SubAgentsBadge(context, store));
  }

  public static of(context: IWindowPartContext): SubAgentsBadge | null {
    return SubAgentsBadge.badges.get(context) ?? null;
  }

  public static reload(context: IWindowPartContext): void {
    SubAgentsBadge.badges.get(context)?.reload();
  }

  public static release(context: IWindowPartContext): void {
    SubAgentsBadge.badges.get(context)?.dispose();
    SubAgentsBadge.badges.delete(context);
  }

  private on(name: EventName, handler: (payload: JsonValue) => void): () => void {
    return this.context.onEvent(Resources.formatQualifiedName(name), handler);
  }

  private select(conversationId: string | null): void {
    if (conversationId === this.conversationId)
      return;
    this.conversationId = conversationId;
    this.replies.clear();
    this.running.clear();
    this.show();
    this.reload();
  }

  private reload(): void {
    this.generation += 1;
    this.touched.clear();
    if (!Object.isNull(this.conversationId))
      void this.load(this.conversationId, this.generation);
  }

  private async load(conversationId: string, generation: number): Promise<void> {
    const loaded = new Map<string, boolean>();
    let before: number | null = null;
    try {
      for (;;) {
        const page = ReplyPage.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(Resources.replyPanelPages[ReplyPanel.SubAgents]),
          new MessagePageParams(conversationId, before, null, Resources.replyPageSize).toJson()));
        if (generation !== this.generation)
          return;
        for (const reply of page.replies) {
          this.replies.add(reply.preview.id);
          for (const detail of reply.preview.details)
            SubAgentsBadge.read(reply.preview.id, detail, loaded);
        }
        if (!page.hasEarlier || page.replies.length === 0)
          break;
        before = Math.min(...page.replies.map(t => t.preview.sequence));
      }
    }
    catch {
      return;
    }
    for (const key of [...this.running.keys()])
      if (!loaded.has(key) && !this.touched.has(key))
        this.running.delete(key);
    for (const [key, isRunning] of loaded)
      if (!this.touched.has(key))
        this.running.set(key, isRunning);
    this.show();
  }

  private note(message: Message): void {
    if (message.conversationId === this.conversationId && message.author === MessageAuthor.Provider)
      this.replies.add(message.id);
  }

  private apply(payload: DetailEventPayload): void {
    const conversationId = this.conversationId;
    if (Object.isNull(conversationId) || !(this.replies.has(payload.messageId) || this.store.runningReplyOf(conversationId)?.id === payload.messageId))
      return;
    const key = SubAgentsBadge.read(payload.messageId, payload.detail, this.running);
    if (Object.isNull(key))
      return;
    this.touched.add(key);
    this.show();
  }

  private show(): void {
    const count = [...this.running.values()].filter(t => t).length;
    if (count === this.count)
      return;
    this.count = count;
    this.context.setViewBadge(Resources.subAgentsViewName, count === 0 ? null : new ViewBadge(count, Resources.formatRunningSubAgents(count)));
  }

  private dispose(): void {
    this.generation += 1;
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
    this.running.clear();
    this.show();
  }

  private static read(messageId: string, detail: MessageDetail, into: Map<string, boolean>): string | null {
    if (detail.kind !== DetailKind.SubAgent || !Object.isNull(detail.parentSequence))
      return null;
    const key = `${messageId}/${detail.sequence}`;
    try {
      into.set(key, SubAgent.fromJson(detail.payload).isRunning);
    }
    catch {
      into.delete(key);
    }
    return key;
  }
}
