/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

import type { IDesktopBridge } from "../../src/app/interfaces/i-desktop-bridge";

export class DesktopBridgeFixture implements IDesktopBridge {
  private static readonly NAME: string = "teamrun";

  private readonly listeners: Set<(requestId: string) => void> = new Set();
  private readonly startupListeners: Set<(state: unknown) => void> = new Set();
  private readonly eventListeners: Set<(name: string, payload: unknown) => void> = new Set();
  private readonly menuListeners: Set<(id: string) => void> = new Set();
  private readonly openedListeners: Set<(id: number) => void> = new Set();
  private readonly quitListeners: Set<(question: unknown) => void> = new Set();

  public readonly platform: string;
  public appearance: unknown = null;
  public readonly keptAppearances: JsonObject[] = [];
  public readonly appearances: JsonObject[] = [];
  public readonly changes: JsonObject[] = [];
  public readonly answers: string[] = [];
  public readonly actions: string[] = [];
  public startup: unknown = { kind: "Ready", details: [] };
  public layout: unknown = null;
  public readonly requests: [string, JsonValue][] = [];
  public answer: unknown = { payload: null };
  public readonly responses: Map<string, unknown> = new Map<string, unknown>([
    ["shell.modules", { payload: { modules: [] } }],
    ["shell.commands", { payload: { commands: [], sequence: 0 } }],
    ["shell.notifications", { payload: { notifications: [], isDoNotDisturb: false, sequence: 0 } }],
    ["shell.settings", { payload: { definitions: [], entries: [] } }]
  ]);
  public build: unknown = { productVersion: "1.2.3", fingerprint: "abc123" };
  public readonly copied: string[] = [];
  public isCopyAccepted: boolean = true;
  public logFolderOpens: number = 0;
  public readonly quitAnswers: string[] = [];
  public readonly logged: string[] = [];
  public logFolderOpened: Promise<boolean> = Promise.resolve(true);
  public readonly menuBars: JsonObject[] = [];
  public readonly edits: string[] = [];

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
    return this.listeners.size + this.startupListeners.size + this.eventListeners.size + this.menuListeners.size + this.openedListeners.size;
  }

  public get closeListenerCount(): number {
    return this.listeners.size;
  }

  public notifyReady(appearance: JsonObject): void {
    this.appearances.push(appearance);
  }

  public notifyAppearance(appearance: JsonObject): void {
    this.changes.push(appearance);
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

  public readLayout(): Promise<unknown> {
    return Promise.resolve({ payload: this.layout });
  }

  public writeLayout(layout: JsonObject): Promise<unknown> {
    this.layout = layout;
    return Promise.resolve({ payload: null });
  }

  public request(method: string, payload: JsonValue): Promise<unknown> {
    this.requests.push([method, payload]);
    return Promise.resolve(this.responses.has(method) ? this.responses.get(method) : this.answer);
  }

  public onEvent(listener: (name: string, payload: unknown) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public readBuild(): Promise<unknown> {
    return Promise.resolve(this.build);
  }

  public copyText(text: string): Promise<boolean> {
    if (this.isCopyAccepted)
      this.copied.push(text);
    return Promise.resolve(this.isCopyAccepted);
  }

  public keepAppearance(preferences: JsonObject): void {
    this.keptAppearances.push(preferences);
  }

  public openLogFolder(): Promise<boolean> {
    this.logFolderOpens++;
    return this.logFolderOpened;
  }

  public edit(action: string): Promise<boolean> {
    this.edits.push(action);
    return Promise.resolve(true);
  }

  public setMenuBar(menuBar: JsonObject): void {
    this.menuBars.push(menuBar);
  }

  public onMenuCommand(listener: (id: string) => void): () => void {
    this.menuListeners.add(listener);
    return () => this.menuListeners.delete(listener);
  }

  public chooseMenuCommand(id: string): void {
    for (const listener of this.menuListeners)
      listener(id);
  }

  public onNotificationOpened(listener: (id: number) => void): () => void {
    this.openedListeners.add(listener);
    return () => this.openedListeners.delete(listener);
  }

  public onQuitQuestion(listener: (question: unknown) => void): () => void {
    this.quitListeners.add(listener);
    return () => this.quitListeners.delete(listener);
  }

  public answerQuit(choice: string): Promise<boolean> {
    this.quitAnswers.push(choice);
    return Promise.resolve(true);
  }

  public logModule(moduleId: string, message: string): void {
    this.logged.push(`${moduleId}: ${message}`);
  }

  public askToQuit(question: unknown): void {
    for (const listener of this.quitListeners)
      listener(question);
  }

  public publishNotificationOpened(id: number): void {
    for (const listener of this.openedListeners)
      listener(id);
  }

  public publishEvent(name: string, payload: unknown): void {
    for (const listener of this.eventListeners)
      listener(name, payload);
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
