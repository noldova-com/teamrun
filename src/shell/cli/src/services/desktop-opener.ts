/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

import type { IDesktopOpener } from "../interfaces/i-desktop-opener.js";

export class DesktopOpener implements IDesktopOpener {
  private static readonly SPAWN_EVENT: string = "spawn";

  public async openAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<void> {
    const child = spawn(executable, launchArguments, { detached: true, stdio: "ignore", env: environment });
    await once(child, DesktopOpener.SPAWN_EVENT);
    child.unref();
  }
}
