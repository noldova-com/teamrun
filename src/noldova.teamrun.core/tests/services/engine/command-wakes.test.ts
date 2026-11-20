/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SqlQuery } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, type TurnRequest } from "@noldova/teamrun.core";
import {
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskStatus,
  CommandStartParams,
  ConversationIdParams,
  ConversationMemberParams,
  ErrorCode,
  EventName,
  Harness,
  type Message,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  type MessageSendResult,
  MessageStatus,
  MethodName,
  Request,
  RequestedSettings,
  SenderEnvironment,
  SubAgentStartParams,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class CommandWakesTests {
  @TestMethod
  public async wakesTheStarterWithTheExitCodeAndLastLinesOfACommandThatEndsAfterItsTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."], ["Thanks."]];
    const started = CommandWakesTests.startOnce(host, "npm test", "Run the tests");

    const sent = await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [command] = host.commands.started;
    Assert.isDefined(command);
    const before = [await CommandWakesTests.statesAsync(host), (await CommandWakesTests.chatAsync(host, conversation.id)).length].join();
    const lines = Array.from({ length: 25 }, (_, index) => `line ${index + 1} ${"x".repeat(120)}`);
    command.write(`${lines.join("\r\n")}\r\n\r\n`);
    command.end(1);
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    const [, reply, wake, woken] = await CommandWakesTests.chatAsync(host, conversation.id);
    const [first] = started;
    const [task] = await host.tasks.listAsync(new ConversationIdParams(conversation.id));
    const [asked, wakeRequest] = host.adapter.requests;
    const [sentReply] = sent.replies;
    Assert.isDefined(reply);
    Assert.isDefined(wake);
    Assert.isDefined(woken);
    Assert.isDefined(first);
    Assert.isDefined(task);
    Assert.isDefined(asked);
    Assert.isDefined(wakeRequest);
    Assert.isDefined(sentReply);
    const text = `Your background command "Run the tests" (${first.id}) exited with code 1. Its last lines:\n…${lines.slice(-20).join("\n").slice(-2000)}`;
    Assert.areEqual("Waiting,2", before);
    Assert.areEqual(JSON.stringify(["npm test", asked.workingDirectory, "fake", BackgroundTaskStatus.Running, sentReply.id, reply.id]),
      JSON.stringify([command.command, command.directory, first.kind, first.status, first.messageId, sentReply.id]));
    Assert.areEqual(JSON.stringify([conversation.id, null, "TeamRun", text]),
      JSON.stringify([wake.sender?.conversationId, wake.sender?.teammateId, wake.sender?.name, wake.details[0]?.text]));
    Assert.areEqual(JSON.stringify([wake.id, MessageStatus.Completed]), JSON.stringify([woken.inReplyTo, woken.status]));
    const [row] = await host.context.database.connection.queryAsync(new SqlQuery("SELECT id FROM chatWakes"));
    Assert.areEqual(JSON.stringify({ source: "chatWake", wakeId: row?.readString("id"), wakeSourceMessageId: reply.id,
      wakeTask: { kind: "command", name: "Run the tests", ending: "exited with code 1", text: `…${lines.slice(-20).join("\n").slice(-2000)}` }, wakeReplyId: woken.id }),
      JSON.stringify(wake.details[0]?.payload));
    Assert.isTrue(wakeRequest.prompt.includes(`From TeamRun: ${text}`), wakeRequest.prompt);
    Assert.areEqual(JSON.stringify([first.id, BackgroundTaskStatus.Failed, 1]), JSON.stringify([task.id, task.status, task.exitCode]));
    Assert.isTrue((await host.tasks.readAsync(new BackgroundTaskIdParams(task.id))).output?.endsWith(`${lines.at(-1)}\r\n\r\n`) ?? false);
    Assert.areEqual("Delivered", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async wakesAtTheTurnsEndForACommandThatEndedDuringItBySignalWithNoOutput(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."], ["Thanks."]];
    const started: BackgroundTask[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (started.length > 0 || Object.isNull(token))
        return;
      started.push(await host.engine.startCommandAsync(new CommandStartParams(token, "npm run build", "Build")));
      host.commands.started[0]?.end(null, "SIGKILL");
      await host.until("the failed task", async () => (await host.tasks.listAsync(new ConversationIdParams(conversation.id)))[0]?.status === BackgroundTaskStatus.Failed);
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    const [, , wake, woken] = await CommandWakesTests.chatAsync(host, conversation.id);
    const [first] = started;
    const [task] = await host.tasks.listAsync(new ConversationIdParams(conversation.id));
    Assert.isDefined(wake);
    Assert.isDefined(woken);
    Assert.isDefined(first);
    Assert.isDefined(task);
    Assert.areEqual(`Your background command "Build" (${first.id}) was ended by SIGKILL, with no output.`, wake.details[0]?.text);
    Assert.areEqual(wake.id, woken.inReplyTo);
    Assert.isNull(task.exitCode);
    Assert.areEqual("Delivered", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async quotesWhyACommandCouldntRunWithItsShortOutputWhole(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."], ["Thanks."]];
    const started = CommandWakesTests.startOnce(host, "make", "Make");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [command] = host.commands.started;
    Assert.isDefined(command);
    command.write("oops\n");
    command.end(null, null, "spawn sh ENOENT");
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    const [, , wake] = await CommandWakesTests.chatAsync(host, conversation.id);
    const [first] = started;
    Assert.isDefined(wake);
    Assert.isDefined(first);
    Assert.areEqual(`Your background command "Make" (${first.id}) couldn't run: spawn sh ENOENT. Its last lines:\noops`, wake.details[0]?.text);
  }

  @TestMethod
  public async wakesNoOneForACommandStoppedFromItsTaskAfterItsTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    const started = CommandWakesTests.startOnce(host, "npm run dev", "Serve");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [first] = started;
    Assert.isDefined(first);
    const stopped = await host.tasks.stop(new BackgroundTaskIdParams(first.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped, [1]]), JSON.stringify([stopped.status, host.commands.started.map(t => t.stops)]));
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(2, (await CommandWakesTests.chatAsync(host, conversation.id)).length);
    Assert.areEqual("Undeliverable", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async stopsACommandWhoseTaskIsStoppedBeforeTheCommandBegins(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    const stops: Promise<BackgroundTask>[] = [];
    using _stopper = host.events.subscribe({
      onEvent: event => {
        if (event.name !== EventName.BackgroundTaskUpdated || stops.length > 0)
          return;
        const task = BackgroundTask.fromJson(event.payload);
        if (task.status === BackgroundTaskStatus.Running)
          stops.push(host.tasks.stop(new BackgroundTaskIdParams(task.id)));
      }
    });
    CommandWakesTests.startOnce(host, "npm run dev", "Serve");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [stopping] = stops;
    Assert.isDefined(stopping);
    const stopped = await stopping;

    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped, [1]]), JSON.stringify([stopped.status, host.commands.started.map(t => t.stops)]));
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual("Undeliverable", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async stopsTheCommandsOfAStoppedTurnAndWakesNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const started: BackgroundTask[] = [];
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      started.push(await host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Test")));
      started.push(await host.engine.startCommandAsync(new CommandStartParams(token, "npm run dev", "Serve")));
      host.commands.started[0]?.end(0);
      await host.until("the completed task", async () => (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).some(t => t.status === BackgroundTaskStatus.Completed));
    };

    const sent = await CommandWakesTests.sendAsync(host, conversation.id);
    await host.until("both commands", () => started.length === 2, host.runs());
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    const statuses = (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status).sort().join();
    Assert.areEqual(`${BackgroundTaskStatus.Completed},${BackgroundTaskStatus.Stopped}`, statuses);
    Assert.areEqual("0,1", host.commands.started.map(t => t.stops).join());
    Assert.areEqual(String.empty, await CommandWakesTests.statesAsync(host));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesACommandFromAnEndedTurnPastTheChatsLimitOrWithNoStarter(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    const tokens: string[] = [];
    const refusals: ServiceException[] = [];
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      tokens.push(token);
      for (const index of [1, 2, 3, 4])
        await host.engine.startCommandAsync(new CommandStartParams(token, `npm run job${index}`, `Job ${index}`));
      refusals.push(await Assert.throwsAsync(() => host.engine.startCommandAsync(new CommandStartParams(token, "npm run job5", "Job 5")), ServiceException));
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [token] = tokens;
    Assert.isDefined(token);
    const ended = await host.dispatcher.dispatch(new Request("r1", MethodName.CommandStart, new CommandStartParams(token, "npm test", "Test").toJson()));
    await using bare = await CoreHost.createAsync(false, false, undefined, undefined, undefined, null, false);
    const other = await bare.createConversationAsync();
    bare.adapter.holdTurn = async request => {
      const bareToken = CommandWakesTests.tokenOf(request);
      refusals.push(await Assert.throwsAsync(() => bare.engine.startCommandAsync(new CommandStartParams(bareToken, "npm test", "Test")), ServiceException));
    };
    await CommandWakesTests.sendAsync(bare, other.id);
    await bare.engine.waitForIdle();

    Assert.areEqual(4, host.commands.started.length);
    Assert.areEqual(JSON.stringify([
      [ErrorCode.Conflict, "This chat already runs 4 background commands; wait for one to end, or stop one, first."],
      [ErrorCode.Unavailable, "Background commands can't run here, since TeamRun has no way to start a program."]
    ]), JSON.stringify(refusals.map(t => [t.info.name, t.info.message])));
    Assert.areEqual(ErrorCode.Unauthorized, ended.info?.name);
  }

  @TestMethod
  public async stopsTheCommandsOfADeletedChatAndWakesNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    CommandWakesTests.startOnce(host, "npm run dev", "Serve");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const before = await CommandWakesTests.statesAsync(host);
    const deleted = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationDelete, new ConversationIdParams(conversation.id).toJson()));
    await host.engine.waitForIdle();

    Assert.isFalse(deleted.hasErrors);
    Assert.areEqual("Waiting", before);
    Assert.areEqual("1", host.commands.started.map(t => t.stops).join());
    Assert.areEqual(String.empty, await CommandWakesTests.statesAsync(host));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async notesInsteadOfWakingWhenTheTeammateThatStartedTheCommandLeftTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", "Ada's role", (await host.providerOfAsync()).id, Harness.Provider, null, null));
    host.adapter.turnTexts = [["Started."]];
    const started = CommandWakesTests.startOnce(host, "npm test", "Test");

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada test it", null, null, [], [ada.id]));
    await host.engine.waitForIdle();
    await host.conversations.removeMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const [command] = host.commands.started;
    Assert.isDefined(command);
    command.end(0);
    await host.until("the settled wake", async () => await CommandWakesTests.statesAsync(host) === "Undeliverable");
    await host.engine.waitForIdle();

    const wake = (await CommandWakesTests.chatAsync(host, conversation.id)).at(-1);
    const [first] = started;
    Assert.isDefined(wake);
    Assert.isDefined(first);
    Assert.areEqual(JSON.stringify([`Your background command "Test" (${first.id}) exited with code 0, with no output.`,
      "This chat wasn't woken: the teammate that asked for it is no longer in this chat."]), JSON.stringify(wake.details.map(t => t.text)));
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual("Undeliverable", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async refusesACommandItsShellCantRunAsWrittenWithTheStartersReasonStartingNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    host.commands.refusal = "cmd.exe runs one line.";
    const refusals: ServiceException[] = [];
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      refusals.push(await Assert.throwsAsync(() => host.engine.startCommandAsync(new CommandStartParams(token, "npm ci\nnpm test", "Test")), ServiceException));
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([[ErrorCode.InvalidParams, "cmd.exe runs one line."]]), JSON.stringify(refusals.map(t => [t.info.name, t.info.message])));
    Assert.areEqual(0, host.commands.started.length);
    Assert.areEqual(String.empty, await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async refusesACommandForAChatTheTasksHaveForgottenStartingNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."]];
    const refusals: ServiceException[] = [];
    host.adapter.holdTurn = async request => {
      host.tasks.forget([conversation.id]);
      const token = CommandWakesTests.tokenOf(request);
      refusals.push(await Assert.throwsAsync(() => host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Test")), ServiceException));
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([[ErrorCode.NotFound, [conversation.id]]]), JSON.stringify(refusals.map(t => [t.info.name, t.info.arguments])));
    Assert.areEqual(0, host.commands.started.length);
    Assert.areEqual(String.empty, await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async notesACommandWakeThatARestartLostAndStopsRunningCommandsAtShutdown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const lost = await host.createConversationAsync(project);
    const running = await host.createConversationAsync(project);
    host.adapter.turnTexts = [["Asked."]];
    const asked = await CommandWakesTests.sendAsync(host, lost.id);
    await host.engine.waitForIdle();
    const [reply] = asked.replies;
    Assert.isDefined(reply);
    const json = { id: "w1", kind: "Command", chatId: lost.id, sourceMessageId: reply.id, watchedChatId: lost.id, watchedIds: ["cmd-1"],
      state: "Waiting", text: null, hop: null, createdAt: "t" };
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chatWakes (id, chatId, state, json, updatedAt) VALUES (?, ?, ?, ?, 't')",
      ["w1", lost.id, "Waiting", JSON.stringify(json)]));
    const view = { kind: "command", name: "Serve the docs", ending: null, text: null };
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chatWakes (id, chatId, state, json, updatedAt) VALUES (?, ?, ?, ?, 't')",
      ["w2", lost.id, "Waiting", JSON.stringify({ ...json, id: "w2", watchedIds: ["cmd-2"], view })]));

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();
    host.adapter.holdUntilAbort = true;
    CommandWakesTests.startOnce(host, "npm run dev", "Serve");
    await CommandWakesTests.sendAsync(host, running.id);
    await host.until("the started command", () => host.commands.started.length === 1, host.runs());
    await host.engine.shutdown();

    const woken = (await CommandWakesTests.chatAsync(host, lost.id)).slice(-2);
    Assert.areEqual(JSON.stringify(["cmd-1", "cmd-2"].map(t => `TeamRun restarted before your background command ${t} ended, so it was stopped and this chat wasn't woken by it.`)),
      JSON.stringify(woken.map(t => t.details[0]?.text)));
    Assert.areEqual(JSON.stringify([{ source: "chatWake", wakeId: "w1", wakeSourceMessageId: reply.id },
      { source: "chatWake", wakeId: "w2", wakeSourceMessageId: reply.id, wakeTask: view, wakeEnd: "lost" }]), JSON.stringify(woken.map(t => t.details[0]?.payload)));
    Assert.areEqual("1", host.commands.started.map(t => t.stops).join());
    Assert.areEqual("Undeliverable,Undeliverable", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async tellsOnlyTheTeammatesNextTurnInTheChatWhichOfItsCommandsThePersonStoppedAndOnlyOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", "Ada's role", (await host.providerOfAsync()).id, Harness.Provider, null, null));
    const started: BackgroundTask[] = [];
    host.adapter.holdTurn = async (request: TurnRequest): Promise<void> => {
      const token = SenderEnvironment.read(request.environment);
      if (started.length === 0 && !Object.isNull(token))
        started.push(await host.engine.startCommandAsync(new CommandStartParams(token, "sleep 600", "Wait long")),
          await host.engine.startCommandAsync(new CommandStartParams(token, "sleep 900", "Wait longer")));
    };
    const send = async (text: string, teammate: string | null): Promise<void> => {
      await host.engine.sendAsync(Object.isNull(teammate) ? new MessageSendParams(conversation.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id)
        : new MessageSendParams(conversation.id, text, null, null, [], [teammate]));
      await host.engine.waitForIdle();
    };

    await send("@Ada wait", ada.id);
    const [stopped, running] = started;
    Assert.isDefined(stopped);
    Assert.isDefined(running);
    await host.tasks.stop(new BackgroundTaskIdParams(stopped.id));
    await host.engine.waitForIdle();
    await send("Go", null);
    await send("@Ada /compact", ada.id);
    await send("@Ada /review", ada.id);
    await send("@Ada what now", ada.id);
    await send("@Ada and now", ada.id);

    const note = `${Resources.formatStoppedCommands([Resources.formatStoppedCommand("Wait long", stopped.id)])}${Resources.transcriptSeparator}`;
    Assert.areEqual("From TeamRun: since your last turn here, the person stopped this background command of yours, so it no longer runs and won't wake this chat:\n"
      + `- "Wait long" (${stopped.id})\n\n`, note);
    Assert.areEqual("false,false,false,false,true,false", host.adapter.requests.map(t => String(t.prompt.startsWith(note) && t.freshPrompt?.startsWith(note) === true)).join(","));
    Assert.areEqual("false,false,false,false,true,false", host.adapter.requests.map(t => String(t.prompt.includes("the person stopped"))).join(","));
    Assert.isFalse(host.adapter.requests.some(t => t.prompt.includes(running.id)));
    Assert.areEqual("false,false,true,false,false,false", host.adapter.requests.map(t => String(t.compacts)).join(","));
    Assert.areEqual("null,null,/compact,/review,null,null", host.adapter.requests.map(t => String(t.command)).join(","));
  }

  @TestMethod
  public async tellsTheNextTurnWhichCommandsTheRepliesStopStopped(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const started: BackgroundTask[] = [];
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      started.push(await host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Test")),
        await host.engine.startCommandAsync(new CommandStartParams(token, "npm run dev", "Serve")));
    };

    const sent = await CommandWakesTests.sendAsync(host, conversation.id);
    await host.until("both commands", () => started.length === 2, host.runs());
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();
    host.adapter.holdUntilAbort = false;
    host.adapter.holdTurn = null;
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();

    const [test, serve] = started;
    Assert.isDefined(test);
    Assert.isDefined(serve);
    const lines = (text: string | undefined): string => (text ?? String.empty).split(Resources.lineSeparator).sort().join(Resources.lineSeparator);
    Assert.areEqual(lines(Resources.formatStoppedCommands([Resources.formatStoppedCommand("Test", test.id), Resources.formatStoppedCommand("Serve", serve.id)])),
      lines(host.adapter.requests[1]?.prompt.split(Resources.transcriptSeparator)[0]));
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async tellsTheTurnAfterOneThatFailedWhichCommandsThePersonStoppedOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const started = CommandWakesTests.startOnce(host, "npm run dev", "Serve");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [first] = started;
    Assert.isDefined(first);
    await host.tasks.stop(new BackgroundTaskIdParams(first.id));
    host.adapter.failBeforeStart = true;
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    host.adapter.failBeforeStart = false;
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();

    const note = Resources.formatStoppedCommands([Resources.formatStoppedCommand("Serve", first.id)]);
    Assert.areEqual("false,true,true,false", host.adapter.requests.map(t => String(t.prompt.startsWith(note))).join(","));
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Completed, MessageStatus.Completed].join(),
      (await CommandWakesTests.chatAsync(host, conversation.id)).filter(t => t.author === MessageAuthor.Provider).map(t => t.status).join());
  }

  @TestMethod
  public async tellsTheNextTurnOfACommandStillEndingAfterItsStopAndNotTheOneAfterIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const started = CommandWakesTests.startOnce(host, "npm run dev", "Serve");

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [first] = started;
    const [command] = host.commands.started;
    Assert.isDefined(first);
    Assert.isDefined(command);
    command.endsOnStop = false;
    const stopping = host.tasks.stop(new BackgroundTaskIdParams(first.id));
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const ended = Promise.withResolvers<BackgroundTask>();
    using _ender = host.events.subscribe({
      onEvent: event => {
        if (event.name !== EventName.BackgroundTaskUpdated)
          return;
        const task = BackgroundTask.fromJson(event.payload);
        if (task.id === first.id && !task.isRunning)
          ended.resolve(task);
      }
    });
    command.end(null, "SIGKILL");
    await stopping;
    const stopped = await ended.promise;
    await host.engine.waitForIdle();
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();

    const note = Resources.formatStoppedCommands([Resources.formatStoppedCommand("Serve", first.id)]);
    Assert.areEqual("false,true,false", host.adapter.requests.map(t => String(t.prompt.startsWith(note))).join(","));
    Assert.areEqual(BackgroundTaskStatus.Stopped, stopped.status);
    Assert.areEqual("Undeliverable", await CommandWakesTests.statesAsync(host));
  }

  @TestMethod
  public async tellsATeammateThatLeftTheChatAndCameBackNothingItsStopsBeforeLeaving(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", "Ada's role", (await host.providerOfAsync()).id, Harness.Provider, null, null));
    const started = CommandWakesTests.startOnce(host, "npm test", "Test");
    const member = new ConversationMemberParams(conversation.id, ada.id);

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada test it", null, null, [], [ada.id]));
    await host.engine.waitForIdle();
    const [first] = started;
    Assert.isDefined(first);
    await host.tasks.stop(new BackgroundTaskIdParams(first.id));
    const removed = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationRemoveMember, member.toJson()));
    const added = await host.dispatcher.dispatch(new Request("r2", MethodName.ConversationAddMember, member.toJson()));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada again", null, null, [], [ada.id]));
    await host.engine.waitForIdle();

    Assert.isFalse(removed.hasErrors);
    Assert.isFalse(added.hasErrors);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isFalse(host.adapter.requests.some(t => t.prompt.includes("the person stopped")));
  }

  @TestMethod
  public async wakesForACommandThatEndsWhileTheEndedTurnAddsItsHelpersWake(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["default", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.explorerMode = "plan";
    const conversation = await host.createConversationAsync();
    const explorer = Promise.withResolvers<void>();
    host.adapter.holdTurn = async request => {
      if (request.prompt === "Look.")
        return explorer.promise;
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token) || request !== host.adapter.requests[0])
        return undefined;
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "explorer", "Find it", "Look."));
      await host.engine.startCommandAsync(new CommandStartParams(token, "npm run dev", "Serve"));
      await host.adapter.requested(2);
      return undefined;
    };
    const statusOfAsync = async (): Promise<BackgroundTaskStatus | null> =>
      (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).find(t => t.command === "npm run dev")?.status ?? null;
    const statesAsync = async (): Promise<string> =>
      (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes ORDER BY rowid"))).map(t => t.readString("state")).join();
    const connection = host.context.database.connection;
    const executeAsync = connection.executeAsync.bind(connection);
    const added: string[] = [];
    connection.executeAsync = async query => {
      if (added.length === 0 && query.text.startsWith("INSERT INTO chatWakes")) {
        added.push(query.text);
        host.commands.started[0]?.end(0);
        await host.until("the command's end", async () => ![null, BackgroundTaskStatus.Running].includes(await statusOfAsync()));
      }
      return executeAsync(query);
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const whileExplorerRuns = await statesAsync();
    explorer.resolve();
    await host.until("the explorer's wake", async () => (await statesAsync()).split(",").every(t => t === "Delivered"));
    await host.engine.waitForIdle();

    Assert.areEqual(1, added.length);
    Assert.areEqual(1, host.commands.started.length);
    Assert.areEqual("Waiting,Delivered", whileExplorerRuns);
    Assert.areEqual("Delivered,Delivered", await statesAsync());
    Assert.areEqual(4, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesACommandWhoseTurnIsStoppedWhileItsFolderIsFoundStartingNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const refusals: ServiceException[] = [];
    const stops: Promise<readonly Message[]>[] = [];
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      host.conversations.findAsync = async (id, transaction) => {
        if (stops.length === 0)
          stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
        return findAsync(id, transaction);
      };
      refusals.push(await Assert.throwsAsync(() => host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Test")), ServiceException));
      host.conversations.findAsync = findAsync;
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    await Promise.all(stops);

    Assert.areEqual(JSON.stringify([[ErrorCode.Unauthorized, Resources.senderTurnEnded]]), JSON.stringify(refusals.map(t => [t.info.name, t.message])));
    Assert.areEqual(1, stops.length);
    Assert.areEqual(0, host.commands.started.length);
    Assert.areEqual(0, (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).length);
  }

  @TestMethod
  public async stopsTheTaskOfACommandWhoseTurnIsStoppedWhileTheTaskStartsAndStartsNoCommand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const refusals: ServiceException[] = [];
    const stops: Promise<readonly Message[]>[] = [];
    const startAsync = host.tasks.startAsync.bind(host.tasks);
    host.tasks.startAsync = async (conversationId, messageId, kind, start, teammateId) => {
      stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));
      return startAsync(conversationId, messageId, kind, start, teammateId);
    };
    host.adapter.holdTurn = async request => {
      const token = CommandWakesTests.tokenOf(request);
      refusals.push(await Assert.throwsAsync(() => host.engine.startCommandAsync(new CommandStartParams(token, "npm test", "Test")), ServiceException));
    };

    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    await Promise.all(stops);

    Assert.areEqual(JSON.stringify([[ErrorCode.Unauthorized, Resources.senderTurnEnded]]), JSON.stringify(refusals.map(t => [t.info.name, t.message])));
    Assert.areEqual(1, stops.length);
    Assert.areEqual(0, host.commands.started.length);
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped]),
      JSON.stringify((await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.status)));
  }

  @TestMethod
  public async logsACommandWhoseEndCantBeSavedAndKeepsTheEngineRunning(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."], ["Done."]];
    const started = CommandWakesTests.startOnce(host, "npm test", "Test");
    await CommandWakesTests.sendAsync(host, conversation.id);
    await host.engine.waitForIdle();
    const [command] = host.commands.started;
    const [first] = started;
    Assert.isDefined(command);
    Assert.isDefined(first);
    const failure = new Error("The disk is full.");
    const endAsync = host.tasks.endAsync.bind(host.tasks);
    host.tasks.endAsync = () => Promise.reject(failure);
    const line = Resources.formatBackgroundTaskNotSaved(first.id, Resources.formatFailureKind(failure));

    command.end(0);
    await host.until("the logged end", () => host.log.lines.includes(line));
    host.tasks.endAsync = endAsync;
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.log.lines.filter(t => t === line).length, host.log.lines.join("\n"));
    Assert.areEqual("Waiting", await CommandWakesTests.statesAsync(host));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  private static startOnce(host: CoreHost, command: string, description: string): readonly BackgroundTask[] {
    const started: BackgroundTask[] = [];
    host.adapter.holdTurn = async (request: TurnRequest): Promise<void> => {
      const token = SenderEnvironment.read(request.environment);
      if (started.length === 0 && !Object.isNull(token))
        started.push(await host.engine.startCommandAsync(new CommandStartParams(token, command, description)));
    };
    return started;
  }

  private static tokenOf(request: TurnRequest): string {
    const token = SenderEnvironment.read(request.environment);
    Assert.isNotNull(token);
    return token;
  }

  private static async sendAsync(host: CoreHost, conversationId: string): Promise<MessageSendResult> {
    return host.engine.sendAsync(new MessageSendParams(conversationId, "Go", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
  }

  private static async statesAsync(host: CoreHost): Promise<string> {
    return (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes ORDER BY id"))).map(t => t.readString("state")).join(",");
  }

  private static chatAsync(host: CoreHost, conversationId: string): Promise<readonly Message[]> {
    return host.messages.listAsync(new MessageListParams(conversationId, null));
  }
}
