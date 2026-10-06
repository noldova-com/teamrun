/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, effect, inject, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, ShellMethods, ShellNotifications } from "@noldova/teamrun-shell-protocol";

import { UpdateStateKind } from "../enums/update-state-kind";
import type { UpdateState } from "../models/update-state";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { NotificationService } from "./notification.service";
import { UpdateService } from "./update.service";

@Injectable({ providedIn: "root" })
export class UpdateNotifierService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly posted: Set<string> = new Set<string>();

  public constructor() {
    const updates = inject(UpdateService);
    const notifications = inject(NotificationService);
    effect(() => {
      const state = updates.state();
      const kind = UpdateNotifierService.notificationOf(state);
      if (Object.isNull(kind) || Object.isNull(state.version) || Object.isNull(notifications.firstRead()))
        return;
      const version = state.version;
      if (notifications.state().notifications.some(t => t.post.kind.text === kind.text && t.post.key === version))
        this.posted.add(UpdateNotifierService.keyOf(kind, version));
      untracked(() => this.post(kind, version));
    });
  }

  private post(kind: QualifiedName, version: string): void {
    const key = UpdateNotifierService.keyOf(kind, version);
    if (this.posted.has(key))
      return;
    this.posted.add(key);
    const isReady = kind.text === ShellNotifications.updateReady.text;
    const action = new NotificationAction(isReady ? Resources.restartToUpdateLabel : Resources.downloadUpdateLabel,
      new CommandRun(QualifiedName.parse(isReady ? Resources.restartToUpdateCommand : Resources.downloadUpdateCommand), null));
    const open = new CommandRun(QualifiedName.parse(Resources.openSettingsCommand), { [Resources.pageArgument]: Resources.aboutPage });
    const post = new NotificationPost(kind, version, isReady ? Resources.formatUpdateReady(version) : Resources.formatUpdateAvailable(version), null,
      NotificationSeverity.Info, open, [action], null);
    this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson()).catch((error: unknown) => this.errors.handleError(error));
  }

  private static notificationOf(state: UpdateState): QualifiedName | null {
    if (state.kind === UpdateStateKind.Ready)
      return ShellNotifications.updateReady;
    return state.kind === UpdateStateKind.Available && !state.mustMove ? ShellNotifications.updateAvailable : null;
  }

  private static keyOf(kind: QualifiedName, version: string): string {
    return `${kind.text} ${version}`;
  }
}
