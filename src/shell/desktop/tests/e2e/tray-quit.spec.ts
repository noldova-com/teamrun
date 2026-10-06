/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import CliFixture from "./fixtures/cli.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

interface ITrayBridge {
  readTrayAvailable(): Promise<unknown>;
}

test.describe("closing and quitting beside the tray icon", () => {
  test("keeps running behind the tray icon or the macOS menu bar when the last window closes, quits there without one, and a quit ends every TeamRun process", async ({ desktop }) => {
    const started = JSON.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", desktop.dataDirectory)) as { processId: number; childProcessId: number };
    const programs = [started.processId, started.childProcessId];
    const runtime = await desktop.readRuntimeProcessIdAsync() ?? 0;
    const child = desktop.application.process();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
    const hints = path.join(desktop.root, "device", "device-state.json");
    const keepsRunning = process.platform === "darwin" || await desktop.window.evaluate(() => (Reflect.get(globalThis, "teamrun") as ITrayBridge).readTrayAvailable()) === true;
    await desktop.checkpointAsync("tray-quit-before-closing");

    await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    if (keepsRunning) {
      await expect.poll(() => desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
      if (process.platform === "darwin")
        expect(existsSync(hints)).toBe(false);
      else
        await expect.poll(async () => existsSync(hints) ? JSON.parse(await readFile(hints, "utf8")) as unknown : null).toEqual({ trayCloseHintShown: true });
      expect(child.exitCode).toBeNull();
      expect(programs.every(t => DesktopApplicationFixture.isAlive(t))).toBe(true);
      await desktop.application.evaluate(({ app }) => app.quit());
    }

    expect(await exited).toBe(0);
    await expect.poll(() => DesktopApplicationFixture.isAlive(runtime), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => programs.filter(t => DesktopApplicationFixture.isAlive(t)), { timeout: 5_000 }).toEqual([]);
  });
});
