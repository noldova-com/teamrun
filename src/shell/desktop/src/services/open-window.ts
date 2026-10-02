/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
import type { IDisplayHost } from "../interfaces/i-display-host.js";
import { Resources } from "../resources.js";
import { CloseCoordinator } from "./close-coordinator.js";
import { WindowBoundsKeeper } from "./window-bounds-keeper.js";

export class OpenWindow {
  private readonly log: IDesktopLog;
  private closing: Promise<void> | null = null;
  private canClose: boolean = false;
  private isPainted: boolean = false;
  private isSettled: boolean = false;
  private settleTimer: NodeJS.Timeout | null = null;
  private paintTimer: NodeJS.Timeout | null = null;

  public readonly window: IDesktopWindow;
  public readonly coordinator: CloseCoordinator;
  public readonly bounds: WindowBoundsKeeper;

  public constructor(window: IDesktopWindow, displays: IDisplayHost, log: IDesktopLog) {
    this.window = window;
    this.log = log;
    this.coordinator = new CloseCoordinator(t => this.sendCloseRequest(t), Resources.closeAnswerTimeout);
    this.bounds = new WindowBoundsKeeper(window, displays, Resources.boundsSaveDelay, log);
    window.on(Resources.closeEvent, event => {
      if (this.canClose)
        return;
      event.preventDefault();
      this.closing ??= this.closeWhenSavedAsync();
    });
    window.once(Resources.closedEvent, () => {
      this.stopSettleTimer();
      this.stopPaintTimer();
      this.bounds.cancelSave();
      this.coordinator.release();
    });
  }

  public markPainted(): void {
    this.stopPaintTimer();
    this.isPainted = true;
    this.showWhenReady();
  }

  public showUnpaintedWithin(milliseconds: number): void {
    this.paintTimer = setTimeout(() => this.showUnpainted(milliseconds), milliseconds).unref();
  }

  private showUnpainted(milliseconds: number): void {
    this.paintTimer = null;
    const contents = this.window.webContents;
    this.log.write(Resources.formatWindowShownUnpainted(milliseconds / 1000, contents.isLoading(), contents.isCrashed()));
    this.isPainted = true;
    this.settle();
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
      this.window.show();
  }

  private async closeWhenSavedAsync(): Promise<void> {
    const canClose = await this.coordinator.requestAsync();
    this.closing = null;
    if (!canClose || this.window.isDestroyed())
      return;
    await this.bounds.saveAsync().catch((error: unknown) => this.log.write(Resources.formatBoundsUnsaved(String(error))));
    if (this.window.isDestroyed())
      return;
    this.canClose = true;
    this.window.close();
  }

  private sendCloseRequest(requestId: string): boolean {
    if (this.window.isDestroyed())
      return false;
    this.window.webContents.send(Resources.closeRequestChannel, requestId);
    return true;
  }
}
