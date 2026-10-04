/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import type { ScreenArea } from "./screen-area.js";

export class WindowState {
  public readonly x: number | null;
  public readonly y: number | null;
  public readonly width: number;
  public readonly height: number;
  public readonly isMaximized: boolean;

  public constructor(x: number | null, y: number | null, width: number, height: number, isMaximized: boolean) {
    if (Object.isNull(x) !== Object.isNull(y))
      throw new ArgumentException(Resources.positionPairMessage, Resources.xField);
    if (!Object.isNull(x) && !Number.isInteger(x))
      throw new ArgumentOutOfRangeException(Resources.xField, x);
    if (!Object.isNull(y) && !Number.isInteger(y))
      throw new ArgumentOutOfRangeException(Resources.yField, y);
    if (!Number.isInteger(width) || width < Resources.windowMinimumWidth)
      throw new ArgumentOutOfRangeException(Resources.widthField, width, Resources.formatWindowSize(Resources.widthField, Resources.windowMinimumWidth));
    if (!Number.isInteger(height) || height < Resources.windowMinimumHeight)
      throw new ArgumentOutOfRangeException(Resources.heightField, height, Resources.formatWindowSize(Resources.heightField, Resources.windowMinimumHeight));

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isMaximized = isMaximized;
  }

  public static createDefault(area: ScreenArea): WindowState {
    return new WindowState(null, null, WindowState.shareOf(Resources.windowWidth, area.width, Resources.windowMinimumWidth),
      WindowState.shareOf(Resources.windowHeight, area.height, Resources.windowMinimumHeight), false);
  }

  public static fromJson(value: unknown): WindowState {
    const json = JsonReader.fromValue(value);
    const x = json.readNullableInteger(Resources.xField);
    const y = json.readNullableInteger(Resources.yField);
    const width = json.readInteger(Resources.widthField);
    const height = json.readInteger(Resources.heightField);
    const isMaximized = json.readBoolean(Resources.maximizedField);
    try {
      return new WindowState(x, y, width, height, isMaximized);
    }
    catch (error) {
      throw new JsonException(Resources.invalidWindowState, json.path, new ExceptionOptions(error));
    }
  }

  public placeOn(workAreas: readonly ScreenArea[], primary: ScreenArea): WindowState {
    const shown = this.displayOf(workAreas);
    const area = shown ?? primary;
    if (area.fits(this.width, this.height))
      return Object.isNull(shown) && !Object.isNull(this.x) ? new WindowState(null, null, this.width, this.height, this.isMaximized) : this;
    const width = WindowState.shareOf(this.width, area.width, Resources.windowMinimumWidth);
    const height = WindowState.shareOf(this.height, area.height, Resources.windowMinimumHeight);
    if (Object.isNull(shown))
      return new WindowState(null, null, width, height, this.isMaximized);
    return new WindowState(area.x + Math.floor((area.width - width) / 2), area.y + Math.floor((area.height - height) / 2), width, height, this.isMaximized);
  }

  private static shareOf(size: number, available: number, minimum: number): number {
    return Math.max(minimum, Math.min(size, Math.floor(available * Resources.windowAreaShare)));
  }

  private displayOf(workAreas: readonly ScreenArea[]): ScreenArea | null {
    const { x, y } = this;
    if (Object.isNull(x) || Object.isNull(y))
      return null;
    let shown: ScreenArea | null = null;
    let most = 0;
    for (const area of workAreas) {
      const shared = area.overlapArea(x, y, this.width, this.height);
      if (shared > most) {
        shown = area;
        most = shared;
      }
    }
    return shown;
  }

  public toJson(): JsonObject {
    return {
      [Resources.xField]: this.x,
      [Resources.yField]: this.y,
      [Resources.widthField]: this.width,
      [Resources.heightField]: this.height,
      [Resources.maximizedField]: this.isMaximized
    };
  }
}
