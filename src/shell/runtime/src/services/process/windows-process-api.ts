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
    return WindowsProcessApi.expect(this.load().listProcesses(), t => Array.isArray(t)
      && t.every(row => Array.isArray(row) && row.length === Resources.windowsProcessRowLength && row.every(id => Object.isNumber(id))));
  }

  public openProcess(processId: number, access: number): bigint | number {
    return WindowsProcessApi.expect(this.load().openProcess(processId, access), t => Object.isBigInt(t) || Object.isNumber(t));
  }

  public readCreationTime(handle: bigint): bigint | null {
    return WindowsProcessApi.expect(this.load().readCreationTime(handle), t => Object.isBigInt(t) || Object.isNull(t));
  }

  public readImagePath(handle: bigint): string | null {
    return WindowsProcessApi.expect(this.load().readImagePath(handle), t => Object.isString(t) || Object.isNull(t));
  }

  public terminateProcess(handle: bigint): boolean {
    return WindowsProcessApi.expect(this.load().terminateProcess(handle), t => Object.isBoolean(t));
  }

  public hasExited(handle: bigint): boolean {
    return WindowsProcessApi.expect(this.load().hasExited(handle), t => Object.isBoolean(t));
  }

  public openFileForReading(file: string): bigint | number {
    return WindowsProcessApi.expect(this.load().openFileForReading(file), t => Object.isBigInt(t) || Object.isNumber(t));
  }

  public closeHandle(handle: bigint): void {
    WindowsProcessApi.expect(this.load().closeHandle(handle), t => Object.isUndefined(t));
  }

  private static expect<T>(value: T, isExpected: (value: unknown) => boolean): T {
    if (!isExpected(value))
      throw new AddonLoadException(Resources.addonUnexpected);
    return value;
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
