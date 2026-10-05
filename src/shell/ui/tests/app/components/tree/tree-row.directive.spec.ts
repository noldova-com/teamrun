/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { MovableTreeHostComponent } from "../../../fixtures/movable-tree-host.component";
import { TreeHarness } from "../../../fixtures/tree-harness.fixture";

describe("TreeRowDirective", () => {
  afterEach(() => AppearanceFixture.reset());

  it("marks every row of the tree, so the tree finds each row's node with its element, including the rows a branch opens", async () => {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    const fixture = TestBed.createComponent(MovableTreeHostComponent);
    const tree = new TreeHarness(fixture);
    await fixture.whenStable();

    const closed = tree.items().map(t => t.hasAttribute("trtreerow"));
    tree.row("Source").click();
    await fixture.whenStable();
    const opened = tree.items().map(t => t.hasAttribute("trtreerow"));
    tree.row("Notes").focus();
    tree.press(tree.row("Notes"), "ArrowUp");

    expect([closed.length, closed.every(Boolean), opened.length, opened.every(Boolean)]).toEqual([5, true, 6, true]);
    expect(tree.moves).toEqual([["notes", null, 0]]);
  });
});
