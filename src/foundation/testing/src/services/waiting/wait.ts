/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class Wait {
  public static untilAsync(condition: () => boolean | Promise<boolean>, limitMilliseconds: number, intervalMilliseconds: number = Resources.waitIntervalMilliseconds): Promise<boolean> {
    if (!Number.isInteger(limitMilliseconds) || limitMilliseconds < 0)
      throw new ArgumentOutOfRangeException("limitMilliseconds", limitMilliseconds, Resources.waitLimitInvalid);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(intervalMilliseconds, "intervalMilliseconds", Resources.waitIntervalInvalid);
    return Wait.checkAsync(condition, performance.now() + limitMilliseconds, intervalMilliseconds);
  }

  private static async checkAsync(condition: () => boolean | Promise<boolean>, deadline: number, intervalMilliseconds: number): Promise<boolean> {
    while (!await condition()) {
      if (performance.now() >= deadline)
        return false;
      await delay(intervalMilliseconds);
    }
    return true;
  }
}
