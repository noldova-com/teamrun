/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { MenuItemComponent } from "../../src/app/components/menu/menu-item.component";
import { MenuSeparatorComponent } from "../../src/app/components/menu/menu-separator.component";
import { MenuComponent } from "../../src/app/components/menu/menu.component";
import { ThemeMode } from "../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../src/app/models/default-theme";
import { AppearanceFixture } from "../fixtures/appearance.fixture";
import { MotionFixture } from "../fixtures/motion.fixture";

@Component({
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent],
  template: `
    <tr-menu>
      <div class="tr-menu-label">Move to</div>
      <button tr-menu-item label="Left dock" icon="dock_to_left"></button>
      <tr-menu-separator />
      <button tr-menu-item label="Right dock" [disabled]="true"></button>
    </tr-menu>
  `
})
class MenuHostComponent {
}

@Component({
  imports: [MenuComponent, MenuItemComponent],
  template: `
    <tr-menu>
      <button tr-menu-item label="Files"></button>
      <button tr-menu-item label="Search"></button>
    </tr-menu>
  `
})
class TextMenuHostComponent {
}

describe("kit styles", () => {
  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    AppearanceFixture.reset();
  });

  async function openMenu(host: typeof MenuHostComponent | typeof TextMenuHostComponent = MenuHostComponent): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement.querySelector("tr-menu");
  }

  it("load the Noldova fonts and the rounded symbols", async () => {
    const sans = await document.fonts.load("400 13px \"Noldova Sans\"");
    const sansItalic = await document.fonts.load("italic 600 13px \"Noldova Sans\"");
    const mono = await document.fonts.load("400 13px \"Noldova Mono\"");
    const symbols = await document.fonts.load("16px \"Material Symbols Rounded\"", "close");

    expect([sans.length, sansItalic.length, mono.length, symbols.length].every(t => t > 0)).toBe(true);
  });

  it("hide the live announcer's region from sight before any dialog has opened, so a long announcement neither shows nor makes the page scroll", async () => {
    const text = "A notification with a title and a text long enough to wrap onto several lines if it were laid out. ".repeat(20);
    void TestBed.inject(LiveAnnouncer).announce(text);
    await vi.waitFor(() => expect(document.querySelector(".cdk-live-announcer-element")?.textContent).toBe(text));
    const region = document.querySelector(".cdk-live-announcer-element") as HTMLElement;
    const box = region.getBoundingClientRect();

    expect([box.width, box.height, getComputedStyle(region).position, getComputedStyle(region).overflow]).toEqual([1, 1, "absolute", "hidden"]);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
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
    it(`give every scroll area, without a class, thin scrollbars without arrows whose thumb shows on hover while it and its content keep the text color, with the ${theme.id} theme`, async () => {
      AppearanceFixture.apply(theme, ThemeMode.Light);
      const area = document.createElement("div");
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
        const text = AppearanceFixture.readColor(theme, ThemeMode.Light, "foreground");
        await AppearanceFixture.expectThumbRevealsOnHoverAsync(area);
        expect([getComputedStyle(area).transitionProperty, getComputedStyle(area).color, getComputedStyle(content).color]).toEqual(["--tr-scroll-thumb", text, text]);
      }
      finally {
        area.remove();
      }
    });

  it("fade a scroll area's thumb in over 150 ms, and show it at once when reduced motion is preferred", async () => {
    AppearanceFixture.apply();
    const area = document.body.appendChild(document.createElement("div"));
    area.style.cssText = "position: fixed; top: 0; left: 0; width: 200px; height: 120px; overflow: scroll;";
    area.appendChild(document.createElement("div")).style.cssText = "height: 600px;";
    const timing = (): string[] => [getComputedStyle(area).transitionDuration, getComputedStyle(area).transitionTimingFunction];

    try {
      const fading = timing();
      await MotionFixture.reduceAsync();
      const reduced = timing();
      await AppearanceFixture.expectThumbRevealsOnHoverAsync(area);

      expect([fading, reduced, area.getAnimations()]).toEqual([["0.15s", "linear"], ["0s", "ease"], []]);
    }
    finally {
      area.remove();
      await MotionFixture.resetAsync();
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
        const item = panel.querySelector<HTMLElement>("[tr-menu-item]") ?? panel;
        const fill = getComputedStyle(item, "::before");
        const label = panel.querySelector<HTMLElement>(".tr-menu-label") ?? panel;
        const separator = getComputedStyle(panel.querySelector("tr-menu-separator") ?? panel);

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.background"));
        expect(style.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.border"));
        AppearanceFixture.expectLook(style.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(style.paddingTop, theme, "menu-padding", "padding-top");
        AppearanceFixture.expectLook(getComputedStyle(item).minHeight, theme, "menu-item-height", "min-height");
        AppearanceFixture.expectLook(fill.left, theme, "menu-item-inset", "margin-left");
        AppearanceFixture.expectLook(`${Number.parseFloat(getComputedStyle(item).paddingLeft) - Number.parseFloat(fill.left)}px`, theme, "menu-item-padding", "padding-left");
        AppearanceFixture.expectLook(fill.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(separator.marginTop, theme, "menu-separator-spacing", "margin-top");
        AppearanceFixture.expectLook(separator.height, theme, "border-width", "border-top-width");
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.backgroundColor = "var(--tr-menu-separator)";
        const separatorColor = getComputedStyle(probe).backgroundColor;
        probe.remove();
        expect(separator.backgroundColor).toBe(separatorColor);
        expect(getComputedStyle(item).color).toBe(AppearanceFixture.readColor(theme, mode, "menu.foreground"));
        expect(getComputedStyle(label).color).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.mutedForeground"));
        AppearanceFixture.expectLook(getComputedStyle(label).paddingLeft, theme, "menu-label-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(getComputedStyle(label).paddingTop, theme, "menu-label-padding", "padding-top", "padding");
      });

  it("keep a disabled menu item inoperable and without a pointer", async () => {
    AppearanceFixture.apply();

    const panel = await openMenu();
    const disabled = panel.querySelectorAll<HTMLButtonElement>("[tr-menu-item]")[1];

    expect(disabled?.getAttribute("aria-disabled")).toBe("true");
    expect(getComputedStyle(disabled ?? panel).cursor).toBe("default");
  });

  it("line up a menu row without an icon with the rows that have one, and indent no row in a menu without icons", async () => {
    AppearanceFixture.apply();
    const starts = (panel: HTMLElement): number[] => [...panel.querySelectorAll(".tr-menu-item-label")].map(t => t.getBoundingClientRect().left);

    const [withIcon, withoutIcon] = starts(await openMenu());
    const text = await openMenu(TextMenuHostComponent);
    const item = text.querySelector<HTMLElement>("[tr-menu-item]") ?? text;

    expect(withoutIcon).toBe(withIcon);
    expect(starts(text)).toEqual([0, 1].map(() => item.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(item).paddingLeft)));
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scale menu items with panel size ${panelSize}`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

      const panel = await openMenu();
      const item = panel.querySelector<HTMLElement>("[tr-menu-item]") ?? panel;

      AppearanceFixture.expectRem(getComputedStyle(item).minHeight, 1.625, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(item).fontSize, 0.8125, panelSize);
    });
});
