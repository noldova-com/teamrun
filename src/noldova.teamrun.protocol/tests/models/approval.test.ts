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
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  ApprovalStatus,
  QuestionAnswer,
  QuestionOption
} from "@noldova/teamrun.protocol";

@TestClass
export class ApprovalTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);
  private static readonly acceptForSession: ApprovalOption = new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved, ApprovalScope.Session);
  private static readonly decline: ApprovalOption = new ApprovalOption("decline", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);
  private static readonly options: readonly ApprovalOption[] = [ApprovalTests.accept, ApprovalTests.acceptForSession, ApprovalTests.decline];
  private static readonly json: object = {
    id: "apr-1",
    messageId: "msg-2",
    kind: "Command",
    nativeKind: "commandExecution",
    summary: "Run npm test",
    payload: { command: "npm test", cwd: "/work/fixture" },
    options: [{ id: "accept", label: "Allow", outcome: "Approved", scope: "Once" }, { id: "decline", label: "Deny", outcome: "Denied", scope: "Once" }],
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
    const options = [{ id: "a", label: "A", outcome: "Approved", scope: "Once" }, { id: "b", label: "B", outcome: "later", scope: "Once" }];
    Assert.areEqual("$.options.1.outcome", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, options }), JsonException).path);
    Assert.areEqual("$.options", Assert.throws(() => Approval.fromJson({ ...ApprovalTests.json, options: "none" }), JsonException).path);
  }

  private static createApproval(status: ApprovalStatus, decision: string | null, decidedAt: string | null): Approval {
    return new Approval(
      "apr-2", "msg-2", ApprovalKind.FileChange, "fileChange", "Edit src/app.ts", null, ApprovalTests.options, status, decision, "t", decidedAt);
  }

  private static createQuestions(status: ApprovalStatus, decision: string | null, answers: readonly QuestionAnswer[] | null): Approval {
    const platform = new ApprovalQuestion("platform", "Platform", "Where will it run?", [new QuestionOption("Desktop app", String.empty)], false, true, false);
    const token = new ApprovalQuestion("token", String.empty, "Which token?", [], false, true, true);
    const options = [new ApprovalOption("answer", "Answer", ApprovalOutcome.Approved, ApprovalScope.Once), new ApprovalOption("skip", "Skip", ApprovalOutcome.Denied, ApprovalScope.Once)];
    return new Approval("apr-3", "msg-2", ApprovalKind.Question, "AskUserQuestion", "Where will it run?", null, options, status, decision, "t",
      status === ApprovalStatus.Pending ? null : "t2", [platform, token], answers);
  }

  @TestMethod
  public asksQuestionsOnlyAsAQuestionApprovalAndKeepsAnswersOnlyWhenApproved(): void {
    const answers = [new QuestionAnswer("platform", ["Desktop app"], null)];
    const questions = ApprovalTests.createQuestions(ApprovalStatus.Pending, null, null).questions;

    Assert.areEqual(JSON.stringify(["platform", "token"]), JSON.stringify(questions.map(t => t.id)));
    Assert.areEqual(JSON.stringify(answers.map(t => t.toJson())),
      JSON.stringify(ApprovalTests.createQuestions(ApprovalStatus.Approved, "answer", answers).answers?.map(t => t.toJson())));
    Assert.areEqual("questions", Assert.throws(() => new Approval("apr", "turn", ApprovalKind.Tool, "Bash", "Run", null, ApprovalTests.options,
      ApprovalStatus.Pending, null, "t", null, questions), ArgumentException).parameterName);
    Assert.areEqual("questions", Assert.throws(() => new Approval("apr", "turn", ApprovalKind.Question, "AskUserQuestion", "Ask", null, ApprovalTests.options,
      ApprovalStatus.Pending, null, "t", null, []), ArgumentException).parameterName);
    Assert.areEqual("questions", Assert.throws(() => new Approval("apr", "turn", ApprovalKind.Question, "AskUserQuestion", "Ask", null, ApprovalTests.options,
      ApprovalStatus.Pending, null, "t", null, [questions[0]!, questions[0]!]), ArgumentException).parameterName);
    for (const status of [ApprovalStatus.Pending, ApprovalStatus.Denied])
      Assert.areEqual("answers", Assert.throws(() => ApprovalTests.createQuestions(status, status === ApprovalStatus.Denied ? "skip" : null, answers),
        ArgumentException).parameterName);
    Assert.areEqual("answers", Assert.throws(() => ApprovalTests.createQuestions(ApprovalStatus.Approved, "answer", [new QuestionAnswer("colour", ["Red"], null)]),
      ArgumentException).parameterName);
    Assert.areEqual("answers", Assert.throws(() => ApprovalTests.createQuestions(ApprovalStatus.Approved, "answer", [...answers, ...answers]),
      ArgumentException).parameterName);
  }

  @TestMethod
  public roundTripsAQuestionApprovalAndReadsOneStoredWithoutQuestions(): void {
    const answered = ApprovalTests.createQuestions(ApprovalStatus.Approved, "answer", [new QuestionAnswer("platform", [], "A phone")]);
    const json = answered.toJson();
    const pending = ApprovalTests.createQuestions(ApprovalStatus.Pending, null, null).toJson();
    const asked = answered.questions[0]!.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(Approval.fromJson(json).toJson()));
    Assert.areEqual("A phone", Approval.fromJson(json).answers?.[0]?.text);
    Assert.isFalse(Object.hasOwn(pending, "answers"));
    Assert.isNull(Approval.fromJson(pending).answers);
    Assert.areEqual(0, Approval.fromJson(ApprovalTests.json).questions.length);
    Assert.areEqual("$.questions.1.options", Assert.throws(() => Approval.fromJson({ ...pending, questions: [asked, { ...asked, id: "q", options: "none" }] }),
      JsonException).path);
  }

  @TestMethod
  public keepsTheAnswersOnlyOnAnApprovedDecisionAndTheQuestionsOnACancellation(): void {
    const pending = ApprovalTests.createQuestions(ApprovalStatus.Pending, null, null);
    const answers = [new QuestionAnswer("platform", ["Desktop app"], null)];

    Assert.areEqual("Desktop app", pending.withDecision("answer", "t2", answers).answers?.[0]?.choices[0]);
    Assert.isNull(pending.withDecision("skip", "t2", answers).answers);
    Assert.areEqual(2, pending.withCancellation("t2").questions.length);
    Assert.isNull(pending.withCancellation("t2").answers);
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
