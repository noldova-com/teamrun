/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ServerSettings {
  public readonly maximumFrameLength: number;
  public readonly handshakeTimeout: number;
  public readonly defaultRequestTimeout: number;
  public readonly maximumRequestTimeout: number;
  public readonly updateSaveWait: number;
  public readonly updateBarrierInterval: number;

  public constructor(
    maximumFrameLength: number = Resources.maximumFrameLength,
    handshakeTimeout: number = Resources.handshakeTimeout,
    defaultRequestTimeout: number = Resources.defaultRequestTimeout,
    maximumRequestTimeout: number = Resources.maximumRequestTimeout,
    updateSaveWait: number = Resources.updateSaveWait,
    updateBarrierInterval: number = Resources.updateBarrierInterval) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(handshakeTimeout, Resources.handshakeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(defaultRequestTimeout, Resources.defaultRequestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumRequestTimeout, Resources.maximumRequestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(updateSaveWait, Resources.updateSaveWaitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(updateBarrierInterval, Resources.updateBarrierIntervalParameterName);
    if (defaultRequestTimeout > maximumRequestTimeout)
      throw new ArgumentOutOfRangeException(Resources.defaultRequestTimeoutParameterName, defaultRequestTimeout, Resources.defaultRequestTimeoutTooLong);

    this.maximumFrameLength = maximumFrameLength;
    this.handshakeTimeout = handshakeTimeout;
    this.defaultRequestTimeout = defaultRequestTimeout;
    this.maximumRequestTimeout = maximumRequestTimeout;
    this.updateSaveWait = updateSaveWait;
    this.updateBarrierInterval = updateBarrierInterval;
  }
}
