/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CardComponent } from "../../../../src/app/components/card/card.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [CardComponent],
  template: `
    <div class="frame"><tr-card class="short"><strong>Sync is paused</strong><p class="line">Changes stay here.</p></tr-card></div>
    <div class="narrow"><tr-card class="long">shell.notifications.fromModules.notesReminderSchedule</tr-card></div>
  `,
  styles: [".frame { width: 20rem; } .narrow { width: 8rem; } .line { margin: 0; }"]
})
class CardHostComponent {
}

describe("CardComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(CardHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const card = (root: HTMLElement, name: string): HTMLElement => root.querySelector(`tr-card.${name}`) as HTMLElement;

  it("projects its content and is as tall as it, filling the width it is given", () => {
    const root = render();
    const short = card(root, "short");
    const style = getComputedStyle(short);
    const content = root.querySelector(".line")?.getBoundingClientRect().bottom ?? 0;

    expect(short.textContent).toBe("Sync is paused" + "Changes stay here.");
    expect(short.getBoundingClientRect().width).toBe(root.querySelector(".frame")?.getBoundingClientRect().width);
    AppearanceFixture.expectPixels(short.getBoundingClientRect().bottom, content + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth));
  });

  it("wraps a word too long for it inside it rather than widen it", () => {
    const root = render();
    const long = card(root, "long");

    expect(long.getBoundingClientRect().width).toBe(root.querySelector(".narrow")?.getBoundingClientRect().width);
    expect(long.scrollWidth).toBe(long.clientWidth);
    expect(long.getBoundingClientRect().height).toBeGreaterThan(2 * Number.parseFloat(getComputedStyle(long).lineHeight));
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its surface, border, radius, padding and message text from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const style = getComputedStyle(card(render(), "short"));
        const root = getComputedStyle(document.documentElement);

        expect([style.backgroundColor, style.borderTopColor, style.borderTopStyle, style.color])
          .toEqual([AppearanceFixture.readColor(theme, mode, "teamrun.raisedBackground"), AppearanceFixture.readColor(theme, mode, "surface.border"), "solid", AppearanceFixture.readColor(theme, mode, "foreground")]);
        AppearanceFixture.expectLook(style.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        for (const side of ["top", "right", "bottom", "left"])
          AppearanceFixture.expectLook(style.getPropertyValue(`padding-${side}`), theme, "space-3", `padding-${side}`);
        expect(style.fontSize).toBe(root.getPropertyValue("--tr-text-message"));
        expect(Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize)).toBeCloseTo(Number(root.getPropertyValue("--tr-line-message")));
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its text at least 4.5:1 against its surface in ${mode} mode`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);

      const style = getComputedStyle(card(render(), "short"));

      expect(AppearanceFixture.contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });

  it("scales its radius and padding with the panel size while its border keeps one pixel", () => {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, 16);

    const style = getComputedStyle(card(render(), "short"));

    AppearanceFixture.expectRem(style.borderTopLeftRadius, 0.375, 16);
    AppearanceFixture.expectRem(style.paddingTop, 0.75, 16);
    expect(style.borderTopWidth).toBe("1px");
  });
});
