/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { userEvent } from "vitest/browser";

import { ThemeMode } from "../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../src/app/themes/default-theme";
import { AppearanceFixture } from "../fixtures/appearance.fixture";

@Component({
  imports: [MatMenu, MatMenuItem, MatMenuTrigger],
  template: `
    <button type="button" [matMenuTriggerFor]="menu">Panel actions</button>
    <mat-menu #menu="matMenu">
      <div class="tr-menu-label">Move to</div>
      <button type="button" mat-menu-item>Left dock</button>
      <button type="button" mat-menu-item disabled>Right dock</button>
    </mat-menu>
  `
})
class MenuHostComponent {
}

describe("kit styles", () => {
  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    AppearanceFixture.reset();
  });

  async function openMenu(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(document.querySelector(".mat-mdc-menu-panel")).not.toBeNull());
    const panel = document.querySelector<HTMLElement>(".mat-mdc-menu-panel") ?? document.body;
    await vi.waitFor(() => expect(getComputedStyle(panel).opacity).toBe("1"));
    return panel;
  }

  it("load the Noldova fonts and the rounded symbols", async () => {
    const sans = await document.fonts.load("400 13px \"Noldova Sans\"");
    const sansItalic = await document.fonts.load("italic 600 13px \"Noldova Sans\"");
    const mono = await document.fonts.load("400 13px \"Noldova Mono\"");
    const symbols = await document.fonts.load("16px \"Material Symbols Rounded\"", "close");

    expect([sans.length, sansItalic.length, mono.length, symbols.length].every(t => t > 0)).toBe(true);
  });

  it("give headings a line height that cannot overlap when they wrap", () => {
    AppearanceFixture.apply();
    const area = document.createElement("div");
    area.style.cssText = "width: 160px;";
    area.innerHTML = "<h1>A very long heading that keeps going past one line</h1><h2>A second-level heading that also wraps</h2>";
    document.body.append(area);

    try {
      for (const heading of area.querySelectorAll<HTMLElement>("h1, h2")) {
        const style = getComputedStyle(heading);
        const lineHeight = parseFloat(style.lineHeight);
        expect(lineHeight).toBeGreaterThanOrEqual(parseFloat(style.fontSize) * 1.25);
        expect(heading.getBoundingClientRect().height).toBeGreaterThanOrEqual(lineHeight * 2);
      }
      const h1 = getComputedStyle(area.querySelector("h1") ?? area);
      const root = getComputedStyle(document.documentElement);
      expect(h1.fontSize).toBe(`${parseFloat(root.getPropertyValue("--tr-text-panel")) * parseFloat(root.fontSize) * 2}px`);
    }
    finally {
      area.remove();
    }
  });

  for (const theme of AppearanceFixture.themes)
    it(`give scroll areas thin scrollbars without arrows whose thumb shows on hover, with the ${theme.id} theme`, async () => {
      AppearanceFixture.apply(theme, ThemeMode.Light);
      const area = document.createElement("div");
      area.className = "tr-scroll-reveal";
      area.style.cssText = "position: fixed; top: 0; left: 0; width: 200px; height: 120px; overflow: scroll;";
      const content = document.createElement("div");
      content.style.cssText = "width: 600px; height: 600px;";
      area.append(content);
      document.body.append(area);

      try {
        const scrollbar = getComputedStyle(area, "::-webkit-scrollbar");
        AppearanceFixture.expectLook(scrollbar.width, theme, "scrollbar-size", "width");
        AppearanceFixture.expectLook(scrollbar.height, theme, "scrollbar-size", "height");
        expect(getComputedStyle(area, "::-webkit-scrollbar-button").display).toBe("none");
        expect(getComputedStyle(area).color).toBe("rgba(0, 0, 0, 0)");
        await userEvent.hover(area);
        const probe = document.createElement("div");
        probe.style.color = "var(--tr-scrollbar)";
        document.body.append(probe);
        const thumb = getComputedStyle(probe).color;
        probe.remove();
        expect(thumb).not.toBe("rgba(0, 0, 0, 0)");
        await vi.waitFor(() => expect(getComputedStyle(area).color).toBe(thumb));
      }
      finally {
        area.remove();
      }
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`style the page and menus with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const body = getComputedStyle(document.body);

        expect(body.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "sideBar.background"));
        expect(body.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));

        const panel = await openMenu();
        const style = getComputedStyle(panel);
        const item = panel.querySelector<HTMLElement>(".mat-mdc-menu-item") ?? panel;
        const label = panel.querySelector<HTMLElement>(".tr-menu-label") ?? panel;

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.border"));
        AppearanceFixture.expectLook(style.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(panel.querySelector(".mat-mdc-menu-content") ?? panel).paddingTop, theme, "menu-padding", "padding-top");
        AppearanceFixture.expectLook(getComputedStyle(item).minHeight, theme, "menu-item-height", "min-height");
        AppearanceFixture.expectLook(getComputedStyle(item).marginLeft, theme, "menu-item-inset", "margin-left");
        AppearanceFixture.expectLook(getComputedStyle(item).paddingLeft, theme, "menu-item-padding", "padding-left");
        AppearanceFixture.expectLook(getComputedStyle(item).borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        expect(getComputedStyle(item).color).toBe(AppearanceFixture.readColor(theme, mode, "menu.foreground"));
        expect(getComputedStyle(label).color).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.mutedForeground"));
        AppearanceFixture.expectLook(getComputedStyle(label).paddingLeft, theme, "menu-label-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(getComputedStyle(label).paddingTop, theme, "menu-label-padding", "padding-top", "padding");
      });

  it("keep a disabled menu item inoperable and without a pointer", async () => {
    AppearanceFixture.apply();

    const panel = await openMenu();
    const disabled = panel.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-item")[1];

    expect(disabled?.disabled).toBe(true);
    expect(getComputedStyle(disabled ?? panel).cursor).toBe("default");
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scale menu items with panel size ${panelSize}`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

      const panel = await openMenu();
      const item = panel.querySelector<HTMLElement>(".mat-mdc-menu-item") ?? panel;

      AppearanceFixture.expectRem(getComputedStyle(item).minHeight, 1.625, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(item).fontSize, 0.8125, panelSize);
    });
});
