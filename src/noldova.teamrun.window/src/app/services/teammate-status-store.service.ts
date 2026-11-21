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
import type { Message, Teammate } from "@noldova/teamrun.protocol";

import { TeammateStatus } from "../enums/teammate-status";
import type { TeammateStopReason } from "../enums/teammate-stop-reason";
import { TeammateActivity } from "../models/teammate-activity";
import { ChatStoreService } from "./chat-store.service";

export class TeammateStatusStoreService {
  private static readonly stores: WeakMap<IWindowPartContext, TeammateStatusStoreService> = new WeakMap();

  private readonly chats: ChatStoreService;
  private readonly statuses: Map<string, Signal<TeammateStatus>> = new Map();
  private readonly stopReasons: Map<string, Signal<TeammateStopReason | null>> = new Map();
  private readonly activities: Map<string, Signal<readonly TeammateActivity[]>> = new Map();
  private readonly repliesByTeammate: Signal<ReadonlyMap<string, readonly Message[]>>;

  public constructor(chats: ChatStoreService) {
    this.chats = chats;
    this.repliesByTeammate = computed(() => {
      const replies = new Map<string, Message[]>();
      for (const reply of chats.workingReplies())
        if (!Object.isNull(reply.teammateId))
          replies.set(reply.teammateId, [...replies.get(reply.teammateId) ?? [], reply]);
      return replies;
    });
  }

  public static of(context: IWindowPartContext): TeammateStatusStoreService {
    const found = TeammateStatusStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new TeammateStatusStoreService(ChatStoreService.of(context));
    TeammateStatusStoreService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
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
    const providers = new Set(this.chats.providers().map(t => t.id));
    return teammate.sustain && teammate.fallbacks.some(t => providers.has(t.providerId) && !this.isUsedUp(t.providerId));
  }

  private isUsedUp(providerId: string): boolean {
    return this.chats.planUsageOfProvider(providerId)?.usedUp === true;
  }

  private repliesOf(teammateId: string): readonly Message[] {
    return this.repliesByTeammate().get(teammateId) ?? [];
  }
}
