/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { type Message, MessageStatus } from "@noldova/teamrun.protocol";

import { TeammateStatus } from "../enums/teammate-status";
import type { TeammateStopReason } from "../enums/teammate-stop-reason";
import { TeammateActivity } from "../models/teammate-activity";
import { ChatStoreService } from "./chat-store.service";

export class TeammateStatusStore {
  private static readonly stores: WeakMap<IWindowPartContext, TeammateStatusStore> = new WeakMap();

  private readonly chats: ChatStoreService;
  private readonly statuses: Map<string, Signal<TeammateStatus>> = new Map();
  private readonly stopReasons: Map<string, Signal<TeammateStopReason | null>> = new Map();
  private readonly activities: Map<string, Signal<readonly TeammateActivity[]>> = new Map();
  private readonly repliesByTeammate: Signal<ReadonlyMap<string, readonly Message[]>>;
  private readonly askingReplies: Signal<ReadonlySet<string>>;

  public constructor(chats: ChatStoreService) {
    this.chats = chats;
    this.repliesByTeammate = computed(() => {
      const replies = new Map<string, Message[]>();
      for (const reply of chats.workingReplies())
        if (!Object.isNull(reply.teammateId))
          replies.set(reply.teammateId, [...replies.get(reply.teammateId) ?? [], reply]);
      return replies;
    });
    this.askingReplies = computed(() => new Set(chats.pendingApprovals().map(t => t.messageId)));
  }

  public static of(context: IWindowPartContext): TeammateStatusStore {
    const found = TeammateStatusStore.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new TeammateStatusStore(ChatStoreService.of(context));
    TeammateStatusStore.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    TeammateStatusStore.stores.delete(context);
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

  private readStatus(teammateId: string): TeammateStatus {
    const replies = this.repliesOf(teammateId);
    const asking = this.askingReplies();
    if (replies.some(t => t.status === MessageStatus.AwaitingApproval || asking.has(t.id)))
      return TeammateStatus.WaitingForYou;
    if (replies.length > 0)
      return TeammateStatus.Working;
    if (this.chats.isTeammateUnavailable(teammateId))
      return TeammateStatus.Stopped;
    if (this.chats.teammates().some(t => t.id === teammateId && this.chats.planUsageOfProvider(t.providerId)?.usedUp === true))
      return TeammateStatus.UsageLimit;
    return TeammateStatus.Idle;
  }

  private repliesOf(teammateId: string): readonly Message[] {
    return this.repliesByTeammate().get(teammateId) ?? [];
  }
}
