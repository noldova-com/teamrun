/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import { Resources } from "../../resources.js";

export class SystemCommand {
  private static diagSeq: number = 0;

  public runAsync(file: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv = process.env): Promise<string> {
    const isShell = file.toLowerCase().endsWith("powershell.exe");
    const seq = `${process.pid}.${++SystemCommand.diagSeq}`;
    let runArguments = [...commandArguments];
    let kind = "other";
    if (isShell) {
      const script = Buffer.from(String(runArguments.at(-1)), "base64").toString("utf16le");
      kind = script.includes("Get-WmiObject") ? "table" : "kill";
      const prefix = "function M($n) { [Console]::Error.WriteLine(\"P $n $([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())\") }; " +
        "[Console]::Error.WriteLine(\"P psStart $(([DateTimeOffset][System.Diagnostics.Process]::GetCurrentProcess().StartTime).ToUnixTimeMilliseconds())\"); M 'script'; ";
      runArguments = [...runArguments.slice(0, -1), Buffer.from(prefix + script, "utf16le").toString("base64")];
    }
    const spawned = Date.now();
    return new Promise<string>((resolve, reject) => {
      execFile(
        file,
        runArguments,
        {
          encoding: Resources.utf8Encoding,
          env: environment,
          maxBuffer: Resources.commandOutputLimit,
          shell: false,
          timeout: Resources.commandTimeoutMilliseconds,
          windowsHide: true
        },
        (error, output, errors) => {
          if (isShell)
            process.stderr.write(`DIAG593 ${seq} ${kind} spawn=${spawned} settled=${Date.now()} ${Object.isNull(error) ? "done" : `failed ${error.message.replaceAll(/\s+/g, " ").slice(0, 160)}`} | ${String(errors).split(/\r?\n/).filter(t => t.startsWith("P ")).join(" | ")}\n`);
          if (Object.isNull(error))
            resolve(output);
          else
            reject(new SystemCommandException(Resources.formatCommandFailed(file, error.message), new ExceptionOptions(error)));
        });
    });
  }
}
