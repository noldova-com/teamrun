/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../src/app/enums/dock-side";
import { SplitAxis } from "../../src/app/enums/split-axis";
import { LayoutMetrics } from "../../src/app/models/layout/layout-metrics";

export class LayoutMetricsFixture {
  public static readonly standard: LayoutMetrics = new LayoutMetrics(0.25, 0.25, 10, 2.75, 13.75,
    { [SplitAxis.Horizontal]: 10, [SplitAxis.Vertical]: 6.25 }, { [DockSide.Left]: 26, [DockSide.Right]: 25, [DockSide.Bottom]: 16.25 });
}
