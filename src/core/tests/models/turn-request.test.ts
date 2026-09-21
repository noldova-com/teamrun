/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnRequest } from "@noldova/teamrun-core";
import { RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class TurnRequestTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("fake", "fake-large", "high");

  @TestMethod
  public holdsWhatAnAdapterNeeds(): void {
    const request = new TurnRequest(null, "D:/work", "Hello", TurnRequestTests.requested, "session-1");

    Assert.isNull(request.account);
    Assert.areEqual("D:/work", request.workingDirectory);
    Assert.areEqual("Hello", request.prompt);
    Assert.areEqual("fake-large", request.requested.model);
    Assert.areEqual("session-1", request.resumeNativeSessionId);
    Assert.isNull(new TurnRequest(null, "D:/work", "Hello", TurnRequestTests.requested, null).resumeNativeSessionId);
  }

  @TestMethod
  public rejectsBlankTexts(): void {
    Assert.areEqual("workingDirectory", Assert.throws(() => new TurnRequest(null, " ", "Hello", TurnRequestTests.requested, null), ArgumentException).parameterName);
    Assert.areEqual("prompt", Assert.throws(() => new TurnRequest(null, "D:/work", "", TurnRequestTests.requested, null), ArgumentException).parameterName);
    Assert.areEqual("resumeNativeSessionId", Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, " "), ArgumentException).parameterName);
    Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, null, [], " "), ArgumentException);
    Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, null, [], null, " "), ArgumentException);
  }
}
