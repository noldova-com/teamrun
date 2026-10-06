/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { Dock } from "../../../../src/app/models/layout/dock";
import { DockYield } from "../../../../src/app/models/layout/dock-yield";
import { LayoutFit } from "../../../../src/app/models/layout/layout-fit";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutMetricsFixture } from "../../../fixtures/layout-metrics.fixture";

describe("LayoutFit", () => {
  const left = new Dock(DockSide.Left, new TabGroup(1, [LayoutFixture.files], LayoutFixture.files), null, false);
  const right = new Dock(DockSide.Right, new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes), null, false);
  const across = (width: number, docks: readonly Dock[] = [left, right]): LayoutFit => LayoutFit.of(width, 0.5, docks, 13.75, LayoutMetricsFixture.standard);
  const tracks = (fit: LayoutFit): readonly number[] => [fit.track(DockSide.Left), fit.track(DockSide.Right), fit.middle];

  it("gives each dock its preferred size and the middle the rest when everything fits", () => {
    const fit = across(100);

    expect(tracks(fit)).toEqual([26.25, 25.25, 48]);
    expect([fit.isCollapsed(DockSide.Left), fit.isCollapsed(DockSide.Right)]).toEqual([false, false]);
    expect(fit.maximumSize(DockSide.Left)).toBe(60.25);
    expect(fit.track(DockSide.Bottom)).toBe(0);
  });

  it("shrinks the right dock first and then the left to keep the document's minimum", () => {
    expect(tracks(across(60))).toEqual([26.25, 19.5, 13.75]);
    expect(across(60).maximumSize(DockSide.Left)).toBe(26);
    expect(tracks(across(40))).toEqual([15.5, 10.25, 13.75]);
  });

  it("collapses the right dock first and then the left when their minimums do not fit", () => {
    const fit = across(30);

    expect(tracks(fit)).toEqual([12.75, 3, 13.75]);
    expect([fit.isCollapsed(DockSide.Left), fit.isCollapsed(DockSide.Right)]).toEqual([false, true]);
    expect(tracks(across(15))).toEqual([3, 3, 8.5]);
    expect([...across(15).collapsed]).toEqual([DockSide.Right, DockSide.Left]);
    expect(tracks(across(2))).toEqual([3, 3, 0]);
  });

  it("keeps the middle at its preferred size by shrinking the docks to their minimums before collapsing either", () => {
    const yielding = (width: number): LayoutFit => LayoutFit.of(width, 0.5, [left, right], 13.75, LayoutMetricsFixture.standard, new Set(), new DockYield(30, new Set(), null));

    expect(tracks(yielding(100))).toEqual([26.25, 25.25, 48]);
    expect(yielding(100).maximumSize(DockSide.Left)).toBe(60.25);
    expect(tracks(yielding(70))).toEqual([26.25, 13.25, 30]);
    expect(tracks(yielding(52))).toEqual([11.25, 10.25, 30]);
    expect(tracks(yielding(51))).toEqual([10.25, 10.25, 30]);
    expect(tracks(yielding(50))).toEqual([16.5, 3, 30]);
    expect(yielding(50).isKeeping).toBe(false);
    expect(tracks(yielding(40))).toEqual([3, 3, 33.5]);
  });

  it("reopens a dock it closed only once the middle keeps its preferred size and the reopen margin", () => {
    const after = (width: number, closed: readonly DockSide[]): LayoutFit => LayoutFit.of(width, 0.5, [left, right], 13.75, LayoutMetricsFixture.standard, new Set(), new DockYield(30, new Set(closed), null));

    expect(tracks(after(52, [DockSide.Right]))).toEqual([18.5, 3, 30]);
    expect(tracks(after(53, [DockSide.Right]))).toEqual([12.25, 10.25, 30]);
    expect(tracks(after(45, [DockSide.Left, DockSide.Right]))).toEqual([3, 3, 38.5]);
    expect(tracks(after(46, [DockSide.Left, DockSide.Right]))).toEqual([12.5, 3, 30]);
  });

  it("keeps a dock the person opened while the others collapse, down to the document's own minimum", () => {
    const kept = (width: number): LayoutFit => LayoutFit.of(width, 0.5, [left, right], 13.75, LayoutMetricsFixture.standard, new Set(), new DockYield(30, new Set([DockSide.Left, DockSide.Right]), DockSide.Left));

    expect(tracks(kept(40))).toEqual([10.25, 3, 26.25]);
    expect(kept(40).isKeeping).toBe(true);
    expect(tracks(kept(25))).toEqual([3, 3, 18.5]);
    expect(kept(25).isKeeping).toBe(true);
  });

  it("stops keeping a dock once it would stay open by the margin anyway, also beside a dock the person hid", () => {
    const kept = (width: number, docks: readonly Dock[]): LayoutFit => LayoutFit.of(width, 0.5, docks, 13.75, LayoutMetricsFixture.standard, new Set(), new DockYield(30, new Set(), DockSide.Left));
    const hidden = [left, right.withCollapsed(true)];

    expect(tracks(kept(40, hidden))).toEqual([10.25, 3, 26.25]);
    expect(kept(40, hidden).isKeeping).toBe(true);
    expect(kept(45, hidden).isKeeping).toBe(true);
    expect(kept(46, hidden).isKeeping).toBe(false);
    expect(tracks(kept(46, hidden))).toEqual([12.5, 3, 30]);
    expect(kept(52, [left, right]).isKeeping).toBe(true);
    expect(kept(53, [left, right]).isKeeping).toBe(false);
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
