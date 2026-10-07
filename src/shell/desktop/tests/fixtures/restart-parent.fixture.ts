/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";

import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

export class RestartParentFixture implements IProcessStarter, AsyncDisposable {
  private static readonly PARENT: string = [
    "const { spawn } = require('node:child_process');",
    "const { openSync } = require('node:fs');",
    "process.on('message', ({ executable, launchArguments, environment, errorFile }) => {",
    "  const child = spawn(executable, launchArguments, { detached: true, env: environment, stdio: ['ignore', 'ignore', openSync(errorFile, 'a'), 'pipe', 'pipe'] });",
    "  child.on('spawn', () => process.send(child.pid));",
    "});"
  ].join("\n");

  private readonly parent: ChildProcess;
  public started: number = 0;

  private constructor(parent: ChildProcess) {
    this.parent = parent;
  }

  public get processId(): number {
    return Number(this.parent.pid);
  }

  public static async createAsync(): Promise<RestartParentFixture> {
    const parent = spawn(process.execPath, ["-e", RestartParentFixture.PARENT], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    await once(parent, "spawn");
    return new RestartParentFixture(parent);
  }

  public static async isWaitingAsync(processId: number): Promise<boolean> {
    const processes = (await readdir("/proc")).filter(t => /^\d+$/.test(t));
    const stats = await Promise.all(processes.map(t => readFile(`/proc/${t}/stat`, "utf8").catch(() => "")));
    return stats.some(t => t.slice(t.indexOf("(") + 1, t.lastIndexOf(")")) === "sleep" && t.slice(t.lastIndexOf(")") + 2).split(" ")[1] === String(processId));
  }

  public static async hasEndedAsync(processId: number): Promise<boolean> {
    const stat = await readFile(`/proc/${processId}/stat`, "utf8").catch(() => "");
    return stat.length === 0 || stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z");
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const answer = once(this.parent, "message");
    this.parent.send({ executable, launchArguments, environment, errorFile });
    const [started] = await answer as [number];
    this.started = started;
    return started;
  }

  public async exitAsync(): Promise<void> {
    if (this.parent.exitCode === null && this.parent.signalCode === null) {
      const exited = once(this.parent, "exit");
      this.parent.kill();
      await exited;
    }
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.exitAsync();
  }
}
