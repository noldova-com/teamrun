/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CanvasManifest, Page } from "@noldova/teamrun.protocol";

export class CanvasContent {
  public readonly canvas: Page;
  public readonly version: number;
  public readonly manifest: CanvasManifest;

  public constructor(canvas: Page, version: number, manifest: CanvasManifest) {
    this.canvas = canvas;
    this.version = version;
    this.manifest = manifest;
  }
}
