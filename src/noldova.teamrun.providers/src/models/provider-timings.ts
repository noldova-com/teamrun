/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ProviderTimings {
  public readonly versionTimeout: number;
  public readonly signInCheckTimeout: number;
  public readonly initializeTimeout: number;
  public readonly requestTimeout: number;
  public readonly interruptTimeout: number;
  public readonly interruptGrace: number;
  public readonly stopGrace: number;
  public readonly killWait: number;
  public readonly abortGrace: number;
  public readonly streamInterval: number;
  public readonly resumeRetryDelay: number;
  public readonly wakeGrace: number;
  public readonly taskOutputInterval: number;
  public readonly accountTimeout: number;
  public readonly modelListTimeout: number;
  public readonly silenceLimit: number;
  public readonly idleLimit: number;

  public constructor(
    versionTimeout: number,
    signInCheckTimeout: number,
    initializeTimeout: number,
    requestTimeout: number,
    interruptTimeout: number,
    interruptGrace: number,
    stopGrace: number,
    killWait: number,
    abortGrace: number,
    streamInterval: number,
    resumeRetryDelay: number,
    wakeGrace: number = Resources.wakeGrace,
    taskOutputInterval: number = Resources.taskOutputFollowInterval,
    accountTimeout: number = Resources.accountTimeout,
    modelListTimeout: number = Resources.modelListTimeout,
    silenceLimit: number = Resources.silenceLimit,
    idleLimit: number = Resources.idleLimit) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(versionTimeout, Resources.versionTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(signInCheckTimeout, Resources.signInCheckTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(initializeTimeout, Resources.initializeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(requestTimeout, Resources.requestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interruptTimeout, Resources.interruptTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interruptGrace, Resources.interruptGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(stopGrace, Resources.stopGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(killWait, Resources.killWaitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(abortGrace, Resources.abortGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(streamInterval, Resources.streamIntervalParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(resumeRetryDelay, Resources.resumeRetryDelayParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(wakeGrace, Resources.wakeGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(taskOutputInterval, Resources.taskOutputIntervalParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(accountTimeout, Resources.accountTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(modelListTimeout, Resources.modelListTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(silenceLimit, Resources.silenceLimitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(idleLimit, Resources.idleLimitParameterName);

    this.versionTimeout = versionTimeout;
    this.signInCheckTimeout = signInCheckTimeout;
    this.initializeTimeout = initializeTimeout;
    this.requestTimeout = requestTimeout;
    this.interruptTimeout = interruptTimeout;
    this.interruptGrace = interruptGrace;
    this.stopGrace = stopGrace;
    this.killWait = killWait;
    this.abortGrace = abortGrace;
    this.streamInterval = streamInterval;
    this.resumeRetryDelay = resumeRetryDelay;
    this.wakeGrace = wakeGrace;
    this.taskOutputInterval = taskOutputInterval;
    this.accountTimeout = accountTimeout;
    this.modelListTimeout = modelListTimeout;
    this.silenceLimit = silenceLimit;
    this.idleLimit = idleLimit;
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
      Resources.acpKillWait,
      Resources.claudeAbortGrace,
      Resources.streamInterval,
      Resources.resumeRetryDelay);
  }
}
