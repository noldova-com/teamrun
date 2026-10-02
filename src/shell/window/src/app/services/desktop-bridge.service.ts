/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { nameof } from "@noldova/teamrun-foundation-core";
import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { DesktopBridgeException } from "../exceptions/desktop-bridge.exception";
import type { IDesktopBridge } from "../interfaces/i-desktop-bridge";
import { StartupState } from "../models/startup-state";
import type { WindowAppearance } from "../models/window-appearance";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class DesktopBridgeService {
  private readonly bridge: IDesktopBridge = DesktopBridgeService.find();

  public get isMac(): boolean {
    return this.bridge.platform === Resources.macPlatform;
  }

  public notifyReady(appearance: WindowAppearance): void {
    this.bridge.notifyReady(appearance.toJson());
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
    const layout = await this.bridge.readLayout();
    return Object.isNull(layout) ? null : JsonReader.fromValue(layout).toJson();
  }

  public writeLayoutAsync(layout: JsonObject): Promise<boolean> {
    return this.bridge.writeLayout(layout);
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
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.onCloseRequest))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.answerClose))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.readStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.onStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.actOnStartup))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.readLayout))) &&
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.writeLayout)));
  }
}
