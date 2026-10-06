/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import ProcessException from "./process.exception.ts";

export default class RetriedDownload {
  public static readonly ATTEMPT_TIMEOUT: number = 600_000;

  private static readonly ATTEMPTS: number = 4;
  private static readonly PAUSE: number = 15_000;

  public static async runAsync(subject: string, output: Writable, attemptAsync: () => Promise<string | null>): Promise<void> {
    let failure = "";
    for (let attempt = 1; attempt <= RetriedDownload.ATTEMPTS; attempt++) {
      const reason = await attemptAsync();
      if (reason === null)
        return;
      failure = reason;
      if (attempt < RetriedDownload.ATTEMPTS) {
        output.write(`${subject} could not be installed (attempt ${attempt} of ${RetriedDownload.ATTEMPTS}); trying again in ${RetriedDownload.PAUSE / 1000} seconds.\n`);
        await timers.setTimeout(RetriedDownload.PAUSE);
      }
    }
    throw new ProcessException(`${subject} could not be installed in ${RetriedDownload.ATTEMPTS} attempts; the last failed with ${failure}.`);
  }
}
