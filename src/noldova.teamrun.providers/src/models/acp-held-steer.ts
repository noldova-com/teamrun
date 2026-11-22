/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TurnSteer } from "@noldova/teamrun.core";

export class AcpHeldSteer {
  public readonly steer: TurnSteer;
  public readonly sent: PromiseWithResolvers<boolean>;

  public constructor(steer: TurnSteer, sent: PromiseWithResolvers<boolean>) {
    this.steer = steer;
    this.sent = sent;
  }
}
