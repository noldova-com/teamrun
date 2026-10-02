/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { nameof } from "@noldova/teamrun-foundation-core";

import { DesktopBridgeException } from "../exceptions/desktop-bridge.exception";
import type { IDesktopBridge } from "../interfaces/i-desktop-bridge";
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
      Object.isFunction(Reflect.get(value, nameof<IDesktopBridge>(t => t.answerClose)));
  }
}
