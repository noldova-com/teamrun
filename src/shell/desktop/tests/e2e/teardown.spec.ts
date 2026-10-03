/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import ProcessListFixture from "./fixtures/process-list.fixture.ts";

test.describe("the harness's teardown", () => {
  const holderScript = "const fs = require('node:fs'); const release = process.argv[1]; " +
    "setInterval(() => { if (fs.existsSync(release)) process.exit(0); }, 20); setTimeout(() => process.exit(1), 120000);";

  const startHolderAsync = async (folder: string, release: string): Promise<ChildProcess> => {
    const holder = spawn(process.execPath, ["-e", holderScript, release], { cwd: folder, stdio: "ignore", windowsHide: true });
    await new Promise((resolve, reject) => {
      holder.once("spawn", resolve);
      holder.once("error", reject);
    });
    return holder;
  };

  test("waits until every process has left the process list, however long it runs", async ({}, testInfo) => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-teardown-"));
    const release = testInfo.outputPath("release");
    const holder = await startHolderAsync(folder, release);
    let awaited: readonly number[] = [];
    let isSettled = false;
    try {
      const waiting = ProcessListFixture.waitForExitAsync([holder.pid ?? 0], 60_000, t => {
        awaited = t;
      }).finally(() => {
        isSettled = true;
      });
      await expect.poll(() => awaited.includes(holder.pid ?? 0) || isSettled).toBe(true);
      const wasSettled = isSettled;
      await writeFile(release, "");

      expect(wasSettled).toBe(false);
      expect(await waiting).toEqual([]);
      expect(await ProcessListFixture.readRunningAsync([holder.pid ?? 0])).toEqual([]);
    }
    finally {
      await writeFile(release, "");
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("gives up at its limit and names each process that still runs", async ({}, testInfo) => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-teardown-"));
    const release = testInfo.outputPath("release");
    const holder = await startHolderAsync(folder, release);
    try {
      const running = await ProcessListFixture.waitForExitAsync([holder.pid ?? 0], 500);
      const described = await ProcessListFixture.describeAsync(running);

      expect(running).toEqual([holder.pid]);
      expect(described).toContain(`${holder.pid} `);
      expect(described.toLowerCase()).toContain(path.basename(process.execPath).toLowerCase());
    }
    finally {
      await writeFile(release, "");
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

  test("records every process TeamRun runs, its Electron processes and its runtime, and removes its folder once they have all ended", async ({ desktop }) => {
    const electron = await desktop.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid));
    const runtime = await desktop.readRuntimeProcessIdAsync();

    await desktop.disposeAsync(false);

    expect(runtime).toBeDefined();
    expect(desktop.recordedProcessIds).toEqual(expect.arrayContaining([...electron, runtime ?? 0]));
    expect(await ProcessListFixture.waitForSignalsAsync(desktop.recordedProcessIds, 0)).toEqual([]);
    expect(existsSync(desktop.root)).toBe(false);
  });
});
