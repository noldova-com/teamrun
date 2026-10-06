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

async function closeWindowAsync(desktop: DesktopApplicationFixture): Promise<void> {
  await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
}

async function waitForExitAsync(desktop: DesktopApplicationFixture): Promise<number | null> {
  const child = desktop.application.process();
  return await new Promise<number | null>(resolve => {
    if (child.exitCode !== null)
      resolve(child.exitCode);
    else
      child.once("exit", resolve);
  });
}

test.describe("quitting while a module works", () => {
  const startProgramAsync = async (dataDirectory: string): Promise<number[]> => {
    const started = JSON.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", dataDirectory)) as { processId: number; childProcessId: number };
    return [started.processId, started.childProcessId];
  };

  test("asks before quitting, stays open when the person cancels and quits once the work they waited for finishes @smoke", async ({ desktop }) => {
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

  test("keeps the focus in the question on F10 or a lone Alt with the window behind it inert, and F10 reaches the menus again once the person cancels", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator("tr-window");
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });
    const wait = asking.getByRole("button", { name: "Wait, then quit" });

    await closeWindowAsync(desktop);
    await expect(wait).toBeFocused();
    await window.keyboard.press("F10");
    await expect(wait).toBeFocused();
    await window.keyboard.press("Alt");
    await expect(wait).toBeFocused();
    expect(await content.evaluate(t => [(t as HTMLElement).inert, t.getAttribute("aria-hidden")])).toEqual([true, "true"]);
    await window.keyboard.press("Tab");
    expect(await asking.evaluate(t => t.contains(document.activeElement) && document.activeElement !== t)).toBe(true);
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);

    expect(await content.evaluate(t => [(t as HTMLElement).inert, t.getAttribute("aria-hidden")])).toEqual([false, null]);
    if (process.platform !== "darwin") {
      await window.keyboard.press("F10");
      await expect(window.locator("tr-menu-bar").getByRole("menuitem").first()).toBeFocused();
    }
    await ClockWorkFixture.finishAsync(desktop.dataDirectory);
    await expect.poll(() => ClockWorkFixture.readAsync(desktop.dataDirectory), { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toEqual([]);
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

  test("stops the work and quits when the person chooses to, and the runtime stops with it and ends the programs its modules run @smoke", async ({ desktop }) => {
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

test.describe("saving before quitting", () => {
  const readDesktopLogAsync = async (desktop: DesktopApplicationFixture): Promise<string> =>
    await readFile(path.join(desktop.dataDirectory, "logs", "desktop.log"), "utf8");

  test("stays open with the error naming the module when a window part's save fails, and quits once it saves @smoke", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await window.locator("[data-fixture-content=notes-save-fails]:visible").click();
    const toast = window.locator(".tr-toast", { hasText: "Notes couldn't save, so TeamRun stayed open" });

    await closeWindowAsync(desktop);

    await expect(toast).toBeVisible();
    await expect(toast.locator(".tr-toast-text")).toHaveText("The disk is full.");
    await expect(toast).toHaveAttribute("data-severity", "Error");
    await expect(toast.locator(".tr-toast-meta")).toContainText("TeamRun");
    expect(await desktop.isVisibleAsync()).toBe(true);
    await expect.poll(() => readDesktopLogAsync(desktop)).toMatch(/Window error in notes: .*Its window part failed to save while TeamRun was closing\./);
    await desktop.checkpointAsync("quit-save-failed");
    await window.locator("[data-fixture-content=notes-save-saves]:visible").click();
    const exited = waitForExitAsync(desktop);
    await closeWindowAsync(desktop);

    expect(await exited).toBe(0);
    expect(desktop.acceptFailures(/Window error in notes: |^renderer: ERROR .*Its window part failed to save while TeamRun was closing\./).length).toBeGreaterThan(0);
  });

  test("quits after 4 seconds without a window part whose save never settles, and logs a warning naming the module", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await window.locator("[data-fixture-content=notes-save-hangs]:visible").click();
    const exited = waitForExitAsync(desktop);
    const started = Date.now();

    await closeWindowAsync(desktop);

    expect(await exited).toBe(0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4000);
    expect(await readDesktopLogAsync(desktop)).toContain(
      "Window error in notes: Its window part did not finish saving within 4 seconds while TeamRun was closing; TeamRun closed without it.");
    expect(desktop.acceptFailures(/Window error in notes: Its window part did not finish saving within 4 seconds/).length).toBeGreaterThan(0);
  });
});
