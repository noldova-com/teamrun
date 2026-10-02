/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindow } from "electron";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";
import { CloseCoordinator } from "./close-coordinator.js";

export class OpenWindow {
  private closing: Promise<void> | null = null;
  private canClose: boolean = false;
  public readonly window: BrowserWindow;
  public readonly coordinator: CloseCoordinator;

  public constructor(window: BrowserWindow) {
    this.window = window;
    this.coordinator = new CloseCoordinator(t => this.sendCloseRequest(t), Resources.closeAnswerTimeout);
    window.on(Resources.closeEvent, event => {
      if (this.canClose)
        return;
      event.preventDefault();
      this.closing ??= this.closeWhenSavedAsync();
    });
    window.once(Resources.closedEvent, () => this.coordinator.release());
  }

  private async closeWhenSavedAsync(): Promise<void> {
    const canClose = await this.coordinator.requestAsync();
    this.closing = null;
    if (!canClose || this.window.isDestroyed())
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
