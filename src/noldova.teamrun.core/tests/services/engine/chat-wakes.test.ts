/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources, TurnOutcome, type TurnRequest, TurnResult, TurnWake } from "@noldova/teamrun.core";
import {
  type Conversation,
  ConversationIdParams,
  ConversationMemberParams,
  ConversationRewindParams,
  DetailKind,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  type MessageSendResult,
  MessageStatus,
  ObservedSettings,
  ProviderEnabledParams,
  RequestedSettings,
  SenderEnvironment,
  SubAgentStartParams,
  SubAgentWaitParams,
  type Teammate,
  TeammateCreateParams,
  TeammateIdParams
} from "@noldova/teamrun.protocol";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ChatWakesTests {
  @TestMethod
  public async wakesTheSenderWithANewTurnQuotingItsRepliesAndNamingTheHandOffsOnceTheTargetChatsWorkEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Fixes");
    const [alice, bob, carol] = await ChatWakesTests.teamAsync(host, "Alice", "Bob", "Carol");
    host.adapter.turnTexts = [["Asked."], ["The login fix is in.\n@Carol please check it."], ["Checked."], ["Thanks."]];
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1)
        crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, second.id, "@Bob what changed?", [bob!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(4);
    await host.engine.waitForIdle();
    const result = await crossed[0]!;

    const bobReply = result.replies[0]!;
    const carolReply = (await ChatWakesTests.chatAsync(host, second.id)).find(t => t.teammateId === carol!.id)!;
    const [, asked, wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    const text = [`The work you sent to chat "Fixes" (${second.id}) has ended.`,
      `@Bob replied (message ${bobReply.id}):\nThe login fix is in.\n@Carol please check it.`,
      `Also ended there, from hand-offs: @Carol (message ${carolReply.id}).`, "Read a message whole with `teamrun_list_messages`."].join("\n\n");
    Assert.isNotNull(result.wakeId);
    const replies = [{ name: "Bob", status: MessageStatus.Completed, text: "The login fix is in.\n@Carol please check it." }];
    Assert.areEqual(JSON.stringify([MessageAuthor.User, second.id, bob!.id, "Bob", text,
      { source: "chatWake", wakeId: result.wakeId, wakeSourceMessageId: asked!.id, wakeChatId: second.id, wakeReplies: replies, wakeReplyId: woken!.id }]),
      JSON.stringify([wake!.author, wake!.sender?.conversationId, wake!.sender?.teammateId, wake!.sender?.name, wake!.details[0]?.text, wake!.details[0]?.payload]));
    Assert.areEqual(JSON.stringify([alice!.id, wake!.id, MessageStatus.Completed]), JSON.stringify([woken!.teammateId, woken!.inReplyTo, woken!.status]));
    Assert.areEqual(JSON.stringify([DetailKind.Note, `Received a message from "Fixes".`, { source: "wakeReceived", wakeChatId: second.id, wakeReplies: replies }]),
      JSON.stringify([woken!.details[0]?.kind, woken!.details[0]?.text, woken!.details[0]?.payload]));
    Assert.isTrue(wake!.sequence > asked!.sequence);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes(`From @Bob in chat "Fixes" (${second.id}): ${text}`), host.adapter.requests[3]!.prompt);
    Assert.areEqual(4, host.adapter.requests.length);
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async tellsATurnAnsweringAMessageSentWithAWakeThatTheSenderGetsItsReplyByItself(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const third = await host.createConversationAsync(project);
    const [alice, bob, carol] = await ChatWakesTests.teamAsync(host, "Alice", "Bob", "Carol");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, second.id, "@Bob what changed?", [bob!])));
      crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, third.id, "@Carol what changed?", [carol!], false)));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask them", null, null, [], [alice!.id]));
    await host.adapter.requested(4);
    await host.engine.waitForIdle();
    await Promise.all(crossed);

    const turnOf = (asked: string): TurnRequest => host.adapter.requests.find(t => t.prompt.includes(asked))!;
    const note = `${Resources.transcriptSeparator}${Resources.awaitedReplyNote}`;
    Assert.isTrue(Resources.awaitedReplyNote.includes("gets your reply by itself when your turn ends, so only reply here"));
    Assert.isTrue(turnOf("@Bob what changed?").prompt.endsWith(note));
    Assert.isTrue(turnOf("@Bob what changed?").freshPrompt!.endsWith(note));
    Assert.isFalse(turnOf("@Carol what changed?").prompt.includes(Resources.awaitedReplyNote));
    Assert.isFalse(turnOf("@Alice ask them").prompt.includes(Resources.awaitedReplyNote));
  }

  @TestMethod
  public async wakesNoOneForASendThatStartsNoReplyOrDoesNotAsk(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length !== 1)
        return;
      crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, second.id, "Nobody is asked", [])));
      crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, second.id, "@Bob what changed?", [bob!], false)));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.engine.waitForIdle();
    const results = await Promise.all(crossed);
    await host.engine.waitForIdle();

    Assert.areEqual("0 null,1 null", results.map(t => `${t.replies.length} ${t.wakeId}`).join(","));
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual(2, (await ChatWakesTests.chatAsync(host, first.id)).length);
    Assert.areEqual("", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async holdsAWakeUntilTheSendingChatIsIdleAndThenStartsItsTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    host.adapter.turnTexts = [["Asked."], ["Fixed."], ["Thanks."]];
    const seen: string[] = [];
    host.adapter.holdTurn = async request => {
      if (request !== host.adapter.requests[0])
        return;
      const sent = await host.engine.sendAsync(ChatWakesTests.from(request, second.id, "@Bob fix it", [bob!]));
      await host.until("the completed reply and ready wake", async () => (await host.messages.findAsync(sent.replies[0]!.id))?.status === MessageStatus.Completed && (await ChatWakesTests.statesAsync(host)) === "Ready");
      seen.push((await ChatWakesTests.chatAsync(host, first.id)).map(t => t.author).join(","));
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    const [, asked, wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    Assert.areEqual(`${MessageAuthor.User},${MessageAuthor.Provider}`, seen.join());
    Assert.isTrue(wake!.createdAt >= asked!.endedAt!);
    Assert.isTrue(wake!.sequence > asked!.sequence);
    Assert.areEqual(JSON.stringify([alice!.id, wake!.id]), JSON.stringify([woken!.teammateId, woken!.inReplyTo]));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async startsACommandsWakeThatMeetsAHeldProjectOnlyOnceTheHoldEndsAndLeavesNoReplyMeanwhile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(project);
    await ChatWakesTests.askDefault(host, other.id);
    await ChatWakesTests.askDefault(host, chat.id);
    const activity = host.context.projectActivity;
    const previewing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    host.checkpoints.previewGate = (): Promise<void> => {
      previewing.resolve();
      return release.promise;
    };
    const rewind = host.engine.rewindAsync(new ConversationRewindParams(other.id, (await ChatWakesTests.chatAsync(host, other.id))[0]?.id ?? String.empty, true));
    await previewing.promise;
    const waiting = Promise.withResolvers<void>();
    const whenReleased = activity.whenReleasedAsync.bind(activity);
    activity.whenReleasedAsync = (): Promise<void> => {
      waiting.resolve();
      return whenReleased();
    };

    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const waking = listener.onWakeAsync(new TurnWake("task-1", "npm test"));
    await Promise.race([waiting.promise, waking]);
    const held = (await ChatWakesTests.chatAsync(host, chat.id)).length;
    release.resolve();
    await rewind;
    const wake = await waking;
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    const messages = await ChatWakesTests.chatAsync(host, chat.id);
    Assert.areEqual(2, held);
    Assert.areEqual(JSON.stringify([3, MessageStatus.Completed]), JSON.stringify([messages.length, messages.at(-1)?.status]));
  }

  @TestMethod
  public async startsNoWakeWhoseSourceLeftTheChatWhileTheProjectWasHeld(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    await ChatWakesTests.askDefault(host, chat.id);
    const activity = host.context.projectActivity;
    const hold = activity.enter(project.rootPath);
    const waiting = Promise.withResolvers<void>();
    const whenReleased = activity.whenReleasedAsync.bind(activity);
    activity.whenReleasedAsync = (): Promise<void> => {
      waiting.resolve();
      return whenReleased();
    };

    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const waking = listener.onWakeAsync(new TurnWake("task-1", "npm test"));
    await Promise.race([waiting.promise, waking]);
    await host.conversations.removeFromAsync(chat.id, 0);
    activity.leave(hold);
    const wake = await waking;
    await host.engine.waitForIdle();

    Assert.isNull(wake);
    Assert.areEqual(0, (await ChatWakesTests.chatAsync(host, chat.id)).length);
    activity.requireIdle(project.rootPath);
  }

  @TestMethod
  public async logsAReadyWakeWithoutTextRatherThanSkippingItSilently(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", null, 1);

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([`The wakes waiting on chat ${woken.id} weren't settled: ServiceException`]),
      JSON.stringify(host.log.lines.filter(t => t.startsWith("The wakes waiting on chat"))));
    Assert.areEqual("Ready", await ChatWakesTests.statesAsync(host));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async deliversAReadyWakeThatMeetsAHeldProjectOnlyOnceTheHoldEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", "Bob finished.", 1);
    const hold = host.context.projectActivity.enter(project.rootPath);

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();
    const held = [(await ChatWakesTests.chatAsync(host, woken.id)).length, await ChatWakesTests.statesAsync(host), host.adapter.requests.length];
    host.context.projectActivity.leave(hold);
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([2, "Ready", 1]), JSON.stringify(held));
    Assert.areEqual(MessageStatus.Completed, (await ChatWakesTests.chatAsync(host, woken.id)).at(-1)?.status);
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async interruptsAWakesReplyAndStartsNoTurnWhenShutdownBeginsDuringTheWakesTransaction(command: boolean): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", "Bob finished.", 1);
    const requests = host.adapter.requests.length;
    const shutdowns: Promise<void>[] = [];
    const insert = host.messages.insertAsync.bind(host.messages);
    host.messages.insertAsync = (message: Message, transaction?: SqlTransaction): Promise<void> => {
      if (message.author === MessageAuthor.Provider && shutdowns.length === 0)
        shutdowns.push(host.engine.shutdown());
      return insert(message, transaction);
    };

    const wake = command ? await listener.onWakeAsync(new TurnWake("task-1", "npm test")) : null;
    if (!command)
      await host.engine.reconcileAsync();
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await Promise.all(shutdowns);

    const reply = (await ChatWakesTests.chatAsync(host, woken.id)).at(-1);
    Assert.areEqual(JSON.stringify([1, MessageAuthor.Provider, MessageStatus.Interrupted, requests]),
      JSON.stringify([shutdowns.length, reply?.author, reply?.status, host.adapter.requests.length]));
    Assert.isNull(wake);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async leavesTheProjectWhenAWakesReplyCannotBeStored(command: boolean): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", "Bob finished.", 1);
    await host.context.database.connection.executeAsync(new SqlQuery("CREATE TRIGGER failInsert BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'boom'); END"));

    if (command)
      await Assert.throwsAsync(() => listener.onWakeAsync(new TurnWake("task-1", "npm test")), Error);
    else
      await host.engine.reconcileAsync();
    await host.engine.waitForIdle();

    host.context.projectActivity.requireIdle(project.rootPath);
    Assert.areEqual(JSON.stringify([2, 1]), JSON.stringify([(await ChatWakesTests.chatAsync(host, woken.id)).length, host.adapter.requests.length]));
  }

  @TestMethod
  public async deliversTheRepliesOfAReadyWakeWhoseChatWasDeletedBeforeTheSendingChatWasIdle(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    host.adapter.turnTexts = [["Asked."], ["Fixed."], ["Thanks."]];
    host.adapter.holdTurn = async request => {
      if (request !== host.adapter.requests[0])
        return;
      const sent = await host.engine.sendAsync(ChatWakesTests.from(request, second.id, "@Bob fix it", [bob!]));
      await host.until("the completed reply and ready wake", async () => (await host.messages.findAsync(sent.replies[0]!.id))?.status === MessageStatus.Completed && (await ChatWakesTests.statesAsync(host)) === "Ready");
      await host.until("the idle target chat deleted", () => host.conversations.deleteAsync(new ConversationIdParams(second.id)).then(() => true, () => false));
      await host.engine.forgetAsync([second.id]);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    const [, asked, wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    const [row] = await host.context.database.connection.queryAsync(new SqlQuery("SELECT id FROM chatWakes"));
    const replies = [{ name: "Bob", status: MessageStatus.Completed, text: "Fixed." }];
    Assert.areEqual(JSON.stringify({ source: "chatWake", wakeId: row?.readString("id"), wakeSourceMessageId: asked?.id, wakeChatId: second.id, wakeReplies: replies,
      wakeReplyId: woken?.id }), JSON.stringify(wake?.details[0]?.payload));
    Assert.isTrue(wake?.details[0]?.text.includes("Fixed.") ?? false);
    Assert.isTrue(wake?.details[0]?.text.endsWith("`teamrun_list_messages`.\n\nThat chat has since been deleted, so its messages can't be read.") ?? false);
    Assert.areEqual(JSON.stringify(["Received a message from a deleted chat.", { source: "wakeReceived", wakeChatId: second.id, wakeReplies: replies }]),
      JSON.stringify([woken?.details[0]?.text, woken?.details[0]?.payload]));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async stopsAChainOfSendsAndWakesBetweenTwoChatsAtTheHandOffLimit(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 3);
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      const count = host.adapter.requests.length;
      if (count === 1 || count === 3)
        crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[count - 1]!, second.id, "@Bob again", [bob!])));
      await Promise.allSettled(crossed);
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(4);
    await host.until("the delivered and undeliverable wakes", async () => (await ChatWakesTests.statesAsync(host)) === "Delivered,Undeliverable");
    await host.engine.waitForIdle();

    const sends = await Promise.all(crossed);
    const stopped = (await ChatWakesTests.chatAsync(host, first.id)).at(-1)!;
    Assert.areEqual("1,1", sends.map(t => t.replies.length).join(","));
    Assert.areEqual(4, host.adapter.requests.length);
    Assert.areEqual(5, (await ChatWakesTests.chatAsync(host, first.id)).length);
    Assert.areEqual(JSON.stringify([DetailKind.Note, Resources.formatChainStopped(3), { source: "handOff" }]),
      JSON.stringify([stopped.details[1]?.kind, stopped.details[1]?.text, stopped.details[1]?.payload]));
    Assert.areEqual(sends[1]!.wakeId, (stopped.details[0]?.payload as Record<string, unknown>)["wakeId"]);
  }

  @TestMethod
  public async keepsTheHopOfTheReplyAProvidersOwnWakeGoesOnFromSoItsSendStillStopsAtTheLimit(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 1);
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    const crossed: Promise<MessageSendResult>[] = [];
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 1)
        crossed.push(host.engine.sendAsync(ChatWakesTests.from(host.adapter.requests[0]!, second.id, "@Bob start the server", [bob!], false)));
      await Promise.allSettled(crossed);
    };
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(2);
    await crossed[0];
    await host.engine.waitForIdle();

    const wake = await host.adapter.lastListener!.onWakeAsync(new TurnWake("task-1", "npm run dev"));
    Assert.isNotNull(wake);
    const token = SenderEnvironment.read(wake.environment);
    const sent = await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice the server is up", null, null, [], [alice!.id], null, token));
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual(0, sent.replies.length);
    Assert.areEqual(Resources.formatChainStopped(1), (await host.messages.findAsync(sent.sent.id))?.details[1]?.text);
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async wakesTheStarterOfASubAgentThatEndsAfterItsTurnAndNotForOneThatEndsDuringIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.turnTexts = [["Started."], ["Quick done."], ["All 12 pass."], ["Thanks."]];
    const slow = Promise.withResolvers<void>();
    const ids: string[] = [];
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return request.prompt === "Slow." ? slow.promise : undefined;
      if (ids.length > 0)
        return undefined;
      const quick = (await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Quick", "Quick."))).toolUseId!;
      await host.engine.waitSubAgents(new SubAgentWaitParams(token, [quick], 50));
      ids.push((await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Slow", "Slow."))).toolUseId!);
      return undefined;
    };

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Check", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.until("the slow helper", () => ids.length === 1, host.runs());
    await host.adapter.requested(3);
    await host.engine.waitForIdle();
    const before = [host.adapter.requests.length, (await ChatWakesTests.chatAsync(host, conversation.id)).length, await ChatWakesTests.statesAsync(host)].join();
    slow.resolve();
    await host.adapter.requested(4);
    await host.engine.waitForIdle();

    const [, reply, wake, woken] = (await ChatWakesTests.chatAsync(host, conversation.id));
    const text = `Your sub-agent "Slow" (${ids[0]}) ended as completed:\nAll 12 pass.`;
    Assert.areEqual("3,2,Waiting", before);
    Assert.areEqual(sent.replies[0]!.id, reply!.id);
    Assert.areEqual(JSON.stringify([conversation.id, null, "TeamRun", text, "chatWake"]), JSON.stringify([wake!.sender?.conversationId, wake!.sender?.teammateId,
      wake!.sender?.name, wake!.details[0]?.text, (wake!.details[0]?.payload as Record<string, unknown>)["source"]]));
    Assert.areEqual(JSON.stringify([wake!.id, null, MessageStatus.Completed]), JSON.stringify([woken!.inReplyTo, woken!.teammateId, woken!.status]));
    const [row] = await host.context.database.connection.queryAsync(new SqlQuery("SELECT id FROM chatWakes"));
    const view = { wakeTask: { kind: "subAgent", name: "Slow", ending: "ended as completed", text: "All 12 pass." } };
    Assert.areEqual(JSON.stringify({ source: "chatWake", wakeId: row?.readString("id"), wakeSourceMessageId: reply!.id, ...view, wakeReplyId: woken!.id }),
      JSON.stringify(wake!.details[0]?.payload));
    Assert.areEqual(JSON.stringify([DetailKind.Note, "Woken when a sub-agent or background command of this chat ended.", { source: "wakeReceived", ...view }]),
      JSON.stringify([woken!.details[0]?.kind, woken!.details[0]?.text, woken!.details[0]?.payload]));
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes(`From TeamRun: ${text}`), host.adapter.requests[3]!.prompt);
    Assert.areEqual(4, host.adapter.requests.length);
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async wakesASenderWhoseSendJoinsTheTargetChatsRunningWorkOnceAllOfItHasEnded(aliceFirst: boolean): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Fixes");
    const [alice, bob, carol] = await ChatWakesTests.teamAsync(host, "Alice", "Bob", "Carol");
    host.adapter.turnTexts = aliceFirst ? [["Asked."], ["Fixing."], ["Checked."], ["Thanks."]] : [["Fixing."], ["Asked."], ["Checked."], ["Thanks."]];
    const busy = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    const crossed: MessageSendResult[] = [];
    host.adapter.holdTurn = async request => {
      if (request.instructions?.startsWith("Bob's role") === true) {
        held.resolve();
        await busy.promise;
      }
      else if (request.instructions?.startsWith("Alice's role") === true && crossed.length === 0) {
        await held.promise;
        crossed.push(await host.engine.sendAsync(ChatWakesTests.from(request, second.id, "@Carol check it", [carol!])));
      }
    };
    const sends = [new MessageSendParams(second.id, "@Bob fix it", null, null, [], [bob!.id]), new MessageSendParams(first.id, "@Alice ask Carol", null, null, [], [alice!.id])];
    const sent: MessageSendResult[] = [];

    for (const params of aliceFirst ? sends.toReversed() : sends) {
      sent.push(await host.engine.sendAsync(params));
      await host.adapter.requested(sent.length);
    }
    const [fixing, asking] = [sent[aliceFirst ? 1 : 0]!, sent[aliceFirst ? 0 : 1]!];
    await host.until("the completed ask", async () => (await host.messages.findAsync(asking.replies[0]!.id))?.status === MessageStatus.Completed, host.runs());
    const before = await ChatWakesTests.statesAsync(host);
    busy.resolve();
    await host.adapter.requested(4);
    await host.engine.waitForIdle();

    const [, , wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    const text = [`The work you sent to chat "Fixes" (${second.id}) has ended.`, `@Carol replied (message ${crossed[0]!.replies[0]!.id}):\nChecked.`,
      "Read a message whole with `teamrun_list_messages`."].join("\n\n");
    Assert.areEqual("Waiting", before);
    Assert.isNotNull(crossed[0]!.wakeId);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(fixing.replies[0]!.id))?.status);
    Assert.areEqual(JSON.stringify([second.id, carol!.id, text, alice!.id, wake!.id]),
      JSON.stringify([wake!.sender?.conversationId, wake!.sender?.teammateId, wake!.details[0]?.text, woken!.teammateId, woken!.inReplyTo]));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async quotesEachWatchedReplyThatStillExistsByHowItEndedCuttingALongOneAndNamingAProviderReplyByItsProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const notes = await host.createConversationAsync(project, "Notes");
    host.adapter.turnTexts = [["Asked."], [], ["Broke."], ["Stopped."], [], ["x".repeat(2001)], ["Again."], ["Thanks."]];
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(notes.id, "Ask", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    const cancelled = sent.replies[0]!;
    await host.adapter.requested(2);
    await host.engine.cancelAsync(new MessageIdParams(cancelled.id));
    await host.engine.waitForIdle();
    host.adapter.holdUntilAbort = false;
    const ended: Message[] = [];
    for (const outcome of [TurnOutcome.Failed, TurnOutcome.Interrupted, TurnOutcome.Completed, TurnOutcome.Completed]) {
      host.adapter.outcome = outcome;
      ended.push(await ChatWakesTests.askDefault(host, notes.id));
    }
    const [failed, interrupted, empty, long] = ended;
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, notes.id, [cancelled.id, failed!.id, interrupted!.id, empty!.id, long!.id, "missing"],
      "Waiting", null, null);

    await ChatWakesTests.askDefault(host, notes.id);
    await host.adapter.requested(8);
    await host.engine.waitForIdle();

    const [, , wake, reply] = (await ChatWakesTests.chatAsync(host, woken.id));
    const text = [`The work you sent to chat "Notes" (${notes.id}) has ended.`, `@Fake provider's reply (message ${cancelled.id}) was cancelled.`,
      `@Fake provider's reply (message ${failed!.id}) failed.`, `@Fake provider's reply (message ${interrupted!.id}) was interrupted.`,
      `@Fake provider replied without text (message ${empty!.id}).`, `@Fake provider replied (message ${long!.id}):\n${"x".repeat(2000)}…`,
      "Read a message whole with `teamrun_list_messages`."].join("\n\n");
    Assert.areEqual(JSON.stringify([notes.id, null, "Fake provider", text]),
      JSON.stringify([wake!.sender?.conversationId, wake!.sender?.teammateId, wake!.sender?.name, wake!.details[0]?.text]));
    Assert.areEqual(JSON.stringify([wake!.id, MessageStatus.Completed]), JSON.stringify([reply!.inReplyTo, reply!.status]));
    Assert.areEqual(8, host.adapter.requests.length);
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async skipsAndLogsOnceAStoredWakeItCannotReadAndSettlesTheOthers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [first, second] = [await host.createConversationAsync(project, "Release plan"), await host.createConversationAsync(project, "Notes")];
    host.adapter.turnTexts = [["Asked."], ["Done."]];
    const asked = await ChatWakesTests.askDefault(host, first.id);
    const done = await ChatWakesTests.askDefault(host, second.id);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", first.id, "m1", second.id, [], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w2", "Reply", first.id, asked.id, second.id, [done.id], "Waiting", null, null);

    await ChatWakesTests.askDefault(host, second.id);
    await ChatWakesTests.askDefault(host, second.id);
    await host.engine.waitForIdle();

    const [, , wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("The chat wake w1 couldn't be read, so it was skipped: ")).length, host.log.lines.join("\n"));
    Assert.isTrue(wake!.details[0]!.text!.includes(`@Fake provider replied (message ${done.id}):\nDone.`), wake!.details[0]?.text ?? "");
    Assert.areEqual(JSON.stringify([wake!.id, MessageStatus.Completed]), JSON.stringify([woken!.inReplyTo, woken!.status]));
    Assert.areEqual("Waiting,Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async logsAWaitingSendThatFailsAsASendsOrAWakesRepliesEndAndStillSettlesTheWakesWatchingThatChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [first, second] = [await host.createConversationAsync(project, "Release plan"), await host.createConversationAsync(project, "Notes")];
    host.adapter.turnTexts = [["Asked."], ["Done."], ["Again."], ["Thanks."]];
    const asked = await ChatWakesTests.askDefault(host, first.id);
    const done = await ChatWakesTests.askDefault(host, second.id);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", first.id, asked.id, second.id, [done.id], "Waiting", null, null);
    const failure = new Error("The database is busy.");
    const failed: string[] = [];
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      const failing = chatId === second.id ? 3 : 4;
      if (Object.isUndefined(transaction) && host.engine.activeRunCount === 0 && host.adapter.requests.length === failing && !failed.includes(chatId)) {
        failed.push(chatId);
        throw failure;
      }
      return findOpenReplyAsync(chatId, transaction);
    };

    await ChatWakesTests.askDefault(host, second.id);
    await host.adapter.requested(4);
    await host.engine.waitForIdle();

    const [, , wake, woken] = await ChatWakesTests.chatAsync(host, first.id);
    const notSent = [second.id, first.id].map(t => Resources.formatWaitingMessageNotSent(t, Resources.formatFailureKind(failure)));
    Assert.areEqual(JSON.stringify([second.id, first.id]), JSON.stringify(failed));
    Assert.areEqual(JSON.stringify(notSent), JSON.stringify(host.log.lines.filter(t => notSent.includes(t))), host.log.lines.join("\n"));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
    Assert.areEqual(JSON.stringify([wake?.id, MessageStatus.Completed]), JSON.stringify([woken?.inReplyTo, woken?.status]));
  }

  @TestMethod
  public async logsTheWakesOfAChatItCannotSettleWhenTheirTableFailsAndStillEndsTheReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TABLE chatWakes"));

    const reply = await ChatWakesTests.askDefault(host, conversation.id);

    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith(`The wakes waiting on chat ${conversation.id} weren't settled: `)).length,
      host.log.lines.join("\n"));
  }

  @TestMethod
  public async runsATurnWithoutTheAwaitedReplyNoteAndLogsWhyWhenTheWakesTableFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TABLE chatWakes"));

    const reply = await ChatWakesTests.askDefault(host, conversation.id);

    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
    Assert.isFalse(host.adapter.requests[0]!.prompt.includes(Resources.awaitedReplyNote));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith(`Whether a sender waits for reply ${reply.id} wasn't read: `)).length, host.log.lines.join("\n"));
  }

  @TestMethod
  public async keepsTheHopOfAReplyWhoseProviderWakesItWhileItsGroupStillRuns(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 1);
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob, carol] = await ChatWakesTests.teamAsync(host, "Alice", "Bob", "Carol");
    const results: MessageSendResult[] = [];
    const woken: Promise<MessageSendResult>[] = [];
    let bobs: typeof host.adapter.lastListener = null;
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length === 2)
        bobs = host.adapter.lastListener;
    };
    host.adapter.holdTurn = async request => {
      if (request === host.adapter.requests[0])
        results.push(await host.engine.sendAsync(ChatWakesTests.from(request, second.id, "@Bob @Carol start", [bob!, carol!], false)));
      else if (request === host.adapter.requests[2]) {
        const wake = (await bobs!.onWakeAsync(new TurnWake("task-1", "npm run dev")))!;
        woken.push(host.engine.sendAsync(new MessageSendParams(second.id, "@Alice the server is up", null, null, [], [alice!.id], null,
          SenderEnvironment.read(wake.environment))).finally(() => wake.end(new TurnResult(TurnOutcome.Completed, null,
          new ObservedSettings("fake", null, null, null), null))));
        ChangeSignal.notify();
      }
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask them", null, null, [], [alice!.id]));
    await host.adapter.requested(3);
    await host.until("Bob's wake", () => woken.length === 1, host.runs());
    results.push(await woken[0]!);
    await host.engine.waitForIdle();

    Assert.areEqual(2, results[0]!.replies.length);
    Assert.areEqual(0, results[1]!.replies.length);
    Assert.areEqual(Resources.formatChainStopped(1), (await host.messages.findAsync(results[1]!.sent.id))?.details[1]?.text);
    Assert.areEqual(3, host.adapter.requests.length);
  }

  @TestMethod
  public async wakesTheSenderWithTheFailedRepliesOfASendThatFailedAfterItWasStored(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Fixes");
    const [alice, bob] = await ChatWakesTests.teamAsync(host, "Alice", "Bob");
    host.adapter.turnTexts = [["Asked."], ["Thanks."]];
    const refused: unknown[] = [];
    host.adapter.holdTurn = async request => {
      if (request !== host.adapter.requests[0])
        return;
      const broken = host.events.subscribe({
        onEvent: event => {
          if (event.name === EventName.MessageCreated && Message.fromJson(event.payload).conversationId === second.id)
            throw new RangeError("The window is gone.");
        }
      });
      await host.engine.sendAsync(ChatWakesTests.from(request, second.id, "@Bob fix it", [bob!])).catch((error: unknown) => refused.push(error));
      broken[Symbol.dispose]();
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice!.id]));
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    const bobReply = (await ChatWakesTests.chatAsync(host, second.id)).find(t => t.teammateId === bob!.id)!;
    const [, , wake, woken] = (await ChatWakesTests.chatAsync(host, first.id));
    const text = [`The work you sent to chat "Fixes" (${second.id}) has ended.`, `@Bob's reply (message ${bobReply.id}) failed.`,
      "Read a message whole with `teamrun_list_messages`."].join("\n\n");
    Assert.isTrue(refused[0] instanceof RangeError);
    Assert.areEqual(MessageStatus.Failed, bobReply.status);
    Assert.areEqual(JSON.stringify([text, alice!.id, wake!.id]), JSON.stringify([wake!.details[0]?.text, woken!.teammateId, woken!.inReplyTo]));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async deliversAReadyWakeAfterARestartAndNotesEachWaitingOneThatTheRestartLost(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const lost = await host.createConversationAsync(project, "Notes");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    const noted = await ChatWakesTests.askDefault(host, lost.id);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", "Bob finished.", 1);
    await ChatWakesTests.insertAsync(host, "w2", "Reply", lost.id, noted.id, fixes.id, ["r2"], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w3", "SubAgent", lost.id, noted.id, lost.id, ["agent-1"], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w4", "Reply", lost.id, noted.id, "gone-chat", ["r4"], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w5", "Later", lost.id, noted.id, lost.id, ["run-1"], "Waiting", null, null);

    await host.engine.reconcileAsync();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    const [, , wake, reply] = (await ChatWakesTests.chatAsync(host, woken.id));
    Assert.areEqual(JSON.stringify(["Bob finished.", fixes.id, "TeamRun", wake!.id, MessageStatus.Completed]),
      JSON.stringify([wake!.details[0]?.text, wake!.sender?.conversationId, wake!.sender?.name, reply!.inReplyTo, reply!.status]));
    Assert.isTrue(host.adapter.requests[2]!.prompt.includes("From TeamRun: Bob finished."), host.adapter.requests[2]!.prompt);
    Assert.areEqual(JSON.stringify([
      `TeamRun restarted before the work you sent to chat "Fixes" (${fixes.id}) ended, so no result came back and this chat wasn't woken.`,
      "TeamRun restarted before your sub-agent agent-1 ended, so no result came back and this chat wasn't woken.",
      "The chat gone-chat that you sent work to was deleted before its result came back, so this chat wasn't woken."
    ]), JSON.stringify((await ChatWakesTests.chatAsync(host, lost.id)).slice(2).map(t => t.details.map(u => u.text).join("|"))));
    Assert.areEqual(JSON.stringify([
      { source: "chatWake", wakeId: "w2", wakeSourceMessageId: noted.id, wakeChatId: fixes.id, wakeReplies: [], wakeEnd: "lost" },
      { source: "chatWake", wakeId: "w3", wakeSourceMessageId: noted.id },
      { source: "chatWake", wakeId: "w4", wakeSourceMessageId: noted.id, wakeChatId: "gone-chat", wakeReplies: [], wakeEnd: "chatDeleted" }
    ]), JSON.stringify((await ChatWakesTests.chatAsync(host, lost.id)).slice(2).map(t => t.details[0]?.payload)));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("The chat wake w5 couldn't be read, so it was skipped: ")).length, host.log.lines.join("\n"));
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual("Delivered,Undeliverable,Undeliverable,Undeliverable,Waiting", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async startsTheTurnOfAReadySubAgentWakeStoredWithoutAViewWithNoViewOrReceivedNote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    await ChatWakesTests.insertAsync(host, "w1", "SubAgent", woken.id, asked.id, woken.id, ["agent-1"], "Ready", "Your sub-agent \"Search\" (agent-1) ended as completed.", 1);

    await host.engine.reconcileAsync();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    const [, , wake, reply] = (await ChatWakesTests.chatAsync(host, woken.id));
    Assert.areEqual(JSON.stringify({ source: "chatWake", wakeId: "w1", wakeSourceMessageId: asked.id }), JSON.stringify(wake?.details[0]?.payload));
    Assert.areEqual(JSON.stringify([wake?.id, MessageStatus.Completed, false]),
      JSON.stringify([reply?.inReplyTo, reply?.status, JSON.stringify(reply?.details.map(t => t.payload) ?? null).includes("wakeReceived")]));
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async keepsWaitingAWakeWhoseOtherWatchedReplyStillRunsAndWakesTheNextOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const notes = await host.createConversationAsync(project, "Notes");
    const busy = await host.createConversationAsync(project, "Fixes");
    host.adapter.turnTexts = [["Asked."], ["Done."]];
    const asked = await ChatWakesTests.askDefault(host, first.id);
    const done = await ChatWakesTests.askDefault(host, notes.id);
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = request => request.prompt.includes("Busy") ? held.promise : Promise.resolve();
    const running = (await host.engine.sendAsync(new MessageSendParams(busy.id, "Busy", new RequestedSettings("fake", null, null),
      (await host.providerOfAsync()).id))).replies[0]!;
    await ChatWakesTests.insertAsync(host, "w1", "Reply", first.id, asked.id, notes.id, [done.id, running.id], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w2", "Reply", first.id, asked.id, notes.id, [done.id], "Waiting", null, null);

    await host.engine.sendAsync(new MessageSendParams(notes.id, "Again", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.until("the second wake delivered", async () => (await ChatWakesTests.statesAsync(host)) === "Waiting,Delivered", host.runs());
    held.resolve();
    await host.engine.waitForIdle();

    const [, , wake, woken] = await ChatWakesTests.chatAsync(host, first.id);
    Assert.isTrue(wake!.details[0]!.text!.includes(`@Fake provider replied (message ${done.id}):\nDone.`), wake!.details[0]?.text ?? "");
    Assert.areEqual(JSON.stringify([wake!.id, MessageStatus.Completed]), JSON.stringify([woken!.inReplyTo, woken!.status]));
    Assert.areEqual("Waiting,Delivered", await ChatWakesTests.statesAsync(host));
    Assert.areEqual(5, host.adapter.requests.length);
  }

  @TestMethod
  public async keepsAReadyWakeWhoseChatGetsBusyWhileItIsDeliveredAndDeliversItAfterThatReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const woken = await host.createConversationAsync(project, "Release plan");
    const fixes = await host.createConversationAsync(project, "Fixes");
    const asked = await ChatWakesTests.askDefault(host, woken.id);
    const providerId = (await host.providerOfAsync()).id;
    await ChatWakesTests.insertAsync(host, "w1", "Reply", woken.id, asked.id, fixes.id, ["r1"], "Ready", "Bob finished.", 1);
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = request => request.prompt.includes("Busy") ? held.promise : Promise.resolve();
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    let busied = false;
    host.conversations.findAsync = async (id, transaction) => {
      if (!busied && id === woken.id && Object.isUndefined(transaction)) {
        busied = true;
        await host.engine.sendAsync(new MessageSendParams(woken.id, "Busy", new RequestedSettings("fake", null, null), providerId));
      }
      return findAsync(id, transaction);
    };

    await host.engine.reconcileAsync();
    const kept = await ChatWakesTests.statesAsync(host);
    held.resolve();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    const chat = await ChatWakesTests.chatAsync(host, woken.id);
    Assert.isTrue(busied);
    Assert.areEqual("Ready", kept);
    Assert.areEqual("Delivered", await ChatWakesTests.statesAsync(host));
    Assert.areEqual(JSON.stringify(["Ask", "Busy", "Bob finished."]),
      JSON.stringify(chat.filter(t => t.author === MessageAuthor.User).map(t => t.details[0]?.text)));
    Assert.areEqual(3, host.adapter.requests.length);
  }

  @TestMethod
  public async notesAWakeItCannotStartATurnForWithTheReasonAndStartsNone(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 2);
    const project = await host.openProjectAsync();
    const created: Conversation[] = [];
    for (const title of ["Gone", "Removed", "Deleted", "Disabled", "Limited", "Unavailable"])
      created.push(await host.createConversationAsync(project, title));
    const [gone, removed, deleted, disabled, limited, unavailable] = created;
    const [alice, carol] = await ChatWakesTests.teamAsync(host, "Alice", "Carol");
    const dave = await host.teammates.createAsync(new TeammateCreateParams("Dave", "Dave's role", (await host.createProviderAsync("fake", "Spare")).id, Harness.Provider,
      null, null));
    const off = await host.createProviderAsync("fake", "Off");
    const sources = [
      await ChatWakesTests.askDefault(host, gone!.id),
      await ChatWakesTests.ask(host, removed!.id, alice!),
      await ChatWakesTests.ask(host, deleted!.id, carol!),
      (await host.engine.sendAsync(new MessageSendParams(disabled!.id, "Ask", new RequestedSettings("fake", null, null), off.id))).replies[0]!,
      await ChatWakesTests.ask(host, limited!.id, alice!),
      await ChatWakesTests.ask(host, unavailable!.id, dave)
    ];
    await host.engine.waitForIdle();
    await host.conversations.removeMemberAsync(new ConversationMemberParams(removed!.id, alice!.id));
    await host.teammates.deleteAsync(new TeammateIdParams(carol!.id));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(dave.providerId, false));
    const chats = [gone!, removed!, deleted!, disabled!, limited!, unavailable!];
    for (const [index, chat] of chats.entries())
      await ChatWakesTests.insertAsync(host, `w${index}`, "Reply", chat.id, index === 0 ? "missing" : sources[index]!.id, chat.id,
        ["r"], "Ready", "Done.", index === 4 ? 3 : 1);
    const requests = host.adapter.requests.length;

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([
      "Done.|This chat wasn't woken: the reply that asked for it is gone.",
      "Done.|This chat wasn't woken: the teammate that asked for it is no longer in this chat.",
      "Done.|This chat wasn't woken: the teammate that asked for it is no longer in this chat.",
      `Done.|This chat wasn't woken: the provider that asked for it can't start a turn: The provider "Off" is disabled. Enable it on the Providers page first.`,
      `Done.|${Resources.formatChainStopped(2)}`,
      "Done.|This chat wasn't woken: the provider that asked for it is turned off or signed out."
    ]), JSON.stringify((await Promise.all(chats.map(t => ChatWakesTests.chatAsync(host, t.id)))).map(t => t.at(-1)!.details.map(u => u.text).join("|"))));
    Assert.areEqual(JSON.stringify({ source: "chatWake", wakeId: "w1", wakeSourceMessageId: sources[1]!.id, wakeChatId: removed!.id, wakeReplies: [] }),
      JSON.stringify((await ChatWakesTests.chatAsync(host, removed!.id)).at(-1)!.details[0]?.payload));
    Assert.areEqual(requests, host.adapter.requests.length);
    Assert.areEqual("Undeliverable,Undeliverable,Undeliverable,Undeliverable,Undeliverable,Undeliverable", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async failsAWakesDeliveryWithTheFailureOfAReadForItsTurnRatherThanNotingTheProviderRefused(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project, "Asked");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", "Alice's role", (await host.createProviderAsync()).id, Harness.Provider,
      null, null));
    const source = await ChatWakesTests.ask(host, chat.id, alice);
    await ChatWakesTests.insertAsync(host, "w1", "Reply", chat.id, source.id, chat.id, ["r"], "Ready", "Done.", 1);
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TABLE preferences"));
    const failure = await host.context.database.connection.queryAsync(new SqlQuery("SELECT json FROM preferences")).then(() => null, (error: unknown) => error);
    const messages = (await ChatWakesTests.chatAsync(host, chat.id)).length;
    const requests = host.adapter.requests.length;

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([`The wakes waiting on chat ${chat.id} weren't settled: ${Resources.formatFailureKind(failure)}`]),
      JSON.stringify(host.log.lines.filter(t => t.startsWith(`The wakes waiting on chat ${chat.id} weren't settled: `))), host.log.lines.join("\n"));
    Assert.areEqual(messages, (await ChatWakesTests.chatAsync(host, chat.id)).length);
    Assert.areEqual(requests, host.adapter.requests.length);
    Assert.areEqual("Ready", await ChatWakesTests.statesAsync(host));
  }

  @TestMethod
  public async deletesAChatsOwnWakesAndNotesEachWaitingWakeWatchingItInItsChatWithNoTurnButKeepsAReadyOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [first, second, third] = [await host.createConversationAsync(project), await host.createConversationAsync(project), await host.createConversationAsync(project)];
    await ChatWakesTests.insertAsync(host, "w1", "Reply", first.id, "m1", second.id, ["r1"], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w2", "Reply", second.id, "m2", first.id, ["r2"], "Ready", "Done.", 1);
    await ChatWakesTests.insertAsync(host, "w3", "Reply", second.id, "m3", first.id, ["r3"], "Waiting", null, null);
    await ChatWakesTests.insertAsync(host, "w4", "Reply", second.id, "m4", third.id, ["r4"], "Waiting", null, null);

    await host.conversations.deleteAsync(new ConversationIdParams(first.id));
    await host.engine.forgetAsync([first.id]);

    const note = `The chat ${first.id} that you sent work to was deleted before its result came back, so this chat wasn't woken.`;
    const rows = await host.context.database.connection.queryAsync(new SqlQuery("SELECT id, state FROM chatWakes ORDER BY id"));
    Assert.areEqual("w2 Ready,w3 Undeliverable,w4 Waiting", rows.map(t => `${t.readString("id")} ${t.readString("state")}`).join());
    Assert.areEqual(JSON.stringify([note]), JSON.stringify((await ChatWakesTests.chatAsync(host, second.id)).map(t => t.details.map(u => u.text).join("|"))));
    Assert.areEqual(JSON.stringify([
      { source: "chatWake", wakeId: "w3", wakeSourceMessageId: "m3", wakeChatId: first.id, wakeReplies: [], wakeEnd: "chatDeleted" }
    ]), JSON.stringify((await ChatWakesTests.chatAsync(host, second.id)).map(t => t.details[0]?.payload)));
    Assert.areEqual(0, host.adapter.requests.length);
  }

  private static from(request: TurnRequest, targetId: string, text: string, mentioned: readonly Teammate[], wake: boolean = true): MessageSendParams {
    return new MessageSendParams(targetId, text, null, null, [], mentioned.map(t => t.id), null, SenderEnvironment.read(request.environment), wake);
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<Teammate[]> {
    const provider = await host.createProviderAsync();
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, provider.id, Harness.Provider, null, null)));
    return team;
  }

  private static async ask(host: CoreHost, conversationId: string, teammate: Teammate): Promise<Message> {
    const sent = await host.engine.sendAsync(new MessageSendParams(conversationId, `@${teammate.name} ask`, null, null, [], [teammate.id]));
    await host.engine.waitForIdle();
    return sent.replies[0]!;
  }

  private static async askDefault(host: CoreHost, conversationId: string): Promise<Message> {
    const sent = await host.engine.sendAsync(new MessageSendParams(conversationId, "Ask", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    return sent.replies[0]!;
  }

  private static async insertAsync(host: CoreHost, id: string, kind: string, chatId: string, sourceMessageId: string, watchedChatId: string,
    watchedIds: readonly string[], state: string, text: string | null, hop: number | null): Promise<void> {
    const json = { id, kind, chatId, sourceMessageId, watchedChatId, watchedIds, state, text, hop, createdAt: "t" };
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO chatWakes (id, chatId, state, json, updatedAt) VALUES (?, ?, ?, ?, 't')",
      [id, chatId, state, JSON.stringify(json)]));
  }

  private static async statesAsync(host: CoreHost): Promise<string> {
    return (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes ORDER BY id"))).map(t => t.readString("state")).join(",");
  }

  private static chatAsync(host: CoreHost, conversationId: string): Promise<readonly Message[]> {
    return host.messages.listAsync(new MessageListParams(conversationId, null));
  }
}
