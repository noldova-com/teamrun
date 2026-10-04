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

import { expect } from "@playwright/test";

import CliFixture from "./cli.fixture.ts";
import CommandSearchFixture from "./command-search.fixture.ts";
import type DesktopApplicationFixture from "./desktop-application.fixture.ts";

export default class ClockWorkFixture {
  public static readonly WORK: string = "Counting the ticks";
  public static readonly TIMEOUT: number = 20_000;
  public static readonly INTERVAL: number = 500;

  public static async beginAsync(desktop: DesktopApplicationFixture): Promise<void> {
    const window = desktop.window;
    await CommandSearchFixture.searchAsync(window, "Begin work");
    await expect(window.locator(".tr-command-search-pane [role=option]").first()).toHaveAttribute("data-item", "clock.beginWork");
    await window.keyboard.press("Enter");
    await ClockWorkFixture.waitForReportAsync(desktop.dataDirectory);
  }

  public static async finishAsync(dataDirectory: string): Promise<void> {
    await CliFixture.runAsync("run", "clock.finishWork", "--data-dir", dataDirectory);
  }

  public static async readAsync(dataDirectory: string): Promise<string[]> {
    return (JSON.parse(await CliFixture.runAsync("status", "--json", "--data-dir", dataDirectory)) as { work: string[] }).work;
  }

  private static async waitForReportAsync(dataDirectory: string): Promise<void> {
    let reported: string = "no report";
    try {
      await expect.poll(async () => {
        reported = JSON.stringify(await ClockWorkFixture.readAsync(dataDirectory));
        return reported;
      }, { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toBe(JSON.stringify([ClockWorkFixture.WORK]));
    }
    catch (error) {
      const runtimeLog = await ClockWorkFixture.readLogAsync(dataDirectory, "runtime.log");
      const desktopLog = await ClockWorkFixture.readLogAsync(dataDirectory, "desktop.log");
      throw new Error([
        "The shell did not report the work before the window was closed.",
        `The shell's work report, the one the quit question reads: ${reported}.`,
        `The work command ran (the clock's work folder exists): ${existsSync(path.join(dataDirectory, "work", "clock"))}.`,
        `The runtime logged that the clock began counting: ${runtimeLog?.includes("clock: The clock began counting.") ?? false}.`,
        `Runtime log: ${runtimeLog === null ? "missing" : JSON.stringify(runtimeLog.split("\n").slice(-8))}.`,
        `Desktop log: ${desktopLog === null ? "missing" : JSON.stringify(desktopLog.split("\n").slice(-8))}.`
      ].join("\n"), { cause: error });
    }
  }

  private static async readLogAsync(dataDirectory: string, name: string): Promise<string | null> {
    const file = path.join(dataDirectory, "logs", name);
    return existsSync(file) ? await readFile(file, "utf8") : null;
  }
}
