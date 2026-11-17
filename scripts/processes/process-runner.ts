/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
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
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        file.end(() => failure === null ? resolve(new ProcessEnd(code, signal)) : reject(failure));
      });
    });
  }
}
