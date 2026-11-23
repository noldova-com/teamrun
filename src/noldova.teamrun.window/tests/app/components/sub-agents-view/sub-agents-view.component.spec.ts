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
  AbilityCell,
  BackgroundTask,
  BackgroundTaskIdParams,
  BackgroundTaskStatus,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessagePageParams,
  MessageStatus,
  MethodName,
  ProviderAbility,
  ProviderKind,
  ProviderModel,
  ReplyPage,
  ReplyPanel,
  ReplySummary,
  SubAgent,
  SubAgentStatus
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { BackgroundTasksViewComponent } from "../../../../src/app/components/background-tasks-view/background-tasks-view.component";
import { SubAgentsViewComponent } from "../../../../src/app/components/sub-agents-view/sub-agents-view.component";
import { MessageFocus } from "../../../../src/app/models/message-focus";
import { TeammateColor } from "../../../../src/app/models/teammate-color";
import { BackgroundTaskStoreService } from "../../../../src/app/services/background-task-store.service";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("SubAgentsViewComponent", () => {
  const now = Date.parse(SampleData.timestamp);
  const at = (seconds: number): string => new Date(now + seconds * 1000).toISOString();
  const agent = (sequence: number, started: number, value: SubAgent, parentSequence: number | null = null): MessageDetail =>
    new MessageDetail(sequence, DetailKind.SubAgent, value.description, value.toJson(), at(started), parentSequence);
  const reply = (id: string, sequence: number, status: MessageStatus, details: readonly MessageDetail[], teammateId: string | null = null,
    teammateName: string | null = null): Message => new Message(id, SampleData.conversation.id, sequence, MessageAuthor.Provider, null, status, details,
    SampleData.provenance, SampleData.timestamp, SampleData.timestamp, status === MessageStatus.Running ? null : SampleData.timestamp, [], teammateId, teammateName);
  const finding = new SubAgent("t1", "Explore", "Find where plans are stored", "Haiku 5.5", SubAgentStatus.Running, false, 14, 38200);
  const checking = new SubAgent("t2", null, "Check the release workflow's inputs", "grok-code", SubAgentStatus.Running, true, 1);
  const drafting = new SubAgent("t3", null, "Draft the release notes", null, SubAgentStatus.Stopped, false, null, null, 9000);
  const reviewing = new SubAgent("t4", "Explore", "Review the composer's focus code", "gpt-5.5-codex", SubAgentStatus.Completed, false, 21, 61000, 123000,
    "Refresh models keeps focus through setActiveMenuItem; no other item takes it first. Two specs cover the arrow keys.");
  const failing = new SubAgent("t5", "general-purpose", "Run the Window suite on Linux", null, SubAgentStatus.Failed, false, null, null, 48000, "It failed.");
  const nested = new SubAgent("t6", "Explore", "Read the nested part", null, SubAgentStatus.Running, false);

  let clock: FakeClock;
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<SubAgentsViewComponent>;
  let store: ChatStoreService;
  let replies: Message[];
  let tasks: BackgroundTask[];
  let kinds: ProviderKind[];

  const page = (parameters: JsonValue, size: number): ReplyPage => {
    const params = MessagePageParams.fromJson(parameters);
    const matching = replies.map(t => ReplySummary.fromMessage(t)).filter(t => t.matches(ReplyPanel.SubAgents)).toSorted((a, b) => b.preview.sequence - a.preview.sequence)
      .filter(t => Object.isNull(params.beforeSequence) || t.preview.sequence < params.beforeSequence);
    return new ReplyPage(matching.slice(0, size), matching.length > size, false);
  };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string, within: ParentNode = element()): string[] => [...within.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const group = (index: number): HTMLElement => element().querySelectorAll<HTMLElement>(".sub-agents-group")[index] as HTMLElement;
  const card = (description: string): HTMLElement =>
    [...element().querySelectorAll<HTMLElement>(".sub-agent")].find(t => t.querySelector(".sub-agent-description")?.textContent?.trim() === description) as HTMLElement;
  const meta = (description: string): string[] => texts(".sub-agent-meta > span:not(.sub-agent-background)", card(description));
  const taskOf = (id: string, subAgentId: string | null, status: BackgroundTaskStatus = BackgroundTaskStatus.Running, command: string = finding.description): BackgroundTask =>
    new BackgroundTask(id, SampleData.conversation.id, "r3", "claude", command, status, null, SampleData.timestamp,
      status === BackgroundTaskStatus.Running ? null : SampleData.timestamp, String.empty, subAgentId);
  const codexRefusing = (reason: string): ProviderKind => new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.StopSubAgent]: AbilityCell.cannot(reason) }));
  const stopOf = (description: string): HTMLButtonElement | null => card(description).querySelector<HTMLButtonElement>(".sub-agent-stop");
  const shownStop = (description: string): HTMLButtonElement => {
    const found = stopOf(description);
    if (Object.isNull(found))
      throw new Error(`The card "${description}" shows no Stop.`);
    return found;
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (size: number = Resources.replyPageSize): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.MessageSubAgentsPage, t => page(t, size).toJson())
      .answer(MethodName.BackgroundTaskList, () => SampleData.tasks(tasks))
      .answer(MethodName.ProviderKindList, () => kinds.map(t => t.toJson()))
      .answer(MethodName.MessageSummary, t => {
        const found = replies.find(u => u.id === MessageIdParams.fromJson(t).messageId);
        return Object.isUndefined(found) ? null : ReplySummary.fromMessage(found).toJson();
      });
    clock = new FakeClock(now);
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClockService, useValue: clock }]
    });
    fixture = TestBed.createComponent(SubAgentsViewComponent);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.conversationInView(SampleData.conversation.id);
    await settle();
  };

  const fromEnd = (host: HTMLElement): number => host.scrollHeight - host.clientHeight - host.scrollTop;
  const createScrollingAsync = async (): Promise<HTMLElement> => {
    replies[0] = reply("r1", 1, MessageStatus.Completed,
      Array.from({ length: 20 }, (_, i) => agent(i, -400 + i, new SubAgent(`d${i}`, null, `Done ${i}`, null, SubAgentStatus.Completed, false))), "tm1", "Ada");
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(23));
    const host = element();
    host.style.height = "12rem";
    await settle();
    return host;
  };
  const startAsync = async (toolUseId: string, description: string, seconds: number): Promise<void> => {
    const details = [...replies.find(t => t.id === "r3")?.details ?? []];
    const detail = agent(details.length, seconds, new SubAgent(toolUseId, null, description, null, SubAgentStatus.Running, false));
    replies[2] = reply("r3", 5, MessageStatus.Running, [...details, detail]);
    context.emit(EventName.DetailUpdated, new DetailEventPayload("r3", detail).toJson());
    clock.advance(Resources.replyRefreshDelay);
    await Wait.until(() => expect(texts(".sub-agent-description").at(-1)).toBe(description));
    await settle();
  };

  beforeEach(() => {
    tasks = [];
    kinds = [SampleData.codex, SampleData.claude];
    replies = [
      reply("r1", 1, MessageStatus.Completed, [agent(0, -300, reviewing), agent(1, -290, nested, 0), agent(2, -250, failing)], "tm1", "Ada"),
      reply("r2", 3, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "No sub-agents here."),
        new MessageDetail(1, DetailKind.SubAgent, "Unreadable", { status: 5 }, at(-100))]),
      reply("r3", 5, MessageStatus.Running, [agent(0, -72, finding), agent(1, -24, checking), agent(2, -200, drafting)])
    ];
  });

  afterEach(() => {
    ChatStoreService.release(context);
  });

  it("lists the chat's sub-agents, finished ones first under Finished, then running ones under Running, each oldest first, and none a sub-agent started itself or one it can't read", async () => {
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));

    expect(texts(".sub-agents-heading")).toEqual([Resources.finishedTasksTitle, Resources.runningTasksTitle]);
    expect(texts(".sub-agent-description", group(0))).toEqual([reviewing.description, failing.description, drafting.description]);
    expect(texts(".sub-agent-description", group(1))).toEqual([finding.description, checking.description]);
    expect([...element().querySelectorAll(".sub-agents-group")].map(t => t.getAttribute("aria-labelledby")))
      .toEqual([...element().querySelectorAll(".sub-agents-heading")].map(t => t.id));
    expect([...element().querySelectorAll(".sub-agents-heading")].map(t => [t.getAttribute("role"), t.getAttribute("aria-level")])).toEqual([["heading", "3"], ["heading", "3"]]);
    expect(element().querySelector(".sub-agents-empty")).toBeNull();
  });

  it("shows each one's type, model, elapsed time, tools and tokens, Background, and Failed or, for a stopped one, Cancelled as the chat shows it, leaving out what its provider didn't report, and a finished one's summary", async () => {
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));

    expect(meta(finding.description)).toEqual(["Explore", "Haiku 5.5", "1m 12s", "14 tools", "38.2k tokens"]);
    expect(meta(checking.description)).toEqual(["grok-code", "24s", "1 tool"]);
    expect(texts(".sub-agent-background", card(checking.description))).toEqual([Resources.backgroundSubAgentLabel]);
    expect(texts(".sub-agent-background", card(finding.description))).toEqual([]);
    expect(meta(drafting.description)).toEqual(["9s", "Cancelled"]);
    expect(meta(failing.description)).toEqual(["general-purpose", "48s", "Failed"]);
    expect(meta(reviewing.description)).toEqual(["Explore", "gpt-5.5-codex", "2m 3s", "21 tools", "61k tokens"]);
    expect([finding, checking, drafting, reviewing, failing].map(t => texts(".sub-agent-summary", card(t.description))))
      .toEqual([[], [], [], [reviewing.summary], [failing.summary]]);
    expect([finding, checking].map(t => card(t.description).querySelector("nol-spinner.sub-agent-status") === null)).toEqual([false, false]);
    expect([drafting, reviewing, failing].map(t => card(t.description).querySelector(".sub-agent-glyph")?.textContent?.trim()))
      .toEqual(["block", "check_circle", "error"]);
  });

  it("names a sub-agent's model by the display name of its reply's provider's model list once that list is loaded", async () => {
    await create();
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5.5-codex", "GPT-5.5-Codex", "", [], true, null, true)]));
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
    const before = meta(reviewing.description)[1];

    await store.modelCatalogs.load("codex", "a1");

    await Wait.until(() => expect(meta(reviewing.description)[1]).toBe("GPT-5.5-Codex"));
    expect([before, meta(finding.description)[1]]).toEqual(["gpt-5.5-codex", "Haiku 5.5"]);
  });

  it("ticks a running one's elapsed time each second, and stops ticking once none runs", async () => {
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));

    expect(clock.intervals).toEqual([Resources.clockIntervalMilliseconds]);
    clock.advance(Resources.clockIntervalMilliseconds);
    await settle();
    expect(meta(finding.description)[2]).toBe("1m 13s");

    replies[2] = reply("r3", 5, MessageStatus.Completed, [agent(0, -72, finding.with({ status: SubAgentStatus.Completed, durationMs: 80000 })),
      agent(1, -24, checking.with({ status: SubAgentStatus.Completed, durationMs: 30000 })), agent(2, -200, drafting)]);
    context.emit(EventName.DetailUpdated, new DetailEventPayload("r3", replies[2].details[0] as MessageDetail).toJson());
    clock.advance(Resources.replyRefreshDelay);
    await Wait.until(() => expect(element().querySelectorAll(".sub-agents-group")).toHaveLength(1));

    expect(meta(finding.description)[2]).toBe("1m 20s");
    expect(clock.running).toBe(0);
  });

  it("reads every page of the chat, so finished ones stay for the whole chat", async () => {
    await create(1);

    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
    expect(context.requests.filter(t => t.method === Resources.formatQualifiedName(MethodName.MessageSubAgentsPage))).toHaveLength(3);
  });

  it("follows its end as sub-agents start, with the newest last and inside the view, and stays where the person scrolled up to", async () => {
    const host = await createScrollingAsync();
    expect(host.scrollHeight).toBeGreaterThan(host.clientHeight);

    await startAsync("n1", "Write the changelog", 0);
    expect(fromEnd(host)).toBeLessThan(1);
    expect(card("Write the changelog").getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom + 1);

    host.scrollTop = 0;
    await settle();
    await startAsync("n2", "Check the links", 1);
    expect(host.scrollTop).toBe(0);
  });

  it("opens another chat's sub-agents at their end, with its newest last and inside the view, though the person scrolled up in the chat before", async () => {
    const elsewhere = Array.from({ length: 25 }, (_, i) => new Message(`e${i}`, "c2", i * 2 + 1, MessageAuthor.Provider, null, MessageStatus.Completed,
      [agent(0, -100 + i, new SubAgent(`e${i}`, null, `Elsewhere ${i}`, null, SubAgentStatus.Completed, false))], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, SampleData.timestamp, [], null, null));
    const host = await createScrollingAsync();
    await startAsync("n1", "Write the changelog", 0);
    host.scrollTop = 0;
    await settle();
    context.answer(MethodName.MessageSubAgentsPage, t => (MessagePageParams.fromJson(t).chatId === "c2"
      ? new ReplyPage(elsewhere.map(u => ReplySummary.fromMessage(u)).toSorted((a, b) => b.preview.sequence - a.preview.sequence), false, false)
      : page(t, Resources.replyPageSize)).toJson());

    await store.conversationInView("c2");
    store.conversationOutOfView(SampleData.conversation.id);
    await Wait.until(() => expect(texts(".sub-agent-description").at(-1)).toBe("Elsewhere 24"));
    await settle();

    expect(fromEnd(host)).toBeLessThan(1);
    expect(card("Elsewhere 24").getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom + 1);
  });

  it("keeps the person's place while its view is out of the page, as when its dock collapses, and doesn't follow sub-agents that started meanwhile", async () => {
    const host = await createScrollingAsync();
    await startAsync("n1", "Write the changelog", 0);
    host.scrollTop = 0;
    await settle();
    const parent = host.parentElement;

    host.remove();
    await startAsync("n2", "Check the links", 1);
    parent?.append(host);
    await settle();
    await startAsync("n3", "Tag the release", 2);

    expect([host.isConnected, host.scrollTop]).toEqual([true, 0]);
  });

  it.each([
    { cause: "the runtime asks for a resync", resync: (): void => context.emit(EventName.StateResyncRequested, null) },
    { cause: "the window reconnects", resync: (): void => void store.resync() }
  ])("reads the chat's pages again after $cause, so the sub-agents a restart stopped leave the Running group", async ({ resync }) => {
    await create();
    await Wait.until(() => expect(texts(".sub-agents-heading")).toEqual([Resources.finishedTasksTitle, Resources.runningTasksTitle]));
    const pages = (): number => context.requests.filter(t => t.method === Resources.formatQualifiedName(MethodName.MessageSubAgentsPage)).length;
    const read = pages();
    replies[2] = reply("r3", 5, MessageStatus.Completed, [agent(0, -72, finding.with({ status: SubAgentStatus.Stopped })),
      agent(1, -24, checking.with({ status: SubAgentStatus.Stopped })), agent(2, -200, drafting)]);

    resync();

    await Wait.until(() => expect(texts(".sub-agents-heading")).toEqual([Resources.finishedTasksTitle]));
    expect(texts(".sub-agent-description")).toEqual([reviewing.description, failing.description, drafting.description, finding.description,
      checking.description]);
    expect(pages()).toBeGreaterThan(read);
  });

  it("says when the chat has no sub-agents", async () => {
    replies = [replies[1] as Message];
    await create();

    await Wait.until(() => expect(texts(".sub-agents-empty")).toEqual([Resources.noSubAgentsText]));
    expect(element().querySelectorAll(".sub-agents-group")).toHaveLength(0);
  });

  it("shows a sub-agent's reply with its teammate's mark, and a Default reply's with the Default's letter, as the chat does", async () => {
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
    const mark = card(reviewing.description).querySelector("nol-avatar") as HTMLElement;

    const plain = card(finding.description).querySelector("nol-avatar") as HTMLElement;

    expect([mark.textContent?.trim(), mark.getAttribute("aria-hidden"), mark.classList.contains("nol-avatar-small")]).toEqual(["A", "true", true]);
    expect(plain.textContent?.trim()).toBe("D");
    expect(TeammateColor.of("tm1")).not.toBeNull();
    expect(mark.style.getPropertyValue("--nol-avatar-fill")).not.toBe(plain.style.getPropertyValue("--nol-avatar-fill"));
  });

  it("selects a clicked one, asks the chat to show its reply and open its row, offers Open transcript only on it, and asks again from there", async () => {
    await create();
    await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
    const shown: (MessageFocus | null)[] = [];
    const show = store.showSubAgent.bind(store);
    vi.spyOn(store, "showSubAgent").mockImplementation(t => {
      shown.push(t);
      show(t);
    });

    await userEvent.click(card(finding.description).querySelector(".sub-agent-meta") as HTMLElement);
    await settle();

    const focus = store.subAgentFocus();
    expect([focus?.conversationId, focus?.messageId, focus?.sequence, focus?.isPlan, focus?.step]).toEqual([SampleData.conversation.id, "r3", 5, false, 0]);
    expect(store.focus()).toBe(focus);
    expect([...element().querySelectorAll(".sub-agent-selected .sub-agent-description")].map(t => t.textContent?.trim())).toEqual([finding.description]);
    expect(card(finding.description).querySelector(".sub-agent-description")?.getAttribute("aria-current")).toBe("true");
    expect(texts(".sub-agent-open")).toEqual([Resources.openTranscriptLabel]);
    expect(card(finding.description).contains(element().querySelector(".sub-agent-open"))).toBe(true);

    store.focusMessage(null);
    (element().querySelector(".sub-agent-open") as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(shown).toHaveLength(2);
    expect(store.focus()).toBe(shown[1]);

    (card(checking.description).querySelector(".sub-agent-description") as HTMLButtonElement).focus();
    await userEvent.keyboard(" ");
    await settle();
    expect(store.subAgentFocus()?.step).toBe(1);
    expect([...element().querySelectorAll(".sub-agent-selected .sub-agent-description")].map(t => t.textContent?.trim())).toEqual([checking.description]);

    store.clearSubAgentFocus();
    await settle();
    expect([element().querySelectorAll(".sub-agent-selected"), element().querySelectorAll(".sub-agent-open")].map(t => t.length)).toEqual([0, 0]);
  });

  it("offers Stop only on a running sub-agent whose provider can stop it, and stops it without selecting it", async () => {
    tasks = [taskOf("task-1", finding.toolUseId), taskOf("task-2", checking.toolUseId, BackgroundTaskStatus.Stopped), taskOf("task-3", null, BackgroundTaskStatus.Running, "npm run dev")];
    const stopping = new DeferredResponse();
    await create();
    context.answer(MethodName.BackgroundTaskStop, () => stopping.promise);
    await Wait.until(() => expect(stopOf(finding.description)).not.toBeNull());

    expect([stopOf(checking.description), stopOf(drafting.description), element().querySelectorAll(".sub-agent-stop").length]).toEqual([null, null, 1]);
    expect([stopOf(finding.description)?.getAttribute("aria-label"), stopOf(finding.description)?.disabled])
      .toEqual([Resources.formatStopSubAgent(finding.description), false]);
    await userEvent.click(stopOf(finding.description) as HTMLButtonElement);
    await settle();

    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.BackgroundTaskStop))
      .map(t => BackgroundTaskIdParams.fromJson(t.parameters).taskId)).toEqual(["task-1"]);
    expect([stopOf(finding.description)?.disabled, store.subAgentFocus()]).toEqual([true, null]);
    stopping.resolve(taskOf("task-1", finding.toolUseId, BackgroundTaskStatus.Stopped).toJson());
    await Wait.until(() => expect(stopOf(finding.description)).toBeNull());
  });

  it("shows Stop disabled with the row's reason when its reply's provider can't stop one sub-agent, and stops nothing", async () => {
    kinds = [codexRefusing("nothing ends what a sub-agent runs in its sandbox; the reply's Stop interrupts it"), SampleData.claude];
    tasks = [taskOf("task-1", finding.toolUseId)];
    await create();
    await Wait.until(() => expect(stopOf(finding.description)).not.toBeNull());
    const stop = shownStop(finding.description);

    expect([stop.getAttribute("aria-disabled"), stop.disabled, stop.getAttribute("aria-label")]).toEqual(["true", false, Resources.formatStopSubAgent(finding.description)]);
    await userEvent.hover(stop);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe("Codex can't stop one sub-agent: nothing ends what a sub-agent runs in its sandbox; the reply's Stop interrupts it."));
    stop.click();
    await settle();

    expect([context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.BackgroundTaskStop)).length, store.subAgentFocus()]).toEqual([0, null]);
    await userEvent.unhover(stop);
  });

  it("keeps Stop working on TeamRun's own helper under a reply whose provider can't stop one sub-agent, and stops it", async () => {
    const helper = new SubAgent("sub-1", "Helper", "Check the tests", null, SubAgentStatus.Running, true, null, null, null, null, true);
    const details = replies.find(t => t.id === "r3")?.details ?? [];
    replies[2] = reply("r3", 5, MessageStatus.Running, [...details, agent(details.length, 30, helper)]);
    kinds = [codexRefusing("it offers no way to stop one"), SampleData.claude];
    tasks = [taskOf("task-1", finding.toolUseId), taskOf("task-9", helper.toolUseId, BackgroundTaskStatus.Running, helper.description)];
    await create();
    context.answer(MethodName.BackgroundTaskStop, () => taskOf("task-9", helper.toolUseId, BackgroundTaskStatus.Stopped, helper.description).toJson());
    await Wait.until(() => expect(stopOf(helper.description)).not.toBeNull());
    const stop = shownStop(helper.description);

    expect([shownStop(finding.description).getAttribute("aria-disabled"), stop.getAttribute("aria-disabled"), stop.disabled]).toEqual(["true", null, false]);
    await userEvent.hover(stop);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe(Resources.stopSubAgentLabel));
    await userEvent.click(stop);
    await settle();

    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.BackgroundTaskStop))
      .map(t => BackgroundTaskIdParams.fromJson(t.parameters).taskId)).toEqual(["task-9"]);
    await userEvent.unhover(card(helper.description));
  });

  it("says under its card why a stop failed, and offers Stop again", async () => {
    tasks = [taskOf("task-1", finding.toolUseId)];
    await create();
    context.fail(MethodName.BackgroundTaskStop, "The provider refused.");
    await Wait.until(() => expect(stopOf(finding.description)).not.toBeNull());

    await userEvent.click(stopOf(finding.description) as HTMLButtonElement);
    await Wait.until(() => expect(texts(".sub-agent-error", card(finding.description))).toEqual(["The provider refused."]));

    expect([card(finding.description).querySelector(".sub-agent-error")?.getAttribute("role"), stopOf(finding.description)?.disabled]).toEqual(["alert", false]);
    expect(element().querySelectorAll(".sub-agent-error")).toHaveLength(1);
  });

  it("leaves a sub-agent's task out of Background tasks and its reply's running-tasks count, while Sub-agents offers its Stop", async () => {
    tasks = [taskOf("task-1", finding.toolUseId), taskOf("task-3", null, BackgroundTaskStatus.Running, "npm run dev")];
    await create();
    const background = TestBed.createComponent(BackgroundTasksViewComponent);
    background.autoDetectChanges();
    const listed = (): (string | null)[] => [...(background.nativeElement as HTMLElement).querySelectorAll("[data-nol-teamrun-task]")].map(t => t.getAttribute("data-nol-teamrun-task"));

    await Wait.until(() => expect(listed()).toEqual(["task-3"]));
    await Wait.until(() => expect(stopOf(finding.description)).not.toBeNull());

    expect(BackgroundTaskStoreService.of(context).runningCountOf(SampleData.conversation.id, "r3")).toBe(1);
    expect(BackgroundTaskStoreService.of(context).tasksOf(SampleData.conversation.id).map(t => t.id)).toEqual(["task-1", "task-3"]);
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

    it("fills the pane with its scrolling area, sets the cards 0.5rem apart inside the view padding, each padded 0.5rem, its details under the teammate mark, and the selected one on the raised background with large corners", async () => {
      await create();
      await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
      store.showSubAgent(new MessageFocus(SampleData.conversation.id, "r1", 1, false, 0));
      await settle();
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const style = (target: Element | null | undefined): CSSStyleDeclaration => getComputedStyle(target as Element);
      const space1 = AppearanceFixture.measureLook("space-1");
      const space2 = AppearanceFixture.measureLook("space-2");
      const view = rect(element());
      const [first, second] = [...group(1).querySelectorAll(".sub-agent")];
      const selected = card(reviewing.description);
      const top = selected.querySelector(".sub-agent-top");
      const status = selected.querySelector(".sub-agent-status");
      const mark = selected.querySelector("nol-avatar");
      const description = selected.querySelector(".sub-agent-description");
      const details = selected.querySelector(".sub-agent-meta");
      const summary = selected.querySelector(".sub-agent-summary");
      const open = selected.querySelector(".sub-agent-open");

      const inset = AppearanceFixture.measureLook("content-padding-inline");
      expect([style(element()).overflowY, inset > 0]).toEqual(["auto", true]);
      AppearanceFixture.expectPixels(rect(group(0).querySelector(".sub-agents-heading")).top - view.top, AppearanceFixture.measureLook("view-padding-block"));
      AppearanceFixture.expectPixels(rect(first).left - view.left, inset);
      AppearanceFixture.expectPixels(view.left + element().clientLeft + element().clientWidth - rect(first).right, inset);
      AppearanceFixture.expectPixels(rect(second).top - rect(first).bottom, space2);
      AppearanceFixture.expectPixels(rect(group(1)).top - rect(group(0)).bottom, space2 + AppearanceFixture.measureLook("space-4"));
      expect(rect(group(1).querySelector(".sub-agents-heading")).top - rect(group(0).querySelector(".sub-agent:last-child")?.lastElementChild).bottom)
        .toBeGreaterThan(rect(second?.querySelector(".sub-agent-top")).top - rect(first?.lastElementChild).bottom);
      AppearanceFixture.expectPixels(rect(top).left - rect(selected).left, space2);
      AppearanceFixture.expectPixels(rect(top).top - rect(selected).top, space2);
      AppearanceFixture.expectPixels(rect(selected).bottom - rect(open).bottom, space2);
      AppearanceFixture.expectPixels(rect(details).top - rect(top).bottom, space1);
      AppearanceFixture.expectPixels(rect(mark).left - rect(status).right, space2);
      AppearanceFixture.expectPixels(rect(description).left - rect(mark).right, space2);
      AppearanceFixture.expectPixels(rect(status).width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(rect(mark).width, AppearanceFixture.measureLook("avatar-small"));
      for (const part of [details, summary, open])
        AppearanceFixture.expectPixels(rect(part).left, rect(mark).left);
      expect(rect(summary).height).toBeLessThanOrEqual(2 * AppearanceFixture.measureLook("line-label") + 0.5);
      expect([style(description).whiteSpace, style(description).textOverflow]).toEqual(["nowrap", "ellipsis"]);
      AppearanceFixture.expectPixels(Number.parseFloat(style(selected).borderTopLeftRadius), AppearanceFixture.measureLook("radius-large"));
      AppearanceFixture.expectPixels(Number.parseFloat(style(selected).borderBottomRightRadius), AppearanceFixture.measureLook("radius-large"));
      if (forcedColors === "active")
        expect([style(selected).outlineStyle, style(first).outlineStyle]).toEqual(["solid", "none"]);
      else {
        expect([style(selected).backgroundColor, style(first).backgroundColor])
          .toEqual([AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"), "rgba(0, 0, 0, 0)"]);
        expect(style(details).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
        expect(style(card(failing.description).querySelector(".sub-agent-glyph")).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "error"));
      }
    });

    it("puts a refused Stop where a working one sits, at the end of its top row centred on its description, dimmed as a disabled button, in GrayText under forced colours", async () => {
      kinds = [codexRefusing("it offers no way to stop one"), SampleData.claude];
      tasks = [taskOf("task-1", finding.toolUseId)];
      await create();
      await Wait.until(() => expect(stopOf(finding.description)?.getAttribute("aria-disabled")).toBe("true"));
      await settle();
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const space2 = AppearanceFixture.measureLook("space-2");
      const running = card(finding.description);
      const stop = shownStop(finding.description);
      const description = running.querySelector(".sub-agent-description");

      AppearanceFixture.expectPixels(rect(running).right - rect(stop).right, space2);
      AppearanceFixture.expectPixels(rect(stop).left - rect(description).right, space2);
      AppearanceFixture.expectPixels(rect(stop).top + rect(stop).height / 2, rect(description).top + rect(description).height / 2);
      expect(rect(stop).width).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("icon"));
      const probe = running.appendChild(document.createElement("span"));
      probe.style.color = "GrayText";
      expect(forcedColors === "none" ? getComputedStyle(stop.querySelector(":scope > .nol-icon-button-face") ?? stop).opacity : getComputedStyle(stop).color)
        .toBe(forcedColors === "none" ? "0.5" : getComputedStyle(probe).color);
      probe.remove();
    });

    it("puts a running card's Stop at the end of its top row inside the card's padding, centred on its description, and a failed stop's reason under its details", async () => {
      tasks = [taskOf("task-1", finding.toolUseId)];
      await create();
      context.fail(MethodName.BackgroundTaskStop, "The provider refused.");
      await Wait.until(() => expect(stopOf(finding.description)).not.toBeNull());
      await userEvent.click(stopOf(finding.description) as HTMLButtonElement);
      await Wait.until(() => expect(card(finding.description).querySelector(".sub-agent-error")).not.toBeNull());
      await settle();
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const space2 = AppearanceFixture.measureLook("space-2");
      const running = card(finding.description);
      const stop = stopOf(finding.description);
      const description = running.querySelector(".sub-agent-description");
      const mark = running.querySelector("nol-avatar");
      const details = running.querySelector(".sub-agent-meta");
      const error = running.querySelector(".sub-agent-error");

      AppearanceFixture.expectPixels(rect(running).right - rect(stop).right, space2);
      AppearanceFixture.expectPixels(rect(stop).left - rect(description).right, space2);
      AppearanceFixture.expectPixels(rect(stop).top + rect(stop).height / 2, rect(description).top + rect(description).height / 2);
      expect(rect(stop).width).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(rect(error).left, rect(mark).left);
      AppearanceFixture.expectPixels(rect(running).right - rect(error).right, space2);
      AppearanceFixture.expectPixels(rect(error).top - rect(details).bottom, AppearanceFixture.measureLook("space-1"));
      if (forcedColors === "none")
        expect(getComputedStyle(error as Element).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "error"));
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the sub-agents view visible under forced colours", async () => {
      await create();
      await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the sub-agents view at 200% zoom", async () => {
      await create();
      await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the sub-agents view by keyboard, with a visible ring", async () => {
      await create();
      await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the sub-agents view", async () => {
      await create();
      await Wait.until(() => expect(element().querySelectorAll(".sub-agent")).toHaveLength(5));
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
