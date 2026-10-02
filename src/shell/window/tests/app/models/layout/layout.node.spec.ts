/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("LayoutNode", () => {
  const files = new TabGroup(1, [LayoutFixture.files], LayoutFixture.files);
  const changes = new TabGroup(2, [LayoutFixture.changes], LayoutFixture.changes);

  it("has an id that is an integer of zero or more", () => {
    expect(LayoutFixture.createSplit(0, SplitAxis.Vertical, [files, changes], [1, 1]).id).toBe(0);
    expect(() => LayoutFixture.createSplit(-1, SplitAxis.Vertical, [files, changes], [1, 1])).toThrow(ArgumentOutOfRangeException);
    expect(() => new TabGroup(Number.NaN, [LayoutFixture.files], LayoutFixture.files)).toThrow(ArgumentOutOfRangeException);
  });
});
