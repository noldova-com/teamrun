/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnOutcome, TurnResult, UsageLimit } from "@noldova/teamrun.core";
import { ObservedSettings, ReplyAction } from "@noldova/teamrun.protocol";

@TestClass
export class TurnResultTests {
  private static readonly observed: ObservedSettings = new ObservedSettings("fake", "fake-large", "high", "1.0.0");

  @TestMethod
  public holdsHowATurnEnded(): void {
    const completed = new TurnResult(TurnOutcome.Completed, "session-1", TurnResultTests.observed, null);
    const failed = new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, "quota exhausted");

    Assert.areEqual(TurnOutcome.Completed, completed.outcome);
    Assert.areEqual("session-1", completed.nativeSessionId);
    Assert.isNull(completed.nativeTurnId);
    Assert.areEqual("turn-1", new TurnResult(TurnOutcome.Completed, "session-1", TurnResultTests.observed, null, "turn-1").nativeTurnId);
    Assert.throws(() => new TurnResult(TurnOutcome.Completed, "session-1", TurnResultTests.observed, null, " "), ArgumentException);
    Assert.areEqual("fake-large", completed.observed.model);
    Assert.isNull(completed.error);
    Assert.isNull(failed.nativeSessionId);
    Assert.areEqual("quota exhausted", failed.error);
    Assert.isNull(failed.action);
    Assert.areEqual(ReplyAction.ChooseModel, new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, "gone", null, ReplyAction.ChooseModel).action);
  }

  @TestMethod
  public requiresAnErrorExactlyForFailures(): void {
    Assert.areEqual("error", Assert.throws(() => new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, null), ArgumentException).parameterName);
    Assert.areEqual("error", Assert.throws(() => new TurnResult(TurnOutcome.Completed, null, TurnResultTests.observed, "odd"), ArgumentException).parameterName);
    Assert.areEqual("action", Assert.throws(() => new TurnResult(TurnOutcome.Completed, null, TurnResultTests.observed, null, null, ReplyAction.ChooseModel),
      ArgumentException).parameterName);
    Assert.areEqual("nativeSessionId", Assert.throws(() => new TurnResult(TurnOutcome.Completed, " ", TurnResultTests.observed, null), ArgumentException).parameterName);
  }

  @TestMethod
  public holdsAUsageLimitOnlyForAFailure(): void {
    const limit = new UsageLimit(null);

    Assert.areEqual(limit, new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, "limited", null, null, limit).limit);
    Assert.isNull(new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, "other").limit);
    for (const outcome of [TurnOutcome.Completed, TurnOutcome.Interrupted])
      Assert.areEqual("limit", Assert.throws(() => new TurnResult(outcome, null, TurnResultTests.observed, null, null, null, limit), ArgumentException).parameterName);
  }
}
