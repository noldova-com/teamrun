/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SavedImage {
  public readonly path: string | null;
  public readonly mediaType: string;
  public readonly data: string;

  public constructor(path: string | null, mediaType: string, data: string) {
    this.path = path;
    this.mediaType = mediaType;
    this.data = data;
  }
}
