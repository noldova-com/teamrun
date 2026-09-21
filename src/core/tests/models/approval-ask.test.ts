/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalAskTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved);

  @TestMethod
  public holdsTheProvidersRequestWithACopyOfTheOptions(): void {
    const options = [ApprovalAskTests.accept];
    const ask = new ApprovalAsk("req-1", ApprovalKind.Command, "commandExecution", "Run npm test", { command: "npm test" }, options);
    options.length = 0;

    Assert.areEqual("req-1", ask.providerRequestId);
    Assert.areEqual(ApprovalKind.Command, ask.kind);
    Assert.areEqual("commandExecution", ask.nativeKind);
    Assert.areEqual("Run npm test", ask.summary);
    Assert.areEqual("{\"command\":\"npm test\"}", JSON.stringify(ask.payload));
    Assert.areEqual(1, ask.options.length);
  }

  @TestMethod
  public rejectsBlankTextsAndNoOptions(): void {
    const options = [ApprovalAskTests.accept];

    Assert.areEqual("providerRequestId", Assert.throws(() => new ApprovalAsk(" ", ApprovalKind.Tool, "Bash", "Run", null, options), ArgumentException).parameterName);
    Assert.areEqual("nativeKind", Assert.throws(() => new ApprovalAsk("r", ApprovalKind.Tool, "", "Run", null, options), ArgumentException).parameterName);
    Assert.areEqual("summary", Assert.throws(() => new ApprovalAsk("r", ApprovalKind.Tool, "Bash", " ", null, options), ArgumentException).parameterName);
    Assert.areEqual("options", Assert.throws(() => new ApprovalAsk("r", ApprovalKind.Tool, "Bash", "Run", null, []), ArgumentException).parameterName);
  }
}
