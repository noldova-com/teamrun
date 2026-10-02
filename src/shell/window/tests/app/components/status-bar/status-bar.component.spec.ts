/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { StatusBarComponent } from "../../../../src/app/components/status-bar/status-bar.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("StatusBarComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("has an empty left and right side", () => {
    const bar = render();

    expect([...bar.children].map(t => t.className)).toEqual(["tr-status-bar-side tr-status-bar-left", "tr-status-bar-side tr-status-bar-right"]);
    expect(bar.textContent).toBe("");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const bar = render();
        const style = getComputedStyle(bar);
        const side = getComputedStyle(bar.children[0] ?? bar);

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "sideBar.background"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        AppearanceFixture.expectLook(style.minHeight, theme, "status-bar-height", "min-height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "status-bar-inset", "padding-left");
        AppearanceFixture.expectLook(style.paddingRight, theme, "status-bar-inset", "padding-right");
        AppearanceFixture.expectLook(side.columnGap, theme, "status-bar-item-gap", "column-gap");
      });
});
