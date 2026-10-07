/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListPosition } from "../../../src/app/models/virtual-list-position";

describe("VirtualListPosition", () => {
  it("keeps a row's place, its key and the distance into it", () => {
    const position = new VirtualListPosition(40, "message 40", 12);

    expect([position.index, position.key, position.distance]).toEqual([40, "message 40", 12]);
  });
});
