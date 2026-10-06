/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CodeTokenKind } from "../enums/code-token-kind";

export class CodeToken {
  public readonly start: number;
  public readonly end: number;
  public readonly text: string;
  public readonly kind: CodeTokenKind;

  public constructor(start: number, text: string, kind: CodeTokenKind) {
    this.start = start;
    this.end = start + text.length;
    this.text = text;
    this.kind = kind;
  }
}
