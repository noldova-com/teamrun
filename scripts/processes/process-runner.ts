/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import ProcessResult from "./process-result.ts";
import ProcessException from "./process.exception.ts";

export default class ProcessRunner {
  private static readonly OUTPUT_LIMIT: number = 16 * 1024 * 1024;

  public captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      const output: Buffer[] = [];
      const errorOutput: Buffer[] = [];
      let size = 0;
      let failure: ProcessException | null = null;
      const stop = (t: ProcessException): void => {
        failure = t;
        child.kill();
      };
      const receive = (chunks: Buffer[], chunk: Buffer): void => {
        size += chunk.length;
        if (size > ProcessRunner.OUTPUT_LIMIT)
          stop(new ProcessException(`"${command}" wrote more than ${ProcessRunner.OUTPUT_LIMIT} bytes.`));
        else
          chunks.push(chunk);
      };
      const timer = setTimeout(() => stop(new ProcessException(`"${command}" did not finish within ${timeout} ms.`)), timeout);
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

  public runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: "inherit", env: environment ?? process.env });
      child.on("error", t => reject(new ProcessException(`"${command}" could not start.`, { cause: t })));
      child.on("close", t => resolve(t));
    });
  }
}
