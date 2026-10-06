/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DockingGuideComponent } from "../../../../src/app/components/docking-guide/docking-guide.component";
import { DockingDirection } from "../../../../src/app/enums/docking-direction";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [DockingGuideComponent],
  template: `<tr-docking-guide [direction]="direction()" [chosen]="chosen()" />`
})
class DockingGuideHostComponent {
  public readonly direction = signal(DockingDirection.Left);
  public readonly chosen = signal(false);
}

describe("DockingGuideComponent", () => {
  let fixture: ComponentFixture<DockingGuideHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(DockingGuideHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => AppearanceFixture.reset());

  function guide(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-docking-guide");
  }

  const expected: readonly (readonly [DockingDirection, string, string])[] = [
    [DockingDirection.Center, "tab", "Add to this group"],
    [DockingDirection.Left, "arrow_back", "Place on the left"],
    [DockingDirection.Right, "arrow_forward", "Place on the right"],
    [DockingDirection.Top, "arrow_upward", "Place above"],
    [DockingDirection.Bottom, "arrow_downward", "Place below"]
  ];

  for (const [direction, glyph, label] of expected)
    it(`names its ${direction} action and shows its glyph`, () => {
      fixture.componentInstance.direction.set(direction);
      fixture.detectChanges();

      expect(guide().getAttribute("role")).toBe("img");
      expect(guide().getAttribute("aria-label")).toBe(label);
      expect(guide().getAttribute("data-direction")).toBe(direction);
      expect(guide().textContent?.trim()).toBe(glyph);
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its surface, accent and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(guide());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.raisedBackground"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "widget.border"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "icon.foreground"));
        AppearanceFixture.expectLook(style.width, theme, "docking-guide", "width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(guide().querySelector(".tr-docking-guide-glyph") ?? guide()).fontSize, theme, "docking-guide-icon", "font-size");

        fixture.componentInstance.chosen.set(true);
        fixture.detectChanges();

        expect(guide().classList.contains("tr-docking-guide-chosen")).toBe(true);
        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "button.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "button.background"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "button.foreground"));
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its glyph at least 3:1 against its surface, idle and chosen, in ${mode} mode`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const style = getComputedStyle(guide());
      const idle = AppearanceFixture.contrast(style.color, style.backgroundColor);

      fixture.componentInstance.chosen.set(true);
      fixture.detectChanges();

      expect(idle).toBeGreaterThanOrEqual(3);
      expect(AppearanceFixture.contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(3);
    });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales with panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

      AppearanceFixture.expectRem(getComputedStyle(guide()).height, 2.5, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(guide().querySelector(".tr-docking-guide-glyph") ?? guide()).fontSize, 1.5, panelSize);
      expect(getComputedStyle(guide()).borderTopWidth).toBe("1px");
    });
});
