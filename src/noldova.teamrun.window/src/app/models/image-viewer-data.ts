/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewedImage } from "./viewed-image";

export class ImageViewerData {
  public readonly image: ViewedImage;
  public readonly images: readonly ViewedImage[];
  public readonly index: number;

  public constructor(image: ViewedImage, images: readonly ViewedImage[] = []) {
    this.image = image;
    this.images = images.includes(image) ? [...images] : [image];
    this.index = this.images.indexOf(image);
  }
}
