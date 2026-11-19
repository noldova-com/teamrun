/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, WorkFolder } from "@noldova/teamrun.core";
import {
  ChatFolderAttachParams,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRewindParams,
  DetailKind,
  ErrorCode,
  EventName,
  MessageIdParams,
  MessageSendParams,
  type MessageSendResult,
  MessageStatus,
  MethodName,
  Request,
  RequestedSettings
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class AttachedFoldersTests {
  @TestMethod
  public async attachesAFolderSoTheNextTurnRunsThereInPlaceCopyingNothingAndKeepsItThroughARead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), { "index.html": "<p>home</p>" });
    host.adapter.writeFiles = { "index.html": "<p>new</p>" };

    const before = host.listener.count(EventName.StateInvalidated);
    const attached = await AttachedFoldersTests.attachAsync(host, chat.id, site);
    const invalidated = host.listener.count(EventName.StateInvalidated) - before;
    const read = await host.conversations.findAsync(chat.id);
    await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "Edit the page"));
    await host.engine.waitForIdle();

    Assert.areEqual(`${site} ${site} true`, `${attached.attachedFolder} ${attached.folder} ${attached.edited}`);
    Assert.areEqual(`${site} ${site}`, `${read?.attachedFolder} ${read?.folder}`);
    Assert.areEqual(site, host.adapter.requests[0]?.workingDirectory);
    Assert.areEqual("<p>new</p>", readFileSync(join(site, "index.html"), "utf8"));
    Assert.areEqual("index.html", readdirSync(site).join(","));
    Assert.areEqual(0, await host.conversations.countFolderFilesAsync(new ConversationIdParams(chat.id)));
    Assert.areEqual(`${WorkFolder.attached(site).id} ${site}`, `${host.checkpoints.captures[0]?.folder.identity} ${host.checkpoints.captures[0]?.folder.path}`);
    Assert.areEqual(1, invalidated);
  }

  @TestMethod
  public async replacesAndDetachesTheFolderSoEachNextTurnRunsInTheChosenFolderOrTheChatsOwnAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const first = AttachedFoldersTests.folder(join(host.directory.path, "first"), {});
    const second = AttachedFoldersTests.folder(join(host.directory.path, "second"), { "kept.txt": "kept" });
    await AttachedFoldersTests.attachAsync(host, chat.id, first);

    const replaced = await AttachedFoldersTests.attachAsync(host, chat.id, second);
    await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "There"));
    await host.engine.waitForIdle();
    const detached = Conversation.fromJson(await AttachedFoldersTests.succeedAsync(host, MethodName.ChatFolderDetach, new ConversationIdParams(chat.id).toJson()));
    const again = Conversation.fromJson(await AttachedFoldersTests.succeedAsync(host, MethodName.ChatFolderDetach, new ConversationIdParams(chat.id).toJson()));
    await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "Home"));
    await host.engine.waitForIdle();

    Assert.areEqual(`${second} ${second}`, `${replaced.attachedFolder} ${replaced.folder}`);
    Assert.areEqual(`null ${chat.folder}`, `${detached.attachedFolder} ${detached.folder}`);
    Assert.areEqual(`null ${chat.folder}`, `${again.attachedFolder} ${again.folder}`);
    Assert.areEqual(`${second},${chat.folder}`, host.adapter.requests.map(t => t.workingDirectory).join(","));
    Assert.areEqual("kept", readFileSync(join(second, "kept.txt"), "utf8"));
    Assert.isTrue(existsSync(first));
  }

  @TestMethod
  public async refusesAFolderThatIsntAnAbsolutePathToAFolderAChatInAProjectAnUnknownChatAndAnyChangeWhileAReplyRunsInTheChatOrTheFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), { "a.txt": "a" });
    const other = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const inProject = await host.createConversationAsync();
    const refusal = async (method: MethodName, payload: unknown): Promise<string> =>
      (await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)))).info?.name ?? "none";

    const refused = [
      await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, "site").toJson()),
      await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, join(host.directory.path, "gone")).toJson()),
      await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, join(site, "a.txt")).toJson()),
      await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(inProject.id, site).toJson()),
      await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams("missing", site).toJson()),
      await refusal(MethodName.ChatFolderDetach, new ConversationIdParams("missing").toJson())
    ];
    await AttachedFoldersTests.attachAsync(host, chat.id, site);
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "Wait"));
    await host.adapter.requested(1);
    try {
      refused.push(await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(chat.id, join(host.directory.path, "chats")).toJson()),
        await refusal(MethodName.ChatFolderDetach, new ConversationIdParams(chat.id).toJson()),
        await refusal(MethodName.ChatFolderAttach, new ChatFolderAttachParams(other.id, site).toJson()));
    }
    finally {
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]?.id ?? String.empty));
      await host.engine.waitForIdle();
    }

    Assert.areEqual([ErrorCode.InvalidParams, ErrorCode.InvalidParams, ErrorCode.InvalidParams, ErrorCode.Conflict, ErrorCode.NotFound, ErrorCode.NotFound,
      ErrorCode.Conflict, ErrorCode.Conflict, ErrorCode.Conflict].join(","), refused.join(","));
    Assert.areEqual(site, (await host.conversations.findAsync(chat.id))?.attachedFolder);
    Assert.isNull((await host.conversations.findAsync(other.id))?.attachedFolder ?? null);
    Assert.isNull((await host.conversations.findAsync(inProject.id))?.attachedFolder ?? null);
  }

  @TestMethod
  public async refusesAFolderWhoseCheckDoesntAnswerInTime(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const share = AttachedFoldersTests.folder(join(host.directory.path, "share"), {});
    host.folderStat.hold(share);
    const before = host.folderStat.paths.length;

    const attaching = Assert.throwsAsync(() => host.conversations.attachFolderAsync(new ChatFolderAttachParams(chat.id, share), t => host.projects.checkFolderAsync(t, null)),
      ServiceException);
    await host.until("the held folder check", () => host.folderStat.paths.length > before);
    host.timer.advance(1_000);
    const refused = await attaching;
    host.folderStat.release(share, true);

    Assert.areEqual(`${ErrorCode.InvalidParams} ${Resources.formatFolderNotAttached(share)}`, `${refused.info.name} ${refused.message}`);
    Assert.isNull((await host.conversations.findAsync(chat.id))?.attachedFolder ?? null);
  }

  @TestMethod
  public async refusesTheAttachWhenTheChatMovesIntoAProjectWhileItsFolderIsChecked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), {});
    host.folderStat.hold(site);
    const before = host.folderStat.paths.length;

    const attaching = Assert.throwsAsync(() => host.conversations.attachFolderAsync(new ChatFolderAttachParams(chat.id, site), t => host.projects.checkFolderAsync(t, null)),
      ServiceException);
    await host.until("the held folder check", () => host.folderStat.paths.length > before);
    await AttachedFoldersTests.succeedAsync(host, MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson());
    host.folderStat.release(site, true);
    const refused = await attaching;

    Assert.areEqual(`${ErrorCode.Conflict} ${Resources.formatChatInProject(chat.id)}`, `${refused.info.name} ${refused.message}`);
    const found = await host.conversations.findAsync(chat.id);
    Assert.areEqual(`${project.id} null`, `${found?.projectId} ${found?.attachedFolder}`);
  }

  @TestMethod
  public async failsATurnWithoutStartingItsProviderWhenTheAttachedFolderIsGoneCantBeReadOrDoesntAnswer(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), {});
    await AttachedFoldersTests.attachAsync(host, chat.id, site);
    const notes: string[] = [];
    const sendAsync = async (text: string): Promise<MessageSendResult> => host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, text));

    host.folderStat.failNext(site, "EACCES");
    const denied = await sendAsync("Denied");
    await host.engine.waitForIdle();
    notes.push(await AttachedFoldersTests.noteOfAsync(host, denied));
    host.folderStat.hold(site);
    const before = host.folderStat.paths.length;
    const held = await sendAsync("Held");
    await host.until("the held folder check", () => host.folderStat.paths.length > before, host.runs());
    host.timer.advance(1_000);
    await host.engine.waitForIdle();
    host.folderStat.release(site, true);
    notes.push(await AttachedFoldersTests.noteOfAsync(host, held));
    rmSync(site, { recursive: true });
    const gone = await sendAsync("Gone");
    await host.engine.waitForIdle();
    notes.push(await AttachedFoldersTests.noteOfAsync(host, gone));

    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual([Resources.formatAttachedFolderMissing(site), Resources.formatAttachedFolderUnreachable(site), Resources.formatAttachedFolderMissing(site)]
      .map(t => `${MessageStatus.Failed} ${DetailKind.Error} ${t}`).join("|"), notes.join("|"));
    Assert.isFalse(existsSync(site));
  }

  @TestMethod
  public async neverTouchesTheAttachedFolderWhenTheChatIsDeletedMovedOrItsOwnFolderSweptEvenWithItsOwnFolderGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const deleted = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const moved = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), { "a.txt": "a" });
    const other = AttachedFoldersTests.folder(join(host.directory.path, "other"), { "b.txt": "b" });
    await AttachedFoldersTests.attachAsync(host, deleted.id, site);
    await AttachedFoldersTests.attachAsync(host, moved.id, other);
    await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, deleted.id, "Work"));
    await host.engine.waitForIdle();
    rmSync(deleted.folder ?? String.empty, { recursive: true });

    await AttachedFoldersTests.succeedAsync(host, MethodName.ConversationDelete, new ConversationIdParams(deleted.id).toJson());
    const inProject = Conversation.fromJson(await AttachedFoldersTests.succeedAsync(host, MethodName.ConversationMove,
      new ConversationMoveParams(moved.id, project.id).toJson()));
    await host.engine.sweepFoldersAsync();

    Assert.areEqual("a.txt b.txt", `${readdirSync(site).join(",")} ${readdirSync(other).join(",")}`);
    Assert.areEqual("null null", `${inProject.attachedFolder} ${inProject.folder}`);
    Assert.isFalse(existsSync(join(project.rootPath, "b.txt")));
    Assert.isFalse(existsSync(moved.folder ?? String.empty));
    Assert.areEqual(moved.id, host.checkpoints.deletes.map(t => t.folder.identity).join(","));
  }

  @TestMethod
  public async restoresARewoundRepliesFilesInTheAttachedFolderThroughItsOwnCheckpoints(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const site = AttachedFoldersTests.folder(join(host.directory.path, "site"), { "base.txt": "one\n" });
    await AttachedFoldersTests.attachAsync(host, chat.id, site);
    host.adapter.writeFiles = { "base.txt": "two\n" };
    await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "First"));
    await host.engine.waitForIdle();
    host.adapter.writeFiles = { "base.txt": "three\n", "new.txt": "x\n" };
    const second = await host.engine.sendAsync(await AttachedFoldersTests.paramsAsync(host, chat.id, "Second"));
    await host.engine.waitForIdle();

    const result = await host.engine.rewindAsync(new ConversationRewindParams(chat.id, second.sent.id, true));

    Assert.areEqual(2, result.restoredFiles);
    Assert.areEqual("two\n", readFileSync(join(site, "base.txt"), "utf8"));
    Assert.isFalse(existsSync(join(site, "new.txt")));
    Assert.isFalse(existsSync(join(site, ".git")));
    Assert.areEqual(`${WorkFolder.attached(site).id} ${site}`, `${host.checkpoints.restores[0]?.folder.identity} ${host.checkpoints.restores[0]?.folder.path}`);
    Assert.isTrue(existsSync(chat.folder ?? String.empty));
  }

  @TestMethod
  public namesAnAttachedFoldersCheckpointsByItsPathComparedWithoutCaseOnlyOnWindows(): void {
    const folder = WorkFolder.attached("/Site");

    Assert.areEqual("/Site", folder.path);
    Assert.isTrue(/^folder-[0-9a-f]{32}$/u.test(folder.id));
    Assert.areEqual(folder.id, WorkFolder.attached("/Site").id);
    Assert.areNotEqual(folder.id, WorkFolder.attached("/Other").id);
    Assert.areEqual(WorkFolder.attached("C:/Site", "win32").id, WorkFolder.attached("c:/site", "win32").id);
    Assert.areNotEqual(WorkFolder.attached("/Site", "linux").id, WorkFolder.attached("/site", "linux").id);
    Assert.areEqual(WorkFolder.attached("/Site", process.platform).id, folder.id);
  }

  private static folder(path: string, files: Readonly<Record<string, string>>): string {
    mkdirSync(path, { recursive: true });
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(path, name), content);
    return path;
  }

  private static async attachAsync(host: CoreHost, chatId: string, folder: string): Promise<Conversation> {
    return Conversation.fromJson(await AttachedFoldersTests.succeedAsync(host, MethodName.ChatFolderAttach, new ChatFolderAttachParams(chatId, folder).toJson()));
  }

  private static async paramsAsync(host: CoreHost, conversationId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(conversationId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }

  private static async noteOfAsync(host: CoreHost, sent: MessageSendResult): Promise<string> {
    const reply = await host.messages.findAsync(sent.replies[0]?.id ?? String.empty);
    if (Object.isNull(reply))
      throw new Error("The send's reply is not stored.");
    return `${reply.status} ${reply.details.map(t => `${t.kind} ${t.text}`).join()}`;
  }

  private static async succeedAsync(host: CoreHost, method: MethodName, payload: unknown): Promise<unknown> {
    const response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
    Assert.isFalse(response.hasErrors);
    return response.payload;
  }
}
