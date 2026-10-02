/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
import type { IDisplayHost } from "../interfaces/i-display-host.js";
import { Resources } from "../resources.js";
import { CloseCoordinator } from "./close-coordinator.js";
import { WindowBoundsKeeper } from "./window-bounds-keeper.js";

export class OpenWindow {
  private closing: Promise<void> | null = null;
  private canClose: boolean = false;
  private isPainted: boolean = false;
  private isSettled: boolean = false;

  public readonly window: IDesktopWindow;
  public readonly coordinator: CloseCoordinator;
  public readonly bounds: WindowBoundsKeeper;

  public constructor(window: IDesktopWindow, displays: IDisplayHost) {
    this.window = window;
    this.coordinator = new CloseCoordinator(t => this.sendCloseRequest(t), Resources.closeAnswerTimeout);
    this.bounds = new WindowBoundsKeeper(window, displays, Resources.boundsSaveDelay);
    window.on(Resources.closeEvent, event => {
      if (this.canClose)
        return;
      event.preventDefault();
      this.closing ??= this.closeWhenSavedAsync();
    });
    window.once(Resources.closedEvent, () => {
      this.bounds.cancelSave();
      this.coordinator.release();
    });
  }

  public markPainted(): void {
    this.isPainted = true;
    this.showWhenReady();
  }

  public settle(): void {
    this.isSettled = true;
    this.showWhenReady();
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
    await this.bounds.saveAsync().catch((error: unknown) => process.stderr.write(`${Resources.formatBoundsUnsaved(String(error))}\n`));
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
