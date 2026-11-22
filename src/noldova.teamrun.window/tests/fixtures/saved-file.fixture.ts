/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SavedFile {
  public readonly name: string;
  public readonly bytes: Uint8Array;

  public constructor(name: string, bytes: Uint8Array) {
    this.name = name;
    this.bytes = bytes;
  }
}
