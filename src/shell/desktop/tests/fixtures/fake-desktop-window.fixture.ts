/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from "electron";

import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { FakeWindowContents } from "./fake-window-contents.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeDesktopWindow implements IDesktopWindow {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public readonly options: BrowserWindowConstructorOptions;
  public readonly webContents: FakeWindowContents;
  public readonly calls: string[] = [];
  public loadedFile: string | null = null;
  public backgroundColor: string | null = null;
  public overlay: TitleBarOverlayOptions | null = null;
  public isShown: boolean = false;
  public isGone: boolean = false;
  public isMinimizedNow: boolean = false;

  public constructor(options: BrowserWindowConstructorOptions, contentsId: number) {
    this.options = options;
    this.webContents = new FakeWindowContents(contentsId);
  }

  public loadFile(filePath: string): Promise<void> {
    this.loadedFile = filePath;
    return Promise.resolve();
  }

  public setBackgroundColor(color: string): void {
    this.backgroundColor = color;
  }

  public setTitleBarOverlay(options: TitleBarOverlayOptions): void {
    this.overlay = options;
  }

  public isVisible(): boolean {
    return this.isShown;
  }

  public isDestroyed(): boolean {
    return this.isGone;
  }

  public isMinimized(): boolean {
    return this.isMinimizedNow;
  }

  public show(): void {
    this.calls.push("show");
    this.isShown = true;
  }

  public restore(): void {
    this.calls.push("restore");
  }

  public focus(): void {
    this.calls.push("focus");
  }

  public close(): void {
    this.calls.push("close");
    const event = new FakePreventableEvent();
    this.listeners.emit("close", event);
    if (!event.isPrevented)
      this.destroy();
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public once(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public destroy(): void {
    this.isGone = true;
    this.listeners.emit("closed");
  }
}
