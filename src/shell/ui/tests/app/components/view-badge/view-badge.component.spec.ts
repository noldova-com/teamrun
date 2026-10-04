/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ViewBadgeComponent } from "../../../../src/app/components/view-badge/view-badge.component";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ViewBadgeComponent],
  template: `<tr-view-badge [count]="count()" />`
})
class ViewBadgeHostComponent {
  public readonly count = signal<number | null>(3);
}

describe("ViewBadgeComponent", () => {
  let fixture: ComponentFixture<ViewBadgeHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ViewBadgeHostComponent);
    await fixture.whenStable();
  });

  afterEach(() => AppearanceFixture.reset());

  function badge(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-view-badge");
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
    expect([badge().textContent?.trim(), badge().classList.contains("tr-view-badge-dot"), badge().getAttribute("aria-hidden")]).toEqual(["", true, "true"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its size and the primary-button colors from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(badge());

        expect([style.backgroundColor, style.color]).toEqual([AppearanceFixture.readColor(theme, mode, "button.background"), AppearanceFixture.readColor(theme, mode, "button.foreground")]);
        AppearanceFixture.expectLook(style.height, theme, "view-badge", "height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "view-badge-padding", "padding-left");
        AppearanceFixture.expectLook(style.fontSize, theme, "view-badge-text", "font-size");
        await showAsync(null);
        AppearanceFixture.expectLook(getComputedStyle(badge()).width, theme, "view-badge-dot", "width");
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its count at least 4.5:1 against its fill in ${mode} mode`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const style = getComputedStyle(badge());

      expect(AppearanceFixture.contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
});
