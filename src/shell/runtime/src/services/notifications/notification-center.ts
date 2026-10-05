/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import "@noldova/teamrun-foundation-core";
import { Notification, NotificationList, NotificationPost } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import { Resources } from "../../resources.js";

export class NotificationCenter {
  private readonly publish: (list: NotificationList) => void;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private entries: readonly Notification[] = [];
  private lastSequence: number = 0;

  public constructor(publish: (list: NotificationList) => void, now: () => Date, createId: () => string = randomUUID) {
    this.publish = publish;
    this.now = now;
    this.createId = createId;
  }

  public get list(): NotificationList {
    return new NotificationList(this.entries);
  }

  public get sequence(): number {
    return this.lastSequence;
  }

  public find(id: string): Notification | undefined {
    return this.entries.find(t => t.id === id);
  }

  public post(post: NotificationPost): string {
    const replaced = Object.isNull(post.key) ? undefined : this.entries.find(t => t.post.kind.text === post.kind.text && t.post.key === post.key);
    const id = replaced?.id ?? this.createId();
    const posted = new Notification(id, ++this.lastSequence, post, this.now().toISOString(), false);
    this.entries = NotificationCenter.trim([posted, ...this.entries.filter(t => t.id !== id)]);
    this.publish(this.list);
    return id;
  }

  public update(id: string, post: NotificationPost): boolean {
    const current = this.find(id);
    if (Object.isUndefined(current))
      return false;
    if (current.post.kind.text !== post.kind.text)
      throw new RegistrationException(Resources.formatNotificationKindChanged(id, current.post.kind.text));

    this.entries = this.entries.map(t => t.id === id ? new Notification(id, t.sequence, post, t.postedAt, t.isRead) : t);
    this.publish(this.list);
    return true;
  }

  public republish(): void {
    this.publish(this.list);
  }

  public markAllRead(): void {
    if (this.entries.every(t => t.isRead))
      return;
    this.entries = this.entries.map(t => t.isRead ? t : new Notification(t.id, t.sequence, t.post, t.postedAt, true));
    this.publish(this.list);
  }

  public clearFinished(): void {
    this.remove(t => !NotificationCenter.isInProgress(t));
  }

  public dismiss(id: string): void {
    this.remove(t => t.id === id);
  }

  public dismissOwnedBy(moduleId: string): void {
    this.remove(t => t.post.kind.owner === moduleId);
  }

  private remove(isRemoved: (notification: Notification) => boolean): void {
    const kept = this.entries.filter(t => !isRemoved(t));
    if (kept.length === this.entries.length)
      return;
    this.entries = kept;
    this.publish(this.list);
  }

  private static trim(entries: readonly Notification[]): readonly Notification[] {
    const excess = entries.length - Resources.notificationLimit;
    if (excess <= 0)
      return entries;
    const dropped = new Set(entries.filter(t => !NotificationCenter.isInProgress(t)).slice(-excess).map(t => t.id));
    return entries.filter(t => !dropped.has(t.id));
  }

  private static isInProgress(notification: Notification): boolean {
    const progress = notification.post.progress;
    return progress === NotificationPost.indeterminate || (Object.isNumber(progress) && progress < 1);
  }
}
