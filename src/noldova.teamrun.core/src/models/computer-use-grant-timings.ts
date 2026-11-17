/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ComputerUseGrantTimings {
  public readonly describeWait: number;
  public readonly lifetime: number;

  public constructor(describeWait: number, lifetime: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(describeWait, Resources.describeWaitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(lifetime, Resources.lifetimeParameterName);

    this.describeWait = describeWait;
    this.lifetime = lifetime;
  }

  public static createDefault(): ComputerUseGrantTimings {
    return new ComputerUseGrantTimings(Resources.appDescriptionsWait, Resources.appDescriptionLifetime);
  }
}
