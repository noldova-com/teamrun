/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WrittenImageFolder {
  public readonly path: string;
  public readonly isStored: boolean;

  public constructor(path: string, isStored: boolean) {
    this.path = path;
    this.isStored = isStored;
  }
}
