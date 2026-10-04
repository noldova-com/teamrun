/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { GalleryCellComponent } from "../../../../src/app/components/gallery/gallery-cell.component";
import { GalleryHoverDirective } from "../../../../src/app/components/gallery/gallery-hover.directive";
import { GallerySpecimenComponent } from "../../../../src/app/components/gallery/gallery-specimen.component";
import { GallerySize } from "../../../../src/app/enums/gallery-size";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [GalleryCellComponent, GalleryHoverDirective, GallerySpecimenComponent],
  template: `
    <div class="page" style="width: 60rem">
      <tr-gallery-specimen name="Regular">
        <tr-gallery-cell caption="Default"><button type="button">Default</button></tr-gallery-cell>
        <tr-gallery-cell caption="Disabled"><span>A taller specimen<br />on two lines</span></tr-gallery-cell>
        <tr-gallery-cell caption="Focus" [isFocusTarget]="true"><span>Before</span><button type="button" class="target">Target</button></tr-gallery-cell>
        <tr-gallery-cell long caption="Long text"><span>A long specimen</span></tr-gallery-cell>
      </tr-gallery-specimen>
      <tr-gallery-specimen name="Wide" [size]="sizes.Wide">
        <tr-gallery-cell caption="Default"><span>Wide</span></tr-gallery-cell>
        <tr-gallery-cell caption="Other"><span>Wide</span></tr-gallery-cell>
      </tr-gallery-specimen>
      <tr-gallery-specimen name="Full" [size]="sizes.Full">
        <tr-gallery-cell caption="Empty" />
      </tr-gallery-specimen>
      <span class="hovered" trGalleryHover></span>
      <div class="hovered-part" trGalleryHover=".part"><span class="part"></span></div>
      <div class="missing-part" trGalleryHover=".missing"></div>
    </div>
  `
})
class SpecimenHostComponent {
  public readonly sizes: typeof GallerySize = GallerySize;
}

describe("GallerySpecimenComponent", () => {
  let fixture: ComponentFixture<SpecimenHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(SpecimenHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => AppearanceFixture.reset());

  const specimen = (name: string): HTMLElement => fixture.nativeElement.querySelector(`.tr-gallery-specimen[aria-label="${name}"]`);
  const cells = (name: string): HTMLElement[] => [...specimen(name).querySelectorAll<HTMLElement>(".tr-gallery-specimen-cells > tr-gallery-cell")];
  const rect = (element: Element): DOMRect => element.getBoundingClientRect();

  it("heads each section with its name, and puts the focus button at the end of the row only when a cell is the focus target", () => {
    const head = specimen("Regular").querySelector(".tr-gallery-specimen-head") as HTMLElement;
    const button = head.querySelector(".tr-gallery-specimen-focus") as HTMLButtonElement;

    expect(head.querySelector("h3")?.textContent).toBe("Regular");
    expect(button.textContent?.trim()).toBe("Show the keyboard focus");
    expect(button.getAttribute("aria-label")).toBe("Show the keyboard focus on the Regular");
    AppearanceFixture.expectPixels(rect(button).right, rect(head).right);
    expect(specimen("Wide").querySelector(".tr-gallery-specimen-focus")).toBeNull();
    AppearanceFixture.expectPixels(rect(specimen("Wide").querySelector(".tr-gallery-specimen-head") as HTMLElement).height, rect(head).height);
  });

  it("lays the cells out at one fixed width, sharing their top edge, each a group named by the caption shown above its specimen", () => {
    const shown = cells("Regular");

    expect(shown.map(t => [t.getAttribute("role"), t.getAttribute("aria-label"), t.querySelector(".tr-gallery-cell-caption")?.textContent])).toEqual([
      ["group", "Default", "Default"], ["group", "Disabled", "Disabled"], ["group", "Focus", "Focus"]
    ]);
    for (const cell of shown) {
      AppearanceFixture.expectPixels(rect(cell).width, AppearanceFixture.toPixels(12.5));
      AppearanceFixture.expectPixels(rect(cell).top, rect(shown[0] as HTMLElement).top);
      expect(rect(cell.querySelector(".tr-gallery-cell-caption") as HTMLElement).bottom).toBeLessThanOrEqual(rect(cell.querySelector(".tr-gallery-cell-specimen") as HTMLElement).top);
    }
    AppearanceFixture.expectPixels(rect(shown[1] as HTMLElement).left - rect(shown[0] as HTMLElement).right, AppearanceFixture.toPixels(1));
  });

  it("makes a wide section's cells as wide as two cells and their gap, and a full section's cell as wide as the section", () => {
    for (const cell of cells("Wide"))
      AppearanceFixture.expectPixels(rect(cell).width, AppearanceFixture.toPixels(26));
    AppearanceFixture.expectPixels(rect(cells("Full")[0] as HTMLElement).width, rect(specimen("Full")).width);
  });

  it("puts a long-text cell in a full-width row below the cells, and leaves the row out of a section without one", () => {
    const long = specimen("Regular").querySelector(".tr-gallery-specimen-long > tr-gallery-cell") as HTMLElement;

    expect(long.getAttribute("aria-label")).toBe("Long text");
    AppearanceFixture.expectPixels(rect(long).width, rect(specimen("Regular")).width);
    expect(rect(long).top).toBeGreaterThan(Math.max(...cells("Regular").map(t => rect(t).bottom)));
    expect(specimen("Wide").querySelector(".tr-gallery-specimen-long")).toBeNull();
  });

  it("moves the focus to the focus target's first control from the button, and a cell without a control leaves the focus where it is", () => {
    const button = specimen("Regular").querySelector(".tr-gallery-specimen-focus") as HTMLButtonElement;

    button.click();
    const focused = document.activeElement;
    (fixture.debugElement.queryAll(By.directive(GalleryCellComponent)).at(-1)?.componentInstance as GalleryCellComponent).focus();

    expect(focused).toBe(specimen("Regular").querySelector(".target"));
    expect(document.activeElement).toBe(focused);
  });

  it("marks the element a hover cell names as hovered, its host or the part its selector finds, and nothing when the part is missing", () => {
    const state = (selector: string): string | null => (fixture.nativeElement.querySelector(selector) as HTMLElement).getAttribute("data-tr-state");

    expect([state(".hovered"), state(".hovered-part"), state(".part"), state(".missing-part")]).toEqual(["hover", null, "hover", null]);
  });
});
