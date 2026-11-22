/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AvatarLook {
  public readonly letter: string;
  public readonly fill: string;
  public readonly letterColor: string;

  public constructor(letter: string, fill: string, letterColor: string) {
    this.letter = letter;
    this.fill = fill;
    this.letterColor = letterColor;
  }
}
