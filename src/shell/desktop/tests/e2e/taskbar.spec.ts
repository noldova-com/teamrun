/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { spawn } from "node:child_process";
import path from "node:path";

import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the Windows taskbar", () => {
  test.skip(process.platform !== "win32", "The taskbar's relaunch command is Windows only.");

  test("the taskbar's relaunch command brings the running window forward and opens no second one", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    const launch = await desktop.application.evaluate(({ app }) => {
      Reflect.set(globalThis, "teamrunSecondInstance", false);
      app.once("second-instance", () => Reflect.set(globalThis, "teamrunSecondInstance", true));
      return { isPackaged: app.isPackaged, executablePath: process.execPath, argv: process.argv };
    });
    const command = TaskbarIdentity.create(launch.isPackaged, launch.executablePath, path.resolve("node_modules", "@noldova", "teamrun-shell-desktop", "main.js"), launch.argv).relaunchCommand;

    const second = spawn(command, { shell: true, stdio: "ignore", windowsHide: true });
    const exitCode = await new Promise<number | null>(resolve => second.once("exit", resolve));

    expect(exitCode).toBe(0);
    await expect.poll(() => desktop.application.evaluate(() => Reflect.get(globalThis, "teamrunSecondInstance") as boolean)).toBe(true);
    expect(await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  });
});
