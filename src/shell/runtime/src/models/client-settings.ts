/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ClientSettings {
  public readonly handshakeTimeout: number;
  public readonly callTimeout: number;
  public readonly answerGrace: number;
  public readonly maximumFrameLength: number;

  public constructor(
    handshakeTimeout: number = Resources.handshakeTimeout,
    callTimeout: number = Resources.defaultRequestTimeout,
    answerGrace: number = Resources.answerGrace,
    maximumFrameLength: number = Resources.maximumFrameLength) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(handshakeTimeout, Resources.handshakeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(callTimeout, Resources.callTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(answerGrace, Resources.answerGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName);

    this.handshakeTimeout = handshakeTimeout;
    this.callTimeout = callTimeout;
    this.answerGrace = answerGrace;
    this.maximumFrameLength = maximumFrameLength;
  }
}
