/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { GalleryCellComponent } from "../../../../src/app/components/gallery/gallery-cell.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [GalleryCellComponent],
  template: `
    <tr-gallery-cell caption="Default"><button type="button">Default</button></tr-gallery-cell>
    <tr-gallery-cell caption="Empty"><span>Empty</span></tr-gallery-cell>
  `
})
class CellHostComponent {
}

describe("GalleryCellComponent", () => {
  let fixture: ComponentFixture<CellHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(CellHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    AppearanceFixture.reset();
  });

  const hosts = (): HTMLElement[] => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("tr-gallery-cell")];

  it("is a group named by its caption, shown above its specimen", () => {
    expect(hosts().map(t => [t.getAttribute("role"), t.getAttribute("aria-label"), t.querySelector(".tr-gallery-cell-caption")?.textContent])).toEqual([
      ["group", "Default", "Default"], ["group", "Empty", "Empty"]
    ]);
    for (const host of hosts())
      expect((host.querySelector(".tr-gallery-cell-caption") as HTMLElement).getBoundingClientRect().bottom)
        .toBeLessThanOrEqual((host.querySelector(".tr-gallery-cell-specimen") as HTMLElement).getBoundingClientRect().top);
  });
});
