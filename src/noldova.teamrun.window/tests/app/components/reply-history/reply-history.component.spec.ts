/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Type } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern } from "@noldova/desktop.protocol";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageDetail,
  MessageDetailsAfterParams,
  MessageIdParams,
  MessagePageParams,
  MessageStatus,
  MethodName,
  PlanStep,
  PlanStepStatus,
  ReplyPage,
  ReplyPanel,
  ReplyPlan,
  ReplySummary
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ActivityViewComponent } from "../../../../src/app/components/activity-view/activity-view.component";
import { ChangesViewComponent } from "../../../../src/app/components/changes-view/changes-view.component";
import { PlanViewComponent } from "../../../../src/app/components/plan-view/plan-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { FormatterService } from "../../../../src/app/services/formatter.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ReplyHistoryComponent", () => {
  const current = "nol-teamrun-reply-history-row nol-message.nol-message-selected";
  let clock: FakeClock;
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<unknown>;
  let store: ChatStoreService;
  let replies: Message[];

  const command = (sequence: number): MessageDetail =>
    new MessageDetail(sequence, DetailKind.Command, "> ls\nout", { tool: "Bash", toolUseId: `t${sequence}` }, SampleData.timestamp);
  const outsideText = "Commands ran in /tmp, outside this chat's folder; changes made there aren't listed.";
  const outsideNote = (sequence: number, text: string = outsideText): MessageDetail =>
    new MessageDetail(sequence, DetailKind.Note, text, { source: "workingTree", changesNote: true, folders: ["/tmp"] }, SampleData.timestamp);
  const edit = (sequence: number, path: string): MessageDetail =>
    new MessageDetail(sequence, DetailKind.FileChange, `Edit: ${path}`, { tool: "Edit", input: { file_path: path, old_string: "a", new_string: "b" } }, SampleData.timestamp);
  const planText = (sequence: number, text: string): MessageDetail =>
    new MessageDetail(sequence, DetailKind.Plan, text, new ReplyPlan([], null, text).toJson(), SampleData.timestamp);
  const checklist = (sequence: number, ...steps: string[]): MessageDetail => new MessageDetail(sequence, DetailKind.Plan, "Plan",
    new ReplyPlan(steps.map((t, i) => new PlanStep(t, i === 0 ? PlanStepStatus.Completed : PlanStepStatus.Pending, null)), null).toJson(), SampleData.timestamp);
  const reply = (id: string, sequence: number, details: readonly MessageDetail[]): Message =>
    SampleData.withStatus(new Message(id, "c1", sequence, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null), MessageStatus.Completed, details);
  const page = (panel: ReplyPanel, parameters: JsonValue, size: number): ReplyPage => {
    const params = MessagePageParams.fromJson(parameters);
    const matching = replies.map(t => ReplySummary.fromMessage(t)).filter(t => t.matches(panel)).toSorted((a, b) => b.preview.sequence - a.preview.sequence)
      .filter(t => Object.isNull(params.beforeSequence) || t.preview.sequence < params.beforeSequence);
    return new ReplyPage(matching.slice(0, size), matching.length > size, false,
      panel === ReplyPanel.Changes && replies.some(t => !Object.isNull(t.endedAt) && t.details.some(u => u.kind === DetailKind.Command)));
  };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string): string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim().replace(/\s+/g, " ") ?? "");
  const headers = (): string[] => [...element().querySelectorAll(".nol-teamrun-reply-header")]
    .map(t => [...t.querySelectorAll(".nol-teamrun-reply-name > span")].map(u => u.textContent?.trim()).join(" "));
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (view: Type<unknown>, select: boolean = true, size: number = Resources.replyPageSize): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.MessageActivityPage, t => page(ReplyPanel.Activity, t, size).toJson())
      .answer(MethodName.MessageChangesPage, t => page(ReplyPanel.Changes, t, size).toJson())
      .answer(MethodName.MessagePlanPage, t => page(ReplyPanel.Plan, t, size).toJson())
      .answer(MethodName.MessageSummary, t => {
        const found = replies.find(u => u.id === MessageIdParams.fromJson(t).messageId);
        return Object.isUndefined(found) ? null : ReplySummary.fromMessage(found).toJson();
      })
      .answer(MethodName.MessageDetails, t => replies.find(u => u.id === MessageIdParams.fromJson(t).messageId)?.toJson() ?? null);
    clock = new FakeClock(Date.parse(SampleData.timestamp));
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClockService, useValue: clock }, ChatStoreService.provider]
    });
    fixture = TestBed.createComponent(view);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    if (select)
      await store.conversationInView(SampleData.conversation.id);
    await settle();
  };
  const refresh = async (): Promise<void> => {
    clock.advance(Resources.replyRefreshDelay);
    await settle();
  };
  const author = (message: Message): string => TestBed.inject(FormatterService).authorLabel(message, [SampleData.codex, SampleData.claude], [SampleData.provider]);
  const header = (message: Message): string => `${author(message)} ${DatePattern.format(new Date(message.createdAt), "h:mm a")}`;

  beforeEach(() => {
    replies = [reply("r1", 1, [command(0)]), reply("r2", 3, [edit(0, "D:\\repo\\a.ts")]), reply("r3", 5, [command(0), command(1)])];
  });

  afterEach(() => {
    TimeFormatService.release(context);
    ChatStoreService.release(context);
  });

  it("lists the open conversation's replies with activity oldest first, newest at the bottom, in a feed named Activity, each under its author and time", async () => {
    await create(ActivityViewComponent);

    expect(element().querySelector("nol-virtual-list")?.getAttribute("aria-label") ?? element().querySelector("[role='feed']")?.getAttribute("aria-label"))
      .toBe(Resources.activityTitle);
    await Wait.until(() => expect(headers()).toEqual([header(replies[0] as Message), header(replies[1] as Message), header(replies[2] as Message)]));
    expect(texts("nol-teamrun-activity-block .summary")).toEqual([
      Resources.formatActivitySummary([Resources.formatCommandCount(1)]),
      Resources.formatActivitySummary([Resources.formatEditCount(1)]),
      Resources.formatActivitySummary([Resources.formatCommandCount(2)])
    ]);
    expect(texts(".nol-teamrun-reply-name > span:last-child")[0]).toMatch(/^\d{1,2}:\d{2} [AP]M$/u);
  });

  it("writes each reply's time in Noldova Desktop's time format, the 12-hour default, a 24-hour one and then another, redrawing the times already shown", async () => {
    await create(ActivityViewComponent);
    const times = (): string[] => texts(".nol-teamrun-reply-name > span:last-child");
    const expected = (pattern: string): string[] => replies.map(t => DatePattern.format(new Date(t.createdAt), pattern));
    await Wait.until(() => expect(times()).toEqual(expected("h:mm a")));
    context.changeSetting("desktop.timeFormat", "HH:mm");
    TimeFormatService.register(context);
    await Wait.until(() => expect(times()).toEqual(expected("HH:mm")));
    context.changeSetting("desktop.timeFormat", "HH:mm:ss");

    await Wait.until(() => expect(times()).toEqual(expected("HH:mm:ss")));
  });

  it("lists only the replies that edited files in Changes, each with its edited files", async () => {
    await create(ChangesViewComponent);

    await Wait.until(() => expect(headers()).toEqual([header(replies[1] as Message)]));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-edited-files")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
  });

  it("lists the open chat's plans oldest first, newest at the bottom, in a feed named Plans, each reply's plan text then its checklist in its block under its author, and only the checklist of a reply without plan text", async () => {
    replies = [reply("r1", 1, [command(0)]), reply("r2", 3, [planText(0, "First plan")]), reply("r3", 5, [planText(0, "Second plan"), checklist(1, "Read", "Fix")]),
      reply("r4", 7, [checklist(0, "Look", "Ship")])];
    await create(PlanViewComponent);

    expect(element().querySelector("[role='feed']")?.getAttribute("aria-label")).toBe(Resources.plansTitle);
    expect(Resources.plansTitle).toBe("Plans");
    await Wait.until(() => expect(texts("nol-teamrun-reply-history-row .nol-markdown-view")).toEqual(["First plan", "Second plan"]), MarkdownWait.coldImport);
    expect(texts("nol-teamrun-reply-history-row nol-teamrun-plan-card .header .name")).toEqual([author(replies[1] as Message), author(replies[2] as Message), author(replies[3] as Message)]);
    expect(texts("nol-plan .nol-plan-text")).toEqual(["Read", "Fix", "Look", "Ship"]);
    const rows = [...element().querySelectorAll("nol-teamrun-reply-history-row")];
    const [second, checklistOnly] = [rows.at(-2), rows.at(-1)];
    expect([checklistOnly?.querySelector(".nol-markdown-view"), checklistOnly?.querySelectorAll("nol-plan").length]).toEqual([null, 1]);
    expect((second?.querySelector(".nol-markdown-view")?.compareDocumentPosition(second.querySelector("nol-plan") as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(element().querySelectorAll(current)).toHaveLength(0);
    expect(element().querySelector("nol-teamrun-activity-block, nol-teamrun-edited-files, .nol-teamrun-reply-header")).toBeNull();
  });

  it("scrolls the Plan view to the reply whose plan card was opened, to its top, keeping it there as rows are measured until the person scrolls, once its first page arrives, loading older replies to find it and the ten before it, marks only that reply selected, moves the mark to the next one opened and keeps it for a reply it doesn't list", async () => {
    replies = Array.from({ length: 20 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent, false, 2);
    element().style.display = "block";
    element().style.height = "300px";
    const selected = (): string[] => texts(`${current} .nol-markdown-view`);

    store.focusPlan(replies[8] as Message);
    await store.conversationInView(SampleData.conversation.id);
    await Wait.until(() => expect(selected()).toEqual(["Plan 8"]), MarkdownWait.coldImport);
    await settle();
    expect(context.count(MethodName.MessagePlanPage)).toBeGreaterThanOrEqual(6);
    const viewport = element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
    const offset = (): number => Math.abs((element().querySelector(current) as HTMLElement).getBoundingClientRect().top - viewport.getBoundingClientRect().top);
    await Wait.until(() => expect(offset()).toBeLessThan(1));

    store.focusPlan(replies[4] as Message);
    await Wait.until(() => expect(selected()).toEqual(["Plan 4"]), MarkdownWait.coldImport);
    await Wait.until(() => expect(offset()).toBeLessThan(1));
    for (const event of [new WheelEvent("wheel", { bubbles: true }), new PointerEvent("pointerdown", { bubbles: true }), new KeyboardEvent("keydown", { bubbles: true })])
      viewport.dispatchEvent(event);
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    await settle();
    element().style.width = "20rem";
    await settle();
    await settle();
    expect(viewport.scrollTop).toBeLessThan(1);
    const pages = context.count(MethodName.MessagePlanPage);
    store.focusPlan(reply("x1", 41, [command(0)]));
    await settle();
    expect([selected(), context.count(MethodName.MessagePlanPage)]).toEqual([["Plan 4"], pages]);
  });

  it("shows the last reply whose card opened when another opens while the Plan view still looks for the first", async () => {
    replies = Array.from({ length: 30 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent, true, 2);
    const selected = (): string[] => texts(`${current} .nol-markdown-view`);
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    context.answer(MethodName.MessagePlanPage, async t => {
      await held;
      return page(ReplyPanel.Plan, t, 2).toJson();
    });

    store.focusPlan(replies[0] as Message);
    await Wait.until(() => expect(context.count(MethodName.MessagePlanPage)).toBe(2));
    store.focusPlan(replies[25] as Message);
    release();
    await Wait.until(() => expect(selected()).toEqual(["Plan 25"]), MarkdownWait.coldImport);
    await Wait.until(() => expect(context.count(MethodName.MessagePlanPage)).toBe(15));
    await settle();
    expect(selected()).toEqual(["Plan 25"]);
  });

  it("marks and shows the opened reply again when the person leaves its chat and comes back", async () => {
    replies = Array.from({ length: 20 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent, true, 2);
    element().style.display = "block";
    element().style.height = "300px";
    const selected = (): string[] => texts(`${current} .nol-markdown-view`);
    const offset = (): number => Math.abs((element().querySelector(current) as HTMLElement).getBoundingClientRect().top
      - (element().querySelector(".nol-virtual-list-viewport") as HTMLElement).getBoundingClientRect().top);

    store.focusPlan(replies[8] as Message);
    await Wait.until(() => expect(selected()).toEqual(["Plan 8"]), MarkdownWait.coldImport);
    store.conversationOutOfView(SampleData.conversation.id);
    await settle();
    const away = selected();
    await store.conversationInView(SampleData.conversation.id);

    await Wait.until(() => expect(selected()).toEqual(["Plan 8"]), MarkdownWait.coldImport);
    await Wait.until(() => expect(offset()).toBeLessThan(1));
    expect(away).toEqual([]);
  });

  it("lets go of the opened reply when it leaves the list, rather than holding the view at the newest reply", async () => {
    replies = Array.from({ length: 20 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent, true, 20);
    element().style.display = "block";
    element().style.height = "300px";
    const viewport = (): HTMLElement => element().querySelector(".nol-virtual-list-viewport") as HTMLElement;

    store.focusPlan(replies[8] as Message);
    await Wait.until(() => expect(texts(`${current} .nol-markdown-view`)).toEqual(["Plan 8"]), MarkdownWait.coldImport);
    await Wait.until(() => expect(viewport().scrollTop).toBeGreaterThan(100));
    replies = replies.filter(t => t.id !== "r8");
    context.emit(EventName.DetailUpdated, new DetailEventPayload("r8", planText(0, "Plan 8")).toJson());
    await refresh();
    await Wait.until(() => expect(texts(".nol-markdown-view")).not.toContain("Plan 8"));
    element().style.width = "20rem";
    await settle();
    await settle();

    expect(viewport().scrollTop).toBeGreaterThan(100);
  });

  it("keeps the end where the person left it while older replies load to find the opened one, and still marks it", async () => {
    replies = Array.from({ length: 30 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent, true, 2);
    element().style.display = "block";
    element().style.height = "300px";
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const pages = context.count(MethodName.MessagePlanPage);
    context.answer(MethodName.MessagePlanPage, async t => {
      await held;
      return page(ReplyPanel.Plan, t, 2).toJson();
    });

    const viewport = element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
    store.focusPlan(replies[20] as Message);
    await Wait.until(() => expect(context.count(MethodName.MessagePlanPage)).toBe(pages + 1));
    (element().querySelector("nol-teamrun-reply-history") as HTMLElement).dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    release();
    await Wait.until(() => expect(texts(`${current} .nol-markdown-view`)).toEqual(["Plan 20"]), MarkdownWait.coldImport);
    await Wait.until(() => expect(context.count(MethodName.MessagePlanPage)).toBeGreaterThan(pages + 3));
    await settle();
    await settle();

    expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop).toBeLessThan(1);
  });

  it("says when the conversation has no activity or no edited files, and when no conversation is open", async () => {
    replies = [];
    await create(ActivityViewComponent);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noActivityText]);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();

    await create(ChangesViewComponent, false);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noChangesText]);
    expect(context.count(MethodName.MessageChangesPage)).toBe(0);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();

    replies = [reply("r1", 1, [command(0)])];
    await create(PlanViewComponent);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noPlanText]);
  });

  it("keeps saying no files were edited while no command ran, and says no files changed in the chat's folder once one did", async () => {
    replies = [];
    await create(ChangesViewComponent);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noChangesText]);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();

    replies = [reply("r1", 1, [command(0)])];
    await create(ChangesViewComponent);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noFolderChangesText]);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();

    replies = [];
    await create(ChangesViewComponent);
    const running = SampleData.withStatus(reply("r2", 3, []), MessageStatus.Running, [command(0)]);
    replies = [running];
    context.emit(EventName.MessageCreated, running.toJson());
    await refresh();
    const whileRunning = texts(".nol-teamrun-reply-empty");
    const ran = reply("r2", 3, [command(0)]);
    replies = [ran];
    context.emit(EventName.MessageUpdated, ran.toJson());
    await refresh();

    expect(whileRunning).toEqual([Resources.noChangesText]);
    await Wait.until(() => expect(texts(".nol-teamrun-reply-empty")).toEqual([Resources.noFolderChangesText]));
  });

  it("lists each of a reply's working-tree notes, such as an incomplete or a missing compare, above its files", async () => {
    const notes = ["The reply may have changed more than its evidence shows.", "This chat's folder wasn't compared after this reply."];
    replies = [reply("r1", 1, [command(0), outsideNote(1, notes[0] ?? ""), outsideNote(2, notes[1] ?? ""), edit(3, "D:\\repo\\a.ts")])];
    await create(ChangesViewComponent);

    await Wait.until(() => expect(texts(".nol-teamrun-reply-note")).toEqual(notes));
    expect(element().querySelectorAll("nol-teamrun-edited-files")).toHaveLength(1);
  });

  it("lists a reply whose commands ran outside the chat's folder with the note that changes there aren't listed, and no empty files card", async () => {
    replies = [reply("r1", 1, [command(0)])];
    await create(ChangesViewComponent);
    const outside = reply("r2", 3, [command(0), outsideNote(1)]);
    replies = [...replies, outside];
    context.emit(EventName.MessageCreated, outside.toJson());
    await refresh();

    await Wait.until(() => expect(texts(".nol-teamrun-reply-note")).toEqual([outsideText]));
    expect(headers()).toEqual([header(outside)]);
    expect(texts(".nol-teamrun-reply-empty")).toEqual([]);
    expect(element().querySelectorAll("nol-teamrun-edited-files")).toHaveLength(0);
  });

  it.each([
    { name: "Activity", view: ActivityViewComponent, empty: Resources.noActivityText },
    { name: "Changes", view: ChangesViewComponent, empty: Resources.noChangesText }
  ])("empties $name when the last chat in view closes, and shows the chat's replies again when it reopens", async ({ view, empty }) => {
    await create(view);
    await Wait.until(() => expect(headers().length).toBeGreaterThan(0));
    const open = headers();

    store.conversationOutOfView(SampleData.conversation.id);
    await settle();
    const closed = { headers: headers(), empty: texts(".nol-teamrun-reply-empty") };
    await store.conversationInView(SampleData.conversation.id);

    expect(closed).toEqual({ headers: [], empty: [empty] });
    await Wait.until(() => expect(headers()).toEqual(open));
  });

  it("stays empty when a page asked for before the last chat closed answers after it", async () => {
    await create(ActivityViewComponent, false);
    const held = new DeferredResponse();
    context.answer(MethodName.MessageActivityPage, () => held.promise);
    void store.conversationInView(SampleData.conversation.id);
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-loading")).not.toBeNull());

    store.conversationOutOfView(SampleData.conversation.id);
    held.resolve(page(ReplyPanel.Activity, new MessagePageParams(SampleData.conversation.id, null, null, Resources.replyPageSize).toJson(),
      Resources.replyPageSize).toJson());
    await settle();

    expect([headers(), texts(".nol-teamrun-reply-empty")]).toEqual([[], [Resources.noActivityText]]);
  });

  for (const [name, view, detail, mark] of [
    ["Activity", ActivityViewComponent, (): MessageDetail => command(0), null],
    ["Changes", ChangesViewComponent, (i: number): MessageDetail => edit(0, `/repo/f${i}.ts`), "f11.ts"],
    ["Plans", PlanViewComponent, (i: number): MessageDetail => planText(0, `Plan ${i}`), "Plan 11"]
  ] as const)
    it(`opens ${name} scrolled to its end, with the newest reply last and in view`, async () => {
      replies = Array.from({ length: 12 }, (_, i) => reply(`r${i}`, i * 2, [detail(i)]));
      await create(view, false);
      element().style.display = "block";
      element().style.height = "300px";
      await store.conversationInView(SampleData.conversation.id);
      const viewport = (): HTMLElement => element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
      const newest = (): HTMLElement | null => element().querySelector<HTMLElement>("[data-nol-row='11']");
      await Wait.until(() => expect(newest()).not.toBeNull(), MarkdownWait.coldImport);
      await settle();
      await settle();
      const box = viewport().getBoundingClientRect();
      const row = (newest() as HTMLElement).getBoundingClientRect();

      expect(element().querySelectorAll("[data-nol-row='12']")).toHaveLength(0);
      expect(viewport().scrollHeight - viewport().clientHeight - viewport().scrollTop).toBeLessThanOrEqual(1);
      expect([row.top >= box.top - 0.5, row.bottom <= box.bottom + 1]).toEqual([true, true]);
      if (mark !== null)
        expect(newest()?.textContent).toContain(mark);
    });

  it("adds a reply at the bottom once it shows activity, and drops one the runtime no longer has", async () => {
    await create(ActivityViewComponent);
    const running = reply("r4", 7, []);
    replies.push(running);
    context.emit(EventName.MessageCreated, running.toJson());
    replies[3] = reply("r4", 7, [command(0)]);
    context.emit(EventName.DetailAppended, new DetailEventPayload("r4", command(0)).toJson());
    await refresh();

    const summaries = [
      Resources.formatActivitySummary([Resources.formatCommandCount(1)]),
      Resources.formatActivitySummary([Resources.formatEditCount(1)]),
      Resources.formatActivitySummary([Resources.formatCommandCount(2)]),
      Resources.formatActivitySummary([Resources.formatCommandCount(1)])
    ];

    await Wait.until(() => expect(texts("nol-teamrun-activity-block .summary")).toEqual(summaries));
    expect(headers()).toHaveLength(4);

    replies = replies.filter(t => t.id !== "r1");
    context.emit(EventName.DetailUpdated, new DetailEventPayload("r1", command(0)).toJson());
    await refresh();

    await Wait.until(() => expect(texts("nol-teamrun-activity-block .summary")).toEqual(summaries.slice(1)));
  });

  it("ignores replies of other conversations", async () => {
    await create(ActivityViewComponent);
    const other = SampleData.withStatus(new Message("x1", "c2", 9, SampleData.reply.author, null, MessageStatus.Running, [command(0)], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed);
    const summaries = context.count(MethodName.MessageSummary);

    context.emit(EventName.MessageCreated, other.toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("x1", command(0)).toJson());
    await refresh();
    await refresh();

    expect(context.count(MethodName.MessageSummary)).toBe(summaries);
  });

  it("reads no details of a 500-step running reply on its refreshes until a step opens, and then only the new and changed ones a refresh", async ({ annotate }) => {
    let running = SampleData.withStatus(reply("r4", 7, []), MessageStatus.Running, Array.from({ length: 500 }, (_, index) => command(index)));
    replies.push(running);
    await create(ActivityViewComponent);
    await Wait.until(() => expect(headers()).toHaveLength(4));
    const read: number[] = [];
    context.answer(MethodName.MessageDetailsAfter, t => {
      const params = MessageDetailsAfterParams.fromJson(t);
      const details = running.details.filter(u => u.sequence > params.afterSequence || params.sequences.includes(u.sequence));
      read.push(details.length);
      return running.withDetails(details).toJson();
    });
    const refreshes = async (count: number): Promise<number> => {
      const started = performance.now();
      for (let index = 0; index < count; index++) {
        const changed = new MessageDetail(index, DetailKind.Command, `> ls\nout ${index}`, { tool: "Bash", toolUseId: `t${index}` }, SampleData.timestamp);
        const added = command(running.details.length);
        running = running.withDetails([...running.details.map(t => t.sequence === index ? changed : t), added]);
        replies = replies.map(t => t.id === running.id ? running : t);
        context.emit(EventName.DetailUpdated, new DetailEventPayload(running.id, changed).toJson());
        context.emit(EventName.DetailAppended, new DetailEventPayload(running.id, added).toJson());
        await refresh();
      }
      return (performance.now() - started) / count;
    };

    const closed = await refreshes(3);
    expect(context.count(MethodName.MessageDetails) + context.count(MethodName.MessageDetailsAfter)).toBe(0);
    [...element().querySelectorAll("nol-teamrun-reply-history-row")].at(-1)?.querySelector<HTMLButtonElement>("button.step")?.click();
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));
    const open = await refreshes(3);

    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(read).toEqual([2, 2, 2]);
    await annotate(`A refresh took ${closed.toFixed(1)} ms with every step closed and ${open.toFixed(1)} ms with one open, reading 2 of ${running.details.length} details.`);
  });

  it("reads the newest page again after the conversation is rewound", async () => {
    await create(ActivityViewComponent);
    const reads = context.count(MethodName.MessageActivityPage);
    replies = replies.filter(t => t.sequence < 3);

    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 3).toJson());

    await Wait.until(() => expect(headers()).toEqual([header(replies[0] as Message)]));
    expect(context.count(MethodName.MessageActivityPage)).toBe(reads + 1);
  });

  it.each([
    { cause: "the runtime asks for a resync", resync: (): void => context.emit(EventName.StateResyncRequested, null) },
    { cause: "the window reconnects", resync: (): void => void store.resync() }
  ])("reads the newest page once again after $cause", async ({ resync }) => {
    await create(ActivityViewComponent);
    const reads = context.count(MethodName.MessageActivityPage);
    replies.push(reply("r4", 7, [command(0)]));

    resync();

    await Wait.until(() => expect(headers()).toEqual([header(replies[0] as Message), header(replies[1] as Message), header(replies[2] as Message),
      header(replies[3] as Message)]));
    await settle();
    expect(context.count(MethodName.MessageActivityPage)).toBe(reads + 1);
  });

  it("reads older replies as the person scrolls to the top of the feed", async () => {
    replies = Array.from({ length: 30 }, (_, index) => reply(`r${index}`, index * 2, [command(0)]));
    await create(ActivityViewComponent, true, 20);
    element().style.display = "block";
    element().style.height = "300px";
    await settle();
    const scroller = element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    scroller.scrollTop = scroller.scrollHeight * 4 / 5 - scroller.clientHeight;
    scroller.dispatchEvent(new Event("scroll"));
    await settle();
    expect(context.count(MethodName.MessageActivityPage)).toBe(1);

    for (let index = 0; index < 10 && context.count(MethodName.MessageActivityPage) < 2; index++) {
      scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event("scroll"));
      await settle();
    }

    const pages = context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessageActivityPage));
    expect(pages.map(t => MessagePageParams.fromJson(t.parameters).beforeSequence)).toEqual([null, 20]);
  });

  it("says why a page failed and reads it again on Retry", async () => {
    await create(ActivityViewComponent, false);
    context.fail(MethodName.MessageActivityPage, "The runtime is busy.");
    await store.conversationInView(SampleData.conversation.id);
    await settle();

    expect(texts(".nol-teamrun-reply-failure [role='alert']")).toEqual(["The runtime is busy."]);

    context.answer(MethodName.MessageActivityPage, t => page(ReplyPanel.Activity, t, Resources.replyPageSize).toJson());
    element().querySelector<HTMLButtonElement>(".nol-teamrun-reply-failure button")?.click();

    await Wait.until(() => expect(headers()).toHaveLength(3));
    expect(element().querySelector(".nol-teamrun-reply-failure")).toBeNull();
  });

  it("says why a reply's details failed and reads them again on Retry", async () => {
    await create(ChangesViewComponent);
    context.fail(MethodName.MessageDetails, "Details are gone.");
    await Wait.until(() => expect(element().querySelector("nol-teamrun-edited-files button.name")).not.toBeNull());
    element().querySelector<HTMLButtonElement>("nol-teamrun-edited-files button.name")?.click();

    await Wait.until(() => expect(texts("nol-teamrun-reply-history-row [role='alert']")).toEqual(["Details are gone."]));
    expect(element().querySelector(".diff")).toBeNull();

    context.answer(MethodName.MessageDetails, t => replies.find(u => u.id === MessageIdParams.fromJson(t).messageId)?.toJson() ?? null);
    [...element().querySelectorAll<HTMLButtonElement>("nol-teamrun-reply-history-row button.nol-button")].find(t => t.textContent?.trim() === Resources.replyHistoryRetry)
      ?.click();

    await Wait.until(() => expect(texts("nol-teamrun-reply-history-row [role='alert']")).toEqual([]));
    expect(context.count(MethodName.MessageDetails)).toBe(2);
  });

  it("names each Activity row by its author and time alone, not its stats", async () => {
    await create(ActivityViewComponent);
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-reply-stats")).toHaveLength(3));

    for (const row of element().querySelectorAll<HTMLElement>("nol-teamrun-reply-history-row")) {
      const named = document.getElementById(row.closest("[aria-labelledby]")?.getAttribute("aria-labelledby") ?? "");
      const stats = row.querySelector(".nol-teamrun-reply-stats")!;
      const [author, time] = [...row.querySelectorAll(".nol-teamrun-reply-name > span")].map(t => t.textContent?.trim() ?? "");

      expect(named).toBe(row.querySelector(".nol-teamrun-reply-name"));
      expect(named?.contains(stats)).toBe(false);
      expect([named?.textContent?.includes(author ?? "-"), named?.textContent?.includes(time ?? "-"), named?.textContent?.includes(stats.textContent?.trim() ?? "-")])
        .toEqual([true, true, false]);
    }
  });

  it("selects a plan the person clicks in the Plans view where it is, asks the chat to show its block, moves to another clicked, and clears when the chat asks", async () => {
    replies = Array.from({ length: 6 }, (_, i) => reply(`r${i}`, i * 2, [planText(0, `Plan ${i}`)]));
    await create(PlanViewComponent);
    element().style.display = "block";
    element().style.height = "300px";
    const selected = (): string[] => texts(`${current} .nol-markdown-view`);
    const row = (text: string): HTMLElement | undefined => [...element().querySelectorAll<HTMLElement>("nol-teamrun-reply-history-row")]
      .find(t => t.querySelector(".nol-markdown-view")?.textContent?.trim() === text);
    const label = (text: string): string | undefined =>
      document.getElementById(row(text)?.closest("[aria-labelledby]")?.getAttribute("aria-labelledby") ?? "")?.textContent?.trim();
    await Wait.until(() => expect(row("Plan 1")).toBeDefined(), MarkdownWait.coldImport);
    await settle();
    const viewport = element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
    const top = viewport.scrollTop;

    row("Plan 4")?.querySelector<HTMLElement>("nol-teamrun-plan-card .header")?.click();
    await settle();
    const focus = store.planFocus();
    expect(selected()).toEqual(["Plan 4"]);
    expect([focus?.conversationId, focus?.messageId, focus?.sequence, focus?.isPlan]).toEqual([SampleData.conversation.id, "r4", 8, true]);
    expect(store.focus()).toBe(focus);
    expect(viewport.scrollTop).toBe(top);

    store.focusMessage(null);
    (row("Plan 1")?.querySelector("nol-message") as HTMLElement).click();
    await settle();
    expect([selected(), store.planFocus()?.messageId, store.focus()?.messageId]).toEqual([["Plan 1"], "r1", "r1"]);
    expect([label("Plan 1")?.endsWith("selected"), label("Plan 4")?.endsWith("selected")]).toEqual([true, false]);

    store.clearPlanFocus();
    await settle();
    expect([selected(), store.planFocus()]).toEqual([[], null]);
    expect(element().querySelectorAll("nol-teamrun-reply-history-row nol-message.nol-message-selected")).toHaveLength(0);
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

    for (const [name, view, detail] of [
      ["Activity", ActivityViewComponent, (): MessageDetail => command(0)],
      ["Changes", ChangesViewComponent, (i: number): MessageDetail => edit(0, `/repo/f${i}.ts`)]
    ] as const)
      it(`scrolls ${name} over the whole panel, so the scrollbar runs along the panel's end edge from top to bottom, with the view's padding inside the feed`, async () => {
        replies = Array.from({ length: 12 }, (_, i) => reply(`r${i}`, i * 2, [detail(i)]));
        await create(view);
        element().style.display = "block";
        element().style.height = "300px";
        await settle();
        const viewport = element().querySelector<HTMLElement>(".nol-virtual-list-viewport") as HTMLElement;
        const panel = element().getBoundingClientRect();
        const box = viewport.getBoundingClientRect();
        const inline = AppearanceFixture.measureLook("content-padding-inline");
        const block = AppearanceFixture.measureLook("view-padding-block");
        const header = (row: HTMLElement): DOMRect => (row.querySelector(".nol-teamrun-reply-header") as HTMLElement).getBoundingClientRect();

        expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
        expect(inline).toBeGreaterThan(0);
        for (const [edge, of] of [[box.top, panel.top], [box.bottom, panel.bottom], [box.left, panel.left], [box.right, panel.right]] as const)
          AppearanceFixture.expectPixels(edge, of);
        viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        viewport.scrollTop = viewport.scrollHeight;
        viewport.dispatchEvent(new Event("scroll"));
        await Wait.until(() => expect(element().querySelector("[data-nol-row='11'] nol-teamrun-reply-history-row")).not.toBeNull());
        const last = element().querySelector<HTMLElement>("[data-nol-row='11'] nol-teamrun-reply-history-row") as HTMLElement;
        const slot = element().querySelector<HTMLElement>("[data-nol-row='11']") as HTMLElement;
        await Wait.until(() => expect(Math.abs(box.bottom - slot.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1));
        AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(last).paddingBottom), AppearanceFixture.measureLook("space-1") + block);
        viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        viewport.scrollTop = 0;
        viewport.dispatchEvent(new Event("scroll"));
        await Wait.until(() => expect(element().querySelector("[data-nol-row='0'] nol-teamrun-reply-history-row")).not.toBeNull());
        await settle();
        const first = element().querySelector<HTMLElement>("[data-nol-row='0'] nol-teamrun-reply-history-row") as HTMLElement;
        AppearanceFixture.expectPixels(header(first).top - box.top, block + AppearanceFixture.measureLook("space-3"));
        AppearanceFixture.expectPixels(header(first).left - box.left, inline);
        AppearanceFixture.expectPixels(box.left + viewport.clientWidth - header(first).right, inline);
      });

    it("sets a reply's author and time half a rem apart, three quarters of a rem below the reply above, and its activity a quarter rem below the header, which holds its stats", async () => {
      await create(ActivityViewComponent);
      await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-reply-header")).toHaveLength(3));
      const headers = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-reply-header")];
      const first = headers[0] as HTMLElement;
      const [author, time] = [...first.querySelectorAll(".nol-teamrun-reply-name > span")].map(t => t.getBoundingClientRect());
      const style = getComputedStyle(first);
      const stats = first.lastElementChild as HTMLElement;
      const block = (first.parentElement?.querySelector("nol-teamrun-activity-block") as HTMLElement).getBoundingClientRect();

      AppearanceFixture.expectPixels((time as DOMRect).left - (author as DOMRect).right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.marginTop), AppearanceFixture.measureLook("space-3"));
      expect(stats.classList).toContain("nol-teamrun-reply-stats");
      AppearanceFixture.expectPixels(block.top - first.getBoundingClientRect().bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(Math.abs(((author as DOMRect).top + (author as DOMRect).bottom) / 2 - ((time as DOMRect).top + (time as DOMRect).bottom) / 2), 0);
      if (forcedColors !== "active")
        expect(style.color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("sets the outside-folder note a quarter rem under its reply's header at the header's start in muted text, and the edited files a quarter rem under it, their header and rows across the card's full width", async () => {
      replies = [reply("r1", 1, [command(0), outsideNote(1), edit(2, "D:\\repo\\a.ts")])];
      await create(ChangesViewComponent);
      await Wait.until(() => expect(texts(".nol-teamrun-reply-note")).toEqual([outsideText]));
      const box = (selector: string): DOMRect => element().querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
      const note = element().querySelector(".nol-teamrun-reply-note") ?? element();
      const [header, text, files] = [box(".nol-teamrun-reply-header"), box(".nol-teamrun-reply-note"), box("nol-teamrun-edited-files")];

      expect(note.previousElementSibling?.classList).toContain("nol-teamrun-reply-header");
      AppearanceFixture.expectPixels(text.top - header.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(text.left, header.left);
      AppearanceFixture.expectPixels(files.top - text.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(files.left, header.left);
      for (const row of [box("nol-teamrun-edited-files .header"), box("nol-teamrun-edited-files .file")]) {
        AppearanceFixture.expectPixels(row.left, files.left + AppearanceFixture.measureLook("border-width"));
        AppearanceFixture.expectPixels(row.right, files.right - AppearanceFixture.measureLook("border-width"));
      }
      if (forcedColors !== "active")
        expect(getComputedStyle(note).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("wraps a note that names a long folder inside a narrow panel, without overflowing the row", async () => {
      const long = `Commands ran in /${"a-very-long-folder-name".repeat(8)}, outside this chat's folder; changes made there aren't listed.`;
      replies = [reply("r1", 1, [command(0), outsideNote(1, long)])];
      await create(ChangesViewComponent);
      element().style.display = "block";
      element().style.inlineSize = "16rem";
      await Wait.until(() => expect(texts(".nol-teamrun-reply-note")).toEqual([long]));
      await settle();
      const note = element().querySelector(".nol-teamrun-reply-note") ?? element();
      const row = note.closest("nol-teamrun-reply-history-row")?.getBoundingClientRect() ?? new DOMRect();
      const text = note.getBoundingClientRect();
      const line = Number.parseFloat(getComputedStyle(note).lineHeight);

      expect(getComputedStyle(note).overflowWrap).toBe("anywhere");
      expect(note.scrollWidth).toBeLessThanOrEqual(note.clientWidth);
      expect(row.width).toBeLessThanOrEqual(16 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize) + 0.5);
      expect(text.right).toBeLessThanOrEqual(row.right + 0.5);
      expect(text.height).toBeGreaterThan(line * 2);
    });

    it("overlays a failed page's error, with Retry under it, across the panel's bottom inside the view padding on the raised background", async () => {
      await create(ActivityViewComponent, false);
      context.fail(MethodName.MessageActivityPage, "The runtime is busy.");
      await store.conversationInView(SampleData.conversation.id);
      await settle();
      const panel = (element().querySelector("nol-teamrun-reply-history") as HTMLElement).getBoundingClientRect();
      const failure = element().querySelector<HTMLElement>(".nol-teamrun-reply-failure") as HTMLElement;
      const box = failure.getBoundingClientRect();
      const error = failure.querySelector<HTMLElement>("[role='alert']") as HTMLElement;
      const text = error.getBoundingClientRect();
      const retry = (failure.querySelector("button") as HTMLElement).getBoundingClientRect();
      const space = AppearanceFixture.measureLook("space-2");
      const block = AppearanceFixture.measureLook("view-padding-block");
      const inline = AppearanceFixture.measureLook("content-padding-inline");

      expect(getComputedStyle(failure).position).toBe("absolute");
      AppearanceFixture.expectPixels(panel.bottom - box.bottom, block);
      AppearanceFixture.expectPixels(box.left - panel.left, inline);
      AppearanceFixture.expectPixels(panel.right - box.right, inline);
      AppearanceFixture.expectPixels(text.top - box.top, space);
      AppearanceFixture.expectPixels(text.left - box.left, space);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(error).paddingTop), space);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(error).paddingInlineStart), space);
      AppearanceFixture.expectPixels(retry.top, text.bottom);
      AppearanceFixture.expectPixels(retry.left, text.left);
      AppearanceFixture.expectPixels(box.bottom - retry.bottom, space);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(failure).borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      if (forcedColors !== "active")
        expect(getComputedStyle(failure).backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"));
    });

    it("sets each plan as the chat's block under its author, plans 0.5rem apart inside a scroller that fills the pane to its end edge, and the selected one on the raised background with large corners and no bar, its block's body on the chat's background, its text at least half a rem inside the fill and clear of the forced-colors outline, and the fill ending as far below its block as it starts above it and at its sides, the block's header centred on Copy, with no header or footer row", async () => {
      replies = [reply("r1", 1, [planText(0, "First plan")]), reply("r2", 3, [planText(0, "Second plan"), checklist(1, "Read", "Fix")])];
      await create(PlanViewComponent);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-reply-history-row .nol-markdown-view")).toHaveLength(2), MarkdownWait.coldImport);
      store.focusPlan(replies[0] as Message);
      await Wait.until(() => expect(element().querySelectorAll(current)).toHaveLength(1));
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const style = (target: Element | null | undefined): CSSStyleDeclaration => getComputedStyle(target as Element);
      const [first, second] = [...element().querySelectorAll("nol-teamrun-reply-history-row")];
      const [firstMessage, secondMessage] = [first, second].map(t => t?.querySelector("nol-message"));
      const block = second?.querySelector("nol-teamrun-plan-card");
      const scroller = element().querySelector(".nol-virtual-list-viewport") as HTMLElement;
      const viewport = rect(scroller);
      const space = AppearanceFixture.measureLook("space-2");
      const inset = AppearanceFixture.measureLook("content-padding-inline");
      const pane = rect(element().querySelector("nol-teamrun-reply-history"));

      expect(inset).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(viewport.right, pane.right);
      AppearanceFixture.expectPixels(viewport.left, pane.left);
      AppearanceFixture.expectPixels(viewport.top, pane.top);
      AppearanceFixture.expectPixels(rect(firstMessage).top - viewport.top, AppearanceFixture.measureLook("view-padding-block"));
      for (const message of [secondMessage, firstMessage]) {
        AppearanceFixture.expectPixels(rect(message).left, viewport.left + inset);
        AppearanceFixture.expectPixels(rect(message).right, viewport.left + scroller.clientLeft + scroller.clientWidth - inset);
        expect([style(message).boxShadow, style(message).borderInlineStartWidth]).toEqual(["none", "0px"]);
      }
      AppearanceFixture.expectPixels(rect(secondMessage).top - rect(firstMessage).bottom, space);
      AppearanceFixture.expectPixels(rect(block).left - rect(secondMessage).left, space);
      AppearanceFixture.expectPixels(rect(secondMessage).right - rect(block).right, space);
      expect(rect(secondMessage).bottom - rect(block).bottom).toBeGreaterThanOrEqual(space - 0.5);
      expect([".nol-markdown-view", "nol-plan"].map(t => block?.contains(second?.querySelector(t) ?? null))).toEqual([true, true]);
      expect([block?.querySelector(".chevron"), block?.querySelector(".header")?.hasAttribute("aria-expanded")]).toEqual([null, false]);
      expect([firstMessage, secondMessage].map(t => t?.classList.contains("nol-message-selected"))).toEqual([true, false]);
      AppearanceFixture.expectPixels(Number.parseFloat(style(firstMessage).borderTopLeftRadius), AppearanceFixture.measureLook("radius-large"));
      AppearanceFixture.expectPixels(Number.parseFloat(style(firstMessage).borderBottomRightRadius), AppearanceFixture.measureLook("radius-large"));
      if (forcedColors !== "active") {
        expect(style(firstMessage).backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"));
        expect(style(first?.querySelector("nol-teamrun-plan-card .body")).backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "panel"));
        expect(style(first?.querySelector("nol-teamrun-plan-card .header")).backgroundColor)
          .toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "code-header-raised"));
        expect([style(secondMessage).backgroundColor, style(second?.querySelector("nol-teamrun-plan-card .body")).backgroundColor])
          .toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
        expect(style(block).backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "code"));
      }
      expect([style(firstMessage).outlineStyle, style(secondMessage).outlineStyle]).toEqual([forcedColors === "active" ? "solid" : "none", "none"]);
      const content = rect(firstMessage?.querySelector(".nol-message-content"));
      const top = content.top - rect(firstMessage).top;
      const bottom = rect(firstMessage).bottom - content.bottom;
      const start = content.left - rect(firstMessage).left;
      const end = rect(firstMessage).right - content.right;
      const middle = (box: DOMRect): number => box.top + box.height / 2;
      expect([firstMessage?.querySelector(".nol-message-header"), firstMessage?.querySelector(".nol-message-footer")]).toEqual([null, null]);
      AppearanceFixture.expectPixels(middle(rect(firstMessage?.querySelector(".nol-message-copy"))), middle(rect(first?.querySelector("nol-teamrun-plan-card .header"))));
      AppearanceFixture.expectPixels(top, bottom);
      AppearanceFixture.expectPixels(start, bottom);
      AppearanceFixture.expectPixels(end, bottom);
      AppearanceFixture.expectPixels(rect(first?.querySelector("nol-teamrun-plan-card")).bottom, content.bottom);
      for (const gap of [top, bottom, start, end])
        expect(gap).toBeGreaterThanOrEqual(space - 0.5);
      if (forcedColors === "active") {
        const reach = -Number.parseFloat(style(firstMessage).outlineOffset);
        expect([reach, Number.parseFloat(style(firstMessage).outlineWidth)]).toEqual([2 * AppearanceFixture.measureLook("border-width"), 2 * AppearanceFixture.measureLook("border-width")]);
        expect(Math.min(top, bottom, start, end)).toBeGreaterThan(reach);
      }
    });

    it("pads the empty text half a rem", async () => {
      replies = [];
      await create(ActivityViewComponent);
      const empty = getComputedStyle(element().querySelector(".nol-teamrun-reply-empty") as HTMLElement);

      expect(AppearanceFixture.measureLook("space-2")).toBeGreaterThan(0);
      for (const padding of [empty.paddingTop, empty.paddingInlineStart, empty.paddingBottom, empty.paddingInlineEnd])
        AppearanceFixture.expectPixels(Number.parseFloat(padding), AppearanceFixture.measureLook("space-2"));
    });

    it("keeps half a rem above a revealed plan and the view padding under a gap below the last, scrolled to the end", async () => {
      replies = Array.from({ length: 8 }, (_, index) => reply(`r${index + 1}`, 2 * index + 1, [planText(0, `Plan ${index + 1}\n\n${"Step. ".repeat(40)}`)]));
      await create(PlanViewComponent);
      element().style.height = "300px";
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-reply-history-row .nol-markdown-view").length).toBeGreaterThan(0), MarkdownWait.coldImport);
      const scroller = element().querySelector(".nol-virtual-list-viewport") as HTMLElement;
      const inner = (): DOMRect => {
        const box = scroller.getBoundingClientRect();
        return new DOMRect(box.left + scroller.clientLeft, box.top + scroller.clientTop, scroller.clientWidth, scroller.clientHeight);
      };
      const message = (id: string): DOMRect | undefined => [...element().querySelectorAll("nol-teamrun-reply-history-row")]
        .find(t => t.querySelector(".nol-markdown-view")?.textContent?.includes(`Plan ${id.slice(1)}`))?.querySelector("nol-message")?.getBoundingClientRect();

      store.focusPlan(replies[4] as Message);
      await Wait.until(() => expect(message("r5")).toBeDefined());
      await settle();
      expect(Math.abs((message("r5") as DOMRect).top - inner().top - AppearanceFixture.measureLook("space-2"))).toBeLessThanOrEqual(0.5);

      scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      scroller.scrollTop = scroller.scrollHeight;
      await Wait.until(() => expect(message("r8")).toBeDefined());
      await settle();
      expect(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight).toBeLessThan(1);
      expect(Math.abs(inner().bottom - (message("r8") as DOMRect).bottom - AppearanceFixture.measureLook("space-2") - AppearanceFixture.measureLook("view-padding-block")))
        .toBeLessThanOrEqual(0.5);
    });

    it("sets the Plans view's empty text, Loading and a failed page inside the view padding, as the dock padded them", async () => {
      const inline = AppearanceFixture.measureLook("content-padding-inline");
      const block = AppearanceFixture.measureLook("view-padding-block");
      const space = AppearanceFixture.measureLook("space-2");
      const pane = (): DOMRect => (element().querySelector("nol-teamrun-reply-history") as HTMLElement).getBoundingClientRect();
      const box = (selector: string): DOMRect => (element().querySelector(selector) as HTMLElement).getBoundingClientRect();
      const again = async (): Promise<void> => {
        ChatStoreService.release(context);
        TestBed.resetTestingModule();
        await create(PlanViewComponent, false);
        element().style.height = "300px";
      };

      replies = [];
      await create(PlanViewComponent);
      element().style.height = "300px";
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-empty")).not.toBeNull());
      AppearanceFixture.expectPixels(box(".nol-teamrun-reply-empty").left - pane().left, inline);
      AppearanceFixture.expectPixels(pane().right - box(".nol-teamrun-reply-empty").right, inline);
      AppearanceFixture.expectPixels(box(".nol-teamrun-reply-empty").top - pane().top, block);

      await again();
      context.answer(MethodName.MessagePlanPage, () => new Promise<JsonValue>(() => undefined));
      void store.conversationInView(SampleData.conversation.id);
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-loading")).not.toBeNull());
      AppearanceFixture.expectPixels(box(".nol-teamrun-reply-loading").left - pane().left, inline + space);
      AppearanceFixture.expectPixels(pane().bottom - box(".nol-teamrun-reply-loading").bottom, block + space);

      await again();
      context.fail(MethodName.MessagePlanPage, "The runtime is busy.");
      await store.conversationInView(SampleData.conversation.id);
      await settle();
      AppearanceFixture.expectPixels(box(".nol-teamrun-reply-failure").left - pane().left, inline);
      AppearanceFixture.expectPixels(pane().right - box(".nol-teamrun-reply-failure").right, inline);
      AppearanceFixture.expectPixels(pane().bottom - box(".nol-teamrun-reply-failure").bottom, block);
    });

    it("sets Loading on the raised background with a medium radius", async () => {
      await create(ActivityViewComponent, false);
      context.answer(MethodName.MessageActivityPage, () => new Promise<JsonValue>(() => undefined));
      void store.conversationInView(SampleData.conversation.id);
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-loading")).not.toBeNull());
      const badge = getComputedStyle(element().querySelector(".nol-teamrun-reply-loading") as HTMLElement);

      AppearanceFixture.expectPixels(Number.parseFloat(badge.borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      if (forcedColors !== "active")
        expect(badge.backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"));
    });
  });

  const panels = [
    { view: ActivityViewComponent, name: "activity", shown: (): void => expect(headers()).toHaveLength(3) },
    { view: ChangesViewComponent, name: "changes", shown: (): void => expect(element().querySelector("nol-teamrun-edited-files button.name")).not.toBeNull() },
    { view: PlanViewComponent, name: "plan", shown: (): void => expect(element().querySelector("nol-teamrun-plan-card")?.textContent).toContain("Write the fix") }
  ];

  describe("under forced colours and at 200% zoom", () => {
    beforeEach(() => {
      replies.push(reply("r4", 7, [checklist(0, "Read the code", "Write the fix")]));
    });

    it.each(panels)("keeps every control, state and focus ring in the $name view visible under forced colours, once its rows show", async ({ view, shown }) => {
      await create(view);
      await Wait.until(shown, MarkdownWait.coldImport);
      expect(await AccessibilityFixture.expectVisibleForcedAsync(element())).toBeGreaterThan(0);
    });

    it.each(panels)("neither cuts, crosses nor loses a control in the $name view at 200% zoom, once its rows show", async ({ view, shown }) => {
      await create(view);
      await Wait.until(shown, MarkdownWait.coldImport);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    beforeEach(() => {
      replies.push(reply("r4", 7, [checklist(0, "Read the code", "Write the fix")]));
    });

    it.each(panels)("reaches every control in the $name view by keyboard, with a visible ring, once its rows show", async ({ view, shown }) => {
      await create(view);
      await Wait.until(shown, MarkdownWait.coldImport);
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it.each(panels)("names every control, dialog, list and image in the $name view, once its rows show", async ({ view, shown }) => {
      await create(view);
      await Wait.until(shown, MarkdownWait.coldImport);
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
