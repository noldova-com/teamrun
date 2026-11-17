/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ReleaseFile {
  public readonly url: string;
  public readonly sha256: string | null;
  public readonly bytes: number | null;

  public constructor(url: string, sha256: string | null, bytes: number | null) {
    this.url = url;
    this.sha256 = sha256;
    this.bytes = bytes;
  }
}
