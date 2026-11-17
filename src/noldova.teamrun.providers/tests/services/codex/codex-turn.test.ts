/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type TurnDetail, TurnOutcome } from "@noldova/teamrun.core";
import { ApprovalKind, type ApprovalQuestion, DetailKind, ObservedSettings, QuestionAnswer, ReplyPlan } from "@noldova/teamrun.protocol";
import { CodexItemReader, CodexTurn, DeltaStream, InvalidOperationException, Resources, UnsupportedServerRequestException } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexTurnTests {
  @TestMethod
  public async reportsEachPlanUpdateAsTheWholePlanInOnePlaceWithItsExplanation(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = CodexTurnTests.createTurn(listener);

    await turn.handleNotificationAsync("turn/plan/updated", JsonReader.fromValue({ threadId: "t-1", turnId: "u-1", explanation: "Found the cause",
      plan: [{ step: "Read the code", status: "completed" }, { step: "Fix the bug", status: "inProgress" }, { step: "Run the tests", status: "pending" }] }));
    await turn.handleNotificationAsync("turn/plan/updated", JsonReader.fromValue({ threadId: "t-1", turnId: "u-1", explanation: null,
      plan: [{ step: "Read the code", status: "completed" }, { step: " ", status: "pending" }, { step: "Ship it", status: "later" }] }));
    await turn.handleNotificationAsync("turn/plan/updated", JsonReader.fromValue({ threadId: "other", turnId: "u-9", explanation: null, plan: [] }));
    await turn.handleNotificationAsync("turn/plan/updated", JsonReader.fromValue({ threadId: "t-1", turnId: "u-1", explanation: null, plan: [] }));

    const plans = listener.details.map(t => ReplyPlan.fromJson(t.payload));
    Assert.areEqual("Plan, 1 of 3 done|Plan, 1 of 2 done|Plan, 0 of 0 done", listener.texts.join("|"));
    Assert.isTrue(listener.details.every(t => t.kind === DetailKind.Plan && t.providerItemId === Resources.planDetailId));
    Assert.areEqual("Read the code:Completed,Fix the bug:InProgress,Run the tests:Pending|Read the code:Completed,Ship it:Pending|",
      plans.map(t => t.steps.map(u => `${u.text}:${u.status}`).join(",")).join("|"));
    Assert.areEqual("Found the cause,null,null", plans.map(t => String(t.explanation)).join(","));
  }

  @TestMethod
  public async reportsItemsReroutesAndErrorsForItsThread(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = CodexTurnTests.createTurn(listener);

    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "other", item: { id: "x", type: "agentMessage", text: "elsewhere" } }));
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ item: { id: "x", type: "agentMessage", text: "nowhere" } }));
    await turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "c", type: "commandExecution", command: "ls", status: "inProgress" } }));
    await turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "r", type: "reasoning" } }));
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "a", type: "agentMessage", text: "hi" } }));
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "u", type: "userMessage" } }));
    await turn.handleNotificationAsync("model/rerouted", JsonReader.fromValue({ threadId: "t-1", fromModel: "a", toModel: "b", reason: "load" }));
    await turn.handleNotificationAsync("error", JsonReader.fromValue({ threadId: "t-1", error: { message: "again" }, willRetry: true }));
    await turn.handleNotificationAsync("error", JsonReader.fromValue({ threadId: "t-1", error: { message: "dead" }, willRetry: false }));
    await turn.handleNotificationAsync("thread/tokenUsage/updated", JsonReader.fromValue({ threadId: "t-1" }));

    Assert.areEqual("$ ls\n,hi,Codex rerouted the model from a to b (load).,Retryable error: again,Error: dead", listener.texts.join(","));
    Assert.areEqual(DetailKind.Note, listener.details[3]?.kind);
    Assert.areEqual(DetailKind.Error, listener.details[4]?.kind);
    Assert.areEqual("b", turn.observed.model);
    Assert.areEqual("b", listener.lastObserved?.model);
    Assert.areEqual(1, listener.thinking);
    Assert.isFalse(turn.isComplete);
  }

  @TestMethod
  public async countsTheToolAndInputItemsCompletedOnItsThreadButNotMessagesOrCodexsOwnSubAgentActivity(): Promise<void> {
    const turn = CodexTurnTests.createTurn(new RecordingTurnListener());
    const completed = (threadId: string, value: JsonValue): Promise<void> => turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId, item: value }));

    await turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "s", type: "collabAgentToolCall" } }));
    await completed("t-1", { id: "a", type: "agentMessage", text: "hi" });
    await completed("t-1", { id: "r", type: "reasoning", summary: ["Think"], content: [] });
    await completed("t-1", { id: "c", type: "subAgentActivity", kind: "completed" });
    await completed("other", { id: "o", type: "collabAgentToolCall" });
    const before = turn.followUpItems;
    await completed("t-1", { id: "s", type: "collabAgentToolCall" });
    await completed("t-1", { id: "u", type: "userMessage", content: [] });

    Assert.areEqual(0, before);
    Assert.areEqual(2, turn.followUpItems);
  }

  @TestMethod
  public async settlesOnceFromTheTurnCompletion(): Promise<void> {
    const completed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const interrupted = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failedWithoutError = CodexTurnTests.createTurn(new RecordingTurnListener());
    completed.begin("turn-1");

    await completed.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-other", status: "failed" } }));
    await completed.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "completed" } }));
    completed.fail("late");
    await interrupted.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "interrupted" } }));
    await failed.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "failed", error: { message: "boom" } } }));
    await failedWithoutError.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "cancelled", error: null } }));

    Assert.areEqual(TurnOutcome.Completed, completed.outcome);
    Assert.areEqual("turn-1", completed.turnId);
    Assert.isNull(completed.error);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.outcome);
    Assert.areEqual(TurnOutcome.Failed, failed.outcome);
    Assert.areEqual("boom", failed.error);
    Assert.areEqual("The turn ended with status \"cancelled\".", failedWithoutError.error);
    Assert.areEqual(TurnOutcome.Completed, completed.toResult(false).outcome);
    Assert.areEqual("turn-1", completed.toResult(false).nativeTurnId);
  }

  @TestMethod
  public async stillHandlesTheItemAndPlanAfterATimedReportFailsAndThenEndsTheTurnFailed(): Promise<void> {
    const listener = new FailingOnceDetailListener();
    const turn = CodexTurnTests.createTurn(listener);
    turn.begin("turn-1");

    await turn.handleNotificationAsync("item/agentMessage/delta", JsonReader.fromValue({ threadId: "t-1", itemId: "a", delta: "partial" }));
    await listener.failed.promise;
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "a", type: "agentMessage", text: "whole" } }));
    await turn.handleNotificationAsync("turn/plan/updated", JsonReader.fromValue({ threadId: "t-1", turnId: "turn-1", explanation: null,
      plan: [{ step: "Ship it", status: "pending" }] }));
    await turn.handleNotificationAsync("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "completed" } }));
    await turn.waitForCompletion();

    Assert.areEqual("whole|Plan, 0 of 1 done", listener.texts.join("|"));
    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(FailingOnceDetailListener.failure, turn.error);
    Assert.areEqual(FailingOnceDetailListener.failure, turn.toResult(false).error);
  }

  @TestMethod
  public async buildsResultsAndRejectsEarlyReads(): Promise<void> {
    const pending = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const interrupted = CodexTurnTests.createTurn(new RecordingTurnListener());
    const completion = failed.waitForCompletion();

    Assert.throws(() => pending.toResult(false), InvalidOperationException);
    failed.fail("broken");
    interrupted.interrupt();
    await completion;

    Assert.areEqual("broken", failed.toResult(false).error);
    Assert.areEqual(TurnOutcome.Interrupted, failed.toResult(true).outcome);
    Assert.isNull(failed.toResult(true).error);
    Assert.areEqual("t-1", interrupted.toResult(false).nativeSessionId);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.toResult(false).outcome);
    Assert.areEqual("threadId", Assert.throws(() => CodexTurnTests.createTurn(new RecordingTurnListener(), " "), ArgumentException).parameterName);
    Assert.areEqual("turnId", Assert.throws(() => pending.begin(""), ArgumentException).parameterName);
  }

  @TestMethod
  public async answersApprovalRequestsWithTheListenerDecision(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("acceptForSession", "decline");
    const turn = CodexTurnTests.createTurn(listener);
    const signal = new AbortController().signal;

    const command = await turn.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c1", command: "rm x", cwd: "D:/w", reason: "clean" }), signal);
    const bareCommand = await turn.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c2" }), signal);
    const change = await turn.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "f1", reason: "apply", grantRoot: "D:/w" }), signal);
    const bareChange = await turn.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "f2" }), signal);
    const input = await turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId: "q" }), signal);
    const unsupported = await Assert.throwsAsync(() => turn.handleServerRequest("item/permissions/requestApproval", JsonReader.fromValue({ threadId: "t-1" }), signal), UnsupportedServerRequestException);

    Assert.areEqual("{\"decision\":\"acceptForSession\"}", JSON.stringify(command));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(bareCommand));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(change));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(bareChange));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(input));
    Assert.areEqual("item/permissions/requestApproval", unsupported.method);
    Assert.areEqual("t-1:c1:1,t-1:c2:2,t-1:f1:3,t-1:f2:4", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(4, listener.signals.length);
    Assert.isTrue(listener.signals.every(t => t === signal));
    Assert.areEqual("Run command: rm x", listener.asks[0]?.summary);
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("{\"command\":\"rm x\",\"cwd\":\"D:/w\",\"reason\":\"clean\"}", JSON.stringify(listener.asks[0]?.payload));
    Assert.areEqual("Run command: (unknown command)", listener.asks[1]?.summary);
    Assert.areEqual("Apply file changes: apply (grant root D:/w)", listener.asks[2]?.summary);
    Assert.areEqual(ApprovalKind.FileChange, listener.asks[2]?.kind);
    Assert.areEqual("commandExecution,commandExecution,fileChange,fileChange", listener.asks.map(t => t.nativeKind).join(","));
    Assert.areEqual("Apply file changes", listener.asks[3]?.summary);
    Assert.areEqual("accept:Approved:Once,acceptForSession:Approved:Session,decline:Denied:Once",
      listener.asks[0]?.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
  }

  @TestMethod
  public async asksRequestUserInputAsQuestionsAndAnswersEachByItsIdNotingEachQuestionItCantRead(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("platform", ["Desktop app"], null), new QuestionAnswer("token", [], "s3cret")], null,
      [new QuestionAnswer("pin", [], "1234")], [new QuestionAnswer("size", [], "roomy"), new QuestionAnswer("color", ["Red"], "darker")]);
    const turn = CodexTurnTests.createTurn(listener);
    const signal = new AbortController().signal;
    const params = {
      threadId: "t-1", turnId: "turn-1", itemId: "q1", isBlocking: true, questions: [
        { id: "platform", header: "Platform", question: "Which platform?", isOther: false, isSecret: false,
          options: [{ label: "Desktop app", description: "The window" }, { label: "Web", description: "A browser" }] },
        { id: "token", header: "Token", question: "Which token?", isOther: true, isSecret: true, options: null }
      ]
    };
    const ask = (itemId: string, questions: unknown): Promise<JsonValue> =>
      turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId, questions }), signal);

    const answered = await turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue(params), signal);
    const skipped = await turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ ...params, itemId: "q2" }), signal);
    const secret = await ask("q3", [{ id: "pin", header: "PIN", question: "Which PIN?", isOther: false, isSecret: true, options: null }]);
    const partly = await ask("q4", [{ header: "Name", question: "Which name?", options: null }, "size",
      { id: "size", header: "Size", question: "Which size?", isOther: true, options: [{ label: "Large", description: "" }] },
      { id: "color", header: "Color", question: "Which color?", isOther: true, options: [{ label: "Red", description: "" }] }]);
    const unreadable = await ask("q5", [{ id: "name", question: " " }]);
    const none = await ask("q6", "none");

    Assert.areEqual(JSON.stringify({ answers: { platform: { answers: ["Desktop app"] }, token: { answers: ["user_note: s3cret"] } } }), JSON.stringify(answered));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(skipped));
    Assert.areEqual(JSON.stringify({ answers: { pin: { answers: ["user_note: 1234"] } } }), JSON.stringify(secret));
    Assert.areEqual(JSON.stringify({ answers: { size: { answers: ["None of the above", "user_note: roomy"] }, color: { answers: ["Red", "user_note: darker"] } } }),
      JSON.stringify(partly));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(unreadable));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(none));
    Assert.areEqual(JSON.stringify([true, true, true]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text.startsWith(Resources.formatCodexQuestionUnread("")))));
    Assert.areEqual("t-1:q1:1,t-1:q2:2,t-1:q3:3,t-1:q4:4", listener.questionAsks.map(t => t.providerRequestId).join(","));
    Assert.areEqual("item/tool/requestUserInput", listener.questionAsks[0]?.nativeKind);
    Assert.isTrue(listener.questionAsks.every(t => Object.isNull(t.subAgent)));
    Assert.areEqual(JSON.stringify([
      { id: "platform", header: "Platform", text: "Which platform?", options: [{ label: "Desktop app", description: "The window" }, { label: "Web", description: "A browser" }],
        multiple: false, other: false, secret: false },
      { id: "token", header: "Token", text: "Which token?", options: [], multiple: false, other: true, secret: true }
    ]), JSON.stringify(listener.questionAsks[0]?.questions.map(t => t.toJson())));
    Assert.areEqual("pin:true:true", listener.questionAsks[2]?.questions.map(t => [t.id, t.other, t.secret].join(":")).join(","));
    Assert.areEqual("size:true:false,color:true:false", listener.questionAsks[3]?.questions.map(t => [t.id, t.other, t.secret].join(":")).join(","));
    Assert.isTrue(listener.signals.every(t => t === signal));
  }

  @TestMethod
  public async answersNothingWhenTheReplyStopsWhileItsQuestionsWait(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("Message m2 is not open.");
    const turn = CodexTurnTests.createTurn(listener);

    const stopped = await turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId: "q1",
      questions: [{ id: "pin", header: "PIN", question: "Which PIN?", isOther: false, isSecret: true, options: null }] }), new AbortController().signal);

    Assert.areEqual("{\"answers\":{}}", JSON.stringify(stopped));
    Assert.areEqual(1, listener.questionAsks.length);
  }

  @TestMethod
  public async postsAnAsyncMessagesQuestionsWithoutHoldingTheTurnAndKeepsItsText(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = CodexTurnTests.createTurn(listener);
    const message = (id: string, extra: Record<string, JsonValue>, threadId: string = "t-1"): Promise<void> => turn.handleNotificationAsync("item/completed",
      JsonReader.fromValue({ threadId, item: { id, type: "agentMessage", text: `Asked ${id}`, ...extra } }));
    const questions = [{ title: "Which platform?", options: ["Desktop app", " ", "Web"] }, { title: "Anything else?", options: null }, { title: " ", options: null },
      "Which size?", { title: "Which color?", options: "Red" }];

    await message("msg-1", { delivery: "async", questions });
    await message("msg-2", { delivery: null, questions });
    await message("msg-3", { questions });
    await message("msg-4", { delivery: "async", questions: [] });
    await message("msg-5", { delivery: "async", questions: [" "] });
    await message("msg-6", { delivery: "async", questions: null });
    await message("msg-7", { delivery: "async", questions }, "other");
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "c", type: "commandExecution", command: "ls", status: "completed",
      delivery: "async", questions } }));

    Assert.areEqual("Asked msg-1,Asked msg-2,Asked msg-3,Asked msg-4,Asked msg-5,Asked msg-6", listener.texts.filter(t => t.startsWith("Asked")).join(","));
    Assert.areEqual(1, listener.postedQuestions.length);
    Assert.areEqual("msg-1", listener.postedQuestions[0]?.providerRequestId);
    Assert.areEqual("request_user_input_async", listener.postedQuestions[0]?.nativeKind);
    Assert.isTrue(listener.postedQuestions.every(t => Object.isNull(t.subAgent)));
    Assert.areEqual(JSON.stringify([
      { id: "0", header: "", text: "Which platform?", options: [{ label: "Desktop app", description: "" }, { label: "Web", description: "" }],
        multiple: false, other: true, secret: false },
      { id: "1", header: "", text: "Anything else?", options: [], multiple: false, other: true, secret: false }
    ]), JSON.stringify(listener.postedQuestions[0]?.questions.map(t => t.toJson())));
    Assert.areEqual(0, listener.questionAsks.length);
    Assert.areEqual(JSON.stringify([true, true, true, true]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text.startsWith(Resources.formatCodexPostedQuestionUnread("")))));
    Assert.isFalse(turn.isComplete);
  }

  @TestMethod
  public async passesOnAFailureReadingAPostedQuestionThatIsntOneOfItsReadFailures(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new CodexTurn("t-1", listener, new ObservedSettings("codex", "a", "high", "1.0.0"), new FailingQuestionReader(), new DeltaStream(listener, 1));
    const params = JsonReader.fromValue({ threadId: "t-1", item: { id: "msg-1", type: "agentMessage", text: "Asked msg-1", delivery: "async",
      questions: [{ title: "Which platform?", options: null }] } });

    const failure = await Assert.throwsAsync(() => turn.handleNotificationAsync("item/completed", params), Error);

    Assert.areEqual(FailingQuestionReader.failure, failure.message);
    Assert.areEqual(0, listener.postedQuestions.length);
  }

  @TestMethod
  public async asksThePersonToApproveAnMcpToolCallAndAnswersCodexsElicitationWithTheirDecision(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("accept", "acceptForSession");
    const turn = CodexTurnTests.createTurn(listener);
    const signal = new AbortController().signal;
    await turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "call-1", type: "mcpToolCall", server: "search", tool: "lookup",
      status: "inProgress" } }));

    const once = await turn.handleServerRequest("mcpServer/elicitation/request", CodexTurnTests.toolApproval("search",
      { persist: "session", tool_title: "Look up", tool_params: { query: "teamrun" } }), signal);
    const session = await turn.handleServerRequest("mcpServer/elicitation/request", CodexTurnTests.toolApproval("docs", { persist: ["session", "always"] }), signal);

    Assert.areEqual("{\"action\":\"accept\",\"content\":{},\"_meta\":null}", JSON.stringify(once));
    Assert.areEqual("{\"action\":\"accept\",\"content\":{},\"_meta\":{\"persist\":\"session\"}}", JSON.stringify(session));
    Assert.areEqual("t-1:call-1:1,t-1:docs:2", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.isTrue(listener.asks.every(t => t.kind === ApprovalKind.Tool && t.nativeKind === "elicitation"));
    Assert.areEqual("Allow the search MCP server to run tool \"lookup\"?", listener.asks[0]?.summary);
    Assert.areEqual(JSON.stringify({ server: "search", message: "Allow the search MCP server to run tool \"lookup\"?", tool: "Look up", arguments: { query: "teamrun" } }),
      JSON.stringify(listener.asks[0]?.payload));
    Assert.areEqual(JSON.stringify({ server: "docs", message: "Allow the docs MCP server to run tool \"lookup\"?", tool: null, arguments: null }),
      JSON.stringify(listener.asks[1]?.payload));
    Assert.areEqual("accept:Approved:Once,acceptForSession:Approved:Session,decline:Denied:Once",
      listener.asks[1]?.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
    Assert.isTrue(listener.signals.every(t => t === signal));
  }

  @TestMethod
  public async marksTheServersOneRunningToolCallDeniedWhenThePersonDeclinesItsApproval(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("decline", "decline");
    const turn = CodexTurnTests.createTurn(listener);
    const started = (id: string, server: string): Promise<void> => turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1",
      item: { id, type: "mcpToolCall", server, tool: "lookup", status: "inProgress" } }));
    const completed = (id: string, server: string): Promise<void> => turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1",
      item: { id, type: "mcpToolCall", server, tool: "lookup", status: "failed", error: { message: "user rejected MCP tool call" } } }));
    await started("call-1", "search");
    await started("call-2", "docs");
    await started("call-3", "docs");

    const declined = await turn.handleServerRequest("mcpServer/elicitation/request", CodexTurnTests.toolApproval("search", { persist: "always" }),
      new AbortController().signal);
    const unmatched = await turn.handleServerRequest("mcpServer/elicitation/request", CodexTurnTests.toolApproval("docs", {}), new AbortController().signal);
    await completed("call-1", "search");
    await completed("call-2", "docs");

    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(declined));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(unmatched));
    Assert.areEqual("t-1:call-1:1,t-1:docs:2", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual("accept:Approved:Once,decline:Denied:Once", listener.asks[0]?.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
    const ended = listener.details.filter(t => t.providerItemId === "call-1" || t.providerItemId === "call-2").slice(-2);
    Assert.areEqual(JSON.stringify([{ server: "search", tool: "lookup", status: "failed", denied: true }, { server: "docs", tool: "lookup", status: "failed" }]),
      JSON.stringify(ended.map(t => t.payload)));
  }

  @TestMethod
  public async cancelsAnElicitationItCantShowWithANoteInTheChatAndAsksNothing(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = CodexTurnTests.createTurn(listener);
    const signal = new AbortController().signal;
    const requests = [
      { threadId: "t-1", turnId: "u-1", serverName: "login", mode: "url", message: "Sign in", url: "https://login.example", elicitationId: "e-1" },
      { threadId: "t-1", turnId: "u-1", serverName: "forms", mode: "form", message: "Your name?", requestedSchema: { type: "object", properties: { name: { type: "string" } } } },
      { threadId: "t-1", turnId: "u-1", serverName: "mixed", mode: "form", message: "Allow?", _meta: { codex_approval_kind: "mcp_tool_call" },
        requestedSchema: { type: "object", properties: { reason: { type: "string" } } } },
      { threadId: "t-1", turnId: null, serverName: "verify", mode: "openai/userVerification", _meta: { codex_approval_kind: "mcp_tool_call" }, title: "Verify",
        description: "Confirm", challenge: "c" }
    ];

    const answers = [];
    for (const request of requests)
      answers.push(await turn.handleServerRequest("mcpServer/elicitation/request", JsonReader.fromValue(request), signal));

    Assert.isTrue(answers.every(t => JSON.stringify(t) === "{\"action\":\"cancel\"}"));
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(["login", "forms", "mixed", "verify"].map(t => `The MCP server ${t} asked for something TeamRun can't show yet, so TeamRun cancelled its request.`)
      .join("|"), listener.texts.join("|"));
    Assert.isTrue(listener.details.every(t => t.kind === DetailKind.Note));
  }

  @TestMethod
  public async marksTheCallLeftRunningDeniedWhenTheServersOtherCallEndsBeforeThePersonDeclines(): Promise<void> {
    const listener = new RecordingTurnListener();
    const decision = Promise.withResolvers<string>();
    listener.heldDecisions.push(decision.promise);
    const turn = CodexTurnTests.createTurn(listener);
    for (const id of ["call-1", "call-2"])
      await turn.handleNotificationAsync("item/started", JsonReader.fromValue({ threadId: "t-1",
        item: { id, type: "mcpToolCall", server: "docs", tool: "lookup", status: "inProgress" } }));

    const answer = turn.handleServerRequest("mcpServer/elicitation/request", CodexTurnTests.toolApproval("docs", {}), new AbortController().signal);
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1",
      item: { id: "call-1", type: "mcpToolCall", server: "docs", tool: "lookup", status: "completed" } }));
    decision.resolve("decline");
    const declined = await answer;
    await turn.handleNotificationAsync("item/completed", JsonReader.fromValue({ threadId: "t-1",
      item: { id: "call-2", type: "mcpToolCall", server: "docs", tool: "lookup", status: "failed", error: { message: "user rejected MCP tool call" } } }));

    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(declined));
    Assert.areEqual("t-1:docs:1", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(JSON.stringify({ server: "docs", tool: "lookup", status: "failed", denied: true }),
      JSON.stringify(listener.details.filter(t => t.providerItemId === "call-2").at(-1)?.payload));
  }

  private static toolApproval(server: string, meta: Record<string, JsonValue>): JsonReader {
    return JsonReader.fromValue({ threadId: "t-1", turnId: "u-1", serverName: server, mode: "form", message: `Allow the ${server} MCP server to run tool "lookup"?`,
      _meta: { codex_approval_kind: "mcp_tool_call", ...meta }, requestedSchema: { type: "object", properties: {} } });
  }

  @TestMethod
  public async passesOnAFailureReadingAQuestionThatIsntOneOfItsReadFailures(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new CodexTurn("t-1", listener, new ObservedSettings("codex", "a", "high", "1.0.0"), new FailingQuestionReader(), new DeltaStream(listener, 1));
    const params = JsonReader.fromValue({ threadId: "t-1", itemId: "q1", questions: [{ id: "name", header: "Name", question: "Which name?", options: null }] });

    const failure = await Assert.throwsAsync(() => turn.handleServerRequest("item/tool/requestUserInput", params, new AbortController().signal), Error);

    Assert.areEqual(FailingQuestionReader.failure, failure.message);
  }

  private static createTurn(listener: RecordingTurnListener, threadId: string = "t-1"): CodexTurn {
    return new CodexTurn(threadId, listener, new ObservedSettings("codex", "a", "high", "1.0.0"), new CodexItemReader(), new DeltaStream(listener, 1));
  }
}

class FailingOnceDetailListener extends RecordingTurnListener {
  public static readonly failure: string = "The detail could not be saved.";
  public readonly failed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private failures: number = 1;

  public override async onDetailAsync(detail: TurnDetail): Promise<void> {
    if (this.failures === 0) {
      await super.onDetailAsync(detail);
      return;
    }
    this.failures -= 1;
    this.failed.resolve();
    throw new Error(FailingOnceDetailListener.failure);
  }
}

class FailingQuestionReader extends CodexItemReader {
  public static readonly failure: string = "The question reader broke.";

  public override readQuestion(): ApprovalQuestion {
    throw new Error(FailingQuestionReader.failure);
  }

  public override readPostedQuestion(): ApprovalQuestion {
    throw new Error(FailingQuestionReader.failure);
  }
}
