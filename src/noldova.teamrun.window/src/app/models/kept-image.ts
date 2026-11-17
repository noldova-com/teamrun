/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewedImage } from "./viewed-image";

export class KeptImage {
  public readonly image: ViewedImage;
  public readonly bytes: number;

  public constructor(image: ViewedImage, bytes: number) {
    this.image = image;
    this.bytes = bytes;
  }
}
