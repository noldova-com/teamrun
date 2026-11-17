/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class InstructionFile {
  public readonly path: string;
  public readonly content: string;

  public constructor(path: string, content: string) {
    this.path = path;
    this.content = content;
  }
}
