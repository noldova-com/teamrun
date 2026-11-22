/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DeferredResponse } from "./deferred-response.fixture";

export class KindReadRace {
  public readonly earlier: DeferredResponse;
  public readonly added: Promise<boolean>;

  public constructor(earlier: DeferredResponse, added: Promise<boolean>) {
    this.earlier = earlier;
    this.added = added;
  }
}
