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
      if (state.kind !== UpdateStateKind.Ready || Object.isNull(state.version) || Object.isNull(notifications.firstRead()))
        return;
      const version = state.version;
      if (notifications.state().notifications.some(t => t.post.kind.text === ShellNotifications.updateReady.text && t.post.key === version))
        this.posted.add(version);
      untracked(() => this.post(version));
    });
  }

  private post(version: string): void {
    if (this.posted.has(version))
      return;
    this.posted.add(version);
    const action = new NotificationAction(Resources.restartToUpdateLabel, new CommandRun(QualifiedName.parse(Resources.restartToUpdateCommand), null));
    const open = new CommandRun(QualifiedName.parse(Resources.openSettingsCommand), { [Resources.pageArgument]: Resources.aboutPage });
    const post = new NotificationPost(ShellNotifications.updateReady, version, Resources.formatUpdateReady(version), null, NotificationSeverity.Info, open, [action], null);
    this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson()).catch((error: unknown) => this.errors.handleError(error));
  }
}
