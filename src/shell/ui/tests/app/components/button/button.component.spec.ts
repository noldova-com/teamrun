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

import { ButtonComponent } from "../../../../src/app/components/button/button.component";
import { ButtonVariant } from "../../../../src/app/enums/button-variant";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ButtonComponent],
  template: `
    <button type="button" class="primary" tr-button [disabled]="disabled()" (click)="presses = presses + 1">Move aside</button>
    <button type="button" class="secondary" tr-button [variant]="secondary">Wait for it</button>
    <div style="width: 6rem"><button type="button" class="long" tr-button>A label far too long to fit the width its button is given</button></div>
  `
})
class ButtonHostComponent {
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  public readonly disabled = signal(false);
  public presses: number = 0;
}

describe("ButtonComponent", () => {
  let fixture: ComponentFixture<ButtonHostComponent>;

  function render(theme = DefaultTheme.theme, mode = ThemeMode.Light, panelSize?: number): void {
    AppearanceFixture.apply(theme, mode, panelSize);
    fixture = TestBed.createComponent(ButtonHostComponent);
    fixture.detectChanges();
  }

  function button(variant: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`button.${variant}`);
  }

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  it("is a native button with its own text that responds unless disabled", async () => {
    render();

    button("primary").click();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    button("primary").click();

    expect(fixture.componentInstance.presses).toBe(1);
    expect(button("primary").textContent).toBe("Move aside");
    expect(button("primary").classList.contains("tr-button-secondary")).toBe(false);
    expect(button("secondary").classList.contains("tr-button-secondary")).toBe(true);
    expect(getComputedStyle(button("primary")).opacity).toBe("0.5");
    expect(getComputedStyle(button("primary")).cursor).toBe("default");
  });

  it("starts a label too long for its width at its start padding and ends it with an ellipsis, inside the width its parent gives it", () => {
    render();
    const long = button("long");
    const label = long.querySelector("[data-truncates]") as HTMLElement;
    const style = getComputedStyle(long);

    expect(label.classList.contains("tr-button-label")).toBe(true);
    expect(long.getBoundingClientRect().width).toBeCloseTo((long.parentElement as HTMLElement).getBoundingClientRect().width, 1);
    AppearanceFixture.expectPixels(label.getBoundingClientRect().left - long.getBoundingClientRect().left, parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft));
    AppearanceFixture.expectPixels(long.getBoundingClientRect().right - label.getBoundingClientRect().right, parseFloat(style.borderRightWidth) + parseFloat(style.paddingRight));
    expect([label.scrollWidth > label.clientWidth, getComputedStyle(label).textOverflow, getComputedStyle(label).whiteSpace]).toEqual([true, "ellipsis", "nowrap"]);
    expect(button("primary").querySelector("[data-truncates]")?.scrollWidth).toBe(button("primary").querySelector("[data-truncates]")?.clientWidth);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const primary = getComputedStyle(button("primary"));
        const secondary = getComputedStyle(button("secondary"));

        expect(primary.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "button.background"));
        expect(primary.color).toBe(AppearanceFixture.readColor(theme, mode, "button.foreground"));
        expect(secondary.color).toBe(AppearanceFixture.readColor(theme, mode, "button.secondaryForeground"));
        AppearanceFixture.expectLook(primary.minHeight, theme, "button-height", "min-height");
        AppearanceFixture.expectLook(primary.paddingLeft, theme, "button-padding", "padding-left");
        AppearanceFixture.expectLook(primary.paddingRight, theme, "button-padding", "padding-right");
        AppearanceFixture.expectLook(primary.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(primary.borderTopWidth, theme, "border-width", "border-top-width");
      });

  it("uses the hover fills of its variant", async () => {
    render();

    await userEvent.hover(button("primary"));
    expect(getComputedStyle(button("primary")).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "button.hoverBackground"));
    await userEvent.hover(button("secondary"));
    expect(getComputedStyle(button("secondary")).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "button.secondaryHoverBackground"));
  });

  it("shows keyboard focus outside its fill, so the outline never blends into a primary button", async () => {
    render();

    await userEvent.tab();
    const style = getComputedStyle(button("primary"));

    expect(document.activeElement).toBe(button("primary"));
    expect(style.outlineColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "focusBorder"));
    expect(style.outlineOffset).toBe("2px");
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales its height and padding with panel size ${panelSize} while its border keeps one pixel`, () => {
      render(DefaultTheme.theme, ThemeMode.Light, panelSize);
      const style = getComputedStyle(button("primary"));

      AppearanceFixture.expectRem(style.minHeight, 1.625, panelSize);
      AppearanceFixture.expectRem(style.paddingLeft, 0.5, panelSize);
      expect(style.borderTopWidth).toBe("1px");
    });
});
