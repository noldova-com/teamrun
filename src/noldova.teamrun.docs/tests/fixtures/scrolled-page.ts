/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ScrolledPage {
  public readonly host: HTMLElement;
  public readonly header: HTMLElement;
  public readonly headerHeight: number;

  public constructor(host: HTMLElement, header: HTMLElement, headerHeight: number) {
    this.host = host;
    this.header = header;
    this.headerHeight = headerHeight;
  }
}
