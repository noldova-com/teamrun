/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import LayoutFixture from "./fixtures/layout.fixture.ts";
import WindowModeFixture from "./fixtures/window-mode.fixture.ts";

test.use({ desktopVariant: BuildVariantFixture.noModules });

test.describe("the harness's viewport and cursor guard", () => {
  const readViewport = (desktop: DesktopApplicationFixture): Promise<readonly number[]> =>
    desktop.window.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  const isCursorInside = (desktop: DesktopApplicationFixture): Promise<boolean> => desktop.application.evaluate(({ BrowserWindow, screen }) => {
    const cursor = screen.getCursorScreenPoint();
    const bounds = BrowserWindow.getAllWindows()[0]?.getBounds();
    return bounds !== undefined && cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
  });
  const isHovered = (desktop: DesktopApplicationFixture): Promise<boolean> => desktop.window.evaluate(() => document.querySelector(":hover") !== null);
  const emulateAsync =async (desktop: DesktopApplicationFixture, width: number, height: number): Promise<void> => {
    const session = await desktop.window.context().newCDPSession(desktop.window);
    await session.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await expect.poll(() => readViewport(desktop)).toEqual([width, height, 1]);
  };

  test("every workflow starts at the suite's viewport with the real cursor outside the window, and again after a restart", async ({ desktop }) => {
    const first = [await readViewport(desktop), await isCursorInside(desktop)];

    await desktop.restartAsync();

    expect(first).toEqual([[1920, 1080, 1], false]);
    expect([await readViewport(desktop), await isCursorInside(desktop)]).toEqual([[1920, 1080, 1], false]);
    expect(await isHovered(desktop)).toBe(false);
    await desktop.checkpointAsync("harness-suite-viewport");
  });

  test("a workflow starts with nothing hovered even when the pointer left the window without moving", async ({ desktop }) => {
    await desktop.window.mouse.move(100, 100);
    const hovered = await isHovered(desktop);

    await desktop.useViewportAsync(1920, 1080);

    expect(hovered).toBe(true);
    expect(await isHovered(desktop)).toBe(false);
  });

  test("a workflow that ends off its viewport fails, while one that chose another size keeps it", async ({ desktop }) => {
    await desktop.useViewportAsync(900, 700);
    await emulateAsync(desktop, 800, 600);

    await desktop.disposeAsync(false);

    expect(desktop.acceptFailures(/viewport/)).toEqual(["The workflow ended at a 800 × 600 viewport instead of 900 × 700, so its viewport was lost."]);
  });

  test.describe("a workflow that tests window placement", () => {
    test.use({ desktopWindowPlacement: true });

    test("keeps the window's own size and position and is not checked for either", async ({ desktop }) => {
      const bounds = await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getContentBounds());
      const viewport = await readViewport(desktop);

      await emulateAsync(desktop, 800, 600);
      await desktop.disposeAsync(false);

      expect(viewport.slice(0, 2)).toEqual([bounds?.width, bounds?.height]);
      expect(desktop.failures).toEqual([]);
    });
  });
});

test.describe("the workflows' checkpoints", () => {
  test("every workflow file that opens TeamRun takes a named checkpoint, and each name is taken in one place only", async ({}, testInfo) => {
    const folder = path.dirname(testInfo.file);
    const files = (await readdir(folder)).filter(t => t.endsWith(".spec.ts")).sort();
    const texts = await Promise.all(files.map(async t => [t, await readFile(path.join(folder, t), "utf8")] as const));
    const workflows = texts.filter(([, text]) => /\{\s*desktop\s*\}/.test(text));
    const names = workflows.flatMap(([, text]) => [...text.matchAll(/checkpointAsync\("([^"]+)"\)/g)].map(t => t[1]));

    expect(workflows.filter(([, text]) => !/checkpointAsync\(|captureMainWindowAsync\(/.test(text)).map(([file]) => file)).toEqual([]);
    expect(names.filter((t, index) => names.indexOf(t) !== index)).toEqual([]);
  });

  test("a checkpoint records the appearance settings in effect, the mode the page shows, the zoom, the CSS viewport and the pixel ratio, and one at 200% zoom shows the whole window in 1920 × 1080 pixels", async ({ desktop }, testInfo) => {
    const window = desktop.window;
    const settings = { theme: "shell.default", mode: "Dark", interfaceFont: "Noldova", codeFont: "Noldova", panelSize: 17, messageSize: 14, codeSize: 14 };
    await WindowModeFixture.setAsync(window, "Dark");
    await window.evaluate(() => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
      .request("shell.setSetting", { name: "shell.panelSize", value: 17 }));
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).fontSize)).not.toBe("16px");

    await desktop.checkpointAsync("harness-checkpoint-record");
    await desktop.zoomAsync(2, 960);
    await window.evaluate(() => {
      for (const [x, y, color] of [["left", "top", "rgb(255, 0, 0)"], ["right", "top", "rgb(0, 255, 0)"], ["left", "bottom", "rgb(0, 0, 255)"], ["right", "bottom", "rgb(255, 0, 255)"]] as const) {
        const marker = document.createElement("div");
        marker.className = "harness-corner";
        marker.style.cssText = `position: fixed; ${x}: 0; ${y}: 0; width: 8px; height: 8px; z-index: 10000; background: ${color}`;
        document.body.append(marker);
      }
    });
    const zoomed = await desktop.checkpointAsync("harness-checkpoint-zoomed");
    const corners = await window.evaluate(async data => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      document.querySelectorAll(".harness-corner").forEach(t => t.remove());
      return [[4, 4], [canvas.width - 5, 4], [4, canvas.height - 5], [canvas.width - 5, canvas.height - 5], [20, 20]]
        .map(([x, y]) => [...(context?.getImageData(x ?? 0, y ?? 0, 1, 1).data.slice(0, 3) ?? [])]);
    }, zoomed.toString("base64"));
    await desktop.zoomAsync(1, 1920);

    expect(testInfo.annotations.filter(t => t.type === "checkpoint").map(t => JSON.parse(t.description ?? ""))).toEqual([
      { name: "harness-checkpoint-record", settings, colorScheme: "dark", zoom: 1, viewport: { width: 1920, height: 1080 }, pixelRatio: 1 },
      { name: "harness-checkpoint-zoomed", settings, colorScheme: "dark", zoom: 2, viewport: { width: 960, height: 540 }, pixelRatio: 2 }
    ]);
    expect([zoomed.readUInt32BE(16), zoomed.readUInt32BE(20)]).toEqual([1920, 1080]);
    expect(corners.slice(0, 4)).toEqual([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 0, 255]]);
    expect(corners[4]).not.toEqual([255, 0, 0]);
  });
});

test.describe("the layout checks", () => {
  test("report a control cut off, outside the window or covered, a region that scrolls sideways or shows no control, and the focus out of view, but not a control scrolled out of its scroll area", async ({ desktop }) => {
    const window = desktop.window;
    await window.evaluate(() => {
      const region = document.createElement("div");
      region.id = "layout-check";
      region.style.cssText = "position: fixed; left: 0; top: 0; width: 400px; height: 120px; z-index: 10000; background: white";
      region.innerHTML = [
        "<button style=\"position: absolute; left: 100px; top: 40px; width: 60px; height: 30px\">Covered</button>",
        "<div style=\"position: absolute; left: 90px; top: 30px; width: 80px; height: 50px\"></div>",
        "<button style=\"position: absolute; left: -40px; top: 40px; width: 30px; height: 30px\">Outside</button>",
        "<div style=\"position: absolute; left: 0; top: 0; width: 60px; height: 30px; overflow: hidden\"><button style=\"position: absolute; left: 70px; top: 0\">Cut</button></div>",
        "<div style=\"position: absolute; left: 200px; top: 0; width: 50px; height: 30px; overflow-x: auto\"><div style=\"width: 200px\">Wide</div></div>",
        "<div style=\"position: absolute; left: 300px; top: 0; width: 60px; height: 20px; overflow-y: auto\"><div style=\"height: 40px\"></div><button style=\"width: 50px\">Away</button></div>"
      ].join("");
      const empty = document.createElement("div");
      empty.id = "layout-empty";
      empty.style.cssText = "position: fixed; left: 0; top: 200px; width: 100px; height: 20px";
      document.body.append(region, empty);
    });

    expect(await LayoutFixture.findProblemsAsync(window.locator("#layout-check, #layout-empty"))).toEqual([
      "div \"Wide\" scrolls sideways.",
      "button \"Covered\" is covered by div \"\".",
      "button \"Outside\" is outside the window.",
      "button \"Cut\" is cut off by div \"Cut\".",
      "div \"\" shows no control."
    ]);
    await window.getByRole("button", { name: "Covered" }).focus();
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", 1)).toEqual(["Tab 1: button \"Outside\" has the focus out of view."]);
  });
});
