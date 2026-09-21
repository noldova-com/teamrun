/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ProviderTimings {
  public readonly versionTimeout: number;
  public readonly signInCheckTimeout: number;
  public readonly initializeTimeout: number;
  public readonly requestTimeout: number;
  public readonly interruptTimeout: number;
  public readonly interruptGrace: number;
  public readonly stopGrace: number;
  public readonly abortGrace: number;
  public readonly streamInterval: number;
  public readonly resumeRetryDelay: number;

  public constructor(
    versionTimeout: number,
    signInCheckTimeout: number,
    initializeTimeout: number,
    requestTimeout: number,
    interruptTimeout: number,
    interruptGrace: number,
    stopGrace: number,
    abortGrace: number,
    streamInterval: number,
    resumeRetryDelay: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(versionTimeout, Resources.versionTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(signInCheckTimeout, Resources.signInCheckTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(initializeTimeout, Resources.initializeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(requestTimeout, Resources.requestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interruptTimeout, Resources.interruptTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interruptGrace, Resources.interruptGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(stopGrace, Resources.stopGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(abortGrace, Resources.abortGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(streamInterval, Resources.streamIntervalParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(resumeRetryDelay, Resources.resumeRetryDelayParameterName);

    this.versionTimeout = versionTimeout;
    this.signInCheckTimeout = signInCheckTimeout;
    this.initializeTimeout = initializeTimeout;
    this.requestTimeout = requestTimeout;
    this.interruptTimeout = interruptTimeout;
    this.interruptGrace = interruptGrace;
    this.stopGrace = stopGrace;
    this.abortGrace = abortGrace;
    this.streamInterval = streamInterval;
    this.resumeRetryDelay = resumeRetryDelay;
  }

  public static createDefault(): ProviderTimings {
    return new ProviderTimings(
      Resources.versionTimeout,
      Resources.signInCheckTimeout,
      Resources.initializeTimeout,
      Resources.requestTimeout,
      Resources.interruptTimeout,
      Resources.interruptGrace,
      Resources.stopGrace,
      Resources.claudeAbortGrace,
      Resources.streamInterval,
      Resources.resumeRetryDelay);
  }
}
