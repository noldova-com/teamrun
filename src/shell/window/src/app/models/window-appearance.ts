/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";

export class WindowAppearance {
  public readonly background: string;
  public readonly titleBar: string;
  public readonly titleBarText: string;
  public readonly titleBarHeight: number;

  public constructor(background: string, titleBar: string, titleBarText: string, titleBarHeight: number) {
    this.background = background;
    this.titleBar = titleBar;
    this.titleBarText = titleBarText;
    this.titleBarHeight = titleBarHeight;
  }

  public static read(windowRow: HTMLElement): WindowAppearance {
    const rowStyle = getComputedStyle(windowRow);
    const background = getComputedStyle(windowRow.ownerDocument.body).backgroundColor;
    return new WindowAppearance(background, rowStyle.backgroundColor, rowStyle.color, Math.round(windowRow.getBoundingClientRect().height));
  }

  public toJson(): JsonObject {
    return {
      [Resources.backgroundField]: this.background,
      [Resources.titleBarField]: this.titleBar,
      [Resources.titleBarTextField]: this.titleBarText,
      [Resources.titleBarHeightField]: this.titleBarHeight
    };
  }
}
