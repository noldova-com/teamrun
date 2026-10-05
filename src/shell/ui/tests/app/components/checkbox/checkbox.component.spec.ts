/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import { CheckboxComponent } from "../../../../src/app/components/checkbox/checkbox.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [CheckboxComponent],
  template: `
    <tr-checkbox class="labelled" [checked]="checked()" [disabled]="disabled()" (checkedChange)="changes.push($event)">Do not disturb</tr-checkbox>
    <tr-checkbox class="bare" [checked]="true" />
  `
})
class CheckboxHostComponent {
  public readonly checked = signal(false);
  public readonly disabled = signal(false);
  public readonly changes: boolean[] = [];
}

describe("CheckboxComponent", () => {
  let fixture: ComponentFixture<CheckboxHostComponent>;

  function render(theme = DefaultTheme.theme, mode = ThemeMode.Light, panelSize?: number): void {
    AppearanceFixture.apply(theme, mode, panelSize);
    fixture = TestBed.createComponent(CheckboxHostComponent);
    fixture.detectChanges();
  }

  const box = (name: string): HTMLInputElement => fixture.nativeElement.querySelector(`tr-checkbox.${name} input`);
  const mark = (name: string): SVGSVGElement => fixture.nativeElement.querySelector(`tr-checkbox.${name} .tr-checkbox-mark`);
  const tick = (name: string): SVGPathElement => fixture.nativeElement.querySelector(`tr-checkbox.${name} .tr-checkbox-mark path`);

  afterEach(() => AppearanceFixture.reset());

  it("is a native checkbox named by its label that reports each change, shows its mark only while checked and ignores clicks while disabled", async () => {
    render();

    const markWhileUnchecked = getComputedStyle(mark("labelled")).visibility;
    await page.getByRole("checkbox", { name: "Do not disturb" }).click();
    fixture.componentInstance.checked.set(true);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    box("labelled").click();

    expect(fixture.componentInstance.changes).toEqual([true]);
    expect(markWhileUnchecked).toBe("hidden");
    expect([getComputedStyle(mark("labelled")).visibility, box("labelled").checked]).toEqual(["visible", true]);
    expect([getComputedStyle(box("labelled")).opacity, getComputedStyle(mark("labelled")).opacity]).toEqual(["0.5", "0.5"]);
    expect(getComputedStyle(mark("bare")).opacity).toBe("1");
    expect(mark("labelled").getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(fixture.nativeElement.querySelector("tr-checkbox.bare .tr-checkbox-text")).display).toBe("none");
  });

  it("shows the focus outline only on keyboard focus", async () => {
    render();

    await page.getByRole("checkbox", { name: "Do not disturb" }).click();
    const pointerOutline = [document.activeElement === box("labelled"), getComputedStyle(box("labelled")).outlineStyle];
    await userEvent.tab();
    const style = getComputedStyle(box("bare"));

    expect(pointerOutline).toEqual([true, "none"]);
    expect(document.activeElement).toBe(box("bare"));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "focusBorder"));
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`centres the drawn tick in the box at panel size ${panelSize}`, () => {
      render(DefaultTheme.theme, ThemeMode.Light, panelSize);
      const outer = box("bare").getBoundingClientRect();
      const drawn = tick("bare").getBoundingClientRect();
      const icon = mark("bare").getBoundingClientRect();

      AppearanceFixture.expectPixels((drawn.left + drawn.right) / 2, (outer.left + outer.right) / 2);
      AppearanceFixture.expectPixels((drawn.top + drawn.bottom) / 2, (outer.top + outer.bottom) / 2);
      expect(drawn.width).toBeGreaterThan(outer.width / 2);
      expect([drawn.left > outer.left, drawn.right < outer.right, drawn.top > outer.top, drawn.bottom < outer.bottom]).toEqual([true, true, true, true]);
      AppearanceFixture.expectLook(`${icon.width}px`, DefaultTheme.theme, "icon", "width");
      AppearanceFixture.expectLook(`${icon.height}px`, DefaultTheme.theme, "icon", "height");
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and size from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const style = getComputedStyle(box("bare"));
        const markStyle = getComputedStyle(mark("bare"));

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "checkbox.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "checkbox.border"));
        expect([markStyle.color, markStyle.stroke, markStyle.fill]).toEqual([AppearanceFixture.readColor(theme, mode, "foreground"), markStyle.color, "none"]);
        AppearanceFixture.expectLook(style.width, theme, "checkbox-size", "width");
        AppearanceFixture.expectLook(style.height, theme, "checkbox-size", "height");
        AppearanceFixture.expectLook(markStyle.width, theme, "icon", "width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
      });
});
