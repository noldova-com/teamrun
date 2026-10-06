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

import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

export class RecordingStarterFixture implements IProcessStarter {
  private readonly children: ChildProcess[] = [];

  private static hasExited(child: ChildProcess): boolean {
    return child.exitCode !== null || child.signalCode !== null;
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const errors = await open(errorFile, "a");
    try {
      const child = spawn(executable, [...launchArguments], { detached: true, stdio: ["ignore", "ignore", errors.fd], windowsHide: true, env: environment });
      await once(child, "spawn");
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
      const exited = once(child, "exit", { signal: AbortSignal.timeout(limitMilliseconds) });
      child.kill();
      try {
        await exited;
      }
      catch {
        running.push(Number(child.pid));
      }
    }
    return running;
  }
}
