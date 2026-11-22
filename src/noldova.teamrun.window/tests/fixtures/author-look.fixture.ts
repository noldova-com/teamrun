/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AuthorLook {
  public readonly author: string;
  public readonly letter: string;
  public readonly className: string;
  public readonly fill: string;

  public constructor(author: string, letter: string, className: string, fill: string) {
    this.author = author;
    this.letter = letter;
    this.className = className;
    this.fill = fill;
  }
}
