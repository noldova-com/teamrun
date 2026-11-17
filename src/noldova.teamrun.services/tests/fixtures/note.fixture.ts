/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Note {
  public readonly id: string;
  public readonly text: string;

  public constructor(id: string, text: string) {
    this.id = id;
    this.text = text;
  }
}
