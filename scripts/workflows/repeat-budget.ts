/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

export default class RepeatBudget {
  private static readonly FLOOR_SECONDS: number = 60;
  private static readonly WHOLE_NUMBER: RegExp = /^\d+$/;
  private static readonly USAGE: string =
    "Give the job's start in seconds since 1970, its time limit in minutes and the seconds to keep before the limit, as whole numbers.\n";

  public static calculate(startedSeconds: number, nowSeconds: number, limitMinutes: number, marginSeconds: number): number {
    return Math.max(RepeatBudget.FLOOR_SECONDS, limitMinutes * 60 - (nowSeconds - startedSeconds) - marginSeconds) * 1000;
  }

  public static run(commandArguments: readonly string[], nowMilliseconds: number, output: Writable): number {
    if (commandArguments.length !== 3 || !commandArguments.every(t => RepeatBudget.WHOLE_NUMBER.test(t))) {
      output.write(RepeatBudget.USAGE);
      return 1;
    }
    const budget = RepeatBudget.calculate(Number(commandArguments[0]), Math.floor(nowMilliseconds / 1000), Number(commandArguments[1]), Number(commandArguments[2]));
    output.write(`${budget}\n`);
    return 0;
  }
}

if (import.meta.main)
  process.exitCode = RepeatBudget.run(process.argv.slice(2), Date.now(), process.stdout);
