/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockStripIcon } from "../../../../src/app/models/layout/dock-strip-icon";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("DockStripIcon", () => {
  it("holds a docked tab, its group and where a drop lands before and after it", () => {
    const group = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
    const before = new TabDropTarget(1, 0);
    const after = new TabDropTarget(1, 1);
    const icon = new DockStripIcon(group, LayoutFixture.files, before, after);

    expect([icon.group, icon.tab, icon.before, icon.after]).toEqual([group, LayoutFixture.files, before, after]);
  });
});
