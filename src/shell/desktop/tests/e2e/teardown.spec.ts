/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DataDirectory, OwnershipLock } from "@noldova/teamrun-shell-runtime";

import ClockWorkFixture from "./fixtures/clock-work.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
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

  test("finds no runtime to stop in a directory whose ownership file is not a database, and fails on any other error reading it", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-teardown-"));
    try {
      const corrupt = path.join(folder, "corrupt");
      const unreadable = path.join(folder, "unreadable");
      await mkdir(corrupt);
      await writeFile(new DataDirectory(corrupt).ownershipDatabase, "This is not a database.");
      await mkdir(new DataDirectory(unreadable).ownershipDatabase, { recursive: true });

      await DesktopApplicationFixture.stopRuntimeAsync(corrupt);
      const failure = await DesktopApplicationFixture.stopRuntimeAsync(unreadable).then(() => null, (error: unknown) => error);

      expect(failure).toMatchObject({ errcode: expect.any(Number) });
      expect((failure as { errcode: number }).errcode).not.toBe(26);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 10 });
    }
  });

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

  const runtimeFiles = (dataDirectory: string): string[] => {
    const directory = new DataDirectory(dataDirectory);
    return [directory.shellDatabase, `${directory.shellDatabase}-wal`, `${directory.shellDatabase}-shm`, directory.ownershipDatabase, directory.runtimeLog];
  };

  test("stops the runtime by asking it, so it closes its database and the files it held can be removed as soon as the stop returns", async ({ desktop }) => {
    const files = runtimeFiles(desktop.dataDirectory);
    const held = files.filter(t => existsSync(t));
    expect(await desktop.closeAsync(true)).toBe(0);

    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);
    const isOwned = OwnershipLock.isOwned(new DataDirectory(desktop.dataDirectory));
    const left = files.filter(t => existsSync(t));
    for (const file of left)
      rmSync(file);

    expect(held).toEqual(files);
    expect(isOwned).toBe(false);
    expect(left).toEqual([files[0], ...files.slice(3)]);
    expect(left.filter(t => existsSync(t))).toEqual([]);
  });

  test.describe("with data from an earlier TeamRun", () => {
    test.use({ desktopDataFiles: { "conversations.json": "[]" } });

    test("stops the runtime that refuses that data, so the files it held can be removed as soon as the stop returns", async ({ desktop }) => {
      await expect(desktop.window.getByRole("heading", { name: "Data from an earlier TeamRun" })).toBeVisible();
      const files = runtimeFiles(desktop.dataDirectory);
      const held = files.filter(t => existsSync(t));
      expect(await desktop.closeAsync(true)).toBe(0);

      await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);
      const isOwned = OwnershipLock.isOwned(new DataDirectory(desktop.dataDirectory));
      for (const file of held)
        rmSync(file);

      expect(held).toEqual(files.slice(3));
      expect(isOwned).toBe(false);
      expect(held.filter(t => existsSync(t))).toEqual([]);
    });
  });

  test("records every process TeamRun runs, its Electron processes and its runtime, and removes its folder once they have all ended", async ({ desktop }) => {
    const electron = await desktop.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid));
    const runtime = await desktop.readRuntimeProcessIdAsync();
    await desktop.checkpointAsync("teardown-running");

    await desktop.disposeAsync(false);

    expect(runtime).toBeDefined();
    expect(desktop.recordedProcessIds).toEqual(expect.arrayContaining([...electron, runtime ?? 0]));
    expect(await ProcessListFixture.waitForSignalsAsync(desktop.recordedProcessIds, 0)).toEqual([]);
    expect(existsSync(desktop.root)).toBe(false);
  });

  test("a cleanup step that fails does not stop the later ones, so the runtime is still stopped and the folder removed, and the failure is reported", async ({ desktop }) => {
    const runtime = await desktop.readRuntimeProcessIdAsync();
    await desktop.application.evaluate(({ app }) => {
      app.getAppMetrics = () => {
        throw new Error("The test made listing the processes fail.");
      };
    });

    const failure = await desktop.disposeAsync(false).then(() => null, (error: unknown) => error);

    expect(runtime).toBeDefined();
    expect(failure).not.toBeInstanceOf(AggregateError);
    expect(String(failure)).toContain("The test made listing the processes fail.");
    await expect.poll(() => runtime !== undefined && DesktopApplicationFixture.isAlive(runtime)).toBe(false);
    expect(existsSync(desktop.root)).toBe(false);
  });

  test("a main process that stops answering fails the call that waited on it, is reported with what it was asked, and is killed", async ({ desktop }, testInfo) => {
    const main = await desktop.application.evaluate(() => process.pid);
    const blocked = desktop.application.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000);
    });
    blocked.catch(() => undefined);

    const failure = await desktop.isVisibleAsync().then(() => null, (error: unknown) => (error as Error).message);
    await desktop.disposeAsync(false);
    const report = testInfo.attachments.find(t => t.name === "main-process.txt")?.body?.toString() ?? "";

    expect(failure).toMatch(/^The main process did not answer within 10 s when asked to say whether a window is visible\.\nThe last of the harness's own calls it answered was to .+, \d+ ms before this one was asked; the workflow's own calls are not counted\.\nThe desktop log shows no main-process failure\.\nBefore the move, the cursor was at -?\d+,-?\d+, /);
    expect(desktop.acceptFailures(new RegExp(`^The main process ${main} did not answer for \\d+ s after it was asked to say whether a window is visible, so the test killed it\\.$`))).toHaveLength(1);
    expect(report).toMatch(new RegExp(`^The main process ${main} stopped answering when it was asked to say whether a window is visible, \\d+ s before this report\\.\\n`));
    expect(report).toMatch(/\nIts processor time was \d+ ms when it stopped answering and \d+ ms now\.\n/);
    expect(report).toMatch(/\nThe window's request to it, teamrun\.readBuild\(\), was answered in \d+ ms\.\n/);
    expect(await ProcessListFixture.waitForSignalsAsync(desktop.recordedProcessIds, 0)).toEqual([]);
    expect(existsSync(desktop.root)).toBe(false);
  });

  test("a main process that fails and then stops answering fails the call that waited on it with the failure the desktop log holds", async ({ desktop }) => {
    await desktop.application.evaluate(({ dialog }) => {
      dialog.showMessageBox = (() => new Promise(() => undefined)) as typeof dialog.showMessageBox;
      setImmediate(() => {
        throw new Error("A failure the test threw in the main process.");
      });
    });
    await expect.poll(() => desktop.failures.some(t => t.includes("A failure the test threw in the main process."))).toBe(true);
    const blocked = desktop.application.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000);
    });
    blocked.catch(() => undefined);

    const failure = await desktop.isVisibleAsync().then(() => null, (error: unknown) => (error as Error).message);
    await desktop.disposeAsync(false);

    expect(failure).toMatch(/\nThe desktop log shows this main-process failure:\n\S+ The desktop's main process failed with an uncaught exception: Error: A failure the test threw in the main process\.\n {4}at [^\n]+\n(?: {4}[^\n]*\n)*Before the move, /);
    expect(desktop.acceptFailures(/^main: (?:\S+ The desktop's main process failed|at )/).length).toBeGreaterThanOrEqual(2);
    expect(desktop.acceptFailures(/^The main process \d+ did not answer for \d+ s after it was asked to say whether a window is visible, so the test killed it\.$/)).toHaveLength(1);
    expect(desktop.failures).toEqual([]);
  });

  test("a main process that stays silent is still reported, with the window's unanswered request and its threads", async ({ desktop }, testInfo) => {
    test.setTimeout(150_000);
    const main = await desktop.application.evaluate(() => process.pid);
    const blocked = desktop.application.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
    });
    blocked.catch(() => undefined);

    await desktop.isVisibleAsync().catch(() => undefined);
    await desktop.disposeAsync(false);
    const report = testInfo.attachments.find(t => t.name === "main-process.txt")?.body?.toString() ?? "";
    const threads = testInfo.attachments.find(t => t.name === "main-process-threads.txt")?.body?.toString() ?? "";

    expect(desktop.acceptFailures(new RegExp(`^The main process ${main} did not answer for \\d+ s after it was asked to say whether a window is visible, so the test killed it\\.$`))).toHaveLength(1);
    expect(report).toMatch(new RegExp(`^The main process ${main} stopped answering when it was asked to say whether a window is visible, \\d+ s before this report\\.\\n`));
    expect(report).toMatch(/\nThe window's request to it, teamrun\.readBuild\(\), had no answer within 10 s\.\n/);
    expect(threads).toMatch(process.platform === "darwin"
      ? new RegExp(`^Analysis of sampling .* \\(pid ${main}\\)[\\s\\S]*Call graph:`)
      : process.platform === "win32" ? /^\d+ Wait \w+ \d+ ms\r?$/m : /^\s*\d+ \S+ .*\d+:\d+(?:\.\d+)? \S/m);
    expect(testInfo.attachments.map(t => t.name)).toEqual(expect.arrayContaining(["page-0.png.unavailable.txt", "page-0.html.unavailable.txt"]));
    expect(await ProcessListFixture.waitForSignalsAsync(desktop.recordedProcessIds, 0)).toEqual([]);
  });

  test("a quit that stops at the question about running work is reported with the question, not as a silent main process", async ({ desktop }) => {
    test.setTimeout(120_000);
    await ClockWorkFixture.beginAsync(desktop);

    await desktop.disposeAsync(false);
    const reported = desktop.acceptFailures(/^TeamRun did not quit/);

    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(/^TeamRun did not quit within 30 s because window 0 asked the question below, so the test killed it\.\nThe test left work running: finish or stop it before the test ends\.\n- dialog "Work is still running":\n/);
    expect(reported[0]).toContain(`- listitem: ${ClockWorkFixture.WORK}`);
    expect(desktop.failures).toEqual([]);
    expect(await ProcessListFixture.waitForSignalsAsync(desktop.recordedProcessIds, 0)).toEqual([]);
  });
});
