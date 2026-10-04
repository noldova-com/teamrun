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
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the programs modules run", () => {
  const startProgramAsync = async (dataDirectory: string): Promise<number[]> => {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    const entry = path.resolve("node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");
    const commandLine = [entry, "run", "clock.startProgram", "--json", "--data-dir", dataDirectory];
    const { stdout } = await promisify(execFile)(executable, commandLine, { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 30_000 });
    const started = JSON.parse(stdout) as { processId: number; childProcessId: number };
    return [started.processId, started.childProcessId];
  };

  const readSeen = (dataDirectory: string): number => {
    const database = new DatabaseSync(path.join(dataDirectory, "shell.sqlite"), { readOnly: true });
    try {
      return Number(database.prepare("SELECT max(seen) AS seen FROM owned_processes").get()?.["seen"]);
    }
    finally {
      database.close();
    }
  };

  test("a runtime that ends abruptly leaves its programs running until the runtime that replaces it ends them", async ({ desktop }) => {
    const window = desktop.window;
    const note = window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]");
    await expect(note).toBeVisible();
    const programs = await startProgramAsync(desktop.dataDirectory);
    const runtime = await desktop.readRuntimeProcessIdAsync() ?? 0;
    expect(programs.every(t => DesktopApplicationFixture.isAlive(t))).toBe(true);
    const seen = readSeen(desktop.dataDirectory);
    await expect.poll(() => readSeen(desktop.dataDirectory) > seen, { timeout: 15_000 }).toBe(true);

    process.kill(runtime, "SIGKILL");
    await expect.poll(() => DesktopApplicationFixture.isAlive(runtime)).toBe(false);
    expect(DesktopApplicationFixture.isAlive(programs[1] ?? 0)).toBe(true);

    await expect.poll(async () => {
      const replacement = await desktop.readRuntimeProcessIdAsync();
      return replacement !== undefined && replacement !== runtime && DesktopApplicationFixture.isAlive(replacement);
    }, { timeout: 30_000 }).toBe(true);
    await expect.poll(() => programs.filter(t => DesktopApplicationFixture.isAlive(t)), { timeout: 10_000 }).toEqual([]);
    await expect(note).toBeVisible();
    await desktop.checkpointAsync("programs-replacement-runtime");
    expect(await readFile(path.join(desktop.dataDirectory, "logs", "runtime.log"), "utf8")).toContain("An earlier runtime left processes");
  });
});
