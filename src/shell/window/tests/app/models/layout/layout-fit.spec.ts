/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { Dock } from "../../../../src/app/models/layout/dock";
import { LayoutFit } from "../../../../src/app/models/layout/layout-fit";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("LayoutFit", () => {
  const left = new Dock(DockSide.Left, new TabGroup(1, [LayoutFixture.files], LayoutFixture.files), null, false);
  const right = new Dock(DockSide.Right, new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes), null, false);
  const across = (width: number, docks: readonly Dock[] = [left, right]): LayoutFit => LayoutFit.of(width, 0.5, docks, 13.75);
  const tracks = (fit: LayoutFit): readonly number[] => [fit.track(DockSide.Left), fit.track(DockSide.Right), fit.middle];

  it("gives each dock its preferred size and the middle the rest when everything fits", () => {
    const fit = across(100);

    expect(tracks(fit)).toEqual([26.25, 25.25, 48]);
    expect([fit.isCollapsed(DockSide.Left), fit.isCollapsed(DockSide.Right)]).toEqual([false, false]);
    expect(fit.maximumSize(DockSide.Left)).toBe(60.25);
    expect(fit.track(DockSide.Bottom)).toBe(0);
  });

  it("shrinks the left dock first and then the right to keep the document's minimum", () => {
    expect(tracks(across(60))).toEqual([20.5, 25.25, 13.75]);
    expect(across(60).maximumSize(DockSide.Left)).toBe(20.25);
    expect(tracks(across(40))).toEqual([10.25, 15.5, 13.75]);
  });

  it("collapses the left dock first and then the right when their minimums do not fit", () => {
    const fit = across(30);

    expect(tracks(fit)).toEqual([3, 12.75, 13.75]);
    expect([fit.isCollapsed(DockSide.Left), fit.isCollapsed(DockSide.Right)]).toEqual([true, false]);
    expect(tracks(across(15))).toEqual([3, 3, 8.5]);
    expect(across(15).isCollapsed(DockSide.Right)).toBe(true);
    expect(tracks(across(2))).toEqual([3, 3, 0]);
  });

  it("keeps a collapsed dock's strip and gives an empty dock no room", () => {
    const fit = across(60, [left.withCollapsed(true), Dock.createEmpty(DockSide.Right)]);

    expect(tracks(fit)).toEqual([3, 0, 56.5]);
    expect(fit.isCollapsed(DockSide.Left)).toBe(false);
  });

  it("keeps a saved size, raised to what the dock's groups need", () => {
    expect(across(100, [left.withSize(12), right.withSize(40)]).track(DockSide.Right)).toBe(40.25);
    expect(across(100, [left.withSize(12)]).track(DockSide.Left)).toBe(12.25);
  });
});
