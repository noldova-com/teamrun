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

describe("TreeGhost", () => {
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

  it("shows the dragged row beside the pointer, centred on it, and no wider than the row", async () => {
    await renderAsync();

    await tree.dragAsync("Notes", "Trash", 0.9, false);
    const ghost = tree.ghost as HTMLElement;
    const box = ghost.getBoundingClientRect();

    expect(ghost.textContent).toContain("Notes");
    expect(box.left).toBeCloseTo(tree.root.getBoundingClientRect().left + 24 + 12, 0);
    expect(box.top + box.height / 2).toBeCloseTo(tree.yAt("Trash", 0.9), 0);
    expect(box.width).toBeLessThanOrEqual(tree.row("Notes").getBoundingClientRect().width);
  });

  it("goes to the pointer's other side in a right-to-left layout", async () => {
    await renderAsync();
    tree.root.dir = "rtl";

    await tree.dragAsync("Notes", "Trash", 0.9, false);
    const ghost = tree.ghost as HTMLElement;

    expect([ghost.style.left, ghost.style.right !== String.empty]).toEqual([String.empty, true]);
    expect(ghost.getBoundingClientRect().right).toBeCloseTo(tree.root.getBoundingClientRect().left + 24 - 12, 0);
  });
});
