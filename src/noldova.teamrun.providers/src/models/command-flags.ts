/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandFlags {
  public readonly letters: string;
  public readonly valueLetters: string;
  public readonly patternLetter: string | null;
  public readonly names: readonly string[];
  public readonly valueNames: readonly string[];
  public readonly patternName: string | null;

  public constructor(letters: string, valueLetters: string, patternLetter: string | null, names: readonly string[], valueNames: readonly string[],
    patternName: string | null) {
    this.letters = letters;
    this.valueLetters = valueLetters;
    this.patternLetter = patternLetter;
    this.names = names;
    this.valueNames = valueNames;
    this.patternName = patternName;
  }
}
