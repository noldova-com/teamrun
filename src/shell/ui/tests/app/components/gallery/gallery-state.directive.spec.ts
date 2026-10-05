/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { GalleryStateDirective } from "../../../../src/app/components/gallery/gallery-state.directive";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

@Component({
  imports: [GalleryStateDirective],
  template: `
    <span class="hovered" trGalleryHover></span>
    <div class="hovered-part" trGalleryHover=".part"><span class="part"></span></div>
    <div class="missing-part" trGalleryHover=".missing"></div>
    <span class="focused" trGalleryFocus></span>
    <div class="focused-part" trGalleryFocus=".part"><span class="part"></span></div>
    <span class="plain"></span>
  `
})
class StateHostComponent {
}

describe("GalleryStateDirective", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("marks its host as hovered or focused, or the part its selector finds, and nothing when the part is missing", async () => {
    const fixture = TestBed.createComponent(StateHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const state = (selector: string): string | null => (fixture.nativeElement.querySelector(selector) as HTMLElement).getAttribute("data-tr-state");

    expect([state(".hovered"), state(".hovered-part"), state(".hovered-part .part"), state(".missing-part")]).toEqual(["hover", null, "hover", null]);
    expect([state(".focused"), state(".focused-part"), state(".focused-part .part"), state(".plain")]).toEqual(["focus", null, "focus", null]);
  });

  it("shows the hovered look statically in each of the Gallery's Hover cells, through the kit's own hover rules", async () => {
    const fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[0] as HTMLElement;
    const cell = (specimen: string, caption: string): HTMLElement => frame.querySelector(`.tr-gallery-specimen[aria-label="${specimen}"] tr-gallery-cell[aria-label="${caption}"]`) as HTMLElement;
    const background = (element: Element | null): string => getComputedStyle(element as Element).backgroundColor;

    const hovered = [...frame.querySelectorAll("[data-tr-state='hover']")].map(t => t.closest("tr-gallery-cell")?.getAttribute("aria-label"));

    expect(hovered).toEqual(["Hover", "Secondary, hover", "Hover", "Hover", "Hover", "Hover", "Rows", "Menu bar, hover"]);
    expect(background(cell("Button", "Hover").querySelector("button"))).toBe(GalleryFixture.colorOf(frame, "background-color", "var(--tr-button-hover)"));
    expect(background(cell("Button", "Primary").querySelector("button"))).not.toBe(background(cell("Button", "Hover").querySelector("button")));
    expect(background(cell("Choice pills", "Hover").querySelector("[data-tr-state='hover']"))).toBe(GalleryFixture.colorOf(frame, "background-color", "var(--tr-toolbar-hover)"));
  });

  it("shows the real focus look statically in each of the Gallery's Focus cells, through the kit's own focus rules", async () => {
    const fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[0] as HTMLElement;
    const cell = (specimen: string, caption: string): HTMLElement => frame.querySelector(`.tr-gallery-specimen[aria-label="${specimen}"] tr-gallery-cell[aria-label="${caption}"]`) as HTMLElement;
    const accent = GalleryFixture.colorOf(frame, "color", "var(--tr-accent)");
    const ring = (element: Element | null): string[] => {
      const style = getComputedStyle(element as Element);
      return [style.outlineStyle, style.outlineColor];
    };

    const focused = [...frame.querySelectorAll("[data-tr-state='focus']")].map(t => `${t.closest(".tr-gallery-specimen")?.getAttribute("aria-label") ?? ""} / ${t.closest("tr-gallery-cell")?.getAttribute("aria-label") ?? ""}`);

    expect(focused).toEqual(["Button / Focus", "Icon button / Focus", "Checkbox / Focus", "Text field / Focus", "Select / Focus", "Choice pills / Focus", "Tab / Focus", "Toolbar button / Focus",
      "Sash / Focus"]);
    expect(ring(cell("Button", "Focus").querySelector("button"))).toEqual(["solid", accent]);
    expect(ring(cell("Button", "Primary").querySelector("button"))[0]).toBe("none");
    expect(ring(cell("Checkbox", "Focus").querySelector(".tr-checkbox-box"))).toEqual(["solid", accent]);
    expect(getComputedStyle(cell("Text field", "Focus").querySelector("input") as Element).borderColor).toBe(accent);
    expect(getComputedStyle(cell("Select", "Focus").querySelector(".tr-select-button") as Element).borderColor).toBe(accent);
    expect(getComputedStyle(cell("Select", "Default").querySelector(".tr-select-button") as Element).borderColor).not.toBe(accent);
  });
});
