/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DeleteFolderOutcome } from "@noldova/checkpoints.protocol";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationEngine, Resources } from "@noldova/teamrun.core";
import {
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRewindParams,
  EventName,
  MessageListParams,
  MessageSendParams,
  MethodName,
  ProjectIdParams,
  Request,
  RequestedSettings,
  SenderEnvironment,
  SubAgentStartParams,
  SubAgentWaitParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class KeptSessionsTests {
  @TestMethod
  public async closesEachKindsSessionsOfTheDeletedChatAndKeepsTheOtherChats(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    const closed: string[] = [];
    host.adapter.closeSessions = ids => KeptSessionsTests.record(closed, "fake", ids);
    other.closeSessions = ids => KeptSessionsTests.record(closed, "other", ids);
    const deleted = await host.createConversationAsync();
    const kept = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, deleted.id, "fake");
    await KeptSessionsTests.replyAsync(host, deleted.id, "fake");
    await KeptSessionsTests.replyAsync(host, deleted.id, "other");
    await KeptSessionsTests.replyAsync(host, kept.id, "fake");
    const expected = [await KeptSessionsTests.sessionsOfAsync(host, deleted.id, "fake"), await KeptSessionsTests.sessionsOfAsync(host, deleted.id, "other"),
      await KeptSessionsTests.sessionsOfAsync(host, kept.id, "fake")];

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(deleted.id).toJson());
    const afterDelete = closed.join(";");
    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(kept.id).toJson());

    Assert.isFalse(expected.includes(""));
    Assert.areEqual(`fake ${expected[0]};other ${expected[1]}`, afterDelete);
    Assert.areEqual(`${afterDelete};fake ${expected[2]}`, closed.join(";"));
  }

  @TestMethod
  public async closesTheSessionsOfTheChatsOfAForgottenProject(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const closed: string[] = [];
    host.adapter.closeSessions = ids => KeptSessionsTests.record(closed, "fake", ids);
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    await KeptSessionsTests.replyAsync(host, chat.id, "fake");
    const expected = await KeptSessionsTests.sessionsOfAsync(host, chat.id, "fake");

    await KeptSessionsTests.succeedAsync(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());

    Assert.areEqual(`fake ${expected}`, closed.join(";"));
  }

  @TestMethod
  public async logsAKindThatFailsToCloseTheSessions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.closeSessions = () => Promise.reject(new TypeError("Fixture close failed"));
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "fake");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());
    await host.until("the failed close is logged", () => host.log.lines.length > 0);

    Assert.areEqual(Resources.formatKeptSessionsNotClosed("fake", "TypeError"), host.log.lines.join("\n"));
  }

  @TestMethod
  public async closesNothingForAChatWithoutTurnsOrAKindWithoutKeptSessions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    const closed: string[] = [];
    host.adapter.closeSessions = ids => KeptSessionsTests.record(closed, "fake", ids);
    const quiet = await host.createConversationAsync();
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "other");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(quiet.id).toJson());
    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());

    Assert.areEqual("", closed.join(";"));
    Assert.areEqual("", host.log.lines.join("\n"));
  }

  @TestMethod
  public async deletesTheChatAndClosesNothingForAKindNoLongerRegistered(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    const closed: string[] = [];
    other.closeSessions = ids => KeptSessionsTests.record(closed, "other", ids);
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "other");
    host.registry.unregister("other");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());

    Assert.areEqual(JSON.stringify([[chat.id], ""]), JSON.stringify([KeptSessionsTests.deletedChats(host), closed.join(";")]));
  }

  @TestMethod
  public async deletesTheChatAndLogsAKindWhoseCloseThrows(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.closeSessions = () => {
      throw new TypeError("Fixture close threw");
    };
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "fake");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());
    await host.until("the thrown close is logged", () => host.log.lines.length > 0);

    Assert.areEqual(JSON.stringify([[chat.id], Resources.formatKeptSessionsNotClosed("fake", "TypeError")]),
      JSON.stringify([KeptSessionsTests.deletedChats(host), host.log.lines.join("\n")]));
  }

  @TestMethod
  public async closesTheSessionOfASubAgentWithItsParentChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const closed: string[] = [];
    host.adapter.closeSessions = ids => KeptSessionsTests.record(closed, "fake", ids);
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        return;
      await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
      await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 50));
    };
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "fake");
    const reply = await KeptSessionsTests.sessionsOfAsync(host, chat.id, "fake");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());

    const [kind, ids] = closed.join(";").split(" ");
    Assert.areEqual(JSON.stringify([2, "fake", [reply, "session-2"].sort()]), JSON.stringify([host.adapter.requests.length, kind, ids?.split(",").sort()]));
  }

  @TestMethod
  public async closesTheSessionOfASubAgentThatEndsAfterItsChatIsDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const closed: string[] = [];
    const both = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    host.adapter.closeSessions = async ids => {
      await KeptSessionsTests.record(closed, "fake", ids);
      if (closed.length === 2)
        both.resolve();
    };
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (Object.isNull(token))
        await release.promise;
      else
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Check the tests", "Run the tests."));
    };
    const chat = await host.createConversationAsync();
    await KeptSessionsTests.replyAsync(host, chat.id, "fake");
    const reply = await KeptSessionsTests.sessionsOfAsync(host, chat.id, "fake");
    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());

    release.resolve();
    await both.promise;

    Assert.areEqual(JSON.stringify([`fake ${reply}`, "fake session-2"]), JSON.stringify(closed));
  }

  @TestMethod
  public async rewindsTheChatsFolderToTheCheckpointBeforeTheRemovedReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    host.adapter.writeFiles = { "notes.md": "first\n" };
    await host.engine.sendAsync(await KeptSessionsTests.paramsAsync(host, chat.id, "First"));
    await host.engine.waitForIdle();
    host.adapter.writeFiles = { "notes.md": "second\n" };
    const second = await host.engine.sendAsync(await KeptSessionsTests.paramsAsync(host, chat.id, "Second"));
    await host.engine.waitForIdle();

    const result = await host.engine.rewindAsync(new ConversationRewindParams(chat.id, second.sent.id, true));

    Assert.areEqual(1, result.restoredFiles);
    Assert.areEqual("first\n", readFileSync(join(folder, "notes.md"), "utf8"));
    Assert.areEqual(`${chat.id} ${chat.folder}`, `${host.checkpoints.previews[0]?.folder.identity} ${host.checkpoints.previews[0]?.folder.path}`);
    Assert.isTrue(existsSync(join(folder, ".git", "HEAD")));
  }

  @TestMethod
  public async deletesAChatWithItsFolderAndThatFoldersCheckpoints(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    writeFileSync(join(folder, "a.txt"), "a");
    const inProject = await host.createConversationAsync();

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());
    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(inProject.id).toJson());

    Assert.isFalse(existsSync(folder));
    Assert.isNull(await host.conversations.findAsync(chat.id));
    Assert.areEqual(chat.id, host.checkpoints.deletes.map(t => t.folder.identity).join(","));
  }

  @TestMethod
  public async keepsTheFolderWhileItsCheckpointsAreHeldUpAndDeletesItAtTheNextStart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    host.checkpoints.deleteOutcome = DeleteFolderOutcome.HeldUp;

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());
    const kept = existsSync(folder);
    host.checkpoints.deleteOutcome = DeleteFolderOutcome.Deleted;
    await host.engine.sweepFoldersAsync(new AbortController().signal);

    Assert.isTrue(kept);
    Assert.isFalse(existsSync(folder));
    Assert.areEqual(`${chat.id},${chat.id}`, host.checkpoints.deletes.map(t => t.folder.identity).join(","));
    Assert.areEqual(Resources.formatChatFolderKept(chat.id, Resources.checkpointsHeldUp), host.log.lines.join("\n"));
  }

  @TestMethod
  public async keepsAndLogsAFolderWhoseCheckpointsTheSystemWontDelete(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    host.checkpoints.deleteError = new TypeError("held");

    await KeptSessionsTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson());

    Assert.isTrue(existsSync(folder));
    Assert.areEqual(Resources.formatChatFolderKept(chat.id, "TypeError"), host.log.lines.join("\n"));
  }

  @TestMethod
  public async deletesTheFolderAloneWithoutTheCheckpointsModule(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates,
      host.registry, host.events);
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    await host.conversations.deleteAsync(new ConversationIdParams(chat.id));

    await engine.releaseFolderAsync(chat.id);

    Assert.isFalse(existsSync(folder));
  }

  @TestMethod
  public async sweepsAtTheStartTheFoldersOfGoneAndMovedChatsAndKeepsTheRest(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const [kept, deleted, moved] = [await host.conversations.createAsync(new ConversationCreateParams(null, null)),
      await host.conversations.createAsync(new ConversationCreateParams(null, null)), await host.conversations.createAsync(new ConversationCreateParams(null, null))];
    Assert.isDefined(kept);
    Assert.isDefined(deleted);
    Assert.isDefined(moved);
    const [keptFolder, deletedFolder, movedFolder] = [kept.folder, deleted.folder, moved.folder];
    Assert.isNotNull(keptFolder);
    Assert.isNotNull(deletedFolder);
    Assert.isNotNull(movedFolder);
    await host.conversations.deleteAsync(new ConversationIdParams(deleted.id));
    await host.conversations.moveAsync(new ConversationMoveParams(moved.id, project.id));
    mkdirSync(join(host.directory.path, "chats", "orphan"));

    await host.engine.sweepFoldersAsync(new AbortController().signal);

    Assert.isTrue(existsSync(keptFolder));
    Assert.isFalse(existsSync(deletedFolder) || existsSync(movedFolder));
    Assert.areEqual(kept.id, host.context.chatFolders.list().join(","));
    Assert.areEqual([deleted.id, moved.id, "orphan"].sort().join(","), host.checkpoints.deletes.map(t => t.folder.identity).sort().join(","));
  }

  @TestMethod
  public async logsASweepWhoseChatsFolderCantBeListedAndReleasesNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    writeFileSync(join(host.directory.path, "chats"), "not a folder");

    await host.engine.sweepFoldersAsync(new AbortController().signal);

    Assert.areEqual(Resources.formatChatFoldersNotSwept("Error ENOTDIR"), host.log.lines.join("\n"));
    Assert.areEqual(0, host.checkpoints.deletes.length);
  }

  @TestMethod
  public async stopsTheSweepOnceItsSignalAbortsAndLogsAFolderWhoseChatCantBeReadWithoutRejecting(): Promise<void> {
    await using host = await CoreHost.createAsync();
    for (const chat of [await host.conversations.createAsync(new ConversationCreateParams(null, null)),
      await host.conversations.createAsync(new ConversationCreateParams(null, null))])
      await host.conversations.deleteAsync(new ConversationIdParams(chat.id));
    const [first] = host.context.chatFolders.list();
    const stop = new AbortController();
    host.conversations.findAsync = (): Promise<null> => {
      stop.abort();
      return Promise.reject(new TypeError("closed"));
    };

    await host.engine.sweepFoldersAsync(stop.signal);

    Assert.areEqual(Resources.formatChatFolderKept(first ?? "", "TypeError"), host.log.lines.join("\n"));
    Assert.areEqual(0, host.checkpoints.deletes.length);
    Assert.areEqual(2, host.context.chatFolders.list().length);
  }

  private static deletedChats(host: CoreHost): readonly string[] {
    return host.listener.events.filter(t => t.name === EventName.ConversationDeleted).map(t => ConversationIdParams.fromJson(t.payload).conversationId);
  }

  private static record(closed: string[], kind: string, ids: readonly string[]): Promise<void> {
    closed.push(`${kind} ${ids.join(",")}`);
    return Promise.resolve();
  }

  private static async replyAsync(host: CoreHost, conversationId: string, kind: string): Promise<void> {
    await host.engine.sendAsync(new MessageSendParams(conversationId, "Hi", new RequestedSettings(kind, null, null), (await host.providerOfAsync(kind)).id));
    await host.engine.waitForIdle();
  }

  private static async sessionsOfAsync(host: CoreHost, conversationId: string, kind: string): Promise<string> {
    const ids = (await host.messages.listAsync(new MessageListParams(conversationId, null)))
      .filter(t => t.provenance?.requested.kind === kind)
      .map(t => t.provenance?.nativeSessionId);
    return [...new Set(ids)].join(",");
  }

  private static async succeedAsync(host: CoreHost, method: MethodName, payload: unknown): Promise<void> {
    const response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
    Assert.isFalse(response.hasErrors);
  }

  private static async paramsAsync(host: CoreHost, conversationId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(conversationId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }
}
