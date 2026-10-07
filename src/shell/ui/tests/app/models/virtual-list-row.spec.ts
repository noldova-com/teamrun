/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListRow } from "../../../src/app/models/virtual-list-row";

describe("VirtualListRow", () => {
  it("tracks a loaded row by its key and gives its template the item, place and height", () => {
    const row = new VirtualListRow(4, "item 4", "key 4", null, 30, true, false);

    expect([row.index, row.track, row.top, row.height, row.isStop, row.isSelected, row.context]).toEqual([4, "key 4", null, 30, true, false, { $implicit: "item 4", index: 4, height: 30 }]);
  });

  it("tracks a row not yet loaded by its place and gives its template nothing", () => {
    const row = new VirtualListRow<string>(7, undefined, undefined, 210, 30, false, false);

    expect([row.track, row.top, row.context]).toEqual([7, 210, null]);
  });
});
