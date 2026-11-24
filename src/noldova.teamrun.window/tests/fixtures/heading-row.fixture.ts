/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HeadingRow {
  public readonly title: string;
  public readonly row: HTMLElement;

  public constructor(title: string, row: HTMLElement) {
    this.title = title;
    this.row = row;
  }
}
