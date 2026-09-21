/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnStart } from "@noldova/teamrun-core";

@TestClass
export class TurnStartTests {
  @TestMethod
  public holdsTheSessionFacts(): void {
    const fresh = new TurnStart(null, false);
    const resumed = new TurnStart("session-1", true);

    Assert.isNull(fresh.nativeSessionId);
    Assert.isFalse(fresh.resumedNativeSession);
    Assert.areEqual("session-1", resumed.nativeSessionId);
    Assert.isTrue(resumed.resumedNativeSession);
  }

  @TestMethod
  public rejectsAResumedSessionWithoutAnIdAndABlankId(): void {
    Assert.areEqual("resumedNativeSession", Assert.throws(() => new TurnStart(null, true), ArgumentException).parameterName);
    Assert.areEqual("nativeSessionId", Assert.throws(() => new TurnStart(" ", false), ArgumentException).parameterName);
  }
}
