/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class EntryRun {
  public readonly exitCode: number;
  public readonly files: readonly string[];

  public constructor(exitCode: number, files: readonly string[]) {
    this.exitCode = exitCode;
    this.files = files;
  }
}
