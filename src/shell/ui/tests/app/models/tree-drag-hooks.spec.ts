/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MovableTreeHostComponent } from "../../fixtures/movable-tree-host.component";
import { TreeHarness } from "../../fixtures/tree-harness.fixture";

describe("TreeDragHooks", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let tree: TreeHarness;

  afterEach(() => AppearanceFixture.reset());

  it("lets a drag find the tree's rows and its row gap, open a closed branch and report the move", async () => {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    tree = new TreeHarness(fixture);
    fixture.componentInstance.applying.set(true);
    await fixture.whenStable();

    await tree.dragAsync("Notes", "Source", 0.5);

    expect(tree.moves).toEqual([["notes", "source", 1]]);
    expect(tree.row("Source").getAttribute("aria-expanded")).toBe("true");
  });
});
