/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TabGroup } from "../../../src/app/models/layout/tab-group";
import { TabTarget } from "../../../src/app/models/tab-target";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("TabTarget", () => {
  const { files, search, changes } = LayoutFixture;
  const group = new TabGroup(3, [files, search, changes], files);

  it("knows a tab's place in its group", () => {
    const first = new TabTarget(files, group, true);
    const middle = new TabTarget(search, group, true);
    const last = new TabTarget(changes, group, true);

    expect([first.tab, first.group]).toEqual([files, group]);
    expect([first.index, middle.index, last.index]).toEqual([0, 1, 2]);
    expect([first.isFirst, middle.isFirst, last.isLast, middle.isLast]).toEqual([true, false, true, false]);
  });

  it("says whether its tab can be split off its group", () => {
    expect(new TabTarget(files, group, true).canSplit).toBe(true);
    expect(new TabTarget(files, group, false).canSplit).toBe(false);
  });
});
