/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { ICloseGuard } from "../interfaces/i-close-guard.js";
import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
import type { IDisplayHost } from "../interfaces/i-display-host.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { QuitQuestion } from "../models/quit-question.js";
import { Resources } from "../resources.js";
import { CloseCoordinator } from "./close-coordinator.js";
import { UpdateSaveCoordinator } from "./update-save-coordinator.js";
import { WindowBoundsKeeper } from "./window-bounds-keeper.js";
import { WindowErrorLimit } from "./window-error-limit.js";

export class OpenWindow implements IQuitPrompt {
  private readonly log: IDesktopLog;
  private readonly guard: ICloseGuard;
  private readonly painted: PromiseWithResolvers<boolean> = Promise.withResolvers<boolean>();
  private closing: Promise<void> | null = null;
  private canClose: boolean = false;
  private isPainted: boolean = false;
  private isSettled: boolean = false;
  private settleTimer: NodeJS.Timeout | null = null;
  private paintTimer: NodeJS.Timeout | null = null;

  public readonly window: IDesktopWindow;
  public readonly coordinator: CloseCoordinator;
  public readonly updateSaves: UpdateSaveCoordinator;
  public readonly bounds: WindowBoundsKeeper;
  public readonly errors: WindowErrorLimit = new WindowErrorLimit(Resources.windowErrorBurst, Resources.windowErrorPeriod);

  public constructor(window: IDesktopWindow, displays: IDisplayHost, log: IDesktopLog, guard: ICloseGuard, platform: string) {
    this.window = window;
    this.log = log;
    this.guard = guard;
    this.coordinator = new CloseCoordinator(t => this.sendRequest(Resources.closeRequestChannel, t), Resources.closeAnswerTimeout);
    this.updateSaves = new UpdateSaveCoordinator(t => this.sendRequest(Resources.updateSaveRequestChannel, t), Resources.closeAnswerTimeout);
    this.bounds = new WindowBoundsKeeper(window, displays, Resources.boundsSaveDelay, log, platform === Resources.windowsPlatform);
    window.on(Resources.closeEvent, event => {
      if (this.canClose)
        return;
      event.preventDefault();
      this.closing ??= this.closeWhenSavedAsync();
    });
    window.once(Resources.closedEvent, () => {
      this.painted.resolve(false);
      this.stopSettleTimer();
      this.stopPaintTimer();
      this.bounds.cancelSave();
      this.coordinator.release();
      this.updateSaves.release();
    });
  }

  public markPainted(): void {
    this.stopPaintTimer();
    this.isPainted = true;
    this.painted.resolve(true);
    this.showWhenReady();
  }

  public whenPaintedAsync(): Promise<boolean> {
    return this.painted.promise;
  }

  public showUnpaintedWithin(milliseconds: number): void {
    this.paintTimer = setTimeout(() => this.showUnpainted(milliseconds), milliseconds).unref();
  }

  public showNow(): void {
    this.stopPaintTimer();
    this.isPainted = true;
    this.painted.resolve(true);
    this.settle();
  }

  private showUnpainted(milliseconds: number): void {
    const contents = this.window.webContents;
    this.log.write(Resources.formatWindowShownUnpainted(milliseconds / 1000, contents.isLoading(), contents.isCrashed()));
    this.showNow();
  }

  private stopPaintTimer(): void {
    if (!Object.isNull(this.paintTimer))
      clearTimeout(this.paintTimer);
    this.paintTimer = null;
  }

  public settleWithin(milliseconds: number): void {
    this.settleTimer = setTimeout(() => this.settle(), milliseconds);
  }

  public settle(): void {
    this.stopSettleTimer();
    this.isSettled = true;
    this.showWhenReady();
  }

  private stopSettleTimer(): void {
    if (!Object.isNull(this.settleTimer))
      clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private showWhenReady(): void {
    if (this.isPainted && this.isSettled && !this.window.isDestroyed() && !this.window.isVisible())
      this.bounds.show();
  }

  public show(question: QuitQuestion | null): boolean {
    if (this.window.isDestroyed() || this.window.webContents.isCrashed())
      return false;
    this.window.webContents.send(Resources.quitQuestionChannel, question?.toJson() ?? null);
    return true;
  }

  public async saveAsync(): Promise<boolean> {
    if (!await this.coordinator.requestAsync())
      return false;
    if (this.window.isDestroyed())
      return true;
    await this.bounds.saveAsync().catch((error: unknown) => this.log.write(error instanceof WindowStateUnavailableException
      ? Resources.formatBoundsLostAtClose(error.message)
      : Resources.formatBoundsUnsaved(String(error))));
    return true;
  }

  public closeNow(): void {
    if (this.window.isDestroyed())
      return;
    this.canClose = true;
    this.window.close();
  }

  private async closeWhenSavedAsync(): Promise<void> {
    const canClose = await this.guard.canCloseAsync(this) && await this.saveAsync();
    this.closing = null;
    if (canClose)
      this.closeNow();
  }

  private sendRequest(channel: string, requestId: string): boolean {
    if (this.window.isDestroyed() || this.window.webContents.isCrashed())
      return false;
    this.window.webContents.send(channel, requestId);
    return true;
  }
}
