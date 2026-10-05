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

describe("GalleryFormsComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("lets the sample controls be used: a toggle button, a checkbox and a select", async () => {
    fixture = await GalleryFixture.showAsync();
    const forms = GalleryFixture.frames(fixture)[0]?.querySelector("tr-gallery-forms") as HTMLElement;
    const toggle = forms.querySelector("[aria-pressed]") as HTMLButtonElement;
    const checkbox = forms.querySelector("tr-checkbox input") as HTMLInputElement;
    const select = forms.querySelector(".tr-select-button") as HTMLButtonElement;

    toggle.click();
    checkbox.click();
    select.click();
    await fixture.whenStable();
    (document.querySelector(".tr-select-option[data-value='two']") as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(checkbox.checked).toBe(false);
    expect(select.textContent).toContain("Second option");
  });
});
