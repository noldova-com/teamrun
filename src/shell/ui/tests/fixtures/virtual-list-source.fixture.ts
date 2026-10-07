/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { VirtualListSource } from "../../src/app/models/virtual-list-source";
import { VirtualListReadFixture } from "./virtual-list-read.fixture";

export class VirtualListSourceFixture extends VirtualListSource<string> {
  public readonly reads: VirtualListReadFixture[] = [];

  public readAsync(start: number, end: number, abort: AbortSignal): Promise<readonly string[]> {
    const read = new VirtualListReadFixture(start, end, abort);
    this.reads.push(read);
    return read.promise;
  }

  public keyOf(item: string): string {
    return item;
  }

  public readAt(index: number): VirtualListReadFixture {
    const read = this.reads[index];
    if (Object.isUndefined(read))
      throw new Error(`The source has no read ${index}.`);
    return read;
  }

  public describeReads(): string[] {
    return this.reads.map(t => `${t.start}-${t.end}${t.abort.aborted ? " aborted" : ""}`);
  }
}
