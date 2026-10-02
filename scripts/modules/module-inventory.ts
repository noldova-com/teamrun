/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ModuleDeclaration from "./module-declaration.ts";

export default class ModuleInventory {
  public readonly declarations: readonly ModuleDeclaration[];
  public readonly problems: readonly string[];

  public constructor(declarations: readonly ModuleDeclaration[], problems: readonly string[]) {
    this.declarations = declarations;
    this.problems = problems;
  }
}
