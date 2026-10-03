/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";

import { DesktopBridgeException } from "../exceptions/desktop-bridge.exception";
import { RuntimeRequestException } from "../exceptions/runtime-request.exception";
import type { IDesktopBridge } from "../interfaces/i-desktop-bridge";
import { BuildInfo } from "../models/build-info";
import { StartupState } from "../models/startup-state";
import type { WindowAppearance } from "../models/window-appearance";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class DesktopBridgeService {
  private readonly bridge: IDesktopBridge = DesktopBridgeService.find();

  public get platform(): string {
    return this.bridge.platform;
  }

  public get isMac(): boolean {
    return this.bridge.platform === Resources.macPlatform;
  }

  public notifyReady(appearance: WindowAppearance): void {
    this.bridge.notifyReady(appearance.toJson());
  }

  public notifyAppearance(appearance: WindowAppearance): void {
    this.bridge.notifyAppearance(appearance.toJson());
  }

  public onCloseRequest(listener: (requestId: string) => void): () => void {
    return this.bridge.onCloseRequest(listener);
  }

  public answerCloseAsync(requestId: string, isSaved: boolean): Promise<boolean> {
    return this.bridge.answerClose(requestId, isSaved);
  }

  public async readStartupAsync(): Promise<StartupState> {
    return StartupState.fromJson(await this.bridge.readStartup());
  }

  public onStartup(listener: (state: StartupState) => void): () => void {
    return this.bridge.onStartup(t => listener(StartupState.fromJson(t)));
  }

  public actOnStartupAsync(action: string): Promise<boolean> {
    return this.bridge.actOnStartup(action);
  }

  public async readLayoutAsync(): Promise<JsonObject | null> {
    const layout = DesktopBridgeService.readAnswer(await this.bridge.readLayout());
    return Object.isNull(layout) ? null : JsonReader.fromValue(layout).toJson();
  }

  public async writeLayoutAsync(layout: JsonObject): Promise<void> {
    DesktopBridgeService.readAnswer(await this.bridge.writeLayout(layout));
  }

  public async requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    return DesktopBridgeService.readAnswer(await this.bridge.request(method, payload));
  }

  public onEvent(listener: (name: string, payload: JsonValue) => void): () => void {
    return this.bridge.onEvent((name, payload) => listener(name, JsonReader.toJsonValue(payload)));
  }

  public setMenuBar(menuBar: JsonObject): void {
    this.bridge.setMenuBar(menuBar);
  }

  public onMenuCommand(listener: (id: string) => void): () => void {
    return this.bridge.onMenuCommand(listener);
  }


  public async readBuildAsync(): Promise<BuildInfo> {
    return BuildInfo.fromJson(await this.bridge.readBuild());
  }

  public copyTextAsync(text: string): Promise<boolean> {
    return this.bridge.copyText(text);
  }

  public openLogFolderAsync(): Promise<boolean> {
    return this.bridge.openLogFolder();
  }

  private static readAnswer(value: unknown): JsonValue {
    const answer = JsonReader.fromValue(value);
    if (!answer.hasField(Resources.failureField))
      return answer.readValue(Resources.payloadField);
    const failure = answer.readObject(Resources.failureField);
    throw new RuntimeRequestException(
      failure.readString(Resources.codeField),
      failure.readString(Resources.messageField),
      failure.hasField(Resources.detailsField) ? failure.readObject(Resources.detailsField).toJson() : undefined);
  }

  private static find(): IDesktopBridge {
    const bridge: unknown = Reflect.get(globalThis, Resources.bridgeName);
    if (!DesktopBridgeService.isBridge(bridge))
      throw new DesktopBridgeException(Resources.missingBridge);
    return bridge;
  }

  private static isBridge(value: unknown): value is IDesktopBridge {
    return Object.isObject(value) &&
      Object.isString(Reflect.get(value, nameof<IDesktopBridge>(t => t.platform))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.notifyReady))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.notifyAppearance))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.onCloseRequest))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.answerClose))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.readStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.onStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.actOnStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.readLayout))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.writeLayout))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.request))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.onEvent))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.readBuild))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.copyText))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.openLogFolder)));
  }
}
