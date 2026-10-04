/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { SpinnerComponent } from "../../../../src/app/components/spinner/spinner.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { MotionFixture } from "../../../fixtures/motion.fixture";

@Component({
  imports: [SpinnerComponent],
  template: `<tr-spinner [label]="label()" [isDelayed]="isDelayed()" />`
})
class SpinnerHostComponent {
  public readonly isDelayed = signal<boolean>(false);
  public readonly label = signal<string>("Loading the list");
}

describe("SpinnerComponent", () => {
  let fixture: ComponentFixture<SpinnerHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(SpinnerHostComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    vi.useRealTimers();
    AppearanceFixture.reset();
    await MotionFixture.resetAsync();
  });

  const spinner = (): HTMLElement => fixture.nativeElement.querySelector("tr-spinner");
  const ring = (): HTMLElement => fixture.nativeElement.querySelector(".tr-spinner-ring");

  it("is a status that names its work in text, with its ring hidden from assistive technology", () => {
    expect(spinner().getAttribute("role")).toBe("status");
    expect(spinner().textContent?.trim()).toBe("Loading the list");
    expect(ring().getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(spinner().querySelector(".tr-spinner-label") as HTMLElement).clipPath).not.toBe("none");
  });

  it("is no status, and shows no text, when it is given no label", () => {
    fixture.componentInstance.label.set("");
    fixture.detectChanges();

    expect([spinner().hasAttribute("role"), spinner().textContent?.trim()]).toEqual([false, ""]);
  });

  it("is visible at once when it is not delayed", () => {
    expect(spinner().classList.contains("tr-reveal-pending")).toBe(false);
    expect(getComputedStyle(spinner()).visibility).toBe("visible");
  });

  it("stays hidden for 300 ms when it is delayed, then appears, and hides again when the delay is asked for again", () => {
    vi.useFakeTimers();
    fixture.componentInstance.isDelayed.set(true);
    fixture.detectChanges();

    expect([getComputedStyle(spinner()).visibility, spinner().textContent?.trim()]).toEqual(["hidden", ""]);
    vi.advanceTimersByTime(299);
    fixture.detectChanges();
    expect([getComputedStyle(spinner()).visibility, spinner().textContent?.trim()]).toEqual(["hidden", ""]);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect([getComputedStyle(spinner()).visibility, spinner().textContent?.trim()]).toEqual(["visible", "Loading the list"]);

    fixture.componentInstance.isDelayed.set(false);
    fixture.detectChanges();
    expect(getComputedStyle(spinner()).visibility).toBe("visible");
  });

  it("does not reveal itself after it is dropped from its delay before it ran out", () => {
    vi.useFakeTimers();
    fixture.componentInstance.isDelayed.set(true);
    fixture.detectChanges();
    fixture.componentInstance.isDelayed.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(spinner().classList.contains("tr-reveal-pending")).toBe(false);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`is one fixed size from the ${theme.id} theme and draws its arc in the progress color in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(spinner());
        const arc = getComputedStyle(ring());

        AppearanceFixture.expectLook(style.width, theme, "spinner", "width");
        AppearanceFixture.expectLook(style.height, theme, "spinner", "height");
        expect(arc.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "progressBar.background"));
        expect(arc.borderBottomColor).not.toBe(arc.borderTopColor);
        expect(arc.animationName).toContain("tr-spinner-turn");
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its arc at least 3:1 against the shell surface in ${mode} mode`, () => {
      AppearanceFixture.apply(undefined, mode);

      expect(AppearanceFixture.contrast(getComputedStyle(ring()).borderTopColor, getComputedStyle(document.body).backgroundColor)).toBeGreaterThanOrEqual(3);
    });

  it("stops turning and shows a half ring instead when the person prefers reduced motion", async () => {
    await MotionFixture.reduceAsync();
    const arc = getComputedStyle(ring());

    expect(arc.animationName).toBe("none");
    expect(arc.borderRightColor).toBe(arc.borderTopColor);
    expect(arc.borderBottomColor).not.toBe(arc.borderTopColor);
  });
});
