/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { IDesktopBridge } from "../../src/app/interfaces/i-desktop-bridge";

export class DesktopBridgeFixture implements IDesktopBridge {
  private static readonly NAME: string = "teamrun";

  private readonly listeners: Set<(requestId: string) => void> = new Set();
  private readonly startupListeners: Set<(state: unknown) => void> = new Set();

  public readonly platform: string;
  public readonly appearances: JsonObject[] = [];
  public readonly answers: string[] = [];
  public readonly actions: string[] = [];
  public startup: unknown = { kind: "Ready", details: [] };

  public constructor(platform: string) {
    this.platform = platform;
  }

  public static install(platform: string = "win32"): DesktopBridgeFixture {
    const bridge = new DesktopBridgeFixture(platform);
    Reflect.set(globalThis, DesktopBridgeFixture.NAME, bridge);
    return bridge;
  }

  public static installValue(value: unknown): void {
    Reflect.set(globalThis, DesktopBridgeFixture.NAME, value);
  }

  public static remove(): void {
    Reflect.deleteProperty(globalThis, DesktopBridgeFixture.NAME);
  }

  public get listenerCount(): number {
    return this.listeners.size + this.startupListeners.size;
  }

  public get closeListenerCount(): number {
    return this.listeners.size;
  }

  public notifyReady(appearance: JsonObject): void {
    this.appearances.push(appearance);
  }

  public onCloseRequest(listener: (requestId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public answerClose(requestId: string, isSaved: boolean): Promise<boolean> {
    this.answers.push(`${requestId}:${isSaved}`);
    return Promise.resolve(true);
  }

  public readStartup(): Promise<unknown> {
    return Promise.resolve(this.startup);
  }

  public onStartup(listener: (state: unknown) => void): () => void {
    this.startupListeners.add(listener);
    return () => this.startupListeners.delete(listener);
  }

  public actOnStartup(action: string): Promise<boolean> {
    this.actions.push(action);
    return Promise.resolve(true);
  }

  public publishStartup(state: unknown): void {
    for (const listener of this.startupListeners)
      listener(state);
  }

  public requestClose(requestId: string): void {
    for (const listener of this.listeners)
      listener(requestId);
  }
}
