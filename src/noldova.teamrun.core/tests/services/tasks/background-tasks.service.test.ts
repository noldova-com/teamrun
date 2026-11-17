/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SqlQuery } from "@noldova/context.data.sql";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackgroundTasksService, EventHub, TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { BackgroundTask, BackgroundTaskIdParams, BackgroundTaskListParams, BackgroundTaskOutputPayload, BackgroundTaskPage, BackgroundTasksClearedPayload,
  BackgroundTaskStatus, ConversationIdParams, ErrorCode, EventName, MethodName, Request, Resources } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { RecordingEventListener } from "../../fixtures/recording-event-listener.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";

@TestClass
export class BackgroundTasksServiceTests {
  @TestMethod
  public async startsATaskOnceAndPublishesIt(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();

    const started = await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", () => Promise.resolve()));
    const again = await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev --again", () => Promise.resolve()));
    service.forget(["conv-2"]);
    const forgotten = await service.startAsync("conv-2", "msg-2", "codex", new TaskStart("item-2", "npm test", () => Promise.resolve()));

    const tasks = await service.listAsync(new ConversationIdParams("conv-1"));
    Assert.areEqual(JSON.stringify([started?.id]), JSON.stringify(tasks.map(t => t.id)));
    Assert.isNull(again);
    Assert.isNull(forgotten);
    Assert.areEqual("npm run dev", tasks[0]!.command);
    Assert.areEqual("msg-1", tasks[0]!.messageId);
    Assert.areEqual("codex", tasks[0]!.kind);
    Assert.areEqual(BackgroundTaskStatus.Running, tasks[0]!.status);
    Assert.areEqual(1, listener.count(EventName.BackgroundTaskUpdated));
    Assert.areEqual(tasks[0]!.id, BackgroundTask.fromJson(listener.events[0]!.payload).id);
  }

  @TestMethod
  public async leavesARunningTaskListedAsRunningWithItsOutputOnCloseWithNoDatabase(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("running", "npm run dev", () => Promise.resolve()));
    service.write("msg-1", "running", "serving\n");

    await service.closeAsync();

    const tasks = await service.listAsync(new ConversationIdParams("conv-1"));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Running, "serving\n"]), JSON.stringify([tasks[0]!.status, (await service.readAsync(new BackgroundTaskIdParams(tasks[0]!.id))).output]));
  }

  @TestMethod
  public async namesTheSubAgentATaskRuns(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();

    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("task-1", "Explore the code", () => Promise.resolve(), "toolu_1"));
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("task-2", "npm test", () => Promise.resolve(), " "));
    await service.endAsync("msg-1", new TaskEnd("task-1", BackgroundTaskStatus.Stopped));

    Assert.areEqual(JSON.stringify([null, "toolu_1"]), JSON.stringify((await service.listAsync(new ConversationIdParams("conv-1"))).map(t => t.subAgentId)));
    Assert.areEqual("toolu_1", BackgroundTask.fromJson(listener.events.at(-1)!.payload).subAgentId);
  }

  @TestMethod
  public async gathersOutputThenPublishesTheRestBeforeTheEnd(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create(20);
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));

    service.write("msg-1", "item-1", "one ");
    service.write("msg-1", "item-1", "two\n");
    await listener.next(EventName.BackgroundTaskOutput);
    service.write("msg-1", "item-1", "three\n");
    await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Failed, 1));

    const outputs = listener.events.filter(t => t.name === EventName.BackgroundTaskOutput).map(t => BackgroundTaskOutputPayload.fromJson(t.payload).text);
    Assert.areEqual(JSON.stringify(["one two\n", "three\n"]), JSON.stringify(outputs));
    Assert.areEqual(EventName.BackgroundTaskUpdated, listener.events.at(-1)!.name);
    const ended = BackgroundTask.fromJson(listener.events.at(-1)!.payload);
    Assert.areEqual(BackgroundTaskStatus.Failed, ended.status);
    Assert.areEqual(1, ended.exitCode);
    Assert.areEqual("one two\nthree\n", ended.output);
    Assert.isNotNull(ended.endedAt);
  }

  @TestMethod
  public async ignoresOutputAndEndsForUnknownOrEndedTasks(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("bash-1", "sleep 5", () => Promise.resolve()));
    await service.endAsync("msg-1", new TaskEnd("bash-1", BackgroundTaskStatus.Completed));

    service.write("msg-1", "bash-1", "late");
    service.write("msg-1", "bash-2", "unknown");
    service.write("msg-2", "bash-1", "other reply");
    await service.endAsync("msg-1", new TaskEnd("bash-1", BackgroundTaskStatus.Failed, 2));
    await service.endAsync("msg-2", new TaskEnd("bash-1", BackgroundTaskStatus.Failed, 2));
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("bash-3", "npm test", () => Promise.resolve()));
    service.write("msg-1", "bash-3", "live");
    await listener.next(EventName.BackgroundTaskOutput);

    const task = (await service.listAsync(new ConversationIdParams("conv-1"))).find(t => t.command === "sleep 5")!;
    Assert.areEqual(BackgroundTaskStatus.Completed, task.status);
    Assert.isNull(task.exitCode);
    Assert.areEqual(String.empty, task.output);
    Assert.areEqual(1, listener.count(EventName.BackgroundTaskOutput));
    Assert.areEqual(3, listener.count(EventName.BackgroundTaskUpdated));
  }

  @TestMethod
  public async listsRunningTasksFirstThenEndedOnesByTheirEndWithinOneMillisecond(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    for (const id of ["a", "b", "c", "d"])
      await service.startAsync("conv-1", "msg-1", "codex", new TaskStart(id, `run ${id}`, () => Promise.resolve()));
    await service.startAsync("conv-2", "msg-9", "codex", new TaskStart("x", "elsewhere", () => Promise.resolve()));
    await service.endAsync("msg-1", new TaskEnd("b", BackgroundTaskStatus.Completed, 0));
    await service.endAsync("msg-1", new TaskEnd("a", BackgroundTaskStatus.Stopped));

    const commands = (await service.listAsync(new ConversationIdParams("conv-1"))).map(t => t.command);

    Assert.areEqual(JSON.stringify(["run d", "run c", "run a", "run b"]), JSON.stringify(commands));
  }

  @TestMethod
  public async pagesFinishedCommandsAfterEveryRunningTaskAndLeavesFinishedSubAgentsOut(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    for (const id of ["a", "b", "c", "d", "e"])
      await service.startAsync("conv-1", "msg-1", "codex", new TaskStart(id, `run ${id}`, () => Promise.resolve()));
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("s", "Explore", () => Promise.resolve(), "toolu_1"));
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("t", "Review", () => Promise.resolve(), "toolu_2"));
    for (const id of ["b", "c", "d", "s"])
      await service.endAsync("msg-1", new TaskEnd(id, BackgroundTaskStatus.Completed, 0));
    const commandsOf = (page: BackgroundTaskPage): string => `${page.tasks.map(t => t.command).join(",")}:${page.hasLater}:${page.count}`;

    const first = await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 2));
    const second = await service.pageAsync(new BackgroundTaskListParams("conv-1", first.tasks.at(-1)!.id, 2));
    const all = await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 3));
    const gone = await service.pageAsync(new BackgroundTaskListParams("conv-1", "gone", 2));
    const running = await service.pageAsync(new BackgroundTaskListParams("conv-1", (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id, 2));

    Assert.areEqual("Review,run e,run a,run d,run c:true:3", commandsOf(first));
    Assert.areEqual("run b:false:3", commandsOf(second));
    Assert.areEqual("Review,run e,run a,run d,run c,run b:false:3", commandsOf(all));
    Assert.areEqual(":false:3", commandsOf(gone));
    Assert.areEqual(":false:3", commandsOf(running));
    Assert.areEqual(":false:0", commandsOf(await service.pageAsync(new BackgroundTaskListParams("conv-2", null, 2))));
  }

  @TestMethod
  public async pagesOnFromItsCursorWithoutARepeatOrASkipWhenTasksEndBetweenTwoPages(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    for (const id of ["a", "b", "c", "d", "e"])
      await service.startAsync("conv-1", "msg-1", "codex", new TaskStart(id, `run ${id}`, () => Promise.resolve()));
    for (const id of ["b", "c", "d", "e"])
      await service.endAsync("msg-1", new TaskEnd(id, BackgroundTaskStatus.Completed, 0));
    const commandsOf = (page: BackgroundTaskPage): string => `${page.tasks.map(t => t.command).join(",")}:${page.hasLater}:${page.count}`;

    const first = await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 2));
    await service.endAsync("msg-1", new TaskEnd("a", BackgroundTaskStatus.Stopped));
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("f", "run f", () => Promise.resolve()));
    await service.endAsync("msg-1", new TaskEnd("f", BackgroundTaskStatus.Completed, 0));
    const second = await service.pageAsync(new BackgroundTaskListParams("conv-1", first.tasks.at(-1)!.id, 2));
    const fresh = await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 2));

    Assert.areEqual("run a,run e,run d:true:4", commandsOf(first));
    Assert.areEqual("run c,run b:false:6", commandsOf(second));
    Assert.areEqual("run f,run a:true:6", commandsOf(fresh));
  }

  @TestMethod
  public async pagesAndClearsAChatWhoseTasksAreMoreThanOneFrameHoldsAndReadsACutCommandWhole(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    const frame = 16 * 1024 * 1024;
    const count = 1700;
    for (let index = 0; index < count; index++) {
      await service.startAsync("conv-1", "msg-1", "codex", new TaskStart(`item-${index}`, `${index} ${"x".repeat(10_000)}`, () => Promise.resolve()));
      await service.endAsync("msg-1", new TaskEnd(`item-${index}`, BackgroundTaskStatus.Completed, 0));
    }
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("running", "npm run dev", () => Promise.resolve()));

    let page = await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 500));
    const pages = [page];
    while (page.hasLater) {
      page = await service.pageAsync(new BackgroundTaskListParams("conv-1", page.tasks.at(-1)!.id, 500));
      pages.push(page);
    }

    const tasks = pages.flatMap(t => t.tasks);
    const finished = tasks.filter(t => !t.isRunning);
    Assert.isTrue(JSON.stringify((await service.listAsync(new ConversationIdParams("conv-1"))).map(t => t.toJson())).length > frame);
    Assert.isTrue(pages.every(t => JSON.stringify(t.toJson()).length < frame / 2));
    Assert.areEqual(`4:${count + 1}:${count}:${count}`, [pages.length, new Set(tasks.map(t => t.id)).size, finished.length, pages[0]!.count].join(":"));
    Assert.isTrue(finished.every(t => t.commandCut && t.command.length === Resources.maximumListedCommand && Object.isNull(t.output)));
    Assert.areEqual(`${count - 1} ${"x".repeat(10_000)}`, (await service.readAsync(new BackgroundTaskIdParams(finished[0]!.id))).command);

    const cleared = await service.clearFinishedAsync(new ConversationIdParams("conv-1"));

    Assert.areEqual(count, cleared.count);
    Assert.areEqual("npm run dev:false:0", [(await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 500))).tasks.map(t => t.command).join(","),
      (await service.pageAsync(new BackgroundTaskListParams("conv-1", finished[0]!.id, 500))).hasLater, (await service.pageAsync(new BackgroundTaskListParams("conv-1", null, 500))).count].join(":"));
  }

  @TestMethod
  public async stopsThroughTheProviderAndAnswersWithTheReportedEnd(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    let stops = 0;
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", () => {
      stops += 1;
      queueMicrotask(() => {
        void service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Stopped, 143));
      });
      return Promise.resolve();
    }));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const stopped = await service.stop(new BackgroundTaskIdParams(id));
    const again = await service.stop(new BackgroundTaskIdParams(id));

    Assert.areEqual(BackgroundTaskStatus.Stopped, stopped.status);
    Assert.areEqual(143, stopped.exitCode);
    Assert.areEqual(BackgroundTaskStatus.Stopped, again.status);
    Assert.areEqual(1, stops);
  }

  @TestMethod
  public async answersWithTheRunningTaskWhenTheProviderReportsNoEndInTime(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create(0, 20);
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", () => Promise.resolve()));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const answered = await service.stop(new BackgroundTaskIdParams(id));

    Assert.areEqual(BackgroundTaskStatus.Running, answered.status);
  }

  @TestMethod
  public async failsAStopTheProviderRefusesWithItsReason(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("bash-1", "sleep 60", () => Promise.reject(new Error("No task found with ID bash-1"))));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const exception = await Assert.throwsAsync(() => service.stop(new BackgroundTaskIdParams(id)), ServiceException);

    Assert.areEqual(ErrorCode.ProviderError, exception.info.name);
    Assert.areEqual("The task could not be stopped: No task found with ID bash-1", exception.info.message);
    Assert.areEqual(BackgroundTaskStatus.Running, (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.status);
  }

  @TestMethod
  public async failsAStopRefusedWithoutAnErrorWithWhatTheProviderGave(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "claude", new TaskStart("bash-1", "sleep 60", () => Promise.reject("busy")));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const exception = await Assert.throwsAsync(() => service.stop(new BackgroundTaskIdParams(id)), ServiceException);

    Assert.areEqual("The task could not be stopped: busy", exception.info.message);
  }

  @TestMethod
  public async failsAStopWhoseTaskEndsAndIsClearedWhileItWaits(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", async () => {
      await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));
      await service.clearFinishedAsync(new ConversationIdParams("conv-1"));
    }));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const exception = await Assert.throwsAsync(() => service.stop(new BackgroundTaskIdParams(id)), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, exception.info.name);
    Assert.areEqual(0, (await service.listAsync(new ConversationIdParams("conv-1"))).length);
  }

  @TestMethod
  public async answersWithTheTaskAsItWasWhenItsChatIsDeletedDuringTheStop(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", () => {
      service.forget(["conv-1"]);
      return Promise.resolve();
    }));
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    const answered = await service.stop(new BackgroundTaskIdParams(id));

    Assert.areEqual(id, answered.id);
    Assert.areEqual(BackgroundTaskStatus.Running, answered.status);
    Assert.areEqual(0, (await service.listAsync(new ConversationIdParams("conv-1"))).length);
  }

  @TestMethod
  public async failsAStopOfAnUnknownTask(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();

    const exception = await Assert.throwsAsync(() => service.stop(new BackgroundTaskIdParams("missing")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, exception.info.name);
  }

  @TestMethod
  public async clearsAChatsFinishedTasksKeepingItsRunningOnesAndOtherChats(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-2", "npm run lint", () => Promise.resolve()));
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-3", "npm run dev", () => Promise.resolve()));
    await service.startAsync("conv-2", "msg-2", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
    await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));
    await service.endAsync("msg-1", new TaskEnd("item-2", BackgroundTaskStatus.Failed, 1));
    await service.endAsync("msg-2", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));
    const finished = (await service.listAsync(new ConversationIdParams("conv-1"))).filter(t => !t.isRunning).map(t => t.id).sort();

    const cleared = await service.clearFinishedAsync(new ConversationIdParams("conv-1"));
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
    service.write("msg-1", "item-2", "late\n");
    const again = await service.clearFinishedAsync(new ConversationIdParams("conv-1"));

    Assert.areEqual("conv-1", cleared.conversationId);
    Assert.areEqual(finished.length, cleared.count);
    Assert.areEqual("npm run dev", (await service.listAsync(new ConversationIdParams("conv-1"))).map(t => t.command).join(","));
    Assert.areEqual(1, (await service.listAsync(new ConversationIdParams("conv-2"))).length);
    Assert.areEqual(0, again.count);
    const published = listener.events.filter(t => t.name === EventName.BackgroundTasksCleared).map(t => BackgroundTasksClearedPayload.fromJson(t.payload));
    Assert.areEqual(1, published.length);
    Assert.areEqual(JSON.stringify(cleared.toJson()), JSON.stringify(published[0]!.toJson()));
  }

  @TestMethod
  public async keepsATaskThatEndsInTheClearsMillisecondAfterTheClearsTimeInCoreAndInItsEvent(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();
    const now = Date.now;
    Date.now = () => Date.parse("2026-11-02T12:00:00.000Z");
    try {
      await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
      const late = await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-2", "npm run dev", () => Promise.resolve()));
      await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));

      const cleared = await service.clearFinishedAsync(new ConversationIdParams("conv-1"));
      await service.endAsync("msg-1", new TaskEnd("item-2", BackgroundTaskStatus.Completed, 0));

      const ended = BackgroundTask.fromJson(listener.events.filter(t => t.name === EventName.BackgroundTaskUpdated).at(-1)!.payload);
      Assert.areEqual(late?.id, ended.id);
      Assert.isTrue(ended.endedAt! > cleared.clearedAt);
      Assert.areEqual(JSON.stringify([[late?.id, "Completed"]]), JSON.stringify((await service.listAsync(new ConversationIdParams("conv-1"))).map(t => [t.id, t.status])));
    }
    finally {
      Date.now = now;
    }
  }

  @TestMethod
  public async keepsAClearedTaskForgottenWhenAnotherChatIsDeleted(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
    await service.startAsync("conv-2", "msg-2", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));
    await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));
    await service.clearFinishedAsync(new ConversationIdParams("conv-1"));

    service.forget(["conv-2"]);
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm test", () => Promise.resolve()));

    Assert.areEqual(0, (await service.listAsync(new ConversationIdParams("conv-1"))).length);
  }

  @TestMethod
  public async forgetsTheTasksOfDeletedConversations(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("item-1", "npm run dev", () => Promise.resolve()));
    await service.startAsync("conv-2", "msg-2", "codex", new TaskStart("item-1", "npm run dev", () => Promise.resolve()));

    service.forget(["conv-1"]);
    await service.endAsync("msg-1", new TaskEnd("item-1", BackgroundTaskStatus.Completed, 0));

    Assert.areEqual(0, (await service.listAsync(new ConversationIdParams("conv-1"))).length);
    Assert.areEqual(1, (await service.listAsync(new ConversationIdParams("conv-2"))).length);
    Assert.areEqual(2, listener.count(EventName.BackgroundTaskUpdated));
  }

  @TestMethod
  public async stopsADeletedChatsRunningTasksAndATaskItStartsAfterTheDelete(): Promise<void> {
    const { service, listener } = BackgroundTasksServiceTests.create();
    const stopped: string[] = [];
    const start = (messageId: string, id: string, conversationId: string = "conv-1"): Promise<BackgroundTask | null> =>
      service.startAsync(conversationId, messageId, "codex", new TaskStart(id, `run ${id}`, () => {
        stopped.push(id);
        return ["b", "late"].includes(id) ? Promise.reject(new Error("No such task.")) : Promise.resolve();
      }));
    await start("msg-1", "a");
    await start("msg-1", "b");
    await start("msg-1", "c");
    await start("msg-9", "x", "conv-2");
    await service.endAsync("msg-1", new TaskEnd("c", BackgroundTaskStatus.Completed, 0));

    service.forget(["conv-1"]);
    await start("msg-1", "late");
    await Promise.resolve();

    Assert.areEqual(JSON.stringify(["a", "b", "late"]), JSON.stringify(stopped));
    Assert.areEqual(0, (await service.listAsync(new ConversationIdParams("conv-1"))).length);
    Assert.areEqual(1, (await service.listAsync(new ConversationIdParams("conv-2"))).length);
    Assert.areEqual(5, listener.count(EventName.BackgroundTaskUpdated));
  }

  @TestMethod
  public async stopsATeammatesRunningTasksInOneChatOrEveryChatAndLeavesTheRest(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    const stopped: string[] = [];
    const start = (conversationId: string, id: string, teammateId: string | null): Promise<BackgroundTask | null> =>
      service.startAsync(conversationId, `msg-${id}`, "codex", new TaskStart(id, `run ${id}`, () => {
        stopped.push(id);
        return id === "refused" ? Promise.reject(new Error("No such task.")) : Promise.resolve();
      }), teammateId);
    await start("conv-1", "ada-1", "ada");
    await start("conv-1", "refused", "ada");
    await start("conv-1", "ended", "ada");
    await start("conv-1", "bob-1", "bob");
    await start("conv-1", "default", null);
    await start("conv-2", "ada-2", "ada");
    await start("conv-2", "bob-2", "bob");
    await service.endAsync("msg-ended", new TaskEnd("ended", BackgroundTaskStatus.Completed, 0));

    service.stopTeammate("ada", "conv-1");
    await Promise.resolve();
    const left = [...stopped];
    service.stopTeammate("bob", null);
    await Promise.resolve();

    Assert.areEqual(JSON.stringify(["ada-1", "refused"]), JSON.stringify(left));
    Assert.areEqual(JSON.stringify(["ada-1", "refused", "bob-1", "bob-2"]), JSON.stringify(stopped));
    Assert.areEqual(4, (await service.listAsync(new ConversationIdParams("conv-1"))).filter(t => t.isRunning).length);
  }

  @TestMethod
  public async logsATeammatesTaskStopTheProviderRefusesByTheTaskAndTheFailureWithoutItsCommand(): Promise<void> {
    const log = new RecordingLog();
    const service = new BackgroundTasksService(new EventHub(), 0, 1000, log);
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("t1", "deploy --secret-flag", () => Promise.reject(new TypeError("No such task."))), "ada");
    const task = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!;

    service.stopTeammate("ada", null);
    for (let tick = 0; tick < 10 && log.lines.length === 0; tick++)
      await Promise.resolve();

    Assert.areEqual(JSON.stringify([`The background task ${task.id} of a teammate who left could not be stopped: TypeError.`]), JSON.stringify(log.lines));
    Assert.isTrue((await service.listAsync(new ConversationIdParams("conv-1")))[0]!.isRunning);
  }

  @TestMethod
  public async letsAStopWhileATeammateStopRunsWaitOnItAndCallsTheProviderOnce(): Promise<void> {
    const { service } = BackgroundTasksServiceTests.create();
    const answered = Promise.withResolvers<void>();
    let calls = 0;
    await service.startAsync("conv-1", "msg-1", "codex", new TaskStart("t1", "run t1", () => {
      calls += 1;
      return answered.promise;
    }), "ada");
    const id = (await service.listAsync(new ConversationIdParams("conv-1")))[0]!.id;

    service.stopTeammate("ada", "conv-1");
    const stopping = service.stop(new BackgroundTaskIdParams(id));
    await service.endAsync("msg-1", new TaskEnd("t1", BackgroundTaskStatus.Stopped, 143));
    answered.resolve();
    const stopped = await stopping;

    Assert.areEqual(1, calls);
    Assert.areEqual(BackgroundTaskStatus.Stopped, stopped.status);
  }

  @TestMethod
  public async listsAChatsFinishedTasksAndOneTheCloseStoppedWithTheirStateExitCodeAndOutputAfterARestart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const built = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm run build");
    host.tasks.write("m1", "t1", "built\n");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const failed = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t2", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t2", BackgroundTaskStatus.Failed, 2));
    const stopped = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t3", "npm run lint");
    await host.tasks.endAsync("m1", new TaskEnd("t3", BackgroundTaskStatus.Stopped));
    const serving = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t4", "npm run dev");
    host.tasks.write("m1", "t4", "serving\n");
    await BackgroundTasksServiceTests.startAsync(host.tasks, other.id, "t5", "npm run e2e");

    await host.tasks.closeAsync();
    await host.tasks.endAsync("m1", new TaskEnd("t4", BackgroundTaskStatus.Completed, 0));
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
    const listed = await restarted.listAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(JSON.stringify([[serving.id, "Stopped", null, "serving\n"], [stopped.id, "Stopped", null, ""], [failed.id, "Failed", 2, ""],
      [built.id, "Completed", 0, "built\n"]]), JSON.stringify(await Promise.all(listed.map(async t => [t.id, t.status, t.exitCode, (await restarted.readAsync(new BackgroundTaskIdParams(t.id))).output]))));
    Assert.areEqual("npm run dev,npm run lint,npm test,npm run build", listed.map(t => t.command).join());
    Assert.isTrue(listed.every(t => !Object.isNull(t.endedAt) && t.endedAt >= t.startedAt));
    Assert.areEqual("npm run e2e Stopped", (await restarted.listAsync(new ConversationIdParams(other.id))).map(t => `${t.command} ${t.status}`).join());
  }

  @TestMethod
  public async readsATaskStillRunningWhenTeamRunEndedWithoutClosingAsStoppedWithNoDuration(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const running = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm run dev");
    host.tasks.write("m1", "t1", "serving\n");

    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
    const [listed] = await restarted.listAsync(new ConversationIdParams(chat.id));
    const stopped = await restarted.stop(new BackgroundTaskIdParams(running.id));

    Assert.isDefined(listed);
    Assert.areEqual(JSON.stringify([running.id, "Stopped", null, "", running.startedAt]), JSON.stringify([listed.id, listed.status, listed.exitCode, listed.output,
      listed.startedAt]));
    Assert.areEqual(listed.startedAt, listed.endedAt);
    Assert.areEqual(listed.status, stopped.status);
    Assert.areEqual(BackgroundTaskStatus.Running, (await host.tasks.listAsync(new ConversationIdParams(chat.id)))[0]?.status);
  }

  @TestMethod
  public async listsTheTasksAnEarlierRunSavedBehindTheOnesThisRunStartedBeforeTheChatIsListed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const earlier = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);

    const ended = await BackgroundTasksServiceTests.startAsync(restarted, chat.id, "t2", "npm run build");
    await restarted.endAsync("m1", new TaskEnd("t2", BackgroundTaskStatus.Failed, 1));
    const running = await BackgroundTasksServiceTests.startAsync(restarted, chat.id, "t3", "npm run dev");

    Assert.areEqual(JSON.stringify([`${running.id} Running`, `${ended.id} Failed`, `${earlier.id} Completed`]),
      JSON.stringify((await restarted.listAsync(new ConversationIdParams(chat.id))).map(t => `${t.id} ${t.status}`)));
  }

  @TestMethod
  public async keepsATaskThatEndsAfterAClearWhenTheClockWentBackSinceTheChatsSavedTasksEnded(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const now = Date.now;
    try {
      Date.now = () => Date.parse("2026-11-02T12:00:00.000Z");
      await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
      await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
      const earlierEnd = (await host.tasks.listAsync(new ConversationIdParams(chat.id)))[0]?.endedAt;
      Date.now = () => Date.parse("2026-11-02T11:00:00.000Z");
      const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
      const late = await BackgroundTasksServiceTests.startAsync(restarted, chat.id, "t2", "npm run dev");

      const cleared = await restarted.clearFinishedAsync(new ConversationIdParams(chat.id));
      await restarted.endAsync("m1", new TaskEnd("t2", BackgroundTaskStatus.Completed, 0));

      const ended = await restarted.listAsync(new ConversationIdParams(chat.id));
      Assert.areEqual(1, cleared.count);
      Assert.isTrue(cleared.clearedAt > (earlierEnd ?? cleared.clearedAt));
      Assert.areEqual(late.id, ended.map(t => t.id).join());
      Assert.isTrue((ended[0]?.endedAt ?? cleared.clearedAt) > cleared.clearedAt);
    }
    finally {
      Date.now = now;
    }
  }

  @TestMethod
  public async dropsClearedTasksFromTheStoreAndADeletedChatsTasksWithTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const cleared = await host.createConversationAsync();
    const deleted = await host.createConversationAsync();
    await BackgroundTasksServiceTests.startAsync(host.tasks, cleared.id, "t1", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const running = await BackgroundTasksServiceTests.startAsync(host.tasks, cleared.id, "t2", "npm run dev");
    await BackgroundTasksServiceTests.startAsync(host.tasks, deleted.id, "t3", "npm run build");
    await host.tasks.endAsync("m1", new TaskEnd("t3", BackgroundTaskStatus.Failed, 1));

    const payload = await host.tasks.clearFinishedAsync(new ConversationIdParams(cleared.id));
    const removed = await host.dispatcher.dispatch(new Request("r1", MethodName.ConversationDelete, new ConversationIdParams(deleted.id).toJson()));

    Assert.areEqual(1, payload.count);
    Assert.isFalse(removed.hasErrors);
    Assert.areEqual(running.id, (await new BackgroundTasksService(host.events, 0, 50, null, host.context).listAsync(new ConversationIdParams(cleared.id))).map(t => t.id).join());
    Assert.areEqual(0, await BackgroundTasksServiceTests.rowsAsync(host, deleted.id));
  }

  @TestMethod
  public async skipsAndLogsASavedTaskItCantReadOnceAndListsTheRest(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const kept = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    await host.context.database.connection.executeAsync(new SqlQuery("INSERT INTO backgroundTasks (id, chatId, json, output) VALUES ('bad', ?, '{}', '')", [chat.id]));

    const restarted = new BackgroundTasksService(host.events, 0, 50, host.log, host.context);
    const listed = await restarted.listAsync(new ConversationIdParams(chat.id));
    await restarted.listAsync(new ConversationIdParams(chat.id));
    const unlogged = await new BackgroundTasksService(host.events, 0, 50, null, host.context).listAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(kept.id, listed.map(t => t.id).join());
    Assert.areEqual(kept.id, unlogged.map(t => t.id).join());
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("The background task bad couldn't be read, so it isn't listed: ")).length);
  }

  @TestMethod
  public async listsReadsAndClearsAChatPastOneFramesWorthOfOutput(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const frame = 16 * 1024 * 1024;
    const output = "x".repeat(Resources.maximumBackgroundTaskOutput);
    const rows = Math.ceil(frame / output.length) + 1;
    const at = new Date().toISOString();
    await host.context.database.connection.runInTransactionAsync(async transaction => {
      for (let index = 0; index < rows; index++) {
        const task = new BackgroundTask(`t${index}`, chat.id, "m1", "fake", "npm test", BackgroundTaskStatus.Completed, 0, at, at, output);
        await transaction.executeAsync(new SqlQuery("INSERT INTO backgroundTasks (id, chatId, json, output) VALUES (?, ?, ?, ?)",
          [task.id, chat.id, JSON.stringify(task.withoutOutput().toJson()), output]));
      }
    });
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);

    const listed = await restarted.listAsync(new ConversationIdParams(chat.id));
    const read = await restarted.readAsync(new BackgroundTaskIdParams("t0"));
    const cleared = await restarted.clearFinishedAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(rows, listed.length);
    Assert.isTrue(rows * output.length > frame);
    Assert.isTrue(JSON.stringify(listed.map(t => t.toJson())).length < frame / 100);
    Assert.areEqual(output, read.output);
    Assert.areEqual(rows, cleared.count);
    Assert.areEqual(0, (await restarted.listAsync(new ConversationIdParams(chat.id))).length);
    Assert.areEqual(0, await BackgroundTasksServiceTests.rowsAsync(host, chat.id));
    await Assert.throwsAsync(() => restarted.readAsync(new BackgroundTaskIdParams("t0")), ServiceException);
  }

  @TestMethod
  public async clearsAChatWhoseClearedIdsAreMoreThanOneFrameHoldsInAnAnswerAndAnEventOfTheSameSmallSize(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const frame = 16 * 1024 * 1024;
    const suffix = "x".repeat(4096);
    const rows = Math.ceil(frame / suffix.length) + 1;
    const at = new Date().toISOString();
    await host.context.database.connection.runInTransactionAsync(async transaction => {
      for (let index = 0; index < rows; index++) {
        const task = new BackgroundTask(`t${index}-${suffix}`, chat.id, "m1", "fake", "npm test", BackgroundTaskStatus.Completed, 0, at, at, String.empty);
        await transaction.executeAsync(new SqlQuery("INSERT INTO backgroundTasks (id, chatId, json, output) VALUES (?, ?, ?, ?)",
          [task.id, chat.id, JSON.stringify(task.withoutOutput().toJson()), String.empty]));
      }
    });
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
    const ids = (await restarted.listAsync(new ConversationIdParams(chat.id))).map(t => t.id);

    const cleared = await restarted.clearFinishedAsync(new ConversationIdParams(chat.id));

    const published = host.listener.events.filter(t => t.name === EventName.BackgroundTasksCleared).map(t => JSON.stringify(t.payload));
    Assert.isTrue(JSON.stringify(ids).length > frame);
    Assert.areEqual(`${rows}:${chat.id}:true`, [cleared.count, cleared.chatId, cleared.clearedAt >= at].join(":"));
    Assert.isTrue(JSON.stringify(cleared.toJson()).length < 200);
    Assert.areEqual(JSON.stringify([cleared.toJson()]), `[${published.join()}]`);
    Assert.areEqual(0, (await restarted.listAsync(new ConversationIdParams(chat.id))).length);
    Assert.areEqual(0, await BackgroundTasksServiceTests.rowsAsync(host, chat.id));
  }

  @TestMethod
  public async keepsTheTasksInMemoryAndLogsWhenTheStoreThrowsAtStartEndCloseAndClear(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const service = new BackgroundTasksService(host.events, 0, 60000, host.log, host.context);
    await service.listAsync(new ConversationIdParams(chat.id));
    await host.context.database.connection.executeAsync(new SqlQuery("DROP TABLE backgroundTasks"));

    const stopped = await BackgroundTasksServiceTests.startAsync(service, chat.id, "t1", "npm test");
    const running = await BackgroundTasksServiceTests.startAsync(service, chat.id, "t2", "npm run dev");
    const stopping = service.stop(new BackgroundTaskIdParams(stopped.id));
    service.write("m1", "t1", "done\n");
    await service.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Stopped));
    const ended = await stopping;
    const read = await service.readAsync(new BackgroundTaskIdParams(stopped.id));
    const cleared = await service.clearFinishedAsync(new ConversationIdParams(chat.id));
    await service.closeAsync();
    const notSaved = host.log.lines.filter(t => t.includes("couldn't be saved"));

    Assert.areEqual(BackgroundTaskStatus.Stopped, ended.status);
    Assert.areEqual("done\n", read.output);
    Assert.areEqual(1, cleared.count);
    Assert.areEqual(`${running.id} Running`, (await service.listAsync(new ConversationIdParams(chat.id))).map(t => `${t.id} ${t.status}`).join());
    Assert.areEqual(JSON.stringify([stopped.id, running.id, stopped.id, running.id]), JSON.stringify(notSaved.map(t => /task (\S+) couldn't/.exec(t)?.[1])));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("A chat's cleared background tasks couldn't be deleted, so they return after a restart: ")).length);
  }

  @TestMethod
  public async keepsEveryRowOfAClearThatFailsPartway(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const service = new BackgroundTasksService(host.events, 0, 50, host.log, host.context);
    await BackgroundTasksServiceTests.startAsync(service, chat.id, "t1", "npm test");
    await service.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const last = await BackgroundTasksServiceTests.startAsync(service, chat.id, "t2", "npm run build");
    await service.endAsync("m1", new TaskEnd("t2", BackgroundTaskStatus.Completed, 0));
    await host.context.database.connection.executeAsync(new SqlQuery(
      `CREATE TRIGGER keepLast BEFORE DELETE ON backgroundTasks WHEN OLD.id = '${last.id}' BEGIN SELECT RAISE(ABORT, 'kept'); END`));

    const cleared = await service.clearFinishedAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(2, cleared.count);
    Assert.areEqual(2, await BackgroundTasksServiceTests.rowsAsync(host, chat.id));
    Assert.areEqual(1, host.log.lines.filter(t => t.startsWith("A chat's cleared background tasks couldn't be deleted")).length);
  }

  @TestMethod
  public async readsAChatsSavedTasksAgainAfterAReadThatFailed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const earlier = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);

    await host.context.database.connection.executeAsync(new SqlQuery("ALTER TABLE backgroundTasks RENAME TO backgroundTasksAway"));
    await Assert.throwsAsync(() => restarted.listAsync(new ConversationIdParams(chat.id)), Error);
    await host.context.database.connection.executeAsync(new SqlQuery("ALTER TABLE backgroundTasksAway RENAME TO backgroundTasks"));

    Assert.areEqual(earlier.id, (await restarted.listAsync(new ConversationIdParams(chat.id))).map(t => t.id).join());
  }

  @TestMethod
  public async leavesOutTheSavedTasksOfAChatForgottenWhileTheyAreRead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const earlier = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
    const entered = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    const holding = host.context.database.connection.runInTransactionAsync(async () => {
      entered.resolve();
      await held.promise;
    });
    await entered.promise;

    const listing = restarted.listAsync(new ConversationIdParams(chat.id));
    restarted.forget([chat.id]);
    held.resolve();
    await holding;
    const listed = await listing;

    Assert.areEqual(0, listed.length);
    await Assert.throwsAsync(() => restarted.readAsync(new BackgroundTaskIdParams(earlier.id)), ServiceException);
  }

  @TestMethod
  public async readsAnEarlierTasksOutputFromItsColumnOnlyWhenAsked(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const earlier = await BackgroundTasksServiceTests.startAsync(host.tasks, chat.id, "t1", "npm test");
    host.tasks.write("m1", "t1", "built\n");
    await host.tasks.endAsync("m1", new TaskEnd("t1", BackgroundTaskStatus.Completed, 0));
    const stored = (await host.context.database.connection.queryAsync(new SqlQuery("SELECT json FROM backgroundTasks WHERE id = ?", [earlier.id])))[0]?.readString("json");
    const restarted = new BackgroundTasksService(host.events, 0, 50, null, host.context);
    const params = new BackgroundTaskIdParams(earlier.id);

    await restarted.listAsync(new ConversationIdParams(chat.id));
    await host.context.database.connection.executeAsync(new SqlQuery("UPDATE backgroundTasks SET output = 'changed' WHERE id = ?", [earlier.id]));
    const changed = (await restarted.readAsync(params)).output;
    await host.context.database.connection.executeAsync(new SqlQuery("ALTER TABLE backgroundTasks RENAME TO backgroundTasksAway"));
    await Assert.throwsAsync(() => restarted.readAsync(params), Error);
    await host.context.database.connection.executeAsync(new SqlQuery("ALTER TABLE backgroundTasksAway RENAME TO backgroundTasks"));
    await host.context.database.connection.executeAsync(new SqlQuery("DELETE FROM backgroundTasks WHERE id = ?", [earlier.id]));
    const gone = (await restarted.readAsync(params)).output;
    await restarted.closeAsync();

    Assert.isFalse(stored?.includes("built") ?? true);
    Assert.areEqual("changed", changed);
    Assert.areEqual(String.empty, gone);
    Assert.isNull((await restarted.readAsync(params)).output);
  }

  private static create(outputInterval: number = 0, stopWait: number = 1000): { service: BackgroundTasksService; listener: RecordingEventListener } {
    const events = new EventHub();
    const listener = new RecordingEventListener();
    events.subscribe(listener);
    return { service: new BackgroundTasksService(events, outputInterval, stopWait), listener };
  }

  private static async startAsync(tasks: BackgroundTasksService, chatId: string, taskId: string, command: string): Promise<BackgroundTask> {
    const task = await tasks.startAsync(chatId, "m1", "fake", new TaskStart(taskId, command, () => Promise.resolve()));
    Assert.isNotNull(task);
    return task;
  }

  private static async rowsAsync(host: CoreHost, chatId: string): Promise<number> {
    return (await host.context.database.connection.queryAsync(new SqlQuery("SELECT id FROM backgroundTasks WHERE chatId = ?", [chatId]))).length;
  }
}
