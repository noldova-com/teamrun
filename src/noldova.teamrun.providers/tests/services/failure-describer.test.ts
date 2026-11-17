/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ErrorCode } from "@noldova/teamrun.protocol";
import { AcpRequestException, FailureDescriber } from "@noldova/teamrun.providers";

@TestClass
export class FailureDescriberTests {
  @TestMethod
  public describesErrorsAndOtherValues(): void {
    Assert.areEqual("boom", FailureDescriber.describe(new Error("boom")));
    Assert.areEqual("42", FailureDescriber.describe(42));
  }

  @TestMethod
  public addsTheReasonAnAcpErrorCarriesInItsData(): void {
    Assert.areEqual("Invalid params: Session \"s1\" not found", FailureDescriber.describe(new AcpRequestException("Invalid params", -32602, { message: "Session \"s1\" not found" })));
    Assert.areEqual("Session not found", FailureDescriber.describe(new AcpRequestException("Session not found", -32602, { message: "not found" })));
    const unnamed: readonly JsonValue[] = [null, "text", ["a"], {}, { message: 1 }, { message: " " }];
    for (const data of unnamed)
      Assert.areEqual("Invalid params", FailureDescriber.describe(new AcpRequestException("Invalid params", -32602, data)));
    Assert.areEqual("Invalid params", FailureDescriber.describe(new Error("Invalid params")));
  }

  @TestMethod
  public tellsCoresRefusalOfAClosedRunFromOtherFailures(): void {
    Assert.isTrue(FailureDescriber.isClosedRun(Object.assign(new Error("The message is not open."), { info: { name: ErrorCode.Conflict } })));
    Assert.isFalse(FailureDescriber.isClosedRun(Object.assign(new Error("Not found."), { info: { name: ErrorCode.NotFound } })));
    Assert.isFalse(FailureDescriber.isClosedRun(new Error("boom")));
    Assert.isFalse(FailureDescriber.isClosedRun({ info: { name: ErrorCode.Conflict } }));
  }
}
