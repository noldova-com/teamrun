/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the harness's teardown", () => {
  const holderScript = "const fs = require('node:fs'); const { spawn } = require('node:child_process'); " +
    "const [mode, data, release, result] = process.argv.slice(2); " +
    "if (mode === 'start') { " +
    "const holder = spawn(process.execPath, [process.argv[1], 'hold', data, release, result], { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }); " +
    "holder.unref(); process.parentPort.postMessage(holder.pid); } " +
    "else { setInterval(() => { if (fs.existsSync(release)) { fs.writeFileSync(result, String(fs.existsSync(data))); process.exit(0); } }, 20); " +
    "setTimeout(() => process.exit(1), 120000); }";

  test("removes TeamRun's folder only after every process TeamRun started has exited", async ({ desktop }, testInfo) => {
    const release = testInfo.outputPath("release");
    const result = testInfo.outputPath("result.txt");
    const script = testInfo.outputPath("holder.cjs");
    await writeFile(script, holderScript);
    const holder = await desktop.application.evaluate(({ utilityProcess }, [file, root, data, releaseFile, resultFile]) => {
      const starter = utilityProcess.fork(file, ["start", data, releaseFile, resultFile], { cwd: root, stdio: "ignore", serviceName: "teardown holder starter" });
      return new Promise<number>(resolve => starter.once("message", (processId: number) => resolve(processId)));
    }, [script, desktop.root, desktop.dataDirectory, release, result] as const);
    let isSettled = false;

    const disposing = desktop.disposeAsync(false).finally(() => {
      isSettled = true;
    });
    disposing.catch(() => undefined);
    let wasSettled = true;
    let hadFolder = false;
    try {
      await expect.poll(() => isSettled || !existsSync(desktop.root) || desktop.awaitedProcessIds.includes(holder), { timeout: 45_000 }).toBe(true);
      wasSettled = isSettled;
      hadFolder = existsSync(desktop.dataDirectory);
    }
    finally {
      await writeFile(release, "");
    }
    await disposing;

    expect(holder).toBeGreaterThan(0);
    expect([wasSettled, hadFolder]).toEqual([false, true]);
    expect(await readFile(result, "utf8")).toBe("true");
    expect(existsSync(desktop.root)).toBe(false);
  });
});
