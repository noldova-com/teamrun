/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { AddonLoadException } from "../../exceptions/addon-load.exception.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import { Resources } from "../../resources.js";

export class WindowsProcessApi implements IWindowsProcessApi {
  private addon: IWindowsProcessApi | null = null;

  public listProcesses(): readonly (readonly [number, number])[] {
    return this.load().listProcesses();
  }

  public openProcess(processId: number, access: number): bigint | number {
    return this.load().openProcess(processId, access);
  }

  public readCreationTime(handle: bigint): bigint | null {
    return this.load().readCreationTime(handle);
  }

  public readImagePath(handle: bigint): string | null {
    return this.load().readImagePath(handle);
  }

  public terminateProcess(handle: bigint): boolean {
    return this.load().terminateProcess(handle);
  }

  public hasExited(handle: bigint): boolean {
    return this.load().hasExited(handle);
  }

  public closeHandle(handle: bigint): void {
    this.load().closeHandle(handle);
  }

  private static require(): IWindowsProcessApi {
    const file = fileURLToPath(new URL(Resources.windowsAddonPath, import.meta.url));
    let addon: unknown;
    try {
      addon = createRequire(import.meta.url)(file);
    }
    catch (error) {
      throw new AddonLoadException(Resources.addonLoadFailed, new ExceptionOptions(error));
    }
    if (!WindowsProcessApi.isAddon(addon))
      throw new AddonLoadException(Resources.addonIncomplete);
    return addon;
  }

  private static isAddon(value: unknown): value is IWindowsProcessApi {
    return Object.isObject(value) && Resources.windowsAddonFunctions.every(t => Object.isFunction(Reflect.get(value, t)));
  }

  private load(): IWindowsProcessApi {
    this.addon ??= WindowsProcessApi.require();
    return this.addon;
  }
}
