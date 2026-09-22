/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class WindowState {
  public readonly x: number | null;
  public readonly y: number | null;
  public readonly width: number;
  public readonly height: number;
  public readonly maximized: boolean;

  public constructor(x: number | null, y: number | null, width: number, height: number, maximized: boolean) {
    this.x = x;
    this.y = y;
    this.width = Math.max(Resources.windowMinimumWidth, Math.round(width));
    this.height = Math.max(Resources.windowMinimumHeight, Math.round(height));
    this.maximized = maximized;
  }

  public static createDefault(): WindowState {
    return new WindowState(null, null, Resources.windowWidth, Resources.windowHeight, false);
  }

  public static fromJson(value: unknown): WindowState {
    const defaults = WindowState.createDefault();
    if (!Object.isObject(value) || Array.isArray(value))
      return defaults;
    const record: Record<string, unknown> = { ...value };
    const x = WindowState.readNumber(record[Resources.xField]);
    const y = WindowState.readNumber(record[Resources.yField]);

    return new WindowState(
      Object.isNull(y) ? null : x,
      Object.isNull(x) ? null : y,
      WindowState.readNumber(record[Resources.widthField]) ?? defaults.width,
      WindowState.readNumber(record[Resources.heightField]) ?? defaults.height,
      record[Resources.maximizedField] === true);
  }

  public toJson(): JsonObject {
    return {
      [Resources.xField]: this.x,
      [Resources.yField]: this.y,
      [Resources.widthField]: this.width,
      [Resources.heightField]: this.height,
      [Resources.maximizedField]: this.maximized
    };
  }

  private static readNumber(value: unknown): number | null {
    return Object.isNumber(value) && Number.isFinite(value) ? value : null;
  }
}
