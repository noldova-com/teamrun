/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewedImage } from "./viewed-image";

export class KeyedImage {
  public readonly key: number;
  public readonly image: ViewedImage;

  public constructor(key: number, image: ViewedImage) {
    this.key = key;
    this.image = image;
  }
}
