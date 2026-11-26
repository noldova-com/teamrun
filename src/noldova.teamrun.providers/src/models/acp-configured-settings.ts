/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ObservedSettings } from "@noldova/teamrun.protocol";

export class AcpConfiguredSettings {
  public readonly observed: ObservedSettings;
  public readonly confirming: Promise<boolean> | null;

  public constructor(observed: ObservedSettings, confirming: Promise<boolean> | null) {
    this.observed = observed;
    this.confirming = confirming;
  }
}
