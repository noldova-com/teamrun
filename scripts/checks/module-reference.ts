/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ModuleReference {
  public readonly specifier: string;
  public readonly names: readonly string[] | null;
  public readonly line: number;
  public readonly isLazy: boolean;

  public constructor(specifier: string, names: readonly string[] | null, line: number, isLazy: boolean = false) {
    this.specifier = specifier;
    this.names = names;
    this.line = line;
    this.isLazy = isLazy;
  }
}
