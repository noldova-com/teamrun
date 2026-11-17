/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatTitles, Resources, SignInCheck, TitleModel, type TurnRequest } from "@noldova/teamrun.core";
import { AttachmentInput, AuthStatus, ConversationCreateParams, ConversationRenameParams, EventName, Harness, MessageSendParams, MessageStatus, type Provider,
  ProviderEnabledParams, ProviderIdParams, RequestedSettings, type Teammate, TeammateCreateParams } from "@noldova/teamrun.protocol";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ChatTitlesTests {
  private static titles(host: CoreHost, choice: string = String.empty, timeout?: number): ChatTitles {
    return new ChatTitles(host.conversations, host.providers, host.registry, host.events, join(host.directory.path, "titles"), () => choice, host.log, timeout);
  }

  private static chatModel(model: string | null = "fake-small", provider: Provider | null = null): TitleModel {
    return new TitleModel(provider, "fake", model);
  }

  private static invalidations(host: CoreHost): number {
    return host.listener.count(EventName.StateInvalidated);
  }

  @TestMethod
  public async asksTheChatsModelInAnIsolatedTurnAndTakesTheTitleWithoutMovingTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const requests: TurnRequest[] = [];
    host.adapter.answerTitles(request => {
      requests.push(request);
      return Promise.resolve("**Title: \"Fix  the login page.\"**");
    });
    const before = ChatTitlesTests.invalidations(host);
    const titles = ChatTitlesTests.titles(host);

    await titles.beginAsync(chat.id, "x".repeat(Resources.titleOpeningLength) + "tail", ChatTitlesTests.chatModel());
    await host.until("the model's title", async () => (await host.conversations.findAsync(chat.id))?.title !== chat.title);

    const [request] = requests;
    Assert.areEqual(1, requests.length);
    Assert.isDefined(request);
    Assert.isTrue(request.isolated);
    Assert.isNull(request.tools);
    Assert.areEqual(0, request.sharedServers.length);
    Assert.isNull(request.resumeNativeSessionId);
    Assert.isNull(request.instructions);
    Assert.areEqual(join(host.directory.path, "titles"), request.workingDirectory);
    Assert.isTrue(existsSync(request.workingDirectory));
    Assert.areEqual("fake-small", request.requested.model);
    Assert.isNull(request.requested.effort);
    Assert.isNull(request.requested.mode);
    Assert.isTrue(request.prompt.includes("x".repeat(Resources.titleOpeningLength)));
    Assert.isFalse(request.prompt.includes("tail"));
    const titled = await host.conversations.findAsync(chat.id);
    Assert.isNotNull(titled);
    Assert.areEqual("Fix the login page", titled.title);
    Assert.areEqual(chat.updatedAt, titled.updatedAt);
    Assert.isFalse(titled.edited);
    Assert.isFalse(titled.titleChosen);
    Assert.areEqual(before + 1, ChatTitlesTests.invalidations(host));
  }

  @TestMethod
  public async asksTheChosenModelFirstAndTheChatsWhenItFailsThenLeavesTheFirstCharacters(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.providerOfAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    const asked: (string | null)[] = [];
    const answers: (() => Promise<string | null>)[] = [
      () => Promise.reject(new Error("secret provider text")),
      () => Promise.resolve("From the chat's model")
    ];
    host.adapter.answerTitles(request => {
      asked.push(request.requested.model);
      const answer = answers[asked.length - 1];
      Assert.isDefined(answer);
      return answer();
    });
    const titles = ChatTitlesTests.titles(host, `${provider.id}/fake-large`);

    await titles.beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("the chat model's title", async () => (await host.conversations.findAsync(chat.id))?.title === "From the chat's model");
    Assert.areEqual(JSON.stringify(["fake-large", "fake-small"]), JSON.stringify(asked));
    Assert.isTrue(host.log.lines.includes(Resources.formatTitleAskFailed("fake")));
    Assert.isFalse(host.log.lines.join().includes("secret"));

    const second = await host.conversations.createAsync(new ConversationCreateParams(null, "Still the first characters"));
    asked.length = 0;
    answers[0] = () => Promise.resolve(null);
    answers[1] = () => Promise.resolve(" . ");
    await titles.beginAsync(second.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("both title asks", () => asked.length === 2);
    await titles.shutdown();
    Assert.areEqual("Still the first characters", (await host.conversations.findAsync(second.id))?.title);
  }

  @TestMethod
  public async asksTheChatsModelWhenTheChosenOneIsUnavailable(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.providerOfAsync();
    const unavailable = [
      `${provider.id}/`,
      "/fake-large",
      "no-separator",
      "missing-provider/fake-large"
    ];
    const asked: (string | null)[] = [];
    host.adapter.answerTitles(request => {
      asked.push(request.requested.model);
      return Promise.resolve("Named");
    });
    for (const choice of unavailable) {
      const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Waiting"));
      await ChatTitlesTests.titles(host, choice).beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
      await host.until("the model's title", async () => (await host.conversations.findAsync(chat.id))?.title === "Named");
    }
    const off = await host.createProviderAsync("fake", "Off");
    const out = await host.createProviderAsync("fake", "Out");
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(out.id));
    for (const changed of [off, out]) {
      const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Waiting"));
      await ChatTitlesTests.titles(host, `${changed.id}/fake-large`).beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
      await host.until("the model's title", async () => (await host.conversations.findAsync(chat.id))?.title === "Named");
    }
    Assert.areEqual(JSON.stringify(Array<string>(6).fill("fake-small")), JSON.stringify(asked));
  }

  @TestMethod
  public async asksTheChatsModelWhenTheSettingCantBeRead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    host.adapter.answerTitles(() => Promise.resolve("A title"));
    const titles = new ChatTitles(host.conversations, host.providers, host.registry, host.events, join(host.directory.path, "titles"), () => {
      throw new Error("The settings are gone.");
    }, host.log);

    await titles.beginAsync(chat.id, "An opening", ChatTitlesTests.chatModel());
    await host.until("the model's title", async () => (await host.conversations.findAsync(chat.id))?.title === "A title");

    Assert.isTrue(host.log.lines.includes(Resources.titleChoiceNotRead));
  }

  @TestMethod
  public async asksOnceWhenTheChosenModelIsTheChatsAndNotAtAllWhenNoModelCanAnswer(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.providerOfAsync();
    let asked = 0;
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Waiting"));
    const titles = ChatTitlesTests.titles(host, `${provider.id}/fake-small`);
    await titles.beginAsync(chat.id, "Opening", null);
    Assert.areEqual("Waiting", (await host.conversations.findAsync(chat.id))?.title);
    await titles.shutdown();

    host.adapter.answerTitles(() => {
      asked += 1;
      return Promise.resolve(null);
    });
    await titles.beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel("fake-small", provider));
    await host.until("the title ask", () => asked > 0);
    await titles.shutdown();
    Assert.areEqual(1, asked);

    await ChatTitlesTests.titles(host).beginAsync(chat.id, "Opening", null);
    await ChatTitlesTests.titles(host).beginAsync(chat.id, "Opening", new TitleModel(null, "not-registered", null));
    Assert.areEqual(1, asked);
  }

  @TestMethod
  public async movesOnWhenAModelTakesTooLongAndLeavesTheFirstCharacters(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.providerOfAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    await ChatTitlesTests.titles(host, `${provider.id}/fake-large`, 1).beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("both title asks ended", () => signals.length === 2 && signals.every(t => t.aborted));
    Assert.areEqual("First characters", (await host.conversations.findAsync(chat.id))?.title);
  }

  @TestMethod
  public async neverReplacesATitleAPersonSetWhileTheAskWasRunning(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    const answer = Promise.withResolvers<string | null>();
    host.adapter.answerTitles(() => answer.promise);
    const give = host.conversations.giveTitleAsync.bind(host.conversations);
    let given = 0;
    host.conversations.giveTitleAsync = (id, title, transaction) => {
      given += 1;
      ChangeSignal.notify();
      return give(id, title, transaction);
    };
    const titles = ChatTitlesTests.titles(host);
    await titles.beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
    await host.conversations.renameAsync(new ConversationRenameParams(chat.id, "The person's title"));
    const before = ChatTitlesTests.invalidations(host);

    answer.resolve("From the model");
    await host.until("the given title", () => given === 1);
    await titles.shutdown();

    Assert.areEqual("The person's title", (await host.conversations.findAsync(chat.id))?.title);
    Assert.areEqual(before, ChatTitlesTests.invalidations(host));
  }

  @TestMethod
  public async takesAnAgentsOwnTitleWhileTheAskRunsAndEndsTheAsk(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    const answer = Promise.withResolvers<string | null>();
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return answer.promise;
    });
    const titles = ChatTitlesTests.titles(host);
    await titles.offerAsync(chat.id, "Before the ask");
    Assert.areEqual("First characters", (await host.conversations.findAsync(chat.id))?.title);

    await titles.beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("the title ask", () => signals.length === 1);
    const [titleAsk] = signals;
    Assert.isDefined(titleAsk);
    await titles.offerAsync(chat.id, "  ");
    Assert.isFalse(titleAsk.aborted);
    Assert.areEqual("First characters", (await host.conversations.findAsync(chat.id))?.title);

    await titles.offerAsync(chat.id, "From the agent");
    Assert.isTrue(titleAsk.aborted);
    Assert.areEqual("From the agent", (await host.conversations.findAsync(chat.id))?.title);

    await titles.offerAsync(chat.id, "A later one");
    answer.resolve("From the model");
    await titles.shutdown();
    Assert.areEqual("From the agent", (await host.conversations.findAsync(chat.id))?.title);
  }

  @TestMethod
  public async takesAnAgentsTitleAfterEveryModelFailedUntilTheFirstTurnEndsAndNotAfterAModelsTitle(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    const ended = await host.conversations.createAsync(new ConversationCreateParams(null, "Ended"));
    const named = await host.conversations.createAsync(new ConversationCreateParams(null, "Named"));
    const forgotten = await host.conversations.createAsync(new ConversationCreateParams(null, "Forgotten"));
    let asked = 0;
    host.adapter.answerTitles(request => {
      asked += 1;
      return Promise.resolve(request.prompt.includes("Name it") ? "From the model" : null);
    });
    const titles = ChatTitlesTests.titles(host);

    await titles.beginAsync(first.id, "Opening", ChatTitlesTests.chatModel());
    await titles.beginAsync(ended.id, "Opening", ChatTitlesTests.chatModel());
    await titles.beginAsync(named.id, "Name it", ChatTitlesTests.chatModel());
    await titles.beginAsync(forgotten.id, "Opening", null);
    await host.until("three title asks and the model's title",
      async () => asked === 3 && (await host.conversations.findAsync(named.id))?.title === "From the model");
    await titles.shutdown();
    titles.end(ended.id);
    titles.forget([forgotten.id]);
    await titles.offerAsync(first.id, "From the agent");
    await titles.offerAsync(ended.id, "From the agent");
    await titles.offerAsync(named.id, "From the agent");
    await titles.offerAsync(forgotten.id, "From the agent");

    const found: (string | undefined)[] = [];
    for (const chat of [first, ended, named, forgotten])
      found.push((await host.conversations.findAsync(chat.id))?.title);
    Assert.areEqual("From the agent,Ended,From the model,Forgotten", found.join(","));
  }

  @TestMethod
  public async endsTheAsksOfADeletedChatAndAtShutdownWithoutTakingALateAnswer(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const deleted = await host.conversations.createAsync(new ConversationCreateParams(null, "Deleted"));
    const kept = await host.conversations.createAsync(new ConversationCreateParams(null, "Kept"));
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    const titles = ChatTitlesTests.titles(host);
    await titles.beginAsync(deleted.id, "Opening", ChatTitlesTests.chatModel());
    await titles.beginAsync(kept.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("both title asks", () => signals.length === 2);
    const [deletedAsk, keptAsk] = signals;
    Assert.isDefined(deletedAsk);
    Assert.isDefined(keptAsk);

    titles.forget([deleted.id, "another"]);
    Assert.isTrue(deletedAsk.aborted);
    Assert.isFalse(keptAsk.aborted);

    await titles.shutdown();
    Assert.isTrue(keptAsk.aborted);
    Assert.areEqual("Deleted", (await host.conversations.findAsync(deleted.id))?.title);
    Assert.areEqual("Kept", (await host.conversations.findAsync(kept.id))?.title);
  }

  @TestMethod
  public async logsATitleItCouldNotKeepAndLeavesNoFailureBehind(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "First characters"));
    host.adapter.answerTitles(() => Promise.resolve("From the model"));
    host.conversations.giveTitleAsync = () => Promise.reject(new Error("The database is closed."));
    const titles = ChatTitlesTests.titles(host);
    await titles.beginAsync(chat.id, "Opening", ChatTitlesTests.chatModel());
    await host.until("the title-not-kept line", () => host.log.lines.includes(Resources.titleNotKept));
    await titles.shutdown();
    Assert.areEqual("First characters", (await host.conversations.findAsync(chat.id))?.title);
  }

  @TestMethod
  public async namesTheChatFromItsFirstCharactersWhenSentAndKeepsThemWithoutAModelThatAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const params = await ChatTitlesTests.sendAsync(host, chat.id, "\n  Fix the login page  \nand more");
    const before = host.listener.count(EventName.StateInvalidated);

    await host.engine.sendAsync(params);
    Assert.areEqual("Fix the login page", await ChatTitlesTests.titleAsync(host, chat.id));
    Assert.isTrue(host.listener.count(EventName.StateInvalidated) > before);
    const stored = await host.conversations.findAsync(chat.id);
    Assert.isNotNull(stored);
    Assert.isFalse(stored.titleChosen);
    await host.runsEndAsync();
    Assert.areEqual("Fix the login page", await ChatTitlesTests.titleAsync(host, chat.id));
  }

  @TestMethod
  public async namesAChatThatStartsWithOnlyAFileFromTheFilesName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, chat.id, String.empty,
      [new AttachmentInput("notes.txt", "text/plain", Buffer.from("text").toString("base64"), null)]));
    await host.runsEndAsync();
    Assert.areEqual("notes.txt", await ChatTitlesTests.titleAsync(host, chat.id));
  }

  @TestMethod
  public async takesTheModelsTitleWhenItArrivesWithoutHoldingOrFailingTheTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const answer = Promise.withResolvers<string | null>();
    const requests: TurnRequest[] = [];
    host.adapter.answerTitles(request => {
      requests.push(request);
      return answer.promise;
    });

    const sent = await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, chat.id, "fix login please, it is broken"));
    await host.runsEndAsync();
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
    Assert.areEqual("fix login please, it is broken", await ChatTitlesTests.titleAsync(host, chat.id));
    Assert.areEqual(1, requests.length);
    Assert.areEqual("fake-small", requests[0]?.requested.model);
    Assert.areEqual((await host.providerOfAsync()).id, requests[0]?.provider?.id);
    Assert.isTrue(requests[0]?.isolated ?? false);

    answer.resolve("Fix the login page");
    await host.until("the model's title", async () => await ChatTitlesTests.titleAsync(host, chat.id) === "Fix the login page");
    Assert.isFalse(host.adapter.requests.some(t => t.isolated));
  }

  @TestMethod
  public async leavesTheFirstCharactersAndTheTurnAloneWhenAskingFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    let asked = false;
    host.adapter.answerTitles(() => {
      asked = true;
      return Promise.reject(new Error("The model is gone."));
    });
    const sent = await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, chat.id, "fix login"));
    await host.until("the title ask", () => asked);
    await host.runsEndAsync();
    await host.engine.shutdown();
    Assert.areEqual("fix login", await ChatTitlesTests.titleAsync(host, chat.id));
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(reply.id))?.status);
  }

  @TestMethod
  public async asksOnlyOnTheFirstMessageAndNeverWhenAPersonOrCallerNamedTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    let asked = 0;
    host.adapter.answerTitles(() => {
      asked += 1;
      return Promise.resolve("From the model");
    });
    const given = await host.conversations.createAsync(new ConversationCreateParams((await host.openProjectAsync()).id, "Given"));
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, given.id, "first"));
    await host.runsEndAsync();
    Assert.areEqual("Given", await ChatTitlesTests.titleAsync(host, given.id));

    const named = await host.createConversationAsync();
    await host.conversations.renameAsync(new ConversationRenameParams(named.id, named.title));
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, named.id, "first"));
    await host.runsEndAsync();
    Assert.areEqual(named.title, await ChatTitlesTests.titleAsync(host, named.id));
    Assert.areEqual(0, asked);

    const fresh = await host.createConversationAsync();
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, fresh.id, "first"));
    await host.runsEndAsync();
    await host.until("the model's title", async () => await ChatTitlesTests.titleAsync(host, fresh.id) === "From the model");
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, fresh.id, "second"));
    await host.runsEndAsync();
    Assert.areEqual(1, asked);
    Assert.areEqual("From the model", await ChatTitlesTests.titleAsync(host, fresh.id));
  }

  @TestMethod
  public async asksTheModelOfTheFirstMentionedTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const providerId = (await host.providerOfAsync()).id;
    const created: Teammate[] = [];
    for (const name of ["Ana", "Ben"])
      created.push(await host.teammates.createAsync(new TeammateCreateParams(name, null, providerId, Harness.Provider, `${name}-model`, null)));
    const [ana, ben] = created;
    Assert.isDefined(ana);
    Assert.isDefined(ben);
    const models: (string | null)[] = [];
    host.adapter.answerTitles(request => {
      models.push(request.requested.model);
      return Promise.resolve("Named");
    });
    await host.engine.sendAsync(new MessageSendParams(chat.id, "@Ana and @Ben, look", null, null, [], [ana.id, ben.id]));
    await host.runsEndAsync();
    await host.until("the title ask", () => models.length > 0);
    Assert.areEqual(JSON.stringify(["Ana-model"]), JSON.stringify(models));
  }

  @TestMethod
  public async asksTheModelTheSettingChooses(): Promise<void> {
    let provider = String.empty;
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, null, true, () => `${provider}/fake-large`);
    provider = (await host.providerOfAsync()).id;
    const chat = await host.createConversationAsync();
    const member = await host.teammates.createAsync(new TeammateCreateParams("Ana", null, provider, Harness.Provider, "Ana-model", null));
    const models: (string | null)[] = [];
    host.adapter.answerTitles(request => {
      models.push(request.requested.model);
      return Promise.resolve("Named");
    });
    await host.engine.sendAsync(new MessageSendParams(chat.id, "@Ana look", null, null, [], [member.id]));
    await host.runsEndAsync();
    await host.until("the model's title", async () => await ChatTitlesTests.titleAsync(host, chat.id) === "Named");
    Assert.areEqual(JSON.stringify(["fake-large"]), JSON.stringify(models));
  }

  @TestMethod
  public async takesATitleTheProviderGaveItsSessionWhileTheAskRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => held.promise;
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, chat.id, "fix login"));
    await host.until("the held turn and the title ask", () => !Object.isNull(host.adapter.lastListener) && signals.length === 1);
    const [titleAsk] = signals;
    Assert.isDefined(titleAsk);
    await ChatTitlesTests.giveTitleAsync(host, "The agent's title");
    Assert.isTrue(titleAsk.aborted);
    await host.until("the agent's title", async () => await ChatTitlesTests.titleAsync(host, chat.id) === "The agent's title");
    Assert.areEqual("The agent's title", await ChatTitlesTests.titleAsync(host, chat.id));
    held.resolve();
    await host.runsEndAsync();
  }

  @TestMethod
  public async takesTheAgentsTitleAfterEveryModelFailedUntilTheChatsFirstTurnEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    let asked = 0;
    host.adapter.answerTitles(() => {
      asked += 1;
      return Promise.resolve(null);
    });
    const held = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => held.promise;
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, chat.id, "fix login"));
    await host.until("the held turn and the title ask", () => !Object.isNull(host.adapter.lastListener) && asked === 1);
    await new Promise(resolve => setImmediate(resolve));
    const first = await ChatTitlesTests.titleAsync(host, chat.id);

    await ChatTitlesTests.giveTitleAsync(host, "The agent's title");
    await host.until("the agent's title", async () => await ChatTitlesTests.titleAsync(host, chat.id) !== first);
    const named = await ChatTitlesTests.titleAsync(host, chat.id);
    await host.conversations.giveTitleAsync(chat.id, "fix login");
    held.resolve();
    await host.runsEndAsync();
    await ChatTitlesTests.giveTitleAsync(host, "After the first turn");

    Assert.areEqual("fix login,The agent's title,fix login", [first, named, await ChatTitlesTests.titleAsync(host, chat.id)].join(","));
  }

  @TestMethod
  public async endsTheAskWhenTheChatIsForgottenAndAtShutdown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = await host.createConversationAsync();
    const second = await host.createConversationAsync();
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, first.id, "first chat"));
    await host.runsEndAsync();
    await host.engine.sendAsync(await ChatTitlesTests.sendAsync(host, second.id, "second chat"));
    await host.runsEndAsync();
    await host.until("both title asks", () => signals.length === 2);
    const [firstAsk, secondAsk] = signals;
    Assert.isDefined(firstAsk);
    Assert.isDefined(secondAsk);

    await host.engine.forgetAsync([first.id]);
    Assert.isTrue(firstAsk.aborted);
    Assert.isFalse(secondAsk.aborted);
    await host.engine.shutdown();
    Assert.isTrue(secondAsk.aborted);
  }

  private static async sendAsync(host: CoreHost, chatId: string, text: string, attachments: readonly AttachmentInput[] = []): Promise<MessageSendParams> {
    return new MessageSendParams(chatId, text, new RequestedSettings("fake", "fake-small", null), (await host.providerOfAsync()).id, attachments);
  }

  private static async titleAsync(host: CoreHost, chatId: string): Promise<string | undefined> {
    return (await host.conversations.findAsync(chatId))?.title;
  }

  private static async giveTitleAsync(host: CoreHost, title: string): Promise<void> {
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    Assert.isDefined(listener.onTitleAsync);
    await listener.onTitleAsync(title);
  }
}
