/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CiLabel {
  public readonly text: string;
  public readonly look: string;

  public constructor(text: string, look: string) {
    this.text = text;
    this.look = look;
  }
}
