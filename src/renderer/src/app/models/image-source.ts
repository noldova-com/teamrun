/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ImageSource {
  public readonly key: string;
  public readonly label: string;
  public readonly path: string | null;
  public readonly data: string | null;
  public readonly file: Blob | null;

  public constructor(key: string, label: string, path: string | null, data: string | null, file: Blob | null = null) {
    this.key = key;
    this.label = label;
    this.path = path;
    this.data = data;
    this.file = file;
  }
}
