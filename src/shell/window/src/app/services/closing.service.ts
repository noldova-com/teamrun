/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ErrorHandler, Injectable, inject } from "@angular/core";

import { NotificationPost, NotificationSeverity, type QualifiedName, ShellMethods, ShellNotifications } from "@noldova/teamrun-shell-protocol";

import { WindowPartFailureException } from "../exceptions/window-part-failure.exception";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { LayoutService } from "./layout.service";
import { ModuleStatusService } from "./module-status.service";
import { WindowPartHostService } from "./window-part-host.service";

@Injectable({ providedIn: "root" })
export class ClosingService {
  private readonly parts: WindowPartHostService = inject(WindowPartHostService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public async saveAsync(): Promise<boolean> {
    const [saved] = await Promise.all([
      Promise.all([...this.parts.listSaves()].map(([moduleId, saves]) => this.savePartAsync(moduleId, saves))),
      this.saveLayoutAsync()
    ]);
    return saved.every(t => t);
  }

  private async saveLayoutAsync(): Promise<void> {
    try {
      await this.layout.saveAsync();
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private async savePartAsync(moduleId: string, saves: readonly (() => Promise<void>)[]): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unfinished = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), Resources.partSaveTimeout);
    });
    const name = this.statuses.nameOf(moduleId);
    try {
      if (await Promise.race([Promise.all(saves.map(t => ClosingService.runAsync(t))).then(() => true), unfinished]))
        return true;
      this.bridge.logError(moduleId, Resources.windowPartSaveUnfinished);
      await this.postAsync(ShellNotifications.saveUnfinished, moduleId, Resources.formatPartSaveUnfinished(name), Resources.partSaveUnfinishedText, NotificationSeverity.Warning);
      return true;
    }
    catch (error) {
      this.errors.handleError(new WindowPartFailureException(moduleId, Resources.windowPartSaveFailed, error));
      await this.postAsync(ShellNotifications.saveFailed, moduleId, Resources.formatPartSaveFailed(name), error instanceof Error ? error.message : String(error), NotificationSeverity.Error);
      return false;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async postAsync(kind: QualifiedName, moduleId: string, title: string, text: string, severity: NotificationSeverity): Promise<void> {
    try {
      await this.bridge.requestAsync(ShellMethods.postNotification.text, new NotificationPost(kind, moduleId, title, text, severity, null, [], null).toJson());
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private static async runAsync(save: () => Promise<void>): Promise<void> {
    await save();
  }
}
