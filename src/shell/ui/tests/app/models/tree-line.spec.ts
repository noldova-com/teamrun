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

describe("TreeLine", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let tree: TreeHarness;

  async function renderAsync(): Promise<void> {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    tree = new TreeHarness(fixture);
    await fixture.whenStable();
  }

  afterEach(() => {
    document.documentElement.dir = String.empty;
    AppearanceFixture.reset();
  });

  it("puts the drop line in the middle of the gap under the row, from the row's text inset and as wide as the row inside its insets", async () => {
    await renderAsync();

    await tree.dragAsync("Notes", "Trash", 0.9, false);
    const drawn = (tree.line as HTMLElement).getBoundingClientRect();
    const trash = tree.row("Trash").getBoundingClientRect();
    const style = getComputedStyle(tree.row("Trash"));
    const inset = Number.parseFloat(style.paddingInlineStart);

    expect(drawn.top + drawn.height / 2).toBeCloseTo(trash.bottom + tree.gap / 2, 0);
    expect(drawn.left).toBeCloseTo(trash.left + inset, 0);
    expect(drawn.width).toBeCloseTo(trash.width - inset - Number.parseFloat(style.paddingInlineEnd), 0);
  });

  it("puts the line for the top of a row above it, in the middle of the gap", async () => {
    await renderAsync();

    await tree.dragAsync("Trash", "Notes", 0.1, false);
    const drawn = (tree.line as HTMLElement).getBoundingClientRect();

    expect(drawn.top + drawn.height / 2).toBeCloseTo(tree.row("Notes").getBoundingClientRect().top - tree.gap / 2, 0);
  });

  it("puts the line for the bottom of an open branch at its first child's indent", async () => {
    await renderAsync();

    await tree.dragAsync("Notes", "Project", 0.9, false);
    const drawn = (tree.line as HTMLElement).getBoundingClientRect();
    const source = tree.row("Source").getBoundingClientRect();

    expect(drawn.top + drawn.height / 2).toBeCloseTo(tree.row("Project").getBoundingClientRect().bottom + tree.gap / 2, 0);
    expect(drawn.left).toBeCloseTo(source.left + Number.parseFloat(getComputedStyle(tree.row("Source")).paddingInlineStart), 0);
  });

  it("starts the line at the row's inline start in a right-to-left layout", async () => {
    await renderAsync();
    tree.root.dir = "rtl";

    await tree.dragAsync("Notes", "Trash", 0.9, false);
    const inline = (tree.line as HTMLElement).getBoundingClientRect();

    expect(inline.right).toBeCloseTo(tree.row("Trash").getBoundingClientRect().right - Number.parseFloat(getComputedStyle(tree.row("Trash")).paddingInlineStart), 0);
  });
});
