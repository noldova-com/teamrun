/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { Assert } from "@noldova/teamrun-foundation-testing";

export class Condition {
  private static readonly LIMIT: number = 10_000;
  private static readonly INTERVAL: number = 5;

  public static async waitAsync(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + Condition.LIMIT;
    while (!condition() && Date.now() < deadline)
      await delay(Condition.INTERVAL);
    Assert.isTrue(condition());
  }
}
