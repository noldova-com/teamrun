/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import type { MessageBoxOptions } from "electron";

import "@noldova/teamrun-foundation-core";
import { LogText } from "@noldova/teamrun-shell-runtime";

import type { IApplicationHost } from "../interfaces/i-application-host.js";
import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";

export class MainProcessRecovery {
  private readonly app: IApplicationHost;
  private readonly dialog: IDialogHost;
  private readonly log: IDesktopLog;
  private readonly openLogFolderAsync: () => Promise<boolean>;
  private hasFailed: boolean = false;

  public constructor(app: IApplicationHost, dialog: IDialogHost, log: IDesktopLog, openLogFolderAsync: () => Promise<boolean>) {
    this.app = app;
    this.dialog = dialog;
    this.log = log;
    this.openLogFolderAsync = openLogFolderAsync;
  }

  public receive(error: unknown, origin: string): void {
    this.log.write(Resources.formatMainProcessFailure(origin, MainProcessRecovery.describe(error)));
    if (this.hasFailed)
      return;
    this.hasFailed = true;
    this.askAsync().catch((failure: unknown) => {
      this.log.write(Resources.formatMainProcessBoxFailed(MainProcessRecovery.describe(failure)));
      this.app.exit(Resources.failureExitCode);
    });
  }

  private async askAsync(): Promise<void> {
    await this.app.whenReady();
    const buttons = [Resources.restartButton, Resources.openLogFolderButton, Resources.quitButton];
    const options: MessageBoxOptions = {
      type: Resources.warningBoxType, message: Resources.mainProcessFailed, detail: Resources.mainProcessFailedDetail, buttons, defaultId: 0, cancelId: 2, noLink: true
    };
    for (;;) {
      const choice = buttons[(await this.dialog.showMessageBox(null, options)).response] ?? Resources.quitButton;
      this.log.write(Resources.formatRecoveryChoice(choice));
      if (choice !== Resources.openLogFolderButton) {
        if (choice === Resources.restartButton)
          this.app.relaunch();
        this.app.exit(Resources.failureExitCode);
        return;
      }
      await this.openLogFolderAsync();
    }
  }

  private static describe(error: unknown): string {
    return LogText.lines(inspect(error)).join(Resources.logLineSeparator);
  }
}
