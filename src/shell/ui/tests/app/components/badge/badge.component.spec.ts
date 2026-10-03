/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { BadgeComponent } from "../../../../src/app/components/badge/badge.component";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [BadgeComponent],
  template: `<tr-badge [count]="count()" />`
})
class BadgeHostComponent {
  public readonly count = signal<number | null>(3);
}

describe("BadgeComponent", () => {
  let fixture: ComponentFixture<BadgeHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(BadgeHostComponent);
    await fixture.whenStable();
  });

  afterEach(() => AppearanceFixture.reset());

  function badge(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-badge");
  }

  async function showAsync(count: number | null): Promise<void> {
    fixture.componentInstance.count.set(count);
    await fixture.whenStable();
  }

  it("shows a count up to 99, then 99+, and a dot for no count, hidden from assistive technology", async () => {
    const shown: string[] = [];
    for (const count of [3, 99, 100])
      shown.push(await showAsync(count).then(() => badge().textContent?.trim() ?? ""));
    await showAsync(null);

    expect(shown).toEqual(["3", "99", "99+"]);
    expect([badge().textContent?.trim(), badge().classList.contains("tr-badge-dot"), badge().getAttribute("aria-hidden")]).toEqual(["", true, "true"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its size and the primary-button colors from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(badge());

        expect([style.backgroundColor, style.color]).toEqual([AppearanceFixture.readColor(theme, mode, "button.background"), AppearanceFixture.readColor(theme, mode, "button.foreground")]);
        AppearanceFixture.expectLook(style.height, theme, "badge", "height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "badge-padding", "padding-left");
        AppearanceFixture.expectLook(style.fontSize, theme, "badge-text", "font-size");
        await showAsync(null);
        AppearanceFixture.expectLook(getComputedStyle(badge()).width, theme, "badge-dot", "width");
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its count at least 4.5:1 against its fill in ${mode} mode`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const style = getComputedStyle(badge());

      expect(AppearanceFixture.contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
});
