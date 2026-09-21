/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalOption, ApprovalOutcome } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalOptionTests {
  @TestMethod
  public holdsAProviderDefinedChoice(): void {
    const option = new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved);

    Assert.areEqual("acceptForSession", option.id);
    Assert.areEqual("Allow for this session", option.label);
    Assert.areEqual(ApprovalOutcome.Approved, option.outcome);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new ApprovalOption(String.empty, "Allow", ApprovalOutcome.Approved), ArgumentException);
    Assert.throws(() => new ApprovalOption("accept", " ", ApprovalOutcome.Approved), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "decline", label: "Deny", outcome: "Denied" };
    const option = ApprovalOption.fromJson(json);

    Assert.areEqual(ApprovalOutcome.Denied, option.outcome);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(option.toJson()));
  }

  @TestMethod
  public rejectsUnknownOutcomesWithTheirPath(): void {
    const unknownOutcome = Assert.throws(() => ApprovalOption.fromJson({ id: "a", label: "A", outcome: "maybe" }, "$.options.0"), JsonException);

    Assert.areEqual("$.options.0.outcome", unknownOutcome.path);
  }
}
