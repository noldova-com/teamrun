/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HeadingRowText {
  public readonly title: string;
  public readonly row: HTMLElement;
  public readonly text: HTMLElement;

  public constructor(title: string, row: HTMLElement, text: HTMLElement) {
    this.title = title;
    this.row = row;
    this.text = text;
  }
}
