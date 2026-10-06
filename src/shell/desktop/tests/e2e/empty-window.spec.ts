/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.use({ desktopVariant: BuildVariantFixture.noModules });

const colors = {
  light: { window: "rgb(248, 248, 248)", panel: "rgb(255, 255, 255)", cardBorder: "rgb(229, 229, 229)", titleBar: "rgb(248, 248, 248)", titleBarText: "rgb(30, 30, 30)", text: "rgb(59, 59, 59)" },
  dark: { window: "rgb(24, 24, 24)", panel: "rgb(31, 31, 31)", cardBorder: "rgb(37, 37, 37)", titleBar: "rgb(24, 24, 24)", titleBarText: "rgb(204, 204, 204)", text: "rgb(204, 204, 204)" }
};

test.describe("the empty window", () => {
  test("TeamRun starts with no module and shows the empty window @smoke", async ({ desktop }) => {
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
      "actOnStartup", "answerClose", "answerQuit", "answerUpdateSave", "appearance", "copyText", "edit", "installCommand", "keepAppearance", "keepSpelling", "logError", "logModule", "notifyAppearance", "notifyReady", "onCloseRequest",
      "onEvent", "onFieldMenu", "onMenuCommand", "onNotificationOpened", "onQuitQuestion", "onStartup", "onUpdateSaveRequest", "openLink", "openLogFolder", "platform", "readBuild", "readLayout", "readSpelling", "readStartup",
      "replaceMisspelling", "request", "setMenuBar", "writeLayout"
    ] });
  });

  test("an error the window throws and a rejection it leaves unhandled both go to the desktop's log", async ({ desktop }) => {
    const log = (): Promise<string> => readFile(path.join(desktop.dataDirectory, "logs", "desktop.log"), "utf8");

    await desktop.window.evaluate(() => {
      setTimeout(() => {
        throw new Error("An error the window threw.");
      });
      void Promise.reject(new Error("A rejection the window left unhandled."));
    });

    await expect.poll(log).toMatch(/Window error: Error: An error the window threw\./);
    await expect.poll(log).toMatch(/Window error: Error: A rejection the window left unhandled\./);
    const text = await log();
    expect([text.split("Error: An error the window threw.").length, text.split("Error: A rejection the window left unhandled.").length]).toEqual([2, 2]);
    expect(desktop.acceptFailures(/the window threw\.|the window left unhandled\.|Window error: /).length).toBeGreaterThan(0);
  });

  test("an error that stops the window's bootstrap goes to the desktop's log once", async ({ desktop }) => {
    const log = (): Promise<string> => readFile(path.join(desktop.dataDirectory, "logs", "desktop.log"), "utf8");
    await desktop.window.context().addInitScript(() => {
      Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: () => {
        throw new Error("The window's bootstrap stopped.");
      } });
    });

    await desktop.window.reload();

    await expect.poll(log).toMatch(/Window error: Error: The window's bootstrap stopped\./);
    await expect(desktop.window.locator("tr-empty-window")).toHaveCount(0);
    expect((await log()).split("Error: The window's bootstrap stopped.").length).toBe(2);
    expect(desktop.acceptFailures(/bootstrap stopped\.|Window error: /).length).toBeGreaterThan(0);
  });

  test("the window row, status bar and panel card follow the default theme", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    await expect.poll(() => desktop.window.evaluate(() => (document.querySelector("tr-panel-card") as Element).getBoundingClientRect().width)).toBe(1920 - 8);
    const measured = await desktop.window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
      const bounds = (selector: string): DOMRect => (document.querySelector(selector) as Element).getBoundingClientRect();
      const row = style("tr-window-row");
      const bar = style("tr-status-bar");
      const side = style(".tr-status-bar-side");
      const card = style("tr-panel-card");
      const lookHeight = (name: string): string => {
        const probe = document.createElement("div");
        probe.style.height = `var(--tr-${name})`;
        document.body.append(probe);
        const height = getComputedStyle(probe).height;
        probe.remove();
        return height;
      };
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        body: getComputedStyle(document.body).backgroundColor,
        rowLook: lookHeight("window-row-height"),
        barLook: lookHeight("status-bar-height"),
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
    expect(measured.row).toEqual({ height: measured.rowLook, background: expected.titleBar, color: expected.titleBarText, borderBottom: "0px" });
    expect(measured.bar).toEqual({ height: measured.barLook, paddingLeft: "8px", paddingRight: "8px", gap: "4px", background: expected.window, borderTop: "0px" });
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

  test("the window closes cleanly @smoke", async ({ desktop }) => {
    expect(await desktop.closeAsync()).toBe(0);
  });
});
