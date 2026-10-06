/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PinnedPackage {
  public readonly url: string;
  public readonly sha512: string;
  public readonly folder: string;

  public constructor(url: string, sha512: string, folder: string) {
    this.url = url;
    this.sha512 = sha512;
    this.folder = folder;
  }
}
