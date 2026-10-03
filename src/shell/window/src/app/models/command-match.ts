/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MatchKind } from "../enums/match-kind";

export class CommandMatch {
  public readonly kind: MatchKind;
  public readonly matches: readonly number[];

  public constructor(kind: MatchKind, matches: readonly number[]) {
    this.kind = kind;
    this.matches = [...matches];
  }
}
