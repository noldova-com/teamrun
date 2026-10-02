/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Bounds } from "../../../../src/app/models/layout/bounds";
import { SplitHandle } from "../../../../src/app/models/layout/split-handle";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("SplitHandle", () => {
  const split = LayoutFixture.createSplit(4, SplitAxis.Horizontal, [
    new TabGroup(1, [LayoutFixture.files], LayoutFixture.files),
    new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes),
    new TabGroup(3, [LayoutFixture.search], LayoutFixture.search)
  ], [1, 1, 2]);
  const handle = new SplitHandle(split, 1, new Bounds(30, 0, 0.25, 20), 20, 10, 40);
  const weightsFor = (length: number): readonly number[] => LayoutFixture.weightsOf(handle.resize(length));

  it("keeps the split, the gap it sits in and the length before it", () => {
    expect([handle.split, handle.index, handle.bounds, handle.leadingLength]).toEqual([split, 1, new Bounds(30, 0, 0.25, 20), 20]);
  });

  it("moves weight between the two parts beside it for a new leading length", () => {
    expect(weightsFor(20)).toEqual([0.25, 0.25, 0.5]);
    expect(weightsFor(30)).toEqual([0.25, 0.5, 0.25]);
    expect(weightsFor(0)).toEqual([0.25, 0, 0.75]);
    expect(weightsFor(100)).toEqual([0.25, 0.75, 0]);
    expect([handle.resize(30).id, handle.resize(30).axis, handle.resize(30).groups]).toEqual([4, SplitAxis.Horizontal, split.groups]);
  });

  it("keeps the split when there is no space beyond the minimums", () => {
    expect(new SplitHandle(split, 0, new Bounds(10, 0, 0.25, 20), 10, 10, 0).resize(15)).toBe(split);
  });
});
