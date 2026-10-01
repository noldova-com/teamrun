/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltip } from "@angular/material/tooltip";
import { userEvent } from "vitest/browser";

import { KitProviders } from "../../src/app/kit-providers";
import { AppearanceFixture } from "../fixtures/appearance.fixture";

@Component({
  imports: [MatTooltip],
  template: `<button type="button" matTooltip="Split the group to the right" [style.margin-top]="'12rem'">Split</button>`
})
class TooltipHostComponent {
}

describe("KitProviders", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...KitProviders.providers] });
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  it("place tooltips above their anchor without a delay", () => {
    expect(TestBed.inject(MAT_TOOLTIP_DEFAULT_OPTIONS)).toEqual({ showDelay: 0, hideDelay: 0, touchendHideDelay: 1500, position: "above" });
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`shows a tooltip above its anchor with the ${theme.id} theme's surface and geometry in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = TestBed.createComponent(TooltipHostComponent);
        fixture.detectChanges();
        const button: HTMLElement = fixture.nativeElement.querySelector("button");

        await userEvent.hover(button);
        await vi.waitFor(() => expect(document.querySelector(".mat-mdc-tooltip-surface")).not.toBeNull());
        const surface = document.querySelector<HTMLElement>(".mat-mdc-tooltip-surface") ?? button;
        await vi.waitFor(() => expect(getComputedStyle(surface).opacity).toBe("1"));
        const style = getComputedStyle(surface);

        expect(surface.textContent?.trim()).toBe("Split the group to the right");
        expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(button.getBoundingClientRect().top);
        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "editorHoverWidget.background"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        AppearanceFixture.expectLook(style.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
        AppearanceFixture.expectLook(style.paddingTop, theme, "tooltip-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "tooltip-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(style.boxShadow, theme, "shadow-large", "box-shadow");
        AppearanceFixture.expectLook(style.maxWidth, theme, "tooltip-width", "max-width");
      });
});
