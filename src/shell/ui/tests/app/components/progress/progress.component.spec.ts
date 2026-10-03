/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ProgressComponent } from "../../../../src/app/components/progress/progress.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ProgressComponent],
  template: `<div class="frame" [style.width]="'200px'"><tr-progress label="Syncing the clock" [value]="value()" /></div>`
})
class ProgressHostComponent {
  public readonly value = signal<number | null>(null);
}

describe("ProgressComponent", () => {
  let fixture: ComponentFixture<ProgressHostComponent>;
  let host: ProgressHostComponent;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ProgressHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    AppearanceFixture.reset();
  });

  const progress = (): HTMLElement => fixture.nativeElement.querySelector("tr-progress");
  const bar = (): HTMLElement => fixture.nativeElement.querySelector(".tr-progress-bar");

  function update(value: number | null): void {
    host.value.set(value);
    fixture.detectChanges();
  }

  it("is a progress bar that names its work and reports its fraction only when it knows it", () => {
    expect(progress().getAttribute("role")).toBe("progressbar");
    expect(progress().getAttribute("aria-label")).toBe("Syncing the clock");
    expect(progress().getAttribute("aria-valuemin")).toBe("0");
    expect(progress().getAttribute("aria-valuemax")).toBe("1");
    expect(progress().hasAttribute("aria-valuenow")).toBe(false);
    expect(progress().classList.contains("tr-progress-indeterminate")).toBe(true);

    update(0.25);

    expect(progress().getAttribute("aria-valuenow")).toBe("0.25");
    expect(progress().classList.contains("tr-progress-indeterminate")).toBe(false);
  });

  it("keeps a fraction outside its range inside it", () => {
    update(1.5);
    expect(progress().getAttribute("aria-valuenow")).toBe("1");

    update(-0.5);
    expect(progress().getAttribute("aria-valuenow")).toBe("0");
  });

  it("fills its track by the fraction and a part of it, moving, when the fraction is unknown", () => {
    update(0.5);
    expect(bar().getBoundingClientRect().width).toBe(100);
    expect(getComputedStyle(bar()).animationName).toBe("none");

    update(null);
    expect(bar().getBoundingClientRect().width).toBe(80);
    expect(getComputedStyle(bar()).animationName).toContain("tr-progress-slide");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws its bar in the ${theme.id} theme's progress color over a fainter track in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const track = getComputedStyle(progress()).backgroundColor;
        const fill = getComputedStyle(bar()).backgroundColor;

        expect(fill).toBe(AppearanceFixture.readColor(theme, mode, "progressBar.background"));
        expect(fill).not.toBe(track);
        expect(bar().getBoundingClientRect().height).toBe(2);
      });
});
