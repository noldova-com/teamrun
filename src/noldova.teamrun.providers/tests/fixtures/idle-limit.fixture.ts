/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ManualTimer } from "@noldova/teamrun.core/testing";

import { Wait } from "./wait.fixture.js";

export class IdleLimit {
  public static async elapseAsync(timer: ManualTimer, limit: number, failure: string, waits: number = 1): Promise<void> {
    await Wait.until(() => timer.pendingWithin(limit) >= waits, failure);
    timer.advance(limit);
  }
}
