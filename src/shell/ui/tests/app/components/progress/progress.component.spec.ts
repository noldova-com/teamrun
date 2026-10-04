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
import { MotionFixture } from "../../../fixtures/motion.fixture";

@Component({
  imports: [ProgressComponent],
  template: `
    <div class="frame" [style.width]="'200px'"><tr-progress label="Syncing the clock" [value]="value()" [isDelayed]="isDelayed()" /></div>
    <div class="popover" [style.background]="'var(--tr-menu)'"><tr-progress label="Syncing the clock" [value]="0.5" /></div>
    <div class="toast" [style.background]="'var(--tr-notification)'"><tr-progress label="Syncing the clock" [value]="0.5" /></div>
  `
})
class ProgressHostComponent {
  public readonly value = signal<number | null>(null);
  public readonly isDelayed = signal<boolean>(false);
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

  afterEach(async () => {
    vi.useRealTimers();
    AppearanceFixture.reset();
    await MotionFixture.resetAsync();
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

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      for (const surface of ["popover", "toast"])
        it(`keeps its bar at least 3:1 against the ${surface} it sits on in the ${theme.id} theme in ${mode} mode`, () => {
          AppearanceFixture.apply(theme, mode);
          const fill = getComputedStyle(fixture.nativeElement.querySelector(`.${surface} .tr-progress-bar`)).backgroundColor;
          const ground = getComputedStyle(fixture.nativeElement.querySelector(`.${surface}`)).backgroundColor;

          expect(fill.startsWith("rgb(")).toBe(true);
          expect(ground.startsWith("rgb(")).toBe(true);
          expect(AppearanceFixture.contrast(fill, ground)).toBeGreaterThanOrEqual(3);
        });

  it("is shown at once when it is not delayed", () => {
    expect(progress().classList.contains("tr-reveal-pending")).toBe(false);
    expect(getComputedStyle(progress()).visibility).toBe("visible");
  });

  it("stays hidden for 300 ms when it is delayed, then appears, so brief work does not flash it", () => {
    vi.useFakeTimers();
    host.isDelayed.set(true);
    fixture.detectChanges();

    expect(getComputedStyle(progress()).visibility).toBe("hidden");
    vi.advanceTimersByTime(299);
    fixture.detectChanges();
    expect(getComputedStyle(progress()).visibility).toBe("hidden");
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(getComputedStyle(progress()).visibility).toBe("visible");
  });

  it("never appears when it is dropped from its delay before it ran out", () => {
    vi.useFakeTimers();
    host.isDelayed.set(true);
    fixture.detectChanges();
    host.isDelayed.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(progress().classList.contains("tr-reveal-pending")).toBe(false);
  });

  it("shows an unknown amount as a still part of the track when the person prefers reduced motion", async () => {
    await MotionFixture.reduceAsync();

    expect(getComputedStyle(bar()).animationName).toBe("none");
    expect(bar().getBoundingClientRect().width).toBe(80);
    expect(bar().getBoundingClientRect().left - progress().getBoundingClientRect().left).toBe(60);
  });
});
