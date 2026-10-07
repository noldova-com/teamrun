/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListPageRead } from "../../../src/app/models/virtual-list-page-read";

describe("VirtualListPageRead", () => {
  it("keeps the positions it reads, the last update before it started and a controller of its own that can abort it", () => {
    const read = new VirtualListPageRead(50, 100, 7);
    const other = new VirtualListPageRead(0, 50, 0);
    read.controller.abort();

    expect([read.start, read.end, read.lastUpdate, read.controller.signal.aborted, other.controller.signal.aborted]).toEqual([50, 100, 7, true, false]);
  });
});
