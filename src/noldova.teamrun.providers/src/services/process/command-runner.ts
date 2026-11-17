/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { BoundedOutput } from "../../models/bounded-output.js";
import { CommandResult } from "../../models/command-result.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";

export class CommandRunner {
  private readonly starter: IProcessStarter;
  private readonly maximumOutputLength: number;

  public constructor(starter: IProcessStarter, maximumOutputLength: number = Resources.maximumOutputLength) {
    this.starter = starter;
    this.maximumOutputLength = maximumOutputLength;
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return this.starter.readEnvironmentAsync(own);
  }

  public run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null, cancel: AbortSignal | null = null): Promise<CommandResult> {
    if (!Object.isNull(timeoutMilliseconds))
      ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutParameterName);

    return new Promise((resolve, reject) => {
      const child = this.starter.start(command, environment, null);
      child.stdin.end();
      const stdout = new BoundedOutput(this.maximumOutputLength);
      const stderr = new BoundedOutput(this.maximumOutputLength);
      let timedOut = false;
      const timer = Object.isNull(timeoutMilliseconds) ? undefined : setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMilliseconds);
      const stop = (): void => {
        child.kill();
      };
      const finish = (): void => {
        clearTimeout(timer);
        cancel?.removeEventListener(Resources.abortEvent, stop);
      };
      cancel?.addEventListener(Resources.abortEvent, stop, { once: true });
      if (cancel?.aborted === true)
        stop();
      child.stdout.setEncoding(Resources.utf8Encoding);
      child.stdout.on(Resources.dataEvent, (chunk: string) => stdout.append(chunk));
      child.stderr.setEncoding(Resources.utf8Encoding);
      child.stderr.on(Resources.dataEvent, (chunk: string) => stderr.append(chunk));
      child.on(Resources.errorEvent, (error: Error) => {
        finish();
        reject(error);
      });
      child.on(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => {
        finish();
        resolve(new CommandResult(code, signal, stdout.toString(), stderr.toString(), timedOut));
      });
    });
  }
}
