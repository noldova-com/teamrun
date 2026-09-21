/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnOutcome, TurnResult } from "@noldova/teamrun-core";
import { ObservedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class TurnResultTests {
  private static readonly observed: ObservedSettings = new ObservedSettings("fake", "fake-large", "high", "1.0.0", null);

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
  }

  @TestMethod
  public requiresAnErrorExactlyForFailures(): void {
    Assert.areEqual("error", Assert.throws(() => new TurnResult(TurnOutcome.Failed, null, TurnResultTests.observed, null), ArgumentException).parameterName);
    Assert.areEqual("error", Assert.throws(() => new TurnResult(TurnOutcome.Completed, null, TurnResultTests.observed, "odd"), ArgumentException).parameterName);
    Assert.areEqual("nativeSessionId", Assert.throws(() => new TurnResult(TurnOutcome.Completed, " ", TurnResultTests.observed, null), ArgumentException).parameterName);
  }
}
