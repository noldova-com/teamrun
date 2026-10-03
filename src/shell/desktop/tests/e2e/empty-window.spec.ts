/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.use({ desktopVariant: BuildVariantFixture.noModules });

const colors = {
  light: { window: "rgb(248, 248, 248)", panel: "rgb(255, 255, 255)", cardBorder: "rgb(229, 229, 229)", titleBar: "rgb(248, 248, 248)", titleBarText: "rgb(30, 30, 30)", text: "rgb(59, 59, 59)" },
  dark: { window: "rgb(24, 24, 24)", panel: "rgb(31, 31, 31)", cardBorder: "rgb(37, 37, 38)", titleBar: "rgb(24, 24, 24)", titleBarText: "rgb(204, 204, 204)", text: "rgb(204, 204, 204)" }
};

test.describe("the empty window", () => {
  test("TeamRun starts with no module and shows the empty window", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;

    await expect(window).toHaveTitle("TeamRun");
    await expect(window.locator("tr-panel-card")).toHaveCount(1);
    await expect(window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
    expect(await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await desktop.captureMainWindowAsync();
  });

  test("the window has no Node access and only the narrow bridge", async ({ desktop }) => {
    const globals = await desktop.window.evaluate(() => ({
      require: typeof Reflect.get(globalThis, "require"),
      process: typeof Reflect.get(globalThis, "process"),
      module: typeof Reflect.get(globalThis, "module"),
      buffer: typeof Reflect.get(globalThis, "Buffer"),
      bridge: Object.keys(Reflect.get(globalThis, "teamrun") as object).sort()
    }));

    expect(globals).toEqual({ require: "undefined", process: "undefined", module: "undefined", buffer: "undefined", bridge: [
      "actOnStartup", "answerClose", "answerQuit", "copyText", "logModule", "notifyAppearance", "notifyReady", "onCloseRequest", "onEvent", "onMenuCommand", "onNotificationOpened",
      "onQuitQuestion", "onStartup", "openLogFolder", "platform", "readBuild", "readLayout", "readStartup", "request", "setMenuBar", "writeLayout"
    ] });
  });

  test("the window row, status bar and panel card follow the default theme", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    await expect.poll(() => desktop.window.evaluate(() => (document.querySelector("tr-panel-card") as Element).getBoundingClientRect().width)).toBe(1920 - 8);
    const measured = await desktop.window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
      const bounds = (selector: string): DOMRect => (document.querySelector(selector) as Element).getBoundingClientRect();
      const row = style("tr-window-row");
      const bar = style("tr-status-bar");
      const side = style(".tr-status-bar-side");
      const card = style("tr-panel-card");
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        body: getComputedStyle(document.body).backgroundColor,
        row: { height: row.height, background: row.backgroundColor, color: row.color, borderBottom: row.borderBottomWidth },
        bar: { height: bar.height, paddingLeft: bar.paddingLeft, paddingRight: bar.paddingRight, gap: side.columnGap, background: bar.backgroundColor, borderTop: bar.borderTopWidth },
        card: { border: card.borderTopWidth, borderColor: card.borderTopColor, radius: card.borderTopLeftRadius, background: card.backgroundColor, color: card.color },
        cardBounds: bounds("tr-panel-card").toJSON() as Record<string, number>,
        rowBottom: bounds("tr-window-row").bottom,
        barTop: bounds("tr-status-bar").top,
        viewport: [innerWidth, innerHeight]
      };
    });
    const expected = measured.isDark ? colors.dark : colors.light;

    expect(measured.body).toBe(expected.window);
    expect(measured.row).toEqual({ height: "35px", background: expected.titleBar, color: expected.titleBarText, borderBottom: "0px" });
    expect(measured.bar).toEqual({ height: "28px", paddingLeft: "8px", paddingRight: "8px", gap: "4px", background: expected.window, borderTop: "0px" });
    expect(measured.card).toEqual({ border: "1px", borderColor: expected.cardBorder, radius: "8px", background: expected.panel, color: expected.text });
    expect(measured.cardBounds["x"]).toBe(4);
    expect(measured.cardBounds["y"]).toBe(measured.rowBottom);
    expect(measured.cardBounds["width"]).toBe(1920 - 8);
    expect(measured.cardBounds["bottom"]).toBe(measured.barTop - 4);
    expect(await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBackgroundColor())).toBe(measured.isDark ? "#181818" : "#F8F8F8");
  });

  test("the window row leaves the native window controls their space", async ({ desktop }) => {
    const row = await desktop.window.evaluate(() => {
      const element = document.querySelector("tr-window-row") as HTMLElement;
      const style = getComputedStyle(element);
      return { isMac: element.classList.contains("tr-window-row-mac"), left: Number.parseFloat(style.paddingLeft), right: Number.parseFloat(style.paddingRight), region: style.getPropertyValue("app-region") };
    });

    expect(row.region).toBe("drag");
    if (process.platform === "darwin")
      expect(row).toMatchObject({ isMac: true, left: 78, right: 0 });
    else {
      expect(row).toMatchObject({ isMac: false, left: 0 });
      expect(row.right).toBeGreaterThan(0);
    }
  });

  test("the window closes cleanly", async ({ desktop }) => {
    expect(await desktop.closeAsync()).toBe(0);
  });
});
