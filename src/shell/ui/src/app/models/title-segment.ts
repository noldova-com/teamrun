/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TitleSegment {
  public readonly text: string;
  public readonly isMatch: boolean;

  public constructor(text: string, isMatch: boolean) {
    this.text = text;
    this.isMatch = isMatch;
  }
}
