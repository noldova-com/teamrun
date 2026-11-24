/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ViewedImageMissingException } from "../exceptions/viewed-image-missing.exception";
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

  public static of(key: string, images: readonly ViewedImage[]): ImageViewerData {
    const image = images.find(t => t.key === key);
    if (Object.isUndefined(image))
      throw new ViewedImageMissingException(key);
    return new ImageViewerData(image, images);
  }

  public imageAt(index: number): ViewedImage {
    return this.images[index] ?? this.image;
  }
}
