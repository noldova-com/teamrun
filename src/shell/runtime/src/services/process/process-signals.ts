/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ProcessSignals {
  public static send(processId: number, signal: NodeJS.Signals): void {
    try {
      process.kill(processId, signal);
    }
    catch (error) {
      if (!ProcessSignals.isMissing(error))
        throw error;
    }
  }

  public static isRunning(processId: number): boolean {
    try {
      process.kill(processId, Resources.probeSignal);
      return true;
    }
    catch (error) {
      return !ProcessSignals.isMissing(error);
    }
  }

  public static async waitAsync(condition: () => boolean, milliseconds: number): Promise<boolean> {
    const deadline = Date.now() + milliseconds;
    while (!condition()) {
      if (Date.now() >= deadline)
        return false;
      await delay(Resources.processPollMilliseconds);
    }
    return true;
  }

  private static isMissing(error: unknown): boolean {
    return Object.isObject(error) && Resources.fileErrorCodeField in error && error[Resources.fileErrorCodeField] === Resources.missingProcessCode;
  }
}
