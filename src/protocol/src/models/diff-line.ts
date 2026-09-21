/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DiffLineKind } from "../enums/diff-line-kind.js";

export class DiffLine {
  public readonly kind: DiffLineKind;
  public readonly text: string;

  public constructor(kind: DiffLineKind, text: string) {
    this.kind = kind;
    this.text = text;
  }
}
