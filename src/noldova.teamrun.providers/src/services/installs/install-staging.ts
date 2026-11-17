/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { InstallFailedException } from "../../exceptions/install-failed.exception.js";
import { Resources } from "../../resources.js";
import { InstallRename } from "./install-rename.js";

export class InstallStaging {
  public static open(directory: string): string {
    InstallStaging.sweep(directory);
    return InstallStaging.create(directory);
  }

  public static sweep(directory: string): void {
    InstallStaging.remove(directory, () => true);
  }

  public static sweepKeeping(directory: string, kept: string): void {
    InstallStaging.remove(directory, t => !existsSync(join(directory, t, kept)));
  }

  public static tidy(directory: string): void {
    try {
      InstallStaging.sweep(directory);
    }
    catch {
      return;
    }
  }

  public static create(directory: string): string {
    const staging = join(directory, `${Resources.stagingPrefix}${randomUUID()}`);
    mkdirSync(staging, { recursive: true });
    return staging;
  }

  public static writing<T>(reason: string, step: () => T): T {
    try {
      return step();
    }
    catch (error) {
      if (Resources.unwritableErrorCodes.includes(InstallRename.codeOf(error)))
        throw new InstallFailedException(reason, error);
      throw error;
    }
  }

  public static close(staging: string): void {
    rmSync(staging, { recursive: true, force: true, maxRetries: Resources.removeRetries });
  }

  private static remove(directory: string, removes: (name: string) => boolean): void {
    if (existsSync(directory))
      for (const name of readdirSync(directory).filter(t => t.startsWith(Resources.stagingPrefix) && removes(t)))
        rmSync(join(directory, name), { recursive: true, force: true, maxRetries: Resources.removeRetries });
  }
}
