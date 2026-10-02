/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class WindowAppearance {
  public readonly background: string;
  public readonly titleBar: string;
  public readonly titleBarText: string;
  public readonly titleBarHeight: number;

  public constructor(background: string, titleBar: string, titleBarText: string, titleBarHeight: number) {
    WindowAppearance.requireColor(background, Resources.backgroundField);
    WindowAppearance.requireColor(titleBar, Resources.titleBarField);
    WindowAppearance.requireColor(titleBarText, Resources.titleBarTextField);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(titleBarHeight, Resources.titleBarHeightField);

    this.background = background;
    this.titleBar = titleBar;
    this.titleBarText = titleBarText;
    this.titleBarHeight = titleBarHeight;
  }

  public static fromJson(value: unknown): WindowAppearance {
    const json = JsonReader.fromValue(value);
    const background = json.readString(Resources.backgroundField);
    const titleBar = json.readString(Resources.titleBarField);
    const titleBarText = json.readString(Resources.titleBarTextField);
    const titleBarHeight = json.readInteger(Resources.titleBarHeightField);
    try {
      return new WindowAppearance(background, titleBar, titleBarText, titleBarHeight);
    }
    catch (error) {
      throw new JsonException(Resources.invalidAppearance, json.path, new ExceptionOptions(error));
    }
  }

  public toJson(): JsonObject {
    return {
      [Resources.backgroundField]: this.background,
      [Resources.titleBarField]: this.titleBar,
      [Resources.titleBarTextField]: this.titleBarText,
      [Resources.titleBarHeightField]: this.titleBarHeight
    };
  }

  private static requireColor(value: string, name: string): void {
    if (!Resources.colorPattern.test(value))
      throw new ArgumentException(Resources.invalidColor, name);
  }
}
