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
import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("quitting while a module works", () => {
  const startProgramAsync = async (dataDirectory: string): Promise<number[]> => {
    const started = JSON.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", dataDirectory)) as { processId: number; childProcessId: number };
    return [started.processId, started.childProcessId];
  };

  const closeWindowAsync = async (desktop: DesktopApplicationFixture): Promise<void> => {
    await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  };

  const waitForExitAsync = async (desktop: DesktopApplicationFixture): Promise<number | null> => {
    const child = desktop.application.process();
    return await new Promise<number | null>(resolve => {
      if (child.exitCode !== null)
        resolve(child.exitCode);
      else
        child.once("exit", resolve);
    });
  };

  test("asks before quitting, stays open when the person cancels and quits once the work they waited for finishes", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await closeWindowAsync(desktop);
    await expect(asking).toBeVisible();
    await expect(asking.getByRole("listitem")).toHaveText([ClockWorkFixture.WORK]);
    await expect(asking.getByRole("button", { name: "Wait, then quit" })).toBeFocused();
    await expect(asking.getByRole("button")).toHaveText(["Wait, then quit", "Stop the work and quit", "Cancel"]);
    const box = await window.locator("tr-dialog").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(440);
    expect(await window.locator(".tr-dialog-backdrop").evaluate(t => getComputedStyle(t).backgroundColor)).toBe("rgba(0, 0, 0, 0.5)");
    await desktop.checkpointAsync("quit-asking");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    expect(await desktop.isVisibleAsync()).toBe(true);

    await closeWindowAsync(desktop);
    await asking.getByRole("button", { name: "Wait, then quit" }).click();
    const waiting = window.getByRole("dialog", { name: "Waiting for the work to finish" });
    await expect(waiting).toBeVisible();
    await expect(waiting.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(waiting.getByRole("button")).toHaveText(["Stop the work and quit", "Cancel"]);
    await desktop.checkpointAsync("quit-waiting");
    const exited = waitForExitAsync(desktop);
    await ClockWorkFixture.finishAsync(desktop.dataDirectory);

    expect(await exited).toBe(0);
    expect(existsSync(path.join(desktop.dataDirectory, "work", "clock", "stopped"))).toBe(false);
  });

  test("paints the question's body in the dialog's text color at full opacity as it opens, without a pointer move, in light and in dark mode", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    for (const scheme of ["light", "dark"] as const) {
      await window.emulateMedia({ colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await closeWindowAsync(desktop);
      await expect(asking).toBeVisible();
      await expect(asking.locator(".tr-quit-text")).toHaveText(["TeamRun is still working on:", "Wait for it to finish, or stop it now."]);

      const painted = await asking.locator("tr-dialog").evaluate(dialog => {
        const lines = [...dialog.querySelectorAll<HTMLElement>(".tr-quit-text, .tr-quit-list li")];
        const opacity = (element: HTMLElement): number => {
          let value = 1;
          for (let node: HTMLElement | null = element; node !== null; node = node.parentElement)
            value *= Number(getComputedStyle(node).opacity);
          return value;
        };
        return { dialog: getComputedStyle(dialog).color, colors: [...new Set(lines.map(t => getComputedStyle(t).color))], opacities: [...new Set(lines.map(opacity))] };
      });
      expect(painted.dialog).not.toBe("rgba(0, 0, 0, 0)");
      expect(painted.colors).toEqual([painted.dialog]);
      expect(painted.opacities).toEqual([1]);
      await desktop.checkpointAsync(`quit-asking-${scheme}`);
      await window.keyboard.press("Escape");
      await expect(asking).toHaveCount(0);
    }
    await ClockWorkFixture.finishAsync(desktop.dataDirectory);
    await expect.poll(() => ClockWorkFixture.readAsync(desktop.dataDirectory), { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toEqual([]);
  });

  test("stops the work and quits when the person chooses to, and the runtime stops with it and ends the programs its modules run", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    const programs = await startProgramAsync(desktop.dataDirectory);
    expect(programs.every(t => DesktopApplicationFixture.isAlive(t))).toBe(true);
    await ClockWorkFixture.beginAsync(desktop);
    const runtime = await desktop.readRuntimeProcessIdAsync() ?? 0;

    await closeWindowAsync(desktop);
    const exited = waitForExitAsync(desktop);
    await window.getByRole("dialog", { name: "Work is still running" }).getByRole("button", { name: "Stop the work and quit" }).click();

    expect(await exited).toBe(0);
    await expect.poll(() => DesktopApplicationFixture.isAlive(runtime), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => programs.filter(t => DesktopApplicationFixture.isAlive(t)), { timeout: 5_000 }).toEqual([]);
    expect(existsSync(path.join(desktop.dataDirectory, "work", "clock", "stopped"))).toBe(true);
    expect(await readFile(path.join(desktop.dataDirectory, "logs", "runtime.log"), "utf8")).toContain("clock: The clock began counting.\n");
  });
});
