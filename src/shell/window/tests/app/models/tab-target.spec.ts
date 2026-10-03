/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentGroup } from "../../../src/app/models/layout/document-group";
import { TabGroup } from "../../../src/app/models/layout/tab-group";
import { TabTarget } from "../../../src/app/models/tab-target";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("TabTarget", () => {
  const { files, search, changes, plan } = LayoutFixture;
  const group = new TabGroup(3, [files, search, changes], files);

  it("knows a tab's place in its group", () => {
    const first = new TabTarget(files, group);
    const middle = new TabTarget(search, group);
    const last = new TabTarget(changes, group);

    expect([first.tab, first.group]).toEqual([files, group]);
    expect([first.index, middle.index, last.index]).toEqual([0, 1, 2]);
    expect([first.isFirst, middle.isFirst, last.isLast, middle.isLast]).toEqual([true, false, true, false]);
  });

  it("can split a movable tab off a group it does not leave empty, and always off the documents", () => {
    expect(new TabTarget(files, group).canSplit).toBe(true);
    expect(new TabTarget(files, new TabGroup(3, [files], files)).canSplit).toBe(false);
    expect(new TabTarget(plan, new DocumentGroup([plan], plan)).canSplit).toBe(false);
    expect(new TabTarget(files, new DocumentGroup([files], files)).canSplit).toBe(true);
  });
});
