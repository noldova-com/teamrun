/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { GalleryCellComponent } from "../../../../src/app/components/gallery/gallery-cell.component";
import { GallerySpecimenComponent } from "../../../../src/app/components/gallery/gallery-specimen.component";
import { type GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { GallerySize } from "../../../../src/app/enums/gallery-size";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

@Component({
  imports: [GalleryCellComponent, GallerySpecimenComponent],
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
    </div>
  `
})
class SpecimenHostComponent {
  public readonly sizes: typeof GallerySize = GallerySize;
}

describe("GallerySpecimenComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  describe("in a host", () => {
    let fixture: ComponentFixture<SpecimenHostComponent>;

    beforeEach(async () => {
      AppearanceFixture.apply();
      fixture = TestBed.createComponent(SpecimenHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();
    });

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

    it("lays the cells out at one fixed width, sharing their top edge, one gap apart", () => {
      const shown = cells("Regular");

      expect(shown.map(t => t.getAttribute("aria-label"))).toEqual(["Default", "Disabled", "Focus"]);
      for (const cell of shown) {
        AppearanceFixture.expectPixels(rect(cell).width, AppearanceFixture.toPixels(12.5));
        AppearanceFixture.expectPixels(rect(cell).top, rect(shown[0] as HTMLElement).top);
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

    it("moves the focus to the focus target's first control from the button", () => {
      (specimen("Regular").querySelector(".tr-gallery-specimen-focus") as HTMLButtonElement).click();

      expect(document.activeElement).toBe(specimen("Regular").querySelector(".target"));
    });
  });

  describe("in the Gallery", () => {
    let fixture: ComponentFixture<GalleryComponent>;

    it("shows the keyboard focus on the control in a specimen's Focus cell when its button is pressed from the keyboard, and not before", async () => {
      fixture = await GalleryFixture.showAsync();
      const checkbox = (GalleryFixture.frames(fixture)[2] as HTMLElement).querySelector<HTMLElement>(".tr-gallery-specimen[aria-label=\"Checkbox\"]") as HTMLElement;
      const button = checkbox.querySelector<HTMLButtonElement>(".tr-gallery-specimen-focus") as HTMLButtonElement;
      const input = checkbox.querySelector("tr-gallery-cell[aria-label=\"Focus\"] input") as HTMLInputElement;

      expect(document.activeElement).not.toBe(input);
      expect(button.getAttribute("aria-label")).toBe("Show the keyboard focus on the Checkbox");
      button.focus();
      await userEvent.keyboard("{Enter}");

      expect(document.activeElement).toBe(input);
      expect(input.matches(":focus-visible")).toBe(true);
    });

    it("offers the focus button on every specimen that has a control to focus, and on no other", async () => {
      fixture = await GalleryFixture.showAsync();
      const specimens = [...(GalleryFixture.frames(fixture)[0] as HTMLElement).querySelectorAll<HTMLElement>(".tr-gallery-specimen")];

      const offered = specimens.filter(t => t.querySelector(".tr-gallery-specimen-focus") !== null).map(t => t.getAttribute("aria-label"));
      const without = specimens.filter(t => t.querySelector(".tr-gallery-specimen-focus") === null).map(t => t.getAttribute("aria-label"));

      expect(offered).toEqual(["Button", "Icon button", "Checkbox", "Text field", "Select", "Choice pills", "Tab", "Tree", "Toolbar", "Toolbar button", "Sash", "Menu", "Popover", "Tooltip",
        "Dialog", "Quick input"]);
      expect(without).toEqual(["Progress", "Spinner", "Badge and key chip", "View badge", "Panel card", "Docking guides"]);
    });
  });
});
