/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("GroupFrame", () => {
  it("keeps a group with its bounds and the dock it is in", () => {
    const group = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
    const frame = new GroupFrame(group, new Bounds(1, 2, 3, 4), DockSide.Bottom);

    expect([frame.group, frame.bounds, frame.side]).toEqual([group, new Bounds(1, 2, 3, 4), DockSide.Bottom]);
    expect(new GroupFrame(group, new Bounds(0, 0, 1, 1), null).side).toBeNull();
  });
});
