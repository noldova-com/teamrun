/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LostWake {
  public readonly text: string;
  public readonly end: string;

  public constructor(text: string, end: string) {
    this.text = text;
    this.end = end;
  }
}
