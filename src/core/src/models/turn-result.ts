/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { ObservedSettings } from "@noldova/teamrun-protocol";

import { TurnOutcome } from "../enums/turn-outcome.js";
import { Resources } from "../resources.js";

export class TurnResult {
  public readonly outcome: TurnOutcome;
  public readonly nativeSessionId: string | null;
  public readonly observed: ObservedSettings;
  public readonly error: string | null;
  public readonly nativeTurnId: string | null;

  public constructor(
    outcome: TurnOutcome,
    nativeSessionId: string | null,
    observed: ObservedSettings,
    error: string | null,
    nativeTurnId: string | null = null) {
    if (!Object.isNull(nativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdParameterName);
    if (!Object.isNull(nativeTurnId))
      ArgumentException.throwIfNullOrWhitespace(nativeTurnId, Resources.nativeTurnIdParameterName);
    if ((outcome === TurnOutcome.Failed) === Object.isNull(error))
      throw new ArgumentException(Resources.failureErrorMismatch, Resources.errorParameterName);

    this.outcome = outcome;
    this.nativeSessionId = nativeSessionId;
    this.observed = observed;
    this.error = error;
    this.nativeTurnId = nativeTurnId;
  }
}
