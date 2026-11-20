/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import type { Writable } from "node:stream";

import { ProcessEnd } from "./process-end.ts";
import { ProcessResult } from "./process-result.ts";
import { ProcessTimeoutException } from "./process-timeout.exception.ts";
import { ProcessException } from "./process.exception.ts";

export class ProcessRunner {
  private static readonly OUTPUT_LIMIT: number = 16 * 1024 * 1024;

  public captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: environment ?? process.env });
      const output: Buffer[] = [];
      const errorOutput: Buffer[] = [];
      let size = 0;
      let failure: ProcessException | null = null;
      const stop = (t: ProcessException): void => {
        failure ??= t;
        child.kill();
      };
      const receive = (chunks: Buffer[], chunk: Buffer): void => {
        size += chunk.length;
        if (size > ProcessRunner.OUTPUT_LIMIT)
          stop(new ProcessException(`"${command}" wrote more than ${ProcessRunner.OUTPUT_LIMIT} bytes.`));
        else
          chunks.push(chunk);
      };
      const timer = setTimeout(() => stop(new ProcessTimeoutException(`"${command}" did not finish within ${timeout} ms.`)), timeout);
      child.stdout.on("data", (t: Buffer) => receive(output, t));
      child.stderr.on("data", (t: Buffer) => receive(errorOutput, t));
      child.on("error", t => stop(new ProcessException(`"${command}" could not start.`, { cause: t })));
      child.on("close", t => {
        clearTimeout(timer);
        if (failure === null)
          resolve(new ProcessResult(t, Buffer.concat(output).toString("utf8"), Buffer.concat(errorOutput).toString("utf8")));
        else
          reject(failure);
      });
    });
  }

  public async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv, timeout?: number): Promise<number | null> {
    return (await this.runToEndAsync(command, commandArguments, directory, environment, timeout)).exitCode;
  }

  public runToEndAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv, timeout?: number): Promise<ProcessEnd> {
    return new Promise<ProcessEnd>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: "inherit", env: environment ?? process.env });
      let failure: ProcessException | null = null;
      const timer = timeout === undefined ? undefined : setTimeout(() => {
        failure = new ProcessTimeoutException(`"${command}" did not finish within ${timeout} ms.`);
        child.kill();
      }, timeout);
      child.on("error", t => {
        clearTimeout(timer);
        reject(new ProcessException(`"${command}" could not start.`, { cause: t }));
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        if (failure === null)
          resolve(new ProcessEnd(code, signal));
        else
          reject(failure);
      });
    });
  }

  public async runLoggedAsync(command: string, commandArguments: readonly string[], directory: string, log: string, output: Writable, errorOutput: Writable, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    return (await this.runLoggedToEndAsync(command, commandArguments, directory, log, output, errorOutput, environment)).exitCode;
  }

  public runLoggedToEndAsync(command: string, commandArguments: readonly string[], directory: string, log: string, output: Writable, errorOutput: Writable, environment?: NodeJS.ProcessEnv,
    timeout?: number): Promise<ProcessEnd> {
    return new Promise<ProcessEnd>((resolve, reject) => {
      const file = createWriteStream(log);
      const child = spawn(command, [...commandArguments], { cwd: directory, env: environment, shell: false, stdio: ["inherit", "pipe", "pipe"] });
      let failure: ProcessException | null = null;
      const timer = timeout === undefined ? undefined : setTimeout(() => {
        failure ??= new ProcessTimeoutException(`"${command}" did not finish within ${timeout} ms.`);
        child.kill();
      }, timeout);
      const forward = (target: Writable, chunk: Buffer): void => {
        target.write(chunk);
        file.write(chunk);
      };
      child.stdout.on("data", (t: Buffer) => forward(output, t));
      child.stderr.on("data", (t: Buffer) => forward(errorOutput, t));
      child.on("error", t => failure = new ProcessException(`"${command}" could not start.`, { cause: t }));
      let probe: NodeJS.Timeout | undefined;
      const started = new Date(Date.now() - 5000).toISOString();
      const tree = (): void => {
        const asked = new Date().toISOString();
        execFile("powershell", ["-NoProfile", "-Command", `$s = [datetime]::Parse('${started}').ToUniversalTime(); Get-CimInstance Win32_Process | Where-Object { $_.CreationDate -and $_.CreationDate.ToUniversalTime() -ge $s -and $_.Name -ne 'powershell.exe' } | ForEach-Object { 'PROBE-TREE ' + $_.ProcessId + '<' + $_.ParentProcessId + ' ' + $_.Name + ' ' + $_.CreationDate.ToUniversalTime().ToString('HH:mm:ss.fff') + ' ' + ([string]$_.CommandLine).Substring(0, [Math]::Min(160, ([string]$_.CommandLine).Length)) }`], { encoding: "utf8" }, (_error, stdout) => {
          for (const line of stdout.split(/\r?\n/).filter(t => t.length > 0))
            process.stderr.write(`PROBE ${asked} ${line}\n`);
        });
      };
      const watch = (chunk: Buffer): void => {
        if (probe === undefined && process.platform === "win32" && chunk.toString().includes("Coverage ignores")) {
          process.stderr.write(`PROBE ${new Date().toISOString()} child ${child.pid} reported\n`);
          tree();
          probe = setInterval(tree, 5000);
        }
      };
      child.stdout.on("data", watch);
      child.on("exit", code => process.stderr.write(`PROBE ${new Date().toISOString()} child ${child.pid} exit ${code}\n`));
      child.on("close", (code, signal) => {
        clearInterval(probe);
        process.stderr.write(`PROBE ${new Date().toISOString()} child ${child.pid} close ${code}\n`);
        clearTimeout(timer);
        file.end(() => failure === null ? resolve(new ProcessEnd(code, signal)) : reject(failure));
      });
    });
  }
}
