/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, Wait } from "@noldova/teamrun-foundation-testing";

export class Condition {
  private static readonly LIMIT: number = 10_000;
  private static readonly INTERVAL: number = 5;

  public static async waitAsync(condition: () => boolean | Promise<boolean>): Promise<void> {
    Assert.isTrue(await Wait.untilAsync(condition, Condition.LIMIT, Condition.INTERVAL), `The condition did not hold within ${Condition.LIMIT} ms.`);
  }
}
