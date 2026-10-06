/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WindowOpenHandlerResponse } from "electron";

import type { IContextMenuParams, IWindowContents } from "@noldova/teamrun-shell-desktop";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeWindowContents implements IWindowContents {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private openHandler: (() => WindowOpenHandlerResponse) | null = null;

  public readonly id: number;
  public readonly sent: unknown[][] = [];
  public loading: boolean = false;
  public crashed: boolean = false;
  public osProcessId: number = 4242;
  public readonly calls: string[] = [];

  public constructor(id: number) {
    this.id = id;
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public setWindowOpenHandler(handler: () => WindowOpenHandlerResponse): void {
    this.openHandler = handler;
  }

  public send(channel: string, ...values: unknown[]): void {
    this.sent.push([channel, ...values]);
  }

  public isLoading(): boolean {
    return this.loading;
  }

  public isCrashed(): boolean {
    return this.crashed;
  }

  public reload(): void {
    this.calls.push("reload");
  }

  public forcefullyCrashRenderer(): void {
    this.calls.push("crash");
  }

  public undo(): void {
    this.calls.push("undo");
  }

  public redo(): void {
    this.calls.push("redo");
  }

  public cut(): void {
    this.calls.push("cut");
  }

  public copy(): void {
    this.calls.push("copy");
  }

  public paste(): void {
    this.calls.push("paste");
  }

  public selectAll(): void {
    this.calls.push("selectAll");
  }

  public replaceMisspelling(text: string): void {
    this.calls.push(`replaceMisspelling ${text}`);
  }

  public getOSProcessId(): number {
    return this.osProcessId;
  }

  public askForMenu(params: IContextMenuParams): void {
    this.listeners.emit("context-menu", {}, params);
  }

  public startLoading(): void {
    this.listeners.emit("did-start-loading");
  }

  public goAway(reason: string, exitCode: number = 0): void {
    this.listeners.emit("render-process-gone", {}, { reason, exitCode });
  }

  public navigate(event: string, url?: string): boolean {
    const preventable = new FakePreventableEvent();
    this.listeners.emit(event, preventable, url);
    return preventable.isPrevented;
  }

  public openWindow(): WindowOpenHandlerResponse | undefined {
    return this.openHandler?.();
  }
}
