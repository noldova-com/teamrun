/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { TextFieldComponent } from "../../../../src/app/components/text-field/text-field.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [TextFieldComponent],
  template: `
    <input class="search" tr-text-field type="search" aria-label="Search settings" placeholder="Search settings" />
    <input class="size" tr-text-field type="number" aria-label="Panel size" min="12" max="18" disabled />
    <input class="ratio" tr-text-field type="number" aria-label="Ratio" aria-invalid="true" />
  `
})
class TextFieldHostComponent {}

describe("TextFieldComponent", () => {
  let fixture: ComponentFixture<TextFieldHostComponent>;

  function render(theme = DefaultTheme.theme, mode = ThemeMode.Light): void {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(TextFieldHostComponent);
    fixture.detectChanges();
  }

  const field = (name: string): HTMLInputElement => fixture.nativeElement.querySelector(`input.${name}`);

  afterEach(() => AppearanceFixture.reset());

  it("keeps the native input, takes the accent border while focused and dims while disabled", () => {
    render();

    field("search").focus();

    expect(field("search").classList.contains("tr-text-field")).toBe(true);
    expect(getComputedStyle(field("search")).borderTopColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "focusBorder"));
    expect([getComputedStyle(field("size")).opacity, getComputedStyle(field("size")).cursor]).toEqual(["0.5", "default"]);
  });

  it("keeps the error border while invalid, focused or not", () => {
    render();
    const error = AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "errorForeground");
    const unfocused = getComputedStyle(field("ratio")).borderTopColor;

    field("ratio").focus();

    expect([unfocused, getComputedStyle(field("ratio")).borderTopColor]).toEqual([error, error]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const style = getComputedStyle(field("search"));

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "input.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "input.border"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "input.foreground"));
        expect(getComputedStyle(field("search"), "::placeholder").color).toBe(AppearanceFixture.readColor(theme, mode, "input.placeholderForeground"));
        AppearanceFixture.expectLook(style.minHeight, theme, "field-height", "min-height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "field-padding", "padding-left");
        AppearanceFixture.expectLook(style.width, theme, "text-field-width", "width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
      });
});
