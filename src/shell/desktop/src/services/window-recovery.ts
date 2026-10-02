/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions, RenderProcessGoneDetails } from "electron";

import "@noldova/teamrun-foundation-core";

import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";

export class WindowRecovery {
  private readonly open: OpenWindow;
  private readonly dialog: IDialogHost;
  private readonly log: IDesktopLog;
  private readonly quit: () => void;
  private readonly openLogFolderAsync: () => Promise<boolean>;
  private readonly reloadCrashLimit: number;
  private reloadedAt: number | null = null;
  private isCrashingToReload: boolean = false;
  private isUnresponsive: boolean = false;
  private unresponsiveBox: AbortController | null = null;

  public constructor(
    open: OpenWindow,
    dialog: IDialogHost,
    log: IDesktopLog,
    quit: () => void,
    openLogFolderAsync: () => Promise<boolean>,
    reloadCrashLimit: number) {
    this.open = open;
    this.dialog = dialog;
    this.log = log;
    this.quit = quit;
    this.openLogFolderAsync = openLogFolderAsync;
    this.reloadCrashLimit = reloadCrashLimit;
    open.window.webContents.on(Resources.renderProcessGoneEvent, (_event, details) => void this.recoverFromGoneAsync(details));
    open.window.on(Resources.unresponsiveEvent, () => void this.recoverFromUnresponsiveAsync());
    open.window.on(Resources.responsiveEvent, () => this.noteResponsive());
  }

  private async recoverFromGoneAsync(details: RenderProcessGoneDetails): Promise<void> {
    if (details.reason === Resources.cleanExitReason || this.open.window.isDestroyed())
      return;
    this.log.write(Resources.formatRendererGone(details.reason, details.exitCode));
    this.isUnresponsive = false;
    this.unresponsiveBox?.abort();
    if (this.isCrashingToReload) {
      this.isCrashingToReload = false;
      return;
    }
    this.open.showNow();
    if (!Object.isNull(this.reloadedAt) && Date.now() - this.reloadedAt < this.reloadCrashLimit) {
      this.log.write(Resources.windowStoppedAgainRecord);
      const again = await this.askAsync(Resources.windowStopped, Resources.windowStoppedAgainDetail, [Resources.openLogFolderButton, Resources.quitButton], 1);
      if (again === Resources.openLogFolderButton)
        await this.openLogFolderAsync();
      else
        this.quit();
      return;
    }
    const choice = await this.askAsync(Resources.windowStopped, Resources.windowStoppedDetail, [Resources.reloadButton, Resources.quitButton], 1);
    if (choice === Resources.reloadButton)
      this.reload();
    else
      this.quit();
  }

  private async recoverFromUnresponsiveAsync(): Promise<void> {
    if (this.isUnresponsive)
      return;
    this.isUnresponsive = true;
    this.log.write(Resources.windowUnresponsive);
    const box = new AbortController();
    this.unresponsiveBox = box;
    const choice = await this.askAsync(Resources.windowNotResponding, Resources.windowNotRespondingDetail, [Resources.waitButton, Resources.reloadButton], 0, box.signal);
    this.unresponsiveBox = null;
    if (box.signal.aborted || choice !== Resources.reloadButton)
      return;
    this.isUnresponsive = false;
    this.isCrashingToReload = true;
    this.open.window.webContents.forcefullyCrashRenderer();
    this.reload();
  }

  private noteResponsive(): void {
    if (!this.isUnresponsive)
      return;
    this.isUnresponsive = false;
    this.log.write(Resources.windowResponsiveAgain);
    this.unresponsiveBox?.abort();
  }

  private reload(): void {
    this.reloadedAt = Date.now();
    this.open.window.webContents.reload();
  }

  private async askAsync(message: string, detail: string, buttons: readonly string[], cancelId: number, signal?: AbortSignal): Promise<string | null> {
    const options: MessageBoxOptions = { type: Resources.warningBoxType, message, detail, buttons: [...buttons], defaultId: 0, cancelId, noLink: true };
    if (!Object.isUndefined(signal))
      options.signal = signal;
    const { response } = await this.dialog.showMessageBox(this.open.window.id, options);
    if (signal?.aborted === true)
      return null;
    const choice = buttons[response] ?? null;
    if (!Object.isNull(choice))
      this.log.write(Resources.formatRecoveryChoice(choice));
    return choice;
  }
}
