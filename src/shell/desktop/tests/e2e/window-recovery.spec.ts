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

test("a window whose page stops asks with a native box, comes back when the person reloads it, and records why", async ({ desktop }) => {
  const window = desktop.window;
  await expect(window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
  await desktop.application.evaluate(({ dialog }) => {
    const asked: string[] = [];
    Reflect.set(globalThis, "teamrunAskedBoxes", asked);
    dialog.showMessageBox = ((...values: unknown[]) => {
      const options = values.at(-1) as { message: string; buttons: string[] };
      asked.push(`${options.message} ${options.buttons.join("/")}`);
      return Promise.resolve({ response: 0, checkboxChecked: false });
    }) as typeof dialog.showMessageBox;
  });

  await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer());

  await expect.poll(() => desktop.application.evaluate(() => Reflect.get(globalThis, "teamrunAskedBoxes") as string[]))
    .toEqual(["TeamRun's window stopped unexpectedly. Reload/Quit"]);
  await expect.poll(() => desktop.application.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    if (contents === undefined || contents.isCrashed() || contents.isLoading())
      return "";
    return String(await contents.executeJavaScript("document.querySelector('tr-empty-window')?.textContent ?? ''"));
  })).toMatch(/TeamRun\s*No modules/);
  expect(await desktop.isVisibleAsync()).toBe(true);
  const log = await readFile(path.join(desktop.dataDirectory, "logs", "desktop.log"), "utf8");
  expect(log).toMatch(/^\S+ The window's page stopped: (?:crashed|killed|abnormal-exit), exit code -?\d+\.\n\S+ The person chose Reload\.\n$/);
  expect(desktop.acceptFailures(/^main: \S+ The (?:window's page stopped|person chose Reload)/)).toHaveLength(2);
});
