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

describe("TreeDrop", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let tree: TreeHarness;

  async function dropAsync(from: string, to: string, fraction: number): Promise<(string | number | null)[][]> {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    tree = new TreeHarness(fixture);
    await fixture.whenStable();
    await tree.dragAsync(from, to, fraction);
    const moves = tree.moves;
    fixture.destroy();
    return moves;
  }

  afterEach(() => AppearanceFixture.reset());

  it("drops a row before or after another, into a branch or at the start of an open one, counting the place once the row has left its own", async () => {
    expect(await dropAsync("Notes", "Source", 0.1)).toEqual([["notes", "project", 0]]);
    expect(await dropAsync("Notes", "Readme", 0.9)).toEqual([["notes", "project", 2]]);
    expect(await dropAsync("Notes", "Project", 0.5)).toEqual([["notes", "project", 2]]);
    expect(await dropAsync("Notes", "Project", 0.9)).toEqual([["notes", "project", 0]]);
    expect(await dropAsync("Trash", "Project", 0.1)).toEqual([["trash", null, 0]]);
    expect(await dropAsync("Project", "Trash", 0.9)).toEqual([["project", null, 2]]);
  });

  it("refuses a drop that changes nothing or lands inside the row itself", async () => {
    expect(await dropAsync("Notes", "Trash", 0.1)).toEqual([]);
    expect(await dropAsync("Readme", "Project", 0.5)).toEqual([]);
    expect(await dropAsync("Project", "Source", 0.5)).toEqual([]);
    expect(await dropAsync("Project", "Readme", 0.9)).toEqual([]);
  });
});
