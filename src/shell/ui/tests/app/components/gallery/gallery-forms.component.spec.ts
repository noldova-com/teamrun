/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { GalleryFormsComponent } from "../../../../src/app/components/gallery/gallery-forms.component";

describe("GalleryFormsComponent", () => {
  let fixture: ComponentFixture<GalleryFormsComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(GalleryFormsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("lets the sample controls be used: a toggle button, a checkbox and a select", async () => {
    const toggle = fixture.nativeElement.querySelector("[aria-pressed]") as HTMLButtonElement;
    const checkbox = fixture.nativeElement.querySelector("tr-checkbox input") as HTMLInputElement;
    const select = fixture.nativeElement.querySelector(".tr-select-button") as HTMLButtonElement;

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
