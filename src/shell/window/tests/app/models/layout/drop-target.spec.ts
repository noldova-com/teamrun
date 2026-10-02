/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import type { DropTarget } from "../../../../src/app/models/layout/drop-target";
import { Layout } from "../../../../src/app/models/layout/layout";
import { SideDropTarget } from "../../../../src/app/models/layout/side-drop-target";
import { SplitDropTarget } from "../../../../src/app/models/layout/split-drop-target";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("DropTarget", () => {
  const layout = Layout.createDefault(LayoutFixture.createRegistry()).openDocument(LayoutFixture.plan);
  const targets: readonly DropTarget[] = [new SideDropTarget(DockSide.Left), new SplitDropTarget(0, PanelEdge.Left), new TabDropTarget(1, 0)];

  it("never places a document outside the documents group", () => {
    expect(targets.map(t => t.place(layout, LayoutFixture.plan))).toEqual([layout, layout, layout]);
  });
});
