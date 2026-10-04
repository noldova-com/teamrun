/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class BuildVariant {
  public static readonly REGULAR: BuildVariant = new BuildVariant(false, []);

  public readonly isTest: boolean;
  public readonly excluded: readonly string[];
  public readonly isPackaged: boolean;

  public constructor(isTest: boolean, excluded: readonly string[], isPackaged: boolean = false) {
    this.isTest = isTest;
    this.excluded = excluded;
    this.isPackaged = isPackaged;
  }
}
