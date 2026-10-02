/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { TaskbarIdentity } from "@noldova/teamrun-shell-desktop";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the Windows taskbar", () => {
  test.skip(process.platform !== "win32", "The taskbar's relaunch command is Windows only.");
  test.use({ desktopArguments: ["--user-data-dir=profile"], desktopVariant: BuildVariantFixture.noModules });

  test("the taskbar's relaunch command, started elsewhere, reaches the running TeamRun with a relative profile and opens no second window", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    const launch = await desktop.application.evaluate(({ app }) => {
      Reflect.set(globalThis, "teamrunSecondInstance", false);
      app.once("second-instance", () => Reflect.set(globalThis, "teamrunSecondInstance", true));
      return { isPackaged: app.isPackaged, executablePath: process.execPath, argv: process.argv, workingDirectory: process.cwd(), profile: app.getPath("userData") };
    });
    const command = TaskbarIdentity.create(
      launch.isPackaged,
      launch.executablePath,
      path.resolve("node_modules", "@noldova", "teamrun-shell-desktop", "main.js"),
      launch.argv,
      launch.workingDirectory).relaunchCommand;

    const second = spawn(command, { cwd: os.tmpdir(), shell: true, stdio: "ignore", windowsHide: true });
    const exitCode = await new Promise<number | null>(resolve => second.once("exit", resolve));

    expect(launch.profile).toBe(path.join(desktop.root, "profile"));
    expect(exitCode).toBe(0);
    await expect.poll(() => desktop.application.evaluate(() => Reflect.get(globalThis, "teamrunSecondInstance") as boolean)).toBe(true);
    expect(await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  });
});
