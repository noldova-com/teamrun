/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { type Notification, NotificationPost, NotificationSeverity, type NotificationState } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";
import { NotificationService } from "./notification.service";

@Injectable({ providedIn: "root" })
export class ToastService {
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly visibleIds: WritableSignal<readonly number[]> = signal([]);
  private readonly politeValue: WritableSignal<string> = signal("");
  private readonly assertiveValue: WritableSignal<string> = signal("");
  private readonly lastByKind: Map<string, number> = new Map();
  private readonly timers: Map<number, { handle: ReturnType<typeof setTimeout> | null; remaining: number; startedAt: number }> = new Map();
  private queue: number[] = [];
  private firstRead: NotificationState | null = null;
  private highestSequence: number = 0;

  public readonly toasts: Signal<readonly Notification[]> = computed(() => {
    const notifications = this.notifications.state().notifications;
    return this.visibleIds().flatMap(t => notifications.filter(u => u.id === t));
  });
  public readonly politeAnnouncement: Signal<string> = this.politeValue.asReadonly();
  public readonly assertiveAnnouncement: Signal<string> = this.assertiveValue.asReadonly();

  public constructor() {
    effect(() => {
      const state = this.notifications.state();
      const firstRead = this.notifications.firstRead();
      if (!Object.isNull(firstRead))
        untracked(() => this.follow(state, firstRead));
    });
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.timers.values())
        ToastService.clear(timer.handle);
    });
  }

  public close(id: number): void {
    const timer = this.timers.get(id);
    ToastService.clear(timer?.handle ?? null);
    this.timers.delete(id);
    this.queue = this.queue.filter(t => t !== id);
    if (!this.visibleIds().includes(id))
      return;
    this.visibleIds.update(t => t.filter(u => u !== id));
    let next = this.queue.shift();
    while (!Object.isUndefined(next) && !this.show(next))
      next = this.queue.shift();
  }

  public pause(id: number): void {
    const timer = this.timers.get(id);
    if (Object.isUndefined(timer) || Object.isNull(timer.handle))
      return;
    ToastService.clear(timer.handle);
    this.timers.set(id, { handle: null, remaining: Math.max(0, timer.remaining - (Date.now() - timer.startedAt)), startedAt: Date.now() });
  }

  public resume(id: number): void {
    const timer = this.timers.get(id);
    if (Object.isUndefined(timer) || !Object.isNull(timer.handle))
      return;
    this.startTimer(id, timer.remaining);
  }

  private follow(state: NotificationState, firstRead: NotificationState): void {
    const notifications = state.notifications;
    if (firstRead !== this.firstRead) {
      this.firstRead = firstRead;
      this.highestSequence = firstRead.sequence;
    }
    const highest = this.highestSequence;
    this.highestSequence = Math.max(highest, ...notifications.map(t => t.sequence));
    for (const id of [...this.visibleIds(), ...this.queue])
      if (!notifications.some(t => t.id === id))
        this.close(id);
    for (const notification of [...notifications].reverse())
      if (notification.sequence > highest)
        this.offer(notification, state);
    for (const notification of notifications)
      if (this.visibleIds().includes(notification.id) && !this.timers.has(notification.id) && ToastService.closesByItself(notification))
        this.startTimer(notification.id, Resources.toastDuration);
  }

  private offer(notification: Notification, state: NotificationState): void {
    if (state.isDoNotDisturb || state.mutedModules.includes(notification.post.kind.owner) || notification.isRead || !this.document.hasFocus() || this.visibleIds().includes(notification.id) || this.queue.includes(notification.id))
      return;
    const now = Date.now();
    const last = this.lastByKind.get(notification.post.kind.text);
    if (!Object.isUndefined(last) && now - last < Resources.toastKindInterval)
      return;
    this.lastByKind.set(notification.post.kind.text, now);
    if (this.visibleIds().length < Resources.toastLimit)
      this.show(notification.id);
    else
      this.queue.push(notification.id);
  }

  private show(id: number): boolean {
    const notification = this.notifications.state().notifications.find(t => t.id === id);
    if (Object.isUndefined(notification))
      return false;
    this.visibleIds.update(t => [...t, id]);
    const announcement = Object.isNull(notification.post.text) ? notification.post.title : `${notification.post.title}. ${notification.post.text}`;
    if (notification.post.severity === NotificationSeverity.Error)
      this.assertiveValue.set(announcement);
    else
      this.politeValue.set(announcement);
    if (ToastService.closesByItself(notification))
      this.startTimer(id, Resources.toastDuration);
    return true;
  }

  private startTimer(id: number, milliseconds: number): void {
    this.timers.set(id, { handle: setTimeout(() => this.close(id), milliseconds), remaining: milliseconds, startedAt: Date.now() });
  }

  private static closesByItself(notification: Notification): boolean {
    const progress = notification.post.progress;
    const isInProgress = progress === NotificationPost.indeterminate || (Object.isNumber(progress) && progress < 1);
    return !isInProgress && (notification.post.severity === NotificationSeverity.Info || notification.post.severity === NotificationSeverity.Success);
  }

  private static clear(handle: ReturnType<typeof setTimeout> | null): void {
    if (!Object.isNull(handle))
      clearTimeout(handle);
  }
}
