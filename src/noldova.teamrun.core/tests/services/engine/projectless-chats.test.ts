/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join, parse, relative } from "node:path";

import { JsonReader } from "@noldova/context.json";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DatabaseContext, Resources, TurnDetail } from "@noldova/teamrun.core";
import {
  AttachmentContent,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMoveParams,
  ConversationRenameParams,
  DetailKind,
  ErrorCode,
  FileChangeReader,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessagePageParams,
  MessageSendParams,
  MessageStatus,
  MethodName,
  ProjectIdParams,
  ReplyPanel,
  Request,
  RequestedSettings,
  WrittenImageReader,
  WrittenImageReadParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ProjectlessChatsTests {
  @TestMethod
  public async createsAChatWithoutAProjectInAnEmptyFolderOfItsOwnBeforeAnyTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const inProject = await host.createConversationAsync(project);

    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, "Scratch"));

    Assert.isNull(chat.projectId);
    Assert.areEqual(join(host.directory.path, "chats", chat.id), chat.folder);
    Assert.isTrue(existsSync(join(chat.folder!, ".git", "HEAD")));
    Assert.areEqual(0, await host.conversations.countFolderFilesAsync(new ConversationIdParams(chat.id)));
    Assert.isNull(inProject.folder);
    Assert.areEqual(chat.id, (await host.conversations.listAsync(new ConversationListParams(null))).map(t => t.id).join(","));
    Assert.areEqual(chat.id, (await host.conversations.listEmptyAsync(new ConversationListParams(null))).map(t => t.id).join(","));
    Assert.areEqual(inProject.id, (await host.conversations.listAsync(new ConversationListParams(project.id))).map(t => t.id).join(","));
    Assert.areEqual(chat.folder, (await host.conversations.findAsync(chat.id))?.folder);
  }

  @TestMethod
  public async keepsAChatWithoutAProjectAndItsFolderThroughARestart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    await host.context[Symbol.asyncDispose]();

    await using reopened = await DatabaseContext.openAsync(host.directory.path);
    const record = (await reopened.database.connection.queryAsync(new SqlQuery("SELECT projectId, json FROM chats")))[0];

    Assert.isNull(record?.readNullableString("projectId"));
    Assert.areEqual(chat.folder, Conversation.fromJson(JsonReader.parse(record?.readString("json") ?? "").toJson()).folder);
    Assert.isTrue(reopened.chatFolders.exists(chat.id));
  }

  @TestMethod
  public async givesAChatWithoutAProjectTheFolderOfItsIdInTodaysDataFolderWhateverPathItWasStoredWith(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const stale = chat.withFolder(join(host.directory.path, "moved", "chats", chat.id));
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE chats SET json = ? WHERE id = ?", [JSON.stringify(stale.toJson()), chat.id]));

    Assert.areEqual(join(host.directory.path, "chats", chat.id), (await host.conversations.findAsync(chat.id))?.folder);
    Assert.areEqual(chat.folder, (await host.conversations.listAsync(new ConversationListParams(null)))[0]?.folder);
  }

  @TestMethod
  public async runsEachTurnInTheChatsFolderMakingItAgainWhenItIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    rmSync(chat.folder!, { recursive: true });

    await host.engine.sendAsync(await ProjectlessChatsTests.paramsAsync(host, chat.id, "Hello"));
    await host.engine.waitForIdle();

    Assert.areEqual(chat.folder, host.adapter.requests[0]?.workingDirectory);
    Assert.isTrue(existsSync(join(chat.folder!, ".git", "HEAD")));
    Assert.areEqual(`${chat.id} ${chat.folder}`, `${host.checkpoints.captures[0]?.folder.identity} ${host.checkpoints.captures[0]?.folder.path}`);
  }

  @TestMethod
  public async renamesAChatWithoutAProjectAndKeepsItWithoutOneInItsFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);

    const renamed = await host.conversations.renameAsync(new ConversationRenameParams(chat.id, "Scratch"));

    Assert.areEqual(`Scratch null ${folder}`, `${renamed.title} ${renamed.projectId} ${renamed.folder}`);
    Assert.areEqual("Scratch", (await host.conversations.listAsync(new ConversationListParams(null))).map(t => t.title).join());
    Assert.areEqual(folder, (await host.conversations.findAsync(chat.id))?.folder);
    Assert.isTrue(existsSync(join(folder, ".git", "HEAD")));
  }

  @TestMethod
  public async listsInChangesAndActivityWhatATurnDidInTheChatsFolderAndNotesACommandRunOutsideIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = chat.folder;
    Assert.isNotNull(folder);
    const outside = parse(folder).root;
    host.adapter.writeFiles = { "notes.md": "first\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "ls", { command: "ls", cwd: outside }, null),
      new TurnDetail(DetailKind.Command, "pwd", { command: "pwd", cwd: folder }, null)];

    const result = await host.engine.sendAsync(await ProjectlessChatsTests.paramsAsync(host, chat.id, "Write notes"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? String.empty);
    Assert.isNotNull(reply);
    const edits = new FileChangeReader().editsOf(reply);
    const pageAsync = async (panel: ReplyPanel): Promise<string> => (await host.messages.replyPageAsync(new MessagePageParams(chat.id, null, null, 50), panel)).replies.map(t => t.preview.id).join();

    Assert.areEqual("notes.md:add", edits.map(t => `${relative(folder, t.path)}:${t.kind}`).join());
    Assert.areEqual(Resources.formatCommandsOutsideFolders(outside), reply.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
    Assert.areEqual(`${reply.id} ${reply.id}`, `${await pageAsync(ReplyPanel.Changes)} ${await pageAsync(ReplyPanel.Activity)}`);
  }

  @TestMethod
  public async readsAnImageAReplyDrewFromTheChatsFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    mkdirSync(join(chat.folder!, "out"));
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    writeFileSync(join(chat.folder!, "out", "drawn.png"), png);
    const message = new Message("reply", chat.id, 0, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Drew ![chart](out/drawn.png).", null, "t")], null, "t", null, "t");
    await host.messages.insertAsync(message);
    const [path] = new WrittenImageReader().markdownImagePathsOf(message, chat.folder!);
    rmSync(join(chat.folder!, ".git"), { recursive: true });

    const read = await ProjectlessChatsTests.succeedAsync(host, MethodName.WrittenImageRead, new WrittenImageReadParams(chat.id, "reply", path!).toJson());

    Assert.areEqual(png.toString("base64"), AttachmentContent.fromJson(read).data);
    Assert.isFalse(existsSync(join(chat.folder!, ".git")));
  }

  @TestMethod
  public async movesAChatIntoAProjectCopyingItsFilesSoTheNextTurnRunsThere(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    mkdirSync(join(chat.folder!, "src"));
    writeFileSync(join(chat.folder!, "src", "main.ts"), "code");

    const moved = Conversation.fromJson(await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationMove,
      new ConversationMoveParams(chat.id, project.id).toJson()));
    await host.engine.sendAsync(await ProjectlessChatsTests.paramsAsync(host, chat.id, "Next"));
    await host.engine.waitForIdle();

    Assert.areEqual(project.id, moved.projectId);
    Assert.isNull(moved.folder);
    Assert.areEqual("code", readFileSync(join(project.rootPath, "src", "main.ts"), "utf8"));
    Assert.isFalse(existsSync(join(project.rootPath, ".git")));
    Assert.isFalse(existsSync(chat.folder!));
    Assert.areEqual(`${chat.id} ${chat.folder}`, `${host.checkpoints.deletes[0]?.folder.identity} ${host.checkpoints.deletes[0]?.folder.path}`);
    Assert.areEqual(project.rootPath, host.adapter.requests[0]?.workingDirectory);
    Assert.areEqual(0, await host.conversations.countFolderFilesAsync(new ConversationIdParams(chat.id)));
  }

  @TestMethod
  public async refusesTheWholeMoveWhenTheProjectHoldsAFileOfTheSameNameAndKeepsTheChatWhereItIs(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    writeFileSync(join(project.rootPath, "a.txt"), "theirs");
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    writeFileSync(join(chat.folder!, "b.txt"), "ours");

    const refused = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()));

    Assert.areEqual(ErrorCode.Conflict, refused.info?.name);
    Assert.areEqual("a.txt", refused.info?.arguments.join(","));
    Assert.areEqual("theirs", readFileSync(join(project.rootPath, "a.txt"), "utf8"));
    Assert.isFalse(existsSync(join(project.rootPath, "b.txt")));
    Assert.isNull((await host.conversations.findAsync(chat.id))?.projectId);
    Assert.areEqual(2, await host.conversations.countFolderFilesAsync(new ConversationIdParams(chat.id)));
    Assert.areEqual(0, host.checkpoints.deletes.length);
  }

  @TestMethod
  public async answersOtherRequestsDuringAMovesCopyAndRefusesAnotherMoveOrADeleteOfThatChatUntilItEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const other = await host.openProjectAsync("beta");
    mkdirSync(project.rootPath, { recursive: true });
    mkdirSync(other.rootPath, { recursive: true });
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    using copy = ProjectlessChatsTests.holdCopy(join(project.rootPath, "a.txt"));

    const moving = host.dispatcher.dispatch(new Request("r1", MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()));
    await copy.reached;
    const listed = await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationList, new ConversationListParams(null).toJson()) as { id: string }[];
    const movedElsewhere = await host.dispatcher.dispatch(new Request("r2", MethodName.ConversationMove, new ConversationMoveParams(chat.id, other.id).toJson()));
    const deleted = await host.dispatcher.dispatch(new Request("r3", MethodName.ConversationDelete, new ConversationIdParams(chat.id).toJson()));
    copy.release();
    const moved = await moving;

    Assert.areEqual(chat.id, listed.map(t => t.id).join(","));
    Assert.areEqual(`${ErrorCode.Conflict} ${ErrorCode.Conflict}`, `${movedElsewhere.info?.name} ${deleted.info?.name}`);
    Assert.isFalse(moved.hasErrors);
    Assert.areEqual(project.id, (await host.conversations.findAsync(chat.id))?.projectId);
    Assert.areEqual("ours", readFileSync(join(project.rootPath, "a.txt"), "utf8"));
    Assert.areEqual(0, readdirSync(other.rootPath).length);
  }

  @TestMethod
  public async removesWhatTheCopyMadeAndLeavesTheChatWhereItWasWhenTheProjectIsForgottenDuringTheCopy(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    writeFileSync(join(project.rootPath, "kept.txt"), "theirs");
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    mkdirSync(join(chat.folder!, "src"));
    writeFileSync(join(chat.folder!, "src", "b.txt"), "ours");
    using copy = ProjectlessChatsTests.holdCopy(join(project.rootPath, "src", "b.txt"));

    const moving = host.dispatcher.dispatch(new Request("r1", MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()));
    await copy.reached;
    const copiedBefore = readdirSync(project.rootPath).sort().join(",");
    await ProjectlessChatsTests.succeedAsync(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());
    copy.release();
    const refused = await moving;

    copy[Symbol.dispose]();
    const other = await host.openProjectAsync("beta");
    mkdirSync(other.rootPath, { recursive: true });
    const counted = await host.conversations.countFolderFilesAsync(new ConversationIdParams(chat.id));
    const deletes = host.checkpoints.deletes.length;
    const moved = Conversation.fromJson(await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationMove, new ConversationMoveParams(chat.id, other.id).toJson()));

    Assert.areEqual("a.txt,kept.txt,src", copiedBefore);
    Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    Assert.areEqual("kept.txt", readdirSync(project.rootPath).join(","));
    Assert.areEqual(`2 0 ${other.id}`, `${counted} ${deletes} ${moved.projectId}`);
    Assert.areEqual("ours", readFileSync(join(other.rootPath, "src", "b.txt"), "utf8"));
    host.context.projectActivity.requireIdle(project.rootPath);
  }

  @TestMethod
  public async removesWhatACopyThatFailedMadeSoAnotherMoveOfTheChatSucceeds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    writeFileSync(join(project.rootPath, "kept.txt"), "theirs");
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    mkdirSync(join(chat.folder!, "src"));
    writeFileSync(join(chat.folder!, "src", "b.txt"), "ours");
    const refused = await ProjectlessChatsTests.withFailingCopy(join(project.rootPath, "src", "b.txt"),
      () => host.dispatcher.dispatch(new Request("r1", MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson())));
    const left = readdirSync(project.rootPath).join(",");
    const unchanged = (await host.conversations.findAsync(chat.id))?.projectId ?? null;

    const moved = Conversation.fromJson(await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()));

    Assert.areEqual(`${ErrorCode.Internal} ENOSPC: no space left on device`, `${refused.info?.name} ${refused.info?.message}`);
    Assert.areEqual("kept.txt", left);
    Assert.isNull(unchanged);
    Assert.areEqual(project.id, moved.projectId);
    Assert.areEqual("ours", readFileSync(join(project.rootPath, "src", "b.txt"), "utf8"));
    Assert.areEqual("", host.log.lines.join("\n"));
  }

  @TestMethod
  public async removesTheCopiesWhenAReplyOpenedInTheChatDuringTheCopyAndLogsOneItCouldntRemove(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    mkdirSync(join(chat.folder!, "src"));
    writeFileSync(join(chat.folder!, "src", "b.txt"), "ours");
    const stuck = join(project.rootPath, "a.txt");
    using copy = ProjectlessChatsTests.holdCopy(join(project.rootPath, "src", "b.txt"));
    using removal = ProjectlessChatsTests.failRemoval(stuck);

    const moving = host.dispatcher.dispatch(new Request("r1", MethodName.ConversationMove, new ConversationMoveParams(chat.id, project.id).toJson()));
    await copy.reached;
    await host.messages.insertAsync(new Message("m1", chat.id, 0, MessageAuthor.User, null, MessageStatus.Running, [], null, new Date().toISOString(), null, null));
    copy.release();
    const refused = await moving;
    removal[Symbol.dispose]();

    Assert.areEqual(ErrorCode.Conflict, refused.info?.name);
    Assert.areEqual("a.txt", readdirSync(project.rootPath).join(","));
    Assert.isNull((await host.conversations.findAsync(chat.id))?.projectId);
    Assert.areEqual(Resources.formatMoveCopiesKept(chat.id, [stuck]), host.log.lines.join("\n"));
  }

  @TestMethod
  public async refusesAMoveOrADeleteWhileAReplyRunsInTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "ours");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(await ProjectlessChatsTests.paramsAsync(host, chat.id, "Wait"));
    await host.adapter.requested(1);
    try {
      const move = await Assert.throwsAsync(() => host.conversations.moveAsync(new ConversationMoveParams(chat.id, project.id)), ServiceException);
      const deletion = await Assert.throwsAsync(() => host.conversations.deleteAsync(new ConversationIdParams(chat.id)), ServiceException);

      Assert.areEqual(`${ErrorCode.Conflict} ${ErrorCode.Conflict}`, `${move.info.name} ${deletion.info.name}`);
      Assert.isFalse(existsSync(join(project.rootPath, "a.txt")));
      Assert.isTrue(existsSync(join(chat.folder!, "a.txt")));
    }
    finally {
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
      await host.engine.waitForIdle();
    }
  }

  @TestMethod
  public async countsTheFilesOfAChatsFolderAndNoneForAChatInAProject(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    writeFileSync(join(chat.folder!, "a.txt"), "a");
    mkdirSync(join(chat.folder!, "src"));
    writeFileSync(join(chat.folder!, "src", "b.txt"), "b");

    const count = await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationFolderCount, new ConversationIdParams(chat.id).toJson());
    const none = await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationFolderCount, new ConversationIdParams((await host.createConversationAsync()).id).toJson());
    const missing = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationFolderCount, new ConversationIdParams("missing").toJson()));

    Assert.areEqual("2 0", `${String(count)} ${String(none)}`);
    Assert.areEqual(ErrorCode.NotFound, missing.info?.name);
  }

  @TestMethod
  public async listsTheChatsWithoutAProjectThroughTheDispatcher(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    await host.createConversationAsync();

    const listed = await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationList, new ConversationListParams(null).toJson());
    const empty = await ProjectlessChatsTests.succeedAsync(host, MethodName.ConversationListEmpty, new ConversationListParams(null).toJson());

    Assert.areEqual(chat.id, (listed as readonly { readonly id: string }[]).map(t => t.id).join(","));
    Assert.areEqual(chat.id, (empty as readonly { readonly id: string }[]).map(t => t.id).join(","));
  }

  private static async paramsAsync(host: CoreHost, conversationId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(conversationId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }

  private static holdCopy(path: string): { readonly reached: Promise<void>; readonly release: () => void } & Disposable {
    let reach!: () => void;
    let release!: () => void;
    const reached = new Promise<void>(resolve => {
      reach = resolve;
    });
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    const original = fs.promises.cp;
    fs.promises.cp = new Proxy(original, { apply: async (copy, self, args: unknown[]): Promise<unknown> => {
      if (args[1] === path) {
        reach();
        await released;
      }
      return await Reflect.apply(copy, self, args) as unknown;
    } });
    syncBuiltinESMExports();
    return {
      reached,
      release,
      [Symbol.dispose]: () => {
        fs.promises.cp = original;
        syncBuiltinESMExports();
      }
    };
  }

  private static async withFailingCopy<T>(path: string, action: () => Promise<T>): Promise<T> {
    const full = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
    const original = fs.promises.cp;
    fs.promises.cp = new Proxy(original, { apply: (copy, self, args: unknown[]): unknown =>
      args[1] === path ? Promise.reject(full) : Reflect.apply(copy, self, args) });
    syncBuiltinESMExports();
    try {
      return await action();
    }
    finally {
      fs.promises.cp = original;
      syncBuiltinESMExports();
    }
  }

  private static failRemoval(path: string): Disposable {
    const original = fs.promises.rm;
    fs.promises.rm = new Proxy(original, { apply: (remove, self, args: unknown[]): unknown =>
      args[0] === path ? Promise.reject(Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" })) : Reflect.apply(remove, self, args) });
    syncBuiltinESMExports();
    return {
      [Symbol.dispose]: () => {
        fs.promises.rm = original;
        syncBuiltinESMExports();
      }
    };
  }

  private static async succeedAsync(host: CoreHost, method: MethodName, payload: unknown): Promise<unknown> {
    const response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
    Assert.isFalse(response.hasErrors);
    return response.payload;
  }
}
