/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { ObservedSettings, ReplyAction } from "@noldova/teamrun.protocol";

import { TurnOutcome } from "../enums/turn-outcome.js";
import { Resources } from "../resources.js";
import type { UsageLimit } from "./usage-limit.js";

export class TurnResult {
  public readonly outcome: TurnOutcome;
  public readonly nativeSessionId: string | null;
  public readonly observed: ObservedSettings;
  public readonly error: string | null;
  public readonly nativeTurnId: string | null;
  public readonly action: ReplyAction | null;
  public readonly limit: UsageLimit | null;

  public constructor(
    outcome: TurnOutcome,
    nativeSessionId: string | null,
    observed: ObservedSettings,
    error: string | null,
    nativeTurnId: string | null = null,
    action: ReplyAction | null = null,
    limit: UsageLimit | null = null) {
    if (!Object.isNull(nativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdParameterName);
    if (!Object.isNull(nativeTurnId))
      ArgumentException.throwIfNullOrWhitespace(nativeTurnId, Resources.nativeTurnIdParameterName);
    if ((outcome === TurnOutcome.Failed) === Object.isNull(error))
      throw new ArgumentException(Resources.failureErrorMismatch, Resources.errorParameterName);
    if (!Object.isNull(action) && outcome !== TurnOutcome.Failed)
      throw new ArgumentException(Resources.failureActionMismatch, Resources.actionParameterName);
    if (!Object.isNull(limit) && outcome !== TurnOutcome.Failed)
      throw new ArgumentException(Resources.failureLimitMismatch, Resources.limitParameterName);

    this.outcome = outcome;
    this.nativeSessionId = nativeSessionId;
    this.observed = observed;
    this.error = error;
    this.nativeTurnId = nativeTurnId;
    this.action = action;
    this.limit = limit;
  }
}
