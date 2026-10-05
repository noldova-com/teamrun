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

test("an error the main process does not catch is logged with its stack and asks with TeamRun's own box, never Electron's", async ({ desktop }) => {
  await expect(desktop.window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
  await desktop.application.evaluate(({ app, dialog, shell }) => {
    const calls: string[] = [];
    const answers = [1, 0];
    Reflect.set(globalThis, "teamrunFailureCalls", calls);
    dialog.showMessageBox = ((...values: unknown[]) => {
      const options = values.at(-1) as { message: string; buttons: string[] };
      calls.push(`box ${options.message} ${options.buttons.join("/")}`);
      return Promise.resolve({ response: answers.shift() ?? 2, checkboxChecked: false });
    }) as typeof dialog.showMessageBox;
    dialog.showErrorBox = (title: string) => calls.push(`error box ${title}`);
    shell.openPath = (folder: string) => {
      calls.push(`open ${folder}`);
      return Promise.resolve("");
    };
    app.relaunch = () => calls.push("relaunch");
    app.exit = (code?: number) => calls.push(`exit ${code}`);
  });

  await desktop.application.evaluate(() => {
    setImmediate(() => {
      throw new Error("A failure the test threw in the main process.");
    });
  });
  await expect.poll(() => desktop.application.evaluate(() => Reflect.get(globalThis, "teamrunFailureCalls") as string[])).toEqual([
    "box TeamRun stopped because of an unexpected error. Restart TeamRun/Open log folder/Quit",
    `open ${path.join(desktop.dataDirectory, "logs")}`,
    "box TeamRun stopped because of an unexpected error. Restart TeamRun/Open log folder/Quit",
    "relaunch",
    "exit 0"
  ]);
  await desktop.application.evaluate(() => {
    void Promise.reject(new Error("A rejection the test left unhandled in the main process."));
  });

  const logFile = path.join(desktop.dataDirectory, "logs", "desktop.log");
  await expect.poll(async () => await readFile(logFile, "utf8")).toContain("unhandled rejection: Error: A rejection the test left unhandled in the main process.\n    at ");
  const log = await readFile(logFile, "utf8");
  expect(log).toContain("The desktop's main process failed with an uncaught exception: Error: A failure the test threw in the main process.\n    at ");
  expect(log).toMatch(/ The person chose Open log folder\.\n\S+ The person chose Restart TeamRun\.\n/);
  expect(await desktop.application.evaluate(() => Reflect.get(globalThis, "teamrunFailureCalls") as string[])).toHaveLength(5);
  expect(desktop.acceptFailures(/^main: (?:\S+ (?:The desktop's main process failed|The person chose)|at )/).length).toBeGreaterThanOrEqual(6);
});
