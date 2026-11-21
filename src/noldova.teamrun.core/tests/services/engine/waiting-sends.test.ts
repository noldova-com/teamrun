/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentStore, QuestionAsk, RequestDispatcher, Resources, type TurnSteer } from "@noldova/teamrun.core";
import {
  ApprovalDecideParams,
  ApprovalQuestion,
  AttachmentInput,
  ChatIdParams,
  ConversationIdParams,
  ConversationResponder,
  ConversationResponderParams,
  ErrorCode,
  EventName,
  Harness,
  type MessageAttachment,
  MessageAuthor,
  MessageDelivery,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ProviderEnabledParams,
  QuestionAnswer,
  QuestionOption,
  RequestedSettings,
  Resources as ProtocolResources,
  SenderEnvironment,
  TeammateCreateParams,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams
} from "@noldova/teamrun.protocol";
import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class WaitingSendsTests {
  @TestMethod
  public async steersAWaitingMessageIntoTheRunningReplyAndKeepsItInTheChatOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: TurnSteer[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t);
      return Promise.resolve(true);
    });
    const first = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const prepared = host.engine.prepareAttachment(new AttachmentInput("a.txt", "text/plain", "YQ==", null));

    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.withFileAsync(host, chat.id, "Look at this too", prepared),
      MessageDelivery.Steer));
    await host.until("the steered message", async () => await WaitingSendsTests.sentAsync(host, chat.id) === "First,Look at this too");
    const steered = (await host.messages.listAsync(new MessageListParams(chat.id, null))).find(t => t.details[0]?.text === "Look at this too");
    const waiting = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length;
    release();
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "Next"));
    await host.engine.waitForIdle();

    Assert.areEqual(1, steers.length);
    Assert.areEqual(AttachmentStore.formatPrompt("Look at this too", steered?.attachments ?? []), steers[0]?.text);
    Assert.areEqual(steered?.attachments[0]?.path, steers[0]?.attachments[0]?.path);
    Assert.isTrue(existsSync(steered?.attachments[0]?.path ?? ""));
    Assert.isFalse(existsSync(join(host.directory.path, "attachments", "waiting-files", chat.id, added.id)));
    Assert.areEqual(JSON.stringify({ [Resources.steeredIntoField]: first.replies[0]?.id }), JSON.stringify(steered?.details[0]?.payload ?? null));
    Assert.areEqual(0, waiting);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual("Next", host.adapter.requests[1]?.prompt);
    Assert.isTrue(host.adapter.requests[1]?.freshPrompt?.includes("Look at this too") === true, String(host.adapter.requests[1]?.freshPrompt));
  }

  @TestMethod
  public async queuesASteerTheReplyRefusesAndSendsItOnceTheReplyEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t.text);
      return Promise.reject(new Error("The turn just ended"));
    });
    const first = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Refused"), MessageDelivery.Steer));
    await host.until("the refused steer", async () => (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages[0]?.delivery === MessageDelivery.Queue);
    const queued = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => `${t.id}:${t.createdAt}`).join();
    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    Assert.areEqual("Refused", steers.join());
    Assert.areEqual(`${added.id}:${added.createdAt}`, queued);
    Assert.areEqual("First,Refused", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("Refused") === true, String(host.adapter.requests[1]?.prompt));
    Assert.areEqual(1, host.log.lines.filter(t => t === Resources.formatSteerRefused(first.replies[0]?.id ?? "", Resources.formatFailureKind(new Error("x")))).length,
      host.log.lines.join("\n"));
  }

  @TestMethod
  public async sendsASteerRefusedAfterTheReplyEndedBeforeAMessageQueuedBehindIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const answer = Promise.withResolvers<boolean>();
    const steers: string[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t.text);
      return answer.promise;
    });
    const first = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const steered = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Steered"), MessageDelivery.Steer));
    await host.until("the steer in flight", () => steers.length === 1);
    const queued = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Queued"), MessageDelivery.Queue));

    release();
    await host.until("the reply's end", async () => (await host.messages.findAsync(first.replies[0]?.id ?? ""))?.status === MessageStatus.Completed);
    const requestsAtTheEnd = host.adapter.requests.length;
    answer.resolve(false);
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(1, requestsAtTheEnd);
    Assert.isTrue(steered.createdAt < queued.createdAt, `${steered.createdAt} ${queued.createdAt}`);
    Assert.areEqual("First,Steered,Queued", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual("Steered|Queued", host.adapter.requests.slice(1).map(t => t.prompt.includes("Steered") ? "Steered" : t.prompt.includes("Queued") ? "Queued" : t.prompt).join("|"));
  }

  @TestMethod
  public async waitsForAReplyToOfferASteerAndQueuesOneWhoseFileIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const gate = Promise.withResolvers<void>();
    WaitingSendsTests.notifyOnEvents(host);
    host.adapter.holdTurn = () => host.adapter.requests.length === 1 ? gate.promise : Promise.resolve();
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const prepared = host.engine.prepareAttachment(new AttachmentInput("a.txt", "text/plain", "YQ==", null));
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Later"), MessageDelivery.Steer));
    const gone = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.withFileAsync(host, chat.id, "Gone file", prepared),
      MessageDelivery.Steer));
    rmSync(join(host.directory.path, "attachments", "waiting-files", chat.id, gone.id), { recursive: true, force: true });
    const before = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => t.delivery).join();

    host.adapter.lastListener?.onSteerable?.(t => {
      steers.push(t.text);
      return Promise.resolve(true);
    });
    await host.until("the gone file's refusal", async () => (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => t.delivery).join()
      === MessageDelivery.Queue);
    gate.resolve();
    await host.engine.waitForIdle();
    const after = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages;

    Assert.areEqual(`${MessageDelivery.Steer},${MessageDelivery.Steer}`, before);
    Assert.areEqual("Later", steers.join());
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(`${gone.id}|${MessageDelivery.Queue}|true`, after.map(t => `${t.id}|${t.delivery}|${!Object.isNull(t.failure)}`).join());
    Assert.areEqual(2, host.log.lines.filter(t => t.startsWith(`A waiting message in the chat ${chat.id} wasn't sent: `)).length, host.log.lines.join("\n"));
  }

  @TestMethod
  public async steersOnlyIntoTheReplyOfATeammateItNames(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const providerId = (await host.providerOfAsync()).id;
    const steers: string[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t.text);
      return Promise.resolve(true);
    });
    const addAsync = (text: string, mentioned: readonly string[], responder: string | null): Promise<WaitingMessage> => {
      const named = mentioned.length > 0 || !Object.isNull(responder);
      return host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, text, named ? null : new RequestedSettings("fake", null, null),
        named ? null : providerId, [], mentioned, responder), MessageDelivery.Steer));
    };
    await host.engine.sendAsync(new MessageSendParams(chat.id, "@Alice look", null, null, [], [alice.id]));
    await host.adapter.requested(1);

    await addAsync("@Bob too", [bob.id], null);
    await addAsync("For @Alice", [alice.id], null);
    await host.until("Alice's steer", () => steers.length === 1);
    await addAsync("Answer, Alice", [], alice.id);
    await host.until("the answer's steer", () => steers.length === 2);
    await addAsync("Anyone", [], null);
    await host.until("the plain steer", () => steers.length === 3);
    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    Assert.areEqual("For @Alice,Answer, Alice,Anyone", steers.join());
    Assert.areEqual(alice.id, (await host.messages.listAsync(new MessageListParams(chat.id, null))).find(t => t.details[0]?.text === "For @Alice")?.mentions[0]?.teammateId);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("@Bob too") === true, String(host.adapter.requests[1]?.prompt));
    Assert.areEqual(bob.id, (await host.messages.listAsync(new MessageListParams(chat.id, null))).filter(t => t.author === MessageAuthor.Provider).at(-1)?.teammateId);
  }

  @TestMethod
  public async steersOneMessageAtATimeAndLeavesFailedOnesNamedOnesAndOtherChatsAlone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(project);
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, (await host.createProviderAsync()).id, Harness.Provider, null, null));
    const providerId = (await host.providerOfAsync()).id;
    const steers: string[] = [];
    const held = Promise.withResolvers<boolean>();
    const gate = Promise.withResolvers<void>();
    WaitingSendsTests.notifyOnEvents(host);
    host.adapter.holdTurn = request => {
      if (request === host.adapter.requests[0])
        host.adapter.lastListener?.onSteerable?.(t => {
          steers.push(t.text);
          ChangeSignal.notify();
          return steers.length === 1 ? held.promise : Promise.resolve(true);
        });
      return request === host.adapter.requests[0] || request === host.adapter.requests[1] ? gate.promise : Promise.resolve();
    };
    const failed = new WaitingMessage("waiting-failed", MessageDelivery.Steer, await WaitingSendsTests.paramsAsync(host, chat.id, "Failed"), "2026-11-03T00:00:00.000Z",
      "It failed before");
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO waitingMessages (id, chatId, json, updatedAt) VALUES (?, ?, ?, 't')",
      [failed.id, chat.id, JSON.stringify(failed.toJson())]));
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, other.id, "Other first"));
    await host.adapter.requested(2);

    const steerAsync = (chatId: string, text: string, mentioned: readonly string[] = []): Promise<WaitingMessage> => host.engine.addWaitingAsync(new WaitingMessageAddParams(
      new MessageSendParams(chatId, text, new RequestedSettings("fake", null, null), providerId, [], mentioned), MessageDelivery.Steer));
    await steerAsync(chat.id, "One");
    await host.until("the first steer", () => steers.length === 1);
    await steerAsync(chat.id, "Two");
    await steerAsync(chat.id, "@Bob named", [bob.id]);
    await steerAsync(other.id, "Elsewhere");
    const whileHeld = steers.join();
    held.resolve(true);
    await host.until("the second steer", () => steers.length === 2);
    gate.resolve();
    await host.engine.waitForIdle();

    Assert.areEqual("One", whileHeld);
    Assert.areEqual("One,Two", steers.join());
    Assert.areEqual("First,One,Two,@Bob named", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual("Other first,Elsewhere", await WaitingSendsTests.sentAsync(host, other.id));
    Assert.areEqual(failed.id, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => t.id).join());
  }

  @TestMethod
  public async logsASteeredMessageThatCantBeKeptAndGoesOnWithTheNext(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t.text);
      return Promise.resolve(true);
    });
    const insertAsync = host.messages.insertAsync.bind(host.messages);
    host.messages.insertAsync = async (message, transaction) => {
      if (message.details[0]?.text === "Lost")
        throw new Error("The disk is full");
      await insertAsync(message, transaction);
    };
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Lost"), MessageDelivery.Steer));
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Kept"), MessageDelivery.Steer));
    await host.until("the second steer", async () => await WaitingSendsTests.sentAsync(host, chat.id) === "First,Kept");
    release();
    await host.engine.waitForIdle();

    Assert.areEqual("Lost,Kept", steers.join());
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(JSON.stringify([Resources.formatSteeredMessageNotKept(chat.id, "Error")]), JSON.stringify(host.log.lines.filter(t => t.includes("steer"))));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async queuesAPersonsMessagesWhileAReplyRunsAndSendsThemInOrderOnceItEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    const second = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Second"), MessageDelivery.Queue));
    const third = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Third"), MessageDelivery.Steer));
    const waiting = await host.engine.listWaitingAsync(new ChatIdParams(chat.id));
    release();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([second.id, third.id]), JSON.stringify(waiting.messages.map(t => t.id)));
    Assert.areEqual("Queue|Steer|null", [second.delivery, third.delivery, String(second.failure)].join("|"));
    Assert.areEqual("First,Second,Third", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("Second") === true && host.adapter.requests[2]?.prompt.includes("Third") === true,
      String(host.adapter.requests[2]?.prompt));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(4, host.listener.count(EventName.WaitingMessagesChanged));
  }

  @TestMethod
  public async logsAWaitingListItCantReadAfterTakingAMessageOffAndStillSendsTheMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Queued"), MessageDelivery.Queue));
    const failure = new Error("The database is busy.");
    const notSent = Resources.formatWaitingMessageNotSent(chat.id, Resources.formatFailureKind(failure));
    const failed: string[] = [];
    const connection = host.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    const queryAsync = connection.queryAsync.bind(connection);
    let transactions = 0;
    connection.runInTransactionAsync = async work => {
      transactions += 1;
      try {
        return await runInTransactionAsync(work);
      }
      finally {
        transactions -= 1;
      }
    };
    connection.queryAsync = query => {
      if (transactions === 0 && failed.length === 0 && query.text.includes("FROM waitingMessages WHERE chatId")) {
        failed.push(chat.id);
        return Promise.reject(failure);
      }
      return queryAsync(query);
    };
    const shown = host.listener.count(EventName.WaitingMessagesChanged);

    release();
    await host.until("the queued send or its failure", () => host.adapter.requests.length === 2 || host.log.lines.includes(notSent));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([chat.id]), JSON.stringify(failed));
    Assert.isTrue(host.log.lines.includes(Resources.formatWaitingMessagesNotShown(chat.id, Resources.formatFailureKind(failure))), host.log.lines.join("\n"));
    Assert.areEqual("First,Queued", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(shown + 1, host.listener.count(EventName.WaitingMessagesChanged));
  }

  @TestMethod
  public async logsAWaitingListItCantReadAfterTakingASteerOffAndStillSteersTheMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const release = WaitingSendsTests.offerSteer(host, t => {
      steers.push(t.text);
      return Promise.resolve(true);
    });
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const failure = new Error("The database is busy.");
    const failed: string[] = [];
    const connection = host.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    const queryAsync = connection.queryAsync.bind(connection);
    let takenOff = false;
    connection.runInTransactionAsync = async work => {
      const result = await runInTransactionAsync(work);
      takenOff ||= result instanceof WaitingMessage;
      return result;
    };
    connection.queryAsync = query => {
      if (takenOff && failed.length === 0 && query.text.includes("FROM waitingMessages WHERE chatId")) {
        failed.push(chat.id);
        return Promise.reject(failure);
      }
      return queryAsync(query);
    };
    const shown = host.listener.count(EventName.WaitingMessagesChanged);

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Steered"), MessageDelivery.Steer));
    const notKept = Resources.formatSteeredMessageNotKept(chat.id, Resources.formatFailureKind(failure));
    await host.until("the steered message shown again or its loss", async () => host.log.lines.includes(notKept)
      || host.listener.count(EventName.WaitingMessagesChanged) === shown + 2 && await WaitingSendsTests.sentAsync(host, chat.id) === "First,Steered");
    release();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([chat.id]), JSON.stringify(failed));
    Assert.isTrue(host.log.lines.includes(Resources.formatWaitingMessagesNotShown(chat.id, Resources.formatFailureKind(failure))), host.log.lines.join("\n"));
    Assert.areEqual(JSON.stringify(["Steered"]), JSON.stringify(steers));
    Assert.areEqual("First,Steered", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(shown + 2, host.listener.count(EventName.WaitingMessagesChanged));
  }

  @TestMethod
  public async sendsOneOfTwoQueueMessagesAddedToAnIdleChatAtOnceAndTheOtherOnceItsReplyEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    const one = await WaitingSendsTests.paramsAsync(host, chat.id, "One");
    const two = await WaitingSendsTests.paramsAsync(host, chat.id, "Two");
    const notSent = `A waiting message in the chat ${chat.id} wasn't sent: `;

    await Promise.all([one, two].map(t => host.engine.addWaitingAsync(new WaitingMessageAddParams(t, MessageDelivery.Queue))));
    await host.adapter.requested(1);
    const whileHeld = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => `${t.message.text}:${String(t.failure)}`).join();
    release();
    await host.until("the second message's send or failure", () => host.adapter.requests.length === 2 || host.log.lines.some(t => t.startsWith(notSent)));
    await host.engine.waitForIdle();

    Assert.areEqual("Two:null", whileHeld);
    Assert.areEqual("One,Two", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(0, host.log.lines.filter(t => t.startsWith(notSent)).length, host.log.lines.join("\n"));
  }

  @TestMethod
  public async steersAWaitingMessageAsEditedWhileItsSteerWasStarting(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const release = WaitingSendsTests.holdFirst(host);
    WaitingSendsTests.notifyOnEvents(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Before the edit"),
      MessageDelivery.Steer));
    const edit = new WaitingMessageEditParams(added.id, await WaitingSendsTests.paramsAsync(host, chat.id, "After the edit"));
    const connection = host.context.database.connection;
    const queryAsync = connection.queryAsync.bind(connection);
    const editing: Promise<WaitingMessage>[] = [];
    connection.queryAsync = query => {
      const read = queryAsync(query);
      if (editing.length === 0 && query.text.includes("FROM waitingMessages WHERE chatId"))
        editing.push(host.engine.editWaitingAsync(edit));
      return read;
    };

    host.adapter.lastListener?.onSteerable?.(t => {
      steers.push(t.text);
      ChangeSignal.notify();
      return Promise.resolve(true);
    });
    await host.until("the steer", () => steers.length === 1);
    await Promise.all(editing);
    release();
    await host.engine.waitForIdle();

    Assert.areEqual(1, editing.length);
    Assert.isTrue(steers[0]?.includes("After the edit") === true, steers.join());
    Assert.areEqual("First,After the edit", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async steersNothingForAWaitingMessageRemovedWhileItsSteerWasStarting(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const steers: string[] = [];
    const release = WaitingSendsTests.holdFirst(host);
    WaitingSendsTests.notifyOnEvents(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Removed"),
      MessageDelivery.Steer));
    const connection = host.context.database.connection;
    const queryAsync = connection.queryAsync.bind(connection);
    const removing: Promise<void>[] = [];
    connection.queryAsync = query => {
      const read = queryAsync(query);
      if (removing.length === 0 && query.text.includes("FROM waitingMessages WHERE chatId")) {
        removing.push(host.engine.removeWaitingAsync(new WaitingMessageIdParams(added.id)));
        ChangeSignal.notify();
      }
      return read;
    };

    host.adapter.lastListener?.onSteerable?.(t => {
      steers.push(t.text);
      return Promise.resolve(true);
    });
    await host.until("the removal", () => removing.length === 1);
    await Promise.all(removing);
    connection.queryAsync = queryAsync;
    release();
    await host.engine.waitForIdle();

    Assert.areEqual(String.empty, steers.join());
    Assert.areEqual("First", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async logsAnAnswerThatCantBeSentOnceTheChatIsFreedAndSendsItAfterTheNextReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.adapter.questionPosts = [WaitingSendsTests.question()];
    host.adapter.holdTurn = () => {
      host.adapter.questionPosts = [];
      return Promise.resolve();
    };
    const gate = Promise.withResolvers<void>();
    const failure = new Error("The database is busy.");
    const checks = { armed: false, held: false, released: false, failed: 0 };
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      if (checks.released && checks.failed === 0 && Object.isUndefined(transaction)) {
        checks.failed += 1;
        throw failure;
      }
      if (checks.armed && !checks.held && host.engine.activeRunCount === 0 && Object.isUndefined(transaction)) {
        checks.held = true;
        ChangeSignal.notify();
        await gate.promise;
      }
      return findOpenReplyAsync(chatId, transaction);
    };

    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    checks.armed = true;
    const idle = host.engine.waitForIdle();
    await host.until("the held idle check", () => checks.held);
    const [question] = await host.approvals.listAsync(new ConversationIdParams(chat.id));
    Assert.isDefined(question);
    await host.engine.decideAsync(new ApprovalDecideParams(question.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    checks.released = true;
    gate.resolve();
    await idle;
    const line = Resources.formatQuestionReplyNotSent(chat.id, Resources.formatFailureKind(failure));
    const logged = host.log.lines.filter(t => t === line).length;
    const before = await WaitingSendsTests.sentAsync(host, chat.id);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "Next"));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(1, checks.failed);
    Assert.areEqual(1, logged, host.log.lines.join("\n"));
    Assert.areEqual("First", before);
    Assert.areEqual("First,Next,> Which platform?\n\nWeb", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async logsAWaitingSendThatFailsOnceTheChatIsFreedAndSendsItAfterTheAnswersReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.adapter.questionPosts = [WaitingSendsTests.question()];
    const failure = new Error("The database is busy.");
    const notSent = Resources.formatWaitingMessageNotSent(chat.id, Resources.formatFailureKind(failure));
    const checks = { first: String.empty, failing: false, failed: 0 };
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      const open = await findOpenReplyAsync(chatId, transaction);
      if (checks.failing && Object.isUndefined(transaction) && !Object.isNull(open) && open.id !== checks.first) {
        checks.failed += 1;
        throw failure;
      }
      return open;
    };
    host.adapter.holdTurn = async request => {
      if (request === host.adapter.requests[0]) {
        host.adapter.questionPosts = [];
        await host.until("the posted question", async () => (await host.approvals.listAsync(new ConversationIdParams(chat.id))).length === 1);
        const [question] = await host.approvals.listAsync(new ConversationIdParams(chat.id));
        await host.engine.decideAsync(new ApprovalDecideParams(question?.id ?? String.empty, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
        await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Queued"), MessageDelivery.Queue));
        checks.failing = true;
      }
      else if (request === host.adapter.requests[1]) {
        await host.until("the logged waiting send", () => host.log.lines.includes(notSent));
        checks.failing = false;
      }
    };

    const sent = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    checks.first = sent.replies[0]?.id ?? String.empty;
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.isTrue(checks.failed > 0, String(checks.failed));
    Assert.isTrue(host.log.lines.includes(notSent), host.log.lines.join("\n"));
    Assert.areEqual("First,> Which platform?\n\nWeb,Queued", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
  }

  @TestMethod
  public async logsTheWaitingSendAfterASteerWhenItFailsAndKeepsSending(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const failure = new Error("The database is busy.");
    const stopped = Resources.formatChatSendingStopped(chat.id, Resources.formatFailureKind(failure));
    const checks = { failing: false };
    const release = WaitingSendsTests.offerSteer(host, () => {
      checks.failing = true;
      return Promise.resolve(true);
    });
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      if (checks.failing && Object.isUndefined(transaction)) {
        checks.failing = false;
        throw failure;
      }
      return await findOpenReplyAsync(chatId, transaction);
    };
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Steered"), MessageDelivery.Steer));
    await host.until("the logged stop", () => host.log.lines.includes(stopped));
    release();
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "Later"));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([stopped]), JSON.stringify(host.log.lines), host.log.lines.join("\n"));
    Assert.areEqual("First,Steered,Later", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(2, host.adapter.requests.length);
  }

  @TestMethod
  public async givesEachWaitingMessageALaterTimeThanTheOneBeforeEvenInTheSameMillisecond(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    const added: WaitingMessage[] = [];
    for (let i = 0; i < 20; i++)
      added.push(await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, `Waiting ${i}`), MessageDelivery.Queue)));
    release();
    await host.adapter.requested(21);
    await host.engine.waitForIdle();

    Assert.areEqual("", added.slice(1).filter((t, i) => t.createdAt <= (added[i]?.createdAt ?? "")).map(t => t.createdAt).join());
  }

  @TestMethod
  public async stopsTheRunningReplyForAStopAndSendMessageAndSendsItBeforeTheQueuedOnes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    WaitingSendsTests.holdFirstUntilStopped(host);
    const first = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Later"), MessageDelivery.Queue));
    const now = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Now"), MessageDelivery.StopAndSend));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(MessageDelivery.StopAndSend, now.delivery);
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(first.replies[0]?.id ?? ""))?.status);
    Assert.areEqual("First,Now,Later", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async sendsAQueuedMessageAfterTheAnswersToTheReplysQuestionsAndBeforeItsReadyWake(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const queuedParams = await WaitingSendsTests.paramsAsync(host, first.id, "Queued");
    host.adapter.questionPosts = [new QuestionAsk("msg-1", "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)])];
    host.adapter.holdTurn = async request => {
      if (request !== host.adapter.requests[0])
        return;
      host.adapter.questionPosts = [];
      const wake = new MessageSendParams(second.id, "@Bob fix it", null, null, [], [bob.id], null, SenderEnvironment.read(request.environment), true);
      await host.engine.sendAsync(wake);
      await host.until("the ready wake", async () => (await host.context.database.connection.queryAsync(new SqlQuery("SELECT state FROM chatWakes")))
        .map(t => t.readString("state")).join() === "Ready");
      await host.until("the posted question", async () => (await host.approvals.listAsync(new ConversationIdParams(first.id))).length === 1);
      const [question] = await host.approvals.listAsync(new ConversationIdParams(first.id));
      await host.engine.decideAsync(new ApprovalDecideParams(question?.id ?? "", Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
      await host.engine.addWaitingAsync(new WaitingMessageAddParams(queuedParams, MessageDelivery.Queue));
    };

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask Bob", null, null, [], [alice.id]));
    await host.adapter.requested(5);
    await host.engine.waitForIdle();
    const people = (await host.messages.listAsync(new MessageListParams(first.id, null))).filter(t => t.author === MessageAuthor.User).map(t => t.details[0]);

    Assert.areEqual("@Alice ask Bob|> Which platform?\n\nWeb|Queued", people.slice(0, 3).map(t => t?.text).join("|"));
    Assert.isTrue(JSON.stringify(people[3]?.payload ?? null).includes(ProtocolResources.chatWakeSource), JSON.stringify(people[3] ?? null));
    Assert.areEqual(4, people.length);
  }

  @TestMethod
  public async sendsAnAnswerGivenWhileTheEndedRepliesWaitingSendHoldsTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.adapter.questionPosts = [new QuestionAsk("msg-1", "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)])];
    host.adapter.holdTurn = () => {
      host.adapter.questionPosts = [];
      return Promise.resolve();
    };
    const gate = Promise.withResolvers<void>();
    const checks = { armed: false, held: false, released: false, after: 0 };
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      if (checks.released)
        checks.after += 1;
      else if (checks.armed && !checks.held && host.engine.activeRunCount === 0 && Object.isUndefined(transaction)) {
        checks.held = true;
        ChangeSignal.notify();
        await gate.promise;
      }
      return findOpenReplyAsync(chatId, transaction);
    };

    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    checks.armed = true;
    const idle = host.engine.waitForIdle();
    await host.until("the held idle check", () => checks.held);
    const [question] = await host.approvals.listAsync(new ConversationIdParams(chat.id));
    Assert.isDefined(question);
    await host.engine.decideAsync(new ApprovalDecideParams(question.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    checks.released = true;
    gate.resolve();
    await idle;
    const retried = checks.after;

    Assert.isTrue(retried > 0, String(retried));
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    Assert.areEqual("First,> Which platform?\n\nWeb", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async keepsAWaitingMessagesFilesUntilItIsSentEditedRemovedOrItsChatDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(project);
    const folder = (...names: string[]): string => join(host.directory.path, "attachments", "waiting-files", ...names);
    const prepare = (): MessageAttachment => host.engine.prepareAttachment(new AttachmentInput("a.txt", "text/plain", "YQ==", null));
    const addAsync = (params: MessageSendParams): Promise<WaitingMessage> => host.engine.addWaitingAsync(new WaitingMessageAddParams(params, MessageDelivery.Queue));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    const prepared = prepare();
    const sent = await addAsync(await WaitingSendsTests.withFileAsync(host, chat.id, "Sent", prepared));
    const edited = await addAsync(await WaitingSendsTests.withFileAsync(host, chat.id, "Edited", prepared));
    const removed = await addAsync(await WaitingSendsTests.withFileAsync(host, chat.id, "Removed", prepared));
    host.engine.discardAttachment(prepared);
    host.drafts.removeFiles(chat.id);
    const held = [sent, edited, removed].map(t => readdirSync(folder(chat.id, t.id)).length).join();
    await host.engine.editWaitingAsync(new WaitingMessageEditParams(edited.id, await WaitingSendsTests.paramsAsync(host, chat.id, "Edited, no file")));
    await host.engine.removeWaitingAsync(new WaitingMessageIdParams(removed.id));
    Assert.areEqual("1,1,1|true,false,false", [held, [sent, edited, removed].map(t => existsSync(folder(chat.id, t.id))).join()].join("|"));
    release();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();
    const message = (await host.messages.listAsync(new MessageListParams(chat.id, null))).find(t => t.details[0]?.text === "Sent");
    Assert.areEqual("a", readFileSync(message?.attachments[0]?.path ?? "", "utf8"));
    Assert.isFalse(existsSync(folder(chat.id, sent.id)));

    const kept = prepare();
    await addAsync(new MessageSendParams(other.id, "To nobody", new RequestedSettings("fake", null, null), "provider-gone",
      [new AttachmentInput(kept.name, kept.mediaType, null, kept.path)], []));
    await host.until("the failed message kept", async () => (await host.engine.listWaitingAsync(new ChatIdParams(other.id))).messages.some(t => !Object.isNull(t.failure)));
    const before = existsSync(folder(other.id));
    await host.conversations.deleteAsync(new ChatIdParams(other.id));
    Assert.areEqual("true|false", [before, existsSync(folder(other.id))].join("|"));
  }

  @TestMethod
  public async refusesAMessageWhoseFileCantBeCopiedAndQueuesNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const prepared = host.engine.prepareAttachment(new AttachmentInput("a.txt", "text/plain", "YQ==", null));
    host.engine.discardAttachment(prepared);
    const lost = await WaitingSendsTests.withFileAsync(host, chat.id, "Lost", prepared);

    const refused = await Assert.throwsAsync(() => host.engine.addWaitingAsync(new WaitingMessageAddParams(lost, MessageDelivery.Queue)), ServiceException);
    release();
    await host.engine.waitForIdle();

    Assert.areEqual(`${ErrorCode.NotFound}|true`, [refused.info.name, refused.message.includes("a.txt")].join("|"));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
    Assert.isFalse(existsSync(join(host.directory.path, "attachments", "waiting-files", chat.id)));
    Assert.areEqual("First", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async sendsAKeptMessageFromItsCopiedFileAfterARestartAndRemovesTheCopy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const [copy] = new AttachmentStore(host.directory.path).saveWaiting(chat.id, "waiting-1", [new AttachmentInput("a.txt", "text/plain", "YQ==", null)]);
    const params = new MessageSendParams(chat.id, "With a file", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id,
      [new AttachmentInput("a.txt", "text/plain", null, copy?.path ?? "")]);
    const kept = new WaitingMessage("waiting-1", MessageDelivery.Queue, params, "2026-11-03T00:00:00.000Z");
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO waitingMessages (id, chatId, json, updatedAt) VALUES (?, ?, ?, 't')",
      [kept.id, chat.id, JSON.stringify(kept.toJson())]));

    await host.engine.reconcileAsync();
    await host.adapter.requested(1);
    await host.engine.waitForIdle();
    const sent = (await host.messages.listAsync(new MessageListParams(chat.id, null))).find(t => t.author === MessageAuthor.User);

    Assert.areEqual("With a file|a", [sent?.details[0]?.text, readFileSync(sent?.attachments[0]?.path ?? "", "utf8")].join("|"));
    Assert.isFalse(existsSync(join(host.directory.path, "attachments", "waiting-files", chat.id, "waiting-1")));
  }

  @TestMethod
  public async sendsAQueuedMessageOnceEveryAnswerBeforeItFailedToSend(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const other = await host.createProviderAsync();
    const ask = (id: string): QuestionAsk => new QuestionAsk(id, "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)]);
    host.adapter.questionPosts = [ask("msg-1"), ask("msg-2")];
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "Ask me"));
    await host.until("the posted questions", async () => (await host.approvals.listAsync(new ConversationIdParams(chat.id))).length === 2);
    host.adapter.questionPosts = [];
    for (const question of await host.approvals.listAsync(new ConversationIdParams(chat.id)))
      await host.engine.decideAsync(new ApprovalDecideParams(question.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "Queued", new RequestedSettings("fake", null, null), other.id),
      MessageDelivery.Queue));
    await host.providers.setEnabledAsync(new ProviderEnabledParams((await host.providerOfAsync()).id, false));

    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    Assert.areEqual(2, host.log.lines.filter(t => t === Resources.formatQuestionReplyNotSent(chat.id, "ServiceException")).length, host.log.lines.join("\n"));
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("Queued") === true, String(host.adapter.requests[1]?.prompt));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
  }

  @TestMethod
  public async keepsTheQueueEditsRemovalsAndDeletesGoingWhenAWaitingMessagesFilesCantBeRemoved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.attachments.removeWaitingFiles = () => {
      throw new Error("The folder is busy");
    };
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const addAsync = async (text: string): Promise<WaitingMessage> => host.engine.addWaitingAsync(new WaitingMessageAddParams(
      await WaitingSendsTests.paramsAsync(host, chat.id, text), MessageDelivery.Queue));
    const a = await addAsync("A");
    const b = await addAsync("B");
    const c = await addAsync("C");

    const edited = await host.engine.editWaitingAsync(new WaitingMessageEditParams(b.id, await WaitingSendsTests.paramsAsync(host, chat.id, "B, edited")));
    await host.engine.removeWaitingAsync(new WaitingMessageIdParams(c.id));
    release();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();
    const sent = await WaitingSendsTests.sentAsync(host, chat.id);
    await host.conversations.deleteAsync(new ChatIdParams(chat.id));
    const logged = (line: string): number => host.log.lines.filter(t => t === line).length;

    Assert.areEqual("First,A,B, edited", sent);
    Assert.areEqual("B, edited", edited.message.text);
    Assert.areEqual("1,2,1,1", [Resources.formatWaitingFilesNotRemoved(a.id, "Error"), Resources.formatWaitingFilesNotRemoved(b.id, "Error"),
      Resources.formatWaitingFilesNotRemoved(c.id, "Error"), Resources.formatChatWaitingFilesNotRemoved(chat.id, "Error")].map(logged).join(), host.log.lines.join("|"));
    Assert.isNull(await host.conversations.findAsync(chat.id));
  }

  @TestMethod
  public async sweepsTheWaitingFilesNoKeptMessageHoldsAtStart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const file = [new AttachmentInput("a.txt", "text/plain", "YQ==", null)];
    host.attachments.saveWaiting(chat.id, "waiting-0", file);
    host.attachments.saveWaiting(chat.id, "waiting-gone", file);
    host.attachments.saveWaiting("chat-gone", "waiting-left", file);
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO waitingMessages (id, chatId, json, updatedAt) VALUES ('waiting-0', ?, '{', 't')",
      [chat.id]));

    await host.engine.reconcileAsync();
    await host.engine.waitForIdle();

    Assert.areEqual(`${chat.id}/waiting-0`, host.attachments.listWaitingFolders().map(t => t.join("/")).join());
  }

  @TestMethod
  public async sendsAMessageAddedToAnIdleChatAtOnceAndSendNowStopsTheReplyForAQueuedOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const idle = await host.createConversationAsync(project);
    const chat = await host.createConversationAsync(project);
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, idle.id, "Idle"), MessageDelivery.StopAndSend));
    await host.adapter.requested(1);
    await host.engine.waitForIdle();
    WaitingSendsTests.holdFirstUntilStopped(host, 2);
    const running = await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "Running"));
    await host.adapter.requested(2);

    const queued = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Queued"), MessageDelivery.Queue));
    const now = await host.engine.sendWaitingNowAsync(new WaitingMessageIdParams(queued.id));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(`${queued.id}|StopAndSend`, [now.id, now.delivery].join("|"));
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(running.replies[0]?.id ?? ""))?.status);
    Assert.areEqual("Idle", await WaitingSendsTests.sentAsync(host, idle.id));
    Assert.areEqual("Running,Queued", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async refusesAWaitingMessageWhoseMentionsArentThoseOfItsTextAndAddsNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    const refused = await Assert.throwsAsync(() => host.engine.addWaitingAsync(new WaitingMessageAddParams(
      new MessageSendParams(chat.id, "Check X", null, null, [], [bob.id]), MessageDelivery.Queue)), ServiceException);
    const listed = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length;
    release();
    await host.engine.waitForIdle();

    Assert.areEqual(`${ErrorCode.Conflict}:${Resources.waitingMentionsMismatch}`, `${refused.info.name}:${refused.message}`);
    Assert.areEqual(0, listed);
    Assert.areEqual("First", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async refusesAWaitingMessageWithASenderTokenAsInvalidBeforeItsMentions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);

    let refused: unknown = null;
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "Check X", null, null, [], [bob.id], null, "sender-token"),
      MessageDelivery.Queue)).catch((error: unknown) => refused = error);
    const listed = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length;
    release();
    await host.engine.waitForIdle();
    const described = RequestDispatcher.describe(refused);

    Assert.areEqual(`${ErrorCode.InvalidParams}:${ProtocolResources.waitingFromPersonOnly}:0`, `${described.name}:${described.message}:${listed}`);
  }

  @TestMethod
  public async refusesAnEditWhoseMentionsArentThoseOfItsNewTextAndKeepsTheMessageAsItWas(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const send = (text: string, mentioned: readonly string[]): MessageSendParams => new MessageSendParams(chat.id, text, null, null, [], mentioned);
    const waiting = await host.engine.addWaitingAsync(new WaitingMessageAddParams(send("@Bob check X", [bob.id]), MessageDelivery.Queue));

    const refused = await Assert.throwsAsync(() => host.engine.editWaitingAsync(new WaitingMessageEditParams(waiting.id, send("@Alice check X", [bob.id]))),
      ServiceException);
    const kept = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => `${t.message.text}:${t.message.mentionedTeammateIds.join(",")}`);
    await host.engine.editWaitingAsync(new WaitingMessageEditParams(waiting.id, send("@Alice check X", [alice.id])));
    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();

    Assert.areEqual(`${ErrorCode.Conflict}:${Resources.waitingMentionsMismatch}`, `${refused.info.name}:${refused.message}`);
    Assert.areEqual(`@Bob check X:${bob.id}`, kept.join("|"));
    Assert.areEqual("First,@Alice check X", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
  }

  @TestMethod
  public async editsAWaitingMessageInItsPlaceRemovesOneAndRefusesUnknownOnesAndAnotherChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const addAsync = async (text: string): Promise<WaitingMessage> => host.engine.addWaitingAsync(new WaitingMessageAddParams(
      await WaitingSendsTests.paramsAsync(host, chat.id, text), MessageDelivery.Queue));
    const a = await addAsync("A");
    const b = await addAsync("B");
    const c = await addAsync("C");

    const edited = await host.engine.editWaitingAsync(new WaitingMessageEditParams(a.id, await WaitingSendsTests.paramsAsync(host, chat.id, "A, edited")));
    await host.engine.removeWaitingAsync(new WaitingMessageIdParams(b.id));
    const refusalWorks: (() => Promise<unknown>)[] = [
      async () => host.engine.editWaitingAsync(new WaitingMessageEditParams(c.id, await WaitingSendsTests.paramsAsync(host, other.id, "Elsewhere"))),
      async () => host.engine.editWaitingAsync(new WaitingMessageEditParams("gone", await WaitingSendsTests.paramsAsync(host, chat.id, "X"))),
      () => host.engine.removeWaitingAsync(new WaitingMessageIdParams("gone")),
      () => host.engine.sendWaitingNowAsync(new WaitingMessageIdParams("gone")),
      () => host.engine.listWaitingAsync(new ChatIdParams("no-chat")),
      async () => host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, "no-chat", "X"), MessageDelivery.Queue))
    ];
    const refusals: string[] = [];
    for (const work of refusalWorks)
      refusals.push((await Assert.throwsAsync(work, ServiceException)).info.name);
    const listed = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => `${t.id === a.id ? "a" : "c"}:${t.message.text}`);
    release();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(a.createdAt, edited.createdAt);
    Assert.areEqual("a:A, edited,c:C", listed.join(","));
    Assert.areEqual([ErrorCode.InvalidParams, ErrorCode.NotFound, ErrorCode.NotFound, ErrorCode.NotFound, ErrorCode.NotFound, ErrorCode.NotFound].join(","),
      refusals.join(","));
    Assert.areEqual("First,A, edited,C", await WaitingSendsTests.sentAsync(host, chat.id));
  }

  @TestMethod
  public async keepsAMessageWhoseSendFailsWithWhyAndSendsTheNextThenTheEditedOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const unknown = new MessageSendParams(chat.id, "To nobody", new RequestedSettings("fake", null, null), "provider-gone", [], []);
    const failing = await host.engine.addWaitingAsync(new WaitingMessageAddParams(unknown, MessageDelivery.Queue));
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Next"), MessageDelivery.Queue));

    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const kept = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages;
    await host.engine.editWaitingAsync(new WaitingMessageEditParams(failing.id, await WaitingSendsTests.paramsAsync(host, chat.id, "To the chat")));
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    Assert.areEqual(failing.id, kept[0]?.id);
    Assert.isTrue(kept.length === 1 && (kept[0]?.failure?.includes("provider-gone") ?? false), kept[0]?.failure ?? "no failure");
    Assert.areEqual("First,Next,To the chat", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith(`A waiting message in the chat ${chat.id} wasn't sent: `)).length,
      host.log.lines.join("\n"));
    Assert.areEqual(0, (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.length);
  }

  @TestMethod
  public async refusesAMessageFromOutsideWhoseModeThePersonChangedBeforeItWentAndSendsTheWindowsInThatMode(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const providerId = (await host.providerOfAsync()).id;
    host.adapter.modeIds = ["default", "acceptEdits"];
    const accept = new RequestedSettings("fake", null, null, null, "acceptEdits");
    await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id, new ConversationResponder(null, accept, providerId), true));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const outside = await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "From outside", accept, providerId), MessageDelivery.Queue), true);
    const own = await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "From the window", accept, providerId), MessageDelivery.Queue));

    await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id,
      new ConversationResponder(null, new RequestedSettings("fake", null, null, null, "default"), providerId), true));
    release();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const kept = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages;

    Assert.areEqual("true,false", [outside.fromOutside, own.fromOutside].join(","));
    Assert.areEqual("First,From the window", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual("acceptEdits", host.adapter.requests[1]?.requested.mode ?? null);
    Assert.areEqual(JSON.stringify([[outside.id, Resources.unchosenModeRefused, true]]), JSON.stringify(kept.map(t => [t.id, t.failure, t.fromOutside])));
  }

  @TestMethod
  public async refusesAMessageFromOutsideAgainWhenTheWindowEditsItAfterThePersonLoweredTheMode(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const providerId = (await host.providerOfAsync()).id;
    host.adapter.modeIds = ["default", "acceptEdits"];
    const accept = new RequestedSettings("fake", null, null, null, "acceptEdits");
    await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id, new ConversationResponder(null, accept, providerId), true));
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const outside = await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(chat.id, "From outside", accept, providerId), MessageDelivery.Queue), true);
    await host.conversations.setResponderAsync(new ConversationResponderParams(chat.id,
      new ConversationResponder(null, new RequestedSettings("fake", null, null, null, "default"), providerId), true));
    release();
    await host.engine.waitForIdle();

    const edited = await host.engine.editWaitingAsync(new WaitingMessageEditParams(outside.id, new MessageSendParams(chat.id, "Retried", accept, providerId)));
    await host.engine.waitForIdle();
    const kept = (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages;

    Assert.isTrue(edited.fromOutside);
    Assert.areEqual("First", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(JSON.stringify([[outside.id, "Retried", Resources.unchosenModeRefused]]), JSON.stringify(kept.map(t => [t.id, t.message.text, t.failure])));
  }

  @TestMethod
  public async marksAMessageFromOutsideOnceAnEditIsFromOutsideAndKeepsTheMarkThroughAWindowsEditAndSendNow(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const release = WaitingSendsTests.holdFirst(host);
    await host.engine.sendAsync(await WaitingSendsTests.paramsAsync(host, chat.id, "First"));
    await host.adapter.requested(1);
    const added = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Second"), MessageDelivery.Queue));

    const own = await host.engine.editWaitingAsync(new WaitingMessageEditParams(added.id, await WaitingSendsTests.paramsAsync(host, chat.id, "Mine")));
    const outside = await host.engine.editWaitingAsync(new WaitingMessageEditParams(added.id, await WaitingSendsTests.paramsAsync(host, chat.id, "Changed")), true);
    const kept = await host.engine.editWaitingAsync(new WaitingMessageEditParams(added.id, await WaitingSendsTests.paramsAsync(host, chat.id, "Mine again")));
    const now = await host.engine.sendWaitingNowAsync(new WaitingMessageIdParams(added.id));
    release();
    await host.engine.waitForIdle();

    Assert.areEqual("false,false,true,true,true", [added.fromOutside, own.fromOutside, outside.fromOutside, kept.fromOutside, now.fromOutside].join(","));
  }

  @TestMethod
  public async keepsAMessageWhoseSendFailedUnreadablyWithAPlainReason(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.attachments.save = (): never => {
      throw new Error("The disk is full at /private/path.");
    };

    await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "Hello"), MessageDelivery.Queue));
    await host.until("the failed send", async () => !Object.isNull((await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages[0]?.failure ?? null));

    Assert.areEqual("It couldn't be sent.", (await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages[0]?.failure);
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async sendsWaitingMessagesKeptBeforeARestartInTheOrderAddedSkippingAnUnreadableOneAndKeepsThemWhileClosing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const insertAsync = async (id: string, json: string): Promise<void> => {
      await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO waitingMessages (id, chatId, json, updatedAt) VALUES (?, ?, ?, 't')",
        [id, chat.id, json]));
    };
    const keepAsync = async (id: string, text: string, createdAt: string): Promise<void> => insertAsync(id,
      JSON.stringify(new WaitingMessage(id, MessageDelivery.Queue, await WaitingSendsTests.paramsAsync(host, chat.id, text), createdAt).toJson()));
    await insertAsync("waiting-0", "{");
    await keepAsync("waiting-2", "Second", "2026-11-03T00:00:02.000Z");
    await keepAsync("waiting-3", "First", "2026-11-03T00:00:01.000Z");
    await keepAsync("waiting-1", "Third", "2026-11-03T00:00:02.000Z");

    await host.engine.reconcileAsync();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();
    await host.engine.shutdown();
    const closing = await host.engine.addWaitingAsync(new WaitingMessageAddParams(await WaitingSendsTests.paramsAsync(host, chat.id, "While closing"), MessageDelivery.Queue));

    Assert.areEqual("First,Second,Third", await WaitingSendsTests.sentAsync(host, chat.id));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("The waiting message waiting-0 couldn't be read, so it was skipped: ")).length,
      host.log.lines.join("\n"));
    Assert.areEqual(JSON.stringify([closing.id]), JSON.stringify((await host.engine.listWaitingAsync(new ChatIdParams(chat.id))).messages.map(t => t.id)));
    Assert.areEqual(3, host.adapter.requests.length);
  }

  private static offerSteer(host: CoreHost, steer: (steer: TurnSteer) => Promise<boolean>): () => void {
    const gate = Promise.withResolvers<void>();
    WaitingSendsTests.notifyOnEvents(host);
    host.adapter.holdTurn = () => {
      if (host.adapter.requests.length !== 1)
        return Promise.resolve();
      host.adapter.lastListener?.onSteerable?.(t => {
        const answer = steer(t);
        ChangeSignal.notify();
        return answer;
      });
      return gate.promise;
    };
    return () => gate.resolve();
  }

  private static notifyOnEvents(host: CoreHost): void {
    host.events.subscribe({ onEvent: () => ChangeSignal.notify() });
  }

  private static question(): QuestionAsk {
    return new QuestionAsk("msg-1", "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)]);
  }

  private static async paramsAsync(host: CoreHost, chatId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(chatId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }

  private static async withFileAsync(host: CoreHost, chatId: string, text: string, attachment: MessageAttachment): Promise<MessageSendParams> {
    return new MessageSendParams(chatId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id,
      [new AttachmentInput(attachment.name, attachment.mediaType, null, attachment.path)]);
  }

  private static async sentAsync(host: CoreHost, chatId: string): Promise<string> {
    return (await host.messages.listAsync(new MessageListParams(chatId, null))).filter(t => t.author === MessageAuthor.User).map(t => t.details[0]?.text).join(",");
  }

  private static holdFirst(host: CoreHost): () => void {
    const gate = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => host.adapter.requests.length === 1 ? gate.promise : Promise.resolve();
    return () => gate.resolve();
  }

  private static holdFirstUntilStopped(host: CoreHost, request: number = 1): void {
    host.adapter.holdTurn = (_, signal) => host.adapter.requests.length !== request || signal.aborted ? Promise.resolve()
      : new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  }
}
