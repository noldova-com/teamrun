/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, ConversationsService, DatabaseContext, EventHub, FolderCheckTimings, FolderProbe, FolderState, Guid, type IConversationsService, type IEventSink,
  ProjectsService } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { ConversationCreateParams, ErrorCode, EventName, Project, ProjectFolderChange, ProjectIdParams, ProjectOpenParams, ProjectsLayoutSaveParams }
  from "@noldova/teamrun.protocol";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { HeldFolderStat } from "../../fixtures/held-folder-stat.fixture.js";
import { RecordingEventListener } from "../../fixtures/recording-event-listener.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ProjectsServiceTests {
  @TestMethod
  public async listsNoProjectsAtFirst(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);

    Assert.areEqual(0, (await service.listProjectsAsync()).length);
  }

  @TestMethod
  public async opensAFolderCreatingTheProjectOnce(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const rootPath = join(directory.path, "workspace", "alpha");

    const project = await service.openAsync(new ProjectOpenParams(rootPath));
    const reopened = await service.openAsync(new ProjectOpenParams(rootPath + sep));

    Assert.areEqual(7, Guid.parse(project.id).version);
    Assert.areEqual("alpha", project.name);
    Assert.areEqual(rootPath, project.rootPath);
    Assert.isFalse(Number.isNaN(Date.parse(project.createdAt)));
    Assert.areEqual(project.id, reopened.id);
    Assert.areEqual(project.id, (await service.listProjectsAsync())[0]?.id);
    Assert.areEqual(1, (await service.listProjectsAsync()).length);
    const changes = await context.database.changeFeed.readAfterAsync(0);
    Assert.areEqual(1, changes.length);
    Assert.areEqual(ChangeEntity.Project, changes[0]?.entity);
    Assert.areEqual(project.id, changes[0]?.entityId);
    Assert.areEqual(ChangeOperation.Insert, changes[0]?.operation);
    Assert.areEqual(JSON.stringify(project.toJson()), changes[0]?.payload);
  }

  @TestMethod
  public async findsAProjectById(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const project = await service.openAsync(new ProjectOpenParams(join(directory.path, "alpha")));

    Assert.areEqual(project.id, (await service.findAsync(project.id))?.id);
    Assert.isNull(await service.findAsync("nope"));
  }

  @TestMethod
  public async listsEachProjectWithWhetherItsFolderIsMissingCheckedAtOnce(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const open = (name: string): Promise<Project> => service.openAsync(new ProjectOpenParams(join(directory.path, name)));
    const here = await open("here");
    const gone = await open("gone");
    const file = await open("file");
    const inside = await service.openAsync(new ProjectOpenParams(join(file.rootPath, "inside")));
    const there = await open("there");
    mkdirSync(here.rootPath);
    writeFileSync(file.rootPath, "not a folder");
    mkdirSync(there.rootPath);

    const listed = await service.listAsync();

    Assert.areEqual("here false,gone true,file true,inside true,there false", listed.map(t => `${t.project.name} ${t.folderMissing}`).join(","));
    Assert.areEqual(gone.id, listed[1]?.project.id);
    Assert.areEqual(inside.id, listed[3]?.project.id);
  }

  @TestMethod
  public async publishesEachChangeOfAFolderWhoeverChecksIt(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const service = ProjectsServiceTests.publishing(context, listener);
    const root = join(directory.path, "alpha");
    mkdirSync(root);
    const project = await service.openAsync(new ProjectOpenParams(root));
    await service.listAsync();

    rmSync(root, { recursive: true });
    const gone = await service.listAsync();
    await service.listAsync();
    mkdirSync(root);
    const back = await service.checkFolderAsync(root, project.id);
    await service.checkFolderAsync(root, project.id);

    Assert.isTrue(gone[0]?.folderMissing ?? false);
    Assert.areEqual(FolderState.Present, back);
    Assert.areEqual(`${project.id} true,${project.id} false`, ProjectsServiceTests.changes(listener));
  }

  @TestMethod
  public async checksTheFolderOfAProjectAsItOpensKeepingTheMarkOfAPathStillMissing(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const service = ProjectsServiceTests.publishing(context, listener);
    const root = join(directory.path, "alpha");

    const missing = listener.next(EventName.ProjectFolderChanged);
    const project = await service.openAsync(new ProjectOpenParams(root));
    await missing;
    await service.openAsync(new ProjectOpenParams(root));
    Assert.isTrue((await service.listAsync())[0]?.folderMissing ?? false);
    const back = listener.next(EventName.ProjectFolderChanged);
    mkdirSync(root);
    await service.openAsync(new ProjectOpenParams(root));
    await back;

    Assert.areEqual(`${project.id} true,${project.id} false`, ProjectsServiceTests.changes(listener));
  }

  @TestMethod
  public async keepsWhatACheckFoundOverALaterResultOfACheckThatBeganBeforeIt(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const stat = new HeldFolderStat();
    const service = ProjectsServiceTests.publishing(context, listener, stat);
    const root = join(directory.path, "alpha");
    mkdirSync(root);
    const project = await service.openAsync(new ProjectOpenParams(root));
    await service.listAsync();
    stat.hold(root);
    const asked = stat.paths.length + 1;
    const listing = service.listAsync();
    await ProjectsServiceTests.statCalledAsync(stat, asked);
    rmSync(root, { recursive: true });

    Assert.areEqual(FolderState.Missing, await service.checkFolderAsync(root, project.id));
    stat.release(root, true);

    Assert.isTrue((await listing)[0]?.folderMissing ?? false);
    Assert.areEqual(`${project.id} true`, ProjectsServiceTests.changes(listener));
  }

  @TestMethod
  public async answersAListingWithTheLastKnownStateOnceItsWaitPassesAndPublishesWhatTheCheckFindsLater(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const stat = new HeldFolderStat();
    const timer = new ManualTimer();
    const service = ProjectsServiceTests.publishing(context, listener, stat, timer);
    const root = join(directory.path, "alpha");
    mkdirSync(root);
    const project = await service.openAsync(new ProjectOpenParams(root));
    stat.hold(root);

    const asked = stat.paths.length + 1;
    const listing = service.listAsync();
    await ProjectsServiceTests.statCalledAsync(stat, asked);
    timer.advance(500);
    const listed = await listing;
    const changed = listener.next(EventName.ProjectFolderChanged);
    stat.release(root, false);

    const change = ProjectFolderChange.fromJson((await changed).payload);
    Assert.isFalse(listed[0]?.folderMissing ?? true);
    Assert.areEqual(`${project.id} true`, `${change.projectId} ${change.folderMissing}`);
  }

  @TestMethod
  public async marksAFolderWhoseCheckNeverAnswersOnceItsDeadlinePasses(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const stat = new HeldFolderStat();
    const timer = new ManualTimer();
    const service = ProjectsServiceTests.publishing(context, listener, stat, timer, new FolderCheckTimings(1_000, 5_000));
    const root = join(directory.path, "alpha");
    mkdirSync(root);
    const project = await service.openAsync(new ProjectOpenParams(root));
    await service.listAsync();
    stat.hold(root);

    const asked = stat.paths.length + 1;
    const listing = service.listAsync();
    await ProjectsServiceTests.statCalledAsync(stat, asked);
    timer.advance(1_000);
    const listed = await listing;

    Assert.isTrue(listed[0]?.folderMissing ?? false);
    Assert.areEqual(`${project.id} true`, ProjectsServiceTests.changes(listener));
  }

  @TestMethod
  public async logsACheckBegunAsAProjectOpensThatFails(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const log = new RecordingLog();
    const stat = new HeldFolderStat();
    const failing: IEventSink = { publish: () => { throw new Error("listener failed"); } };
    const service = new ProjectsService(context, new ConversationsService(context), null, failing, ProjectsServiceTests.probe(stat, new ManualTimer()), log);
    const root = join(directory.path, "alpha");
    stat.hold(root);

    const project = await service.openAsync(new ProjectOpenParams(root));
    stat.release(root, false);

    Assert.areEqual(FolderState.Missing, await service.checkFolderAsync(root, project.id));
    Assert.areEqual(`Checking the project's folder "${root}" failed: Error: listener failed`, log.lines.join("|"));
  }

  @TestMethod
  public async forgetsTheFolderStateOfAProjectItForgetsAndIgnoresACheckStillRunning(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const listener = new RecordingEventListener();
    const stat = new HeldFolderStat();
    const service = ProjectsServiceTests.publishing(context, listener, stat);
    const root = join(directory.path, "alpha");
    mkdirSync(root);
    const project = await service.openAsync(new ProjectOpenParams(root));
    await service.listAsync();
    stat.hold(root);
    const check = service.checkFolderAsync(root, project.id);

    await service.forgetAsync(new ProjectIdParams(project.id));
    stat.release(root, false);

    Assert.areEqual(FolderState.Missing, await check);
    Assert.areEqual("", ProjectsServiceTests.changes(listener));
  }

  @TestMethod
  public async listsProjectsInCreationOrder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const first = await service.openAsync(new ProjectOpenParams(join(directory.path, "first")));
    const second = await service.openAsync(new ProjectOpenParams(join(directory.path, "second")));

    Assert.areEqual([first.id, second.id].join(","), (await service.listProjectsAsync()).map(t => t.id).join(","));
  }

  @TestMethod
  public async preservesInsertionOrderWhenCreationTimesTie(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const timestamp = "2026-09-14T00:00:00.000Z";
    const first = new Project("00000000-0000-7000-8000-000000000002", "first", join(directory.path, "first"), timestamp);
    const second = new Project("00000000-0000-7000-8000-000000000001", "second", join(directory.path, "second"), timestamp);
    for (const project of [first, second])
      await context.database.connection.executeAsync(new SqlQuery("INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [project.id, project.rootPath, JSON.stringify(project.toJson()), timestamp, timestamp]));

    Assert.areEqual([first.id, second.id].join(","), (await service.listProjectsAsync()).map(t => t.id).join(","));
  }

  @TestMethod
  public async namesARootFolderByItsPath(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const root = resolveRoot(directory.path);

    const project = await ProjectsServiceTests.create(context).openAsync(new ProjectOpenParams(root));

    Assert.areEqual(root, project.name);
  }

  @TestMethod
  public async rejectsARelativeRootPath(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);

    const service = ProjectsServiceTests.create(context);
    const failure = await Assert.throwsAsync(() => service.openAsync(new ProjectOpenParams("relative/folder")), ServiceException);

    Assert.areEqual(ErrorCode.InvalidParams, failure.info.name);
    Assert.isTrue(failure.message.includes("relative/folder"));
  }

  @TestMethod
  public async keepsTheProjectsLayoutAsItIsAcrossOpensAndRecordsEachSave(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const first = { pinnedChats: ["c1"], chatOrder: { p1: ["c2", "c1"] } };
    const second = { pinnedChats: [], collapsedProjects: ["p1"] };
    {
      await using context = await DatabaseContext.openAsync(directory.path);
      const service = ProjectsServiceTests.create(context);

      Assert.isNull(await service.readLayoutAsync());
      Assert.areEqual(JSON.stringify(first), JSON.stringify(await service.saveLayoutAsync(new ProjectsLayoutSaveParams(first))));
      await service.saveLayoutAsync(new ProjectsLayoutSaveParams(second));

      const changes = (await context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Preference);
      Assert.areEqual([`${ChangeOperation.Insert} ${JSON.stringify(first)}`, `${ChangeOperation.Update} ${JSON.stringify(second)}`].join(","),
        changes.map(t => `${t.operation} ${t.payload}`).join(","));
    }
    await using context = await DatabaseContext.openAsync(directory.path);

    Assert.areEqual(JSON.stringify(second), JSON.stringify(await ProjectsServiceTests.create(context).readLayoutAsync()));
  }

  @TestMethod
  public async savesALayoutOnlyIfNoneIsKeptWhenAskedAndAnswersTheKeptOne(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const moved = { pinnedChats: ["c9"] };
    const pinned = { pinnedChats: ["c9", "c1"] };

    Assert.areEqual(JSON.stringify(moved), JSON.stringify(await service.saveLayoutAsync(new ProjectsLayoutSaveParams(moved, true))));
    await service.saveLayoutAsync(new ProjectsLayoutSaveParams(pinned));
    Assert.areEqual(JSON.stringify(pinned), JSON.stringify(await service.saveLayoutAsync(new ProjectsLayoutSaveParams(moved, true))));

    Assert.areEqual(JSON.stringify(pinned), JSON.stringify(await service.readLayoutAsync()));
    Assert.areEqual(2, (await context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Preference).length);
  }

  @TestMethod
  public async forgetsAProjectAndLogsTheDeletion(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const service = ProjectsServiceTests.create(context);
    const project = await service.openAsync(new ProjectOpenParams(join(directory.path, "alpha")));

    await service.forgetAsync(new ProjectIdParams(project.id));

    Assert.areEqual(0, (await service.listProjectsAsync()).length);
    const changes = await context.database.changeFeed.readAfterAsync(0);
    Assert.areEqual(2, changes.length);
    Assert.areEqual(ChangeOperation.Delete, changes[1]?.operation);
    Assert.areEqual(JSON.stringify(project.toJson()), changes[1]?.payload);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => service.forgetAsync(new ProjectIdParams(project.id)), ServiceException)).info.name);
  }

  @TestMethod
  public async forgetsAProjectWithItsConversations(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await DatabaseContext.openAsync(directory.path);
    const conversations = new ConversationsService(context);
    const service = ProjectsServiceTests.create(context, conversations);
    const project = await service.openAsync(new ProjectOpenParams(join(directory.path, "alpha")));
    const kept = await service.openAsync(new ProjectOpenParams(join(directory.path, "beta")));
    await conversations.createAsync(new ConversationCreateParams(project.id, "one"));
    await conversations.createAsync(new ConversationCreateParams(project.id, "two"));
    await conversations.createAsync(new ConversationCreateParams(kept.id, "three"));

    await service.forgetAsync(new ProjectIdParams(project.id));

    Assert.areEqual(1, (await service.listProjectsAsync()).length);
    Assert.areEqual(0, (await conversations.listAsync(new ProjectIdParams(project.id))).length);
    Assert.areEqual(1, (await conversations.listAsync(new ProjectIdParams(kept.id))).length);
    const [count] = await context.database.connection.queryAsync(new SqlQuery("SELECT COUNT(*) AS count FROM chats", []));
    Assert.areEqual(1, count?.readInteger("count"));
  }

  private static create(context: DatabaseContext, conversations: IConversationsService = new ConversationsService(context)): ProjectsService {
    return new ProjectsService(context, conversations, null, null, ProjectsServiceTests.probe(new HeldFolderStat(), new ManualTimer()), null);
  }

  private static publishing(context: DatabaseContext, listener: RecordingEventListener, stat: HeldFolderStat = new HeldFolderStat(), timer: ManualTimer = new ManualTimer(),
    timings: FolderCheckTimings = new FolderCheckTimings(1_000, 500)): ProjectsService {
    const events = new EventHub();
    events.subscribe(listener);
    return new ProjectsService(context, new ConversationsService(context), null, events, ProjectsServiceTests.probe(stat, timer, timings), null);
  }

  private static probe(stat: HeldFolderStat, timer: ManualTimer, timings: FolderCheckTimings = new FolderCheckTimings(1_000, 500)): FolderProbe {
    return new FolderProbe(stat.statAsync, timings, timer);
  }

  private static async statCalledAsync(stat: HeldFolderStat, count: number): Promise<void> {
    while (stat.paths.length < count)
      await ChangeSignal.next();
  }

  private static changes(listener: RecordingEventListener): string {
    return listener.events.filter(t => t.name === EventName.ProjectFolderChanged).map(t => ProjectFolderChange.fromJson(t.payload))
      .map(t => `${t.projectId} ${t.folderMissing}`).join();
  }
}

function resolveRoot(path: string): string {
  return path.slice(0, path.indexOf(sep) + 1);
}
