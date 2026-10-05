/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture } from "@angular/core/testing";

import { type GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

describe("GalleryScopeDirective", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("paints each scope with its own theme and mode, and derives colors from them within the scope", async () => {
    fixture = await GalleryFixture.showAsync();
    const [defaultLight, defaultDark, fixtureLight, fixtureDark] = GalleryFixture.frames(fixture) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];

    expect(GalleryFixture.colorOf(defaultLight, "color", "var(--tr-text)")).toBe(GalleryFixture.colorOf(defaultLight, "color", "#3B3B3B"));
    expect(GalleryFixture.colorOf(defaultDark, "color", "var(--tr-text)")).toBe(GalleryFixture.colorOf(defaultDark, "color", "#CCCCCC"));
    expect(GalleryFixture.colorOf(fixtureLight, "color", "var(--tr-text)")).toBe(GalleryFixture.colorOf(fixtureLight, "color", "#A00610"));
    expect(GalleryFixture.colorOf(fixtureDark, "color", "var(--tr-text)")).toBe(GalleryFixture.colorOf(fixtureDark, "color", "#2006A0"));
    expect(GalleryFixture.colorOf(fixtureLight, "background-color", "var(--tr-inline-code)")).toBe(GalleryFixture.colorOf(fixtureLight, "background-color", "color-mix(in srgb, #A00610 12%, transparent)"));
    expect(GalleryFixture.colorOf(fixtureDark, "background-color", "var(--tr-inline-code)")).toBe(GalleryFixture.colorOf(fixtureDark, "background-color", "color-mix(in srgb, #2006A0 12%, transparent)"));
    expect(GalleryFixture.colorOf(document.body, "background-color", "var(--tr-inline-code)")).not.toBe(GalleryFixture.colorOf(fixtureLight, "background-color", "var(--tr-inline-code)"));
  });
});
