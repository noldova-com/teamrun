/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListSource } from "../../models/virtual-list-source";

export class GalleryVirtualListSource extends VirtualListSource<string> {
  private readonly read: (start: number, end: number) => Promise<readonly string[]>;

  public constructor(length: number, estimate: number, read: (start: number, end: number) => Promise<readonly string[]>) {
    super(length, estimate);
    this.read = read;
  }

  public readAsync(start: number, end: number): Promise<readonly string[]> {
    return this.read(start, end);
  }

  public keyOf(item: string): string {
    return item;
  }
}
