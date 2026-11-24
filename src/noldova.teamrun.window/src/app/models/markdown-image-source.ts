/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewedImage } from "./viewed-image";

export class MarkdownImageSource {
  public readonly source: string;
  public readonly image: ViewedImage;

  public constructor(source: string, image: ViewedImage) {
    this.source = source;
    this.image = image;
  }
}
