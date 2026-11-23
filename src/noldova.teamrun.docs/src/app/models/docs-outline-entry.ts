/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DocsOutlineEntry {
  public readonly heading: HTMLElement;
  public readonly id: string;
  public readonly title: string;
  public readonly depth: number;

  public constructor(heading: HTMLElement, id: string, title: string, depth: number) {
    this.heading = heading;
    this.id = id;
    this.title = title;
    this.depth = depth;
  }
}
