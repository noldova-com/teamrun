/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FileSnapshot {
  public static readonly missing: FileSnapshot = new FileSnapshot(false, false, 0, 0, null);

  public readonly exists: boolean;
  public readonly isFile: boolean;
  public readonly size: number;
  public readonly modified: number;
  public readonly text: string | null;

  public constructor(exists: boolean, isFile: boolean, size: number, modified: number, text: string | null) {
    this.exists = exists;
    this.isFile = isFile;
    this.size = size;
    this.modified = modified;
    this.text = text;
  }

  public isSameAs(other: FileSnapshot): boolean {
    return this.exists === other.exists && this.isFile === other.isFile && this.size === other.size && this.modified === other.modified
      && (this.text === other.text || Object.isNull(this.text) || Object.isNull(other.text));
  }
}
