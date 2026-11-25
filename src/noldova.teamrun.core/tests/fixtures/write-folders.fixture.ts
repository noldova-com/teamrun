/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WriteFolders {
  public readonly root: string;
  public readonly outside: string;

  public constructor(root: string, outside: string) {
    this.root = root;
    this.outside = outside;
  }
}
