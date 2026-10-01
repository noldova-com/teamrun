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

import { IconButtonComponent } from "../../../../src/app/components/icon-button/icon-button.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [IconButtonComponent],
  template: `
    <button type="button" tr-icon-button icon="more_horiz" label="More actions" [pressed]="pressed()" [disabled]="disabled()" (click)="presses = presses + 1">
    </button>
  `
})
class IconButtonHostComponent {
  public readonly pressed = signal<boolean | undefined>(undefined);
  public readonly disabled = signal(false);
  public presses: number = 0;
}

describe("IconButtonComponent", () => {
  let fixture: ComponentFixture<IconButtonHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(IconButtonHostComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("button");
  }

  function pad(): CSSStyleDeclaration {
    return getComputedStyle(button(), "::before");
  }

  it("is a native button named by its label, with its glyph hidden from assistive technology", () => {
    button().click();

    expect(fixture.componentInstance.presses).toBe(1);
    expect(button().getAttribute("aria-label")).toBe("More actions");
    expect(button().hasAttribute("aria-pressed")).toBe(false);
    expect(button().querySelector(".tr-icon-button-glyph")?.textContent).toBe("more_horiz");
    expect(button().querySelector(".tr-icon-button-glyph")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes its pressed state and shows it with the hover fill", () => {
    fixture.componentInstance.pressed.set(true);
    fixture.detectChanges();

    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(pad().backgroundColor).toBe("rgba(184, 184, 184, 0.314)");

    fixture.componentInstance.pressed.set(false);
    fixture.detectChanges();

    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(pad().backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("shows the toolbar hover fill on hover but not when disabled", async () => {
    await userEvent.hover(button());

    expect(pad().backgroundColor).toBe("rgba(184, 184, 184, 0.314)");

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(pad().backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(button()).cursor).toBe("default");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its glyph color and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        expect(getComputedStyle(button()).color).toBe(AppearanceFixture.readColor(theme, mode, "icon.foreground"));
        AppearanceFixture.expectLook(pad().width, theme, "icon-button", "width");
        AppearanceFixture.expectLook(pad().borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(button().querySelector(".tr-icon-button-glyph") ?? button()).fontSize, theme, "icon", "font-size");
      });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`keeps a pointer target of at least 24 pixels at panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

      const bounds = button().getBoundingClientRect();

      AppearanceFixture.expectRem(pad().width, 1.375, panelSize);
      expect(bounds.width).toBeGreaterThanOrEqual(24);
      expect(bounds.height).toBeGreaterThanOrEqual(24);
      AppearanceFixture.expectPixels(bounds.width, Math.max(24, AppearanceFixture.toPixels(1.375, panelSize)));
    });
});
