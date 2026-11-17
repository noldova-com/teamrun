/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalNotDeniableException, CoreException, DenyingTurn, GuidFormatException, OwnSummaryUnansweredException, TimeoutException, TurnOutcome } from "@noldova/teamrun.core";

@TestClass
export class CoreExceptionTests {
  @TestMethod
  public isTheBaseOfTheCoreExceptions(): void {
    const exceptions = [new TimeoutException("late"), new ApprovalNotDeniableException(DenyingTurn.Summary, "no deny"),
      new OwnSummaryUnansweredException(TurnOutcome.Failed), new GuidFormatException()];

    Assert.isTrue(exceptions.every(t => t instanceof CoreException && t instanceof Exception));
    Assert.isTrue(exceptions.every(t => !Object.hasOwn(t, "cause")));
  }
}
