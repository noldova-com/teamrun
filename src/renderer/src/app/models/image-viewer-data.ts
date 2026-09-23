/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ImageSource } from "./image-source";

export class ImageViewerData {
  public readonly image: ImageSource;
  public readonly images: readonly ImageSource[];
  public readonly index: number;

  public constructor(image: ImageSource, images: readonly ImageSource[] = []) {
    this.image = image;
    this.images = images.includes(image) ? [...images] : [image];
    this.index = this.images.indexOf(image);
  }
}
