/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexShim {
  public readonly file: string;
  public readonly script: string;

  public constructor(file: string, script: string) {
    this.file = file;
    this.script = script;
  }
}
