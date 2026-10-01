/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type SourceLiteral from "./source-literal.ts";

export default class ScannedSource {
  public readonly imports: readonly SourceLiteral[];
  public readonly selectors: readonly SourceLiteral[];
  public readonly texts: readonly SourceLiteral[];

  public constructor(imports: readonly SourceLiteral[], selectors: readonly SourceLiteral[], texts: readonly SourceLiteral[]) {
    this.imports = imports;
    this.selectors = selectors;
    this.texts = texts;
  }
}
