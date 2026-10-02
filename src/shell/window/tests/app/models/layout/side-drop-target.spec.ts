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

describe("SideDropTarget", () => {
  const registry = LayoutFixture.createRegistry();
  const layout = Layout.createDefault(registry);

  it("docks the view along its side and previews the area it takes", () => {
    const target = new SideDropTarget(DockSide.Bottom);

    expect(target.place(layout, LayoutFixture.files).dock(DockSide.Bottom).root?.groups.map(t => t.tabs)).toEqual([[LayoutFixture.files]]);
    expect(target.preview(new LayoutGeometry(120, 60, layout, registry))).toEqual(new Bounds(26.5, 43.5, 68, 16.25));
  });

  it("equals a target for the same side only", () => {
    expect(new SideDropTarget(DockSide.Left).equals(new SideDropTarget(DockSide.Left))).toBe(true);
    expect(new SideDropTarget(DockSide.Left).equals(new SideDropTarget(DockSide.Right))).toBe(false);
    expect(new SideDropTarget(DockSide.Left).equals(new TabDropTarget(0, 0))).toBe(false);
    expect(new SideDropTarget(DockSide.Left).equals(null)).toBe(false);
  });
});
