/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@noldova/teamrun.protocol";

import type { CanvasContent } from "./canvas-content.js";

export class CanvasArrangement {
  public readonly content: CanvasContent;
  public readonly released: readonly Page[];

  public constructor(content: CanvasContent, released: readonly Page[]) {
    this.content = content;
    this.released = released;
  }
}
