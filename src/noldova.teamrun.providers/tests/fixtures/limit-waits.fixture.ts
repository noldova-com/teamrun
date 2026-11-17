/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ManualTimer } from "@noldova/teamrun.core/testing";

export class LimitWaits {
  public static are(timer: ManualTimer, dues: readonly number[]): boolean {
    return timer.pending === dues.length && dues.every(t => timer.pendingWithin(t) - timer.pendingWithin(t - 1) === dues.filter(u => u === t).length);
  }
}
