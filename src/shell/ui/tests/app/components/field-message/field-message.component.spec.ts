/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { FieldMessageComponent } from "../../../../src/app/components/field-message/field-message.component";
import { TextFieldComponent } from "../../../../src/app/components/text-field/text-field.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [FieldMessageComponent, TextFieldComponent],
  template: `
    <div class="field" style="width: 8rem">
      <input tr-text-field type="text" aria-label="Name" aria-invalid="true" aria-describedby="name-error" />
      <tr-field-message id="name-error">Names have at most 20 characters, such as notes_reminder_schedule_long.</tr-field-message>
    </div>
  `
})
class FieldMessageHostComponent {
}

describe("FieldMessageComponent", () => {
  let fixture: ComponentFixture<FieldMessageHostComponent>;

  function render(theme = AppearanceFixture.themes[0], mode = AppearanceFixture.modes[0]): void {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(FieldMessageHostComponent);
    fixture.detectChanges();
  }

  const message = (): HTMLElement => fixture.nativeElement.querySelector("tr-field-message");
  const field = (): HTMLInputElement => fixture.nativeElement.querySelector("input");

  afterEach(() => AppearanceFixture.reset());

  it("is an alert below the field that describes it, wrapping anywhere within the field's width rather than widen it", () => {
    render();
    const container = fixture.nativeElement.querySelector(".field") as HTMLElement;

    expect([message().getAttribute("role"), message().classList.contains("tr-field-message"), field().getAttribute("aria-describedby")]).toEqual(["alert", true, message().id]);
    expect(message().getBoundingClientRect().top).toBeGreaterThanOrEqual(field().getBoundingClientRect().bottom);
    expect(getComputedStyle(message()).overflowWrap).toBe("anywhere");
    expect(message().getClientRects().length === 1 && message().getBoundingClientRect().height > Number.parseFloat(getComputedStyle(message()).lineHeight)).toBe(true);
    expect(container.scrollWidth).toBe(container.clientWidth);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes the error color and its gap below the field from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const style = getComputedStyle(message());

        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "errorForeground"));
        AppearanceFixture.expectLook(style.marginTop, theme, "space-1", "margin-top");
      });
});
