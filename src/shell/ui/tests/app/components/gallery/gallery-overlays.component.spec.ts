/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { GalleryOverlaysComponent } from "../../../../src/app/components/gallery/gallery-overlays.component";

describe("GalleryOverlaysComponent", () => {
  let fixture: ComponentFixture<GalleryOverlaysComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(GalleryOverlaysComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("lets the checkbox row of a menu be used", async () => {
    const row = fixture.nativeElement.querySelector("[role='menuitemcheckbox']") as HTMLElement;

    row.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(row.getAttribute("aria-checked")).toBe("false");
  });

  it("gives each sample dialog its own title id", () => {
    const ids = [...fixture.nativeElement.querySelectorAll(".tr-dialog-title")].map(t => (t as HTMLElement).id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(t => t.startsWith("tr-gallery-dialog-"))).toBe(true);
  });
});
