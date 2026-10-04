/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("quitting while a module works", () => {
  const runCliAsync = async (...commandLine: string[]): Promise<string> => {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    const entry = path.resolve("node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");
    const { stdout } = await promisify(execFile)(executable, [entry, ...commandLine], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 30_000 });
    return stdout;
  };

  const runCommandAsync = async (dataDirectory: string, command: string): Promise<void> => {
    await runCliAsync("run", command, "--data-dir", dataDirectory);
  };

  const startProgramAsync = async (dataDirectory: string): Promise<number[]> => {
    const started = JSON.parse(await runCliAsync("run", "clock.startProgram", "--json", "--data-dir", dataDirectory)) as { processId: number; childProcessId: number };
    return [started.processId, started.childProcessId];
  };

  const readLogAsync = async (desktop: DesktopApplicationFixture, name: string): Promise<string | null> => {
    const file = path.join(desktop.dataDirectory, "logs", name);
    return existsSync(file) ? await readFile(file, "utf8") : null;
  };

  const readWorkAsync = async (dataDirectory: string): Promise<string[]> => {
    return (JSON.parse(await runCliAsync("status", "--json", "--data-dir", dataDirectory)) as { work: string[] }).work;
  };

  const waitForWorkAsync = async (desktop: DesktopApplicationFixture): Promise<void> => {
    let reported: string = "no report";
    try {
      await expect.poll(async () => {
        reported = JSON.stringify(await readWorkAsync(desktop.dataDirectory));
        return reported;
      }, { timeout: 20_000, intervals: [500] }).toBe(JSON.stringify(["Counting the ticks"]));
    }
    catch (error) {
      const runtimeLog = await readLogAsync(desktop, "runtime.log");
      const desktopLog = await readLogAsync(desktop, "desktop.log");
      throw new Error([
        "The shell did not report the work before the window was closed.",
        `The shell's work report, the one the quit question reads: ${reported}.`,
        `The work command ran (the clock's work folder exists): ${existsSync(path.join(desktop.dataDirectory, "work", "clock"))}.`,
        `The runtime logged that the clock began counting: ${runtimeLog?.includes("clock: The clock began counting.") ?? false}.`,
        `Runtime log: ${runtimeLog === null ? "missing" : JSON.stringify(runtimeLog.split("\n").slice(-8))}.`,
        `Desktop log: ${desktopLog === null ? "missing" : JSON.stringify(desktopLog.split("\n").slice(-8))}.`
      ].join("\n"), { cause: error });
    }
  };

  const beginWorkAsync = async (desktop: DesktopApplicationFixture): Promise<void> => {
    const window = desktop.window;
    await CommandSearchFixture.searchAsync(window, "Begin work");
    await expect(window.locator(".tr-command-search-pane [role=option]").first()).toHaveAttribute("data-item", "clock.beginWork");
    await window.keyboard.press("Enter");
    await waitForWorkAsync(desktop);
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
    await beginWorkAsync(desktop);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await closeWindowAsync(desktop);
    await expect(asking).toBeVisible();
    await expect(asking.getByRole("listitem")).toHaveText(["Counting the ticks"]);
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
    await runCommandAsync(desktop.dataDirectory, "clock.finishWork");

    expect(await exited).toBe(0);
    expect(existsSync(path.join(desktop.dataDirectory, "work", "clock", "stopped"))).toBe(false);
  });

  test("keeps the focus in the question on F10 or a lone Alt with the window behind it inert, and F10 reaches the menus again once the person cancels", async ({ desktop }) => {
    const window = desktop.window;
    const content = window.locator("tr-window");
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await beginWorkAsync(desktop);
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
    await runCommandAsync(desktop.dataDirectory, "clock.finishWork");
    await expect.poll(() => readWorkAsync(desktop.dataDirectory), { timeout: 20_000, intervals: [500] }).toEqual([]);
  });

  test("paints the question's body in the dialog's text color at full opacity as it opens, without a pointer move, in light and in dark mode", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await beginWorkAsync(desktop);
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
    await runCommandAsync(desktop.dataDirectory, "clock.finishWork");
    await expect.poll(() => readWorkAsync(desktop.dataDirectory), { timeout: 20_000, intervals: [500] }).toEqual([]);
  });

  test("stops the work and quits when the person chooses to, and the runtime stops with it and ends the programs its modules run", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    const programs = await startProgramAsync(desktop.dataDirectory);
    expect(programs.every(t => DesktopApplicationFixture.isAlive(t))).toBe(true);
    await beginWorkAsync(desktop);
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
