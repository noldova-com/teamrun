/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { InlineCodeComponent } from "../../../../src/app/components/inline-code/inline-code.component";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

@Component({
  imports: [InlineCodeComponent],
  template: `
    <p class="panel">Set <code tr-inline-code>EDITOR</code> to choose the editor.</p>
    <p class="plain">Set EDITOR to choose the editor.</p>
    <p class="message plain-message">Set EDITOR to choose the editor.</p>
    <p class="message">Set <code tr-inline-code>EDITOR</code> to choose the editor.</p>
    <p class="narrow">Set <code tr-inline-code>shell.notifications.fromModules.notesReminderSchedule</code> here.</p>
  `,
  styles: [
    "p { margin: 0; width: 30rem; background-color: var(--tr-panel); }",
    ".message { font-size: var(--tr-text-message); line-height: var(--tr-line-message); }",
    ".narrow { width: 8rem; }"
  ]
})
class InlineCodeHostComponent {
}

describe("InlineCodeComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(InlineCodeHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const code = (root: HTMLElement, line: string): HTMLElement => root.querySelector(`.${line} code`) as HTMLElement;

  function blend(over: string, ground: string): string {
    const scale = over.startsWith("color(") ? 255 : 1;
    const [red = 0, green = 0, blue = 0, alpha = 1] = (over.match(/[\d.]+/gu) ?? []).map(Number);
    const base = (ground.match(/[\d.]+/gu) ?? []).map(Number);
    return `rgb(${[red, green, blue].map((t, i) => t * scale * alpha + (base[i] ?? 0) * (1 - alpha)).join(", ")})`;
  }

  it("takes the code font at the size of the text around it, and its line is no taller than one without it", () => {
    AppearanceFixture.apply();
    const root = render();

    for (const line of ["panel", "message"]) {
      const style = getComputedStyle(code(root, line));
      const around = getComputedStyle(root.querySelector(`.${line}`) as Element);

      expect([style.fontFamily, style.fontSize], line).toEqual([getComputedStyle(document.documentElement).getPropertyValue("--tr-font-mono"), around.fontSize]);
    }
    expect(root.querySelector(".panel")?.getBoundingClientRect().height).toBe(root.querySelector(".plain")?.getBoundingClientRect().height);
    expect(root.querySelector(".message:not(.plain-message)")?.getBoundingClientRect().height).toBe(root.querySelector(".plain-message")?.getBoundingClientRect().height);
  });

  it("wraps a name too long for its line anywhere, rather than widen the line", () => {
    const root = render();
    const narrow = root.querySelector(".narrow") as HTMLElement;

    expect(getComputedStyle(code(root, "narrow")).overflowWrap).toBe("anywhere");
    expect(narrow.scrollWidth).toBe(narrow.clientWidth);
    expect(code(root, "narrow").getClientRects().length).toBeGreaterThan(1);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes the inline-code background, the small radius and side padding and fully opaque text from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const root = render();
        const style = getComputedStyle(code(root, "panel"));

        expect(style.backgroundColor).toBe(GalleryFixture.colorOf(root, "background-color", `color-mix(in srgb, ${AppearanceFixture.readColor(theme, mode, "foreground")} 12%, transparent)`));
        expect([style.color, style.opacity]).toEqual([AppearanceFixture.readColor(theme, mode, "foreground"), "1"]);
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "space-1", "padding-left");
        AppearanceFixture.expectLook(style.paddingRight, theme, "space-1", "padding-right");
        expect([style.paddingTop, style.paddingBottom]).toEqual(["0px", "0px"]);
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its text at least 4.5:1 against its background on the panel in ${mode} mode`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);

      const root = render();
      const style = getComputedStyle(code(root, "panel"));
      const ground = getComputedStyle(root.querySelector(".panel") as Element).backgroundColor;

      expect(AppearanceFixture.contrast(style.color, blend(style.backgroundColor, ground))).toBeGreaterThanOrEqual(4.5);
    });
});
