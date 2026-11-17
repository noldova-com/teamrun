/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TurnOutcome } from "../enums/turn-outcome.js";
import { Resources } from "../resources.js";
import { CoreException } from "./core.exception.js";

export class OwnSummaryUnansweredException extends CoreException {
  public override readonly name: string = "OwnSummaryUnansweredException";
  public readonly outcome: TurnOutcome;

  public constructor(outcome: TurnOutcome) {
    super(Resources.formatOwnSummaryUnanswered(outcome));
    this.outcome = outcome;
  }
}
