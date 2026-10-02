/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SplitPart } from "../../../../src/app/models/layout/split-part";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("SplitPart", () => {
  it("keeps a node with its weight", () => {
    const group = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
    const part = new SplitPart(group, 0.4);

    expect([part.node, part.weight]).toEqual([group, 0.4]);
  });
});
