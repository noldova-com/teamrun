/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { SideDropTarget } from "../../../../src/app/models/layout/side-drop-target";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("TabDropTarget", () => {
  const registry = LayoutFixture.createRegistry();
  const layout = Layout.createDefault(registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  const geometry = new LayoutGeometry(120, 60, layout, registry);

  it("rounds its index to a whole position of zero or more", () => {
    expect([new TabDropTarget(0, 1.6).index, new TabDropTarget(0, -3).index]).toEqual([2, 0]);
  });

  it("moves the tab into the group at its index and previews the group", () => {
    expect(new TabDropTarget(0, 0).place(layout, LayoutFixture.todo).documents.tabs).toEqual([LayoutFixture.todo, LayoutFixture.plan]);
    expect(new TabDropTarget(2, 0).place(layout, LayoutFixture.files).dock(DockSide.Left).root).toBeNull();
    expect(new TabDropTarget(1, 0).place(layout, LayoutFixture.plan)).toBe(layout);
    expect(new TabDropTarget(0, 0).preview(geometry)).toEqual(new Bounds(26.5, 0, 68, 59.75));
    expect(new TabDropTarget(9, 0).preview(geometry)).toBeNull();
  });

  it("equals a target for the same group and index only", () => {
    expect(new TabDropTarget(1, 2).equals(new TabDropTarget(1, 2))).toBe(true);
    expect(new TabDropTarget(1, 2).equals(new TabDropTarget(1, 3))).toBe(false);
    expect(new TabDropTarget(1, 2).equals(new TabDropTarget(2, 2))).toBe(false);
    expect(new TabDropTarget(1, 2).equals(new SideDropTarget(DockSide.Left))).toBe(false);
  });
});
