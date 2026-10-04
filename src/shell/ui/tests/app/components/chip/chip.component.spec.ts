/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ChipComponent } from "../../../../src/app/components/chip/chip.component";
import { ChipKind } from "../../../../src/app/enums/chip-kind";
import type { ThemeMode } from "../../../../src/app/enums/theme-mode";
import type { Theme } from "../../../../src/app/models/theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ChipComponent],
  template: `
    <tr-chip class="subject" [kind]="kind()" [count]="count()" />
    <tr-chip class="key" [kind]="keyKind">Ctrl+K</tr-chip>
    <div class="ground" [style.background]="'var(--tr-menu)'"><tr-chip class="on-ground" [kind]="kind()" [count]="count()" /></div>
  `
})
class ChipHostComponent {
  public readonly keyKind: ChipKind = ChipKind.Key;
  public readonly kind = signal<ChipKind>(ChipKind.Count);
  public readonly count = signal<number>(3);
}

describe("ChipComponent", () => {
  let fixture: ComponentFixture<ChipHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ChipHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => AppearanceFixture.reset());

  const chip = (selector: string = ".subject"): HTMLElement => fixture.nativeElement.querySelector(selector);

  function removedColor(theme: Theme, mode: ThemeMode): string {
    return theme.readColor(mode, "teamrun.removedForeground") === undefined ? AppearanceFixture.readColor(theme, mode, "errorForeground") : AppearanceFixture.readColor(theme, mode, "teamrun.removedForeground");
  }

  function show(kind: ChipKind, count: number): void {
    fixture.componentInstance.kind.set(kind);
    fixture.componentInstance.count.set(count);
    fixture.detectChanges();
  }

  it("shows a count up to 99, then 99+, and zero as 0", () => {
    const shown: (string | undefined)[] = [];
    for (const count of [0, 3, 99, 100]) {
      show(ChipKind.Count, count);
      shown.push(chip().textContent?.trim());
    }

    expect(shown).toEqual(["0", "3", "99", "99+"]);
  });

  it("shows a diff count with its sign: plus for added and a minus sign for removed", () => {
    show(ChipKind.Added, 12);
    const added = chip().textContent?.trim();
    show(ChipKind.Removed, 4);

    expect([added, chip().textContent?.trim()]).toEqual(["+12", "−4"]);
  });

  it("shows the key it is given and the count of no other kind", () => {
    expect(chip(".key").textContent?.trim()).toBe("Ctrl+K");
    expect(chip(".key").classList.contains("tr-chip-key")).toBe(true);
  });

  it("marks its kind with a class", () => {
    const classes: string[][] = [];
    for (const kind of [ChipKind.Count, ChipKind.Added, ChipKind.Removed, ChipKind.Key]) {
      show(kind, 1);
      classes.push([...chip().classList].filter(t => t.startsWith("tr-chip-")));
    }

    expect(classes).toEqual([["tr-chip-count"], ["tr-chip-added"], ["tr-chip-removed"], ["tr-chip-key"]]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its height, padding, border and text from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(chip());

        AppearanceFixture.expectLook(style.height, theme, "chip", "height");
        AppearanceFixture.expectLook(style.minWidth, theme, "chip", "min-width");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "chip-padding", "padding-left");
        AppearanceFixture.expectLook(style.borderRadius, theme, "radius-small", "border-radius");
        AppearanceFixture.expectLook(style.borderTopWidth, theme, "border-width", "border-top-width");
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "widget.border"));
        expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(style.fontWeight).toBe("600");
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws a diff count in the ${theme.id} theme's added and removed colors, and a key on the raised surface, in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        show(ChipKind.Added, 1);
        const added = getComputedStyle(chip()).color;
        show(ChipKind.Removed, 1);
        const removed = getComputedStyle(chip()).color;
        const key = getComputedStyle(chip(".key"));

        expect([added, removed]).toEqual([AppearanceFixture.readColor(theme, mode, "teamrun.addedForeground"), removedColor(theme, mode)]);
        expect(key.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.raisedBackground"));
        expect(key.fontWeight).toBe("400");
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps each kind's text at least 4.5:1 against the surface it sits on in ${mode} mode`, () => {
      AppearanceFixture.apply(undefined, mode);
      for (const kind of [ChipKind.Count, ChipKind.Added, ChipKind.Removed]) {
        show(kind, 1);
        const style = getComputedStyle(chip(".on-ground"));
        const ground = getComputedStyle(chip(".ground")).backgroundColor;

        expect(AppearanceFixture.contrast(style.color, ground), `${kind}`).toBeGreaterThanOrEqual(4.5);
      }
      const key = getComputedStyle(chip(".key"));

      expect(AppearanceFixture.contrast(key.color, key.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
});
