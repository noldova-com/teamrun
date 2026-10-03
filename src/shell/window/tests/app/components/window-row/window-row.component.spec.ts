/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("WindowRowComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and height from the ${theme.id} theme in ${mode} mode`, () => {
        DesktopBridgeFixture.install();
        AppearanceFixture.apply(theme, mode);

        const style = getComputedStyle(render());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "titleBar.activeBackground"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "titleBar.activeForeground"));
        AppearanceFixture.expectLook(style.height, theme, "window-row-height", "height");
      });

  it("is a drag region that leaves the native controls' space free on Windows and Linux", () => {
    DesktopBridgeFixture.install("win32");
    AppearanceFixture.apply();

    const row = render();
    const style = getComputedStyle(row);

    expect(row.classList.contains("tr-window-row-mac")).toBe(false);
    expect(row.getAttribute("data-tr-chrome")).toBe("top");
    expect(style.getPropertyValue("app-region")).toBe("drag");
    expect(style.paddingLeft).toBe("0px");
    expect(style.paddingRight).toBe("0px");
  });

  it("reports its painted colors and height once after the first render", async () => {
    const bridge = DesktopBridgeFixture.install();
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);

    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(bridge.appearances).toEqual([{
      background: getComputedStyle(document.body).backgroundColor,
      titleBar: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "titleBar.activeBackground"),
      titleBarText: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "titleBar.activeForeground"),
      titleBarHeight: Math.round(AppearanceFixture.toPixels(2.1875))
    }]);
  });

  it("leaves the traffic lights' space free on macOS", () => {
    DesktopBridgeFixture.install("darwin");
    AppearanceFixture.apply();

    const row = render();

    expect(row.classList.contains("tr-window-row-mac")).toBe(true);
    expect(getComputedStyle(row).paddingLeft).toBe("78px");
  });
});
