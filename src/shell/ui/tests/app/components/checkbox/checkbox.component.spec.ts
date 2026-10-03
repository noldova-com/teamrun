/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page } from "vitest/browser";

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

  function render(theme = DefaultTheme.theme, mode = ThemeMode.Light): void {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(CheckboxHostComponent);
    fixture.detectChanges();
  }

  const box = (name: string): HTMLInputElement => fixture.nativeElement.querySelector(`tr-checkbox.${name} input`);
  const mark = (name: string): HTMLElement => fixture.nativeElement.querySelector(`tr-checkbox.${name} .tr-checkbox-mark`);

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
    expect(getComputedStyle(box("labelled")).opacity).toBe("0.5");
    expect(getComputedStyle(fixture.nativeElement.querySelector("tr-checkbox.bare .tr-checkbox-text")).display).toBe("none");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and size from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const style = getComputedStyle(box("bare"));

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "checkbox.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "checkbox.border"));
        AppearanceFixture.expectLook(style.width, theme, "checkbox-size", "width");
        AppearanceFixture.expectLook(style.height, theme, "checkbox-size", "height");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
      });
});
