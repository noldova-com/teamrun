/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class RuntimeTimings {
  public readonly helloTimeout: number;
  public readonly callTimeout: number;
  public readonly launchTimeout: number;
  public readonly launchPollInterval: number;

  public constructor(helloTimeout: number, callTimeout: number, launchTimeout: number, launchPollInterval: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(helloTimeout, Resources.helloTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(callTimeout, Resources.callTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(launchTimeout, Resources.launchTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(launchPollInterval, Resources.launchPollIntervalParameterName);

    this.helloTimeout = helloTimeout;
    this.callTimeout = callTimeout;
    this.launchTimeout = launchTimeout;
    this.launchPollInterval = launchPollInterval;
  }

  public static createDefault(): RuntimeTimings {
    return new RuntimeTimings(Resources.helloTimeout, Resources.callTimeout, Resources.launchTimeout, Resources.launchPollInterval);
  }
}
