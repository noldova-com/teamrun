/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type CommandRun, type NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import type { IWindowPartContext, NotificationHandle } from "@noldova/desktop.window";

import { Resources } from "../../resources";

export class ErrorNotices {
  private readonly context: IWindowPartContext;
  private readonly posted: Map<string, Map<string, Promise<NotificationHandle | null>>> = new Map();

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public post(kind: string, key: string, title: string, text: string | null, open: CommandRun | null, actions: readonly NotificationAction[] = [],
    severity: NotificationSeverity = NotificationSeverity.Error): void {
    const post = new NotificationPost(QualifiedName.parse(kind), key, title, String.isNullOrWhitespace(text) ? null : text, severity, open,
      actions, null);
    const posting = this.context.postNotificationAsync(post).catch((error: unknown) => {
      this.context.log(Resources.formatNoticeNotPosted(kind, error instanceof Error ? error.name : typeof error));
      return null;
    });
    const keys = this.posted.get(kind) ?? new Map<string, Promise<NotificationHandle | null>>();
    this.posted.set(kind, keys.set(key, posting));
  }

  public dismiss(kind: string, isDismissed: (key: string) => boolean): void {
    const keys = this.posted.get(kind);
    if (Object.isUndefined(keys))
      return;
    for (const [key, posting] of [...keys].filter(([t]) => isDismissed(t))) {
      keys.delete(key);
      void posting.then(t => {
        if (!keys.has(key))
          t?.dismiss();
      });
    }
  }
}
