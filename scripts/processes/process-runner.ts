/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { closeSync, createWriteStream, openSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import ProcessResult from "./process-result.ts";
import ProcessTimeoutException from "./process-timeout.exception.ts";
import ProcessException from "./process.exception.ts";
import StartedProcess from "./started-process.ts";

export default class ProcessRunner {
  private static readonly OUTPUT_LIMIT: number = 16 * 1024 * 1024;
  private static readonly MISSING_PROCESS_CODE: string = "ESRCH";
  private static readonly KILL_SIGNAL: NodeJS.Signals = "SIGKILL";

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

  public async requireAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<void> {
    const result = await this.captureAsync(command, commandArguments, directory, timeout, environment);
    if (!result.isSuccessful)
      throw new ProcessException(`${path.basename(command)} ${commandArguments.join(" ")} failed with exit code ${result.exitCode}:\n${result.text}`);
  }

  public runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: "inherit", env: environment ?? process.env });
      child.on("error", t => reject(new ProcessException(`"${command}" could not start.`, { cause: t })));
      child.on("close", t => resolve(t));
    });
  }

  public startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<StartedProcess> {
    return new Promise<StartedProcess>((resolve, reject) => {
      const file = openSync(log, "w");
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: ["ignore", file, file] });
      closeSync(file);
      child.once("error", t => reject(new ProcessException(`"${command}" could not start.`, { cause: t })));
      child.once("spawn", () => resolve(new StartedProcess(child)));
    });
  }

  public isRunning(processId: number): boolean {
    return ProcessRunner.signal(processId, 0);
  }

  public kill(processId: number): void {
    ProcessRunner.signal(processId, ProcessRunner.KILL_SIGNAL);
  }

  public runLoggedAsync(command: string, commandArguments: readonly string[], directory: string, log: string, output: Writable, errorOutput: Writable, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      const file = createWriteStream(log);
      const child = spawn(command, [...commandArguments], { cwd: directory, env: environment, shell: false, stdio: ["inherit", "pipe", "pipe"] });
      let failure: ProcessException | null = null;
      const forward = (target: Writable, chunk: Buffer): void => {
        target.write(chunk);
        file.write(chunk);
      };
      child.stdout.on("data", (t: Buffer) => forward(output, t));
      child.stderr.on("data", (t: Buffer) => forward(errorOutput, t));
      child.on("error", t => failure = new ProcessException(`"${command}" could not start.`, { cause: t }));
      child.on("close", t => file.end(() => failure === null ? resolve(t) : reject(failure)));
    });
  }

  private static signal(processId: number, signal: NodeJS.Signals | 0): boolean {
    try {
      process.kill(processId, signal);
      return true;
    }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === ProcessRunner.MISSING_PROCESS_CODE)
        return false;
      throw error;
    }
  }
}
