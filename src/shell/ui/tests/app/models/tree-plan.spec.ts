/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { TreeNode } from "../../../src/app/models/tree.node";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MovableTreeHostComponent } from "../../fixtures/movable-tree-host.component";
import { TreeHarness } from "../../fixtures/tree-harness.fixture";

describe("TreePlan", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let tree: TreeHarness;

  afterEach(() => AppearanceFixture.reset());

  it("steps a row among its siblings, into the branch before it as its last child, and out after its parent, and not where that cannot be", async () => {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    tree = new TreeHarness(fixture);
    fixture.componentInstance.nodes.set([
      TreeNode.open("project", "Project", "folder", [TreeNode.open("source", "Source", "folder", [new TreeNode("app", "App"), new TreeNode("styles", "Styles")]), new TreeNode("readme", "Readme")]),
      new TreeNode("notes", "Notes"),
      new TreeNode("trash", "Trash")
    ]);
    await fixture.whenStable();

    tree.press(tree.row("Styles"), "ArrowUp");
    tree.press(tree.row("App"), "ArrowDown");
    tree.press(tree.row("Source"), "ArrowLeft");
    tree.press(tree.row("App"), "ArrowLeft");
    tree.press(tree.row("Trash"), "ArrowRight");
    tree.press(tree.row("Source"), "ArrowRight");
    tree.press(tree.row("Notes"), "ArrowRight");

    expect(tree.moves).toEqual([["styles", "source", 0], ["app", "source", 1], ["source", null, 1], ["app", "project", 1], ["notes", "project", 2]]);
  });

  it("drops a row at the start of an open branch, counting from its first child, and refuses a row already there", async () => {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    tree = new TreeHarness(fixture);
    await fixture.whenStable();

    await tree.dragAsync("Notes", "Project", 0.9);
    const first = tree.moves;
    await tree.dragAsync("Source", "Project", 0.9);

    expect([first, tree.moves.length]).toEqual([[["notes", "project", 0]], 1]);
  });
});
