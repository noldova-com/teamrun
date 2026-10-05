/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Type } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import * as kit from "../../../../src/api/index";
import { GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

describe("GalleryComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("shows the controls once for each theme in light and in dark, each scope named for them", async () => {
    fixture = await GalleryFixture.showAsync();

    expect(GalleryFixture.frames(fixture).map(t => t.getAttribute("aria-label"))).toEqual(["Default, light mode", "Default, dark mode", "Fixture, light mode", "Fixture, dark mode"]);
    expect(GalleryFixture.frames(fixture).map(t => [t.dataset["theme"], t.dataset["mode"]])).toEqual([
      ["shell.default", "Light"], ["shell.default", "Dark"], ["fixture.contrast", "Light"], ["fixture.contrast", "Dark"]
    ]);
    expect(GalleryFixture.frames(fixture).every(t => t.querySelector("tr-gallery-forms") !== null && t.querySelector("tr-gallery-navigation") !== null && t.querySelector("tr-gallery-overlays") !== null)).toBe(true);
  });

  it("shows the default theme alone when it is given no others", async () => {
    fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(GalleryFixture.frames(fixture).map(t => t.getAttribute("aria-label"))).toEqual(["Default, light mode", "Default, dark mode"]);
  });

  it("lets the Gallery's tree be rearranged: Alt with an arrow key moves the focused row, and the tree shows the new order", async () => {
    await showAsync();
    const tree = fixture.nativeElement.querySelector("tr-gallery-navigation tr-tree") as HTMLElement;
    const labels = (): (string | null | undefined)[] => [...tree.querySelectorAll("[role=treeitem] .tr-tree-label")].map(t => t.textContent);
    const notes = [...tree.querySelectorAll<HTMLElement>("[role=treeitem]")].find(t => t.querySelector(".tr-tree-label")?.textContent === "Notes") as HTMLElement;
    const before = labels();

    notes.focus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await fixture.whenStable();

    expect([before.indexOf("Notes"), labels().indexOf("Notes")]).toEqual([3, 0]);
  });

  it("shows every component and directive the kit exports, so a new control that is not shown here fails this test", async () => {
    fixture = await GalleryFixture.showAsync();
    const own = new Set<unknown>([kit.GalleryComponent]);
    const controls = Object.entries(kit).filter(([, value]) => !own.has(value) && typeof value === "function" && ("ɵcmp" in value || "ɵdir" in value));

    const missing = controls.filter(([, value]) => fixture.debugElement.queryAll(By.directive(value as Type<unknown>)).length === 0).map(([name]) => name);

    expect(controls.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
