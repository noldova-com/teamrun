/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Type, isSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { GalleryComponent } from "../../../../src/api/gallery";
import * as kit from "../../../../src/api/index";
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
    expect(GalleryFixture.frames(fixture).every(t => t.querySelector("tr-gallery-forms") !== null && t.querySelector("tr-gallery-navigation") !== null && t.querySelector("tr-gallery-overlays") !== null && t.querySelector("tr-gallery-content") !== null)).toBe(true);
  });

  it("shows the default theme alone when it is given no others", async () => {
    fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(GalleryFixture.frames(fixture).map(t => t.getAttribute("aria-label"))).toEqual(["Default, light mode", "Default, dark mode"]);
  });

  it("shows every component and directive the kit exports, so a new control that is not shown here fails this test", async () => {
    fixture = await GalleryFixture.showAsync();
    const controls = Object.entries(kit).filter(([, value]) => typeof value === "function" && ("ɵcmp" in value || "ɵdir" in value));
    const held = fixture.debugElement.queryAll(By.all()).flatMap(t => Object.values((t.componentInstance ?? {}) as object)).filter(isSignal).map(t => t());
    const tokens = new Set(fixture.debugElement.queryAllNodes(By.all()).flatMap(t => t.providerTokens));
    const isShown = (type: Type<unknown>): boolean => tokens.has(type) || held.some(t => t instanceof type);

    const missing = controls.filter(([, value]) => !isShown(value as Type<unknown>)).map(([name]) => name);

    expect(controls.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
