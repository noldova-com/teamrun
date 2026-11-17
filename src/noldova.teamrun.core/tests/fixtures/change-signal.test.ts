/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CompareOutcome, type CompareRequest } from "@noldova/checkpoints.protocol";
import { ChatTitles, TitleModel } from "@noldova/teamrun.core";
import { ConversationCreateParams, Event, EventName, MessageSendParams, RequestedSettings } from "@noldova/teamrun.protocol";

import { BoundingWork } from "./bounding-work.fixture.js";
import { CoreHost } from "./core-host.fixture.js";
import { FakeProviderKindInstallation } from "./fake-provider-kind-installation.fixture.js";
import { FakeTurnToolSessions } from "./fake-turn-tool-sessions.fixture.js";

@TestClass
export class ChangeSignalTests {
  private static async sendAsync(host: CoreHost, chatId: string): Promise<MessageSendParams> {
    return new MessageSendParams(chatId, "Go", new RequestedSettings("fake", "fake-small", null), (await host.providerOfAsync()).id);
  }

  @TestMethod
  public async failsAtOnceNamingTheWaitAndTheWorkWhenTheWorkEndsWithoutIt(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const failure = await Assert.throwsAsync(() => host.until("the reply", () => false, new BoundingWork("the send", Promise.resolve())), Error);

    Assert.areEqual("the reply never happened; the send ended without it.", failure.message);
  }

  @TestMethod
  public async passesWhenTheConditionHoldsOnceTheWorkEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    let done = false;

    await host.until("the work", () => done, new BoundingWork("the work", Promise.resolve().then(() => {
      done = true;
    })));

    Assert.isTrue(done);
  }

  @TestMethod
  public async failsWhenTheRunsEndWithoutTheCondition(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    await host.engine.sendAsync(await ChangeSignalTests.sendAsync(host, chat.id));

    const failure = await Assert.throwsAsync(() => host.until("a second request", () => host.adapter.requests.length === 2, host.runs()), Error);

    Assert.areEqual("a second request never happened; the engine's runs ended without it.", failure.message);
  }

  @TestMethod
  public async wakesOnALogLine(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the line", () => host.log.lines.includes("written"));

    host.log.write("written");

    await waited;
  }

  @TestMethod
  public async wakesOnAnEvent(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the event", () => host.listener.count(EventName.MessageCreated) === 1);

    host.listener.onEvent(new Event(EventName.MessageCreated, { id: "m1" }));

    await waited;
  }

  @TestMethod
  public async wakesOnWhatARunSettlesAsItsTurnEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const activity = host.context.projectActivity;
    const lease = activity.enterTurn(host.directory.path);
    let settled = false;
    const waited = host.until("what the run settles", () => settled);

    activity.leave(lease);
    settled = true;

    await waited;
  }

  @TestMethod
  public async wakesOnAProviderCall(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const waited = host.until("the check", () => host.adapter.checkedProviders.length === 1);

    await host.adapter.checkSignIn(provider);

    await waited;
  }

  @TestMethod
  public async wakesOnATitleAsk(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const answer = Promise.withResolvers<string | null>();
    let asked = 0;
    host.adapter.answerTitles(() => {
      asked += 1;
      return answer.promise;
    });
    const titles = new ChatTitles(host.conversations, host.providers, host.registry, host.events, join(host.directory.path, "titles"), () => String.empty, host.log);
    const waited = host.until("the title ask", () => asked === 1);

    await titles.beginAsync(chat.id, "Fix the login page", new TitleModel(null, "fake", "fake-small"));

    await waited;
    answer.resolve(null);
    await titles.shutdown();
  }

  @TestMethod
  public async wakesOnAnEndedTitleAsk(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const signals: AbortSignal[] = [];
    host.adapter.answerTitles((_request, signal) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    const titles = new ChatTitles(host.conversations, host.providers, host.registry, host.events, join(host.directory.path, "titles"), () => String.empty, host.log);
    await titles.beginAsync(chat.id, "Fix the login page", new TitleModel(null, "fake", "fake-small"));
    await host.until("the title ask", () => signals.length === 1);
    const waited = host.until("the ended ask", () => signals[0]?.aborted === true);

    titles.forget([chat.id]);

    await waited;
    await titles.shutdown();
  }

  @TestMethod
  public async wakesOnAHeldTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    let held = 0;
    host.adapter.holdTurn = (_request, signal) => {
      held += 1;
      return new Promise(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    };
    const waited = host.until("the held turn", () => held === 1);

    await host.engine.sendAsync(await ChangeSignalTests.sendAsync(host, chat.id));

    await waited;
    await host.engine.shutdown();
  }

  @TestMethod
  public async wakesAfterTheDetailsOfATurnHeldUntilAborted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    let after = 0;
    host.adapter.afterDetails = () => {
      after += 1;
    };
    host.adapter.holdUntilAbort = true;
    const waited = host.until("the details", () => after === 1);

    await host.engine.sendAsync(await ChangeSignalTests.sendAsync(host, chat.id));

    await waited;
    await host.engine.shutdown();
  }

  @TestMethod
  public async wakesOnAStartedCommand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the command", () => host.commands.started.length === 1);

    host.commands.start("npm test", host.directory.path, () => undefined);

    await waited;
  }

  @TestMethod
  public async wakesOnAStoppedCommand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const command = host.commands.start("npm test", host.directory.path, () => undefined);
    const waited = host.until("the stop", () => command.stops === 1);

    await command.stopAsync();

    await waited;
  }

  @TestMethod
  public async wakesOnACheckpointCompare(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.checkpoints.compareOutcome = CompareOutcome.Compared;
    const waited = host.until("the compare", () => host.checkpoints.compares.length === 1);

    await host.checkpoints.compareAsync({} as CompareRequest);

    await waited;
  }

  @TestMethod
  public async wakesOnARemovedSecret(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the removal", () => host.secrets.removed.length === 1);

    await host.secrets.removeAsync("token");

    await waited;
  }

  @TestMethod
  public async wakesOnAnOpenedAndAnEndedToolSession(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
    const opened = host.until("the opening", () => tools.opened.length === 1);

    const session = tools.open("chat", "chat-1", host.directory.path, null, "Ada", () => undefined);

    await opened;
    const ended = host.until("the end", () => session.ends === 1);
    session.end();
    await ended;
  }

  @TestMethod
  public async wakesOnAnInstall(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const installation = new FakeProviderKindInstallation();
    const stop = new AbortController();
    const waited = host.until("the install", () => installation.installs === 1);

    const install = installation.install(() => undefined, stop.signal, () => undefined);

    await waited;
    stop.abort();
    await Assert.throwsAsync(() => install, Error);
  }

  @TestMethod
  public async wakesOnAnAppDescription(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.failing.add("Notes");
    const waited = host.until("the description", () => host.appDescriptions.described.length === 1);

    await Assert.throwsAsync(() => host.appDescriptions.describeAsync("Notes"), Error);

    await waited;
  }

  @TestMethod
  public async wakesOnARevokedGrant(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the revoke", () => host.rememberedGrants.revoked.length === 1);

    host.rememberedGrants.revoke("grant-1");

    await waited;
  }

  @TestMethod
  public async wakesOnAFolderStat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const waited = host.until("the stat", () => host.folderStat.paths.length === 1);

    await host.folderStat.statAsync(host.directory.path);

    await waited;
  }
}
