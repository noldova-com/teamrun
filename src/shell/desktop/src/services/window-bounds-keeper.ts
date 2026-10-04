/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import type { IDesktopWindow } from "../interfaces/i-desktop-window.js";
import type { IDisplayHost } from "../interfaces/i-display-host.js";
import type { IWindowStateStore } from "../interfaces/i-window-state-store.js";
import { ScreenArea } from "../models/screen-area.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";

export class WindowBoundsKeeper {
  private readonly window: IDesktopWindow;
  private readonly displays: IDisplayHost;
  private readonly saveDelay: number;
  private readonly log: IDesktopLog;
  private store: IWindowStateStore | null = null;
  private timer: NodeJS.Timeout | null = null;
  private hasUnsaved: boolean = false;

  public constructor(window: IDesktopWindow, displays: IDisplayHost, saveDelay: number, log: IDesktopLog, holdsPersonsMoves: boolean) {
    this.window = window;
    this.displays = displays;
    this.saveDelay = saveDelay;
    this.log = log;
    const changed = (): void => this.noteChange();
    window.on(Resources.resizeEvent, changed);
    window.on(Resources.moveEvent, changed);
    window.on(Resources.maximizeEvent, changed);
    window.on(Resources.unmaximizeEvent, changed);
    if (holdsPersonsMoves) {
      const placed = (): void => this.notePlacedByPerson();
      window.on(Resources.willMoveEvent, placed);
      window.on(Resources.willResizeEvent, placed);
    }
  }

  public async restoreAsync(store: IWindowStateStore): Promise<void> {
    this.store = store;
    if (this.hasUnsaved) {
      await this.saveAsync();
      return;
    }
    const saved = await store.readAsync();
    if (Object.isNull(saved))
      return;
    const areas = this.displays.getAllDisplays().map(t => new ScreenArea(t.workArea.x, t.workArea.y, t.workArea.width, t.workArea.height));
    const state = WindowState.fromJson(saved).placeOn(areas);
    if (Object.isNull(state.x) || Object.isNull(state.y)) {
      this.window.setBounds({ width: state.width, height: state.height });
      this.window.center();
    }
    else
      this.window.setBounds({ x: state.x, y: state.y, width: state.width, height: state.height });
    if (state.isMaximized)
      this.window.maximize();
  }

  public async saveAsync(): Promise<void> {
    this.cancelSave();
    if (this.window.isDestroyed())
      return;
    if (Object.isNull(this.store)) {
      if (this.hasUnsaved)
        throw new WindowStateUnavailableException(Resources.runtimeNotConnected);
      return;
    }
    const bounds = this.window.getNormalBounds();
    this.hasUnsaved = true;
    await this.store.writeAsync(new WindowState(bounds.x, bounds.y, bounds.width, bounds.height, this.window.isMaximized()).toJson());
    this.hasUnsaved = false;
  }

  public async saveUnsavedAsync(): Promise<void> {
    if (this.hasUnsaved)
      await this.saveAsync();
  }

  public cancelSave(): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.timer = null;
  }

  private noteChange(): void {
    if (!Object.isNull(this.store))
      this.scheduleSave();
  }

  private notePlacedByPerson(): void {
    if (Object.isNull(this.store))
      this.hasUnsaved = true;
  }

  private scheduleSave(): void {
    this.cancelSave();
    this.timer = setTimeout(() => void this.saveAsync().catch((error: unknown) => {
      if (!(error instanceof WindowStateUnavailableException))
        this.log.write(Resources.formatBoundsUnsaved(String(error)));
    }), this.saveDelay);
  }
}
