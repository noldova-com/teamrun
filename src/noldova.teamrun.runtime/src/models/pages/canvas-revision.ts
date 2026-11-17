/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CanvasArtboard, Page } from "@noldova/teamrun.protocol";

import type { CanvasContent } from "./canvas-content.js";

export class CanvasRevision {
  public readonly content: CanvasContent;
  public readonly artboard: CanvasArtboard;
  public readonly page: Page;

  public constructor(content: CanvasContent, artboard: CanvasArtboard, page: Page) {
    this.content = content;
    this.artboard = artboard;
    this.page = page;
  }
}
