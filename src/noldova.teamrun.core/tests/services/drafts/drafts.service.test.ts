/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join } from "node:path";

import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentStore, ConversationsService, DatabaseContext, DraftsService, FolderCheckTimings, FolderProbe, ProjectsService } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import {
  AttachmentInput, ConversationCreateParams, ConversationIdParams, ConversationListParams, Draft, DraftDiscardParams, DraftSaveParams, ErrorCode, MessageAttachment,
  ProjectIdParams, ProjectOpenParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { HeldFolderStat } from "../../fixtures/held-folder-stat.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class DraftsServiceTests {
  @TestMethod
  public async savesReadsAndDiscardsADraftWithItsFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const id = new ConversationIdParams(conversation.id);
    Assert.isNull(await host.drafts.readAsync(id));

    const first = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    Assert.areEqual(1, first.revision);
    Assert.areEqual(join(host.directory.path, "attachments", "draft-files", conversation.id), dirname(first.attachments[0]!.path));
    Assert.areEqual("a", readFileSync(first.attachments[0]!.path, "utf8"));
    Assert.areEqual(JSON.stringify(first.toJson()), JSON.stringify((await host.drafts.readAsync(id))?.toJson()));

    const kept = first.attachments[0]!;
    const second = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look again",
      [new AttachmentInput(kept.name, kept.mediaType, null, kept.path), DraftsServiceTests.upload("b.txt", "b")]));
    Assert.areEqual(2, second.revision);
    Assert.areEqual(kept.path, second.attachments[0]!.path);
    Assert.areEqual(2, readdirSync(dirname(kept.path)).length);

    const third = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Only b",
      [new AttachmentInput("b.txt", "text/plain", null, second.attachments[1]!.path)]));
    Assert.isFalse(existsSync(kept.path));
    Assert.areEqual(1, readdirSync(dirname(kept.path)).length);

    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, third.revision));
    Assert.isNull(await host.drafts.readAsync(id));
    Assert.isFalse(existsSync(dirname(kept.path)));
    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id));
  }

  @TestMethod
  public async discardsOnlyWhileTheDraftIsStillAtTheGivenRevision(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "sent"));
    await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "typed after sending"));

    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, 1));
    Assert.areEqual("typed after sending", (await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.text);
    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, 2));
    Assert.isNull(await host.drafts.readAsync(new ConversationIdParams(conversation.id)));
  }

  @TestMethod
  public async forgetsAChatsDraftOnItsOwnConnectionWhenGivenNoTransaction(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "forgotten"));
    await host.drafts.saveAsync(new DraftSaveParams(other.id, "kept"));

    await host.drafts.forgetAsync(conversation.id);

    Assert.isNull(await host.drafts.readAsync(new ConversationIdParams(conversation.id)));
    Assert.areEqual("kept", (await host.drafts.readAsync(new ConversationIdParams(other.id)))?.text);
  }

  @TestMethod
  public async neverRepeatsARevisionAfterADiscard(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "sent"));
    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, 1));

    const typed = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "typed after sending"));
    await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, 1));

    Assert.areEqual(2, typed.revision);
    Assert.areEqual("typed after sending", (await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.text);
  }

  @TestMethod
  public async copiesAPreparedFileAndAMessageFileIntoTheDraft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const prepared = host.attachments.prepare(DraftsServiceTests.upload("a.txt", "a"));
    const [sent] = host.attachments.save([DraftsServiceTests.upload("b.txt", "b")]);

    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [
      new AttachmentInput(prepared.name, prepared.mediaType, null, prepared.path),
      new AttachmentInput(sent!.name, sent!.mediaType, null, sent!.path)]));
    const store = new AttachmentStore(host.directory.path);
    const read = await new DraftsService(host.context, store, host.log).readAsync(new ConversationIdParams(conversation.id));

    const folder = join(host.directory.path, "attachments", "draft-files", conversation.id);
    Assert.areEqual(folder + "," + folder, saved.attachments.map(t => dirname(t.path)).join(","));
    Assert.isFalse(existsSync(prepared.path));
    Assert.isTrue(existsSync(sent!.path));
    Assert.areEqual(saved.attachments.map(t => t.path).join(","), read?.attachments.map(t => t.path).join(","));
    Assert.areEqual("a,b", read?.attachments.map(t => readFileSync(t.path, "utf8")).join(","));
    Assert.areEqual(0, read?.missing.length);
  }

  @TestMethod
  public async refusesAPathOutsideTheStoreBeforeLookingForIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();

    for (const path of ["a.txt", join(host.directory.path, "elsewhere.txt")])
      Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look",
        [new AttachmentInput("a.txt", "text/plain", null, path)])), ServiceException)).info.name);
  }

  @TestMethod
  public async keepsADiscardThatCannotRemoveItsFilesAndSweepsThemLater(): Promise<void> {
    await using host = await CoreHost.createAsync();
    await host.drafts.sweepAsync();
    const conversation = await host.createConversationAsync();
    const kept = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    const held = await host.drafts.saveAsync(new DraftSaveParams(kept.id, "Keep", [DraftsServiceTests.upload("b.txt", "b")]));
    const original = fs.rmSync;
    fs.rmSync = () => { throw Object.assign(new Error("Simulated busy file"), { code: "EBUSY" }); };
    syncBuiltinESMExports();
    try {
      await host.drafts.discardAsync(new DraftDiscardParams(conversation.id, saved.revision));
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }
    writeFileSync(join(dirname(held.attachments[0]!.path), "left-by-a-crash.txt"), "c");

    Assert.isNull(await host.drafts.readAsync(new ConversationIdParams(conversation.id)));
    Assert.isTrue(existsSync(saved.attachments[0]!.path));
    Assert.areEqual(`The draft files of the chat ending in "${conversation.id.slice(-12)}" were not removed: EBUSY.`, host.log.lines.join("\n"));
    await host.drafts.sweepAsync();

    Assert.areEqual(1, host.log.lines.length);
    Assert.isFalse(existsSync(dirname(saved.attachments[0]!.path)));
    Assert.areEqual(basename(held.attachments[0]!.path), readdirSync(dirname(held.attachments[0]!.path)).join(","));
  }

  @TestMethod
  public async logsARemovalThatFailsAfterASaveAndInTheSweep(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const first = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    const original = fs.rmSync;
    try {
      fs.rmSync = () => { throw Object.assign(new Error("Simulated busy file"), { code: "EBUSY" }); };
      syncBuiltinESMExports();
      await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed", [DraftsServiceTests.upload("b.txt", "b")]));
      fs.rmSync = () => { throw "busy"; };
      syncBuiltinESMExports();
      await host.drafts.sweepAsync();
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    const tail = conversation.id.slice(-12);
    Assert.areEqual(`The draft files of the chat ending in "${tail}" were not removed: EBUSY.\n`
      + `The draft files of the chat ending in "${tail}" were not removed: string.`, host.log.lines.join("\n"));
    Assert.isTrue(existsSync(first.attachments[0]!.path));
  }

  @TestMethod
  public async logsARollbackRemovalThatFailsAndThrowsTheSavesOwnError(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await host.context.database.connection.executeAsync(new SqlQuery("CREATE TRIGGER failDraftUpdate BEFORE UPDATE ON drafts BEGIN SELECT RAISE(ABORT, 'boom'); END"));
    const original = fs.rmSync;
    fs.rmSync = () => { throw Object.assign(new Error("Simulated busy file"), { code: "EBUSY" }); };
    syncBuiltinESMExports();
    try {
      const error = await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed", [DraftsServiceTests.upload("b.txt", "b")])), Error);
      Assert.isTrue(error.message.includes("boom"));
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual(`The draft files of the chat ending in "${conversation.id.slice(-12)}" were not removed: EBUSY.`, host.log.lines.join("\n"));
  }

  @TestMethod
  public async sweepsPastAnUnreadableDraftAndKeepsItsFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE drafts SET json = 'not json' WHERE chatId = ?", [conversation.id]));
    const stray = join(host.directory.path, "attachments", "draft-files", "gone");
    mkdirSync(stray);
    writeFileSync(join(stray, "b.txt"), "b");

    await host.drafts.sweepAsync();

    Assert.isTrue(existsSync(saved.attachments[0]!.path));
    Assert.isFalse(existsSync(stray));
    Assert.areEqual(`The draft of the chat ending in "${conversation.id.slice(-12)}" was not read, so its files were kept: JsonException.`, host.log.lines.join("\n"));
  }

  @TestMethod
  public async sweepKeepsADraftsFilesAfterItsDataFolderMoved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    const elsewhere = join(host.directory.path + "-moved", "attachments", "draft-files", conversation.id);
    const moved = new Draft(saved.conversationId, saved.text,
      saved.attachments.map(t => new MessageAttachment(t.name, t.mediaType, t.size, join(elsewhere, basename(t.path)))),
      [], saved.revision, saved.updatedAt);
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE drafts SET json = ? WHERE chatId = ?",
      [JSON.stringify(moved.toJson()), conversation.id]));
    writeFileSync(join(dirname(saved.attachments[0]!.path), "left-by-a-crash.txt"), "c");

    await host.drafts.sweepAsync();

    Assert.areEqual(basename(saved.attachments[0]!.path), readdirSync(dirname(saved.attachments[0]!.path)).join(","));
  }

  @TestMethod
  public async readsASavedDraftBackAfterARestart(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const log = new RecordingLog();
    let conversationId: string;
    let path: string;
    {
      await using context = await DatabaseContext.openAsync(directory.path);
      const conversations = new ConversationsService(context);
      const folders = new FolderProbe(new HeldFolderStat().statAsync, new FolderCheckTimings(1_000, 500), new ManualTimer());
      const project = await new ProjectsService(context, conversations, null, null, folders, null).openAsync(new ProjectOpenParams(join(directory.path, "alpha")));
      conversationId = (await conversations.createAsync(new ConversationCreateParams(project.id, null))).id;
      const saved = await new DraftsService(context, new AttachmentStore(directory.path), log).saveAsync(
        new DraftSaveParams(conversationId, "Keep me", [DraftsServiceTests.upload("a.txt", "a")]));
      path = saved.attachments[0]!.path;
    }
    await using reopened = await DatabaseContext.openAsync(directory.path);

    const draft = await new DraftsService(reopened, new AttachmentStore(directory.path), log).readAsync(new ConversationIdParams(conversationId));

    Assert.areEqual("Keep me", draft?.text);
    Assert.areEqual(1, draft?.revision);
    Assert.areEqual(path, draft?.attachments[0]?.path);
    Assert.areEqual("a", readFileSync(path, "utf8"));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public async failsForAnUnknownConversation(): Promise<void> {
    await using host = await CoreHost.createAsync();

    for (const call of [
      () => host.drafts.saveAsync(new DraftSaveParams("missing", "text")),
      () => host.drafts.readAsync(new ConversationIdParams("missing")),
      () => host.drafts.discardAsync(new DraftDiscardParams("missing"))
    ])
      Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(call, ServiceException)).info.name);
    Assert.isFalse(existsSync(join(host.directory.path, "attachments", "draft-files")));
  }

  @TestMethod
  public async failsForAMissingFileAndNamesAFileThatWentMissing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    const gone = join(dirname(saved.attachments[0]!.path), "gone.txt");

    const exception = await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed",
      [DraftsServiceTests.upload("b.txt", "b"), new AttachmentInput("gone.txt", "text/plain", null, gone)])), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, exception.info.name);
    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify((await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.toJson()));
    Assert.areEqual(1, readdirSync(dirname(saved.attachments[0]!.path)).length);
    rmSync(saved.attachments[0]!.path);
    const read = await host.drafts.readAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual(0, read?.attachments.length);
    Assert.areEqual("a.txt", read?.missing.join(","));
  }

  @TestMethod
  public async leavesTheEarlierDraftWhenAWriteFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    const original = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error("Simulated disk write failure"); };
    syncBuiltinESMExports();
    try {
      await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed",
        [DraftsServiceTests.upload("b.txt", "b"), DraftsServiceTests.upload("c.txt", "c")])), Error);
    }
    finally {
      fs.writeFileSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify((await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.toJson()));
    Assert.areEqual(1, readdirSync(dirname(saved.attachments[0]!.path)).length);
  }

  @TestMethod
  public async removesTheNewFilesWhenTheDraftRowFailsToSave(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await host.context.database.connection.executeAsync(new SqlQuery("CREATE TRIGGER failDraftUpdate BEFORE UPDATE ON drafts BEGIN SELECT RAISE(ABORT, 'boom'); END"));

    await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed", [DraftsServiceTests.upload("b.txt", "b")])), Error);

    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify((await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.toJson()));
    Assert.areEqual(basename(saved.attachments[0]!.path), readdirSync(dirname(saved.attachments[0]!.path)).join(","));
    const fresh = await host.createConversationAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("CREATE TRIGGER failDraftInsert BEFORE INSERT ON drafts BEGIN SELECT RAISE(ABORT, 'boom'); END"));
    await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(fresh.id, "First", [DraftsServiceTests.upload("c.txt", "c")])), Error);
    Assert.isNull(await host.drafts.readAsync(new ConversationIdParams(fresh.id)));
    Assert.isFalse(existsSync(join(host.directory.path, "attachments", "draft-files", fresh.id)));
  }

  @TestMethod
  public async keepsTheEarlierDraftAndItsFilesWhenASaveFailsToCommit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await DraftsServiceTests.failDraftCommitsAsync(host);

    await Assert.throwsAsync(() => host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Changed", [DraftsServiceTests.upload("b.txt", "b")])), Error);

    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify((await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.toJson()));
    Assert.areEqual(basename(saved.attachments[0]!.path), readdirSync(dirname(saved.attachments[0]!.path)).join(","));
  }

  @TestMethod
  public async keepsTheDraftAndItsFilesWhenADiscardFailsToCommit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await DraftsServiceTests.failDraftCommitsAsync(host);

    await Assert.throwsAsync(() => host.drafts.discardAsync(new DraftDiscardParams(conversation.id, saved.revision)), Error);

    Assert.areEqual(JSON.stringify(saved.toJson()), JSON.stringify((await host.drafts.readAsync(new ConversationIdParams(conversation.id)))?.toJson()));
    Assert.areEqual("a", readFileSync(saved.attachments[0]!.path, "utf8"));
  }

  @TestMethod
  public async deletingAConversationDeletesItsDraft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const saved = await host.drafts.saveAsync(new DraftSaveParams(conversation.id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));

    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual(0, (await host.context.database.connection.queryAsync(new SqlQuery("SELECT chatId FROM drafts"))).length);
    Assert.isFalse(existsSync(dirname(saved.attachments[0]!.path)));
  }

  @TestMethod
  public async keepsTheDraftFilesWhenForgettingAProjectRollsBack(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    await host.drafts.saveAsync(new DraftSaveParams((await host.createConversationAsync(project)).id, "Look", [DraftsServiceTests.upload("a.txt", "a")]));
    await host.drafts.saveAsync(new DraftSaveParams((await host.createConversationAsync(project)).id, "Look", [DraftsServiceTests.upload("b.txt", "a")]));
    const [first, second] = await host.conversations.listAsync(new ConversationListParams(project.id));
    await host.context.database.connection.executeAsync(new SqlQuery(
      `CREATE TRIGGER failSecondDraft BEFORE DELETE ON drafts WHEN old.chatId = '${second!.id}' BEGIN SELECT RAISE(ABORT, 'boom'); END`));

    await Assert.throwsAsync(() => host.projects.forgetAsync(new ProjectIdParams(project.id)), Error);

    for (const conversation of [first!, second!]) {
      const draft = await host.drafts.readAsync(new ConversationIdParams(conversation.id));
      Assert.areEqual("a", readFileSync(draft!.attachments[0]!.path, "utf8"));
    }
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TRIGGER failSecondDraft"));
    await host.projects.forgetAsync(new ProjectIdParams(project.id));
    Assert.areEqual(0, readdirSync(join(host.directory.path, "attachments", "draft-files")).length);
  }

  private static async failDraftCommitsAsync(host: CoreHost): Promise<void> {
    const connection = host.context.database.connection;
    await connection.executeAsync(new SqlQuery("CREATE TABLE commitGuards (id INTEGER PRIMARY KEY)"));
    await connection.executeAsync(new SqlQuery("CREATE TABLE commitGuarded (guardId INTEGER REFERENCES commitGuards (id) DEFERRABLE INITIALLY DEFERRED)"));
    await connection.executeAsync(new SqlQuery("CREATE TRIGGER failDraftCommit AFTER UPDATE ON drafts BEGIN INSERT INTO commitGuarded VALUES (1); END"));
  }

  private static upload(name: string, text: string): AttachmentInput {
    return new AttachmentInput(name, "text/plain", Buffer.from(text).toString("base64"), null);
  }
}
