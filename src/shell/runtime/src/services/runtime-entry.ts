/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { DataDirectoryOwnedException } from "../exceptions/data-directory-owned.exception.js";
import { RuntimeOptions } from "../models/runtime-options.js";
import { Resources } from "../resources.js";
import { RuntimeHost } from "./lifetime/runtime-host.js";

export class RuntimeEntry {
  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public static async runAsync(entryArguments: readonly string[], platform: string, environment: NodeJS.ProcessEnv, signals: EventEmitter, error: Writable): Promise<number> {
    let options: RuntimeOptions;
    try {
      options = RuntimeOptions.parse(entryArguments);
    }
    catch (failure) {
      error.write(`${String(failure)}\n${Resources.usage}\n`);
      return Resources.usageExitCode;
    }

    let host: RuntimeHost;
    try {
      host = await RuntimeHost.startAsync(options, platform, environment);
    }
    catch (failure) {
      if (failure instanceof DataDirectoryOwnedException)
        return Resources.ownedExitCode;
      error.write(`${String(failure)}\n`);
      return Resources.failureExitCode;
    }

    const stop = (): void => host.requestStop(Resources.stoppedBySignal);
    const report = (failure: unknown): void => host.log.writeLine(inspect(failure));
    for (const signal of Resources.stopSignals)
      signals.on(signal, stop);
    signals.on(Resources.uncaughtExceptionEvent, report);
    try {
      await host.waitForStopAsync();
      return 0;
    }
    finally {
      for (const signal of Resources.stopSignals)
        signals.off(signal, stop);
      signals.off(Resources.uncaughtExceptionEvent, report);
    }
  }

  public static async settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void> {
    try {
      exit.exitCode = await run;
    }
    catch (failure) {
      error.write(`${inspect(failure)}\n`);
      exit.exitCode = Resources.failureExitCode;
    }
  }
}

if (import.meta.main)
  void RuntimeEntry.settleAsync(RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr), process.stderr, process);
