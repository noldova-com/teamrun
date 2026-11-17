/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CoreException, OwnSummaryUnansweredException, Resources, TurnOutcome } from "@noldova/teamrun.core";

@TestClass
export class OwnSummaryUnansweredExceptionTests {
  @TestMethod
  public carriesItsNameOutcomeAndMessage(): void {
    const exception = new OwnSummaryUnansweredException(TurnOutcome.Interrupted);

    Assert.isInstanceOf(exception, CoreException);
    Assert.areEqual("OwnSummaryUnansweredException", exception.name);
    Assert.areEqual(TurnOutcome.Interrupted, exception.outcome);
    Assert.areEqual("The summary request ended Interrupted without a summary.", exception.message);
    Assert.areEqual("OwnSummaryUnansweredException", Resources.formatFailureKind(exception));
  }
}
