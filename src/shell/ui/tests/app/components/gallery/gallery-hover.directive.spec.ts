/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { GalleryHoverDirective } from "../../../../src/app/components/gallery/gallery-hover.directive";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

@Component({
  imports: [GalleryHoverDirective],
  template: `
    <span class="hovered" trGalleryHover></span>
    <div class="hovered-part" trGalleryHover=".part"><span class="part"></span></div>
    <div class="missing-part" trGalleryHover=".missing"></div>
  `
})
class HoverHostComponent {
}

describe("GalleryHoverDirective", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("marks its host as hovered, or the part its selector finds, and nothing when the part is missing", async () => {
    const fixture = TestBed.createComponent(HoverHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const state = (selector: string): string | null => (fixture.nativeElement.querySelector(selector) as HTMLElement).getAttribute("data-tr-state");

    expect([state(".hovered"), state(".hovered-part"), state(".part"), state(".missing-part")]).toEqual(["hover", null, "hover", null]);
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
});
