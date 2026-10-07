/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import CliFixture from "./fixtures/cli.fixture.ts";
import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import OffCursorPlacement from "./fixtures/off-cursor-placement.ts";
import PageBridgeFixture from "./fixtures/page-bridge.fixture.ts";

const HINT_REFUSED: RegExp = /The operating system did not show the hint that TeamRun is still running/;
const PLAYWRIGHT_DEBUGGING: RegExp = /^--(inspect|remote-debugging-port)=/;

async function keepsRunningAsync(desktop: DesktopApplicationFixture): Promise<boolean> {
  return process.platform === "darwin" || await PageBridgeFixture.evaluateAsync(desktop.window, t => t.readTrayAvailable()) === true;
}

async function closeIntoTheTrayAsync(desktop: DesktopApplicationFixture): Promise<string> {
  const hints = path.join(desktop.root, "device", "device-state.json");
  await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await expect.poll(() => desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  if (process.platform === "darwin")
    return "none";
  let outcome = "";
  await expect.poll(() => {
    outcome = existsSync(hints) ? "shown" : desktop.failures.some(t => HINT_REFUSED.test(t)) ? "refused" : "";
    return outcome;
  }).not.toBe("");
  desktop.acceptFailures(HINT_REFUSED);
  return outcome;
}

async function startAgainAsync(desktop: DesktopApplicationFixture): Promise<void> {
  const launch = await desktop.application.evaluate(() => ({ executablePath: process.execPath, argv: process.argv, workingDirectory: process.cwd(), environment: process.env }));
  const args = launch.argv.slice(1).filter(t => !PLAYWRIGHT_DEBUGGING.test(t));
  expect(args.some(t => t.endsWith("main.js")), `TeamRun's arguments name its main.js: ${JSON.stringify(launch.argv)}`).toBe(true);
  const second = spawn(launch.executablePath, args, { cwd: launch.workingDirectory, env: launch.environment, stdio: ["ignore", "ignore", "pipe"] });
  let errors = "";
  second.stderr?.setEncoding("utf8").on("data", (t: string) => errors += t);
  const ended = await new Promise<[number | null, string | null]>(resolve => second.once("close", (code, signal) => resolve([code, signal])));
  expect(ended, `The second start ended with ${JSON.stringify(ended)} and wrote: ${errors}`).toEqual([0, null]);
}

async function moveOffCursorAsync(desktop: DesktopApplicationFixture): Promise<void> {
  const state = await desktop.application.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return window === undefined ? null : { cursor: screen.getCursorScreenPoint(), bounds: window.getBounds(), displays: screen.getAllDisplays().map(t => t.bounds) };
  });
  if (state !== null)
    await OffCursorPlacement.placeAsync(state.bounds, state.cursor, state.displays, target => desktop.application.evaluate(({ BrowserWindow }, next) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (window === undefined)
        throw new Error("The window is gone.");
      window.setBounds(next);
      return window.getBounds();
    }, target));
}

test.describe("closing and quitting beside the tray icon", () => {
  test("keeps running behind the tray icon or the macOS menu bar when the last window closes, quits there without one, and a quit ends every TeamRun process", async ({ desktop }) => {
    const started = JSON.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", desktop.dataDirectory)) as { processId: number; childProcessId: number };
    const programs = [started.processId, started.childProcessId];
    const runtime = await desktop.readRuntimeProcessIdAsync() ?? 0;
    const child = desktop.application.process();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
    const hints = path.join(desktop.root, "device", "device-state.json");
    const keepsRunning = await keepsRunningAsync(desktop);
    await desktop.checkpointAsync("tray-quit-before-closing");

    if (keepsRunning) {
      if (await closeIntoTheTrayAsync(desktop) === "shown")
        expect(JSON.parse(await readFile(hints, "utf8"))).toEqual({ trayCloseHintShown: true });
      else
        expect(existsSync(hints)).toBe(false);
      expect(child.exitCode).toBeNull();
      expect(programs.every(t => DesktopApplicationFixture.isAlive(t))).toBe(true);
      await desktop.application.evaluate(({ app }) => app.quit());
    }
    else
      await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());

    expect(await exited).toBe(0);
    await expect.poll(() => DesktopApplicationFixture.isAlive(runtime), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => programs.filter(t => DesktopApplicationFixture.isAlive(t)), { timeout: 5_000 }).toEqual([]);
  });

  test("a second start while TeamRun runs without a window opens one window and exits", async ({ desktop }) => {
    test.skip(!await keepsRunningAsync(desktop), "TeamRun quits with its last window where the desktop shows no tray.");
    await closeIntoTheTrayAsync(desktop);
    const reopened = desktop.application.waitForEvent("window");

    await startAgainAsync(desktop);
    await expect((await reopened).locator("tr-window")).toBeVisible();
    await moveOffCursorAsync(desktop);
    await startAgainAsync(desktop);

    expect(await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  });

  test("a quit with work running and no window asks in a new window and quits once the person stops the work", async ({ desktop }) => {
    test.skip(!await keepsRunningAsync(desktop), "TeamRun quits with its last window where the desktop shows no tray.");
    await expect(desktop.window.locator("tr-window")).toBeVisible();
    await ClockWorkFixture.beginAsync(desktop);
    await closeIntoTheTrayAsync(desktop);
    const asking = desktop.application.waitForEvent("window");
    const child = desktop.application.process();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));

    await desktop.application.evaluate(({ app }) => app.quit());
    const question = (await asking).getByRole("dialog", { name: "Work is still running" });
    await expect(question.getByRole("listitem")).toHaveText([ClockWorkFixture.WORK]);
    await question.getByRole("button", { name: "Stop the work and quit" }).click();

    expect(await exited).toBe(0);
    expect(existsSync(path.join(desktop.dataDirectory, "work", "clock", "stopped"))).toBe(true);
  });
});
