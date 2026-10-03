/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Notification, NotificationList, NotificationPost } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import { Resources } from "../../resources.js";

export class NotificationCenter {
  private readonly publish: (list: NotificationList) => void;
  private readonly now: () => Date;
  private entries: readonly Notification[] = [];
  private nextId: number = 1;

  public constructor(publish: (list: NotificationList) => void, now: () => Date) {
    this.publish = publish;
    this.now = now;
  }

  public get list(): NotificationList {
    return new NotificationList(this.entries);
  }

  public find(id: number): Notification | undefined {
    return this.entries.find(t => t.id === id);
  }

  public post(post: NotificationPost): number {
    const replaced = Object.isNull(post.key) ? undefined : this.entries.find(t => t.post.kind.text === post.kind.text && t.post.key === post.key);
    const id = replaced?.id ?? this.nextId++;
    const posted = new Notification(id, post, this.now().toISOString(), false);
    this.entries = NotificationCenter.trim([posted, ...this.entries.filter(t => t.id !== id)]);
    this.publish(this.list);
    return id;
  }

  public update(id: number, post: NotificationPost): boolean {
    const current = this.find(id);
    if (Object.isUndefined(current))
      return false;
    if (current.post.kind.text !== post.kind.text)
      throw new RegistrationException(Resources.formatNotificationKindChanged(id, current.post.kind.text));

    this.entries = this.entries.map(t => t.id === id ? new Notification(id, post, t.postedAt, t.isRead) : t);
    this.publish(this.list);
    return true;
  }

  public dismiss(id: number): void {
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
