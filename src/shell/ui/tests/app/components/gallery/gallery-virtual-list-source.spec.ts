/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryVirtualListSource } from "../../../../src/app/components/gallery/gallery-virtual-list-source";

describe("GalleryVirtualListSource", () => {
  it("answers each read through its function and keys each item by itself", async () => {
    const source = new GalleryVirtualListSource(5, 30, (start, end) => Promise.resolve([`${start} to ${end}`]));

    expect([source.length(), source.estimate, source.keyOf("Item 1"), await source.readAsync(1, 3)]).toEqual([5, 30, "Item 1", ["1 to 3"]]);
  });
});
