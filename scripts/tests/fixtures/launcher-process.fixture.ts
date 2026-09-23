/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";

export default class LauncherProcessFixture {
  public static spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcess | EventEmitter {
    if (process.env["TEAMRUN_LAUNCH_FIXTURE"] !== "signal")
      return spawn(command, args, options);
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("exit", null, "SIGTERM"));
    return child;
  }
}
