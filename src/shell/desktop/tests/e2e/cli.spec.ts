/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the command line", () => {
  const entry = path.resolve("node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");

  const runAsync = async (commandLine: readonly string[]): Promise<{ code: number; output: string; error: string }> => {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    try {
      const { stdout, stderr } = await promisify(execFile)(executable, [entry, ...commandLine], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 30_000 });
      return { code: 0, output: stdout, error: stderr };
    }
    catch (error) {
      const failed = error as { code: number; stdout: string; stderr: string };
      return { code: failed.code, output: failed.stdout, error: failed.stderr };
    }
  };

  test("reports the modules of the runtime the open window uses and runs its commands", async ({ desktop }) => {
    const status = await runAsync(["status", "--json", "--data-dir", desktop.dataDirectory]);
    const tick = await runAsync(["run", "clock.tick", "--json", "--data-dir", desktop.dataDirectory]);

    expect(status.code, status.error).toBe(0);
    const report = JSON.parse(status.output) as { dataDirectory: string; modules: { id: string; state: string }[] };
    expect(report.dataDirectory).toBe(desktop.dataDirectory);
    expect(report.modules).toEqual(expect.arrayContaining([{ id: "clock", state: "Active" }, { id: "notes", state: "Active" }]));
    expect(tick.code, tick.error).toBe(0);
    expect(JSON.parse(tick.output)).toEqual({ ticks: 1 });
    expect(await desktop.readRuntimeProcessIdAsync()).toBeGreaterThan(0);
    await desktop.checkpointAsync("cli-window");
  });

  test("runs a module's own command through its command-line part and prints its help", async ({ desktop }) => {
    const text = await runAsync(["clock", "show-time", "--prefix", "Now", "--data-dir", desktop.dataDirectory]);
    const json = await runAsync(["clock", "show-time", "--json", "--data-dir", desktop.dataDirectory]);
    const help = await runAsync(["help", "clock", "show-time"]);
    const unknown = await runAsync(["clock", "rewind", "--data-dir", desktop.dataDirectory]);

    expect(text.code, text.error).toBe(0);
    expect(text.output).toMatch(/^Now \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.\r?\n$/);
    expect(json.code, json.error).toBe(0);
    expect(Date.parse((JSON.parse(json.output) as { time: string }).time)).not.toBeNaN();
    expect(help.code, help.error).toBe(0);
    expect(help.output).toContain("Usage: teamrun clock show-time [--prefix <text>]");
    expect(help.output).toContain("--prefix <text>  The words before the time. Default: \"It is\".");
    expect(unknown.code).toBe(2);
    expect(unknown.error).toContain("\"rewind\" is not a command of clock.");
  });
});
