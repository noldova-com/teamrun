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
  template: `<tr-progress label="Syncing the clock" [value]="null" [isDelayed]="isDelayed()" />`
})
class DelayedProgressHostComponent {
  public readonly isDelayed = signal<boolean>(false);
}

describe("RevealDelayDirective", () => {
  let fixture: ComponentFixture<DelayedProgressHostComponent>;
  let host: DelayedProgressHostComponent;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(DelayedProgressHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    AppearanceFixture.reset();
  });

  const progress = (): HTMLElement => fixture.nativeElement.querySelector("tr-progress");

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
});
