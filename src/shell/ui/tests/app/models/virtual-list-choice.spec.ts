/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListChoice } from "../../../src/app/models/virtual-list-choice";

describe("VirtualListChoice", () => {
  it("keeps the chosen row's position and its item", () => {
    const choice = new VirtualListChoice(4, "item 4");

    expect([choice.index, choice.item]).toEqual([4, "item 4"]);
  });
});
