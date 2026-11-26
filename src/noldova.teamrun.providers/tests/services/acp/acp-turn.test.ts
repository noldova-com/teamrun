/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { PassThrough } from "node:stream";
import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ApprovalAsk, QuestionAsk, TurnDetail } from "@noldova/teamrun.core";
import { ApprovalKind, DetailKind, ObservedSettings, PlanStep, PlanStepStatus, QuestionAnswer, ReplyPlan, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { AcpClient, AcpConnectionException, AcpMcpTool, AcpPlan, AcpTurn, GrokToolGate, type IAcpPlanReader, Resources, SavedImage, StartedProcess }
  from "@noldova/teamrun.providers";
import { ClosedRunError } from "../../fixtures/closed-run-error.fixture.js";
import { CopilotApprovedToolRecording } from "../../fixtures/copilot-approved-tool.recording.js";
import { GrokApprovedToolRecording } from "../../fixtures/grok-approved-tool.recording.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

class ImageSaveCall {
  public readonly tool: JsonObject;
  public readonly sessionId: string;

  public constructor(tool: JsonObject, sessionId: string) {
    this.tool = tool;
    this.sessionId = sessionId;
  }
}

class ShownToolCall {
  public readonly kind: DetailKind;
  public readonly last: JsonReader;

  public constructor(kind: DetailKind, last: JsonReader) {
    this.kind = kind;
    this.last = last;
  }
}

@TestClass
export class AcpTurnTests {
  private static readonly readOnlyAllow: JsonObject = { optionId: "yes", name: "Allow once", kind: "allow_once" };
  private static readonly readOnlyReject: JsonObject = { optionId: "no", name: "Reject", kind: "reject_once" };

  @TestMethod
  public async keepsUpdatesInsideTheirSessionAndTurnBoundary(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject, sessionId: string = "s"): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId, update: value }));
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "old" } });
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await turn.onNotificationAsync("unknown", JsonReader.fromValue({}));
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "other" } }, "other");
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "image" } });
    await update({ sessionUpdate: "unknown" });
    for (let index = 0; index < 130; index++)
      await update({ sessionUpdate: "tool_call", toolCallId: String(index) });
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "end" } });
    await turn.onResponseAsync("session/set_model");
    await turn.onResponseAsync("session/prompt");
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "late" } });
    await turn.onExitAsync();
    Assert.areEqual(131, listener.details.length);
    Assert.areEqual(DetailKind.Note, listener.details[0]?.kind);
    Assert.areEqual("Agent tool", listener.details[0]?.text);
    Assert.areEqual("agent-tool-0", listener.details[0]?.providerItemId);
    Assert.areEqual("agent-1", listener.details.at(-1)?.providerItemId);
    Assert.areEqual("end", listener.details.at(-1)?.text);
  }

  @TestMethod
  public async takesTheTurnIdFromThePromptIndexOfItsOwnPromptsEcho(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1);
    const echo = (meta: JsonValue | undefined, sessionId: string = "s"): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId,
      update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "Hi" }, ...(Object.isUndefined(meta) ? {} : { _meta: meta }) } }));
    await echo({ promptIndex: 1 });
    await turn.beginAsync("s", true, new ObservedSettings("grok", null, null, null));
    const before = turn.nativeTurnId;
    await echo({ promptIndex: 4 }, "other");
    await echo(undefined);
    await echo(null);
    await echo({ modelId: "grok-5" });
    const unmarked = turn.nativeTurnId;
    await echo({ promptIndex: 2 });
    await echo({ promptIndex: "3" });
    await echo({ promptIndex: -1 });
    await echo({ promptIndex: 2.5 });

    Assert.isNull(before);
    Assert.isNull(unmarked);
    Assert.areEqual("2", turn.nativeTurnId);
    Assert.areEqual(0, listener.details.length);
  }

  @TestMethod
  public async reportsEachPlanUpdateAsTheWholePlanInOnePlaceAfterTheTextBeforeItAndNoUsageForOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Here's my plan." } });
    await update({ sessionUpdate: "plan", entries: [{ content: "Read the code", priority: "high", status: "completed" },
      { content: "Fix the bug", priority: "medium", status: "in_progress" }, { content: "Run the tests", priority: "low", status: "pending" }] });
    await update({ sessionUpdate: "plan", entries: [{ content: "Read the code", priority: "high", status: "completed" }, { content: "", priority: "low", status: "pending" },
      { content: "Fix the bug", priority: "medium", status: "constructor" }] });
    await update({ sessionUpdate: "plan", entries: [] });
    await update({ sessionUpdate: "usage_update" });

    Assert.areEqual("Text:Here's my plan.|Plan:Plan, 1 of 3 done|Plan:Plan, 1 of 2 done|Plan:Plan, 0 of 0 done", listener.details.map(t => `${t.kind}:${t.text}`).join("|"));
    Assert.isTrue(listener.details.slice(1).every(t => t.providerItemId === Resources.planDetailId));
    Assert.areEqual("Read the code:Completed,Fix the bug:InProgress,Run the tests:Pending|Read the code:Completed,Fix the bug:Pending|",
      listener.details.slice(1).map(t => ReplyPlan.fromJson(t.payload).steps.map(u => `${u.text}:${u.status}`).join(",")).join("|"));
    Assert.areEqual(0, listener.usages.length);
  }

  @TestMethod
  public async reportsThePlanAToolCallOfItsOwnSessionLeftAfterTheToolsRowOnceTheCallCompletes(): Promise<void> {
    const listener = new RecordingTurnListener();
    const read: string[] = [];
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, () => null, null, () => Promise.resolve([]), (tool, sessionId) => {
      read.push(`${tool.readNonBlankString("toolCallId")}@${sessionId}`);
      return tool.readOptionalString("title") === "sql"
        ? [new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, null)] : null;
    });
    const update = (value: JsonObject, sessionId: string = "s"): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId, update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    await update({ sessionUpdate: "tool_call", toolCallId: "q", title: "sql", status: "in_progress" });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "q", status: "completed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "v", title: "view", status: "completed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "f", title: "sql", status: "failed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "a", status: "in_progress", rawInput: { description: "Look" }, _meta: { "x.ai/tool": { name: "spawn_subagent" } } });
    await turn.onNotificationAsync("x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "subagent_spawned", child_session_id: "c", description: "Look" } }));
    await update({ sessionUpdate: "tool_call", toolCallId: "q", title: "sql", status: "completed" }, "c");
    await turn.finishAsync();

    const details = listener.details.filter(t => t.kind !== DetailKind.SubAgent);
    Assert.areEqual("Note:sql|Note:sql|Plan:Plan, 1 of 2 done|Note:view|Note:sql|Note:sql", details.map(t => `${t.kind}:${t.text}`).join("|"));
    Assert.areEqual(`${Resources.planDetailId},agent-tool-a`, [details[2]?.providerItemId, details[5]?.parentItemId].join(","));
    Assert.areEqual("Read the code:Completed,Fix the bug:InProgress", ReplyPlan.fromJson(details[2]?.payload).steps.map(t => `${t.text}:${t.status}`).join(","));
    Assert.areEqual("q@s,v@s", read.join(","));
  }

  @TestMethod
  public async reportsANewSessionsCostInUsDollarsAsTheReplysAndNoCostForALoadedSession(): Promise<void> {
    const costs = async (resumed: boolean, ...amounts: readonly JsonObject[]): Promise<string> => {
      const listener = new RecordingTurnListener();
      const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
      await turn.beginAsync("s", resumed, new ObservedSettings("agent", null, null, null));
      for (const cost of amounts)
        await turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "usage_update", used: 1000, size: 8000, cost } }));
      return listener.usages.map(t => `${t.costUsd} ${t.context?.usedTokens}`).join(",");
    };

    Assert.areEqual("0.25 1000,0.5 1000", await costs(false, { amount: 0.25, currency: "USD" }, { amount: 0.5, currency: "USD" }));
    Assert.areEqual("null 1000", await costs(true, { amount: 0.75, currency: "USD" }));
    Assert.areEqual("null 1000,null 1000", await costs(false, { amount: 0.25, currency: "EUR" }, { amount: -1, currency: "USD" }));
  }

  @TestMethod
  public async recordsAToolCallWithNoStatusAsPendingUntilAnUpdateGivesItOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "tool_call", toolCallId: "r", kind: "read", title: "Read" });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "r", title: "Read a.ts" });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "r", status: "completed" });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "r", title: "Read a.ts again" });
    await turn.finishAsync();

    Assert.areEqual("pending|pending|completed|completed", listener.details.map(t => AcpTurnTests.payloadOf(t).toJson()["status"]).join("|"));
  }

  @TestMethod
  public async servesACallItsTitleNamesAsATeamRunToolAsANoteWithTheToolsInputAndNoWritesAndLeavesOtherNamesByTheirKind(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "tool_call", toolCallId: "c", title: "teamrun-terminal_run", kind: "execute", rawInput: { command: "echo hi > out.txt" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "g", title: "teamrun__teamrun_list_pages" });
    await update({ sessionUpdate: "tool_call", toolCallId: "r", title: "use_tool", kind: "execute", rawInput: { tool_name: "teamrun__teamrun_edit_page", command: "echo hi > out.txt" } });
    for (const title of ["teamrun-notes-search", "teamrun-notes__search", "mcp__teamrun__teamrun_show_page", "teamrun/documents", "teamrun.json", "teamrun_show_page"])
      await update({ sessionUpdate: "tool_call", toolCallId: title, title, kind: "read", rawInput: { path: "a" } });
    await turn.finishAsync();

    Assert.areEqual(JSON.stringify([
      [DetailKind.Note, "mcp__teamrun__terminal_run", { command: "echo hi > out.txt" }, "terminal_run", { command: "echo hi > out.txt" }, false],
      [DetailKind.Note, "mcp__teamrun__teamrun_list_pages", {}, "teamrun_list_pages", {}, false],
      [DetailKind.Command, "execute", null, null, null, true],
      ...Array.from({ length: 6 }, () => [DetailKind.Note, "read", null, null, null, false])
    ]), JSON.stringify(listener.details.map(t => AcpTurnTests.servedOf(t.kind, t.payload))));
  }

  @TestMethod
  public async servesACallItsAgentNamesAsATeamRunToolByItsMetaFirstThenARoutingAgentsToolNameAndOnlyThenItsTitle(): Promise<void> {
    const listener = new RecordingTurnListener();
    const mcpToolOf = (tool: JsonReader): AcpMcpTool | null => {
      const meta = tool.hasField("_meta") ? tool.readObject("_meta") : null;
      return Object.isNull(meta) ? null : new AcpMcpTool(meta.readString("server"), meta.readString("tool"));
    };
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, undefined, "use_tool", undefined, undefined, undefined, null, null,
      undefined, [], mcpToolOf);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "tool_call", toolCallId: "a", title: "Show", rawInput: { path: "a.html" }, _meta: { server: "teamrun", tool: "teamrun_show_page" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "o", title: "teamrun__search", _meta: { server: "notes", tool: "search" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "i", title: "teamrun__search", _meta: { server: "teamrun", tool: "notes-search" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "r", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_read_page", tool_input: { page_id: "p1" } } });
    await update({ sessionUpdate: "tool_call", toolCallId: "e", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_list_pages" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "t", title: "teamrun__teamrun_list_pages", rawInput: "list" });
    await turn.finishAsync();

    Assert.areEqual(JSON.stringify([
      [DetailKind.Note, "mcp__teamrun__teamrun_show_page", { path: "a.html" }, "teamrun_show_page", { path: "a.html" }, false],
      [DetailKind.Note, Resources.acpOtherKind, null, null, null, false],
      [DetailKind.Note, Resources.acpOtherKind, null, null, null, false],
      [DetailKind.Note, "mcp__teamrun__teamrun_read_page", { page_id: "p1" }, "teamrun_read_page", { page_id: "p1" }, false],
      [DetailKind.Note, "mcp__teamrun__teamrun_list_pages", {}, "teamrun_list_pages", {}, false],
      [DetailKind.Note, "mcp__teamrun__teamrun_list_pages", "list", "teamrun_list_pages", "list", false]
    ]), JSON.stringify(listener.details.map(t => AcpTurnTests.servedOf(t.kind, t.payload))));
  }

  @TestMethod
  public async recordsACompletedEditsDiffsAsTeamRunFileChanges(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    const content = [
      { type: "diff", path: "D:\\repo\\new.cs", newText: "class A\n{\n}" },
      { type: "diff", path: "D:\\repo\\old.cs", oldText: "int x = 1;", newText: "int x = 2;\nint y = 3;" },
      { type: "diff", path: "D:\\repo\\cut.cs", oldText: "gone", newText: "" },
      { type: "content", content: { type: "text", text: "Applied." } }
    ];
    await update({ sessionUpdate: "tool_call", toolCallId: "e", kind: "edit", title: "Edit", status: "pending", content, locations: [{ path: "D:\\repo\\new.cs" }] });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "e", status: "completed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "f", kind: "edit", title: "Edit", status: "failed", content });
    await turn.finishAsync();

    const pending = AcpTurnTests.payloadOf(listener.details[0]);
    const completed = AcpTurnTests.payloadOf(listener.details[1]).toJson();
    const failed = AcpTurnTests.payloadOf(listener.details[2]);
    Assert.areEqual(DetailKind.FileChange, listener.details[1]?.kind);
    Assert.isFalse(pending.hasField("changes"));
    Assert.areEqual(JSON.stringify([
      { path: "D:\\repo\\new.cs", kind: "add", diff: "+class A\n+{\n+}" },
      { path: "D:\\repo\\old.cs", kind: "update", diff: "-int x = 1;\n+int x = 2;\n+int y = 3;" },
      { path: "D:\\repo\\cut.cs", kind: "update", diff: "-gone" }
    ]), JSON.stringify(completed["changes"]));
    Assert.areEqual(JSON.stringify(["D:\\repo\\new.cs"]), JSON.stringify(completed["files"]));
    Assert.isFalse(failed.hasField("changes"));
  }

  @TestMethod
  public async deniesStaleInvalidAndUnsupportedPermissionRequests(): Promise<void> {
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, controller.signal, 1);
    const request = (sessionId: string = "s", options: JsonObject[] = [{ optionId: "yes", name: "Allow", kind: "allow_once" }]): JsonReader =>
      JsonReader.fromValue({ sessionId, toolCall: {}, options });
    const ask = (params: JsonReader = request()): Promise<unknown> => turn.onRequest("id", "session/request_permission", params);
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
    await turn.beginAsync("s", true, new ObservedSettings("agent", null, null, null));
    await Assert.throwsAsync(() => turn.onRequest("id", "unsupported", request()), AcpConnectionException);
    await Assert.throwsAsync(() => ask(request("s", [])), Error);
    Assert.isTrue(JSON.stringify(await ask(request("other"))).includes("cancelled"));
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
    listener.decisions.push("yes");
    Assert.isTrue(JSON.stringify(await ask()).includes("selected"));
    controller.abort();
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
    Assert.areEqual(2, listener.asks.length);
  }

  @TestMethod
  public async asksAPermissionRequestAlsoAfterItsTurnEndedUnlessASubAgentMadeItAndCancelsItOnceTheReplyTakesNoMore(): Promise<void> {
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, controller.signal, 1);
    const request = JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "t", title: "Run" }, options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] });
    const ask = (): Promise<unknown> => turn.onRequest("id", "session/request_permission", request);
    const held = Promise.withResolvers<string>();
    listener.heldDecisions.push(held.promise, Promise.resolve("yes"));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    const during = ask();
    await turn.finishAsync();
    controller.abort();
    held.resolve("yes");
    const late = await ask();
    listener.decisionFailure = new ClosedRunError("The message is not open.");
    const closed = await ask();
    const fromSubAgents = await Promise.all([{ "x.ai/requestingSessionId": "child" }, { "github.com/copilot": { agentId: "agent-1" } }].map(meta =>
      turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "u", title: "Run", _meta: meta },
        options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] }))));
    listener.decisionFailure = new Error("boom");

    await Assert.throwsAsync(() => ask(), Error);
    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "selected", optionId: "yes" } }, { outcome: { outcome: "selected", optionId: "yes" } },
      { outcome: { outcome: "cancelled" } }, { outcome: { outcome: "cancelled" } }, { outcome: { outcome: "cancelled" } }]),
      JSON.stringify([await during, late, closed, ...fromSubAgents]));
    Assert.areEqual(4, listener.asks.length);
  }

  @TestMethod
  public async asksAFormElicitationAsQuestionsAndAcceptsItWithTheAnswersAsItsContent(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const form = {
      sessionId: "s", mode: "form", message: "Set up the project.", requestedSchema: { type: "object", required: ["name"], properties: {
        name: { type: "string", title: "Name", description: "What should it be called?" },
        size: { type: "string", enum: ["small", "large"] },
        stack: { type: "string", oneOf: [{ const: "ng", title: "Angular", description: "Signals" }, { const: "re", title: "React" }] },
        parts: { type: "array", items: { type: "string", anyOf: [{ const: "a", title: "Attachments" }, { const: "s" }] } },
        tests: { type: "boolean", title: "Tests" },
        port: { type: "integer" }
      } }
    };
    listener.answers.push([new QuestionAnswer("name", [], "Atlas"), new QuestionAnswer("size", ["large"], null), new QuestionAnswer("stack", ["React"], null),
      new QuestionAnswer("parts", ["Attachments", "s"], null), new QuestionAnswer("tests", ["Yes"], null), new QuestionAnswer("port", [], "4200")]);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    const accepted = await turn.onRequest("7", "elicitation/create", JsonReader.fromValue(form));

    Assert.areEqual(JSON.stringify({ action: "accept", content: { name: "Atlas", size: "large", stack: "re", parts: ["a", "s"], tests: true, port: 4200 } }),
      JSON.stringify(accepted));
    Assert.areEqual("s:7", listener.questionAsks[0]?.providerRequestId);
    Assert.areEqual("elicitation/create", listener.questionAsks[0]?.nativeKind);
    Assert.areEqual(["name:Name:What should it be called?::false:true", "size:size:Set up the project.:small,large:false:false",
      "stack:stack:Set up the project.:Angular,React:false:false", "parts:parts:Set up the project.:Attachments,s:true:false",
      "tests:Tests:Set up the project.:Yes,No:false:false", "port:port:Set up the project.::false:true"].join("|"),
      listener.questionAsks[0]?.questions.map(t => [t.id, t.header, t.text, t.options.map(u => u.label).join(","), t.multiple, t.other].join(":")).join("|"));
    Assert.isFalse(listener.questionAsks[0]?.questions.some(t => t.secret) ?? true);
    Assert.areEqual("Signals,", listener.questionAsks[0]?.questions[2]?.options.map(t => t.description).join(","));
  }

  @TestMethod
  public async opensNoApprovalForAPlanWhoseCancelArrivesWhileItsPlanIsShown(): Promise<void> {
    const listener = new RecordingTurnListener();
    const plans: IAcpPlanReader = { methods: ["plan/review"], nativeKind: "plan/review", leavesPlan: true,
      read: () => new AcpPlan("Fix the bug", []), reply: (_params, approved) => ({ approved }) };
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null, plans);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;

    const review = turn.onRequest("7", "plan/review", JsonReader.fromValue({ sessionId: "s" }));
    await Wait.until(() => listener.details.length > 0, "The plan was not shown.");
    await turn.onNotificationAsync(Resources.acpCancelRequest, JsonReader.fromValue({ [Resources.acpRequestIdField]: "7" }));
    held.resolve();
    const answer = await review;

    Assert.areEqual(JSON.stringify({ approved: null }), JSON.stringify(answer));
    Assert.areEqual(0, listener.asks.length);
    listener.decisions.push(Resources.acpApprovePlanOption);
    Assert.areEqual(JSON.stringify({ approved: true }), JSON.stringify(await turn.onRequest("7", "plan/review", JsonReader.fromValue({ sessionId: "s" }))));
    Assert.areEqual(1, listener.asks.length);
  }

  @TestMethod
  public async leavesAnApprovedPlanTheAgentLeavesByItselfAtItsNextModeUpdateNotingAFailureButNotAClosedRun(): Promise<void> {
    const refused = new Error("Mode refused");
    const closed = new ClosedRunError("The message is not open.");
    const plans: IAcpPlanReader = { methods: ["plan/review"], nativeKind: "plan/review", leavesPlan: true,
      read: () => new AcpPlan("Fix the bug", []), reply: (_params, approved) => ({ approved }) };
    const modeUpdate = JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "current_mode_update", currentModeId: "default" } });
    const seen: string[] = [];
    for (const failure of [refused, closed]) {
      const listener = new RecordingTurnListener();
      listener.decisions.push(Resources.acpApprovePlanOption);
      const left: string[] = [];
      const leaving = Promise.withResolvers<void>();
      const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null, plans,
        t => {
          left.push(t);
          leaving.reject(failure);
          return leaving.promise;
        });
      await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

      const answer = await turn.onRequest("7", "plan/review", JsonReader.fromValue({ sessionId: "s" }));
      const beforeUpdate = left.length;
      await turn.onNotificationAsync(Resources.acpSessionUpdate, modeUpdate);
      await turn.onNotificationAsync(Resources.acpSessionUpdate, modeUpdate);
      await leaving.promise.catch(() => undefined);
      await new Promise<void>(resolve => setImmediate(resolve));

      seen.push([JSON.stringify(answer), beforeUpdate, left.join(","), listener.texts.filter(t => t.startsWith(Resources.formatChatModeKeptOut("Agent", ""))).join("|")].join(" "));
    }

    Assert.areEqual([`{"approved":true} 0 s ${Resources.formatChatModeKeptOut("Agent", "Mode refused")}`, "{\"approved\":true} 0 s "].join("\n"), seen.join("\n"));
  }

  @TestMethod
  public async letsAToolHookCallGoOnOnlyWhenItsChatIsntReadOnlyItPlansItIsMarkedReadOnlyOrItIsAListedReadOnlyTeamRunTool(): Promise<void> {
    const readOnly = await AcpTurnTests.gateAnswersAsync(true, false);
    const other = await AcpTurnTests.gateAnswersAsync(false, false);
    const planning = await AcpTurnTests.gateAnswersAsync(true, true);
    const unlisted = new AcpTurn("grok", "Grok", "Grok tool", new RecordingTurnListener(), new AbortController().signal, 1, undefined, null, undefined, undefined, undefined,
      null, null, undefined, [], undefined, () => Promise.reject(new Error("No list.")), false, false, null, true, new GrokToolGate());
    await unlisted.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    const unread = JSON.stringify(await unlisted.onRequest("9", "x.ai/hooks/run", AcpTurnTests.hookOf("use", "teamrun__list_chats")));

    const refused = (tool: string): string => JSON.stringify({ decision: "deny", reason: Resources.formatReadOnlyToolRefused("Grok", tool) });
    Assert.areEqual([["{}", refused("Tool write"), refused("Tool plain"), refused("Grok tool"), "{}", refused("Tool use"), refused("Grok tool"), refused("fetch"),
      refused("Grok tool"), refused("Grok tool"), "8"].join(" "), Array.from({ length: 10 }, () => "{}").concat("0").join(" "),
    Array.from({ length: 10 }, () => "{}").concat("0").join(" "), refused("list_chats")].join("\n"), [readOnly, other, planning, unread].join("\n"));
  }

  @TestMethod
  public async refusesAToolHookCallInAReadOnlyChatWhenItsRefusalCantBeNoted(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.refusedDetail = Resources.formatReadOnlyToolRefused("Grok", "Tool write");
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined,
      null, null, undefined, [], undefined, () => Promise.resolve([]), false, false, null, true, new GrokToolGate());
    await turn.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    await turn.onNotificationAsync(Resources.acpSessionUpdate, AcpTurnTests.toolCallOf("write", false));

    const answer = await turn.onRequest("9", "x.ai/hooks/run", AcpTurnTests.hookOf("write", "write"));

    Assert.areEqual(JSON.stringify({ decision: "deny", reason: Resources.formatReadOnlyToolRefused("Grok", "Grok tool") }), JSON.stringify(answer));
  }

  private static async gateAnswersAsync(readOnlyChat: boolean, planning: boolean): Promise<string> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null, null,
      undefined, [], undefined, () => Promise.resolve(["list_chats"]), false, planning, null, readOnlyChat, new GrokToolGate());
    await turn.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    for (const update of [AcpTurnTests.toolCallOf("read", true), AcpTurnTests.toolCallOf("write", false), AcpTurnTests.toolCallOf("plain", null),
      AcpTurnTests.toolCallOf("use", false)])
      await turn.onNotificationAsync(Resources.acpSessionUpdate, update);
    const asked = [AcpTurnTests.hookOf("read", "read_file"), AcpTurnTests.hookOf("write", "write"), AcpTurnTests.hookOf("plain", "plain"), AcpTurnTests.hookOf("never", "never"),
      AcpTurnTests.hookOf("use", "teamrun__list_chats"), AcpTurnTests.hookOf("use", "teamrun__send_message"), AcpTurnTests.hookOf("write", "write", "post_tool_use"),
      AcpTurnTests.hookOf("gone", "other__fetch"), AcpTurnTests.hookOf(" ", "write"), AcpTurnTests.hookOf("write", "write", "PreToolUse")];
    const answers: string[] = [];
    for (const params of asked)
      answers.push(JSON.stringify(await turn.onRequest("9", "x.ai/hooks/run", params)));
    const notes = ["Tool write", "Tool plain", "Grok tool", "Tool use", "fetch"].map(t => Resources.formatReadOnlyToolRefused("Grok", t));
    return [...answers, String(listener.texts.filter(t => notes.includes(t)).length)].join(" ");
  }

  private static hookOf(id: string, name: string, event: string = "pre_tool_use"): JsonReader {
    return JsonReader.fromValue({ hookCallbackId: "teamrun-read-only-chat", hookEventName: event, sessionId: "s", cwd: "/work", workspaceRoot: "/work", timestamp: "t",
      permissionMode: "default", toolName: name, toolUseId: id, toolInput: {}, toolInputTruncated: false });
  }

  private static toolCallOf(id: string, readOnly: boolean | null): JsonReader {
    return JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call", toolCallId: id, title: `Tool ${id}`, status: "pending",
      ...Object.isNull(readOnly) ? {} : { _meta: { "x.ai/tool": { name: id, read_only: readOnly } } } } });
  }

  @TestMethod
  public async cancelsAnElicitationWhoseCancelArrivesInTheSameChunk(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    input.on("finish", () => {
      output.end();
      errors.end();
      started.end(0, null);
    });
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), host.timings, host.timer);
    client.setListener({ onRequest: (id, method, params) => turn.onRequest(id, method, params), onNotificationAsync: (method, params) => turn.onNotificationAsync(method, params),
      onResponseAsync: () => Promise.resolve(), onExitAsync: () => Promise.resolve() });
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    const form = { sessionId: "s", mode: "form", message: "Pick a port.", requestedSchema: { type: "object", properties: { port: { type: "number" } } } };
    try {
      const answered = once(input, "data");
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "elicitation/create", params: form })}\n`
        + `${JSON.stringify({ jsonrpc: "2.0", method: "$/cancel_request", params: { requestId: 7 } })}\n`);
      const chunks: unknown[] = await answered;

      Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 7, result: { action: "cancel" } }), String(chunks[0]).trim());
      Assert.areEqual(0, listener.questionAsks.length);
    }
    finally {
      await client.stop();
    }
  }

  @TestMethod
  public async handsTheTurnEachNotificationOnceTheOneBeforeHasSettledAndAnswersThePromptAfterBoth(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    input.on("finish", () => {
      output.end();
      errors.end();
      started.end(0, null);
    });
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), host.timings, host.timer);
    client.setListener({ onRequest: (id, method, params) => turn.onRequest(id, method, params), onNotificationAsync: (method, params) => turn.onNotificationAsync(method, params),
      onResponseAsync: (method, result) => turn.onResponseAsync(method, result), onExitAsync: () => turn.onExitAsync() });
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;
    const tool = (toolCallId: string, title: string): string =>
      `${JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "s", update: { sessionUpdate: "tool_call", toolCallId, title, kind: "read" } } })}\n`;
    try {
      const asked = once(input, "data");
      const prompt = client.request("session/prompt", { sessionId: "s", prompt: [] }, null);
      await asked;
      output.write(`${tool("a", "First")}${tool("b", "Second")}${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { stopReason: "end_turn" } })}\n`);
      await Wait.until(() => listener.details.length > 0, "The first tool call was not shown.");
      const whileHeld = [listener.details.map(t => t.providerItemId), listener.finishedDetails.length];
      held.resolve();
      const answer = await prompt;

      Assert.areEqual(JSON.stringify([["agent-tool-a"], 0]), JSON.stringify(whileHeld));
      Assert.areEqual(JSON.stringify(["agent-tool-a", "agent-tool-b"]), JSON.stringify(listener.details.map(t => t.providerItemId)));
      Assert.areEqual(JSON.stringify(["agent-tool-a", "agent-tool-b"]), JSON.stringify(listener.finishedDetails.map(t => t.providerItemId)));
      Assert.areEqual(JSON.stringify({ stopReason: "end_turn" }), JSON.stringify(answer));
      Assert.isFalse(turn.isActive);
    }
    finally {
      await client.stop();
    }
  }

  @TestMethod
  public async cancelsAnElicitationStoppedOrCancelledWhileItWaitsAndDeclinesOneWithoutASession(): Promise<void> {
    const listener = new class extends RecordingTurnListener {
      public override onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
        this.questionAsks.push(ask);
        return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("Withdrawn")), { once: true }));
      }
    }();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const form = { sessionId: "s", mode: "form", message: "Pick a port.", requestedSchema: { type: "object", properties: { port: { type: "number" } } } };
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    const pending = turn.onRequest("7", "elicitation/create", JsonReader.fromValue(form));
    await turn.onNotificationAsync("$/cancel_request", JsonReader.fromValue({ requestId: 8 }));
    await turn.onNotificationAsync("$/cancel_request", JsonReader.fromValue({ requestId: 7 }));
    const cancelled = await pending;
    const unscoped = await turn.onRequest("9", "elicitation/create", JsonReader.fromValue({ mode: "form", message: "Pick a port.",
      requestedSchema: form.requestedSchema }));
    const failing = new RecordingTurnListener();
    failing.decisionFailure = new Error("Message m2 is not open.");
    const stopping = new AcpTurn("agent", "Agent", "Agent tool", failing, new AbortController().signal, 1);
    await stopping.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    const stopped = await stopping.onRequest("10", "elicitation/create", JsonReader.fromValue(form));

    Assert.areEqual("{\"action\":\"cancel\"}", JSON.stringify(cancelled));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(unscoped));
    Assert.areEqual("{\"action\":\"cancel\"}", JSON.stringify(stopped));
    Assert.areEqual(1, listener.questionAsks.length);
    Assert.areEqual(1, failing.questionAsks.length);
  }

  @TestMethod
  public async declinesASkippedUnreadableOrMisansweredElicitationAndCancelsAStaleOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, controller.signal, 1);
    const form = (sessionId: string = "s", properties: JsonObject = { port: { type: "number" } }, mode: string = "form"): JsonReader =>
      JsonReader.fromValue({ sessionId, mode, message: "Pick a port.", requestedSchema: { type: "object", properties } });
    const elicit = (params: JsonReader = form()): Promise<unknown> => turn.onRequest("id", "elicitation/create", params);
    Assert.areEqual("{\"action\":\"cancel\"}", JSON.stringify(await elicit()));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    Assert.areEqual("{\"action\":\"cancel\"}", JSON.stringify(await elicit(form("other"))));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit(form("s", {}))));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit(form("s", { port: { type: "number" } }, "url"))));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit(form("s", { size: { type: "string", enum: ["a", "a"] } }))));
    Assert.areEqual(0, listener.questionAsks.length);
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit()));
    listener.answers.push([new QuestionAnswer("port", [], "near 80")]);
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit()));
    listener.answers.push([new QuestionAnswer("port", [], "8.5")]);
    Assert.areEqual("{\"action\":\"accept\",\"content\":{\"port\":8.5}}", JSON.stringify(await elicit()));
    listener.answers.push([new QuestionAnswer("port", [], "80")]);
    const pending = elicit();
    await turn.finishAsync();
    controller.abort();
    Assert.areEqual("{\"action\":\"accept\",\"content\":{\"port\":80}}", JSON.stringify(await pending));
    Assert.areEqual("{\"action\":\"decline\"}", JSON.stringify(await elicit()));
    Assert.areEqual(5, listener.questionAsks.length);
  }

  @TestMethod
  public async marksTheStepOfAToolCallThePersonDeniedWhetherItWasShownBeforeOrAfter(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    const options = [{ optionId: "yes", name: "Allow", kind: "allow_once" }, { optionId: "no", name: "Deny", kind: "reject_once" }];
    const ask = (toolCall: JsonObject): Promise<unknown> => turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s", toolCall,
      options }));
    const denials = (id: string): string => listener.details.filter(t => t.providerItemId === `agent-tool-${id}`)
      .map(t => String(AcpTurnTests.payloadOf(t).toJson()["denied"] === true)).join(",");
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "tool_call", toolCallId: "shown", title: "rm -rf build", kind: "execute", status: "pending" });
    listener.decisions.push("no", "yes", "no", "no");

    await ask({ toolCallId: "shown" });
    await ask({ toolCallId: "allowed" });
    await ask({ toolCallId: "later" });
    await ask({});
    await update({ sessionUpdate: "tool_call_update", toolCallId: "shown", status: "failed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "allowed", title: "ls", kind: "execute", status: "completed" });
    await update({ sessionUpdate: "tool_call", toolCallId: "later", title: "rm a", kind: "execute", status: "failed" });

    Assert.areEqual("false,true,true", denials("shown"));
    Assert.areEqual("false", denials("allowed"));
    Assert.areEqual("true", denials("later"));
  }

  @TestMethod
  public async namesTheFilesAnExecuteCallsCommandWrites(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    const writes = (id: string): string => listener.details.filter(t => t.providerItemId === `agent-tool-${id}`).map(t => {
      const payload = AcpTurnTests.payloadOf(t).toJson();
      return `${JSON.stringify(payload["writes"] ?? null)}:${JSON.stringify(payload["unnamedWrites"] ?? null)}`;
    }).join(",");
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    await update({ sessionUpdate: "tool_call", toolCallId: "plain", title: "Run", kind: "execute", status: "pending", rawInput: { command: "echo hi > /tmp/a.txt" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "wrapped", title: "Run", kind: "execute", status: "pending",
      rawInput: { command: "bash -lc 'cd /tmp && make'" } });
    await update({ sessionUpdate: "tool_call", toolCallId: "none", title: "Run", kind: "execute", status: "pending" });
    await update({ sessionUpdate: "tool_call", toolCallId: "read", title: "Read", kind: "read", status: "pending", rawInput: { command: "echo hi > b.txt" } });

    Assert.areEqual("[\"/tmp/a.txt\"]:[]", writes("plain"));
    Assert.areEqual("[]:[\"/tmp\"]", writes("wrapped"));
    Assert.areEqual("null:null", writes("none"));
    Assert.areEqual("null:null", writes("read"));
  }

  @TestMethod
  public async namesTheSubAgentAnOpencodeTaskCardWouldStartAndKeepsTheTitleOtherwise(): Promise<void> {
    const summaryOf = async (kindId: string, rawInput: JsonValue): Promise<string> => {
      const listener = new RecordingTurnListener();
      const turn = new AcpTurn(kindId, "Agent", "Agent tool", listener, new AbortController().signal, 1);
      await turn.beginAsync("s", false, new ObservedSettings(kindId, null, null, null));
      await turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s",
        toolCall: { toolCallId: "t", title: "task", kind: "think", rawInput }, options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] }));
      const asked = listener.asks[0];
      if (Object.isUndefined(asked))
        throw new Error("The turn asked nothing.");
      return asked.summary;
    };

    Assert.areEqual("Start the sneak sub-agent: Run a command", await summaryOf("opencode", { description: "Run a command", subagent_type: "sneak" }));
    Assert.areEqual("Start the sneak sub-agent", await summaryOf("opencode", { subagent_type: "sneak" }));
    Assert.areEqual("Start the a b sub-agent: c d", await summaryOf("opencode", { description: "c\u0007d", subagent_type: "a\nb" }));
    Assert.areEqual("500,true", (s => `${String(s.length)},${String(s.endsWith("x…"))}`)(await summaryOf("opencode", { description: "x".repeat(600), subagent_type: "sneak" })));
    Assert.areEqual("task", await summaryOf("opencode", { description: "Run a command" }));
    Assert.areEqual("task", await summaryOf("opencode", { subagent_type: 7 }));
    Assert.areEqual("task", await summaryOf("agent", { description: "Run a command", subagent_type: "sneak" }));
  }

  @TestMethod
  public async summarizesAUseToolCallFromItsRawInputCappedAndCleanedAndFallsBackToTheTitle(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const ask = (rawInput: JsonValue): Promise<unknown> => turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s",
      toolCall: { toolCallId: "t", title: "use_tool", rawInput }, options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    await ask({ tool_name: "docs__search", tool_input_file: "/tmp/arguments.json" });
    await ask({ tool_name: "docs__search", tool_input: { query: "x" }, tool_input_file: "/tmp/arguments.json" });
    await ask({ tool_name: "docs__search", tool_input: { query: "x" } });
    await ask({ tool_name: "docs__search\u0007\u202e\u0085", tool_input_file: "/tmp/a\nb\u2066.json" });
    await ask({ tool_name: "docs__search", tool_input: { query: "x".repeat(600) } });
    await ask({ tool_name: `docs__${"s".repeat(600)}` });
    await ask({ tool_name: "docs__search", note: "not use_tool's" });
    await ask({ tool_name: 7 });
    await ask({ tool_name: "docs__search", tool_input_file: 3 });
    await ask(["docs__search"]);

    Assert.areEqual(["docs__search: arguments in /tmp/arguments.json", "docs__search: arguments in /tmp/arguments.json", "docs__search: {\"query\":\"x\"}",
      "docs__search   : arguments in /tmp/a b .json"].join("|"), listener.asks.slice(0, 4).map(t => t.summary).join("|"));
    Assert.areEqual("500…,500…", listener.asks.slice(4, 6).map(t => `${String(t.summary.length)}${t.summary.slice(-1)}`).join(","));
    Assert.isTrue(listener.asks[4]?.summary.startsWith("docs__search: {\"query\":\"xxx") ?? false);
    Assert.areEqual("use_tool,use_tool,use_tool,use_tool", listener.asks.slice(6).map(t => t.summary).join(","));
  }

  @TestMethod
  public async showsTheCommandAnExecuteRequestRunsBesideItsTitleCappedAndCleanedAndOnlyTheTitleWithoutOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("copilot", "Copilot", "Copilot tool", listener, new AbortController().signal, 1);
    const ask = (title: string, rawInput: JsonValue, kind: string = "execute"): Promise<unknown> => turn.onRequest("id", "session/request_permission",
      JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "toolu_1", title, kind, status: "pending", rawInput },
        options: [{ optionId: "allow_once", kind: "allow_once", name: "Allow once" }, { optionId: "allow_always", kind: "allow_always", name: "Always allow" },
          { optionId: "reject_once", kind: "reject_once", name: "Deny" }] }));
    await turn.beginAsync("s", false, new ObservedSettings("copilot", null, null, null));

    await ask("Run npm test", { command: "npm test 2>&1 | tail -30", commands: ["npm test 2>&1 | tail -30"] });
    await ask("Run tests", { command: "  npm test\n\u0007npm run lint\u202e  " });
    await ask("Run tests", { command: `npm test ${"x".repeat(600)}` });
    await ask("find . -name \"notes.txt\"", { CommandLine: "find . -name \"notes.txt\"", Cwd: "/work" });
    await ask("Execute `npm test`", { variant: "Bash", command: "npm test", description: "Run the tests", is_background: false });
    await ask("`npm test`", null);
    await ask("Run tests", {});
    await ask("Run tests", { command: 7 });
    await ask("Run tests", { command: "  " });
    await ask("Run tests", ["npm test"]);
    await ask("Read notes", { command: "npm test" }, "read");
    await ask("Clean the cache: rm -rf ~/.cache", { command: "rm -rf ~" });
    await ask("Remake the build", { command: "make" });
    await ask("Execute `rm -rf ~/.cache`", { variant: "Bash", command: "rm -rf ~" });
    await ask("npm test", { command: "npm test" });

    const summaries = listener.asks.map(t => t.summary);
    Assert.areEqual(["Run npm test: npm test 2>&1 | tail -30", "Run tests: npm test  npm run lint "].join("|"), summaries.slice(0, 2).join("|"));
    Assert.areEqual(JSON.stringify([500, true, true]), JSON.stringify(summaries.slice(2, 3).flatMap(t => [t.length, t.startsWith("Run tests: npm test xxx"), t.endsWith("x…")])));
    Assert.areEqual(["find . -name \"notes.txt\"", "Execute `npm test`", "`npm test`", "Run tests", "Run tests", "Run tests", "Run tests", "Read notes"].join("|"),
      summaries.slice(3, 11).join("|"));
    Assert.areEqual(["Clean the cache: rm -rf ~/.cache: rm -rf ~", "Remake the build: make", "Execute `rm -rf ~/.cache`: rm -rf ~", "npm test"].join("|"),
      summaries.slice(11).join("|"));
    Assert.areEqual("Command,Command,Command,Command,Command,Command,Command,Command,Command,Command,Tool,Command,Command,Command,Command", listener.asks.map(t => t.kind).join(","));
  }

  @TestMethod
  public async cleansAndCapsAnExecuteRequestsTitleThatIsItsOwnCommand(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1);
    const ask = (title: string, command: string): Promise<unknown> => turn.onRequest("id", "session/request_permission",
      JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "toolu_1", title, kind: "execute", status: "pending", rawInput: { command } },
        options: [{ optionId: "allow_once", kind: "allow_once", name: "Allow once" }, { optionId: "reject_once", kind: "reject_once", name: "Deny" }] }));
    await turn.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    const hidden = "rm -rf ~\u202e\u0008\u0008 ls";
    const long = `ls ${"x".repeat(600)}`;

    await ask(hidden, hidden);
    await ask(`Execute \`${hidden}\``, hidden);
    await ask(long, long);

    const summaries = listener.asks.map(t => t.summary);
    Assert.areEqual(["rm -rf ~    ls", "Execute `rm -rf ~    ls`"].join("|"), summaries.slice(0, 2).join("|"));
    Assert.areEqual(JSON.stringify([500, true, true]), JSON.stringify(summaries.slice(2).flatMap(t => [t.length, t.startsWith("ls xxx"), t.endsWith("x…")])));
  }

  @TestMethod
  public async cleansAndCapsTheTitleOfARequestThatHasNoCommand(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const ask = (title: string, kind: string, rawInput: JsonValue): Promise<unknown> => turn.onRequest("id", "session/request_permission",
      JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "toolu_1", title, kind, status: "pending", rawInput },
        options: [{ optionId: "allow_once", kind: "allow_once", name: "Allow once" }, { optionId: "reject_once", kind: "reject_once", name: "Deny" }] }));
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));

    await ask("Edit notes.md\u202e\u0008\u0008.exe", "edit", { path: "notes.md" });
    await ask("Run tests\u2066", "execute", {});
    await ask(`Edit ${"n".repeat(600)}`, "edit", {});

    const summaries = listener.asks.map(t => t.summary);
    Assert.areEqual(["Edit notes.md   .exe", "Run tests "].join("|"), summaries.slice(0, 2).join("|"));
    Assert.areEqual(JSON.stringify([500, true, true]), JSON.stringify(summaries.slice(2).flatMap(t => [t.length, t.startsWith("Edit nnn"), t.endsWith("n…")])));
  }

  @TestMethod
  public async cleansAndCapsTheToolsTitleInTheNoteOfARequestAReadOnlyChatRefusesOnceItsPlanIsApproved(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const plans: IAcpPlanReader = { methods: ["plan/review"], nativeKind: "plan/review", leavesPlan: false,
      read: () => new AcpPlan("Fix the bug", []), reply: (_params, approved) => ({ approved }) };
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null, plans,
      undefined, [], undefined, undefined, false, false, null, true);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await turn.onRequest("7", "plan/review", JsonReader.fromValue({ sessionId: "s" }));
    const ask = (title: string): Promise<unknown> => turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s",
      toolCall: { toolCallId: "toolu_1", title, kind: "edit", status: "pending", rawInput: {} },
      options: [{ optionId: "allow_once", kind: "allow_once", name: "Allow once" }, { optionId: "reject_once", kind: "reject_once", name: "Deny" }] }));

    await ask("Edit notes.md\u202e\u0008.exe");
    await ask(`Edit ${"n".repeat(600)}`);

    const notes = listener.texts.filter(t => t.startsWith("TeamRun refused"));
    Assert.areEqual(JSON.stringify([Resources.formatReadOnlyChatRefused("Agent", "Edit notes.md  .exe"),
      Resources.formatReadOnlyChatRefused("Agent", `Edit ${"n".repeat(494)}…`), 0]), JSON.stringify([...notes, listener.asks.length - 1]));
  }

  @TestMethod
  public async refusesWithoutAskingOnlyARoutedCallToATeamRunToolNotListedAsksForThePersonsToolsAndAllowsAnApprovedOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    let failing = false;
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, () => null, "use_tool",
      () => failing ? Promise.reject(new Error("Unavailable")) : Promise.resolve(["teamrun_open_panel"]));
    const allow: JsonObject = { optionId: "yes", name: "Allow", kind: "allow_once" };
    const deny: JsonObject = { optionId: "no", name: "Deny", kind: "reject_once" };
    const options = [allow, deny];
    const ask = async (toolCall: JsonObject, offered: JsonObject[] = options, asked: AcpTurn = turn): Promise<string> => {
      const answer = await asked.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s", toolCall, options: offered }));
      const outcome = JsonReader.fromValue(answer).readObject("outcome").toJson();
      return String(outcome["optionId"] ?? outcome["outcome"]);
    };
    await turn.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    listener.decisions.push(...Array<string>(12).fill("yes"), "no");

    const answers = [
      await ask({ toolCallId: "t1", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel", tool_input: { panel: "Teammates" } } }),
      await ask({ toolCallId: "t2", title: "Run", kind: "execute" }),
      await ask({ toolCallId: "t3", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_erase" } }),
      await ask({ toolCallId: "t4", title: "Search", rawInput: { tool_name: "docs__search\n" } }),
      await ask({ title: "use_tool" }),
      await ask({ toolCallId: "t6", title: "use_tool", rawInput: { tool_name: "docs__search" } }, [allow]),
      await ask({ toolCallId: "t7", title: "Use tool", rawInput: { file: "/tmp/call.json" } }),
      await ask({ toolCallId: "t8", title: "Use tool", rawInput: { tool_name: "docs__search", reason: "lookup" } }),
      await ask({ toolCallId: "t9", title: "Use tool", rawInput: { tool_name: "teamrun__teamrun_open_panel", reason: "show" } }),
      await ask({ toolCallId: "t10", title: "Use tool", rawInput: { tool_name: "teamrun__teamrun_open_panel", file: "/tmp/call.json" } }),
      await ask({ toolCallId: "t11", title: "Use tool", rawInput: { tool_name: 7 } }),
      await ask({ toolCallId: "t14", title: "use_tool", rawInput: { tool_name: "teamrun_open_panel", tool_input: { panel: "Members" } } }),
      await ask({ toolCallId: "t15", title: "use_tool", rawInput: { tool_name: "teamrun_erase" } })
    ];
    failing = true;
    answers.push(await ask({ toolCallId: "t12", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel" } }));
    const unlisted = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, () => null, "use_tool");
    await unlisted.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    answers.push(await ask({ toolCallId: "t13", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel" } }, options, unlisted));
    const approved = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, () => null, "use_tool",
      () => Promise.resolve(["teamrun_open_panel"]), () => null, () => null, null, null, () => Promise.resolve(), ["teamrun_open_panel", "teamrun_erase"]);
    await approved.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    answers.push(
      await ask({ toolCallId: "t16", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel" } }, options, approved),
      await ask({ toolCallId: "t17", title: "use_tool", rawInput: { tool_name: "teamrun_open_panel" } }, options, approved),
      await ask({ toolCallId: "t18", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel", file: "/tmp/call.json" } }, options, approved),
      await ask({ toolCallId: "t19", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_erase" } }, options, approved),
      await ask({ toolCallId: "t20", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel" } }, [deny], approved),
      await ask({ toolCallId: "t21", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_erase" } }, [allow], approved));

    Assert.areEqual("yes,yes,no,yes,yes,yes,yes,yes,yes,no,yes,yes,yes,no,no,yes,yes,no,no,no,cancelled", answers.join(","));
    Assert.areEqual(["teamrun__teamrun_open_panel: {\"panel\":\"Teammates\"}", "Run", "docs__search ", "use_tool", "docs__search", "Use tool", "Use tool", "Use tool",
      "Use tool", "teamrun_open_panel: {\"panel\":\"Members\"}", "teamrun_erase", "teamrun_open_panel", "teamrun__teamrun_open_panel"].join("|"),
      listener.asks.map(t => t.summary).join("|"));
    const refused = ["teamrun__teamrun_erase", "teamrun__teamrun_open_panel", "teamrun__teamrun_open_panel", "teamrun__teamrun_open_panel",
      "teamrun__teamrun_open_panel", "teamrun__teamrun_erase", "teamrun__teamrun_erase"];
    Assert.areEqual(refused.map(t => Resources.formatRoutedMcpToolRefused("Grok", t)).join("|"),
      listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async cancelsARoutedCallWhoseTurnStopsOrEndsWhileTeamRunsToolsAreListedOrHasEnded(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stop = new AbortController();
    let ended: AcpTurn | null = null;
    const stopped = new AcpTurn("grok", "Grok", "Grok tool", listener, stop.signal, 1, () => null, "use_tool", () => {
      stop.abort();
      return Promise.resolve(["teamrun_open_panel"]);
    });
    const ending = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, () => null, "use_tool", async () => {
      await ended?.finishAsync();
      return ["teamrun_open_panel"];
    });
    ended = ending;
    let listings = 0;
    const late = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, () => null, "use_tool", () => {
      listings++;
      return Promise.resolve(["teamrun_open_panel"]);
    });
    const request = JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "t", title: "use_tool", rawInput: { tool_name: "teamrun__teamrun_open_panel" } },
      options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] });
    await stopped.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    await ending.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    await late.beginAsync("s", false, new ObservedSettings("grok", null, null, null));
    await late.finishAsync();

    const answers = [await stopped.onRequest("id", "session/request_permission", request), await ending.onRequest("id", "session/request_permission", request),
      await late.onRequest("id", "session/request_permission", request)];

    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "cancelled" } }, { outcome: { outcome: "cancelled" } }, { outcome: { outcome: "cancelled" } }]), JSON.stringify(answers));
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(0, listings);
  }

  @TestMethod
  public async reportsASavedImageAndAnImageChunkAsGeneratedImagesAndKeepsAnyOtherToolsImageOnItsOwnRow(): Promise<void> {
    const listener = new RecordingTurnListener();
    const saved: ImageSaveCall[] = [];
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1, (tool, sessionId) => {
      saved.push(new ImageSaveCall(tool.toJson(), sessionId));
      return tool.readOptionalString("title") === "image_gen" ? new SavedImage("/home/u/1.jpg", "image/jpeg", "/9j/4A==") : null;
    });
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    const png = "iVBORw0KGgo=";
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Here" } });
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "image", data: png, mimeType: "image/png" } });
    await update({ sessionUpdate: "agent_message_chunk", content: { type: "image", data: "not an image" } });
    await update({ sessionUpdate: "agent_thought_chunk", content: { type: "image", data: png } });
    await update({ sessionUpdate: "tool_call", toolCallId: "g", title: "image_gen", status: "in_progress" });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "g", status: "completed" });
    const content = [{ type: "other" }, { type: "content" }, { type: "content", content: { type: "text", text: "x" } },
      { type: "content", content: { type: "image", data: "bad" } }, { type: "content", content: { type: "image", data: png } }];
    await update({ sessionUpdate: "tool_call", toolCallId: "c", title: "Draw", status: "completed", content });
    await update({ sessionUpdate: "tool_call", toolCallId: "n", title: "Draw", status: "completed", content: content.slice(0, 4) });
    await update({ sessionUpdate: "tool_call", toolCallId: "f", title: "Draw", status: "failed", content });
    await turn.finishAsync();

    Assert.areEqual(JSON.stringify(["agent-1", "agent-2", "agent-tool-g", "agent-tool-g", "agent-tool-c", "agent-tool-n", "agent-tool-f"]),
      JSON.stringify(listener.details.map(t => t.providerItemId)));
    const [text, chunk, pending, generated, drawn, plain, failed] = listener.details;
    Assert.areEqual("Here", text?.text);
    Assert.areEqual(DetailKind.Note, chunk?.kind);
    Assert.areEqual("Generated image: not saved", chunk?.text);
    Assert.areEqual(JSON.stringify({ itemType: "imageGeneration", status: "completed", savedPath: null, revisedPrompt: null, failure: null, imageData: png,
      mediaType: "image/png" }), JSON.stringify(chunk?.payload));
    Assert.areEqual("image_gen", pending?.text);
    Assert.areEqual("Generated image: /home/u/1.jpg", generated?.text);
    Assert.areEqual("/9j/4A==", AcpTurnTests.payloadOf(generated).toJson()["imageData"]);
    Assert.areEqual(JSON.stringify([DetailKind.Note, "Draw", png, "image/png", undefined]), JSON.stringify([drawn?.kind, drawn?.text,
      ...["imageData", "mediaType", "itemType"].map(t => AcpTurnTests.payloadOf(drawn).toJson()[t])]));
    Assert.areEqual("Draw", plain?.text);
    Assert.isFalse(AcpTurnTests.payloadOf(plain).hasField("imageData"));
    Assert.areEqual("Draw", failed?.text);
    Assert.isFalse(AcpTurnTests.payloadOf(failed).hasField("imageData"));
    Assert.areEqual(JSON.stringify(["g", "c", "n"]), JSON.stringify(saved.map(t => t.tool["toolCallId"])));
    Assert.isTrue(saved.every(t => t.sessionId === "s"));
  }

  @TestMethod
  public async readsTheImagesCursorNamesOnlyAtTheTurnsEndSoAFileStillBeingWrittenShowsWholeAndOneNeverReadableShowsAsFailed(): Promise<void> {
    const listener = new RecordingTurnListener();
    const files = new Map<string, string>([["/work/growing.png", "iVBORw0KGgo="]]);
    const asked: string[] = [];
    const turn = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1, (params, sessionId) => {
      const path = String(params.toJson()["filePath"]);
      asked.push(`${sessionId}:${path}`);
      const data = files.get(path);
      return data?.startsWith("iVBORw0KGgo") === true ? new SavedImage(path, "image/png", data) : null;
    });
    const notify = (filePath: string, sessionId: string = "s"): Promise<void> =>
      turn.onNotificationAsync("cursor/generate_image", JsonReader.fromValue({ sessionId, toolCallId: "g", description: "A flat icon", filePath }));
    await notify("/work/early.png");
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await notify("/work/growing.png");
    await notify("/work/later.png");
    await notify("/work/never.png");
    await notify("/work/other.png", "other");
    const askedBeforeTheEnd = asked.length;
    files.set("/work/growing.png", "iVBORw0KGgoAAAANSUhEUg==");
    files.set("/work/later.png", "iVBORw0KGgo=");
    await turn.finishAsync();
    await notify("/work/growing.png");

    Assert.areEqual(0, askedBeforeTheEnd);
    Assert.areEqual(JSON.stringify(["s:/work/growing.png", "s:/work/later.png", "s:/work/never.png"]), JSON.stringify(asked));
    Assert.areEqual(JSON.stringify(["cursor-1", "cursor-2", "cursor-3"]), JSON.stringify(listener.details.map(t => t.providerItemId)));
    const [growing, later, never] = listener.details;
    Assert.areEqual(JSON.stringify([DetailKind.Note, "Generated image: /work/growing.png"]), JSON.stringify([growing?.kind, growing?.text]));
    Assert.areEqual(JSON.stringify({ itemType: "imageGeneration", status: "completed", savedPath: "/work/growing.png", revisedPrompt: null, failure: null,
      imageData: "iVBORw0KGgoAAAANSUhEUg==", mediaType: "image/png" }), JSON.stringify(growing?.payload));
    Assert.areEqual("/work/later.png", AcpTurnTests.payloadOf(later).toJson()["savedPath"]);
    Assert.areEqual(Resources.formatGeneratedImage(null), never?.text);
    Assert.areEqual(JSON.stringify({ itemType: "imageGeneration", status: "failed", savedPath: null, revisedPrompt: null,
      failure: { message: Resources.formatUnreadImage("Cursor") }, imageData: null, mediaType: null }), JSON.stringify(never?.payload));
  }

  @TestMethod
  public async keepsNoBytesOrLongRawTextInAToolsDetailButItsDiffWholeAndItsImageForItsCompletion(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, new AbortController().signal, 1);
    const update = (value: JsonObject): Promise<void> => turn.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: value }));
    const image = `iVBORw0KGgo${"A".repeat(1024 * 1024)}`;
    const long = "x".repeat(10_000);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    await update({ sessionUpdate: "tool_call", toolCallId: "r", kind: "read", title: "Read", status: "in_progress",
      rawInput: { path: "a.png", lines: [long, 7, null, { text: long }], flag: true }, content: [
        { type: "content", content: { type: "image", data: image, mimeType: "image/png" } },
        { type: "content", content: { type: "audio", data: "UklGRg==", mimeType: "audio/wav" } },
        { type: "content", content: { type: "resource", resource: { uri: "file:///a.bin", mimeType: "application/octet-stream", blob: "AAAA" } } },
        { type: "content", content: { type: "resource", resource: { uri: "file:///a.txt", text: "kept" } } },
        { type: "content", content: { type: "image", uri: "file:///b.png" } },
        { type: "content" }
      ] });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "r", rawOutput: long });
    await update({ sessionUpdate: "tool_call", toolCallId: "p", title: "Plain", content: [7] });
    await update({ sessionUpdate: "tool_call", toolCallId: "q", title: "Plain", content: "text" });
    await update({ sessionUpdate: "tool_call", toolCallId: "e", kind: "edit", title: "Edit", status: "completed",
      content: [{ type: "diff", path: "D:/repo/a.cs", newText: long }], rawOutput: { text: long } });
    await update({ sessionUpdate: "tool_call_update", toolCallId: "r", status: "completed" });
    await turn.finishAsync();

    const read = AcpTurnTests.payloadOf(listener.details[0]);
    const output = AcpTurnTests.payloadOf(listener.details[1]);
    const plain = AcpTurnTests.payloadOf(listener.details[2]);
    const text = AcpTurnTests.payloadOf(listener.details[3]);
    const edit = AcpTurnTests.payloadOf(listener.details[4]);
    const completed = AcpTurnTests.payloadOf(listener.details[5]);
    const blocks = (payload: JsonReader): string => JSON.stringify(payload.readObjectArray(Resources.contentField).map(t => t.hasField("content") ? t.readValue("content") : null));
    Assert.areEqual(6, listener.details.length);
    Assert.areEqual(JSON.stringify([{ type: "image", mimeType: "image/png", size: Math.floor((11 + 1024 * 1024) * 3 / 4) },
      { type: "audio", mimeType: "audio/wav", size: 4 },
      { type: "resource", resource: { uri: "file:///a.bin", mimeType: "application/octet-stream", size: 3 } },
      { type: "resource", resource: { uri: "file:///a.txt", text: "kept" } }, { type: "image", uri: "file:///b.png" }, null]), blocks(read));
    Assert.areEqual(JSON.stringify({ path: "a.png", lines: ["x".repeat(6000), 7, null, { text: "x".repeat(6000) }], flag: true }),
      JSON.stringify(read.readValue("rawInput")));
    Assert.areEqual(blocks(read), blocks(output));
    Assert.areEqual(6000, output.readString("rawOutput").length);
    Assert.isTrue(JSON.stringify(output.toJson()).length < 25_000);
    Assert.areEqual("[7]", JSON.stringify(plain.readValue("content")));
    Assert.areEqual("text", text.readString("content"));
    Assert.areEqual(long, edit.readObjectArray("content")[0]?.readString("newText"));
    Assert.areEqual(`+${long}`, edit.readObjectArray("changes")[0]?.readString("diff"));
    Assert.areEqual(6000, edit.readObject("rawOutput").readString("text").length);
    Assert.isFalse(read.hasField("imageData") || output.hasField("imageData"));
    Assert.areEqual(JSON.stringify(["Read", "agent-tool-r", image, "image/png"]), JSON.stringify([listener.details.at(-1)?.text,
      listener.details.at(-1)?.providerItemId, completed.readValue("imageData"), completed.readValue("mediaType")]));
    Assert.areEqual(blocks(read), blocks(completed));
  }

  @TestMethod
  public async allowsOnceATeamRunToolTheAgentNamesThatIsReadOnlyAndAsksForEveryOtherCall(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "no";
    const turn = await AcpTurnTests.readOnlyTurnAsync(listener, new AbortController().signal, () => Promise.resolve(["teamrun_list_chats"]));

    const replies = [
      await AcpTurnTests.askReadOnly(turn, { server: "teamrun", tool: "teamrun_list_chats" }),
      await AcpTurnTests.askReadOnly(turn, { server: "teamrun", tool: "teamrun_check_provider" }),
      await AcpTurnTests.askReadOnly(turn, { server: "search", tool: "teamrun_list_chats" }),
      await AcpTurnTests.askReadOnly(turn, { title: "teamrun_list_chats" }),
      await AcpTurnTests.askReadOnly(turn, { server: "teamrun", tool: "teamrun_list_chats" }, [AcpTurnTests.readOnlyReject])
    ];

    Assert.areEqual(JSON.stringify(["yes", "no", "no", "no", "no"].map(t => AcpTurnTests.readOnlySelected(t))), JSON.stringify(replies));
    Assert.areEqual(4, listener.asks.length);
  }

  @TestMethod
  public async asksWhenTheListingOfTeamRunsToolsFailsOrTheTurnHasNone(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "no";
    const failing = await AcpTurnTests.readOnlyTurnAsync(listener, new AbortController().signal, () => Promise.reject(new Error("unlisted")));
    const unlisted = await AcpTurnTests.readOnlyTurnAsync(listener, new AbortController().signal);

    const replies = [await AcpTurnTests.askReadOnly(failing, { server: "teamrun", tool: "teamrun_list_chats" }),
      await AcpTurnTests.askReadOnly(unlisted, { server: "teamrun", tool: "teamrun_list_chats" })];

    Assert.areEqual(JSON.stringify([AcpTurnTests.readOnlySelected("no"), AcpTurnTests.readOnlySelected("no")]), JSON.stringify(replies));
    Assert.areEqual(2, listener.asks.length);
  }

  @TestMethod
  public async cancelsACallWhoseTurnWasStoppedOrEndedWhileItsToolsWereListed(): Promise<void> {
    const outcomes: JsonValue[] = [];
    const stops: ((turn: AcpTurn, controller: AbortController) => Promise<void>)[] = [(_turn, controller) => Promise.resolve(controller.abort()), turn => turn.finishAsync()];
    for (const stop of stops) {
      const listener = new RecordingTurnListener();
      const controller = new AbortController();
      const listed = Promise.withResolvers<readonly string[]>();
      const turn = await AcpTurnTests.readOnlyTurnAsync(listener, controller.signal, () => listed.promise);

      const asking = AcpTurnTests.askReadOnly(turn, { server: "teamrun", tool: "teamrun_list_chats" });
      await stop(turn, controller);
      listed.resolve(["teamrun_list_chats"]);
      outcomes.push(await asking);
      Assert.areEqual(0, listener.asks.length);
    }

    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "cancelled" } }, { outcome: { outcome: "cancelled" } }]), JSON.stringify(outcomes));
  }

  @TestMethod
  public async runsTheApprovedTeamRunToolItsRuleAllowsWithoutAskingAndAsksForTheOtherWithItsArguments(): Promise<void> {
    const listener = new RecordingTurnListener();

    const replies = await AcpTurnTests.playCopilotApprovals(listener);

    const ask = AcpTurnTests.copilotOnlyAsk(listener);
    const approved = AcpTurnTests.copilotToolCall(listener, "call-1");
    const other = AcpTurnTests.copilotToolCall(listener, "call-2");
    Assert.areEqual(JSON.stringify([AcpTurnTests.copilotSelected("reject_once")]), JSON.stringify(replies));
    Assert.areEqual(`capture_other ${ApprovalKind.Tool}`, `${ask.summary} ${ask.kind}`);
    Assert.areEqual(JSON.stringify({ note: "b" }), JSON.stringify(JsonReader.fromValue(ask.payload).readObject("toolCall").readObject("rawInput").toJson()));
    Assert.areEqual(JSON.stringify([DetailKind.Note, "completed", false]),
      JSON.stringify([approved.kind, approved.last.readString("status"), approved.last.hasField(Resources.deniedField)]));
    Assert.isTrue(other.last.readBoolean(Resources.deniedField));
  }

  @TestMethod
  public async servesEachTeamRunToolCallItsTitleNamesAsThatToolWithItsInput(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpTurnTests.playCopilotApprovals(listener);

    const named = ["call-1", "call-2"].map(t => AcpTurnTests.copilotToolCall(listener, t).last)
      .map(t => [t.readString(Resources.toolField), t.readValue(Resources.inputField), t.readString(ProtocolResources.servedToolField), t.readValue(ProtocolResources.servedInputField)]);
    Assert.areEqual(JSON.stringify([["mcp__teamrun__capture_approved", { note: "a" }, "capture_approved", { note: "a" }],
      ["mcp__teamrun__capture_other", { note: "b" }, "capture_other", { note: "b" }]]), JSON.stringify(named));
  }

  @TestMethod
  public async runsTheApprovedToolItsProfileRuleAllowsWithoutAskingAndAsksForTheOtherAndABareNameWithTheirArguments(): Promise<void> {
    const listener = new RecordingTurnListener();

    const replies = await AcpTurnTests.playGrokApprovals(listener);

    const approved = AcpTurnTests.grokLastOf(listener, "call-2");
    Assert.areEqual(JSON.stringify([AcpTurnTests.grokSelected("reject-once"), AcpTurnTests.grokSelected("reject-once")]), JSON.stringify(replies));
    Assert.areEqual("capture_approved: {\"note\":\"a\"}|teamrun__capture_other: {\"note\":\"b\"}", listener.asks.map(t => t.summary).join("|"));
    Assert.areEqual(JSON.stringify(["completed", false]), JSON.stringify([approved.readString("status"), approved.hasField(Resources.deniedField)]));
    Assert.isTrue(AcpTurnTests.grokLastOf(listener, "call-3").readBoolean(Resources.deniedField));
  }

  @TestMethod
  public async servesAToolCallItRoutesToATeamRunToolAsThatToolWithItsInputAndLeavesABareNameByItsKind(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpTurnTests.playGrokApprovals(listener);

    const named = ["call-1", "call-2", "call-3"].map(t => AcpTurnTests.grokLastOf(listener, t))
      .map(t => [t.readString(Resources.toolField), ...[Resources.inputField, ProtocolResources.servedToolField, ProtocolResources.servedInputField]
        .map(u => t.hasField(u) ? t.readValue(u) : null)]);
    Assert.areEqual(JSON.stringify([[Resources.acpOtherKind, null, null, null], ["mcp__teamrun__capture_approved", { note: "a" }, "capture_approved", { note: "a" }],
      ["mcp__teamrun__capture_other", { note: "b" }, "capture_other", { note: "b" }]]), JSON.stringify(named));
  }

  private static servedOf(kind: DetailKind, payload: JsonValue): readonly JsonValue[] {
    const read = JsonReader.fromValue(payload);
    const field = (name: string): JsonValue => read.hasField(name) ? read.readValue(name) : null;
    return [kind, read.readString(Resources.toolField), field(Resources.inputField), field(ProtocolResources.servedToolField), field(ProtocolResources.servedInputField),
      read.hasField(ProtocolResources.writesField)];
  }

  private static async readOnlyTurnAsync(listener: RecordingTurnListener, signal: AbortSignal, readOnlyTools?: () => Promise<readonly string[]>): Promise<AcpTurn> {
    const turn = new AcpTurn("agent", "Agent", "Agent tool", listener, signal, 1, undefined, null, undefined, undefined, undefined, null, null, undefined, [],
      tool => AcpMcpTool.of(tool.toJson()["server"], tool.toJson()["tool"]), readOnlyTools);
    await turn.beginAsync("s", false, new ObservedSettings("agent", null, null, null));
    return turn;
  }

  private static async askReadOnly(turn: AcpTurn, toolCall: JsonObject, options: JsonObject[] = [AcpTurnTests.readOnlyAllow, AcpTurnTests.readOnlyReject]):
    Promise<JsonValue> {
    return turn.onRequest("id", "session/request_permission", JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "t", ...toolCall }, options }));
  }

  private static readOnlySelected(optionId: string): JsonObject {
    return { outcome: { outcome: "selected", optionId } };
  }

  private static copilotSelected(optionId: string): JsonObject {
    return { outcome: { outcome: "selected", optionId } };
  }

  private static copilotOnlyAsk(listener: RecordingTurnListener): ApprovalAsk {
    const [ask, ...more] = listener.asks;
    if (Object.isUndefined(ask) || more.length > 0)
      throw new Error(`The turn asked ${listener.asks.length} times, not once.`);
    return ask;
  }

  private static copilotToolCall(listener: RecordingTurnListener, id: string): ShownToolCall {
    const details = listener.details.filter(t => t.providerItemId === `copilot-tool-${id}`);
    const first = details.at(0);
    const last = details.at(-1);
    if (Object.isUndefined(first) || Object.isUndefined(last))
      throw new Error(`The turn showed no tool call ${id}.`);
    return new ShownToolCall(first.kind, JsonReader.fromValue(last.payload));
  }

  private static payloadOf(detail: TurnDetail | undefined): JsonReader {
    if (Object.isUndefined(detail))
      throw new Error("The turn showed no such detail.");
    return JsonReader.fromValue(detail.payload);
  }

  private static async playCopilotApprovals(listener: RecordingTurnListener): Promise<JsonValue[]> {
    const turn = new AcpTurn("copilot", "Copilot", "Copilot tool", listener, new AbortController().signal, 1);
    await turn.beginAsync("copilot-session", false, new ObservedSettings("copilot", null, null, null));
    listener.defaultDecision = "reject_once";
    const replies: JsonValue[] = [];
    for (const message of CopilotApprovedToolRecording.messages.map(t => JsonReader.fromValue(t))) {
      const method = message.readNonBlankString("method");
      const params = JsonReader.fromValue({ [Resources.sessionIdField]: "copilot-session", ...message.readObject("params").toJson() });
      if (message.hasField("id"))
        replies.push(await turn.onRequest(message.readNonBlankString("id"), method, params));
      else
        await turn.onNotificationAsync(method, params);
    }
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    return replies;
  }

  private static grokSelected(optionId: string): JsonObject {
    return { outcome: { outcome: "selected", optionId } };
  }

  private static grokLastOf(listener: RecordingTurnListener, id: string): JsonReader {
    const last = listener.details.filter(t => t.providerItemId === `grok-tool-${id}`).at(-1);
    if (Object.isUndefined(last))
      throw new Error(`The turn showed no tool call ${id}.`);
    return JsonReader.fromValue(last.payload);
  }

  private static async playGrokApprovals(listener: RecordingTurnListener): Promise<JsonValue[]> {
    const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, undefined, Resources.grokRoutedMcpTool,
      () => Promise.resolve(["capture_approved", "capture_other"]));
    await turn.beginAsync("grok-session", false, new ObservedSettings("grok", null, null, null));
    listener.defaultDecision = "reject-once";
    const replies: JsonValue[] = [];
    for (const message of GrokApprovedToolRecording.messages.map(t => JsonReader.fromValue(t))) {
      const method = message.readNonBlankString("method");
      const params = JsonReader.fromValue({ [Resources.sessionIdField]: "grok-session", ...message.readObject("params").toJson() });
      if (message.hasField("id"))
        replies.push(await turn.onRequest(message.readNonBlankString("id"), method, params));
      else
        await turn.onNotificationAsync(method, params);
    }
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    return replies;
  }
}
