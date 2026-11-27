/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { expect, test } from "playwright/test";

import { WindowsProcesses } from "./fixtures/windows-processes.ts";
import { WindowsScriptChecks } from "./fixtures/windows-script-checks.ts";

const DIGITS = /^\d+$/;
const KEEP_SCRIPT = "setInterval(() => undefined, 1000)";
const HOLDER_SCRIPT = "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", process.argv[1], process.argv[2]], { stdio: \"ignore\", detached: true }); child.unref(); "
  + "process.stdout.write(String(child.pid) + String.fromCharCode(10)); setInterval(() => undefined, 1000)";

test.describe("Windows process scripts", () => {
  test.skip(process.platform !== "win32", "The fixture runs these scripts on Windows only.");

  test("lists this process under its parent, with its command line, without loading a PowerShell module", () => {
    const answer = WindowsScriptChecks.answerOf(WindowsProcesses.PROCESSES_SCRIPT);

    const mine = WindowsProcesses.processesOf(answer.lines.join(String.fromCharCode(10))).find(t => t.pid === process.pid);
    expect([answer.status, answer.lines.at(-1), mine?.parent, mine?.command.includes(process.execPath) ?? false, DIGITS.test(mine?.start ?? "")])
      .toEqual([0, WindowsScriptChecks.NO_MODULES, process.ppid, true, true]);
  });

  test("lists and ends what names the work folder and what it started, without loading a PowerShell module", async () => {
    const work = mkdtempSync(join(tmpdir(), "tre-holders-"));
    const holder = spawn(process.execPath, ["-e", HOLDER_SCRIPT, KEEP_SCRIPT, work], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    const started = await new Promise<string>(resolve => holder.stdout.once("data", (data: Buffer) => resolve(data.toString("utf8"))));
    const holderId = String(holder.pid);
    const childId = started.trim();
    const environment = { ...process.env, [WindowsProcesses.WORK_VARIABLE]: work };
    try {
      const listed = WindowsScriptChecks.answerOf(WindowsProcesses.holdersScript(false), environment);
      const ended = WindowsScriptChecks.answerOf(WindowsProcesses.holdersScript(true), environment);

      expect([listed.status, [...listed.lines].sort(), ended.status, WindowsScriptChecks.stoppedOf(ended.lines), WindowsScriptChecks.runs(Number(holderId)),
        WindowsScriptChecks.runs(Number(childId))]).toEqual([0, [`${holderId} node.exe`, `${childId} node.exe`, WindowsScriptChecks.NO_MODULES].sort(), 0,
        [`stopped ${holderId} node.exe`, `stopped ${childId} node.exe`, WindowsScriptChecks.NO_MODULES].sort(), false, false]);
    }
    finally {
      if (Object.isNull(holder.exitCode) && Object.isNull(holder.signalCode))
        holder.kill();
      WindowsScriptChecks.answerOf(WindowsProcesses.holdersScript(true), environment);
      rmSync(work, { recursive: true, force: true });
    }
  });
});
