/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DefaultTheme, ThemeMode, Typography } from "@noldova/teamrun-shell-ui";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { LayoutMetrics } from "../../../../src/app/models/layout/layout-metrics";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { FixtureTheme } from "../../../../../ui/tests/fixtures/fixture-theme";

describe("LayoutMetrics", () => {
  let probe: HTMLElement;

  beforeEach(() => {
    probe = document.createElement("div");
    document.body.append(probe);
  });

  afterEach(() => {
    probe.remove();
    AppearanceFixture.reset();
  });

  function valuesOf(metrics: LayoutMetrics): readonly number[] {
    const values = [metrics.gap, metrics.margin, metrics.dockMinimum, metrics.strip, metrics.documentMinimum, metrics.groupMinimums[SplitAxis.Horizontal],
      metrics.groupMinimums[SplitAxis.Vertical], metrics.dockSizes[DockSide.Left], metrics.dockSizes[DockSide.Right], metrics.dockSizes[DockSide.Bottom]];
    return values.map(t => Math.round(t * 64) / 64);
  }

  function measure(panelSize: number): readonly number[] {
    return valuesOf(LayoutMetrics.measure(probe, new Typography(panelSize).rootSize));
  }

  it("holds the gap, the margin, the minimums, the strip and the dock sizes, and measures nothing by default", () => {
    const metrics = new LayoutMetrics(1, 2, 3, 4, 5, { [SplitAxis.Horizontal]: 6, [SplitAxis.Vertical]: 7 }, { [DockSide.Left]: 8, [DockSide.Right]: 9, [DockSide.Bottom]: 10 });

    expect(valuesOf(metrics)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(valuesOf(LayoutMetrics.none)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("measures the painted looks in rem, the default theme's and another theme's, at every panel size", () => {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, 13);
    const standard = measure(13);
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark, 18);
    const larger = measure(18);
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light, 13);
    const fixture = measure(13);

    expect(standard).toEqual([0.25, 0.25, 10, 2.75, 13.75, 10, 6.25, 26, 25, 16.25]);
    expect(larger).toEqual(standard);
    expect(fixture).toEqual([0.375, 0.375, 8, 3, 11, 8.5, 5, 20, 18, 12]);
  });
});
