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

  public constructor(
    maximumFrameLength: number = Resources.maximumFrameLength,
    handshakeTimeout: number = Resources.handshakeTimeout,
    defaultRequestTimeout: number = Resources.defaultRequestTimeout,
    maximumRequestTimeout: number = Resources.maximumRequestTimeout) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(handshakeTimeout, Resources.handshakeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(defaultRequestTimeout, Resources.defaultRequestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumRequestTimeout, Resources.maximumRequestTimeoutParameterName);
    if (defaultRequestTimeout > maximumRequestTimeout)
      throw new ArgumentOutOfRangeException(Resources.defaultRequestTimeoutParameterName, defaultRequestTimeout, Resources.defaultRequestTimeoutTooLong);

    this.maximumFrameLength = maximumFrameLength;
    this.handshakeTimeout = handshakeTimeout;
    this.defaultRequestTimeout = defaultRequestTimeout;
    this.maximumRequestTimeout = maximumRequestTimeout;
  }
}
