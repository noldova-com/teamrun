/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ImageSource } from "./image-source";
import { ImageViewerData } from "./image-viewer-data";

export class ImageDocument {
  public readonly id: number;
  public readonly key: string;
  public readonly data: ImageViewerData;
  private readonly ownedUrl: string | null;

  public constructor(id: number, image: ImageSource) {
    this.id = id;
    this.key = image.path ?? image.data ?? image.key;
    this.ownedUrl = Object.isNull(image.file) ? null : URL.createObjectURL(image.file);
    this.data = new ImageViewerData(new ImageSource(image.key, image.label, image.path, this.ownedUrl ?? image.data));
  }

  public dispose(): void {
    if (!Object.isNull(this.ownedUrl))
      URL.revokeObjectURL(this.ownedUrl);
  }
}
