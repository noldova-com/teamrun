/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { expect, test } from "playwright/test";

import { WindowsProcesses } from "./fixtures/windows-processes.ts";

const MODULES = "modules ";
const NO_MODULES = `${MODULES}0`;
const MAX_BUFFER = 64 * 1024 * 1024;
const LINE_BREAK = /\r?\n/;
const STARTED_BY = / \(started by \d+\)$/;
const DIGITS = /^\d+$/;
const KEEP_SCRIPT = "setInterval(() => undefined, 1000)";
const HOLDER_SCRIPT = "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", process.argv[1], process.argv[2]], { stdio: \"ignore\", detached: true }); child.unref(); "
  + "process.stdout.write(String(child.pid) + String.fromCharCode(10)); setInterval(() => undefined, 1000)";

const runs = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  }
  catch {
    return false;
  }
};

const answerOf = (script: string, work: string | null = null): readonly [number | null, readonly string[]] => {
  const environment = Object.isNull(work) ? process.env : { ...process.env, [WindowsProcesses.WORK_VARIABLE]: work };
  const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", `${script}; '${MODULES}' + @(Get-Module).Count`],
    { encoding: "utf8", env: environment, maxBuffer: MAX_BUFFER });
  return [result.status, result.stdout.split(LINE_BREAK).filter(t => t !== "")];
};

const stoppedOf = (lines: readonly string[]): readonly string[] => lines.map(t => t.replace(STARTED_BY, "")).sort();

test.describe("Windows process scripts", () => {
  test.skip(process.platform !== "win32", "The fixture runs these scripts on Windows only.");

  test("lists this process under its parent, with its command line, without loading a PowerShell module", () => {
    const [status, lines] = answerOf(WindowsProcesses.PROCESSES_SCRIPT);

    const mine = WindowsProcesses.processesOf(lines.join(String.fromCharCode(10))).find(t => t.pid === process.pid);
    expect([status, lines.at(-1), mine?.parent, mine?.command.includes(process.execPath) ?? false, DIGITS.test(mine?.start ?? "")])
      .toEqual([0, NO_MODULES, process.ppid, true, true]);
  });

  test("lists and ends what names the work folder and what it started, without loading a PowerShell module", async () => {
    const work = mkdtempSync(join(tmpdir(), "tre-holders-"));
    const holder = spawn(process.execPath, ["-e", HOLDER_SCRIPT, KEEP_SCRIPT, work], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    const started = await new Promise<string>(resolve => holder.stdout.once("data", (data: Buffer) => resolve(data.toString("utf8"))));
    const holderId = String(holder.pid);
    const childId = started.trim();
    try {
      const [listedStatus, listed] = answerOf(WindowsProcesses.holdersScript(false), work);
      const [endedStatus, ended] = answerOf(WindowsProcesses.holdersScript(true), work);

      expect([listedStatus, [...listed].sort(), endedStatus, stoppedOf(ended), runs(Number(holderId)), runs(Number(childId))]).toEqual([
        0, [`${holderId} node.exe`, `${childId} node.exe`, NO_MODULES].sort(), 0, [`stopped ${holderId} node.exe`, `stopped ${childId} node.exe`, NO_MODULES].sort(), false, false]);
    }
    finally {
      for (const pid of [Number(holderId), Number(childId)].filter(t => runs(t)))
        process.kill(pid);
      rmSync(work, { recursive: true, force: true });
    }
  });
});
