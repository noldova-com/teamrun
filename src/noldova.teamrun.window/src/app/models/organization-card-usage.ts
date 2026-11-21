/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UsageMeter } from "./usage-meter";

export class OrganizationCardUsage {
  public readonly meter: UsageMeter;
  public readonly used: number;

  public constructor(meter: UsageMeter, used: number) {
    this.meter = meter;
    this.used = used;
  }
}
