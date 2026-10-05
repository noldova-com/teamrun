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
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [GalleryCellComponent],
  template: `
    <tr-gallery-cell caption="Default"><span>Before</span><button type="button" class="target">Target</button></tr-gallery-cell>
    <tr-gallery-cell caption="Empty"><span>Nothing to focus</span></tr-gallery-cell>
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

  const cells = (): GalleryCellComponent[] => fixture.debugElement.queryAll(By.directive(GalleryCellComponent)).map(t => t.componentInstance as GalleryCellComponent);
  const hosts = (): HTMLElement[] => [...fixture.nativeElement.querySelectorAll<HTMLElement>("tr-gallery-cell")];

  it("is a group named by its caption, shown above its specimen", () => {
    expect(hosts().map(t => [t.getAttribute("role"), t.getAttribute("aria-label"), t.querySelector(".tr-gallery-cell-caption")?.textContent])).toEqual([
      ["group", "Default", "Default"], ["group", "Empty", "Empty"]
    ]);
    for (const host of hosts())
      expect((host.querySelector(".tr-gallery-cell-caption") as HTMLElement).getBoundingClientRect().bottom)
        .toBeLessThanOrEqual((host.querySelector(".tr-gallery-cell-specimen") as HTMLElement).getBoundingClientRect().top);
  });

  it("moves the focus to its first control, and leaves the focus where it is when it has none", () => {
    cells()[0]?.focus();
    const focused = document.activeElement;
    cells()[1]?.focus();

    expect(focused).toBe(fixture.nativeElement.querySelector(".target"));
    expect(document.activeElement).toBe(focused);
  });
});
