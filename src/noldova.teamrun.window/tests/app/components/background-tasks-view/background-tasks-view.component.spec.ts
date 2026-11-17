/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  BackgroundTaskOutputPayload,
  BackgroundTasksClearedPayload,
  BackgroundTaskStatus,
  ConversationIdParams,
  EventName,
  MethodName
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { BackgroundTasksViewComponent } from "../../../../src/app/components/background-tasks-view/background-tasks-view.component";
import { BackgroundTaskStoreService } from "../../../../src/app/services/background-task-store.service";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("BackgroundTasksViewComponent", () => {
  const now = Date.parse(SampleData.timestamp);
  const at = (seconds: number): string => new Date(now + seconds * 1000).toISOString();
  const task = (id: string, command: string, status: BackgroundTaskStatus, exitCode: number | null, started: number, ended: number | null, output: string | null = ""): BackgroundTask =>
    new BackgroundTask(id, SampleData.conversation.id, "r1", "codex", command, status, exitCode, at(started), Object.isNull(ended) ? null : at(ended), output);
  const cleared = (seconds: number = 0, count: number = 2): BackgroundTasksClearedPayload =>
    new BackgroundTasksClearedPayload(SampleData.conversation.id, at(seconds), count);

  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<BackgroundTasksViewComponent>;
  let tasks: BackgroundTask[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string, within: ParentNode = element()): string[] => [...within.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const group = (index: number): HTMLElement => element().querySelectorAll<HTMLElement>(".tasks-group")[index] as HTMLElement;
  const running = (): HTMLElement => group(1);
  const finished = (): HTMLElement => group(0);
  const titles = (within: ParentNode): string[] => texts(".nol-tool-call-title", within);
  const row = (command: string): HTMLElement =>
    [...element().querySelectorAll<HTMLElement>(".task")].find(t => t.querySelector(".nol-tool-call-title")?.textContent?.trim() === command) as HTMLElement;
  const cancel = (command: string): HTMLButtonElement => row(command).querySelector(".nol-tool-call-cancel") as HTMLButtonElement;
  const toggle = (): HTMLButtonElement => element().querySelector(".tasks-toggle") as HTMLButtonElement;
  const clear = (): HTMLButtonElement => element().querySelector(".tasks-clear") as HTMLButtonElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (read: (parameters: JsonValue) => JsonValue = () => null,
    list: (parameters: JsonValue) => JsonValue | Promise<JsonValue> = () => SampleData.tasks(tasks)): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.BackgroundTaskList, list).answer(MethodName.BackgroundTaskRead, read);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(BackgroundTasksViewComponent);
    const store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.conversationInView(SampleData.conversation.id);
    await settle();
  };

  const fromEnd = (host: HTMLElement): number => host.scrollHeight - host.clientHeight - host.scrollTop;
  const createScrollingAsync = async (list?: (parameters: JsonValue) => JsonValue): Promise<HTMLElement> => {
    tasks = Array.from({ length: 30 }, (_, i) => task(`t${i}`, `make ${i}`, BackgroundTaskStatus.Running, null, -100 + i, null));
    await create(undefined, list);
    const host = element();
    host.style.width = "16rem";
    host.style.height = "12rem";
    await settle();
    return host;
  };
  const startAsync = async (id: string, command: string, seconds: number): Promise<void> => {
    context.emit(EventName.BackgroundTaskUpdated, task(id, command, BackgroundTaskStatus.Running, null, seconds, null).toJson());
    await Wait.until(() => expect(titles(running()).at(-1)).toBe(command));
    await settle();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    tasks = [
      task("t1", "npm run dev", BackgroundTaskStatus.Running, null, -65, null, "listening on 3000\n"),
      task("t3", "make", BackgroundTaskStatus.Completed, 0, -120, -100, "built\n"),
      task("t2", "npm test -- --watch", BackgroundTaskStatus.Running, null, -5, null),
      task("t4", "false", BackgroundTaskStatus.Failed, 1, -30, -10, "boom\n")
    ];
  });

  afterEach(() => {
    ChatStoreService.release(context);
    BackgroundTaskStoreService.release(context);
    vi.useRealTimers();
  });

  it("groups the open chat's tasks under Finished, first ended first, and Running below it, oldest first, each a tool call with its command, status and time", async () => {
    await create();

    await Wait.until(() => expect(titles(running())).toEqual(["npm run dev", "npm test -- --watch"]));
    expect(titles(finished())).toEqual(["make", "false"]);
    expect([...element().querySelectorAll("[role='heading']")].map(t => [t.textContent?.replace(/\s+/g, ""), t.getAttribute("aria-level")]))
      .toEqual([[`${Resources.expandedIcon}Finished2`, "3"], ["Running2", "3"]]);
    expect([running(), finished()].map(t => t.getAttribute("aria-labelledby")).map(t => element().querySelector(`#${t}`)?.textContent?.replace(/\s+/g, "")))
      .toEqual(["Running2", `${Resources.expandedIcon}Finished2`]);
    expect(texts(".nol-tool-call-status")).toEqual(["Done", "Failed", "Running", "Running"]);
    expect(texts(".nol-tool-call-duration")).toEqual(["20 sec", "20 sec", "1 min 5 sec", "5.0 sec"]);
    expect([...element().querySelectorAll(".nol-tool-call-cancel")].map(t => t.getAttribute("aria-label"))).toEqual(["Cancel npm run dev", "Cancel npm test -- --watch"]);
    expect(texts(".nol-tool-call-error > span:last-child")).toEqual([Resources.formatExitCode(1)]);
    expect(texts(".nol-tool-call-output")).toEqual(["boom"]);
    expect(BackgroundTaskListParams.fromJson(context.parametersOf(MethodName.BackgroundTaskList)!).toJson())
      .toEqual(new BackgroundTaskListParams(SampleData.conversation.id, null, Resources.backgroundTaskPageSize).toJson());
  });

  it("opens a failed task with no output to its exit code, with a toggle that closes it", async () => {
    tasks.push(task("t6", "exit 2", BackgroundTaskStatus.Failed, 2, -50, -40));
    await create();
    await Wait.until(() => expect(titles(finished())).toContain("exit 2"));
    const toggle = (): HTMLElement => row("exit 2").querySelector<HTMLElement>(".nol-tool-call-toggle") as HTMLElement;
    const body = (): HTMLElement => row("exit 2").querySelector<HTMLElement>(".nol-tool-call-body") as HTMLElement;

    expect(toggle().localName).toBe("button");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(body().hidden).toBe(false);
    expect(texts(".nol-tool-call-error > span:last-child", row("exit 2"))).toEqual([Resources.formatExitCode(2)]);
    toggle().click();
    await settle();

    await Wait.until(() => expect(toggle().getAttribute("aria-expanded")).toBe("false"));
    expect(body().hidden).toBe(true);
  });

  it("draws a finished task with no output and exit 0 as its title alone, with no twistie and no toggle, and keeps the twistie of one with output", async () => {
    tasks.push(task("t5", "true", BackgroundTaskStatus.Completed, 0, -50, -40));
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["make", "true", "false"]));
    const cards = ["true", "make"].map(t => row(t).querySelector<HTMLElement>("nol-tool-call") as HTMLElement);

    expect(cards.map(t => t.classList.contains("nol-tool-call-static"))).toEqual([true, false]);
    expect(cards.map(t => getComputedStyle(t.querySelector(".nol-tool-call-twistie") as Element).visibility)).toEqual(["hidden", "visible"]);
    expect(cards.map(t => t.querySelector(".nol-tool-call-toggle")?.localName)).toEqual(["span", "button"]);
  });

  it("reads a task's output when it's first opened, Loading while it waits, and follows it from there", async () => {
    const full = task("t5", "tail -f log", BackgroundTaskStatus.Running, null, -20, null, "first\n");
    tasks = [full.withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(running())).toEqual(["tail -f log"]));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskRead, () => answer.promise);
    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(SampleData.conversation.id, "t5", "early\n").toJson());
    expect(context.parametersOf(MethodName.BackgroundTaskRead)).toBeUndefined();

    (row("tail -f log").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    expect(texts(".nol-tool-call-loading", row("tail -f log"))).toHaveLength(1);
    answer.resolve(full.withOutput("early\n").toJson());
    await settle();
    expect(BackgroundTaskIdParams.fromJson(context.parametersOf(MethodName.BackgroundTaskRead)!).taskId).toBe("t5");
    expect(texts(".nol-tool-call-loading", row("tail -f log"))).toEqual([]);

    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(SampleData.conversation.id, "t5", "late\n").toJson());
    await settle();
    expect(row("tail -f log").querySelector(".nol-tool-call-output")?.textContent).toBe("first\nearly\nlate");
  });

  it("reads the output of a failed task that shows open, with no request for one that says it has none", async () => {
    tasks = [task("t6", "exit 2", BackgroundTaskStatus.Failed, 2, -50, -40, null), task("t7", "true", BackgroundTaskStatus.Completed, 0, -60, -55)];
    const reads: string[] = [];
    await create(t => {
      reads.push(BackgroundTaskIdParams.fromJson(t).taskId);
      return task("t6", "exit 2", BackgroundTaskStatus.Failed, 2, -50, -40, "boom\n").toJson();
    });

    await Wait.until(() => expect(texts(".nol-tool-call-output", row("exit 2"))).toEqual(["boom"]));
    expect(reads).toEqual(["t6"]);
    expect(row("true").querySelector(".nol-tool-call-toggle")?.localName).toBe("span");
  });

  it("says an output couldn't load with Retry, which reads it again", async () => {
    const full = task("t5", "make", BackgroundTaskStatus.Completed, 0, -30, -20, "built\n");
    tasks = [full.withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["make"]));
    context.fail(MethodName.BackgroundTaskRead, "The runtime is busy.");

    (row("make").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    expect(texts(".nol-tool-call-load-failed", row("make"))).toHaveLength(1);

    context.answer(MethodName.BackgroundTaskRead, () => full.toJson());
    (row("make").querySelector(".nol-tool-call-load-failed button") as HTMLButtonElement).click();
    await settle();
    expect(texts(".nol-tool-call-load-failed", row("make"))).toEqual([]);
    expect(texts(".nol-tool-call-output", row("make"))).toEqual(["built"]);
  });

  it("forgets an output's failure once its task is cleared", async () => {
    tasks = [task("t5", "make", BackgroundTaskStatus.Completed, 0, -30, -20, "built\n").withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["make"]));
    context.fail(MethodName.BackgroundTaskRead, "The runtime is busy.");
    (row("make").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    const store = BackgroundTaskStoreService.of(context);
    expect([...store.outputFailed()]).toEqual(["t5"]);

    context.emit(EventName.BackgroundTasksCleared, cleared(0, 1).toJson());
    await settle();

    expect([...store.outputFailed()]).toEqual([]);
  });

  it("keeps an ended task's output when the list is read again, and reads a running one's again", async () => {
    const ended = task("t5", "make", BackgroundTaskStatus.Completed, 0, -30, -20, "built\n");
    const live = task("t6", "tail -f log", BackgroundTaskStatus.Running, null, -10, null, "first\n");
    tasks = [ended.withoutOutput(), live.withoutOutput()];
    await create(t => (BackgroundTaskIdParams.fromJson(t).taskId === "t5" ? ended : live).toJson());
    await Wait.until(() => expect(titles(finished())).toEqual(["make"]));
    for (const command of ["make", "tail -f log"])
      (row(command).querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    expect(texts(".nol-tool-call-output", row("make"))).toEqual(["built"]);
    const reads: string[] = [];
    context.answer(MethodName.BackgroundTaskRead, t => {
      reads.push(BackgroundTaskIdParams.fromJson(t).taskId);
      return live.withOutput("second\n").toJson();
    });

    context.emit(EventName.StateInvalidated, null);
    await settle();

    expect(reads).toEqual(["t6"]);
    expect(texts(".nol-tool-call-output", row("make"))).toEqual(["built"]);
    expect(row("tail -f log").querySelector(".nol-tool-call-output")?.textContent).toBe("first\nsecond");
  });

  it("keeps a task's end that arrives before a read's answer", async () => {
    const full = task("t5", "tail -f log", BackgroundTaskStatus.Running, null, -20, null, "first\n");
    tasks = [full.withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(running())).toEqual(["tail -f log"]));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskRead, () => answer.promise);
    (row("tail -f log").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();

    context.emit(EventName.BackgroundTaskUpdated, full.withOutput("last\n").withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());
    answer.resolve(full.toJson());
    await settle();

    expect(texts(".nol-tool-call-status", row("tail -f log"))).toEqual(["Done"]);
    expect(row("tail -f log").querySelector(".nol-tool-call-output")?.textContent).toBe("first\nlast");
    expect([...BackgroundTaskStoreService.of(context).outputLoading()]).toEqual([]);
  });

  it("reads again when output arrives before a read's answer, so none of it is lost or doubled", async () => {
    const full = task("t5", "tail -f log", BackgroundTaskStatus.Running, null, -20, null, "first\n");
    tasks = [full.withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(running())).toEqual(["tail -f log"]));
    const answers = [new DeferredResponse(), new DeferredResponse()];
    let reads = 0;
    context.answer(MethodName.BackgroundTaskRead, () => answers[reads++]!.promise);
    (row("tail -f log").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();

    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(SampleData.conversation.id, "t5", "second\n").toJson());
    answers[0]!.resolve(full.toJson());
    await settle();
    expect(reads).toBe(2);
    expect(texts(".nol-tool-call-loading", row("tail -f log"))).toHaveLength(1);

    answers[1]!.resolve(full.withOutput("second\n").toJson());
    await settle();
    expect(row("tail -f log").querySelector(".nol-tool-call-output")?.textContent).toBe("first\nsecond");
  });

  it("drops an output's answer and failure for a task cleared while they waited", async () => {
    const full = task("t5", "make", BackgroundTaskStatus.Completed, 0, -30, -20, "built\n");
    const other = task("t6", "lint", BackgroundTaskStatus.Completed, 0, -40, -35, "clean\n");
    tasks = [full.withoutOutput(), other.withoutOutput()];
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["lint", "make"]));
    const answer = new DeferredResponse();
    const refused = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskRead, t => BackgroundTaskIdParams.fromJson(t).taskId === "t5"
      ? answer.promise
      : refused.promise.then(() => Promise.reject(new Error("Background task t6 was not found."))));

    (row("make").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    (row("lint").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    context.emit(EventName.BackgroundTasksCleared, cleared().toJson());
    answer.resolve(full.toJson());
    refused.resolve(null);
    await settle();

    const store = BackgroundTaskStoreService.of(context);
    expect(store.tasksOf(SampleData.conversation.id)).toEqual([]);
    expect([[...store.outputLoading()], [...store.outputFailed()]]).toEqual([[], []]);
  });

  it("shows no time for a task that reads as stopped at its own start, as after a crash", async () => {
    tasks = [task("t5", "npm run dev", BackgroundTaskStatus.Stopped, null, -30, -30), task("t6", "make", BackgroundTaskStatus.Stopped, null, -30, -29)];
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["npm run dev", "make"]));

    expect(texts(".nol-tool-call-duration", row("npm run dev"))).toEqual([]);
    expect(texts(".nol-tool-call-duration", row("make"))).toEqual(["1.0 sec"]);
  });

  it("opens a task's output and keeps it open as the list changes", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toEqual(["make", "false"]));

    (row("make").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();
    expect(texts(".nol-tool-call-output", row("make"))).toEqual(["built"]);

    context.emit(EventName.BackgroundTaskUpdated, tasks[2]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());
    await settle();
    expect(titles(finished())).toEqual(["make", "false", "npm test -- --watch"]);
    expect(texts(".nol-tool-call-output", row("make"))).toEqual(["built"]);
  });

  it("folds Finished from its header by pointer and by keyboard, keeping it folded as tasks end, with its count and Clear, and reaches Clear and the rows by Tab", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(2));
    const list = finished().querySelector(".tasks-list") as HTMLElement;
    expect(toggle().getAttribute("aria-controls")).toBe(list.id);

    toggle().click();
    await settle();
    expect([toggle().getAttribute("aria-expanded"), list.hidden, titles(finished()), texts(".tasks-count", finished())]).toEqual(["false", true, [], ["2"]]);
    context.emit(EventName.BackgroundTaskUpdated, tasks[0]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());
    await settle();
    expect([toggle().getAttribute("aria-expanded"), titles(finished()), texts(".tasks-count", finished())]).toEqual(["false", [], ["3"]]);
    expect(texts(".tasks-twistie")).toEqual([Resources.collapsedIcon]);
    expect(clear().disabled).toBe(false);

    toggle().focus();
    await userEvent.keyboard("{Enter}");
    await settle();
    expect([toggle().getAttribute("aria-expanded"), list.hidden, titles(finished())]).toEqual(["true", false, ["make", "false", "npm run dev"]]);
    await userEvent.keyboard(" ");
    await settle();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard(" ");
    await settle();

    await userEvent.tab();
    expect(document.activeElement).toBe(clear());
    await userEvent.tab();
    expect(document.activeElement).toBe(row("make").querySelector(".nol-tool-call-toggle"));
  });

  it("shows a cut command in full in its tooltip, and names Clear in its own", async () => {
    const command = `npm run build -- --project ${"a".repeat(80)}`;
    tasks.push(task("t9", command, BackgroundTaskStatus.Completed, 0, -60, -40));
    await create();
    element().style.width = "16rem";
    await settle();
    const tooltipOf = async (target: Element): Promise<string | null> => {
      await userEvent.hover(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      await userEvent.unhover(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(await tooltipOf(row(command).querySelector(".nol-tool-call-toggle") as Element)).toBe(command);
    expect(await tooltipOf(clear())).toBe(Resources.clearFinishedTasksLabel);
  });

  it("shows the last ten finished tasks and the rest after Show more above them, which takes the focus to the newest it shows and lasts through updates, and shows ten again in another chat", async () => {
    tasks = Array.from({ length: 12 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i));
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(Resources.finishedTasksShown));
    expect([titles(finished())[0], titles(finished()).at(-1)]).toEqual(["job 2", "job 11"]);

    const more = finished().querySelector(".tasks-more") as HTMLButtonElement;
    expect([more.textContent?.trim(), finished().querySelector(".tasks-list")?.firstElementChild]).toEqual([Resources.showMoreTasksLabel, more]);
    more.focus();
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(titles(finished())).toHaveLength(12);
    expect(finished().querySelector(".tasks-more")).toBeNull();
    expect(document.activeElement).toBe(row("job 1").querySelector(".nol-tool-call-toggle"));
    context.emit(EventName.BackgroundTaskUpdated, task("f12", "job 12", BackgroundTaskStatus.Completed, 0, -100, 0).toJson());
    await settle();
    expect(titles(finished())).toHaveLength(13);

    const store = ChatStoreService.of(context);
    store.conversationOutOfView(SampleData.conversation.id);
    await settle();
    await store.conversationInView(SampleData.conversation.id);
    await settle();
    expect(titles(finished())).toHaveLength(Resources.finishedTasksShown);
  });

  it("counts the finished tasks past the first page and asks for the next page once Show more has shown the rest, listing a repeated task once", async () => {
    const older = Array.from({ length: 3 }, (_, i) => task(`o${i}`, `old ${i}`, BackgroundTaskStatus.Completed, 0, -200, -150 - i));
    tasks = Array.from({ length: 12 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i)).reverse();
    const asked: BackgroundTaskListParams[] = [];
    await create(undefined, t => {
      asked.push(BackgroundTaskListParams.fromJson(t));
      return Object.isNull(asked.at(-1)!.afterTaskId) ? SampleData.tasks(tasks, true, 15) : SampleData.tasks([tasks.at(-1)!, ...older], false, 15);
    });
    const more = (): HTMLButtonElement | null => finished().querySelector<HTMLButtonElement>(".tasks-more");
    await Wait.until(() => expect(titles(finished())).toHaveLength(Resources.finishedTasksShown));
    expect(texts(".tasks-count")).toEqual(["15", "0"]);

    more()!.click();
    await settle();
    expect([titles(finished()).length, context.count(MethodName.BackgroundTaskList)]).toEqual([12, 1]);
    more()!.focus();
    await userEvent.keyboard("{Enter}");
    await settle();

    await Wait.until(() => expect(titles(finished())).toHaveLength(15));
    expect(titles(finished()).slice(0, 4)).toEqual(["old 2", "old 1", "old 0", "job 0"]);
    expect(asked.map(t => t.toJson())).toEqual([null, "f0"].map(t => new BackgroundTaskListParams(SampleData.conversation.id, t, Resources.backgroundTaskPageSize).toJson()));
    expect([more(), texts(".tasks-count")]).toEqual([null, ["15", "0"]]);
    expect(document.activeElement).toBe(row("old 0").querySelector(".nol-tool-call-toggle"));
  });

  it("keeps Show more off while a page loads, shows why a page failed, and drops a page that answers after a reload or the chat's delete", async () => {
    tasks = Array.from({ length: 10 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i)).reverse();
    let next: () => Promise<JsonValue> = () => Promise.reject(new Error("The runtime is busy."));
    await create(undefined, t => Object.isNull(BackgroundTaskListParams.fromJson(t).afterTaskId) ? SampleData.tasks(tasks, true, 11) : next());
    const store = BackgroundTaskStoreService.of(context);
    const more = (): HTMLButtonElement => finished().querySelector<HTMLButtonElement>(".tasks-more")!;
    await Wait.until(() => expect(titles(finished())).toHaveLength(10));

    more().click();
    await settle();
    expect([texts(".tasks-error"), titles(finished()).length, more().disabled]).toEqual([["The runtime is busy."], 10, false]);
    next = () => Promise.reject("The runtime is still busy.");
    more().click();
    await settle();
    expect([texts(".tasks-error"), titles(finished()).length, more().disabled]).toEqual([["The runtime is still busy."], 10, false]);

    const stale: { reject: (error: Error) => void } = { reject: () => undefined };
    next = () => new Promise((_, reject) => { stale.reject = reject; });
    more().click();
    await settle();
    await store.loadMore(SampleData.conversation.id);
    expect([texts(".tasks-error"), more().disabled, context.count(MethodName.BackgroundTaskList)]).toEqual([[], true, 4]);
    context.emit(EventName.StateInvalidated, null);
    await settle();
    stale.reject(new Error("The runtime stopped."));
    await settle();
    expect([texts(".tasks-error"), titles(finished()).length, more().disabled]).toEqual([[], 10, false]);

    const late = new DeferredResponse();
    next = () => late.promise;
    more().click();
    await settle();
    context.emit(EventName.ConversationDeleted, new ConversationIdParams(SampleData.conversation.id).toJson());
    late.resolve(SampleData.tasks([task("o0", "old 0", BackgroundTaskStatus.Completed, 0, -200, -150)]));
    await settle();
    expect([store.tasksOf(SampleData.conversation.id), store.unlistedOf(SampleData.conversation.id), store.loadErrorOf(SampleData.conversation.id)]).toEqual([[], 0, null]);
    const asked = context.count(MethodName.BackgroundTaskList);
    await store.loadMore(SampleData.conversation.id);
    expect(context.count(MethodName.BackgroundTaskList)).toBe(asked);
  });

  it("counts a task that ends between two pages once, and lists each finished task once after the next page", async () => {
    const running = task("r1", "npm run dev", BackgroundTaskStatus.Running, null, -60, null);
    const older = Array.from({ length: 2 }, (_, i) => task(`o${i}`, `old ${i}`, BackgroundTaskStatus.Completed, 0, -200, -150 - i));
    tasks = [running, ...Array.from({ length: 10 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i)).reverse()];
    await create(undefined, t => Object.isNull(BackgroundTaskListParams.fromJson(t).afterTaskId) ? SampleData.tasks(tasks, true, 12) : SampleData.tasks(older, false, 13));
    const more = (): HTMLButtonElement | null => finished().querySelector<HTMLButtonElement>(".tasks-more");
    await Wait.until(() => expect(texts(".tasks-count")).toEqual(["12", "1"]));

    context.emit(EventName.BackgroundTaskUpdated, running.withEnd(BackgroundTaskStatus.Stopped, null, at(0)).toJson());
    await settle();
    expect(texts(".tasks-count")).toEqual(["13", "0"]);
    more()!.click();
    await settle();
    more()!.click();
    await settle();

    await Wait.until(() => expect(titles(finished())).toHaveLength(13));
    expect(new Set(titles(finished())).size).toBe(13);
    expect([titles(finished()).at(-1), titles(finished()).slice(0, 2), more(), texts(".tasks-count")]).toEqual(["npm run dev", ["old 1", "old 0"], null, ["13", "0"]]);
  });

  it("retries a failed later page from its cursor and keeps the tasks it shows", async () => {
    tasks = Array.from({ length: 10 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i)).reverse();
    const asked: (string | null)[] = [];
    await create(undefined, t => {
      asked.push(BackgroundTaskListParams.fromJson(t).afterTaskId);
      if (Object.isNull(asked.at(-1)))
        return SampleData.tasks(tasks, true, 11);
      return asked.length > 2 ? SampleData.tasks([task("o0", "old 0", BackgroundTaskStatus.Completed, 0, -200, -150)], false, 11) : Promise.reject(new Error("The runtime is busy."));
    });
    await Wait.until(() => expect(titles(finished())).toHaveLength(10));

    finished().querySelector<HTMLButtonElement>(".tasks-more")!.click();
    await settle();
    expect([texts(".tasks-error"), titles(finished()).length]).toEqual([["The runtime is busy."], 10]);
    (element().querySelector(".tasks-failure button") as HTMLButtonElement).click();
    await settle();

    await Wait.until(() => expect(titles(finished())).toHaveLength(11));
    expect([asked, texts(".tasks-error"), titles(finished()).slice(0, 2)]).toEqual([[null, "f0", "f0"], [], ["old 0", "job 0"]]);
  });

  it("counts nothing past the page once the chat's finished tasks are cleared, with Clear off and no Show more", async () => {
    const ended = Array.from({ length: 10 }, (_, i) => task(`f${i}`, `job ${i}`, BackgroundTaskStatus.Completed, 0, -100, -50 + i));
    tasks = [task("t1", "npm run dev", BackgroundTaskStatus.Running, null, -65, null), ...ended];
    await create(undefined, () => SampleData.tasks(tasks, true, 15));
    await Wait.until(() => expect(texts(".tasks-count")).toEqual(["15", "1"]));
    expect(finished().querySelector(".tasks-more")).not.toBeNull();

    context.emit(EventName.BackgroundTasksCleared, cleared(0, ended.length).toJson());
    await settle();
    await BackgroundTaskStoreService.of(context).loadMore(SampleData.conversation.id);

    expect([texts(".tasks-count"), clear().disabled, finished().querySelector(".tasks-more"), context.count(MethodName.BackgroundTaskList)]).toEqual([["0", "1"], true, null, 1]);
  });

  it("ends a command the list cut with an ellipsis and shows it whole once its row opens", async () => {
    const whole = task("t7", "npm run build -- --project abc", BackgroundTaskStatus.Completed, 0, -60, -40, "built\n");
    tasks = [new BackgroundTask(whole.id, whole.chatId, whole.messageId, whole.kind, "npm run build -- --project a", whole.status, whole.exitCode, whole.startedAt,
      whole.endedAt, null, null, true)];
    await create(() => whole.toJson());
    await Wait.until(() => expect(titles(finished())).toEqual([`npm run build -- --project a${Resources.ellipsis}`]));

    (row(`npm run build -- --project a${Resources.ellipsis}`).querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();

    await Wait.until(() => expect(titles(finished())).toEqual(["npm run build -- --project abc"]));
    expect(row("npm run build -- --project abc").querySelector(".nol-tool-call-output")?.textContent).toBe("built");
    expect(BackgroundTaskIdParams.fromJson(context.parametersOf(MethodName.BackgroundTaskRead)!).taskId).toBe("t7");
  });

  it("clears the chat's finished tasks through the runtime, Clear off while it runs and once nothing has finished, with the focus on Finished's toggle", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(2));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskClearFinished, () => answer.promise);
    expect([clear().getAttribute("aria-label"), clear().disabled]).toEqual([Resources.clearFinishedTasksLabel, false]);

    clear().focus();
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(clear().disabled).toBe(true);
    expect(ConversationIdParams.fromJson(context.parametersOf(MethodName.BackgroundTaskClearFinished)!).conversationId).toBe(SampleData.conversation.id);
    answer.resolve(cleared().toJson());
    await settle();

    expect([titles(running()), titles(finished()), texts(".tasks-count")]).toEqual([["npm run dev", "npm test -- --watch"], [], ["0", "2"]]);
    expect(clear().disabled).toBe(true);
    expect(document.activeElement).toBe(toggle());
    context.emit(EventName.BackgroundTaskUpdated, tasks[0]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());
    await settle();
    expect(clear().disabled).toBe(false);
  });

  it("shows why a clear failed under the header with Clear still on and focused, and drops it on the next try, leaving the focus alone when Clear didn't have it", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(2));
    context.fail(MethodName.BackgroundTaskClearFinished, "The runtime is busy.");

    clear().focus();
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(document.activeElement).toBe(clear());
    expect([texts(".tasks-clear-error"), finished().querySelector(".tasks-clear-error")?.getAttribute("role"), clear().disabled, titles(finished())])
      .toEqual([["The runtime is busy."], "alert", false, ["make", "false"]]);

    context.answer(MethodName.BackgroundTaskClearFinished, () => Promise.reject("The runtime stopped."));
    clear().click();
    await settle();
    expect(texts(".tasks-clear-error")).toEqual(["The runtime stopped."]);

    context.answer(MethodName.BackgroundTaskClearFinished, () => cleared().toJson());
    clear().blur();
    clear().click();
    await settle();
    expect([texts(".tasks-clear-error"), titles(finished())]).toEqual([[], []]);
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps a task that ended a millisecond after the clear's time though its end came before the clear's answer", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(2));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskClearFinished, () => answer.promise);

    clear().click();
    await settle();
    context.emit(EventName.BackgroundTaskUpdated, tasks[0]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0.001)).toJson());
    answer.resolve(cleared().toJson());
    await settle();

    expect([titles(running()), titles(finished()), texts(".tasks-count")]).toEqual([["npm test -- --watch"], ["npm run dev"], ["1", "1"]]);
  });

  it("drops the tasks another window cleared, with a stop's refusal, and ignores another chat's clear", async () => {
    await create();
    await Wait.until(() => expect(titles(finished())).toHaveLength(2));
    context.fail(MethodName.BackgroundTaskStop, "The task could not be stopped.");
    cancel("npm run dev").click();
    await settle();
    expect(texts("[role='alert']", row("npm run dev"))).toEqual(["The task could not be stopped."]);
    context.emit(EventName.BackgroundTaskUpdated, tasks[0]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());

    context.emit(EventName.BackgroundTasksCleared, new BackgroundTasksClearedPayload("c2", at(0), 1).toJson());
    await settle();
    expect(titles(finished())).toHaveLength(3);
    context.emit(EventName.BackgroundTasksCleared, cleared(0, 3).toJson());
    await settle();

    expect([titles(running()), titles(finished())]).toEqual([["npm test -- --watch"], []]);
    expect(element().querySelectorAll("[role='alert']")).toHaveLength(0);
    expect([...BackgroundTaskStoreService.of(context).stopErrors().keys()]).toEqual([]);
  });

  it("shows a task that starts and its live output, and ignores another chat's", async () => {
    await create();
    await Wait.until(() => expect(titles(element())).toHaveLength(4));
    const started = task("t5", "tail -f log", BackgroundTaskStatus.Running, null, 0, null);

    context.emit(EventName.BackgroundTaskUpdated, started.toJson());
    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(SampleData.conversation.id, "t5", "first\n").toJson());
    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload(SampleData.conversation.id, "t5", "second\n").toJson());
    context.emit(EventName.BackgroundTaskUpdated, new BackgroundTask("t6", "c2", "r9", "codex", "elsewhere", BackgroundTaskStatus.Running, null, at(0), null, "").toJson());
    context.emit(EventName.BackgroundTaskOutput, new BackgroundTaskOutputPayload("c2", "t6", "x").toJson());
    await settle();
    (row("tail -f log").querySelector(".nol-tool-call-toggle") as HTMLButtonElement).click();
    await settle();

    expect(titles(running())).toEqual(["npm run dev", "npm test -- --watch", "tail -f log"]);
    expect(texts(".tasks-count", running())).toEqual(["3"]);
    expect(row("tail -f log").querySelector(".nol-tool-call-output")?.textContent).toBe("first\nsecond");
  });

  it("follows its end as tasks start, with the newest last and inside the view, and stays where the person scrolled up to until they scroll back down", async () => {
    const host = await createScrollingAsync();
    expect(host.scrollHeight).toBeGreaterThan(host.clientHeight);

    await startAsync("n1", "tail -f log", 0);
    expect(fromEnd(host)).toBeLessThan(1);
    expect(row("tail -f log").getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom + 1);

    host.scrollTop = 0;
    await settle();
    await startAsync("n2", "watch", 1);
    expect(host.scrollTop).toBe(0);

    host.scrollTop = host.scrollHeight;
    await settle();
    await startAsync("n3", "serve", 2);
    expect(fromEnd(host)).toBeLessThan(1);
  });

  it("opens another chat's tasks at their end, with its newest last and inside the view, though the person scrolled up in the chat before", async () => {
    const others = Array.from({ length: 30 }, (_, i) => new BackgroundTask(`o${i}`, "c2", "r9", "codex", `lint ${i}`, BackgroundTaskStatus.Running, null, at(-100 + i), null, ""));
    const host = await createScrollingAsync(t => SampleData.tasks(BackgroundTaskListParams.fromJson(t).chatId === "c2" ? others : tasks));
    await startAsync("n1", "tail -f log", 0);
    host.scrollTop = 0;
    await settle();

    const store = ChatStoreService.of(context);
    await store.conversationInView("c2");
    store.conversationOutOfView(SampleData.conversation.id);
    await Wait.until(() => expect(titles(running()).at(-1)).toBe("lint 29"));
    await settle();

    expect(fromEnd(host)).toBeLessThan(1);
    expect(row("lint 29").getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom + 1);
  });

  it("keeps the person's place while its view is out of the page, as when its dock collapses, and doesn't follow tasks that started meanwhile", async () => {
    const host = await createScrollingAsync();
    await startAsync("n1", "tail -f log", 0);
    host.scrollTop = 0;
    await settle();
    const parent = host.parentElement;

    host.remove();
    await startAsync("n2", "watch", 1);
    parent?.append(host);
    await settle();
    await startAsync("n3", "serve", 2);

    expect([host.isConnected, host.scrollTop]).toEqual([true, 0]);
  });

  it("stops a task through the runtime with no Cancel while it stops, then shows it Cancelled under Finished", async () => {
    await create();
    await Wait.until(() => expect(titles(running())).toHaveLength(2));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskStop, () => answer.promise);

    cancel("npm test -- --watch").click();
    await settle();
    expect(BackgroundTaskIdParams.fromJson(context.parametersOf(MethodName.BackgroundTaskStop)!).taskId).toBe("t2");
    expect([cancel("npm test -- --watch"), cancel("npm run dev").disabled]).toEqual([null, false]);
    answer.resolve(tasks[2]!.withEnd(BackgroundTaskStatus.Stopped, null, at(0)).toJson());
    await settle();

    expect([titles(running()), titles(finished())]).toEqual([["npm run dev"], ["make", "false", "npm test -- --watch"]]);
    expect(texts(".nol-tool-call-status", row("npm test -- --watch"))).toEqual(["Cancelled"]);
    expect(cancel("npm test -- --watch")).toBeNull();
  });

  it("keeps the focus on a task stopped from its Cancel, on its toggle while it stops and under Finished once stopped, or on Finished's toggle while Finished is folded", async () => {
    await create();
    await Wait.until(() => expect(titles(running())).toHaveLength(2));
    const answer = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskStop, () => answer.promise);
    const taskToggle = (command: string): HTMLElement | null => row(command).querySelector<HTMLElement>(Resources.taskToggleSelector);

    cancel("npm run dev").focus();
    cancel("npm run dev").click();
    await settle();
    expect(document.activeElement).toBe(taskToggle("npm run dev"));
    expect(running().contains(document.activeElement)).toBe(true);
    answer.resolve(tasks[0]!.withEnd(BackgroundTaskStatus.Stopped, null, at(0)).toJson());
    await settle();
    expect(finished().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(taskToggle("npm run dev"));

    toggle().click();
    await settle();
    context.answer(MethodName.BackgroundTaskStop, () => tasks[2]!.withEnd(BackgroundTaskStatus.Stopped, null, at(0)).toJson());
    cancel("npm test -- --watch").focus();
    cancel("npm test -- --watch").click();
    await settle();

    expect(titles(running())).toEqual([]);
    expect(document.activeElement).toBe(toggle());
  });

  it("drops a stop's answer for a task that ended and was cleared while it waited", async () => {
    await create();
    await Wait.until(() => expect(titles(running())).toHaveLength(2));
    const answer = new DeferredResponse();
    const refused = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskStop, t => BackgroundTaskIdParams.fromJson(t).taskId === "t1"
      ? answer.promise
      : refused.promise.then(() => Promise.reject(new Error("Background task t2 was not found."))));

    cancel("npm run dev").click();
    cancel("npm test -- --watch").click();
    await settle();
    for (const index of [0, 2])
      context.emit(EventName.BackgroundTaskUpdated, tasks[index]!.withEnd(BackgroundTaskStatus.Completed, 0, at(0)).toJson());
    context.emit(EventName.BackgroundTasksCleared, cleared(0, 4).toJson());
    answer.resolve(tasks[0]!.toJson());
    refused.resolve(null);
    await settle();

    expect([titles(running()), titles(finished())]).toEqual([[], []]);
    expect(element().querySelectorAll("[role='alert']")).toHaveLength(0);
    expect([...BackgroundTaskStoreService.of(context).stopErrors().keys()]).toEqual([]);
  });

  it("drops a stop's answer and refusal for a task whose chat was deleted while they waited", async () => {
    await create();
    await Wait.until(() => expect(titles(running())).toHaveLength(2));
    const store = BackgroundTaskStoreService.of(context);
    const answer = new DeferredResponse();
    const refused = new DeferredResponse();
    context.answer(MethodName.BackgroundTaskStop, t => BackgroundTaskIdParams.fromJson(t).taskId === "t1"
      ? answer.promise
      : refused.promise.then(() => Promise.reject(new Error("Background task t2 was not found."))));

    cancel("npm run dev").click();
    cancel("npm test -- --watch").click();
    await settle();
    context.emit(EventName.ConversationDeleted, new ConversationIdParams(SampleData.conversation.id).toJson());
    answer.resolve(tasks[0]!.toJson());
    refused.resolve(null);
    await settle();

    expect(store.tasksOf(SampleData.conversation.id)).toEqual([]);
    expect([...store.stopErrors().keys()]).toEqual([]);
  });

  it("shows the provider's refusal under the task when a stop fails, keeps Cancel, and clears the refusal on the next try", async () => {
    await create();
    context.fail(MethodName.BackgroundTaskStop, "The task could not be stopped: No task found with ID: server");
    await Wait.until(() => expect(titles(running())).toHaveLength(2));

    cancel("npm run dev").click();
    await settle();

    expect(texts("[role='alert']", row("npm run dev"))).toEqual(["The task could not be stopped: No task found with ID: server"]);
    expect(cancel("npm run dev").disabled).toBe(false);
    expect(row("npm test -- --watch").querySelector("[role='alert']")).toBeNull();
    context.answer(MethodName.BackgroundTaskStop, () => tasks[0]!.withEnd(BackgroundTaskStatus.Stopped, null, at(0)).toJson());
    cancel("npm run dev").click();
    await settle();
    expect(element().querySelectorAll("[role='alert']")).toHaveLength(0);
  });

  it("says the chat has no background tasks, and shows a failed list with Retry", async () => {
    tasks = [];
    await create();
    await Wait.until(() => expect(texts(".tasks-empty")).toEqual([Resources.noBackgroundTasksText]));
    expect(element().querySelector(".tasks-group")).toBeNull();

    context.fail(MethodName.BackgroundTaskList, "The runtime is busy.");
    context.emit(EventName.StateInvalidated, null);
    await settle();
    expect(texts(".tasks-error")).toEqual(["The runtime is busy."]);
    expect(texts(".tasks-empty")).toEqual([]);

    tasks = [task("t1", "npm run dev", BackgroundTaskStatus.Running, null, -1, null)];
    context.answer(MethodName.BackgroundTaskList, () => SampleData.tasks(tasks));
    (element().querySelector(".tasks-failure button") as HTMLButtonElement).click();
    await settle();
    expect([titles(running()), texts(".tasks-count")]).toEqual([["npm run dev"], ["0", "1"]]);
    expect(texts(".tasks-error")).toEqual([]);
  });

  it("follows the chat shown in the middle, and shows its empty state once the last chat closes", async () => {
    await create();
    await Wait.until(() => expect(titles(element())).toHaveLength(4));
    const store = ChatStoreService.of(context);

    store.conversationOutOfView(SampleData.conversation.id);
    await settle();

    expect(store.selectedConversationId()).toBe(SampleData.conversation.id);
    expect(titles(element())).toEqual([]);
    expect(texts(".tasks-empty")).toEqual([Resources.noBackgroundTasksText]);
  });

  it("forgets a deleted chat's tasks, and drops its list when the answer comes after the delete", async () => {
    await create();
    await Wait.until(() => expect(titles(element())).toHaveLength(4));
    const store = BackgroundTaskStoreService.of(context);
    const pending: { answer: (() => void) | null } = { answer: null };
    context.answer(MethodName.BackgroundTaskList, () => new Promise(resolve => {
      pending.answer = () => resolve(SampleData.tasks(tasks));
    }));

    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(pending.answer).not.toBeNull());
    context.emit(EventName.ConversationDeleted, new ConversationIdParams(SampleData.conversation.id).toJson());
    expect(store.tasksOf(SampleData.conversation.id)).toEqual([]);
    pending.answer?.();
    await settle();

    expect(store.tasksOf(SampleData.conversation.id)).toEqual([]);
    expect(store.loadErrorOf(SampleData.conversation.id)).toBeNull();
  });

  it("shows what the runtime gave when a stop or the list fails without an error, and no tasks for an empty answer", async () => {
    await create();
    await Wait.until(() => expect(titles(running())).toHaveLength(2));
    context.answer(MethodName.BackgroundTaskStop, () => Promise.reject("The runtime stopped."));

    cancel("npm run dev").click();
    await settle();
    expect(texts("[role='alert']", row("npm run dev"))).toEqual(["The runtime stopped."]);

    context.answer(MethodName.BackgroundTaskList, () => Promise.reject("The runtime stopped."));
    context.emit(EventName.StateInvalidated, null);
    await settle();
    expect(texts(".tasks-error")).toEqual(["The runtime stopped."]);

    context.answer(MethodName.BackgroundTaskList, () => null);
    (element().querySelector(".tasks-failure button") as HTMLButtonElement).click();
    await settle();
    expect(texts(".tasks-empty")).toEqual([Resources.noBackgroundTasksText]);
    expect(texts(".tasks-error")).toEqual([]);
  });

  it("keeps the newer list when an older one fails after it", async () => {
    await create();
    await Wait.until(() => expect(titles(element())).toHaveLength(4));
    const pending: { fail: (() => void) | null } = { fail: null };
    context.answer(MethodName.BackgroundTaskList, () => new Promise((_, reject) => {
      pending.fail = () => reject(new Error("The runtime is busy."));
    }));
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(pending.fail).not.toBeNull());
    const older = pending.fail;
    context.answer(MethodName.BackgroundTaskList, () => SampleData.tasks(tasks.slice(0, 1)));

    context.emit(EventName.StateInvalidated, null);
    await settle();
    older?.();
    await settle();

    expect(titles(element())).toEqual(["npm run dev"]);
    expect(texts(".tasks-error")).toEqual([]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("in a 16rem panel, cuts a long command with an ellipsis, ends times, Cancel and Clear at one edge, and starts the headers, at the emphasis weight, where the rows' twisties start", async () => {
      tasks.push(task("t9", `npm run build -- --project ${"a".repeat(80)}`, BackgroundTaskStatus.Completed, 0, -60, -40));
      await create();
      element().style.width = "16rem";
      await settle();
      await Wait.until(() => expect(titles(element())).toHaveLength(5));
      const box = (view: Element | null): DOMRect => (view as HTMLElement).getBoundingClientRect();
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const rows = [...element().querySelectorAll<HTMLElement>("nol-tool-call")];
      const headers = [...element().querySelectorAll<HTMLElement>(".tasks-header")];
      const border = AppearanceFixture.measureLook("border-width");
      const start = box(rows[0]!).left + border + space(1) * 2;
      const end = box(rows[0]!).right - border - space(3) + (AppearanceFixture.measureLook("icon-button-target") - AppearanceFixture.measureLook("icon")) / 2;

      expect(element().scrollWidth).toBe(element().clientWidth);
      const long = row(tasks[4]!.command).querySelector(".nol-tool-call-title") as HTMLElement;
      expect([getComputedStyle(long).textOverflow, long.scrollWidth > long.clientWidth]).toEqual(["ellipsis", true]);
      expect(box(long).right).toBeLessThan(box(row(tasks[4]!.command).querySelector(".nol-tool-call-state")).left);
      for (const view of [clear(), cancel("npm run dev"), cancel("npm test -- --watch")])
        AppearanceFixture.expectPixels(box(view).right, end);
      for (const view of ["false", "make", tasks[4]!.command])
        AppearanceFixture.expectPixels(box(row(view).querySelector(".nol-tool-call-state")).right, end);
      for (const view of rows)
        AppearanceFixture.expectPixels(box(view.querySelector(".nol-tool-call-twistie")).left, start);
      AppearanceFixture.expectPixels(box(running().querySelector(".tasks-title")).left, start);
      AppearanceFixture.expectPixels(box(element().querySelector(".tasks-twistie")).left, start);
      for (const view of headers) {
        AppearanceFixture.expectPixels(box(view).height, AppearanceFixture.measureLook("section-header-height"));
        expect(getComputedStyle(view).fontWeight).toBe(getComputedStyle(view).getPropertyValue("--nol-weight-emphasis").trim());
      }
      AppearanceFixture.expectPixels(box(running()).top - box(finished()).bottom, space(3));
      for (const [above, below] of [[0, 1], [1, 2], [3, 4]] as const)
        AppearanceFixture.expectPixels(box(rows[below]!).top - box(rows[above]!).bottom, space(1));
      if (forcedColors === "none")
        expect([...element().querySelectorAll(".tasks-count")].map(t => getComputedStyle(t).color))
          .toEqual([0, 1].map(() => AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted")));
    });

    it("scrolls in its own box, so its scrollbar runs along the panel's end edge from top to bottom, with the view's padding inside the scrolling content", async () => {
      tasks = Array.from({ length: 30 }, (_, i) => task(`t${i}`, `make ${i}`, BackgroundTaskStatus.Running, null, -100 - i, null));
      await create();
      element().style.width = "16rem";
      element().style.height = "12rem";
      await settle();
      await Wait.until(() => expect(titles(running())).toHaveLength(30));
      const host = element();
      const box = host.getBoundingClientRect();
      const inline = AppearanceFixture.measureLook("content-padding-inline");
      const block = AppearanceFixture.measureLook("view-padding-block");
      const end = (): number => Math.max(...[...host.children].map(t => t.getBoundingClientRect().bottom));

      expect([getComputedStyle(host).overflowY, host.scrollHeight > host.clientHeight]).toEqual(["auto", true]);
      expect([host.clientLeft, host.clientTop, host.offsetHeight - host.clientHeight]).toEqual([0, 0, 0]);
      expect(inline).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(finished().getBoundingClientRect().top - box.top, block);
      AppearanceFixture.expectPixels(finished().getBoundingClientRect().left - box.left, inline);
      AppearanceFixture.expectPixels(box.left + host.clientWidth - running().getBoundingClientRect().right, inline);
      host.scrollTop = host.scrollHeight;
      await settle();
      expect(Math.abs(box.bottom - end() - block)).toBeLessThanOrEqual(1);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the background tasks view visible under forced colours", async () => {
      await create();
      await Wait.until(() => expect(titles(running())).toHaveLength(2));
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the background tasks view at 200% zoom", async () => {
      await create();
      await Wait.until(() => expect(titles(running())).toHaveLength(2));
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the background tasks view by keyboard, with a visible ring", async () => {
      await create();
      await Wait.until(() => expect(titles(running())).toHaveLength(2));
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the background tasks view", async () => {
      await create();
      await Wait.until(() => expect(titles(running())).toHaveLength(2));
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
