/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ChatIdParams, ChatRewoundPayload, EventName, Message, MethodName, type Teammate, TeammateLastReply } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { TeammateStatus } from "../enums/teammate-status";
import type { TeammateStopReason } from "../enums/teammate-stop-reason";
import { ListNotArrayException } from "../exceptions/list-not-array.exception";
import { TeammateActivity } from "../models/teammate-activity";
import { ChatStoreService } from "./chat-store.service";

export class TeammateStatusStoreService {
  public static readonly provider: FactoryProvider =
    { provide: TeammateStatusStoreService, useFactory: (): TeammateStatusStoreService => TeammateStatusStoreService.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, TeammateStatusStoreService> = new WeakMap();

  private readonly chats: ChatStoreService;
  private readonly context: IWindowPartContext;
  private readonly statuses: Map<string, Signal<TeammateStatus>> = new Map();
  private readonly stopReasons: Map<string, Signal<TeammateStopReason | null>> = new Map();
  private readonly activities: Map<string, Signal<readonly TeammateActivity[]>> = new Map();
  private readonly lastReplies: Map<string, Signal<TeammateLastReply | null>> = new Map();
  private readonly repliesByTeammate: Signal<ReadonlyMap<string, readonly Message[]>>;
  private readonly lastRepliesSignal: WritableSignal<ReadonlyMap<string, TeammateLastReply>> = signal(new Map());
  private readonly lastRepliesErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly subscriptions: readonly (() => void)[];
  private reading: { readonly updated: Message[]; readonly removedChats: Set<string> } | null = null;
  private generation: number = 0;

  public readonly lastRepliesError: Signal<string | null> = this.lastRepliesErrorSignal.asReadonly();

  public constructor(chats: ChatStoreService, context: IWindowPartContext) {
    this.chats = chats;
    this.context = context;
    this.repliesByTeammate = computed(() => {
      const replies = new Map<string, Message[]>();
      for (const reply of chats.workingReplies())
        if (!Object.isNull(reply.teammateId))
          replies.set(reply.teammateId, [...replies.get(reply.teammateId) ?? [], reply]);
      return replies;
    });
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.MessageUpdated), t => this.applyUpdated(Message.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.ConversationRewound), t => this.reloadIfIn(ChatRewoundPayload.fromJson(t).chatId)),
      context.onEvent(Resources.formatQualifiedName(EventName.ConversationDeleted), t => this.reloadIfIn(ChatIdParams.fromJson(t).chatId)),
      ...[EventName.StateInvalidated, EventName.StateResyncRequested].map(t => context.onEvent(Resources.formatQualifiedName(t), () => void this.reloadLastReplies()))
    ];
    void this.reloadLastReplies();
  }

  public static of(context: IWindowPartContext): TeammateStatusStoreService {
    const found = TeammateStatusStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new TeammateStatusStoreService(ChatStoreService.of(context), context);
    TeammateStatusStoreService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    TeammateStatusStoreService.stores.get(context)?.dispose();
    TeammateStatusStoreService.stores.delete(context);
  }

  public statusOf(teammateId: string): Signal<TeammateStatus> {
    const found = this.statuses.get(teammateId);
    if (!Object.isUndefined(found))
      return found;
    const status = computed(() => this.readStatus(teammateId));
    this.statuses.set(teammateId, status);
    return status;
  }

  public stopReasonOf(teammateId: string): Signal<TeammateStopReason | null> {
    const found = this.stopReasons.get(teammateId);
    if (!Object.isUndefined(found))
      return found;
    const reason = computed(() => this.statusOf(teammateId)() === TeammateStatus.Stopped ? this.chats.teammateStopReason(teammateId) : null);
    this.stopReasons.set(teammateId, reason);
    return reason;
  }

  public activitiesOf(teammateId: string): Signal<readonly TeammateActivity[]> {
    const found = this.activities.get(teammateId);
    if (!Object.isUndefined(found))
      return found;
    const activities = computed(() => this.repliesOf(teammateId)
      .map(t => new TeammateActivity(t.id, t.chatId, t.status, t.startedAt ?? t.createdAt))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt)), { equal: TeammateActivity.sameAll });
    this.activities.set(teammateId, activities);
    return activities;
  }

  public lastReplyOf(teammateId: string): Signal<TeammateLastReply | null> {
    const found = this.lastReplies.get(teammateId);
    if (!Object.isUndefined(found))
      return found;
    const last = computed(() => this.lastRepliesSignal().get(teammateId) ?? null, { equal: (a, b) => a === b || (!Object.isNull(a) && !Object.isNull(b) && a.equals(b)) });
    this.lastReplies.set(teammateId, last);
    return last;
  }

  public async reloadLastReplies(): Promise<void> {
    const generation = ++this.generation;
    const reading = { updated: new Array<Message>(), removedChats: new Set<string>() };
    this.reading = reading;
    try {
      const json = await this.context.requestAsync(Resources.formatQualifiedName(MethodName.TeammateLastReplyList), null);
      if (generation !== this.generation)
        return;
      if (!Array.isArray(json))
        throw new ListNotArrayException(Resources.formatValueKind(json));
      const answered = json.map(t => TeammateLastReply.fromJson(t));
      this.reading = null;
      if (answered.some(t => reading.removedChats.has(t.chatId))) {
        void this.reloadLastReplies();
        return;
      }
      this.lastRepliesSignal.set(new Map(answered.map(t => [t.teammateId, t])));
      this.lastRepliesErrorSignal.set(null);
      for (const message of reading.updated)
        this.applyUpdated(message);
    }
    catch (error) {
      if (generation === this.generation)
        this.lastRepliesErrorSignal.set(error instanceof Error ? error.message : String(error));
    }
    finally {
      if (this.reading === reading)
        this.reading = null;
    }
  }

  private applyUpdated(message: Message): void {
    this.reading?.updated.push(message);
    const replies = this.lastRepliesSignal();
    const last = TeammateLastReply.of(message);
    const teammateId = last?.teammateId ?? message.teammateId;
    const current = Object.isNull(teammateId) ? undefined : replies.get(teammateId);
    if (Object.isNull(last)) {
      if (current?.messageId === message.id)
        void this.reloadLastReplies();
      return;
    }
    if (Object.isUndefined(current) || current.messageId === last.messageId || current.endedAt <= last.endedAt)
      this.lastRepliesSignal.set(new Map([...replies, [last.teammateId, last]]));
  }

  private reloadIfIn(chatId: string): void {
    this.reading?.removedChats.add(chatId);
    if ([...this.lastRepliesSignal().values()].some(t => t.chatId === chatId))
      void this.reloadLastReplies();
  }

  private dispose(): void {
    this.generation++;
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }

  private readStatus(teammateId: string): TeammateStatus {
    const replies = this.repliesOf(teammateId);
    if (this.chats.waitingTeammates().has(teammateId))
      return TeammateStatus.WaitingForYou;
    if (replies.length > 0)
      return TeammateStatus.Working;
    if (this.chats.isTeammateUnavailable(teammateId))
      return TeammateStatus.Stopped;
    if (this.chats.teammates().some(t => t.id === teammateId && this.isUsedUp(t.providerId) && !this.sustainHasRoom(t)))
      return TeammateStatus.UsageLimit;
    return TeammateStatus.Idle;
  }

  private sustainHasRoom(teammate: Teammate): boolean {
    return teammate.sustain && teammate.fallbacks.some(t => Object.isNull(this.chats.providerStopReason(t.providerId)) && !this.isUsedUp(t.providerId));
  }

  private isUsedUp(providerId: string): boolean {
    return this.chats.planUsageOfProvider(providerId)?.usedUp === true;
  }

  private repliesOf(teammateId: string): readonly Message[] {
    return this.repliesByTeammate().get(teammateId) ?? [];
  }
}
