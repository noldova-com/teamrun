/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MovableTreeHostComponent } from "../../fixtures/movable-tree-host.component";
import { TreeHarness } from "../../fixtures/tree-harness.fixture";

describe("TreeSpot", () => {
  let fixture: ComponentFixture<MovableTreeHostComponent>;
  let tree: TreeHarness;

  afterEach(() => AppearanceFixture.reset());

  it("names where a moved row landed for the announcement: its place among its siblings, and the branch it went into, which is none at the top", async () => {
    AppearanceFixture.apply(AppearanceFixture.themes[0], ThemeMode.Light);
    fixture = TestBed.createComponent(MovableTreeHostComponent);
    fixture.componentInstance.applying.set(true);
    tree = new TreeHarness(fixture);
    await fixture.whenStable();
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce");

    tree.press(tree.row("Notes"), "ArrowRight");
    await fixture.whenStable();
    tree.press(tree.row("Notes"), "ArrowLeft");
    await fixture.whenStable();

    expect(announce.mock.calls.map(t => t[0])).toEqual(["Moved Notes into Project, position 3 of 3", "Moved Notes to position 2 of 3"]);
  });
});
