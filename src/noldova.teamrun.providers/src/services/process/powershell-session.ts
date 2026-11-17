/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Socket } from "node:net";
import "@noldova/context.core";
import { TimeoutException } from "@noldova/teamrun.core";

import { ProviderStoppedException } from "../../exceptions/provider-stopped.exception.js";
import type { IPowershellSession } from "../../interfaces/i-powershell-session.js";
import { Resources } from "../../resources.js";

export class PowershellSession implements IPowershellSession {
  public static readonly shared: PowershellSession = new PowershellSession(Resources.powershellExecutable, Resources.powershellSessionArguments, process.env,
    Resources.powershellSessionIdle);

  private readonly executable: string;
  private readonly commandArguments: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private readonly idle: number;
  private shell: ChildProcessWithoutNullStreams | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closer: NodeJS.Timeout | undefined = undefined;

  public constructor(executable: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv, idle: number) {
    this.executable = executable;
    this.commandArguments = commandArguments;
    this.environment = environment;
    this.idle = idle;
  }

  public run(script: string, timeout: number): Promise<string> {
    const deadline = performance.now() + timeout;
    const answer = this.queue.then(() => this.ask(script, timeout, deadline));
    this.queue = answer.catch(() => null);
    return answer;
  }

  private ask(script: string, timeout: number, deadline: number): Promise<string> {
    const left = deadline - performance.now();
    if (left <= 0)
      return Promise.reject(new TimeoutException(Resources.formatPowershellSessionTimedOut(timeout)));
    clearTimeout(this.closer);
    const shell = this.shell ?? this.open();
    const marker = Resources.powershellSessionMarker + randomUUID();
    return new Promise((resolve, reject) => {
      let output = "";
      const settle = (): void => {
        clearTimeout(timer);
        shell.stdout.off(Resources.dataEvent, read);
        shell.off(Resources.closeEvent, ended);
        shell.off(Resources.errorEvent, failed);
      };
      const read = (chunk: string): void => {
        output += chunk;
        const lines = output.split(Resources.lineSeparator);
        const end = lines.findIndex(t => t.trimEnd() === marker);
        if (end < 0)
          return;
        settle();
        this.closer = setTimeout(() => { this.close(shell); }, this.idle).unref();
        resolve(lines.slice(0, end).map(t => t + Resources.lineSeparator).join(""));
      };
      const ended = (): void => {
        settle();
        reject(new ProviderStoppedException(Resources.powershellSessionEnded));
      };
      const failed = (error: Error): void => {
        settle();
        reject(error);
      };
      const timer = setTimeout(() => {
        settle();
        this.forget(shell);
        shell.kill();
        reject(new TimeoutException(Resources.formatPowershellSessionTimedOut(timeout)));
      }, left);
      shell.stdout.on(Resources.dataEvent, read);
      shell.once(Resources.closeEvent, ended);
      shell.once(Resources.errorEvent, failed);
      shell.stdin.write(Resources.formatPowershellSessionInput(script, marker));
    });
  }

  private open(): ChildProcessWithoutNullStreams {
    const shell = spawn(this.executable, this.commandArguments, { env: this.environment, windowsHide: true });
    shell.stdout.setEncoding(Resources.utf8Encoding);
    shell.stderr.resume();
    const forget = (): void => { this.forget(shell); };
    shell.stdin.on(Resources.errorEvent, forget);
    shell.on(Resources.errorEvent, forget);
    shell.on(Resources.closeEvent, forget);
    shell.unref();
    for (const stream of [shell.stdin, shell.stdout, shell.stderr].filter((t): t is Socket => t instanceof Socket))
      stream.unref();
    this.shell = shell;
    return shell;
  }

  private close(shell: ChildProcessWithoutNullStreams): void {
    this.forget(shell);
    shell.stdin.end();
  }

  private forget(shell: ChildProcessWithoutNullStreams): void {
    if (this.shell === shell)
      this.shell = null;
  }
}
