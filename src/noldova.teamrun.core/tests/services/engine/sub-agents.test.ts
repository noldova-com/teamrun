/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalAsk, ApprovalNotDeniableException, type ITurnListener, QuestionAsk, Resources, SharedMcpFailure, SharedMcpFailureKind, TaskEnd, TaskStart, TurnDetail, TurnOutcome, TurnWake }
  from "@noldova/teamrun.core";
import {
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  BackgroundTaskIdParams,
  BackgroundTaskStatus,
  CommandStartParams,
  type Conversation,
  ConversationIdParams,
  DetailKind,
  ErrorCode,
  Harness,
  type Message,
  MessageIdParams,
  MessageSendParams,
  QuestionAnswer,
  QuestionOption,
  ReplyUsage,
  RequestedSettings,
  SenderEnvironment,
  SharedMcpProviderSetParams,
  SharedMcpServerDefinition,
  SharedMcpTransport,
  SubAgent,
  SubAgentStartParams,
  SubAgentStatus,
  SubAgentStopParams,
  SubAgentWaitParams,
  type SubAgentWaitResult,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class SubAgentsTests {
  private static readonly allow: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);

  @TestMethod
  public async runsAHelperOnTheTurnsProviderAndModelUnderARowInItsReplyGivesItsLastMessageToTheWaitAndNeverWakesTheReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    host.adapter.turnTexts = [["Asked"], ["Looking", "All 12 pass."]];
    const results: [SubAgent, SubAgentWaitResult][] = [];
    const wakes: unknown[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token)) {
        const listener = host.adapter.lastListener;
        Assert.isNotNull(listener);
        listener.onThinking();
        await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "npm test", null, "cmd-1"));
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, "12 passed", null, "out-1", "cmd-1"));
        await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "npm test", { exitCode: 0 }, "cmd-1"));
        await listener.onDetailAsync(new TurnDetail(DetailKind.FileChange, "Wrote a.txt", null, null));
        await listener.onUsageAsync(new ReplyUsage(100, null, null, null));
        await listener.onUsageAsync(new ReplyUsage(null, 40, null, null));
        await listener.onPlanUsageAsync([], "2026-10-29T18:00:00.000Z");
        wakes.push(await listener.onWakeAsync(new TurnWake("task-1", "npm start")));
        await listener.onSharedServerFailedAsync(new SharedMcpFailure("p-fake", "Work", "docs", SharedMcpFailureKind.Connection));
        return;
      }
      const started = await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      results.push([started, await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50))]);
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation, "fake-small");
    await host.engine.waitForIdle();

    const [result] = results;
    const child = host.adapter.requests[1];
    const stored = await host.messages.findAsync(reply.id);
    Assert.isDefined(result);
    Assert.isDefined(child);
    Assert.isNotNull(stored);
    const [started, waited] = result;
    const row = stored.details.find(t => t.kind === DetailKind.SubAgent);
    Assert.isDefined(row);
    const under = stored.details.filter(t => t.parentSequence === row.sequence);
    const command = under.find(t => t.kind === DetailKind.Command);
    const [ended] = waited.ended;
    const [usage] = host.planUsage.list();
    Assert.isDefined(command);
    Assert.isDefined(ended);
    Assert.isDefined(usage);
    Assert.areEqual(JSON.stringify([Resources.helperType, "Check the tests", "fake-small", SubAgentStatus.Running, true, true, true]),
      JSON.stringify([started.type, started.description, started.model, started.status, started.isBackground, started.isTeamRun, SubAgent.fromJson(row.payload).isTeamRun]));
    Assert.areEqual(JSON.stringify([[[started.toolUseId, SubAgentStatus.Completed, "fake-large", 1, 40, "All 12 pass."]], []]), JSON.stringify([
      waited.ended.map(t => [t.toolUseId, t.status, t.model, t.toolUses, t.tokens, t.summary]), waited.running]));
    Assert.areEqual(JSON.stringify(ended.toJson()), JSON.stringify(row.payload));
    Assert.areEqual(JSON.stringify(["Note Looking", "Note All 12 pass.", "Command npm test", "FileChange Wrote a.txt"]),
      JSON.stringify(under.map(t => `${t.kind} ${t.text}`)));
    Assert.areEqual("12 passed", stored.details.filter(t => t.parentSequence === command.sequence).map(t => t.text).join());
    const failed = Resources.formatSharedMcpServerFailed(new SharedMcpFailure("p-fake", "Work", "docs", SharedMcpFailureKind.Connection));
    Assert.areEqual(JSON.stringify([[failed, null]]),
      JSON.stringify(stored.details.filter(t => t.text.includes("shared MCP server docs")).map(t => [t.text, t.parentSequence])));
    Assert.areEqual(JSON.stringify(["Run the tests.", Resources.subAgentInstructions, {}, null, null, "fake-small", project.rootPath]),
      JSON.stringify([child.prompt, child.instructions, child.environment, child.tools, child.resumeNativeSessionId, child.requested.model,
        child.workingDirectory]));
    Assert.areEqual(JSON.stringify([[started.toolUseId, "Check the tests", BackgroundTaskStatus.Completed]]),
      JSON.stringify((await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => [t.subAgentId, t.command, t.status])));
    Assert.areEqual("2026-10-29T18:00:00.000Z", usage.readAt);
    Assert.areEqual("[null]", JSON.stringify(wakes));
  }

  @TestMethod
  public async asksTheHelpersApprovalsAndQuestionsInTheParentsReplyNamingItsRow(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const question = new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window")], false, false, false);
    const chosen = new QuestionAnswer("platform", ["Desktop app"], null);
    const answers: (string | readonly QuestionAnswer[] | null)[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token)) {
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
        await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50));
        return;
      }
      const listener = host.adapter.lastListener;
      Assert.isNotNull(listener);
      await listener.onQuestionsPostedAsync(new QuestionAsk("item-1", "request_user_input_async", [question]));
      answers.push(...await Promise.all([
        listener.onApprovalRequested(new ApprovalAsk("req-1", ApprovalKind.Command, "exec", "Run npm test", { command: "npm test" }, [SubAgentsTests.allow])),
        listener.onApprovalRequested(new ApprovalAsk("req-2", ApprovalKind.Command, "exec", "Run ls", null, [SubAgentsTests.allow])),
        listener.onQuestionsAsked(new QuestionAsk("req-3", "AskUserQuestion", [question])),
        listener.onQuestionsAsked(new QuestionAsk("req-4", "AskUserQuestion", [question], "Inner"))
      ]));
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation);
    await host.until("four approvals", async () => (await host.approvals.listPendingAsync(reply.id)).length === 4, host.runs());
    const pending = await host.approvals.listPendingAsync(reply.id);
    for (const approval of pending)
      await host.engine.decideAsync(approval.kind === ApprovalKind.Question ? new ApprovalDecideParams(approval.id, Resources.answerOptionId, [chosen])
        : new ApprovalDecideParams(approval.id, SubAgentsTests.allow.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([{ subAgent: "Check the tests", command: "npm test" }, null, { subAgent: "Check the tests" }, { subAgent: "Inner" }]
      .map(t => JSON.stringify(t)).sort()), JSON.stringify(pending.map(t => JSON.stringify(t.payload)).sort()));
    Assert.areEqual(JSON.stringify(["accept", "accept", [chosen.toJson()], [chosen.toJson()]]),
      JSON.stringify(answers.map(t => Object.isString(t) || Object.isNull(t) ? t : t.map(u => u.toJson()))));
  }

  @TestMethod
  public async stopsAHelperThroughTheStopToolAndAnswersAStopOfAnEndedOneAsItEnded(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const stops: SubAgent[] = [];
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return SubAgentsTests.abortOf(signal);
      const id = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."))).toolUseId;
      Assert.isNotNull(id);
      await host.adapter.requested(2);
      stops.push(await host.engine.stopSubAgent(new SubAgentStopParams(token, id)));
      stops.push(await host.engine.stopSubAgent(new SubAgentStopParams(token, id)));
      return undefined;
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, SubAgentStatus.Stopped]), JSON.stringify(stops.map(t => t.status)));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped]),
      JSON.stringify((await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status)));
    Assert.areEqual(SubAgentStatus.Stopped, (await SubAgentsTests.rowOfAsync(host, reply)).status);
  }

  @TestMethod
  public async keepsAHelperRunningPastItsParentsTurnWithItsNestedRowsAndTasksAndStopsItFromTheCard(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const listeners: ITurnListener[] = [];
    host.adapter.outcomeOnAbort = TurnOutcome.Completed;
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token)) {
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
        return undefined;
      }
      const listener = host.adapter.lastListener;
      Assert.isNotNull(listener);
      listeners.push(listener);
      return SubAgentsTests.abortOf(signal);
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();
    await host.until("the held helper turn", () => listeners.length === 1, host.runs());
    const [listener] = listeners;
    Assert.isDefined(listener);
    await listener.onDetailAsync(new TurnDetail(DetailKind.SubAgent, "Inner", new SubAgent("inner", null, "Inner", null, SubAgentStatus.Running, false).toJson(), "inner"));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, "Inside", null, null, "inner"));
    await listener.onTaskStartedAsync(new TaskStart("task-1", "npm run dev", () => Promise.resolve()));
    listener.onTaskOutput("task-1", "ready");
    await listener.onTaskEndedAsync(new TaskEnd("task-1", BackgroundTaskStatus.Ended, 0));
    await listener.onTaskStartedAsync(new TaskStart("task-2", "Inner", () => Promise.resolve(), "inner"));
    await listener.onTaskEndedAsync(new TaskEnd("task-2", BackgroundTaskStatus.Ended));
    const tasksAsync = (): ReturnType<CoreHost["tasks"]["listAsync"]> => host.tasks.listAsync(new ConversationIdParams(conversation.id));
    const helper = (await tasksAsync()).find(t => t.command === "Check the tests");
    Assert.isDefined(helper);
    await host.tasks.stop(new BackgroundTaskIdParams(helper.id));

    const stored = await host.messages.findAsync(reply.id);
    Assert.isNotNull(stored);
    const row = stored.details.find(t => t.kind === DetailKind.SubAgent && t.text === "Check the tests");
    const inner = stored.details.find(t => t.text === "Inner");
    const inside = stored.details.find(t => t.text === "Inside");
    Assert.isDefined(row);
    Assert.isDefined(inner);
    Assert.isDefined(inside);
    const statusOfAsync = async (command: string): Promise<string> => {
      const task = (await tasksAsync()).find(t => t.command === command);
      Assert.isDefined(task);
      return `${task.subAgentId} ${task.status} ${(await host.tasks.readAsync(new BackgroundTaskIdParams(task.id))).output}`;
    };
    Assert.isNotNull(stored.endedAt);
    Assert.areEqual(row.sequence, inner.parentSequence);
    Assert.areEqual(inner.sequence, inside.parentSequence);
    Assert.areEqual(SubAgentStatus.Stopped, SubAgent.fromJson(row.payload).status);
    Assert.areEqual(JSON.stringify(["null Ended ready", `${helper.subAgentId}${Resources.subAgentItemSeparator}inner Ended `, `${helper.subAgentId} Stopped `]),
      JSON.stringify(await Promise.all(["npm run dev", "Inner", "Check the tests"].map(statusOfAsync))));
    await host.until("the undeliverable wake", async () => (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes"))).map(t => t.readString("state")).join() === "Undeliverable", host.runs());
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async stopsAHelperWithItsParentsStopDuringTheTurnAfterItAndAtShutdown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    let holdsParent = true;
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return SubAgentsTests.abortOf(signal);
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      return holdsParent ? SubAgentsTests.abortOf(signal) : undefined;
    };

    const during = await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(2);
    await host.engine.cancelAsync(new MessageIdParams(during.id));
    await host.until("the stopped sub-agent", async () => (await SubAgentsTests.rowOfAsync(host, during)).status === SubAgentStatus.Stopped, host.runs());
    holdsParent = false;
    const after = await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(4);
    await host.engine.waitForIdle();
    await host.engine.cancelAsync(new MessageIdParams(after.id));
    const afterStatus = (await SubAgentsTests.rowOfAsync(host, after)).status;
    const last = await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(6);
    await host.engine.waitForIdle();
    await host.engine.shutdown();

    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, SubAgentStatus.Stopped]), JSON.stringify([afterStatus, (await SubAgentsTests.rowOfAsync(host, last)).status]));
  }

  @TestMethod
  public async settlesAHelperWhoseEndRowFailsToWriteSoItsParentsStopAndShutdownReturnAndItsTaskEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const update = host.messages.updateAsync.bind(host.messages);
    let failures = 0;
    host.messages.updateAsync = async (message, transaction) => {
      if (failures > 0 && message.details.some(t => t.kind === DetailKind.SubAgent && SubAgent.fromJson(t.payload).status !== SubAgentStatus.Running)) {
        failures -= 1;
        throw new Error("The disk is full.");
      }
      await update(message, transaction);
    };
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token))
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      return SubAgentsTests.abortOf(signal);
    };
    const statusesAsync = async (conversation: Conversation): Promise<readonly BackgroundTaskStatus[]> =>
      (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status);

    const stopped = await host.createConversationAsync();
    const reply = await SubAgentsTests.sendAsync(host, stopped);
    await host.adapter.requested(2);
    failures = 1;
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    const left = failures;
    const shut = await host.createConversationAsync();
    await SubAgentsTests.sendAsync(host, shut);
    await host.adapter.requested(4);
    failures = 1;
    await host.engine.shutdown();

    Assert.areEqual(JSON.stringify([0, 0, [BackgroundTaskStatus.Stopped], [BackgroundTaskStatus.Stopped]]),
      JSON.stringify([left, failures, await statusesAsync(stopped), await statusesAsync(shut)]));
  }

  @TestMethod
  public async endsACompletedHelperWhoseEndRowFailsToWriteAsCompletedWritingNoFailedRowAfter(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const update = host.messages.updateAsync.bind(host.messages);
    const ends: SubAgentStatus[] = [];
    host.messages.updateAsync = async (message, transaction) => {
      const row = message.details.find(t => t.kind === DetailKind.SubAgent);
      const status = Object.isUndefined(row) ? SubAgentStatus.Running : SubAgent.fromJson(row.payload).status;
      if (status !== SubAgentStatus.Running) {
        ends.push(status);
        if (ends.length === 1)
          throw new Error("The disk is full.");
      }
      await update(message, transaction);
    };
    const waits: SubAgentWaitResult[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50)));
    };

    await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([[SubAgentStatus.Completed], [[SubAgentStatus.Completed]], [BackgroundTaskStatus.Completed]]), JSON.stringify([[...new Set(ends)],
      waits.map(t => t.ended.map(u => u.status)), (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status)]));
  }

  @TestMethod
  public async logsAHelperWhoseEndRowFailsToWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const failure = new Error("The disk is full.");
    const update = host.messages.updateAsync.bind(host.messages);
    let failures = 1;
    host.messages.updateAsync = async (message, transaction) => {
      if (failures > 0 && message.details.some(t => t.kind === DetailKind.SubAgent && SubAgent.fromJson(t.payload).status !== SubAgentStatus.Running)) {
        failures -= 1;
        throw failure;
      }
      await update(message, transaction);
    };
    const ids: (string | null)[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      ids.push((await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."))).toolUseId);
      await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50));
    };

    await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();
    const [id] = ids;
    Assert.isDefined(id);
    Assert.isNotNull(id);
    const line = Resources.formatSubAgentNotSaved(id, Resources.formatFailureKind(failure));
    await host.until("the logged end", () => host.log.lines.includes(line));

    Assert.areEqual(JSON.stringify([0, [line]]), JSON.stringify([failures, host.log.lines.filter(t => t.includes(id))]));
  }

  @TestMethod
  public async logsAQueuedHelperWhoseStopFailsAtItsParentsStopAndAtShutdownAndStillStopsTheCommandsAfterIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const failure = new Error("The disk is full.");
    const update = host.messages.updateAsync.bind(host.messages);
    const failed = new Set<string>();
    host.messages.updateAsync = async (message, transaction) => {
      if (!failed.has(message.id)
        && message.details.some(t => t.kind === DetailKind.SubAgent && t.text === "Queued" && SubAgent.fromJson(t.payload).status !== SubAgentStatus.Running)) {
        failed.add(message.id);
        throw failure;
      }
      await update(message, transaction);
    };
    const queued: string[] = [];
    let holdsParent = true;
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return SubAgentsTests.abortOf(signal);
      await host.engine.startCommandAsync(new CommandStartParams(token, "npm start", "Serve"));
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Running", "Running."));
      const id = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Queued", "Queued."))).toolUseId;
      Assert.isNotNull(id);
      queued.push(id);
      return holdsParent ? SubAgentsTests.abortOf(signal) : undefined;
    };
    const lineOf = (id: string | undefined): string => Resources.formatSubAgentNotStopped(id ?? String.empty, Resources.formatFailureKind(failure));

    const reply = await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(2);
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.until("the logged stop", () => host.log.lines.includes(lineOf(queued[0])));
    holdsParent = false;
    await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(4);
    await host.engine.waitForIdle();
    await host.engine.shutdown();

    Assert.areEqual(JSON.stringify([[lineOf(queued[0])], [lineOf(queued[1])], [1, 1]]), JSON.stringify([host.log.lines.filter(t => t.includes(queued[0] ?? "-")),
      host.log.lines.filter(t => t.includes(queued[1] ?? "-")), host.commands.started.map(t => t.stops)]));
  }

  @TestMethod
  public async endsTheTaskOfAHelperStoppedWhileItsRowIsStillBeingWrittenOnlyAfterItsStart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const update = host.messages.updateAsync.bind(host.messages);
    const startTask = host.tasks.startAsync.bind(host.tasks);
    const endTask = host.tasks.endAsync.bind(host.tasks);
    const reached = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const ended = Promise.withResolvers<void>();
    const calls: string[] = [];
    const starts: Promise<SubAgent>[] = [];
    let armed = false;
    host.messages.updateAsync = async (message, transaction) => {
      if (armed && message.details.some(t => t.kind === DetailKind.SubAgent)) {
        armed = false;
        reached.resolve();
        await released.promise;
      }
      await update(message, transaction);
    };
    host.tasks.startAsync = (conversationId, messageId, kind, start, teammateId) => {
      calls.push("start");
      return startTask(conversationId, messageId, kind, start, teammateId);
    };
    host.tasks.endAsync = (messageId, end) => {
      calls.push("end");
      ended.resolve();
      return endTask(messageId, end);
    };
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      armed = true;
      starts.push(host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests.")));
      await SubAgentsTests.abortOf(signal);
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation);
    await reached.promise;
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    released.resolve();
    await Promise.all(starts);
    await ended.promise;

    Assert.areEqual("start,end", calls.join());
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped]),
      JSON.stringify((await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status)));
    Assert.areEqual(SubAgentStatus.Stopped, (await SubAgentsTests.rowOfAsync(host, reply)).status);
  }

  @TestMethod
  public async refusesAHelperAskedForAfterItsRepliesStop(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const refusals: string[] = [];
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      await SubAgentsTests.abortOf(signal);
      refusals.push((await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Late", "Late.")), ServiceException)).info.name);
    };

    const reply = await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.adapter.requested(1);
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([ErrorCode.Unauthorized]), JSON.stringify(refusals));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesAHelperWhoseRepliesStopWhileItIsPrepared(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const refusals: ServiceException[] = [];
    const stops: Promise<readonly Message[]>[] = [];
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      host.conversations.findAsync = async (id, transaction) => {
        if (stops.length === 0)
          stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
        return findAsync(id, transaction);
      };
      refusals.push(await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Late", "Late.")), ServiceException));
      host.conversations.findAsync = findAsync;
    };

    const reply = await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();
    await Promise.all(stops);

    Assert.areEqual(JSON.stringify([[ErrorCode.Unauthorized, Resources.senderTurnEnded]]), JSON.stringify(refusals.map(t => [t.info.name, t.message])));
    Assert.areEqual(1, stops.length);
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(0, (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).length);
    Assert.areEqual(String.empty, (await host.messages.findAsync(reply.id))?.details.filter(t => t.kind === DetailKind.SubAgent).map(t => t.text).join() ?? null);
  }

  @TestMethod
  public async marksAHelperFailedWithItsReasonStoppedWhenItEndsInterruptedOrStoppedAndCutsALongResult(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const waits: SubAgentWaitResult[] = [];
    host.adapter.turnTexts = [[], [], [], ["x".repeat(Resources.subAgentResultLimit + 5)], [], [], []];
    host.adapter.holdTurn = async (request, signal) => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token)) {
        if (request.prompt !== "Throw once stopped.")
          return;
        await SubAgentsTests.abortOf(signal);
        throw new Error("Killed");
      }
      const runAsync = async (brief: string): Promise<void> => {
        const id = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", brief, brief))).toolUseId;
        Assert.isNotNull(id);
        if (brief === "Throw once stopped.") {
          await host.adapter.requested(7);
          await host.engine.stopSubAgent(new SubAgentStopParams(token, id));
        }
        await host.engine.waitSubAgents(new SubAgentWaitParams(token, [id], 50));
      };
      host.adapter.outcome = TurnOutcome.Failed;
      host.adapter.error = "Tests broke";
      await runAsync("Fail with a result.");
      host.adapter.outcome = TurnOutcome.Interrupted;
      host.adapter.error = null;
      await runAsync("End interrupted.");
      host.adapter.outcome = TurnOutcome.Completed;
      await runAsync("Say a lot.");
      host.adapter.failWith = new Error("No session");
      await runAsync("Throw before working.");
      host.adapter.failWith = "Lost";
      await runAsync("Throw a string.");
      host.adapter.failWith = null;
      await runAsync("Throw once stopped.");
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 0)));
    };

    await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();

    const [waited] = waits;
    Assert.isDefined(waited);
    Assert.areEqual(JSON.stringify([
      ["Fail with a result.", SubAgentStatus.Failed, "Tests broke"], ["End interrupted.", SubAgentStatus.Stopped, null],
      ["Say a lot.", SubAgentStatus.Completed, `${"x".repeat(Resources.subAgentResultLimit)}${Resources.formatSubAgentResultCut(5)}`],
      ["Throw before working.", SubAgentStatus.Failed, "No session"], ["Throw a string.", SubAgentStatus.Failed, "Lost"],
      ["Throw once stopped.", SubAgentStatus.Stopped, "Killed"]
    ]), JSON.stringify(waited.ended.map(t => [t.description, t.status, t.summary])));
    const listed = await host.tasks.listAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Failed, BackgroundTaskStatus.Stopped, BackgroundTaskStatus.Completed]),
      JSON.stringify(["Fail with a result.", "End interrupted.", "Say a lot."].map(t => listed.find(u => u.command === t)?.status ?? null)));
  }

  @TestMethod
  public async waitsForTheNamedHelpersOnlyUntilItsTimeAndRefusesAnEndedTurnAnotherAgentAFifthHelperAndAnotherRepliesHelper(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const tokens: string[] = [];
    const ids: string[] = [];
    const refusals: string[] = [];
    const waits: SubAgentWaitResult[] = [];
    const unavailable: ServiceException[] = [];
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return held.promise;
      tokens.push(token);
      if (tokens.length === 2)
        return held.promise;
      for (const description of ["Helper 1", "Helper 2", "Helper 3", "Helper 4"]) {
        const id: string | null = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", description, "Wait."))).toolUseId;
        Assert.isNotNull(id);
        ids.push(id);
      }
      const [first, second] = ids;
      Assert.isDefined(first);
      Assert.isDefined(second);
      unavailable.push(await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "Find it", "Look.")), ServiceException));
      for (const agent of ["helper", "reviewer"])
        refusals.push((await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(token, agent, "Helper 5", "Wait.")), ServiceException)).info.name);
      await host.until("the second turn", () => tokens.length === 2, host.runs());
      const other = tokens[1];
      Assert.isDefined(other);
      refusals.push((await Assert.throwsAsync(() => host.engine.waitSubAgents(new SubAgentWaitParams(other, [first], 0)),
        ServiceException)).info.name);
      refusals.push((await Assert.throwsAsync(() => host.engine.stopSubAgent(new SubAgentStopParams(other, first)), ServiceException)).info.name);
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [first, second], 0)));
      held.resolve();
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [first], 50)));
      for (let left = 1; left > 0;)
        left = (await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50))).running.length;
      return undefined;
    };

    await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.engine.waitForIdle();
    const [endedToken] = tokens;
    Assert.isDefined(endedToken);
    const ended = await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(endedToken, "helper", "Late", "Late.")), ServiceException);
    const endedWait = await Assert.throwsAsync(() => host.engine.waitSubAgents(new SubAgentWaitParams(endedToken, [], 0)), ServiceException);

    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, ErrorCode.InvalidParams, ErrorCode.NotFound, ErrorCode.NotFound]), JSON.stringify(refusals));
    const [refused] = unavailable;
    Assert.isDefined(refused);
    Assert.areEqual(JSON.stringify([ErrorCode.InvalidParams, Resources.formatExplorerUnavailable("Fake provider", null)]),
      JSON.stringify([refused.info.name, refused.message]));
    Assert.areEqual(JSON.stringify([[[], 2], [[SubAgentStatus.Completed], 0]]), JSON.stringify(waits.map(t => [t.ended.map(u => u.status), t.running.length])));
    Assert.areEqual(JSON.stringify([ErrorCode.Unauthorized, ErrorCode.Unauthorized]), JSON.stringify([ended.info.name, endedWait.info.name]));
  }

  @TestMethod
  public async refusesAnExplorerWithTheReasonItsProviderGives(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.explorerUnavailable = "It can't promise read-only.";
    const refusals: ServiceException[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token))
        refusals.push(await Assert.throwsAsync(() => host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "Find it", "Look.")), ServiceException));
    };

    await SubAgentsTests.sendAsync(host, await host.createConversationAsync());
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([[ErrorCode.InvalidParams, Resources.formatExplorerUnavailable("Fake provider", "It can't promise read-only.")]]),
      JSON.stringify(refusals.map(t => [t.info.name, t.message])));
  }

  @TestMethod
  public async runsAnExplorerAtOnceInItsProvidersReadOnlyModeWithNoSharedServersAndDeniesEveryApprovalItAsksWithANote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folders: (string | null)[] = [];
    host.adapter.sharedServerUnavailable = (_server, _provider, folder) => {
      folders.push(folder);
      return null;
    };
    host.adapter.modeIds = ["default", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.explorerMode = "plan";
    const deny = new ApprovalOption("decline", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    const server = await host.sharedServers.createAsync(new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    const answers: string[] = [];
    const types: (string | null)[] = [];
    const waits: SubAgentWaitResult[] = [];
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token)) {
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Write the fix", "Fix it."));
        types.push((await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "Find the cause", "Look."))).type);
        waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50)));
        held.resolve();
        await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50));
        return;
      }
      if (request.prompt === "Fix it.")
        return held.promise;
      const listener = host.adapter.lastListener;
      Assert.isNotNull(listener);
      answers.push(await listener.onApprovalRequested(new ApprovalAsk("req-1", ApprovalKind.Command, "exec", "Run rm a.txt", null, [SubAgentsTests.allow, deny])));
      answers.push((await Assert.throwsAsync(() => listener.onApprovalRequested(new ApprovalAsk("req-2", ApprovalKind.FileChange, "edit", "Edit a.txt", null,
        [SubAgentsTests.allow])), ApprovalNotDeniableException)).message);
      return undefined;
    };

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [reply] = sent.replies;
    const [parent] = host.adapter.requests;
    const [waited] = waits;
    const [explorer, helper] = ["Look.", "Fix it."].map(t => host.adapter.requests.find(u => u.prompt === t));
    Assert.isDefined(reply);
    Assert.isDefined(parent);
    Assert.isDefined(waited);
    Assert.isDefined(explorer);
    Assert.isDefined(helper);
    const stored = await host.messages.findAsync(reply.id);
    Assert.isNotNull(stored);
    const row = stored.details.find(t => t.kind === DetailKind.SubAgent && t.text === "Find the cause");
    Assert.isDefined(row);
    Assert.areEqual(JSON.stringify([Resources.explorerType]), JSON.stringify(types));
    Assert.areEqual(JSON.stringify([["plan", ""], [parent.requested.mode, "search"]]),
      JSON.stringify([explorer, helper].map(t => [t.requested.mode, t.sharedServers.map(u => u.name).join()])));
    Assert.areEqual(JSON.stringify([parent.workingDirectory, helper.workingDirectory]), JSON.stringify(folders));
    Assert.areEqual(JSON.stringify([[["Find the cause", SubAgentStatus.Completed]], 1]),
      JSON.stringify([waited.ended.map(t => [t.description, t.status]), waited.running.length]));
    Assert.areEqual(JSON.stringify([deny.id, Resources.formatExplorerDenied("Edit a.txt")]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["Working", Resources.formatExplorerDenied("Run rm a.txt")]),
      JSON.stringify(stored.details.filter(t => t.parentSequence === row.sequence && t.kind === DetailKind.Note).map(t => t.text)));
    Assert.areEqual(0, (await host.approvals.listPendingAsync(stored.id)).length);
  }

  @TestMethod
  public async runsOneHelperAtATimeInAFolderWhileAnotherFoldersRunsAndStopsAQueuedOneBeforeItsTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const tokens: string[] = [];
    const seen: string[][] = [];
    const waits: SubAgentWaitResult[] = [];
    const stopped: SubAgent[] = [];
    const held = Promise.withResolvers<void>();
    const helpers = (): string[] => host.adapter.requests.map(t => t.prompt).filter(t => t.endsWith("."));
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return request.prompt === "First." ? held.promise : undefined;
      tokens.push(token);
      if (tokens.length === 2) {
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Elsewhere", "Elsewhere."));
        await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50));
        return undefined;
      }
      const ids: string[] = [];
      for (const description of ["First", "Second", "Third"]) {
        const id: string | null = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", description, `${description}.`))).toolUseId;
        Assert.isNotNull(id);
        ids.push(id);
      }
      const [first, second, third] = ids;
      Assert.isDefined(first);
      Assert.isDefined(second);
      Assert.isDefined(third);
      stopped.push(await host.engine.stopSubAgent(new SubAgentStopParams(token, third)));
      await host.until("the helper elsewhere", () => helpers().includes("Elsewhere."), host.runs());
      seen.push(helpers());
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [first, second], 0)));
      held.resolve();
      waits.push(await host.engine.waitSubAgents(new SubAgentWaitParams(token, [second], 50)));
      return undefined;
    };

    await SubAgentsTests.sendAsync(host, conversation);
    await host.until("the first turn", () => tokens.length === 1, host.runs());
    await SubAgentsTests.sendAsync(host, await host.createConversationAsync(await host.openProjectAsync("beta")));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([["First.", "Elsewhere."], ["First.", "Elsewhere.", "Second."]]), JSON.stringify([...seen, helpers()]));
    Assert.areEqual(JSON.stringify([["Third", SubAgentStatus.Stopped, null]]), JSON.stringify(stopped.map(t => [t.description, t.status, t.summary])));
    Assert.areEqual(JSON.stringify([[[], 2], [[SubAgentStatus.Completed], 0]]), JSON.stringify(waits.map(t => [t.ended.map(u => u.status), t.running.length])));
    Assert.areEqual(BackgroundTaskStatus.Stopped,
      (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).find(t => t.command === "Third")?.status ?? null);
  }

  @TestMethod
  public async runsOneHelperAtATimeForTwoProjectsWhosePathsReachOneFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = join(host.directory.path, "alpha");
    mkdirSync(folder);
    symlinkSync(folder, join(host.directory.path, "alias"), "junction");
    const tokens: string[] = [];
    const held = Promise.withResolvers<void>();
    const helpers = (): string[] => host.adapter.requests.map(t => t.prompt).filter(t => t.endsWith("."));
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return request.prompt === "First." ? held.promise : undefined;
      tokens.push(token);
      const [description] = ["First", "Second", "Elsewhere"].slice(tokens.length - 1);
      Assert.isDefined(description);
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", description, `${description}.`));
      for (let left = 1; left > 0;)
        left = (await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50))).running.length;
      return undefined;
    };

    await SubAgentsTests.sendAsync(host, await host.createConversationAsync(await host.openProjectAsync("alpha")));
    await host.until("the first helper", () => helpers().includes("First."), host.runs());
    await SubAgentsTests.sendAsync(host, await host.createConversationAsync(await host.openProjectAsync("alias")));
    await host.until("the second turn", () => tokens.length === 2, host.runs());
    await SubAgentsTests.sendAsync(host, await host.createConversationAsync(await host.openProjectAsync("beta")));
    await host.until("the helper elsewhere", () => helpers().includes("Elsewhere."), host.runs());
    const seen = helpers();
    held.resolve();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([["First.", "Elsewhere."], ["First.", "Elsewhere.", "Second."]]), JSON.stringify([seen, helpers()]));
  }

  @TestMethod
  public async wakesItsReplyForAHelperThatEndsWhileTheEndedTurnAddsTheWakeOfAnEarlierOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["default", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.explorerMode = "plan";
    const conversation = await host.createConversationAsync();
    const first = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();
    host.adapter.holdTurn = async request => {
      if (request.prompt === "First.")
        return first.promise;
      if (request.prompt === "Second.")
        return second.promise;
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token) || request !== host.adapter.requests[0])
        return undefined;
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "First", "First."));
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "Second", "Second."));
      await host.adapter.requested(3);
      return undefined;
    };
    const statusOfAsync = async (command: string): Promise<string | null> =>
      (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).find(t => t.command === command)?.status ?? null;
    const statesAsync = async (): Promise<string> =>
      (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes ORDER BY rowid"))).map(t => t.readString("state")).join();
    const connection = host.context.database.connection;
    const executeAsync = connection.executeAsync.bind(connection);
    const added: string[] = [];
    connection.executeAsync = async query => {
      if (added.length === 0 && query.text.startsWith("INSERT INTO chatWakes")) {
        added.push(query.text);
        second.resolve();
        await host.until("the second helper's end", async () => await statusOfAsync("Second") === BackgroundTaskStatus.Completed);
      }
      return executeAsync(query);
    };

    await SubAgentsTests.sendAsync(host, conversation);
    await host.engine.waitForIdle();
    const whileFirstRuns = await statesAsync();
    first.resolve();
    await host.until("the first helper's wake", async () => (await statesAsync()).split(",").every(t => t === "Delivered"));
    await host.engine.waitForIdle();

    Assert.areEqual(1, added.length);
    Assert.areEqual("Waiting,Delivered", whileFirstRuns);
    Assert.areEqual("Delivered,Delivered", await statesAsync());
    Assert.areEqual(5, host.adapter.requests.length);
  }

  private static async sendAsync(host: CoreHost, conversation: Conversation, model: string | null = null): Promise<Message> {
    const [reply] = (await host.engine.sendAsync(new MessageSendParams(conversation.id, "Check", new RequestedSettings("fake", model, null),
      (await host.providerOfAsync()).id))).replies;
    Assert.isDefined(reply);
    return reply;
  }

  private static async rowOfAsync(host: CoreHost, reply: Message): Promise<SubAgent> {
    const row = (await host.messages.findAsync(reply.id))?.details.find(t => t.kind === DetailKind.SubAgent);
    Assert.isDefined(row);
    return SubAgent.fromJson(row.payload);
  }

  private static abortOf(signal: AbortSignal): Promise<void> {
    return signal.aborted ? Promise.resolve() : new Promise(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  }
}
