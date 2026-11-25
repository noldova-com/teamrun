/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandTargets {
  public readonly files: readonly string[];
  public readonly unnamedIn: readonly string[];

  public constructor(files: readonly string[], unnamedIn: readonly string[]) {
    this.files = files;
    this.unnamedIn = unnamedIn;
  }
}
