/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { open } from "node:fs/promises";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { LaunchException } from "../../exceptions/launch.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { Resources } from "../../resources.js";

export class ChildProcessStarter implements IProcessStarter {
  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const errors = await open(errorFile, Resources.appendFlag);
    try {
      const child = spawn(executable, launchArguments, {
        detached: true,
        stdio: [Resources.ignoredOutput, Resources.ignoredOutput, errors.fd],
        windowsHide: true,
        env: environment
      });
      try {
        await once(child, Resources.spawnEvent);
      }
      catch (error) {
        throw new LaunchException(Resources.formatStartFailed(executable), new ExceptionOptions(error));
      }
      child.unref();
      return Number(child.pid);
    }
    finally {
      await errors.close();
    }
  }
}
