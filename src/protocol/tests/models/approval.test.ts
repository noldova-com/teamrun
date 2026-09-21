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
import { Approval, ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalStatus } from "@noldova/teamrun-protocol";

@TestClass
export class ApprovalTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved);
  private static readonly acceptForSession: ApprovalOption = new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved);
  private static readonly decline: ApprovalOption = new ApprovalOption("decline", "Deny", ApprovalOutcome.Denied);
  private static readonly options: readonly ApprovalOption[] = [ApprovalTests.accept, ApprovalTests.acceptForSession, ApprovalTests.decline];
  private static readonly json: object = {
    id: "apr-1",
    messageId: "msg-2",
    kind: "Command",
    nativeKind: "commandExecution",
    summary: "Run npm test",
    payload: { command: "npm test", cwd: "/work/fixture" },
    options: [{ id: "accept", label: "Allow", outcome: "Approved" }, { id: "decline", label: "Deny", outcome: "Denied" }],
    status: "Approved",
    decision: "accept",
    createdAt: "2026-09-08T09:00:03Z",
    decidedAt: "2026-09-08T09:00:04Z"
  };

  @TestMethod
  public holdsAPendingRequestWithTheProvidersOptions(): void {
    const approval = ApprovalTests.createApproval(ApprovalStatus.Pending, null, null);

    Assert.areEqual(ApprovalKind.FileChange, approval.kind);
    Assert.areEqual("fileChange", approval.nativeKind);
    Assert.areEqual(3, approval.options.length);
    Assert.areEqual("acceptForSession", approval.options[1]?.id);
    Assert.isNull(approval.decision);
    Assert.isNull(approval.decidedAt);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheOptions(): void {
    const options = [ApprovalTests.accept, ApprovalTests.decline];
    const approval = new Approval("apr", "turn", ApprovalKind.Tool, "Bash", "Run", null, options, ApprovalStatus.Pending, null, "t", null);
    options.push(ApprovalTests.acceptForSession);

    Assert.areEqual(2, approval.options.length);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    const create = (id: string, messageId: string, nativeKind: string, summary: string, createdAt: string): Approval =>
      new Approval(id, messageId, ApprovalKind.Tool, nativeKind, summary, null, ApprovalTests.options, ApprovalStatus.Pending, null, createdAt, null);

    Assert.throws(() => create(String.empty, "turn", "Bash", "Run", "t"), ArgumentException);
    Assert.throws(() => create("apr", String.empty, "Bash", "Run", "t"), ArgumentException);
    Assert.throws(() => create("apr", "turn", " ", "Run", "t"), ArgumentException);
    Assert.throws(() => create("apr", "turn", "Bash", String.empty, "t"), ArgumentException);
    Assert.throws(() => create("apr", "turn", "Bash", "Run", String.empty), ArgumentException);
  }

  @TestMethod
  public offersAtLeastOneOptionWithDistinctIds(): void {
    const create = (options: readonly ApprovalOption[]): Approval =>
      new Approval("apr", "turn", ApprovalKind.Tool, "Bash", "Run", null, options, ApprovalStatus.Pending, null, "t", null);

    Assert.areEqual("options", Assert.throws(() => create([]), ArgumentException).parameterName);
    Assert.throws(() => create([ApprovalTests.accept, ApprovalTests.accept]), ArgumentException);
  }

  @TestMethod
  public tiesTheDecisionTimeToTheStatus(): void {
    const pendingWithTime = Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Pending, null, "t2"), ArgumentException);

    Assert.areEqual("decidedAt", pendingWithTime.parameterName);
    Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Denied, "decline", null), ArgumentException);
    Assert.doesNotThrow(() => ApprovalTests.createApproval(ApprovalStatus.Cancelled, null, "t2"));
  }

  @TestMethod
  public tiesTheDecisionToTheStatusAndTheOfferedOptions(): void {
    Assert.areEqual("decision", Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Approved, null, "t2"), ArgumentException).parameterName);
    Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Cancelled, "accept", "t2"), ArgumentException);
    Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Approved, "always", "t2"), ArgumentException);
    Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Approved, "decline", "t2"), ArgumentException);
    Assert.throws(() => ApprovalTests.createApproval(ApprovalStatus.Denied, "acceptForSession", "t2"), ArgumentException);
    Assert.doesNotThrow(() => ApprovalTests.createApproval(ApprovalStatus.Approved, "acceptForSession", "t2"));
    Assert.doesNotThrow(() => ApprovalTests.createApproval(ApprovalStatus.Denied, "decline", "t2"));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const approval = Approval.fromJson(ApprovalTests.json);

    Assert.areEqual("apr-1", approval.id);
    Assert.areEqual(ApprovalKind.Command, approval.kind);
    Assert.areEqual("commandExecution", approval.nativeKind);
    Assert.areEqual(ApprovalOutcome.Denied, approval.options[1]?.outcome);
    Assert.areEqual(ApprovalStatus.Approved, approval.status);
    Assert.areEqual("accept", approval.decision);
    Assert.areEqual("{\"command\":\"npm test\",\"cwd\":\"/work/fixture\"}", JSON.stringify(approval.payload));
    Assert.areEqual(JSON.stringify(ApprovalTests.json), JSON.stringify(approval.toJson()));
  }

  @TestMethod
  public rejectsUnknownValuesWithTheirPath(): void {
    Assert.areEqual("$.kind", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, kind: "network" }), JsonException).path);
    Assert.areEqual("$.status", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, status: "maybe" }), JsonException).path);
    const options = [{ id: "a", label: "A", outcome: "Approved" }, { id: "b", label: "B", outcome: "later" }];
    Assert.areEqual("$.options.1.outcome", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, options }), JsonException).path);
    Assert.areEqual("$.options", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, options: "none" }), JsonException).path);
  }

  private static createApproval(status: ApprovalStatus, decision: string | null, decidedAt: string | null): Approval {
    return new Approval(
      "apr-2", "msg-2", ApprovalKind.FileChange, "fileChange", "Edit src/app.ts", null, ApprovalTests.options, status, decision, "t", decidedAt);
  }

  @TestMethod
  public producesDecidedAndCancelledCopies(): void {
    const pending = ApprovalTests.createApproval(ApprovalStatus.Pending, null, null);

    const approved = pending.withDecision("acceptForSession", "t2");
    const denied = pending.withDecision("decline", "t2");
    const cancelled = pending.withCancellation("t2");

    Assert.areEqual(ApprovalStatus.Pending, pending.status);
    Assert.areEqual(ApprovalStatus.Approved, approved.status);
    Assert.areEqual("acceptForSession", approved.decision);
    Assert.areEqual("t2", approved.decidedAt);
    Assert.areEqual(ApprovalStatus.Denied, denied.status);
    Assert.areEqual(ApprovalStatus.Cancelled, cancelled.status);
    Assert.isNull(cancelled.decision);
    Assert.areEqual("decision", Assert.throws(() => pending.withDecision("mystery", "t2"), ArgumentException).parameterName);
  }
}
