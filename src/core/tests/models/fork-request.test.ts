/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ForkRequest } from "@noldova/teamrun-core";
import { RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class ForkRequestTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("codex", null, "low");

  @TestMethod
  public holdsWhatToForkAndRejectsBlanks(): void {
    const request = new ForkRequest(null, "D:/work", "thread-1", "turn-2", ForkRequestTests.requested);

    Assert.isNull(request.account);
    Assert.areEqual("D:/work", request.workingDirectory);
    Assert.areEqual("thread-1", request.nativeSessionId);
    Assert.areEqual("turn-2", request.lastTurnId);
    Assert.areEqual("low", request.requested.effort);
    Assert.throws(() => new ForkRequest(null, " ", "thread-1", "turn-2", ForkRequestTests.requested), ArgumentException);
    Assert.throws(() => new ForkRequest(null, "D:/work", String.empty, "turn-2", ForkRequestTests.requested), ArgumentException);
    Assert.throws(() => new ForkRequest(null, "D:/work", "thread-1", " ", ForkRequestTests.requested), ArgumentException);
  }
}
