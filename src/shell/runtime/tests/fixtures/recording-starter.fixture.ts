/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { open } from "node:fs/promises";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { type IProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

export class RecordingStarterFixture implements IProcessStarter {
  private readonly children: ChildProcess[] = [];

  private static hasExited(child: ChildProcess): boolean {
    return child.exitCode !== null || child.signalCode !== null;
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const errors = await open(errorFile, "a");
    try {
      const child = spawn(executable, [...launchArguments], { detached: true, stdio: ["ignore", "ignore", errors.fd], windowsHide: true, env: environment });
      try {
        await once(child, "spawn");
      }
      catch (error) {
        throw new LaunchException(`The runtime could not be started with ${executable}.`, new ExceptionOptions(error));
      }
      this.children.push(child);
      return Number(child.pid);
    }
    finally {
      await errors.close();
    }
  }

  public async stopAsync(limitMilliseconds: number): Promise<readonly number[]> {
    const running: number[] = [];
    for (const child of this.children) {
      if (RecordingStarterFixture.hasExited(child))
        continue;
      const limit = AbortSignal.timeout(limitMilliseconds);
      const exited = once(child, "exit", { signal: limit });
      child.kill();
      try {
        await exited;
      }
      catch (error) {
        if (!limit.aborted)
          throw error;
        running.push(Number(child.pid));
      }
    }
    return running;
  }
}
