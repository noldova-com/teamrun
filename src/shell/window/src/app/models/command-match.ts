/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandMatch {
  public readonly titleMatches: readonly number[];
  public readonly categoryMatches: readonly number[];

  public constructor(titleMatches: readonly number[], categoryMatches: readonly number[]) {
    this.titleMatches = [...titleMatches];
    this.categoryMatches = [...categoryMatches];
  }
}
