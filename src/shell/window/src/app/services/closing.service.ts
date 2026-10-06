/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ErrorHandler, Injectable, inject } from "@angular/core";

import { NotificationPost, NotificationSeverity, type QualifiedName, ShellMethods, ShellNotifications } from "@noldova/teamrun-shell-protocol";

import { PartSaveOutcome } from "../enums/part-save-outcome";
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
    const outcomes = await this.saveAllAsync(false);
    return outcomes.every(([, outcome]) => outcome !== PartSaveOutcome.Failed);
  }

  public async saveForUpdateAsync(): Promise<readonly string[]> {
    const outcomes = await this.saveAllAsync(true);
    return outcomes.flatMap(([moduleId, outcome]) => {
      const name = this.statuses.nameOf(moduleId);
      return outcome === PartSaveOutcome.Saved ? []
        : [outcome === PartSaveOutcome.Failed ? Resources.formatPartSaveFailedForUpdate(name) : Resources.formatPartSaveUnfinished(name)];
    });
  }

  private async saveAllAsync(isUpdate: boolean): Promise<readonly (readonly [string, PartSaveOutcome])[]> {
    const [outcomes] = await Promise.all([
      Promise.all([...this.parts.listSaves()].map(async ([moduleId, saves]): Promise<readonly [string, PartSaveOutcome]> => [moduleId, await this.savePartAsync(moduleId, saves, isUpdate)])),
      this.saveLayoutAsync()
    ]);
    return outcomes;
  }

  private async saveLayoutAsync(): Promise<void> {
    try {
      await this.layout.saveAsync();
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private async savePartAsync(moduleId: string, saves: readonly (() => Promise<void>)[], isUpdate: boolean): Promise<PartSaveOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unfinished = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), Resources.partSaveTimeout);
    });
    const name = this.statuses.nameOf(moduleId);
    const saving = Promise.all(saves.map(t => ClosingService.runAsync(t)));
    try {
      if (await Promise.race([saving.then(() => true), unfinished]))
        return PartSaveOutcome.Saved;
      saving.catch((error: unknown) => this.errors.handleError(new WindowPartFailureException(moduleId, Resources.windowPartSaveFailedLate, error)));
      this.bridge.logError(moduleId, isUpdate ? Resources.windowPartSaveUnfinishedForUpdate : Resources.windowPartSaveUnfinished);
      if (!isUpdate)
        this.post(ShellNotifications.saveUnfinished, moduleId, Resources.formatPartSaveUnfinished(name), Resources.partSaveUnfinishedText, NotificationSeverity.Warning);
      return PartSaveOutcome.Unfinished;
    }
    catch (error) {
      this.errors.handleError(new WindowPartFailureException(moduleId, isUpdate ? Resources.windowPartSaveFailedForUpdate : Resources.windowPartSaveFailed, error));
      if (!isUpdate)
        this.post(ShellNotifications.saveFailed, moduleId, Resources.formatPartSaveFailed(name), error instanceof Error ? error.message : String(error), NotificationSeverity.Error);
      return PartSaveOutcome.Failed;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private post(kind: QualifiedName, moduleId: string, title: string, text: string, severity: NotificationSeverity): void {
    this.bridge.requestAsync(ShellMethods.postNotification.text, new NotificationPost(kind, moduleId, title, text, severity, null, [], null).toJson())
      .catch((error: unknown) => this.errors.handleError(error));
  }

  private static async runAsync(save: () => Promise<void>): Promise<void> {
    await save();
  }
}
