/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Bounds } from "../../../../src/app/models/layout/bounds";
import { GroupDropTarget } from "../../../../src/app/models/layout/group-drop-target";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("GroupDropTarget", () => {
  const registry = LayoutFixture.createRegistry();
  const layout = Layout.createDefault(registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  const geometry = new LayoutGeometry(120, 60, layout, registry);

  it("moves the tab to the end of the group and previews the whole group", () => {
    expect(new GroupDropTarget(0).place(layout, LayoutFixture.plan).documents.tabs).toEqual([LayoutFixture.todo, LayoutFixture.plan]);
    expect(new GroupDropTarget(9).place(layout, LayoutFixture.plan)).toBe(layout);
    expect(new GroupDropTarget(0).preview(geometry)).toEqual(new Bounds(26.5, 0, 68, 59.75));
    expect(new GroupDropTarget(9).preview(geometry)).toBeNull();
  });

  it("equals a target for the same group only", () => {
    expect(new GroupDropTarget(1).equals(new GroupDropTarget(1))).toBe(true);
    expect(new GroupDropTarget(1).equals(new GroupDropTarget(2))).toBe(false);
    expect(new GroupDropTarget(1).equals(new TabDropTarget(1, 0))).toBe(false);
    expect(new GroupDropTarget(1).equals(null)).toBe(false);
  });
});
