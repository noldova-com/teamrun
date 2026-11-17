/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalOption, ApprovalOutcome, ApprovalScope } from "@noldova/teamrun.protocol";

@TestClass
export class ApprovalOptionTests {
  @TestMethod
  public holdsAProviderDefinedChoice(): void {
    const option = new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved, ApprovalScope.Session);

    Assert.areEqual("acceptForSession", option.id);
    Assert.areEqual("Allow for this session", option.label);
    Assert.areEqual(ApprovalOutcome.Approved, option.outcome);
    Assert.areEqual(ApprovalScope.Session, option.scope);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    Assert.throws(() => new ApprovalOption(String.empty, "Allow", ApprovalOutcome.Approved, ApprovalScope.Once), ArgumentException);
    Assert.throws(() => new ApprovalOption("accept", " ", ApprovalOutcome.Approved, ApprovalScope.Once), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "decline", label: "Deny", outcome: "Denied", scope: "Always" };
    const option = ApprovalOption.fromJson(json);

    Assert.areEqual(ApprovalOutcome.Denied, option.outcome);
    Assert.areEqual(ApprovalScope.Always, option.scope);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(option.toJson()));
  }

  @TestMethod
  public rejectsUnknownOutcomesWithTheirPath(): void {
    const unknownOutcome = Assert.throws(() => ApprovalOption.fromJson({ id: "a", label: "A", outcome: "maybe", scope: "Once" }, "$.options.0"), JsonException);

    Assert.areEqual("$.options.0.outcome", unknownOutcome.path);
  }

  @TestMethod
  public requiresAKnownScopeWithItsPath(): void {
    const missing = Assert.throws(() => ApprovalOption.fromJson({ id: "a", label: "A", outcome: "Approved" }, "$.options.0"), JsonException);
    const unknown = Assert.throws(() => ApprovalOption.fromJson({ id: "a", label: "A", outcome: "Approved", scope: "Forever" }, "$.options.0"), JsonException);

    Assert.areEqual("$.options.0.scope", missing.path);
    Assert.areEqual("$.options.0.scope", unknown.path);
  }
}
