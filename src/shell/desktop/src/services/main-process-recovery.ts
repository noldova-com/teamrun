/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import { inspect } from "node:util";

import type { MessageBoxOptions } from "electron";

import "@noldova/teamrun-foundation-core";
import { type DiagnosticRedactor, LogText } from "@noldova/teamrun-shell-runtime";

import type { MainProcessFailureKind } from "../enums/main-process-failure-kind.js";
import { UnusableFolderException } from "../exceptions/unusable-folder.exception.js";
import type { IApplicationHost } from "../interfaces/i-application-host.js";
import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";

export class MainProcessRecovery {
  private readonly app: IApplicationHost;
  private readonly dialog: IDialogHost;
  private readonly errorOutput: Writable;
  private readonly redactor: DiagnosticRedactor;
  private log: IDesktopLog | null = null;
  private openLogFolderAsync: (() => Promise<boolean>) | null = null;
  private hasFailed: boolean = false;

  public constructor(app: IApplicationHost, dialog: IDialogHost, errorOutput: Writable, redactor: DiagnosticRedactor) {
    this.app = app;
    this.dialog = dialog;
    this.errorOutput = errorOutput;
    this.redactor = redactor;
  }

  public attach(log: IDesktopLog, openLogFolderAsync: () => Promise<boolean>): void {
    this.log = log;
    this.openLogFolderAsync = openLogFolderAsync;
  }

  public receive(error: unknown, kind: MainProcessFailureKind): void {
    this.record(Resources.formatMainProcessFailure(kind, MainProcessRecovery.describe(error)));
    if (this.hasFailed)
      return;
    this.hasFailed = true;
    this.askAsync(error).catch((failure: unknown) => {
      try {
        this.record(Resources.formatMainProcessBoxFailed(MainProcessRecovery.describe(failure)));
      }
      finally {
        this.app.exit(Resources.failureExitCode);
      }
    });
  }

  private async askAsync(error: unknown): Promise<void> {
    await this.app.whenReady();
    const openLogFolderAsync = this.openLogFolderAsync;
    const buttons = Object.isNull(openLogFolderAsync)
      ? [Resources.restartButton, Resources.quitButton]
      : [Resources.restartButton, Resources.openLogFolderButton, Resources.quitButton];
    const advice = Object.isNull(openLogFolderAsync) ? Resources.mainProcessFailedBeforeStartDetail : Resources.mainProcessFailedDetail;
    const options: MessageBoxOptions = {
      type: Resources.warningBoxType,
      message: Resources.mainProcessFailed,
      detail: error instanceof UnusableFolderException ? Resources.formatFailureDetail(error.message, advice) : advice,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      noLink: true
    };
    for (;;) {
      const choice = buttons[(await this.dialog.showMessageBox(null, options)).response] ?? Resources.quitButton;
      this.record(Resources.formatRecoveryChoice(choice));
      if (!Object.isNull(openLogFolderAsync) && choice === Resources.openLogFolderButton) {
        await openLogFolderAsync();
        continue;
      }
      if (choice === Resources.restartButton)
        this.app.relaunch();
      this.app.exit(Resources.quitExitCode);
      return;
    }
  }

  private record(text: string): void {
    if (Object.isNull(this.log))
      this.errorOutput.write(`${new Date().toISOString()} ${this.redactor.redact(text)}${Resources.logLineSeparator}`);
    else
      this.log.write(text);
  }

  private static describe(error: unknown): string {
    return LogText.lines(inspect(error)).join(Resources.logLineSeparator);
  }
}
