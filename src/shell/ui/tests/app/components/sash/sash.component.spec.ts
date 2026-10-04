/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { SashComponent } from "../../../../src/app/components/sash/sash.component";
import { SashOrientation } from "../../../../src/app/enums/sash-orientation";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { Theme } from "../../../../src/app/models/theme";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [SashComponent],
  template: `
    <div class="frame" [style.display]="'flex'" [style.flex-direction]="vertical() ? 'row' : 'column'" [style.height.px]="120" [style.width.px]="120">
      @if (shown()) {
        <tr-sash [orientation]="orientation()" label="Resize the left dock" [value]="value()" [minimum]="minimum()" [maximum]="maximum()" (resize)="deltas.push($event)" />
      }
    </div>
  `
})
class SashHostComponent {
  public readonly orientation = signal(SashOrientation.Vertical);
  public readonly value = signal<number | undefined>(240);
  public readonly minimum = signal<number | undefined>(160);
  public readonly maximum = signal<number | undefined>(640);
  public readonly shown = signal(true);
  public readonly deltas: number[] = [];

  public vertical(): boolean {
    return this.orientation() === SashOrientation.Vertical;
  }
}

describe("SashComponent", () => {
  let fixture: ComponentFixture<SashHostComponent>;
  let host: SashHostComponent;
  const styles: HTMLStyleElement[] = [];

  beforeEach(() => {
    AppearanceFixture.apply();
    const style = document.createElement("style");
    style.textContent = ".tr-sash-bar, .tr-sash-grip { transition: none !important; }";
    document.head.append(style);
    styles.push(style);
    fixture = TestBed.createComponent(SashHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    styles.splice(0).forEach(t => t.remove());
    AppearanceFixture.reset();
  });

  function sash(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-sash");
  }

  function bar(): HTMLElement {
    return sash().querySelector(".tr-sash-bar") as HTMLElement;
  }

  function update(change: () => void): void {
    change();
    fixture.detectChanges();
  }

  function pointer(type: string, button: number, clientX: number, clientY: number): PointerEvent {
    const event = new PointerEvent(type, { button, clientX, clientY, pointerId: 7, cancelable: true });
    sash().dispatchEvent(event);
    return event;
  }

  function key(name: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key: name, cancelable: true });
    sash().dispatchEvent(event);
    return event;
  }

  it("is a focusable separator that names the pane it resizes and its size", () => {
    expect(sash().getAttribute("role")).toBe("separator");
    expect(sash().getAttribute("tabindex")).toBe("0");
    expect(sash().getAttribute("aria-label")).toBe("Resize the left dock");
    expect(sash().getAttribute("aria-orientation")).toBe("vertical");
    expect(sash().getAttribute("aria-valuenow")).toBe("240");
    expect(sash().getAttribute("aria-valuemin")).toBe("160");
    expect(sash().getAttribute("aria-valuemax")).toBe("640");

    update(() => {
      host.orientation.set(SashOrientation.Horizontal);
      host.value.set(undefined);
      host.minimum.set(undefined);
      host.maximum.set(undefined);
    });

    expect(sash().getAttribute("aria-orientation")).toBe("horizontal");
    expect(sash().hasAttribute("aria-valuenow")).toBe(false);
    expect(sash().hasAttribute("aria-valuemin")).toBe(false);
    expect(sash().hasAttribute("aria-valuemax")).toBe(false);
  });

  it("resizes by keyboard along its own axis and ignores other keys", () => {
    const left = key("ArrowLeft");
    key("ArrowRight");
    const up = key("ArrowUp");
    update(() => host.orientation.set(SashOrientation.Horizontal));
    key("ArrowUp");
    key("ArrowDown");
    key("ArrowLeft");

    expect(host.deltas).toEqual([-8, 8, -8, 8]);
    expect(left.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(false);
  });

  it("follows a primary-button drag along its axis and reports only real movement", () => {
    const capture = vi.spyOn(sash(), "setPointerCapture").mockImplementation(() => undefined);
    const release = vi.spyOn(sash(), "releasePointerCapture").mockImplementation(() => undefined);

    pointer("pointermove", 0, 120, 10);
    pointer("pointerup", 0, 120, 10);
    pointer("pointerdown", 2, 100, 10);
    const press = pointer("pointerdown", 0, 100, 10);
    pointer("pointermove", 0, 112, 40);
    pointer("pointermove", 0, 112, 90);
    pointer("pointermove", 0, 104, 90);
    fixture.detectChanges();

    expect(sash().classList.contains("tr-sash-active")).toBe(true);
    pointer("pointerup", 0, 104, 90);
    pointer("pointermove", 0, 150, 90);
    fixture.detectChanges();

    expect(press.defaultPrevented).toBe(true);
    expect(capture).toHaveBeenCalledExactlyOnceWith(7);
    expect(release).toHaveBeenCalledExactlyOnceWith(7);
    expect(host.deltas).toEqual([12, -8]);
    expect(sash().classList.contains("tr-sash-active")).toBe(false);
  });

  it("follows a horizontal sash's vertical drag and ends on cancel", () => {
    update(() => host.orientation.set(SashOrientation.Horizontal));
    vi.spyOn(sash(), "setPointerCapture").mockImplementation(() => undefined);
    const release = vi.spyOn(sash(), "releasePointerCapture").mockImplementation(() => undefined);

    pointer("pointerdown", 0, 10, 50);
    pointer("pointermove", 0, 90, 44);
    pointer("pointercancel", 0, 90, 44);

    expect(host.deltas).toEqual([-6]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("shows its bar after 300 milliseconds of hover and hides it on leave", () => {
    vi.useFakeTimers();

    sash().dispatchEvent(new PointerEvent("pointerenter"));
    sash().dispatchEvent(new PointerEvent("pointerenter"));
    vi.advanceTimersByTime(299);
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("0");

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("1");
    expect(getComputedStyle(sash().querySelector(".tr-sash-grip") ?? sash()).opacity).toBe("0");

    sash().dispatchEvent(new PointerEvent("pointerleave"));
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("0");
    expect(getComputedStyle(sash().querySelector(".tr-sash-grip") ?? sash()).opacity).toBe("1");
  });

  it("shows its bar at once while dragging, keeps it when the pointer leaves and hides it when the drag ends", () => {
    vi.useFakeTimers();
    vi.spyOn(sash(), "setPointerCapture").mockImplementation(() => undefined);
    vi.spyOn(sash(), "releasePointerCapture").mockImplementation(() => undefined);

    sash().dispatchEvent(new PointerEvent("pointerenter"));
    pointer("pointerdown", 0, 100, 10);
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("1");

    sash().dispatchEvent(new PointerEvent("pointerleave"));
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("1");

    pointer("pointerup", 0, 100, 10);
    fixture.detectChanges();
    expect(getComputedStyle(bar()).opacity).toBe("0");
  });

  it("shows its bar while the keyboard has focus on it and hides it when the focus leaves", async () => {
    expect(getComputedStyle(bar()).opacity).toBe("0");

    await userEvent.keyboard("{Shift}");
    sash().focus();
    expect(sash().matches(":focus-visible")).toBe(true);
    expect(getComputedStyle(bar()).opacity).toBe("1");

    sash().blur();
    expect(getComputedStyle(bar()).opacity).toBe("0");
  });

  it("cancels a pending hover when it is destroyed", () => {
    vi.useFakeTimers();
    sash().dispatchEvent(new PointerEvent("pointerenter"));

    update(() => host.shown.set(false));

    expect(vi.getTimerCount()).toBe(0);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its gap, grip and bar from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const dot = (): CSSStyleDeclaration => getComputedStyle(sash().querySelector(".tr-sash-dot") ?? sash());

        AppearanceFixture.expectLook(getComputedStyle(sash()).width, theme, "sash", "width");
        AppearanceFixture.expectLook(dot().width, theme, "sash-grip", "width");
        AppearanceFixture.expectLook(getComputedStyle(sash().querySelector(".tr-sash-grip") ?? sash()).rowGap, theme, "sash-grip-spacing", "row-gap");
        expect(dot().backgroundColor).toMatch(/^color\(srgb |^rgba\(/);

        vi.spyOn(sash(), "setPointerCapture").mockImplementation(() => undefined);
        pointer("pointerdown", 0, 0, 0);
        fixture.detectChanges();
        const box = bar().getBoundingClientRect();
        const outer = sash().getBoundingClientRect();

        expect(getComputedStyle(bar()).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "sash.hoverBorder"));
        expect([box.left, box.top, box.width, box.height]).toEqual([outer.left, outer.top, outer.width, outer.height]);
        AppearanceFixture.expectLook(getComputedStyle(bar()).width, theme, "sash", "width");
        expect(box.height).toBe(120);
      });

  it("takes its bar's color from the accent when the theme names no sash color", () => {
    const theme = new Theme("fixture.accent-only", "Accent only", new Map([["focusBorder", "#336699"]]), new Map([["focusBorder", "#99CC33"]]), new Map(), new Map());

    for (const mode of AppearanceFixture.modes) {
      AppearanceFixture.apply(theme, mode);
      vi.spyOn(sash(), "setPointerCapture").mockImplementation(() => undefined);
      pointer("pointerdown", 0, 0, 0);
      fixture.detectChanges();

      expect(getComputedStyle(bar()).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "focusBorder"));
    }
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales its gap and grip with panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      update(() => host.orientation.set(SashOrientation.Horizontal));

      AppearanceFixture.expectRem(getComputedStyle(sash()).height, 0.25, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(sash().querySelector(".tr-sash-dot") ?? sash()).height, 0.125, panelSize);
      expect(getComputedStyle(sash()).cursor).toBe("row-resize");
    });
});
