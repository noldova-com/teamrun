/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppDetailsOptions, BrowserWindowConstructorOptions, Rectangle, TitleBarOverlayOptions } from "electron";

import type { IDesktopWindow } from "@noldova/teamrun-shell-desktop";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { FakeWindowContents } from "./fake-window-contents.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeDesktopWindow implements IDesktopWindow {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public readonly id: number;
  public readonly options: BrowserWindowConstructorOptions;
  public readonly webContents: FakeWindowContents;
  public readonly calls: string[] = [];
  public loadedFile: string | null = null;
  public backgroundColor: string | null = null;
  public overlay: TitleBarOverlayOptions | null = null;
  public appDetails: AppDetailsOptions | null = null;
  public readonly icons: string[] = [];
  public isShown: boolean = false;
  public isGone: boolean = false;
  public isMinimizedNow: boolean = false;
  public isMaximizedNow: boolean = false;
  public bounds: Rectangle = { x: 100, y: 80, width: 1280, height: 800 };
  public boundsReads: number = 0;

  public constructor(options: BrowserWindowConstructorOptions, contentsId: number) {
    this.id = contentsId;
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

  public setAppDetails(options: AppDetailsOptions): void {
    this.appDetails = options;
  }

  public setIcon(iconPath: string): void {
    this.icons.push(iconPath);
  }

  public setTitleBarOverlay(options: TitleBarOverlayOptions): void {
    this.overlay = options;
  }

  public getNormalBounds(): Rectangle {
    this.boundsReads++;
    return { ...this.bounds };
  }

  public setBounds(bounds: Partial<Rectangle>): void {
    this.calls.push(`setBounds ${JSON.stringify(bounds)}`);
    this.bounds = { ...this.bounds, ...bounds };
  }

  public center(): void {
    this.calls.push("center");
  }

  public isMaximized(): boolean {
    return this.isMaximizedNow;
  }

  public maximize(): void {
    this.calls.push("maximize");
    this.isMaximizedNow = true;
  }

  public change(event: string): void {
    this.listeners.emit(event);
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
