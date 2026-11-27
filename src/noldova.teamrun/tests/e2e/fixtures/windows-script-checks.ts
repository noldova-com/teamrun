/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";

import "@noldova/context.core";

import { ScriptAnswer } from "./script-answer.ts";

export class WindowsScriptChecks {
  private static readonly MODULES: string = "modules ";
  public static readonly NO_MODULES: string = `${WindowsScriptChecks.MODULES}0`;
  private static readonly BUFFER: number = 64 * 1024 * 1024;
  private static readonly LINE_BREAK: RegExp = /\r?\n/;
  private static readonly STARTED_BY: RegExp = / \(started by \d+\)$/;

  public static answerOf(script: string, environment: NodeJS.ProcessEnv = process.env): ScriptAnswer {
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `${script}; '${WindowsScriptChecks.MODULES}' + @(Get-Module).Count`],
      { encoding: "utf8", env: environment, maxBuffer: WindowsScriptChecks.BUFFER });
    return new ScriptAnswer(result.status, result.stdout.split(WindowsScriptChecks.LINE_BREAK).filter(t => t !== String.empty));
  }

  public static runs(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static stoppedOf(lines: readonly string[]): readonly string[] {
    return lines.map(t => t.replace(WindowsScriptChecks.STARTED_BY, String.empty)).sort();
  }
}
