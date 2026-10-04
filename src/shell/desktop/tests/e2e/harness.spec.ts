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
});
