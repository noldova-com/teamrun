/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusMonitor } from "@angular/cdk/a11y";
import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { JsonValue } from "@noldova/context.json";
import { NotificationSeverity } from "@noldova/desktop.protocol";
import { WindowPartTokens } from "@noldova/desktop.window";
import { HostAccount, HostChanges, HostItem, HostPerson, HostReference, HostSignIn, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import { GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import {
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  ApprovalStatus,
  AttachmentContent,
  AttachmentReadParams,
  BackgroundTask,
  BackgroundTaskStatus,
  ContextUsage,
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  ConversationRenameParams,
  ConversationRewindParams,
  ConversationRewindResult,
  DetailKind,
  ErrorCode,
  EventName,
  Harness,
  Message,
  LinkedPaths,
  MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessagePage,
  MessageSender,
  MessageSendResult,
  MessageStatus,
  MethodName,
  ObservedSettings,
  PlanStep,
  PlanStepStatus,
  Project,
  Provenance,
  ProviderKind,
  ProviderModel,
  QuestionAnswer,
  QuestionOption,
  ReplyAction,
  ReplyPlan,
  ReplyUsage,
  RequestedSettings,
  SubAgent,
  SubAgentStatus,
  Teammate,
  TeammateMention,
  WrittenImageReadParams
} from "@noldova/teamrun.protocol";
import { TerminalRunBusy, TerminalRunEnd, TerminalRunNotTypedException, TerminalRunOutcome, TerminalShellKind } from "@noldova/terminal.window";
import { AvatarComponent, ClipboardWriter, DefaultTheme, LinkGesture, MessageComponent, ShellRun, ThemeMode } from "@noldova/ui.components.angular";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture, type ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeInlineTerminals, FakeRunStarter } from "../../../fixtures/fake-inline-terminals.fixture";
import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { ShownText } from "../../../fixtures/shown-text.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { SamplePages } from "../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../fixtures/wait.fixture";
import { HistoryMessageComponent } from "../../../../src/app/components/history-message/history-message.component";
import { TeammateAvatarComponent } from "../../../../src/app/components/teammate-avatar/teammate-avatar.component";
import { ChatAction } from "../../../../src/app/enums/chat-action";
import { ImageOpenMode } from "../../../../src/app/enums/image-open-mode";
import { StepCategory } from "../../../../src/app/enums/step-category";
import type { IRowReveal } from "../../../../src/app/interfaces/i-row-reveal";
import { ScrollReveal } from "../../../../src/app/models/scroll-reveal";
import { BackgroundTaskStoreService } from "../../../../src/app/services/background-task-store.service";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ChatTerminals } from "../../../../src/app/services/chat-terminals";
import { CommandTargetsService } from "../../../../src/app/services/command-targets.service";
import { GitHubReferenceSource } from "../../../../src/app/services/github-reference-source";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { InlineTerminals } from "../../../../src/app/services/inline-terminals";
import { MotionPreferenceService } from "../../../../src/app/services/motion-preference.service";
import { UsageFormatterService } from "../../../../src/app/services/usage-formatter.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { ChatPages } from "../../../../src/app/services/pages/chat-pages";
import { PagesClock } from "../../../../src/app/services/pages/pages-clock";
import { Resources } from "../../../../src/resources";

describe("HistoryMessageComponent", () => {
  const decidedAt = "2026-09-10T08:05:00.000Z";
  const detail = (sequence: number, kind: DetailKind, text: string, payload: Record<string, unknown> | null = null): MessageDetail =>
    new MessageDetail(sequence, kind, text, payload === null ? null : JSON.parse(JSON.stringify(payload)), SampleData.timestamp);
  const steps = [
    detail(0, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" }),
    detail(1, DetailKind.Text, "Here is **the** answer."),
    detail(2, DetailKind.FileChange, "Edit: D:\\other\\a.ts", { tool: "Edit", input: { file_path: "D:\\other\\a.ts", old_string: "a", new_string: "b" } }),
    detail(3, DetailKind.Note, "Generated image (completed): out.png", { itemType: "imageGeneration" }),
    detail(4, DetailKind.Text, "Done.")
  ];
  let context: FakeWindowPartContext;
  let clock: FakeClock;
  let shown: WritableSignal<boolean>;
  let fixture: ComponentFixture<HistoryMessageComponent>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const store = (): ChatStoreService => TestBed.inject(ChatStoreService);
  const render = (message: Message): void => {
    fixture = TestBed.createComponent(HistoryMessageComponent);
    fixture.componentRef.setInput("message", message);
    fixture.componentRef.setInput("labelId", "label-1");
    fixture.detectChanges();
  };
  const show = async (message: Message): Promise<void> => {
    fixture.componentRef.setInput("message", message);
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const frames = async (done: () => boolean): Promise<void> => {
    for (let frame = 0; frame < 600 && !done(); frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      fixture.detectChanges();
    }
  };
  const click = async (button: HTMLElement | null): Promise<void> => {
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const textOf = (selector: string): string | null => element().querySelector(selector)?.textContent?.trim() ?? null;
  const box = (selector: string): DOMRect => element().querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const middleOf = (rect: DOMRect): number => rect.top + rect.height / 2;
  const awaitingPlan = (approved: boolean = false): Message => new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed,
    [detail(0, DetailKind.Plan, "Tidy", new ReplyPlan([], null, "Tidy the cache first.", false, approved).toJson())],
    new Provenance("a1", SampleData.provenance.requested.withPlanFirst(true), SampleData.provenance.observed, "s1", false), SampleData.timestamp, SampleData.timestamp,
    SampleData.timestamp);
  const planningChat = async (planFirst: boolean = true, messages: readonly Message[] = [SampleData.userMessage, awaitingPlan()]): Promise<void> => {
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id
      ? [SampleData.conversation.withPlanFirst(planFirst).toJson()] : [])
      .answer(MethodName.MessagePage, () => SampleData.page(messages, false, false).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    await Wait.until(() => expect(store().messageIndexOf("c1").map(t => t.id)).toEqual(messages.map(t => t.id)));
  };
  const approveButton = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .approve");
  const cards = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-permission-card")];
  const awaiting = (): Message => SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, steps.slice(0, 3));
  const question = (): Approval => new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options,
    ApprovalStatus.Pending, null, SampleData.timestamp, null,
    [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false)]);
  const request = (id: string, messageId: string): Approval =>
    new Approval(id, messageId, ApprovalKind.Tool, "tool", "read a file", null, SampleData.approval.options, ApprovalStatus.Pending, null, SampleData.timestamp, null);
  const sentFrom = (chatId: string, details: readonly MessageDetail[] = [detail(0, DetailKind.Text, "What changed?")]): Message =>
    new Message("m9", "c2", 8, MessageAuthor.User, null, MessageStatus.Completed, details, null, SampleData.timestamp, null, SampleData.timestamp, [], null, null, [],
      new MessageSender(chatId, "t1", "Code Reviewer"));
  const measured = (status: MessageStatus, usage: ReplyUsage | null, kind: string = "codex"): Message =>
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", status, [detail(0, DetailKind.Text, "Done.")],
      new Provenance("a1", new RequestedSettings(kind, "gpt-5", "high"), new ObservedSettings(kind, "gpt-5", null, "1.0"), "s1", false, null, null, usage),
      SampleData.timestamp, SampleData.timestamp, status === MessageStatus.Running ? null : new Date(Date.parse(SampleData.timestamp) + 65_000).toISOString());
  const everyFigure = new ReplyUsage(260_000, 1_500, 0.0213, new ContextUsage(84_000, 200_000, null), 200_000, 10_000, 600);
  const statsSelector = ".nol-message-footer .stats-button";
  const panelSelector = ".cdk-overlay-container nol-teamrun-reply-stats";
  const statsButton = (): HTMLElement | null => element().querySelector<HTMLElement>(statsSelector);
  const panel = (): HTMLElement | null => document.querySelector<HTMLElement>(panelSelector);
  const footerEnd = (): string[] => [...element().querySelectorAll(".nol-message-footer-end > *")].map(t => t.classList.contains("stats-button") ? "stats" : t.className);
  const openStats = async (): Promise<HTMLElement> => {
    await click(statsButton());
    return Wait.until(() => one(panelSelector, document));
  };
  const statRows = (view: HTMLElement): string[][] => [...view.querySelectorAll(".stats-row")]
    .map(t => [t.classList.contains("part") ? "part" : "row", t.querySelector("dt")?.textContent?.trim() ?? "", t.querySelector("dd")?.textContent?.trim() ?? ""]);
  const planned = (...statuses: PlanStepStatus[]): MessageDetail => detail(1, DetailKind.Plan, "Plan", new ReplyPlan(statuses.map((t, i) =>
    new PlanStep(["Read the code", "Fix the bug", "Run the tests"][i]!, t, i === 1 ? "Fixing the bug" : null)), null).toJson());
  const planReply = (plan: MessageDetail): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running,
    [detail(0, DetailKind.Text, "Here's my plan."), plan, detail(2, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" }), detail(3, DetailKind.Text, "Done.")]);
  const openConversation = async (): Promise<void> => {
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    await Wait.until(() => expect(store().pendingApprovals()).toHaveLength(1));
  };

  beforeEach(() => {
    AppearanceFixture.apply();
    context = SampleData.createContext();
    clock = new FakeClock(Date.parse(SampleData.timestamp) + 12_000);
    shown = signal(true);
    TestBed.configureTestingModule({
      imports: [HistoryMessageComponent],
      providers: [
        { provide: WindowPartTokens.context, useValue: context },
        { provide: WindowPartTokens.shown, useValue: shown.asReadonly() },
        { provide: ClockService, useValue: clock },
        { provide: PagesClock, useValue: clock },
        ChatStoreService.provider,
        provideMarkdown(),
        provideCodeHighlighting()
      ]
    });
  });

  afterEach(() => {
    ImageViewerService.release(context);
    ChatPages.release(context);
    ChatStoreService.release(context);
    BackgroundTaskStoreService.release(context);
    AppearanceFixture.reset();
  });

  it("shows the person's message as markdown with its attachments, and opens its links through the window", async () => {
    render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the docs](https://example.com/docs).")], null,
      SampleData.timestamp, null, SampleData.timestamp, [new MessageAttachment("notes.txt", "text/plain", 2048, "D:/data/attachments/notes.txt")]));

    await Wait.until(() => expect(element().querySelector("a")).not.toBeNull(), MarkdownWait.coldImport);
    expect(element().querySelector(".nol-message-bubble")).not.toBeNull();
    expect(element().querySelector(".nol-message-author, .nol-message-avatar")).toBeNull();
    expect(element().querySelector("#label-1")).not.toBeNull();
    expect(textOf(".nol-message-attachment-name")).toBe("notes.txt");
    expect(element().querySelector(".activity-toggle, .activity-label")).toBeNull();
    await click(element().querySelector("a"));
    expect(context.links).toEqual(["https://example.com/docs"]);
  });

  it("opens a reply's link with how the person opened it, a click, Ctrl+click or a middle click, so the window places it by the Links settings", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the docs](https://example.com/docs).")]));
    await Wait.until(() => expect(element().querySelector("a.nol-markdown-link")).not.toBeNull(), MarkdownWait.coldImport);
    const link = element().querySelector<HTMLAnchorElement>("a.nol-markdown-link")!;

    link.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }));
    link.dispatchEvent(new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true, cancelable: true }));
    link.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));

    expect([context.links, context.linkGestures]).toEqual([Array(3).fill("https://example.com/docs"), [LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle]]);
  });

  it("shows the person's $ and $$ as typed, a shell command's included, and draws a reply's math", async () => {
    const typed = "Run kill $$ && echo $$, then echo $HOME$PATH.";
    render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, typed)], null, SampleData.timestamp, null,
      SampleData.timestamp));

    await Wait.until(() => expect(element().querySelector(".nol-message-bubble p")).not.toBeNull(), MarkdownWait.coldImport);
    expect([textOf(".nol-message-bubble p"), element().querySelectorAll(".nol-markdown-math").length]).toEqual([typed, 0]);

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "The area is $x^2$.")]));
    await Wait.until(() => expect(element().querySelector(".nol-markdown-math .katex")).not.toBeNull(), MarkdownWait.coldImport);
    expect(element().querySelectorAll(".nol-markdown-math")).toHaveLength(1);
  });

  it("shows a stored mention of a teammate it doesn't know as plain text, beside a current teammate's", async () => {
    new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "@Atlas and @Alice, look at this.")], null,
      SampleData.timestamp, null, SampleData.timestamp, [], null, null, [new TeammateMention("stress-chat-atlas", "Atlas"), new TeammateMention("alice", "Alice")]));

    await Wait.until(() => expect(element().querySelector(".nol-markdown-mention")).not.toBeNull(), MarkdownWait.coldImport);
    expect([...element().querySelectorAll(".nol-markdown-mention")].map(t => t.textContent?.trim())).toEqual(["@Alice"]);
    expect(element().querySelector(".nol-message-bubble")?.textContent).toContain("@Atlas and @Alice, look at this.");
  });

  it("marks a stored teammate's name with spaces as a mention, as it marks the others'", async () => {
    const data = new TeammateFixture(context);
    data.teammates.push(new Teammate("chat", "Chat GPT", null, "a1", Harness.Provider, null, null, "t", "t"));
    await Wait.until(() => expect(store().teammates()).toHaveLength(4));
    render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "@Chat GPT and @Alice, look at this.")], null,
      SampleData.timestamp, null, SampleData.timestamp, [], null, null, [new TeammateMention("chat", "Chat GPT"), new TeammateMention("alice", "Alice")]));

    await Wait.until(() => expect(element().querySelector(".nol-markdown-mention")).not.toBeNull(), MarkdownWait.coldImport);
    expect([...element().querySelectorAll(".nol-markdown-mention")].map(t => t.textContent?.trim())).toEqual(["@Chat GPT", "@Alice"]);
    expect(element().querySelector(".nol-message-bubble")?.textContent).toContain("@Chat GPT and @Alice, look at this.");
  });

  it.each([
    { shown: "a reply, only the name it hands off to", author: MessageAuthor.Provider, provenance: SampleData.provenance, sender: null, marked: ["@Bob"] },
    { shown: "a teammate's send, only the name it sends to", author: MessageAuthor.User, provenance: null, sender: new MessageSender("c2", "t1", "Code Reviewer"),
      marked: ["@Bob"] },
    { shown: "the person's message, a quoted name too", author: MessageAuthor.User, provenance: null, sender: null, marked: ["@Alice", "@Bob"] }
  ])("marks in $shown", async ({ author, provenance, sender, marked }) => {
    new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates().length).toBeGreaterThan(1));
    const text = "In her \"@Alice hi\" chat, run `@Alice` and ask @Bob please.";
    render(new Message("m5", "c1", 4, author, null, MessageStatus.Completed, [detail(0, DetailKind.Text, text)], provenance, SampleData.timestamp,
      Object.isNull(provenance) ? null : SampleData.timestamp, SampleData.timestamp, [], null, null, [], sender));

    await Wait.until(() => expect(element().querySelector(".nol-markdown-mention")).not.toBeNull(), MarkdownWait.coldImport);
    expect([...element().querySelectorAll(".nol-markdown-mention")].map(t => t.textContent?.trim())).toEqual(marked);
    expect(element().textContent).toContain("In her \"@Alice hi\" chat");
  });

  it.each([
    { shown: "the person's bubble with no name under it", author: MessageAuthor.User, provenance: null, column: ".nol-message-bubble .nol-message-content", caption: null },
    { shown: "a reply with its name under it", author: MessageAuthor.Provider, provenance: SampleData.provenance, column: ".nol-message-content", caption: "chart.png" }
  ].flatMap(t => [ThemeMode.Light, ThemeMode.Dark].map(mode => ({ ...t, mode }))))("shows each attached image in $shown, in $mode, at the column's width up to 24rem high, and keeps a chip for other files", async ({ author, provenance, column, caption, mode }) => {
    AppearanceFixture.apply(FixtureTheme.theme, mode);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const url = canvas.toDataURL("image/png");
    context.answer(MethodName.AttachmentShare, () => context.share(url));
    const attachments = [
      new MessageAttachment("chart.png", "image/png", 13_800, "D:/data/attachments/chart.png", 1200, 900),
      new MessageAttachment("notes.txt", "text/plain", 2048, "D:/data/attachments/notes.txt")
    ];
    render(new Message("m5", "c1", 4, author, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "See the chart.")], provenance, SampleData.timestamp,
      Object.isNull(provenance) ? null : SampleData.timestamp, SampleData.timestamp, attachments));

    await Wait.until(() => expect(element().querySelector(".nol-teamrun-image")).not.toBeNull());
    fixture.detectChanges();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const frame = box(".nol-teamrun-image-frame");
    const named = box(".nol-teamrun-image-caption");
    const area = box(column);
    expect([...element().querySelectorAll(".nol-message-attachment-name")].map(t => t.textContent?.trim())).toEqual(["notes.txt"]);
    expect(textOf(".nol-teamrun-image-caption")).toBe(caption);
    expect(box(".nol-teamrun-image-preview").bottom).toBeCloseTo(Object.isNull(caption) ? frame.bottom : named.bottom, 0);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.left).toBeGreaterThanOrEqual(area.left - 0.5);
    expect(frame.right).toBeLessThanOrEqual(area.right + 0.5);
    expect(frame.height).toBeLessThanOrEqual(24 * rem + 0.5);
    expect(Math.min(Math.abs(frame.height - 24 * rem), Math.abs(frame.width - box(".attached-images").width))).toBeLessThan(1);
    expect(frame.width / frame.height).toBeCloseTo(1200 / 900, 1);
    if (!Object.isNull(caption)) {
      expect(named.top).toBeGreaterThanOrEqual(frame.bottom - 0.5);
      expect(named.left).toBeCloseTo(frame.left, 0);
    }

    await click(element().querySelector<HTMLButtonElement>(".nol-teamrun-image-frame"));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("chart.png"));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());
  });

  it("sets narrow attached images side by side 0.25rem apart, wraps a wide one to its own row 1.5rem below, and names each in its tooltip", async () => {
    const sizes = new Map<string, [width: number, height: number]>([["tall.png", [120, 160]], ["small.png", [90, 120]], ["wide.png", [6000, 1000]]]);
    context.answer(MethodName.AttachmentShare, parameters => {
      const name = AttachmentReadParams.fromJson(parameters).path.slice("D:/data/attachments/".length);
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = sizes.get(name)!;
      return context.share(canvas.toDataURL("image/png"));
    });
    const attachments = [...sizes].map(([name, [width, height]]) => new MessageAttachment(name, "image/png", 1000, `D:/data/attachments/${name}`, width, height));
    const viewer = ImageViewerService.of(context, TestBed.inject(ImageViewerService.clipboard));
    const read = viewer.loadAsync.bind(viewer);
    const loads: Promise<HTMLImageElement | null>[] = [];
    let started: () => void = () => undefined;
    const allStarted = new Promise<void>(resolve => {
      started = () => resolve();
    });
    vi.spyOn(viewer, "loadAsync").mockImplementation(image => {
      const load = read(image);
      loads.push(load);
      if (loads.length === sizes.size)
        started();
      return load;
    });
    render(new Message("m6", "c1", 4, MessageAuthor.Provider, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Three images.")], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, attachments));

    await Wait.settled(allStarted.then(() => Promise.all(loads)), "The three attached images' loads");
    fixture.detectChanges();
    expect(element().querySelectorAll(".nol-teamrun-image")).toHaveLength(3);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const previews = [...element().querySelectorAll("nol-teamrun-image-preview")];
    const [tall, small, wide] = previews.map(t => t.getBoundingClientRect());
    const frames = [...element().querySelectorAll(".nol-teamrun-image-frame")].map(t => t.getBoundingClientRect());
    const area = box(".attached-images");
    expect(frames.slice(0, 2).map(t => `${Math.round(t.width)}x${Math.round(t.height)}`)).toEqual(["120x160", "90x120"]);
    expect((small!.left - tall!.right) / rem).toBeCloseTo(0.25, 1);
    expect(small!.bottom).toBeCloseTo(tall!.bottom, 0);
    expect(frames[1]!.bottom).toBeCloseTo(frames[0]!.bottom, 0);
    expect(tall!.left).toBeCloseTo(area.left, 0);
    expect((wide!.top - tall!.bottom) / rem).toBeCloseTo(1.5, 1);
    expect(wide!.left).toBeCloseTo(area.left, 0);
    expect(frames[2]!.width).toBeCloseTo(area.width, 0);

    await userEvent.hover(previews[1]!.querySelector(".nol-teamrun-image-frame")!);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe("small.png"));
    await userEvent.unhover(previews[1]!.querySelector(".nol-teamrun-image-frame")!);
  });

  it("puts a finished reply's line before its answer, closed until asked, opens its steps and the text between them as one block before the answer, and lists the files it edited", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps));
    const toggle = element().querySelector<HTMLButtonElement>(".activity-toggle");

    await Wait.until(() => expect(element().querySelector(".nol-markdown-view")?.textContent?.trim()).toBe("Done."), MarkdownWait.coldImport);
    await Wait.until(() => expect(textOf(".nol-message-author")).toBe("Codex · Work"));
    expect(textOf(".activity-toggle .activity-text")).toBe("Worked for 0s");
    expect(textOf(".activity-chevron")).toBe("chevron_right");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(element().querySelector("strong")).toBeNull();
    expect(box(".activity-chevron").left).toBeGreaterThanOrEqual(box(".activity-text").right);
    expect(Math.abs(middleOf(box(".activity-chevron")) - middleOf(box(".activity-text")))).toBeLessThanOrEqual(1);
    expect([element().querySelector(".cancel"), footerEnd()]).toEqual([null, ["stats"]]);
    expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
    expect(element().textContent).toContain("Done.");
    expect(element().textContent).not.toContain("Generated image");
    expect(textOf("nol-teamrun-edited-files .path")).toBe("D:\\other\\a.ts");
    expect(element().querySelector(".nol-message-status, .nol-chip")).toBeNull();

    await click(toggle);
    const blocks = element().querySelectorAll("nol-teamrun-activity-block");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(textOf(".activity-chevron")).toBe("expand_more");
    expect(blocks).toHaveLength(1);
    expect([...element().querySelectorAll("nol-teamrun-activity-block .nol-tool-call-title")].map(t => t.textContent)).toEqual(["> ls", "Edit: D:\\other\\a.ts"]);
    await Wait.until(() => expect(blocks[0]?.querySelector(".step-text strong")?.textContent).toBe("the"), MarkdownWait.coldImport);
    const answer = [...element().querySelectorAll(".nol-markdown-view")].at(-1)!;
    expect(answer.textContent?.trim()).toBe("Done.");
    expect((blocks[0]?.compareDocumentPosition(answer) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(((toggle?.compareDocumentPosition(blocks[0]!) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await click(toggle);
    expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
  });

  describe("the latest step under a collapsed Working line", () => {
    const line = (): HTMLElement | null => element().querySelector<HTMLElement>(".activity-step");
    const stepTitle = (): string | null => textOf(".activity-step-title");
    const glyph = (): string | null => textOf(".activity-step-glyph");
    const ls = detail(1, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" });
    const edit = detail(2, DetailKind.FileChange, "Edit: D:\\other\\a.ts", { tool: "Edit", input: { file_path: "D:\\other\\a.ts", old_string: "a", new_string: "b" } });
    const running = (...details: MessageDetail[]): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running, details);

    it("shows the step's icon and title in muted text while the turn runs, with no border, status or chevron", async () => {
      render(running(ls));

      expect([glyph(), stepTitle()]).toEqual([Resources.stepGlyphs[StepCategory.Command], "> ls"]);
      const style = getComputedStyle(one(".activity-step"));
      expect(style.color).toBe(getComputedStyle(one(".activity-text")).color);
      expect(style.borderTopWidth).toBe("0px");
      expect(one(".activity-step").querySelector("button, .activity-chevron, nol-chip")).toBeNull();
    });

    it("has no line before the first step, keeps the last step between two steps, and has none once the turn ends", async () => {
      render(running());
      expect(line()).toBeNull();
      expect(element().querySelector(".activity-line nol-spinner")).not.toBeNull();

      await show(running(ls));
      const shown = line();
      await frames(() => stepTitle() === "> ls");
      expect(stepTitle()).toBe("> ls");

      await show(running(ls, detail(2, DetailKind.Text, "Now the edit.")));
      expect([line(), stepTitle()]).toEqual([shown, "> ls"]);

      await show(running(ls, detail(2, DetailKind.Text, "Now the edit."), detail(3, DetailKind.Command, "> pwd", { tool: "Bash" })));
      await frames(() => stepTitle() === "> pwd");
      expect([line(), stepTitle()]).toEqual([shown, "> pwd"]);

      await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [ls]));
      expect(line()).toBeNull();
    });

    it("holds nothing in the chat list as the line appears on a reply wholly above the view, where the list keeps the rows in view itself", async () => {
      const held: Element[] = [];
      const rows: IRowReveal = { revealPart: () => undefined, holdPart: (_index, part) => held.push(part) };
      TestBed.configureTestingModule({ providers: [{ provide: ScrollReveal.rows, useValue: rows }] });
      render(running());
      const view = document.body.appendChild(document.createElement("div"));
      view.classList.add("nol-virtual-list-viewport");
      view.style.cssText = "height: 200px; overflow: auto";
      const below = document.createElement("div");
      below.style.height = "4000px";
      view.append(element(), below);
      view.scrollTop = element().getBoundingClientRect().bottom - view.getBoundingClientRect().top + 400;

      await show(running(ls));

      expect(line()?.getBoundingClientRect().bottom).toBeLessThan(view.getBoundingClientRect().top);
      expect(element().getBoundingClientRect().bottom).toBeLessThan(view.getBoundingClientRect().top);
      expect(held).toEqual([]);
      view.remove();
    });

    it("shows the newest of several running steps", async () => {
      render(running(detail(1, DetailKind.Command, "> first", { tool: "Bash", toolUseId: "t1" }), detail(2, DetailKind.Command, "> second", { tool: "Bash", toolUseId: "t2" }), edit));

      expect([glyph(), stepTitle()]).toEqual([Resources.stepGlyphs[StepCategory.Edit], "Edit: D:\\other\\a.ts"]);
    });

    it("names the newest step not yet ended while an older one runs, and the last step once all have ended", async () => {
      const build = detail(1, DetailKind.Command, "> build", { tool: "Bash", toolUseId: "t1" });
      const read = detail(2, DetailKind.Note, "Read: a", { tool: "Read", toolUseId: "t2" });
      const readDone = detail(3, DetailKind.Note, "text", { toolUseId: "t2", isError: false });
      render(running(build, read));
      expect(stepTitle()).toBe("Read: a");

      await show(running(build, read, readDone));
      expect([glyph(), stepTitle()]).toEqual([Resources.stepGlyphs[StepCategory.Command], "> build"]);

      await show(running(build, read, readDone, detail(4, DetailKind.Note, "done", { toolUseId: "t1", isError: false })));
      expect(stepTitle()).toBe("Read: a");
    });

    it("names a running sub-agent over a newer one that has ended", async () => {
      const agent = (sequence: number, name: string, status: SubAgentStatus): MessageDetail =>
        detail(sequence, DetailKind.SubAgent, name, new SubAgent(`t${sequence}`, null, name, null, status, false).toJson());
      render(running(agent(1, "Slow", SubAgentStatus.Running), agent(2, "Quick", SubAgentStatus.Running)));
      expect(stepTitle()).toBe("Quick");

      await show(running(agent(1, "Slow", SubAgentStatus.Running), agent(2, "Quick", SubAgentStatus.Completed)));
      expect(stepTitle()).toBe("Slow");
    });

    it("offers a cut title's whole text in a tooltip", async () => {
      const long = `> ${"a very long command ".repeat(60)}`.trimEnd();
      render(running(detail(1, DetailKind.Command, long, { tool: "Bash" })));
      const title = one(".activity-step-title");

      await userEvent.hover(title);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe(long));
      await userEvent.unhover(title);
    });

    it("titles a thought as the list does, by its latest sentence and with the list's word when it has none", async () => {
      render(running(detail(1, DetailKind.Reasoning, "First I looked.\n\nNow I weigh it. Then more.")));
      expect([glyph(), stepTitle()]).toEqual([Resources.stepGlyphs[StepCategory.Thought], "Now I weigh it."]);

      await show(running(detail(1, DetailKind.Reasoning, " ")));
      await frames(() => stepTitle() === Resources.thinkingLabel);
      expect(stepTitle()).toBe(Resources.thinkingLabel);
    });

    it("streams a new step's title in from its first letter a little each frame, the way the reply's text comes", async () => {
      const make = detail(2, DetailKind.Command, "> make all", { tool: "Bash" });
      render(running(ls));
      expect(stepTitle()).toBe("> ls");

      await show(running(ls, make));
      const seen = [stepTitle() ?? String.empty];
      await frames(() => {
        const title = stepTitle() ?? String.empty;
        if (title !== seen.at(-1))
          seen.push(title);
        return title === "> make all";
      });
      expect(seen[0]?.length).toBeLessThan("> make all".length);
      expect(seen.length).toBeGreaterThan(2);
      expect(seen.every((title, index) => "> make all".startsWith(title) && title.length > (index === 0 ? 0 : seen[index - 1]?.length ?? 0))).toBe(true);
      expect(seen.at(-1)).toBe("> make all");
    });

    it("shows whole a step it showed before when that step is the latest again, and every new step under reduced motion", async () => {
      const build = detail(1, DetailKind.Command, "> build", { tool: "Bash", toolUseId: "t1" });
      const read = detail(2, DetailKind.Note, "Read: a", { tool: "Read", toolUseId: "t2" });
      const readDone = detail(3, DetailKind.Note, "text", { toolUseId: "t2", isError: false });
      render(running());
      await show(running(build));
      await frames(() => stepTitle() === "> build");
      await show(running(build, read));
      await frames(() => stepTitle() === "Read: a");

      await show(running(build, read, readDone));
      expect(stepTitle()).toBe("> build");

      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
      try {
        await Wait.until(() => expect(TestBed.inject(MotionPreferenceService).reduced()).toBe(true));
        await show(running(build, read, readDone, detail(4, DetailKind.Command, "> make all", { tool: "Bash", toolUseId: "t4" })));
        expect(stepTitle()).toBe("> make all");
      }
      finally {
        await EmulatedMediaFixture.resetAsync();
      }
    });

    it("hides the line while the list is open and shows it again with the latest step when the list closes", async () => {
      render(running(ls));
      const toggle = element().querySelector<HTMLElement>(".activity-toggle");

      await click(toggle);
      expect(line()).toBeNull();
      expect(element().querySelector("nol-teamrun-activity-block .nol-tool-call-title")?.textContent).toBe("> ls");

      await show(running(ls, edit));
      expect(line()).toBeNull();

      await click(toggle);
      expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
      expect(stepTitle()).toBe("Edit: D:\\other\\a.ts");
    });

    it("sets the icon in the spinner's column, centred on it, and the title where the Working line's text starts, in rem", async () => {
      render(running(ls));
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const icon = box(".activity-step-glyph");
      const spinner = box(".activity-line nol-spinner");

      expect(icon.left).toBeCloseTo(spinner.left, 1);
      expect(icon.width).toBeCloseTo(spinner.width, 1);
      expect(icon.left + icon.width / 2).toBeCloseTo(spinner.left + spinner.width / 2, 1);
      expect(box(".activity-step-title").left).toBeCloseTo(box(".activity-text").left, 1);
      expect((box(".activity-step").top - box(".activity-line").bottom) / rem).toBeCloseTo(0.5, 2);
      expect(Math.abs(middleOf(icon) - middleOf(box(".activity-step-title")))).toBeLessThanOrEqual(1);
      expect(icon.width / rem).toBeCloseTo(1, 2);
    });

    it("keeps a long title on one line, cut with an ellipsis inside the reply, with the whole title still in the page", async () => {
      const long = `> ${"a very long command ".repeat(60)}`.trimEnd();
      render(running(detail(1, DetailKind.Command, long, { tool: "Bash" })));
      const title = one(".activity-step-title");

      expect(title.textContent).toBe(long);
      expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
      expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
      expect(box(".activity-step").height).toBeCloseTo(Number.parseFloat(getComputedStyle(title).lineHeight), 0);
      expect(box(".activity-step").right).toBeLessThanOrEqual(element().getBoundingClientRect().right + 0.5);
      expect(box(".activity-step-title").right).toBeLessThanOrEqual(box(".activity-step").right + 0.5);
    });
  });

  it("keeps a working reply's line, with its spinner, out of its footer, shows its time once, keeps its steps closed until asked and open after it ends, and runs its clock until it ends", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 1)));
    const expanded = (): string | null => element().querySelector(".activity-toggle")?.getAttribute("aria-expanded") ?? null;

    expect(textOf(".activity-toggle .activity-text")).toBe("Working for 12s");
    expect(expanded()).toBe("false");
    expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
    const times = (time: string): number => element().textContent!.split(time).length - 1;
    expect(element().querySelector(".nol-message-footer :is(.activity-toggle, .activity-label, nol-spinner)")).toBeNull();
    expect(element().querySelectorAll(".activity-line nol-spinner")).toHaveLength(1);
    expect(times("12s")).toBe(1);

    await click(element().querySelector(".activity-toggle"));
    expect(element().querySelectorAll("nol-teamrun-activity-block")).toHaveLength(1);
    clock.advance(2_000);
    fixture.detectChanges();
    expect(textOf(".activity-text")).toBe("Working for 14s");
    expect(times("14s")).toBe(1);
    expect(clock.running).toBe(1);
    expect(clock.intervals).toEqual([Resources.clockIntervalMilliseconds]);

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 1)));
    expect(textOf(".activity-text")).toBe("Worked for 0s");
    expect(element().querySelector("nol-spinner")).toBeNull();
    expect(expanded()).toBe("true");
    expect(element().querySelectorAll("nol-teamrun-activity-block")).toHaveLength(1);
    expect([element().querySelector(".cancel"), footerEnd()]).toEqual([null, ["stats"]]);
    expect(clock.running).toBe(0);
  });

  it("keeps the open steps as they are when the Sub-agents view asks again for a sub-agent the activity already shows", async () => {
    const agent = new SubAgent("ta", "Explore", "Find where plans are stored", "Haiku 5.5", SubAgentStatus.Completed, false, 2, 1200);
    const remembered = vi.spyOn(store(), "rememberMessageControls");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "Looking."),
      new MessageDetail(1, DetailKind.SubAgent, agent.description, agent.toJson(), SampleData.timestamp), detail(2, DetailKind.Text, "Done.")]));
    fixture.componentRef.setInput("revealsStep", 1);
    fixture.componentRef.setInput("flashStart", new Date());
    await fixture.whenStable();
    const controls = remembered.mock.lastCall![1];
    const open = controls.expansion.activity();

    fixture.componentRef.setInput("flashStart", new Date(Date.now() + 1000));
    await fixture.whenStable();

    expect([...open]).toEqual([1]);
    expect(controls.expansion.activity()).toBe(open);
  });

  it("streams a working reply's text above its footer's Stop, holding back an emphasis still open", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Checking the build **now")]));

    await Wait.until(() => expect((element().querySelector("nol-markdown-view") as HTMLElement).innerText.trim()).toBe("Checking the build"), MarkdownWait.coldImport);
    expect(box("nol-markdown-view").bottom).toBeLessThanOrEqual(box(".nol-message-footer .cancel").top);
  });

  for (const [pace, loadedFrame] of [["", 0], [", also when each frame takes 80 ms, as on a loaded runner", 80]] as const)
    it(`reveals a working reply's text at the streaming pace in the kit's bursts at least 48 ms apart, between batches six frames apart, never taking back what showed, and keeps its paragraphs' elements${pace}`, async () => {
      const words = Array.from({ length: 80 }, (_, index) => `word${index}`).join(" ");
      const first = "The first paragraph.";
      const reply = (length: number): Message =>
        SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, `${first}\n\n${words.slice(0, length)}`)]);
      const arrivedOf = (length: number): number => first.length + words.slice(0, length).trimEnd().length;
      const visibleOf = (node: Node): string => [...node.childNodes]
        .map(t => t instanceof Text ? t.data : t instanceof HTMLElement && !t.hidden ? visibleOf(t) : "").join("");
      const hides = (name: string, range: AbstractRange): boolean =>
        range.startContainer.parentElement !== null && getComputedStyle(range.startContainer.parentElement, `::highlight(${name})`).color === "rgba(0, 0, 0, 0)";
      const shownOf = (view: HTMLElement): number => visibleOf(view).length - [...CSS.highlights]
        .flatMap(([name, ranges]) => [...ranges].filter((t): t is Range => t instanceof Range && view.contains(t.startContainer) && hides(name, t)))
        .reduce((sum, t) => sum + t.toString().length, 0);
      render(reply(40));
      await Wait.until(() => expect(element().querySelectorAll("nol-markdown-view p")).toHaveLength(2), MarkdownWait.coldImport);
      const view = one("nol-markdown-view");
      const paragraphs = [...view.querySelectorAll("p")];
      const frames: [number, number, number | undefined][] = [];
      let rendered: number | undefined = arrivedOf(40);
      const sample = (time: number): void => {
        frames.push([time, shownOf(view), rendered]);
        while (performance.now() < time + loadedFrame)
          continue;
        frame = requestAnimationFrame(sample);
      };
      let frame = requestAnimationFrame(sample);

      try {
        await Wait.until(() => expect(frames.filter(t => t[1] === t[2]).length).toBeGreaterThanOrEqual(2), { timeout: 1_000 + 2 * loadedFrame });
        for (const length of [140, 240, 340]) {
          rendered = undefined;
          await show(reply(length));
          rendered = arrivedOf(length);
          const sampled = frames.length;
          await Wait.until(() => expect(frames.length).toBeGreaterThanOrEqual(sampled + 6), { timeout: 1_000 + 6 * loadedFrame });
        }
        await Wait.until(() => expect(frames.at(-1)?.[1]).toBe(frames.at(-1)?.[2]), { timeout: 5_000 });
      }
      finally {
        cancelAnimationFrame(frame);
      }

      const step = (left: number, elapsed: number): number => Math.min(left, Math.max(left * (1 - Math.exp(-elapsed / 250)), 40 * elapsed / 1_000));
      const burst = 48;
      const timeAt = (index: number): number => frames[index]?.[0] ?? 0;
      const shownAt = (index: number): number => frames[index]?.[1] ?? 0;
      const lastShowing = (index: number): number => frames.findLastIndex((t, at) => at > 0 && at < index && t[1] !== shownAt(at - 1));
      const lastArrival = (index: number): number => frames.findLastIndex((t, at) => at > 0 && at < index && t[2] !== frames[at - 1]?.[2]);
      const batchStart = (index: number): number => frames.findLastIndex((t, at) => at > 0 && at < index && t[2] !== frames[at - 1]?.[2] && frames[at - 1]?.[2] !== undefined);
      const sinceBase = (index: number, base: number): [number, number][] =>
        [[base, timeAt(index) - timeAt(base)], [base, timeAt(index - 1) - timeAt(base - 1)]];
      const sinceBursts = (index: number): [number, number][] => [lastShowing(index), lastArrival(index), lastArrival(index) + 1]
        .filter(t => t > 0 && t < index).flatMap(t => sinceBase(index, t));
      const steady = frames.flatMap(([time, shown, arrived], index) => {
        const before = frames[index - 1];
        if (index < 4 || arrived === undefined || frames.slice(index - 4, index).some(t => t[2] !== arrived) || before === undefined)
          return [];
        const fits = shown === before[1]
          ? shown === arrived || sinceBursts(index).some(([, elapsed]) => elapsed < burst)
          : sinceBursts(index).some(([base, elapsed]) => Math.abs(shown - shownAt(base) - step(arrived - shownAt(base), elapsed)) <= 1);
        return [[time - before[0], fits ? "fits" : `frame ${index} showed ${shown - before[1]} of ${arrived - before[1]} left`] as const];
      });
      const steadyTime = steady.reduce((sum, [elapsed]) => sum + elapsed, 0);
      const fast = frames.flatMap(([, shown, arrived], index) => {
        const before = frames[index - 1];
        const base = lastShowing(index) > 0 ? lastShowing(index) : batchStart(index);
        return index < 2 || base < 1 || before === undefined || arrived === undefined || shown === before[1]
          || sinceBase(index, base).some(([, elapsed]) => shown - shownAt(base) <= step(arrived - shownAt(base), elapsed) + 1) ? [] :
          [`frame ${index} showed ${shown - before[1]} of ${arrived - before[1]} left`];
      });
      const last = frames.findLastIndex(t => (t[2] ?? t[1]) - t[1] >= 6);
      const ended = frames.findIndex((t, index) => index > last && t[1] === t[2]);
      const changed = frames.findLastIndex((t, index) => index > 0 && index <= last && t[1] !== shownAt(index - 1));
      const start = changed > 0 ? changed : last;
      const [lastFrame, endedFrame] = [frames[last], frames[ended]];

      expect(frames.every((t, index) => index === 0 || t[1] >= (frames[index - 1]?.[1] ?? 0))).toBe(true);
      expect(steadyTime, `${steady.length} steady frames over ${Math.round(steadyTime)} ms`).toBeGreaterThan(1_000 / 3);
      expect(steady.map(([, t]) => t).filter(t => t !== "fits")).toEqual([]);
      expect(fast).toEqual([]);
      if (lastFrame === undefined || endedFrame === undefined)
        throw new Error(`The reply never showed all it had: ${frames.length} frames, the last with 6 or more characters left at ${last}, all shown at ${ended}.`);
      const left = (lastFrame[2] ?? lastFrame[1]) - lastFrame[1];
      const tails = [0, 1].map(t => (frames[ended - t]?.[0] ?? 0) - (frames[start - t]?.[0] ?? 0));
      const gap = Math.max(...frames.slice(start - 1, ended + 1).map((t, index, all) => index === 0 ? 0 : t[0] - (all[index - 1]?.[0] ?? 0)));
      expect(tails.filter(t => t >= (left - 1) * 25 - 5 && t <= left * 25 + gap + burst + 5), `${left} characters took ${tails.join(" or ")} ms`).not.toHaveLength(0);
      expect(view.querySelectorAll("p")[0]).toBe(paragraphs[0]);
      expect(view.querySelectorAll("p")[1]).toBe(paragraphs[1]);
      expect(view.querySelector("p:last-child")?.textContent).toBe(words.slice(0, 340).trimEnd());
    });

  it("leaves no block and no gap for a working reply's text that a background sub-agent's reply emptied, as if the reply never had it", async () => {
    const calls = [detail(1, DetailKind.Command, "> ls", { tool: "Bash" }), detail(3, DetailKind.Note, "read_agent", { tool: "read" })];
    const ends = [detail(0, DetailKind.Text, "Both sub-agents are running."), detail(4, DetailKind.Text, "Neither returned file contents.")];
    const measure = async (details: readonly MessageDetail[]): Promise<number[]> => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, details));
      await Wait.until(() => expect(element().textContent).toContain("Neither returned file contents."), MarkdownWait.coldImport);
      const host = element().getBoundingClientRect();
      return [host.height, ...[...element().querySelectorAll("nol-markdown-view")].map(t => t.getBoundingClientRect().top - host.top)];
    };

    const emptied = await measure([...ends.slice(0, 1), ...calls.slice(0, 1), detail(2, DetailKind.Text, ""), ...calls.slice(1), ...ends.slice(1)]);
    const without = await measure([...ends.slice(0, 1), ...calls, ...ends.slice(1)]);

    expect(emptied).toHaveLength(3);
    expect(without).toHaveLength(3);
    for (const [index, value] of emptied.entries())
      expect(Math.abs(value - (without[index] ?? Number.NaN))).toBeLessThan(0.5);
  });

  it("keeps a command in one row from its start to its end, and marks a non-zero exit failed with its code inside the open row", async () => {
    const command = (text: string, exitCode: number | null, status: string): MessageDetail =>
      detail(0, DetailKind.Command, text, { command: "npm test", cwd: "D:\\repo", exitCode, status });
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [command("$ npm test\n", null, "inProgress")]));
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(element().querySelectorAll(".nol-tool-call")).toHaveLength(1));
    expect(textOf(".nol-tool-call-status")).toBe("Running");

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [command("$ npm test\nFailed to create unified exec process\n(exit -1)", -1, "failed")]));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Failed"));
    const [card, header, error] = [box(".nol-tool-call"), box(".nol-tool-call-header"), box(".nol-tool-call-error")];

    expect(element().querySelectorAll(".calls > li")).toHaveLength(1);
    expect(textOf(".nol-tool-call-error > span:last-child")).toBe(Resources.formatExitCode(-1));
    expect(error.top).toBeGreaterThanOrEqual(header.bottom);
    expect(error.left).toBeGreaterThan(card.left);
    expect(error.right).toBeLessThan(card.right);
    expect(error.bottom).toBeLessThanOrEqual(card.bottom);
  });

  it("shows a command its reply's stop cut off as cancelled, not succeeded, with the status inside the step's header", async () => {
    const cut = [detail(0, DetailKind.Command, "$ npm test\n", { command: "npm test", cwd: "D:\\repo", exitCode: null, status: "inProgress" })];
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, cut));
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Running"));

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled, cut));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Cancelled"));
    const [header, state] = [box(".nol-tool-call-header"), box(".nol-tool-call-state")];

    expect(textOf(".nol-tool-call-status-glyph")).toBe("block");
    expect(state.left).toBeGreaterThanOrEqual(header.left);
    expect(state.right).toBeLessThanOrEqual(header.right);
    expect(Math.abs(state.top + state.height / 2 - (header.top + header.height / 2))).toBeLessThanOrEqual(1);
  });

  it("says a command waits for permission while its reply awaits approval, in the reply chip's words, then Running once allowed, and Failed once denied", async () => {
    const command = (status: string): MessageDetail => detail(0, DetailKind.Command, "$ npm test\n", { command: "npm test", cwd: "D:\\repo", exitCode: null, status });
    render(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [command("inProgress")]));
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Waiting for permission"));
    const [header, state] = [box(".nol-tool-call-header"), box(".nol-tool-call-state")];

    expect(textOf(".nol-tool-call-status-glyph")).toBe("pan_tool");
    expect(textOf(".nol-message-header .nol-chip")).toBe(textOf(".nol-tool-call-status"));
    expect(state.left).toBeGreaterThanOrEqual(header.left);
    expect(state.right).toBeLessThanOrEqual(header.right);
    expect(Math.abs(middleOf(state) - middleOf(header))).toBeLessThanOrEqual(1);

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [command("inProgress")]));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Running"));
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [command("failed")]));
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Failed"));
    expect(element().querySelectorAll(".calls > li")).toHaveLength(1);
  });

  it("shows a cancelled reply's stop as its status and not as a step, with steps and without", async () => {
    const cut = [detail(0, DetailKind.Command, "$ npm test\n", { command: "npm test", cwd: "D:\\repo", exitCode: null, status: "inProgress" }),
      detail(1, DetailKind.Note, "The reply was cancelled.")];
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled, cut));
    await Wait.until(() => expect(element().querySelector(".activity-toggle")).not.toBeNull());
    element().querySelector<HTMLButtonElement>(".activity-toggle")!.click();
    await Wait.until(() => expect(element().querySelectorAll(".calls > li")).toHaveLength(1));

    expect(textOf(".nol-message-header .nol-chip")).toBe("Cancelled");
    expect(textOf(".nol-tool-call-status")).toBe("Cancelled");
    expect(textOf("nol-teamrun-activity-block .summary")).toBe("Ran 1 command");
    expect(element().textContent).not.toContain("The reply was cancelled.");

    for (const note of ["The reply was cancelled.", "Cancelled before this participant started."]) {
      await show(SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled, [detail(0, DetailKind.Note, note)]));
      expect(textOf(".nol-message-header .nol-chip")).toBe("Cancelled");
      expect(element().querySelector(".activity-toggle")).toBeNull();
      expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
      expect(element().textContent).not.toContain(note);
    }
  });

  it("keeps in view the text a reply had written when it was stopped, interrupted or failed, with the steps after it still in Worked for", async () => {
    const cut = [detail(0, DetailKind.Reasoning, "Weighing the answer."), detail(1, DetailKind.Text, "Here is half an answer"),
      detail(2, DetailKind.Command, "$ npm test\n", { command: "npm test", cwd: "D:\\repo", exitCode: null, status: "inProgress" })];

    const failure = detail(3, DetailKind.Error, "The provider stopped answering.");
    const cases: readonly (readonly [MessageStatus, readonly MessageDetail[]])[] =
      [[MessageStatus.Cancelled, cut], [MessageStatus.Interrupted, cut], [MessageStatus.Failed, [...cut, failure]]];
    for (const [status, details] of cases) {
      render(SampleData.withStatus(SampleData.reply, status, details));
      await Wait.until(() => expect(textOf(".nol-markdown-view")).toBe("Here is half an answer"), MarkdownWait.coldImport);
      const toggle = element().querySelector<HTMLButtonElement>(".activity-toggle");
      const text = box(".nol-markdown-view");

      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      expect(text.height).toBeGreaterThan(0);
      expect(text.top).toBeGreaterThanOrEqual(box(".activity-toggle").bottom);
      expect(one(".nol-markdown-view").classList.contains("nol-message-interim")).toBe(false);
      await click(toggle);
      expect(textOf("nol-teamrun-activity-block")).not.toContain("half an answer");
      expect(element().textContent).toContain("Here is half an answer");
    }
  });

  it("stops a working reply's clock while its part is hidden, and shows the time it has worked once shown again", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 1)));
    expect(clock.running).toBe(1);

    shown.set(false);
    fixture.detectChanges();
    expect(clock.running).toBe(0);
    clock.advance(5_000);

    shown.set(true);
    fixture.detectChanges();
    expect(clock.running).toBe(1);
    expect(textOf(".activity-text")).toBe("Working for 17s");
    expect(element().textContent!.split("17s").length - 1).toBe(1);
  });

  it("puts a working reply's Stop in its footer's end, alone, without a spinner, keeps the footer shown without hover, and cancels the reply", async () => {
    const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 2));
    context.answer(MethodName.MessageCancel, () => SampleData.withStatus(running, MessageStatus.Cancelled, steps.slice(0, 2)).toJson());
    render(running);
    await Wait.until(() => expect(element().querySelector("strong")).not.toBeNull(), MarkdownWait.coldImport);

    expect([...element().querySelectorAll(".nol-message-footer-end > *")].map(t => [t.className.includes("cancel"), t.getAttribute("data-nol-placement")])).toEqual([[true, "End"]]);
    expect(element().querySelectorAll(".cancel")).toHaveLength(1);
    expect(element().querySelector(".nol-message-footer-end nol-spinner")).toBeNull();
    expect(textOf(".nol-message-footer .cancel")).toMatch(/Stop$/u);
    await userEvent.unhover(element().querySelector(".nol-message")!);
    expect(document.querySelectorAll(".nol-message:is(:hover, :focus-within)")).toHaveLength(0);
    await Wait.until(() => expect(getComputedStyle(element().querySelector(".nol-message-footer")!).opacity).toBe("1"));

    await click(element().querySelector(".nol-message-footer .cancel"));
    await Wait.until(() => expect(context.parametersOf(MethodName.MessageCancel)).toEqual(new MessageIdParams(running.id).toJson()));
  });

  describe.each([
    { look: "light", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    afterAll(() => EmulatedMediaFixture.resetAsync());

    const working = async (): Promise<Message> => {
      const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 2));
      render(running);
      await Wait.until(() => expect(element().querySelector("strong")).not.toBeNull(), MarkdownWait.coldImport);
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      return running;
    };

    it("says a reply is stopping from the first Enter on its Stop, which keeps its focus, box and place, asks once, and drops the word when the stop fails", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 2));
      let calls = 0;
      const held = new DeferredResponse();
      context.answer(MethodName.MessageListOpen, () => [running.toJson()]);
      context.answer(MethodName.MessageCancel, () => {
        calls += 1;
        return held.promise;
      });
      render(running);
      await Wait.until(() => expect(store().loaded()).toBe(true));
      fixture.detectChanges();
      const stop = (): HTMLButtonElement => {
        const found = element().querySelector(".nol-message-footer .cancel");
        if (!(found instanceof HTMLButtonElement))
          throw new Error("Stop is not shown.");
        return found;
      };
      const before = [box(".nol-message-footer .cancel"), box(".activity-line")] as const;

      stop().focus();
      await userEvent.keyboard("{Enter}");
      await Wait.until(() => expect(calls).toBe(1));
      fixture.detectChanges();
      await userEvent.keyboard("{Enter}");
      await fixture.whenStable();
      fixture.detectChanges();

      expect([textOf(".activity-text"), stop().getAttribute("aria-disabled"), stop().disabled, document.activeElement === stop(), calls])
        .toEqual(["Stopping…", "true", false, true, 1]);
      expect(textOf(".nol-message-footer .cancel")).toMatch(/Stop$/u);
      for (const [earlier, after] of [[before[0], box(".nol-message-footer .cancel")], [before[1], box(".activity-line")]] as const)
        for (const edge of ["left", "top", "width", "height"] as const)
          AppearanceFixture.expectPixels(after[edge], earlier[edge]);
      held.reject(new Error("The reply couldn't be stopped."));
      await Wait.until(() => expect(stop().getAttribute("aria-disabled")).toBeNull());
      fixture.detectChanges();
      expect([textOf(".activity-text"), document.activeElement === stop()]).toEqual(["Working for 12s", true]);
    });

    it("keeps a working reply's footer row as tall while its Stop shows as once the reply has finished, with the default theme, and Stop the row's height", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const running = await working();
      const [row, stop] = [box(".nol-message-footer"), box(".nol-message-footer .cancel")];

      await show(SampleData.withStatus(running, MessageStatus.Completed, steps.slice(0, 2)));
      await Wait.until(() => expect(element().querySelector(".cancel")).toBeNull());
      const finished = box(".nol-message-footer");
      expect([row.height > 0, footerEnd()]).toEqual([true, ["stats"]]);
      AppearanceFixture.expectPixels(row.height, finished.height);
      AppearanceFixture.expectPixels(stop.height, finished.height);
    });

    it("shows a reply stopped at a usage limit as one 13 px stopped line in the error colour, the message's column gap under the answer from its start edge, with no glyph and no used-up line", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      const stopped = "Stopped: Claude · Work reached its usage limit. It resets at 18:00.";
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Failed, [detail(0, DetailKind.Text, "Reading upload-client.ts first."),
        detail(1, DetailKind.Error, stopped, { usedUp: true, usedUpUntil: new Date(clock.now() + 7_200_000).toISOString(), stopped: true })]));
      await Wait.until(() => expect(textOf(".reply-stopped")).toBe(stopped));
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      const line = box(".reply-stopped");
      const answer = box(".nol-markdown-view");
      const style = getComputedStyle(one(".reply-stopped"));
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-error)";
      probe.style.fontSize = "var(--nol-text-message)";
      probe.style.lineHeight = "var(--nol-line-message)";

      expect([element().querySelector(".reply-error"), element().querySelector(".reply-error-glyph"), element().querySelector(".reply-error-used-up")])
        .toEqual([null, null, null]);
      expect([style.color, style.fontSize, style.lineHeight]).toEqual([getComputedStyle(probe).color, "13px", getComputedStyle(probe).lineHeight]);
      AppearanceFixture.expectPixels(line.left, answer.left);
      AppearanceFixture.expectPixels(line.top - answer.bottom, AppearanceFixture.measureLook("space-2"));
      probe.remove();
    });

    it("draws a working reply's Stop at the theme's button-compact-height, with the fixture theme", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      await working();
      AppearanceFixture.expectPixels(box(".nol-message-footer .cancel").height, AppearanceFixture.measureLook("button-compact-height"));
    });
  });

  it("shows a waiting reply's approval in the reply with its choices and a Waiting for permission chip, matching its steps, and resumes once it is answered", async () => {
    context.answer(MethodName.ApprovalDecide, () => SampleData.approval.withDecision("yes", decidedAt).toJson());
    await openConversation();
    render(awaiting());

    await Wait.until(() => expect(cards()).toHaveLength(1));
    expect([...element().querySelectorAll("[data-nol-option]")].map(t => t.textContent?.trim())).toEqual(["Approve", "Deny"]);
    expect(textOf(".nol-message-header .nol-chip")).toBe(Resources.awaitingApprovalLabel);

    await click(element().querySelector<HTMLElement>("[data-nol-option=\"yes\"]"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-reply-approvals")).toBeNull());
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 3)));

    expect(context.count(MethodName.ApprovalDecide)).toBe(1);
    expect(element().querySelector(".nol-message-header .nol-chip")).toBeNull();
    expect(element().querySelector(".nol-message-footer .cancel")).not.toBeNull();
  });

  it("says an open step waits for your answer, in the reply chip's words, once only questions wait", async () => {
    const command = detail(0, DetailKind.Command, "$ npm test\n", { command: "npm test", cwd: "D:\\repo", exitCode: null, status: "inProgress" });
    await openConversation();
    render(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [command]));
    await click(element().querySelector(".activity-toggle"));
    context.emit(EventName.ApprovalCreated, question().toJson());
    await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull());

    expect(textOf(".nol-tool-call-status")).toBe("Waiting for permission");
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    await Wait.until(() => expect(textOf(".nol-tool-call-status")).toBe("Waiting for your answer"));
    expect(textOf(".nol-message-header .nol-chip")).toBe(textOf(".nol-tool-call-status"));
  });

  it("says only the open step of the sub-agent whose question waits is waiting for your answer", async () => {
    const agent = (sequence: number, name: string): MessageDetail[] => [
      detail(sequence, DetailKind.SubAgent, name, new SubAgent(`t${sequence}`, null, name, null, SubAgentStatus.Running, false).toJson()),
      new MessageDetail(sequence + 1, DetailKind.Command, "> npm test", { tool: "Bash", toolUseId: `b${sequence}` }, SampleData.timestamp, sequence)];
    const asking = new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", { subAgent: "One" }, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null, question().questions);
    const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".calls > li")];
    await openConversation();
    render(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [...agent(0, "One"), ...agent(2, "Two")]));
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    context.emit(EventName.ApprovalCreated, asking.toJson());
    await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull());
    await click(element().querySelector(".activity-toggle"));
    for (const row of rows())
      await click(row.querySelector(".nol-tool-call-toggle"));
    const statuses = rows().map(row => [...row.querySelectorAll(":scope .nol-tool-call-children > nol-tool-call .nol-tool-call-status")].map(t => t.textContent?.trim()));

    expect(statuses).toEqual([["Waiting for your answer"], ["Running"]]);
    expect(textOf(".nol-message-header .nol-chip")).toBe("Waiting for your answer");
  });

  it("brings the chat's page forward from a Browser step's page, in the chat's project's workspace, and says so when it can't", async () => {
    await openConversation();
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Note, "mcp__teamrun__browser_click", { tool: "mcp__teamrun__browser_click", toolUseId: "tu-1", servedTool: "browser_click", servedInput: { ref: "e5" },
        page: { url: "https://shop.test/cart", title: "Cart" }, element: { role: "button", name: "Pay", isSecret: false } })
    ]));
    await click(element().querySelector(".activity-toggle"));
    await click(element().querySelector(".calls > li .nol-tool-call-toggle"));
    const page = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>(".step-page");

    await click(page());
    await Wait.until(() => expect(context.ranCommands).toEqual([{ name: "browser.openPage", commandArguments: { profileKey: "p1", instance: "c1" } }]));
    vi.spyOn(context, "runCommandAsync").mockRejectedValueOnce(new Error("The Browser isn't installed."));
    await click(page());
    await Wait.until(() => expect(context.shownNotices().map(t => [t.title, t.text, t.severity]))
      .toEqual([["Couldn't open the page", Resources.chatPageNotShown, NotificationSeverity.Error]]));
    expect(Resources.chatPageNotShown).toBe("Couldn't bring the chat's page forward.");
  });

  it("shows a waiting reply's questions beside its request, its chip Waiting for your answer once only questions wait, and keeps them folded in the finished reply", async () => {
    const asking = question();
    await openConversation();
    render(awaiting());

    context.emit(EventName.ApprovalCreated, asking.toJson());
    await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull());
    expect(cards()).toHaveLength(1);
    expect(textOf(".nol-message-header .nol-chip")).toBe("Waiting for permission");
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    await Wait.until(() => expect(textOf(".nol-message-header .nol-chip")).toBe("Waiting for your answer"));
    context.emit(EventName.ApprovalUpdated, asking.withDecision("yes", decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());
    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-reply")).toBe("Web"));
    expect(textOf(".nol-message-header .nol-chip")).toBe(Resources.awaitingApprovalLabel);
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 3)));

    expect(cards()).toEqual([]);
    expect(textOf(".nol-teamrun-question-card-reply")).toBe("Web");
    expect(element().querySelector(".nol-message-header .nol-chip")).toBeNull();
  });

  it("shows that a finished reply waits while a late request or question waits in it, and stops once none does", async () => {
    const asking = question();
    await openConversation();
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 3)));

    await Wait.until(() => expect(textOf(".nol-message-header .nol-chip")).toBe("Waiting for permission"));
    context.emit(EventName.ApprovalCreated, asking.toJson());
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    await Wait.until(() => expect(textOf(".nol-message-header .nol-chip")).toBe("Waiting for your answer"));
    context.emit(EventName.ApprovalUpdated, asking.withCancellation(decidedAt).toJson());
    await Wait.until(() => expect(element().querySelector(".nol-message-header .nol-chip")).toBeNull());
  });

  it("shows the reply's second request once the first is answered", async () => {
    await openConversation();
    render(awaiting());

    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    await Wait.until(() => expect(cards()).toEqual([]));
    context.emit(EventName.ApprovalCreated, request("ap2", "m2").toJson());

    await Wait.until(() => expect(cards()).toHaveLength(1));
    expect(textOf(".nol-permission-card-heading")).toBe("Use a tool");
    expect(textOf(".nol-permission-card-code")).toBe("read a file\nKind: tool");
  });

  it("marks a high-risk card by its risk alone, with no description line between its requester and its details", async () => {
    await openConversation();
    render(awaiting());
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
    await Wait.until(() => expect(cards()).toEqual([]));
    context.emit(EventName.ApprovalCreated, new Approval("ap2", "m2", ApprovalKind.Permission, "browser.click", "Click \"Choose Team\" on docs.example.com",
      { module: "browser", subject: "p1", risk: "High", details: [{ label: "Page", kind: "Text", value: "docs.example.com/pricing" }] }, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson());

    await Wait.until(() => expect(cards()).toHaveLength(1));
    const card = cards()[0] ?? element();
    expect(card.querySelector(".nol-permission-card-risk")).not.toBeNull();
    expect(card.querySelector(".nol-permission-card-description")).toBeNull();
    expect(card.querySelector(".nol-permission-card-requester")?.nextElementSibling?.classList.contains("nol-permission-card-details")).toBe(true);
  });

  it("adds \"waiting for your answer\" after the title of only the step whose pending card asks, with two Browser steps open, and drops it once answered",
    async () => {
      const step = (sequence: number, ref: string, name: string): MessageDetail => detail(sequence, DetailKind.Note, "mcp__teamrun__browser_click", {
        tool: "mcp__teamrun__browser_click", toolUseId: `tu-${ref}`, servedTool: "browser_click", servedInput: { ref },
        page: { url: "https://docs.example.com/pricing", title: "Pricing" }, element: { role: "button", name, isSecret: false } });
      await openConversation();
      render(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [step(0, "e5", "Choose Team"), step(1, "e7", "Cancel")]));
      context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
      await Wait.until(() => expect(cards()).toEqual([]));
      const asked = new Approval("ap2", "m2", ApprovalKind.Permission, "browser.click", "Click \"Cancel\" on docs.example.com",
        { module: "browser", subject: "p1", risk: "Medium", details: [], servedTool: "browser_click", servedInput: { ref: "e7" } }, SampleData.approval.options,
        ApprovalStatus.Pending, null, SampleData.timestamp, null);
      context.emit(EventName.ApprovalCreated, asked.toJson());
      await Wait.until(() => expect(cards()).toHaveLength(1));
      await click(element().querySelector(".activity-toggle"));
      const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".calls > li")];
      const titles = (): (string | undefined)[] => rows().map(t => t.querySelector(".nol-tool-call-title")?.textContent?.trim());
      const notes = (): (string | null)[] => rows().map(t => t.querySelector(".nol-tool-call-note")?.textContent ?? null);

      await Wait.until(() => expect(titles()).toEqual(["Clicking \"Choose Team\"", "Clicking \"Cancel\" · waiting for your answer"]));
      const title = rows()[1]?.querySelector(".nol-tool-call-title")?.getBoundingClientRect();
      const note = rows()[1]?.querySelector(".nol-tool-call-note")?.getBoundingClientRect();
      expect(notes()).toEqual([null, " · waiting for your answer"]);
      expect([note !== undefined && title !== undefined && note.left > title.left && note.right <= title.right + 0.5,
        note !== undefined && title !== undefined && note.top >= title.top - 0.5 && note.bottom <= title.bottom + 0.5]).toEqual([true, true]);

      context.emit(EventName.ApprovalUpdated, asked.withDecision("yes", decidedAt).toJson());
      await Wait.until(() => expect(cards()).toEqual([]));
      await Wait.until(() => expect(notes()).toEqual([null, null]));
    });

  it("removes the card of a reply stopped while it waits, and marks the reply stopped", async () => {
    const waiting = awaiting();
    context.answer(MethodName.MessageCancel, () => SampleData.withStatus(waiting, MessageStatus.Cancelled).toJson());
    await openConversation();
    render(waiting);
    await Wait.until(() => expect(cards()).toHaveLength(1));

    await click(element().querySelector(".nol-message-footer .cancel"));
    await Wait.until(() => expect(context.parametersOf(MethodName.MessageCancel)).toEqual(new MessageIdParams(waiting.id).toJson()));
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withCancellation(decidedAt).toJson());
    await show(SampleData.withStatus(waiting, MessageStatus.Cancelled));

    await Wait.until(() => expect(element().querySelector("nol-teamrun-reply-approvals")).toBeNull());
    expect(textOf(".nol-message-header .nol-chip")).toBe("Cancelled");
    expect([element().querySelector(".cancel"), footerEnd()]).toEqual([null, ["stats"]]);
  });

  it("shows a chained teammate's approval in the teammate's own reply", async () => {
    await openConversation();
    const chained = new Message("m6", "c1", 5, MessageAuthor.Provider, "m2", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null, [], "alice", "Alice");
    render(chained);
    expect(cards()).toEqual([]);

    context.emit(EventName.ApprovalCreated, request("ap5", chained.id).toJson());

    await Wait.until(() => expect(cards()).toHaveLength(1));
    expect(textOf(".nol-permission-card-requester")).toBe("Alice, Teammate");
    expect(textOf(".nol-message-author")).toBe("Alice");
    expect(textOf(".nol-message-header .nol-chip")).toBe(Resources.awaitingApprovalLabel);
  });

  it("names an unnamed teammate's approval by its provider, as the reply's header does", async () => {
    await openConversation();
    const unnamed = new Message("m6", "c1", 5, MessageAuthor.Provider, "m2", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null, []);
    render(unnamed);

    context.emit(EventName.ApprovalCreated, request("ap5", unnamed.id).toJson());

    await Wait.until(() => expect(cards()).toHaveLength(1));
    expect([textOf(".nol-message-author"), textOf(".nol-permission-card-requester")]).toEqual(["Codex · Work", "Codex · Work, Teammate"]);
  });

  it("says a working reply is thinking, timed from its start, after its spinner, before its first step whatever its provider, and again while the store hears it think, in one place", async () => {
    const running = SampleData.reply;
    context.answer(MethodName.MessageListOpen, () => [running.toJson()]);
    render(running);
    await Wait.until(() => expect(store().loaded()).toBe(true));
    fixture.detectChanges();

    const text = (): DOMRect => box(".activity-label, .activity-text");
    const spinner = (): DOMRect => box(".activity-line nol-spinner");
    const gap = Number.parseFloat(getComputedStyle(element().querySelector(".activity-line")!).columnGap);
    expect(textOf(".activity-label")).toBe("Thinking… 12s");
    expect(box(".activity-label").bottom).toBeLessThanOrEqual(box(".nol-message-footer").top);
    expect(element().querySelector(".activity-toggle")).toBeNull();
    expect(spinner().left).toBeCloseTo(box(".activity-line").left, 1);
    expect(text().left - spinner().right).toBeCloseTo(gap, 1);
    expect(Math.abs(middleOf(spinner()) - middleOf(text()))).toBeLessThanOrEqual(1);
    const before = [box(".activity-line"), text()];
    clock.advance(2_000);
    fixture.detectChanges();
    expect(textOf(".activity-label")).toBe("Thinking… 14s");

    await show(SampleData.withStatus(running, MessageStatus.Running, steps.slice(0, 1)));
    expect(textOf(".activity-text")).toBe("Working for 14s");
    for (const [index, after] of [box(".activity-line"), text()].entries()) {
      expect(after.top).toBeCloseTo(before[index]!.top, 1);
      expect(after.left).toBeCloseTo(before[index]!.left, 1);
      expect(after.height).toBeCloseTo(before[index]!.height, 1);
    }
    expect(text().left - spinner().right).toBeCloseTo(gap, 1);

    context.emit(EventName.ReplyThinking, new MessageIdParams(running.id).toJson());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(textOf(".activity-text")).toBe("Thinking… 14s");
  });

  it("says a working reply is saving a checkpoint, timed from its start, in its activity's place, until the checkpoint ends", async () => {
    const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 1));
    context.answer(MethodName.MessageListOpen, () => [running.toJson()]);
    render(running);
    await Wait.until(() => expect(store().loaded()).toBe(true));
    fixture.detectChanges();
    const before = box(".activity-text");

    context.emit(EventName.ReplyCheckpointStarted, new MessageIdParams(running.id).toJson());
    await fixture.whenStable();
    fixture.detectChanges();
    const saving = [textOf(".activity-text"), box(".activity-text")] as const;
    clock.advance(2_000);
    context.emit(EventName.ReplyCheckpointEnded, new MessageIdParams(running.id).toJson());
    await fixture.whenStable();
    fixture.detectChanges();

    expect([saving[0], textOf(".activity-text")]).toEqual(["Saving a checkpoint… 12s", "Working for 14s"]);
    AppearanceFixture.expectPixels(saving[1].left, before.left);
    AppearanceFixture.expectPixels(saving[1].top, before.top);
  });

  it("shows a working reply's newest thought as its latest line, and its step title once a step or text follows it", async () => {
    const thought = detail(0, DetailKind.Reasoning, "Weighing a temporary project. Then the build.\n\nChecking the build first. Then the tests.");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [thought]));
    await click(element().querySelector(".activity-toggle"));
    const titles = (): readonly (string | undefined)[] => [...element().querySelectorAll(".nol-tool-call-title")].map(t => t.textContent?.trim());

    expect(titles()).toEqual(["Checking the build first."]);

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [thought, detail(1, DetailKind.Text, "Building now.")]));
    expect(titles()).toEqual(["Weighing a temporary project."]);

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [thought, detail(1, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" })]));
    await frames(() => titles().at(-1) === "> ls");
    expect(titles()).toEqual(["Weighing a temporary project.", "> ls"]);
  });

  it("shows a reply's plan as a one-line card with its title and progress in its place among its answers, never as a step, and updates it in place", async () => {
    render(planReply(planned(PlanStepStatus.Pending, PlanStepStatus.Pending, PlanStepStatus.Pending)));
    await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
    const card = element().querySelector("nol-teamrun-plan-card");
    const header = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header");
    const paragraph = (text: string): Element | undefined => [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === text);
    const follows = (first: Element | null | undefined, second: Element | null | undefined): number =>
      (first?.compareDocumentPosition(second ?? first) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(element().querySelectorAll("nol-teamrun-plan-card")).toHaveLength(1);
    expect([textOf("nol-teamrun-plan-card .title"), textOf("nol-teamrun-plan-card .progress"), header()?.getAttribute("aria-expanded")]).toEqual(["Plan", "0 of 3", "false"]);
    expect(element().querySelector("nol-plan")).toBeNull();
    expect([follows(paragraph("Here's my plan."), card), follows(card, paragraph("Done."))]).toEqual([Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING]);

    await show(planReply(planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending)));
    expect(element().querySelector("nol-teamrun-plan-card")).toBe(card);
    expect(textOf("nol-teamrun-plan-card .progress")).toBe("1 of 3");
    await click(element().querySelector<HTMLButtonElement>(".activity-toggle"));
    expect([...element().querySelectorAll("nol-teamrun-activity-block .nol-tool-call-title")].map(t => t.textContent)).toEqual(["> ls"]);
  });

  it("offers Approve plan under the plan of the chat's last reply while its plan-first turn waits for approval, approves it once, and then says Approved", async () => {
    await planningChat();
    const followUp = new Message("m3", "c1", 2, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Go ahead with the plan.")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    const next = new Message("m4", "c1", 3, MessageAuthor.Provider, "m3", MessageStatus.Pending, [], SampleData.provenance, SampleData.timestamp, null, null);
    const answer = new DeferredResponse();
    context.answer(MethodName.MessageApprovePlan, () => answer.promise);
    render(awaitingPlan());
    await Wait.until(() => expect(approveButton()).not.toBeNull());

    expect([approveButton()?.textContent?.trim(), textOf("nol-teamrun-plan-card .progress"), approveButton()?.getAttribute("aria-disabled")])
      .toEqual([Resources.approvePlanLabel, null, null]);
    await click(approveButton());
    await click(approveButton());
    expect([context.count(MethodName.MessageApprovePlan), approveButton()?.getAttribute("aria-disabled")]).toEqual([1, "true"]);
    context.emit(EventName.MessageUpdated, awaitingPlan(true).toJson());
    answer.resolve(new MessageSendResult(followUp, [next]).toJson());
    await Wait.until(() => expect(store().messageIndexOf("c1").map(t => t.id)).toEqual(["m1", "m2", "m3", "m4"]));
    await show(awaitingPlan(true));

    expect([context.parametersOf(MethodName.MessageApprovePlan), approveButton(), textOf("nol-teamrun-plan-card .progress")])
      .toEqual([new MessageIdParams("m2").toJson(), null, Resources.planApproved]);
  });

  it.each([
    { state: "its chat's Plan first is off", planFirst: false, later: false },
    { state: "a later message follows it", planFirst: true, later: true }
  ])("offers no Approve plan on a plan-first reply's open plan once $state", async ({ planFirst, later }) => {
    const after = new Message("m3", "c1", 2, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Shorter, please.")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    await planningChat(planFirst, [SampleData.userMessage, awaitingPlan(), ...later ? [after] : []]);
    render(awaitingPlan());
    await Wait.until(() => expect(textOf("nol-teamrun-plan-card .title")).not.toBeNull());

    expect(approveButton()).toBeNull();
  });

  it("says why a plan couldn't be approved, and offers Approve plan again", async () => {
    await planningChat();
    context.fail(MethodName.MessageApprovePlan, "The reply has no plan waiting for approval.");
    render(awaitingPlan());
    await Wait.until(() => expect(approveButton()).not.toBeNull());

    await click(approveButton());

    await Wait.until(() => expect(context.noticeText()).toContain("The reply has no plan waiting for approval."));
    expect([context.shownNotices().at(-1)?.title, approveButton()?.getAttribute("aria-disabled")]).toEqual([Resources.chatActionTitles[ChatAction.ApprovePlan], null]);
  });

  it("opens a reply's plan in its block, its text then its checklist, shows the Plans view with that reply, and closes it again", async () => {
    const text = detail(4, DetailKind.Plan, "Move the cache", new ReplyPlan([], null, "## Move the cache\n\nRead it first.").toJson());
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Here's my plan."), text,
      planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending), detail(3, DetailKind.Text, "Done.")]);
    render(reply);
    await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
    const header = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header");
    const paragraph = (value: string): Element | undefined => [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === value);
    const follows = (first: Element | null | undefined, second: Element | null | undefined): number =>
      (first?.compareDocumentPosition(second ?? first) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING;
    const shown = (): string[] => [...element().querySelectorAll("nol-plan .nol-plan-text")].map(t => t.textContent?.trim() ?? "");

    expect([textOf("nol-teamrun-plan-card .title"), textOf("nol-teamrun-plan-card .progress")]).toEqual(["Plan", "1 of 3"]);
    expect(paragraph("Read it first.")).toBeUndefined();
    expect([store().planFocus(), context.shownViews]).toEqual([null, []]);

    await click(header());
    await Wait.until(() => expect(paragraph("Read it first.")).toBeDefined(), MarkdownWait.coldImport);
    const card = element().querySelector("nol-teamrun-plan-card");
    const plan = element().querySelector("nol-plan");
    expect(header()?.getAttribute("aria-expanded")).toBe("true");
    expect(shown()).toEqual(["Read the code", "Fixing the bug", "Run the tests"]);
    expect([follows(card, paragraph("Read it first.")), follows(paragraph("Read it first."), plan), follows(plan, paragraph("Done."))])
      .toEqual([Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING]);
    const focus = store().planFocus();
    expect([focus?.conversationId, focus?.messageId, focus?.sequence]).toEqual([reply.conversationId, reply.id, reply.sequence]);
    expect(context.shownViews).toEqual(["teamrun.plan"]);

    await click(header());
    expect([header()?.getAttribute("aria-expanded"), element().querySelector("nol-plan"), paragraph("Read it first.")]).toEqual(["false", null, undefined]);
    expect([store().planFocus(), context.shownViews]).toEqual([focus, ["teamrun.plan"]]);
  });

  it("shows the step its reply left in progress as not done, with no spinner and its own text, once the reply ends in any way", async () => {
    const running = planReply(planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending));
    render(running);
    await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
    await click(element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header"));
    await Wait.until(() => expect(element().querySelector("nol-plan")).not.toBeNull());
    const steps = (): (string | boolean)[][] => [...element().querySelectorAll("nol-plan .nol-plan-step")]
      .map(t => [t.querySelector(".nol-plan-text")?.textContent?.trim() ?? "", !Object.isNull(t.querySelector(".nol-plan-spinner"))]);
    const marker = (index: number): DOMRect => {
      const found = element().querySelectorAll("nol-plan .nol-plan-marker")[index];
      if (Object.isUndefined(found))
        throw new Error(`The plan shows no step marker ${index}.`);
      return found.getBoundingClientRect();
    };

    expect(steps()).toEqual([["Read the code", false], ["Fixing the bug", true], ["Run the tests", false]]);

    for (const status of [MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Cancelled, MessageStatus.Interrupted]) {
      await show(SampleData.withStatus(running, status));
      expect([status, steps(), textOf("nol-teamrun-plan-card .progress")]).toEqual([status, [["Read the code", false], ["Fix the bug", false], ["Run the tests", false]], "1 of 3"]);
      const [ended, pending] = [marker(1), marker(2)];
      AppearanceFixture.expectPixels(ended.left, pending.left);
      AppearanceFixture.expectPixels(ended.width, pending.width);
      AppearanceFixture.expectPixels(ended.height, pending.height);
    }
  });

  it("opens a plan with only a checklist to its checklist, and one with only text to its text, without progress in its card", async () => {
    render(planReply(planned(PlanStepStatus.Completed, PlanStepStatus.Pending)));
    await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
    const header = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header");
    const markdown = element().querySelectorAll(".nol-markdown-view").length;
    await click(header());
    await Wait.until(() => expect(element().querySelectorAll("nol-plan .nol-plan-text")).toHaveLength(2));
    expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(markdown);

    render(SampleData.withStatus(new Message("m7", "c1", 7, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null), MessageStatus.Completed, [detail(0, DetailKind.Plan, "Ship it", new ReplyPlan([], null, "# Ship it\n\nThen tell me.").toJson())]));
    await Wait.until(() => expect(textOf("nol-teamrun-plan-card .title")).toBe("Plan"), MarkdownWait.coldImport);
    expect(element().querySelector("nol-teamrun-plan-card .progress")).toBeNull();
    await click(header());
    await Wait.until(() => expect([...element().querySelectorAll("p")].map(t => t.textContent?.trim())).toContain("Then tell me."), MarkdownWait.coldImport);
    expect(element().querySelector("nol-plan")).toBeNull();
  });

  it("heads a plan whose text starts with its own heading Plan, an underlined one or a lone hash mark included, and one without a heading with its first line, a list item or a rule after a blank line included", async () => {
    const texted = (text: string): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
      [detail(0, DetailKind.Plan, "Plan", new ReplyPlan([], null, text).toJson())]);
    const title = (): string | null => textOf("nol-teamrun-plan-card .title");
    render(texted("## Move the cache\n\nRead it first."));
    await Wait.until(() => expect(title()).not.toBeNull(), MarkdownWait.coldImport);

    expect(title()).toBe("Plan");
    await show(texted("\n   # Ship it\nThen tell me."));
    expect(title()).toBe("Plan");
    await show(texted("Move the cache first.\n\nThen tell me."));
    expect(title()).toBe("Move the cache first.");
    await show(texted("#cache stays where it is."));
    expect(title()).toBe("#cache stays where it is.");
    for (const heading of ["Move the cache\n==============\n\nRead it first.", "Move the cache\r\n---\r\nRead it first.", "  Move the cache\n   ===  ", "#", "##\nRead it first."]) {
      await show(texted(heading));
      expect(title()).toBe("Plan");
    }
    for (const [text, first] of [["Move the cache\n\n---\nRead it first.", "Move the cache"], ["Move the cache\n- - -", "Move the cache"],
      ["- Read the code\n---", "- Read the code"], ["1. Read the code\n===", "1. Read the code"], ["Move the cache\n= Read it first.", "Move the cache"]] as const) {
      await show(texted(text));
      expect(title()).toBe(first);
    }
  });

  it("shows no plan card for a plan without text or steps, or one it can't read", async () => {
    render(planReply(planned()));
    await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
    expect(element().querySelector("nol-teamrun-plan-card")).toBeNull();
    await show(planReply(detail(1, DetailKind.Plan, "Plan", { steps: "Read the code" })));
    expect(element().querySelector("nol-teamrun-plan-card")).toBeNull();
    expect(element().textContent).toContain("Done.");
  });

  it("shows a failed reply's error in its place in the error colour, says the reply failed in its header with no retry it cannot offer, and marks stopped replies", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Failed, [detail(0, DetailKind.Text, "Partial."), detail(1, DetailKind.Error, "The provider refused.")]));
    await Wait.until(() => expect(element().textContent).toContain("Partial."));

    const probe = element().appendChild(document.createElement("span"));
    probe.style.color = "var(--nol-error)";
    expect(textOf(".reply-error-text")).toBe("The provider refused.");
    expect(textOf(".reply-error-glyph")).toBe("error");
    expect(getComputedStyle(element().querySelector(".reply-error") ?? probe).color).toBe(getComputedStyle(probe).color);
    expect(getComputedStyle(probe).color).not.toBe(getComputedStyle(element()).color);
    expect(box(".reply-error-glyph").right).toBeLessThanOrEqual(box(".reply-error-text").left);
    expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1);
    expect(textOf(".nol-message-header .nol-chip")).toBe("Failed");
    expect(element().querySelector(".nol-message-header .nol-chip")?.classList.contains("nol-chip-failed")).toBe(true);
    expect(element().querySelector(".nol-message-error, .nol-message-retry, .nol-message-status")).toBeNull();
    probe.remove();

    const marks: [MessageStatus, string | null, boolean | null][] = [];
    for (const status of [MessageStatus.Pending, MessageStatus.AwaitingApproval, MessageStatus.Cancelled, MessageStatus.Interrupted]) {
      await show(SampleData.withStatus(SampleData.reply, status, []));
      const chip = element().querySelector(".nol-message-header .nol-chip");
      marks.push([status, chip?.textContent?.trim() ?? null, chip?.classList.contains("nol-chip-failed") ?? null]);
    }
    expect(marks).toEqual([
      [MessageStatus.Pending, null, null], [MessageStatus.AwaitingApproval, "Waiting for permission", false], [MessageStatus.Cancelled, "Cancelled", false],
      [MessageStatus.Interrupted, "Interrupted", false]
    ]);
    expect(textOf(".activity-label")).toBe("Worked for 0s");
  });

  it("names the provider and its reset above the error of a reply that failed while its plan was used up, on its own line at the error's edge", async () => {
    const until = new Date(clock.now() + 7_200_000).toISOString();
    const failed = (payload: Record<string, unknown> | null): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Failed,
      [detail(0, DetailKind.Error, "The provider's turn failed: You've hit your limit.", payload)]);
    const notes = (): string[] => [...element().querySelectorAll(".reply-error-used-up")].map(t => (t.textContent ?? String.empty).trim());
    render(failed(null));
    await Wait.until(() => expect(textOf(".nol-message-author")).toBe("Codex · Work"));
    const plain = notes();
    await show(failed({ action: ReplyAction.ChooseModel, usedUp: false }));
    const notUsedUp = notes();
    await show(failed({ usedUp: true, usedUpUntil: null }));
    const unknown = notes();
    await show(failed({ usedUp: true, usedUpUntil: until }));
    const texts = [...element().querySelectorAll(".reply-error-text")];
    const space = AppearanceFixture.measureLook("space-2");

    expect([plain, notUsedUp]).toEqual([[], []]);
    expect(unknown).toEqual([Resources.formatUsedUpTurn("Codex · Work", Resources.usedUpLabel)]);
    expect(notes()).toEqual([Resources.formatUsedUpTurn("Codex · Work", TestBed.inject(UsageFormatterService).usedUpState(until))]);
    expect(notes()[0]).toMatch(/^Codex · Work: used up, resets [^.]+\.$/);
    expect(texts.map(t => (t.textContent ?? String.empty).trim())).toEqual([notes()[0], "The provider's turn failed: You've hit your limit."]);
    expect(texts[0]?.getBoundingClientRect().left).toBeCloseTo(texts[1]?.getBoundingClientRect().left ?? Number.NaN, 1);
    expect((texts[1]?.getBoundingClientRect().top ?? 0) - (texts[0]?.getBoundingClientRect().bottom ?? 0)).toBeCloseTo(space, 1);
    expect(texts[0]?.getBoundingClientRect().right).toBeLessThanOrEqual(box(".reply-error").right);

    await show(failed({ usedUp: true, usedUpUntil: new Date(clock.now() - 3_600_000).toISOString() }));
    expect(notes()[0]).toMatch(/^Codex · Work: was used up until [^.]+[.]$/);
  });

  it("offers Choose a model under the error of a reply that failed for its model, opening the teammate's dialog or else the composer's settings", async () => {
    const teammates = new TeammateFixture(context);
    const opened: string[] = [];
    const withdraw = CommandTargetsService.of(context).provideComposer("c1", () => undefined, () => false, () => opened.push("c1"));
    const unavailable = detail(1, DetailKind.Error, "Grok doesn't offer the model grok-4.7.", { action: ReplyAction.ChooseModel });
    const failed = (teammate: Teammate | null, error: MessageDetail = unavailable): Message => new Message("m6", "c1", 5, MessageAuthor.Provider, "m1",
      MessageStatus.Failed, [error], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammate?.id ?? null, teammate?.name ?? null);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(failed(null, detail(1, DetailKind.Error, "The provider refused.", { action: "Retry" })));
    expect(textOf(".reply-error-text")).toBe("The provider refused.");
    expect(element().querySelector(".choose-model")).toBeNull();

    await show(failed(null));
    expect(textOf(".choose-model")).toBe(Resources.chooseModelLabel);
    expect(box(".choose-model").left).toBeCloseTo(box(".reply-error-text").left, 1);
    expect(box(".choose-model").top).toBeGreaterThanOrEqual(box(".reply-error-text").bottom);
    expect(box(".choose-model").right).toBeLessThanOrEqual(box(".reply-error").right);
    await click(element().querySelector(".choose-model"));
    expect(opened).toEqual(["c1"]);
    expect(document.querySelector(".nol-dialog-title")).toBeNull();

    await show(failed(teammates.alice));
    await click(element().querySelector(".choose-model"));
    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editTeammateLabel);
    expect(document.querySelector<HTMLInputElement>(".nol-teamrun-teammate-name")?.value).toBe("Alice");
    expect(opened).toEqual(["c1"]);
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());
    withdraw();
  });

  it("names a teammate's reply by the teammate and TeamRun's own messages as TeamRun", async () => {
    render(new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp,
      SampleData.timestamp, [], "t1", "Reviewer"));
    expect(textOf(".nol-message-author")).toBe("Reviewer");
    expect(textOf(".nol-message-avatar")).toBe("R");

    await show(new Message("m8", "c1", 7, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, SampleData.timestamp, [], "t2", "Code Reviewer"));
    expect(textOf(".nol-message-author")).toBe("Code Reviewer");
    expect(textOf(".nol-message-avatar")).toBe("CR");

    await show(new Message("m7", "c1", 6, MessageAuthor.TeamRun, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Rewound.")], null, SampleData.timestamp, null,
      SampleData.timestamp));
    expect(textOf(".nol-message-author")).toBe("TeamRun");
    expect(element().textContent).toContain("Rewound.");
    expect(element().querySelector(".activity-toggle, .activity-label")).toBeNull();
  });

  it("draws a default teammate's send as its replies are, under its provider's name, and never marks a sender's own name", async () => {
    new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates().length).toBeGreaterThan(1));
    const look = (): string[] => {
      const avatar = element().querySelector<HTMLElement>(".nol-message-avatar");
      return [textOf(".nol-message-author") ?? "", avatar?.textContent?.trim() ?? "", avatar?.className ?? "", avatar?.style.getPropertyValue("--nol-avatar-fill") ?? ""];
    };
    const marked = (): string[] => [...element().querySelectorAll(".nol-markdown-mention")].map(t => t.textContent?.trim() ?? "");
    const sent = (sender: MessageSender): Message => new Message("m9", "c1", 8, MessageAuthor.User, null, MessageStatus.Completed,
      [detail(0, DetailKind.Text, "@Bob asks @Alice to look.")], null, SampleData.timestamp, null, SampleData.timestamp, [], null, null, [], sender);
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, []));
    const reply = look();

    await show(sent(new MessageSender("c2", null, "Codex")));
    await Wait.until(() => expect(marked()).toEqual(["@Bob", "@Alice"]), MarkdownWait.coldImport);
    expect(look()).toEqual(["Codex", ...reply.slice(1)]);
    expect(reply[0]).toBe("Codex · Work");
    await show(sent(new MessageSender("c2", "bob", "Bob")));
    await Wait.until(() => expect(marked()).toEqual(["@Alice"]));
    expect(textOf(".nol-message-avatar")).toBe("B");
  });

  it("names a message a teammate sent from another chat by the teammate, never as the person, with its chain's note, and opens the sending chat", async () => {
    const note = "The chain stopped after 4 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.";
    const header = (): (string | undefined)[] => [...element().querySelector(".nol-message-header")?.children ?? []].map(t => t.textContent?.trim());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    render(sentFrom("c1", [detail(0, DetailKind.Text, "What changed?"), detail(1, DetailKind.Note, note, { source: "handOff" })]));

    expect(header()).toEqual(["CR", "Code Reviewer", "from First"]);
    expect(textOf(".hand-off-note")).toBe(note);
    await click(element().querySelector(".sender-chat"));
    expect(context.openedDocuments.at(-1)).toMatchObject({ name: Resources.conversationDocumentName, instance: "c1", title: "First" });

    await show(sentFrom("c-gone"));
    expect(header()).toEqual(["CR", "Code Reviewer", "from a deleted chat"]);
    expect(element().querySelector(".sender-chat")).toBeNull();
    expect(element().querySelector(".hand-off-note")).toBeNull();
  });

  it("names a message from outside TeamRun by its quoted label, marks it Outside and links no chat, even one with the sender's chat id", async () => {
    const header = (): (string | undefined)[] => [...element().querySelector(".nol-message-header")?.children ?? []].map(t => t.textContent?.trim());
    await Wait.until(() => expect(store().loaded()).toBe(true));

    render(new Message("m9", "c1", 8, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "@Bob what changed?")], null,
      SampleData.timestamp, null, SampleData.timestamp, [], null, null, [], new MessageSender("c1", null, "Codex on alpha", true)));

    expect(header().slice(1)).toEqual(["\"Codex on alpha\"", "from outside TeamRun", "Outside"]);
    expect(element().querySelector(".sender-chat")).toBeNull();
    expect(element().querySelector(".sender-outside")?.textContent?.trim()).toBe("from outside TeamRun");
  });

  it("opens a reply that a background task's end started with its mark, the command as code, and keeps the mark out of its Activity", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Note, "Started when the background task `npm test` ended.", { source: "wake", taskId: "t1", command: "npm test" }),
      detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
      detail(2, DetailKind.Text, "The tests passed.")
    ]));

    expect(textOf(".wake-note")).toBe("Started when the background task npm test ended.");
    expect(textOf(".wake-note code")).toBe("npm test");
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-activity-block")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-activity-block")?.textContent).not.toContain("Started when");

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Note, "Started when a background task ended.", { source: "wake" })]));
    expect(textOf(".wake-note")).toBe("Started when a background task ended.");
    expect(element().querySelector(".wake-note code")).toBeNull();

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "No mark")]));
    expect(element().querySelector(".wake-note")).toBeNull();
  });

  it("opens a reply that a chat's wake started with a closed row that names the chat and opens it, shows its replies opened, and shows no ID", async () => {
    const replies = [{ name: "Bob", status: MessageStatus.Completed, text: "The login fix is in." }, { name: "Carol", status: MessageStatus.Failed, text: null }];
    const woken = (chatId: string): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Note, `Received a message from "First".`, { source: "wakeReceived", wakeChatId: chatId, wakeReplies: replies }),
      detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
      detail(2, DetailKind.Text, "Thanks.")
    ]);
    const line = (): HTMLElement => one("nol-teamrun-wake-line");
    const shown = (): string => [line().textContent ?? "", ...[line(), ...line().querySelectorAll("*")].flatMap(t => [...t.attributes].map(u => u.value))].join(" ");
    await Wait.until(() => expect(store().loaded()).toBe(true));
    render(woken("c1"));

    expect([textOf(".wake-toggle"), textOf(".wake-chat"), one(".wake-toggle").getAttribute("aria-expanded")]).toEqual(["Received a message from", "First", "false"]);
    expect(element().querySelector(".wake-replies")).toBeNull();
    await click(one(".wake-toggle"));
    expect(one(".wake-toggle").getAttribute("aria-expanded")).toBe("true");
    expect([...element().querySelectorAll(".wake-reply-heading, .wake-reply-text")].map(t => t.textContent?.trim()))
      .toEqual(["Bob replied:", "The login fix is in.", "Carol's reply failed."]);
    expect(shown()).not.toMatch(/\bc1\b|teamrun_list_messages/);
    await click(one(".wake-chevron"));
    expect(element().querySelector(".wake-replies")).toBeNull();
    await click(one(".activity-toggle"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-activity-block")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-activity-block")?.textContent).not.toContain("Received");
    await click(one(".wake-chat"));
    expect(context.openedDocuments.at(-1)).toMatchObject({ name: Resources.conversationDocumentName, instance: "c1", title: "First" });

    await show(woken("c-gone"));
    expect([textOf(".wake-toggle"), textOf(".wake-chat-gone"), element().querySelector(".wake-chat")]).toEqual(["Received a message from", "a deleted chat", null]);
    expect(shown()).not.toContain("c-gone");

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "No wake")]));
    expect(element().querySelector("nol-teamrun-wake-line")).toBeNull();
  });

  it("says a session that couldn't be resumed as a note about the chat, above the reply, and keeps it out of its Activity", async () => {
    const note = "The native session could not be resumed, so a fresh one was started: Invalid params";
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Note, note, { source: "resume" }),
      detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
      detail(2, DetailKind.Text, "Hi again.")
    ]));

    expect(textOf(".resume-note")).toBe(note);
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-activity-block")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-activity-block")?.textContent).not.toContain("could not be resumed");

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Note, note), detail(1, DetailKind.Text, "Hi again.")]));
    expect(element().querySelector(".resume-note")).toBeNull();
  });

  it("says each Sustain move as a note above the reply, in order, led by its glyph, and keeps the notes out of its Activity", async () => {
    const moved = "Moved to Codex, Spare, gpt-5 because Work reached its usage limit; new session with a handover";
    const allOut = "No Sustain entry is left: Codex, Work resets at 18:00, Codex, Spare hasn't said when it resets.";
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Failed, [
      detail(0, DetailKind.Note, moved, { source: "sustain" }),
      detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
      detail(2, DetailKind.Text, "Half done."),
      detail(3, DetailKind.Note, allOut, { source: "sustain", stopped: true })
    ]));

    expect([...element().querySelectorAll(".sustain-note-text")].map(t => t.textContent)).toEqual([moved, allOut]);
    expect([...element().querySelectorAll(".sustain-note-glyph")].map(t => [t.textContent, t.getAttribute("aria-hidden")]))
      .toEqual([[Resources.usageHandedOffGlyph, "true"], [Resources.usageStoppedGlyph, "true"]]);
    await click(element().querySelector(".activity-toggle"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-activity-block")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-activity-block")?.textContent).not.toContain("Sustain");
    expect(element().querySelector("nol-teamrun-activity-block")?.textContent).not.toContain("Moved to");

    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Note, moved), detail(1, DetailKind.Text, "Hi again.")]));
    expect(element().querySelector(".sustain-note")).toBeNull();
  });

  it("opens what a move's handover carried from Show handover after its note, closes it from Hide handover, and leaves a note without one as its line", async () => {
    const moved = "Moved to Codex, Spare, gpt-5 because Work reached its usage limit; new session with a handover.";
    const returned = "Moved to Codex, Work, gpt-5 because its usage reset";
    const allOut = "No Sustain entry is left: Codex, Work resets at 18:00.";
    const carried = ["Bob's first message, the original request", "Messages 4 to 9 whole", "Left out: messages 2 to 3", "The message this answers"];
    const reads = "Codex reads what was left out with list-messages, as it reads any chat.";
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Failed, [
      detail(0, DetailKind.Note, moved, { source: "sustain", handover: "Bob's chat so far", carried, reads }),
      detail(1, DetailKind.Note, returned, { source: "sustain" }),
      detail(2, DetailKind.Note, allOut, { source: "sustain", stopped: true, carried, reads }),
      detail(3, DetailKind.Text, "Half done.")
    ]));
    const toggles = (): HTMLButtonElement[] => [...element().querySelectorAll<HTMLButtonElement>(".sustain-handover-toggle")];

    expect([...element().querySelectorAll(".sustain-note-text")].map(t => t.textContent)).toEqual([`${moved} ${Resources.sustainShowHandover}`, returned, allOut]);
    expect(toggles().map(t => [t.textContent, t.getAttribute("aria-expanded"), t.closest(".sustain-note-text") === element().querySelector(".sustain-note-text")]))
      .toEqual([[Resources.sustainShowHandover, "false", true]]);
    expect(element().querySelector(".sustain-handover")).toBeNull();

    await click(toggles()[0] ?? null);
    const shown = one(".sustain-handover");
    expect([shown.getAttribute("role"), shown.getAttribute("aria-label")]).toEqual(["region", Resources.sustainHandoverLabel]);
    expect(one(".sustain-handover-heading", shown).textContent).toBe(Resources.sustainHandoverHeading);
    expect([...shown.querySelectorAll("li.sustain-handover-part")].map(t => t.textContent)).toEqual(carried);
    expect(one(".sustain-handover-reads", shown).textContent).toBe(reads);
    expect([toggles()[0]?.textContent, toggles()[0]?.getAttribute("aria-expanded")]).toEqual([Resources.sustainHideHandover, "true"]);

    await click(toggles()[0] ?? null);
    expect(element().querySelector(".sustain-handover")).toBeNull();
    expect([toggles()[0]?.textContent, toggles()[0]?.getAttribute("aria-expanded")]).toEqual([Resources.sustainShowHandover, "false"]);
  });

  it("opens a handover that left nothing out without the line on reading what was left out", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Failed, [
      detail(0, DetailKind.Note, "Moved to Codex, Spare because Work reached its usage limit; new session with a handover.",
        { source: "sustain", handover: "Bob's chat so far", carried: ["Messages 1 to 9 whole"] }),
      detail(1, DetailKind.Text, "Half done.")
    ]));

    await click(element().querySelector<HTMLButtonElement>(".sustain-handover-toggle"));
    expect([...element().querySelectorAll(".sustain-handover-part")].map(t => t.textContent)).toEqual(["Messages 1 to 9 whole"]);
    expect(element().querySelector(".sustain-handover-reads")).toBeNull();
  });

  it("shows the error details and the activity of TeamRun's own messages, as of a teammate's reply", async () => {
    render(new Message("m8", "c1", 7, MessageAuthor.TeamRun, null, MessageStatus.Failed, [...steps.slice(0, 1),
      detail(1, DetailKind.Error, "The files could not be restored.")], null, SampleData.timestamp, null, SampleData.timestamp));

    expect(textOf(".reply-error-text")).toBe("The files could not be restored.");
    await click(element().querySelector(".activity-toggle"));
    expect([...element().querySelectorAll("nol-teamrun-activity-block")].map(t => t.querySelector(".nol-tool-call-title")?.textContent)).toEqual(["> ls"]);
  });

  it("ends a finished reply with a stats button that shows its tokens in and out, and drops the separate tokens and time line", async () => {
    render(measured(MessageStatus.Completed, everyFigure));
    await fixture.whenStable();
    const button = one(statsSelector);

    expect([button.textContent?.trim(), button.getAttribute("aria-label"), button.getAttribute("aria-haspopup"), button.getAttribute("aria-expanded")])
      .toEqual(["260K in · 1.5K out", "Stats: 260K in · 1.5K out", "dialog", "false"]);
    expect(button.closest(".nol-message-footer-end")?.previousElementSibling?.classList).toContain("nol-message-time");
    expect(element().querySelectorAll(".reply-stats, .nol-teamrun-reply-stats")).toHaveLength(0);
    expect(textOf(".activity-label, .activity-toggle")).toBe("Worked for 1m 5s");
  });

  it("lists every figure the provider reported in the panel, the cache and new input under tokens in and reasoning under tokens out", async () => {
    render(measured(MessageStatus.Completed, everyFigure));
    await fixture.whenStable();
    const view = await openStats();

    expect([view.getAttribute("role"), view.getAttribute("aria-label"), statsButton()?.getAttribute("aria-expanded"), view.querySelector(".stats-note")])
      .toEqual(["dialog", "Reply stats", "true", null]);
    expect(statRows(view)).toEqual([["row", "Tokens in", "260,000"], ["part", "From cache", "200,000"], ["part", "Written to cache", "10,000"], ["part", "New", "50,000"],
      ["row", "Tokens out", "1,500"], ["part", "Reasoning", "600"], ["row", "Cost", "$0.02"], ["row", "Context", "42% of 200,000 tokens"], ["row", "Time worked", "1m 5s"],
      ["row", "Model", "gpt-5 · high"]]);
  });

  it("leaves new input out for Grok, whose input count may not hold its cache counts", async () => {
    render(measured(MessageStatus.Completed, new ReplyUsage(1_000, 10, null, null, 400), "grok"));
    await fixture.whenStable();

    expect(statRows(await openStats())).toEqual([["row", "Tokens in", "1,000"], ["part", "From cache", "400"], ["row", "Tokens out", "10"], ["row", "Time worked", "1m 5s"],
      ["row", "Model", "gpt-5 · high"]]);
  });

  it("shows a reply's context percentage on its button when it reports only context, and says in the panel that no tokens were reported", async () => {
    render(measured(MessageStatus.Completed, new ReplyUsage(null, null, null, new ContextUsage(84_000, 200_000, null))));
    await fixture.whenStable();

    expect(statsButton()?.textContent?.trim()).toBe("42% context");
    const view = await openStats();
    expect([view.querySelector(".stats-note")?.textContent?.trim(), statRows(view)]).toEqual([Resources.noTokensReportedText,
      [["row", "Context", "42% of 200,000 tokens"], ["row", "Time worked", "1m 5s"], ["row", "Model", "gpt-5 · high"]]]);
  });

  it("shows an icon-only stats button when nothing is reported, whose panel still says so, and no button while a reply works or for a person", async () => {
    render(measured(MessageStatus.Completed, null));
    await fixture.whenStable();
    const button = one(statsSelector);

    expect([button.textContent?.trim(), button.getAttribute("aria-label"), button.querySelector(".material-symbols-rounded")?.textContent?.trim()])
      .toEqual([Resources.statsGlyph, Resources.showStatsLabel, Resources.statsGlyph]);
    const view = await openStats();
    expect([view.querySelector(".stats-note")?.textContent?.trim(), statRows(view)]).toEqual([Resources.noTokensReportedText,
      [["row", "Time worked", "1m 5s"], ["row", "Model", "gpt-5 · high"]]]);
    fixture.destroy();

    render(measured(MessageStatus.Running, everyFigure));
    await fixture.whenStable();
    expect(statsButton()).toBeNull();
    await show(SampleData.userMessage);
    expect(element().querySelector(".stats-button")).toBeNull();
  });

  it("shows a failed reply's icon-only stats button when it reports only a cost, whose panel says no tokens were reported and lists the cost", async () => {
    render(measured(MessageStatus.Failed, new ReplyUsage(null, null, 0.0213, null)));
    await fixture.whenStable();

    expect([statsButton()?.textContent?.trim(), statsButton()?.getAttribute("aria-label")]).toEqual([Resources.statsGlyph, Resources.showStatsLabel]);
    const view = await openStats();
    expect([view.querySelector(".stats-note")?.textContent?.trim(), statRows(view)]).toEqual([Resources.noTokensReportedText,
      [["row", "Cost", "$0.02"], ["row", "Time worked", "1m 5s"], ["row", "Model", "gpt-5 · high"]]]);
  });

  it.each([MessageStatus.Cancelled, MessageStatus.Interrupted])("ends a %s reply with its stats button and opens its panel", async status => {
    render(measured(status, everyFigure));
    await fixture.whenStable();

    expect(statsButton()?.textContent?.trim()).toBe("260K in · 1.5K out");
    expect(statRows(await openStats())[0]).toEqual(["row", "Tokens in", "260,000"]);
  });

  it("names a reply's default model in its author's tooltip as its provider does", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()]);
    await Wait.until(() => expect(store().kinds().map(t => t.id)).toEqual(["codex", "copilot"]));
    const reply = (kind: string): Message => new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Cancelled, [],
      new Provenance(null, new RequestedSettings(kind, null, "medium"), new ObservedSettings(null, null, null, null), null, false),
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    const description = (): string | null => (fixture.debugElement.query(By.directive(MessageComponent)).componentInstance as MessageComponent).authorDescription();

    render(reply("copilot"));
    expect(description()).toBe("Auto · medium");

    render(reply("codex"));
    expect(description()).toBe("medium");
  });

  it("names a reply's model in its author's tooltip and its stats by the display name of its provider's model list once that list is loaded", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]));
    await Wait.until(() => expect(store().loaded()).toBe(true));
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed));
    const description = (): string | null => (fixture.debugElement.query(By.directive(MessageComponent)).componentInstance as MessageComponent).authorDescription();
    const before = description();

    await store().modelCatalogs.load("codex", "a1");

    await Wait.until(() => expect(description()).toBe("GPT-5 · high"));
    expect(before).toBe("gpt-5 · high");
  });

  it("puts a reply's state in its header after its author, its model and effort in the tooltip of its author's name and avatar, and greys an unavailable teammate", async () => {
    const teammates = new TeammateFixture(context);
    const reply = (teammate: Teammate): Message => new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Cancelled, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammate.id, teammate.name);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(reply(teammates.alice));
    const avatar = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-message-avatar");

    expect([...element().querySelector(".nol-message-header")?.children ?? []].map(t => t.textContent?.trim())).toEqual(["A", "Alice", "·\u00a0Codex", "Cancelled"]);
    expect((fixture.debugElement.query(By.directive(MessageComponent)).componentInstance as MessageComponent).authorDescription()).toBe("gpt-5 · high");
    expect(box(".nol-message-author").left).toBeGreaterThan(box(".nol-message-avatar").right);
    expect(Math.abs(middleOf(box(".nol-message-header .nol-chip")) - middleOf(box(".nol-message-author")))).toBeLessThanOrEqual(1);
    expect(element().querySelector(".nol-avatar-unavailable, .nol-message-author-unavailable")).toBeNull();

    await show(reply(teammates.unavailable));
    expect(textOf(".nol-message-author")).toBe("Offline");
    expect(avatar()?.classList.contains("nol-avatar-unavailable")).toBe(true);
    expect(element().querySelector(".nol-message-author-unavailable")).not.toBeNull();
  });

  it.each([ThemeMode.Light, ThemeMode.Dark])("names a teammate's reply's provider a space-1 gap after its name, smaller and centred on it, in a header as tall as an unnamed reply's, and cuts the provider first in a narrow chat, in %s", async mode => {
    AppearanceFixture.apply(FixtureTheme.theme, mode);
    const teammates = new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    const reply = (teammateId: string | null, teammateName: string | null): Message => new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Cancelled,
      [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammateId, teammateName);
    const size = (selector: string): number => parseFloat(getComputedStyle(one(selector)).fontSize);
    render(reply(null, null));
    const unnamed = box(".nol-message-header").height;
    expect([textOf(".nol-message-author"), element().querySelector(".reply-provider")]).toEqual(["Codex · Work", null]);

    await show(reply(teammates.alice.id, teammates.alice.name));
    const [name, provider, header] = [box(".nol-message-author"), box(".reply-provider"), box(".nol-message-header")];
    expect([textOf(".nol-message-author"), textOf(".reply-provider"), size(".reply-provider") < size(".nol-message-author")]).toEqual(["Alice", "·\u00a0Codex", true]);
    AppearanceFixture.expectPixels(provider.left - name.right, AppearanceFixture.measureLook("space-1"));
    AppearanceFixture.expectPixels(middleOf(provider), middleOf(name));
    AppearanceFixture.expectPixels(header.height, unnamed);

    const free = header.right - Math.max(...[...one(".nol-message-header").children].map(t => t.getBoundingClientRect().right));
    element().style.setProperty("width", `${element().getBoundingClientRect().width - free - provider.width / 2}px`);
    const cut = one(".reply-provider");
    expect([cut.scrollWidth > cut.clientWidth, cut.clientWidth > 0, getComputedStyle(cut).textOverflow, one(".nol-message-author").scrollWidth <= one(".nol-message-author").clientWidth])
      .toEqual([true, true, "ellipsis", true]);
    AppearanceFixture.expectPixels(box(".nol-message-header").height, unnamed);
    expect(box(".nol-message-header .nol-chip").right).toBeLessThanOrEqual(box(".nol-message-header").right + 0.5);
  });

  it("names the provider a reply ran on, after its provider is removed or its teammate moves to another", async () => {
    const teammates = new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
      new Provenance("removed", new RequestedSettings("claude", null, null), new ObservedSettings("claude", null, null, "1.0"), "s1", false),
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammates.alice.id, teammates.alice.name));

    expect([textOf(".nol-message-author"), textOf(".reply-provider")]).toEqual(["Alice", "·\u00a0Claude Code"]);
  });

  it("shows a reply's model and effort under its teammate's name in the kit's tooltip, a space-2 gap above the name or the avatar and centred on it, on hover over either and on the name's focus, its state chip a header gap after its provider", async () => {
    const teammates = new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Cancelled, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp,
      SampleData.timestamp, [], teammates.alice.id, teammates.alice.name));
    element().style.setProperty("padding", "10rem 12rem");
    const gap = AppearanceFixture.measureLook("space-2");
    const tooltipAsync = async (anchor: HTMLElement): Promise<(string | undefined)[]> => Wait.until(() => {
      const parts = [...document.querySelectorAll(".cdk-overlay-container nol-tooltip :is(.nol-tooltip-title, .nol-tooltip-description)")].map(t => t.textContent?.trim());
      const pane = document.querySelector(".cdk-overlay-container .nol-tooltip-pane")?.getBoundingClientRect() ?? new DOMRect();
      const host = anchor.getBoundingClientRect();
      expect(parts).toHaveLength(2);
      AppearanceFixture.expectPixels(host.top - pane.bottom, gap);
      AppearanceFixture.expectPixels(pane.left + pane.width / 2, host.left + host.width / 2);
      return parts;
    });
    const hiddenAsync = async (): Promise<void> => Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
    const shown = (selector: string): HTMLElement => {
      const found = element().querySelector<HTMLElement>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    };
    const [name, avatar] = await Wait.until(() => {
      expect(shown(".nol-message-author").tabIndex).toBe(0);
      return [shown(".nol-message-author"), shown(".nol-message-avatar")] as const;
    });

    await userEvent.hover(name);
    const overName = await tooltipAsync(name);
    await userEvent.unhover(name);
    await hiddenAsync();
    await userEvent.hover(avatar);
    const overAvatar = await tooltipAsync(avatar);
    await userEvent.unhover(avatar);
    await hiddenAsync();
    TestBed.inject(FocusMonitor).focusVia(name, "keyboard");
    const focused = await tooltipAsync(name);

    expect([overName, overAvatar, focused, document.activeElement === name, name.tabIndex, element().querySelector(".nol-message-header")?.textContent?.includes("gpt-5")])
      .toEqual([["Alice", "gpt-5 · high"], ["Alice", "gpt-5 · high"], ["Alice", "gpt-5 · high"], true, 0, false]);
    expect(Math.abs(box(".nol-message-header .nol-chip").left - box(".reply-provider").right - (box(".nol-message-author").left - box(".nol-message-avatar").right)))
      .toBeLessThanOrEqual(1);
  });

  it("paints each teammate's avatar in the teammate's own colour, as the Explorer does, and shows none on the person's bubble", async () => {
    const paint = (): string => element().querySelector<HTMLElement>(".nol-message-avatar")?.style.getPropertyValue("--nol-avatar-fill") ?? "";
    const avatar = TestBed.createComponent(AvatarComponent);
    avatar.componentRef.setInput("name", "Reviewer");
    const kitPaint = (teammateId: string): string => {
      avatar.componentRef.setInput("colorKey", teammateId);
      avatar.detectChanges();
      return (avatar.nativeElement as HTMLElement).style.getPropertyValue("--nol-avatar-fill");
    };
    const reply = (id: string, teammateId: string, name: string): Message => new Message(id, "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammateId, name);
    render(reply("m6", "t1", "Reviewer"));
    const first = paint();

    await show(reply("m7", "t2", "Writer"));
    const second = paint();
    await show(new Message("m8", "c1", 6, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Thanks.")], null, SampleData.timestamp,
      null, SampleData.timestamp));

    expect(first).not.toBe(second);
    expect([first, second]).toEqual([kitPaint("t1"), kitPaint("t2")]);
    expect(element().querySelector(".nol-message-avatar")).toBeNull();
  });

  it("draws a reply's avatar with the letter and colours the members row and the composer give its teammate, the Default's for a Default reply", async () => {
    const teammates = new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    const look = (avatar: HTMLElement | null): string[] => [avatar?.textContent?.trim() ?? "", avatar?.style.getPropertyValue("--nol-avatar-fill") ?? "",
      avatar?.style.getPropertyValue("--nol-avatar-letter") ?? ""];
    const member = TestBed.createComponent(TeammateAvatarComponent);
    member.componentRef.setInput("teammate", null);
    const memberLook = (teammate: Teammate | null): string[] => {
      member.componentRef.setInput("teammate", teammate);
      member.detectChanges();
      return look((member.nativeElement as HTMLElement).querySelector("nol-avatar"));
    };
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, []));
    const byDefault = look(element().querySelector(".nol-message-avatar"));

    await show(new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, SampleData.timestamp, [], teammates.alice.id, teammates.alice.name));
    const byAlice = look(element().querySelector(".nol-message-avatar"));

    expect(textOf(".nol-message-author")).toBe("Alice");
    expect([byDefault, byAlice]).toEqual([memberLook(null), memberLook(teammates.alice)]);
    expect([byDefault[0], byAlice[0]]).toEqual(["D", "A"]);
    expect(byDefault[1]).not.toBe(byAlice[1]);
  });

  it("marks the teammates a teammate's reply mentions as it marks them in the person's message", async () => {
    const teammates = new TeammateFixture(context);
    const text = [detail(0, DetailKind.Text, "Over to @Bob, then @Alice")];
    const marks = (): (string | null)[] => [...element().querySelectorAll(".nol-markdown-mention")].map(t => t.textContent);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    render(new Message("m6", "c1", 5, MessageAuthor.Provider, "m1", MessageStatus.Completed, text, SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammates.alice.id, teammates.alice.name));
    await Wait.until(() => expect(marks()).toEqual(["@Bob", "@Alice"]));

    await show(new Message("m7", "c1", 6, MessageAuthor.User, null, MessageStatus.Completed, text, null, SampleData.timestamp, null, SampleData.timestamp));
    await Wait.until(() => expect(element().querySelector(".nol-message-avatar")).toBeNull());
    expect(marks()).toEqual(["@Bob", "@Alice"]);
  });

  it.each([
    { provider: "claude", model: "claude-opus-5", look: { tool: "Bash", toolUseId: "t1" }, check: { tool: "Bash", toolUseId: "t3" } },
    { provider: "codex", model: "gpt-5", look: { command: "ls", cwd: "D:\\repo", exitCode: 0, status: "completed" },
      check: { command: "npm test", cwd: "D:\\repo", exitCode: 0, status: "completed" } },
    { provider: "grok", model: "grok-4", look: { toolCallId: "call-1", status: "completed", files: [], tool: "execute" },
      check: { toolCallId: "call-3", status: "completed", files: [], tool: "execute" } },
    { provider: "copilot", model: "claude-sonnet-4.5", look: { toolCallId: "toolu_1", kind: "execute", status: "completed", rawInput: { command: "ls" }, files: [], tool: "execute" },
      check: { toolCallId: "toolu_3", kind: "execute", status: "completed", rawInput: { command: "npm test" }, files: [], tool: "execute" } }
  ])("shows $provider's text before its last step at the answer's edge with no bar while it works, and among its steps in its order once it ends or is reopened", async ({ provider, model, look, check }) => {
    const reply = (status: MessageStatus, id: string = "m2"): Message => SampleData.withStatus(new Message(id, "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [
      detail(0, DetailKind.Text, "First a look."), detail(1, DetailKind.Command, "> ls", look), detail(2, DetailKind.Text, "Then a check."),
      detail(3, DetailKind.Command, "> npm test", check), detail(4, DetailKind.Text, "Done.")
    ], new Provenance("a1", new RequestedSettings(provider, model, null), new ObservedSettings(provider, model, null, "1.0"), "s1", false),
    SampleData.timestamp, SampleData.timestamp, null), status);
    const replyTexts = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-markdown-view")].filter(t => t.closest("nol-teamrun-activity-block") === null);
    const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-activity-block .calls > li")];
    const expectInterim = (text: HTMLElement): void => {
      const shown = getComputedStyle(text);
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      const muted = getComputedStyle(probe).color;
      probe.remove();
      AppearanceFixture.expectPixels(parseFloat(shown.borderInlineStartWidth), AppearanceFixture.measureLook("border-width") * 2);
      AppearanceFixture.expectPixels(parseFloat(shown.paddingInlineStart), AppearanceFixture.measureLook("space-3"));
      expect(shown.color).toBe(muted);
    };
    const expectFolded = async (): Promise<void> => {
      await Wait.until(() => expect(replyTexts().map(t => t.textContent?.trim())).toEqual(["Done."]), MarkdownWait.coldImport);
      expect(element().querySelector(".nol-message-interim")).toBeNull();
      expect(textOf(".activity-toggle .activity-text")).toBe("Worked for 0s");
      await click(element().querySelector(".activity-toggle"));
      await Wait.until(() => expect(rows().map(t => t.querySelector(".step-text")?.textContent?.trim() ?? null)).toEqual(["First a look.", null, "Then a check.", null]),
        MarkdownWait.coldImport);
      const block = element().querySelector<HTMLElement>("nol-teamrun-activity-block")!.getBoundingClientRect();
      const [first, listed, second, tested] = rows().map(t => t.getBoundingClientRect());
      expect(rows().map(t => t.querySelector("nol-tool-call") !== null)).toEqual([false, true, false, true]);
      expect(textOf("nol-teamrun-activity-block .summary")).toBe("Ran 2 commands");
      for (const text of element().querySelectorAll<HTMLElement>("nol-teamrun-activity-block .step-text")) {
        expectInterim(text);
        AppearanceFixture.expectPixels(text.getBoundingClientRect().left, listed!.left);
      }
      AppearanceFixture.expectPixels(listed!.top - first!.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(second!.top - listed!.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(tested!.top - second!.bottom, AppearanceFixture.measureLook("space-1"));
      expect(replyTexts()[0]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(block.bottom);
      AppearanceFixture.expectPixels(replyTexts()[0]!.getBoundingClientRect().left, block.left);
    };
    render(reply(MessageStatus.Running));

    await Wait.until(() => expect(replyTexts()).toHaveLength(3), MarkdownWait.coldImport);
    expect(replyTexts().map(t => [t.textContent?.trim(), t.classList.contains("nol-message-interim")])).toEqual([
      ["First a look.", false], ["Then a check.", false], ["Done.", false]
    ]);
    expect(element().querySelector("nol-teamrun-activity-block")).toBeNull();
    for (const text of replyTexts().slice(0, 2)) {
      expect(parseFloat(getComputedStyle(text).borderInlineStartWidth)).toBe(0);
      AppearanceFixture.expectPixels(text.getBoundingClientRect().left, replyTexts()[2]!.getBoundingClientRect().left);
    }
    expect(replyTexts()[1]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(replyTexts()[0]!.getBoundingClientRect().bottom);

    await show(reply(MessageStatus.Completed));
    await expectFolded();

    render(reply(MessageStatus.Completed, "m3"));
    await expectFolded();
  });

  it("keeps a working reply's text at one left edge with no bar from its first word, before and after a work row arrives below it", async () => {
    const text = detail(0, DetailKind.Text, "First a look.");
    const running = (...details: MessageDetail[]): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running, details);
    const start = (): number => {
      const range = document.createRange();
      range.selectNodeContents(one(".nol-markdown-view"));
      return range.getBoundingClientRect().left;
    };
    const bar = (): number => parseFloat(getComputedStyle(one(".nol-markdown-view")).borderInlineStartWidth);
    render(running(text));
    await Wait.until(() => expect(textOf(".nol-markdown-view")).toBe("First a look."), MarkdownWait.coldImport);
    const before = start();
    expect(bar()).toBe(0);

    await show(running(text, detail(1, DetailKind.Command, "> ls", { tool: "Bash" })));
    expect(element().querySelector(".activity-step")).not.toBeNull();
    expect(one(".nol-markdown-view").classList.contains("nol-message-interim")).toBe(false);
    expect(bar()).toBe(0);
    AppearanceFixture.expectPixels(start(), before);
  });

  it.each([MessageStatus.Cancelled, MessageStatus.Interrupted, MessageStatus.Failed])(
    "keeps a reply's text before its last step as it showed while working once the reply ends as %s: the same left edge and colour, with no bar", async status => {
      const details = [detail(0, DetailKind.Text, "First a look."), detail(1, DetailKind.Command, "> ls", { tool: "Bash" })];
      const view = (): HTMLElement => one(".nol-markdown-view");
      const start = (): number => {
        const range = document.createRange();
        range.selectNodeContents(view());
        return range.getBoundingClientRect().left;
      };
      const look = (): readonly string[] => [getComputedStyle(view()).borderInlineStartWidth, getComputedStyle(view()).color,
        String(view().classList.contains("nol-message-interim"))];
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, details));
      await Wait.until(() => expect(textOf(".nol-markdown-view")).toBe("First a look."), MarkdownWait.coldImport);
      const [edge, working] = [start(), look()];

      await show(SampleData.withStatus(SampleData.reply, status, status === MessageStatus.Failed ? [...details, detail(2, DetailKind.Error, "The provider failed.")] : details));

      expect(textOf(".nol-markdown-view")).toBe("First a look.");
      expect(look()).toEqual(working);
      expect(working).toEqual(["0px", working[1], "false"]);
      AppearanceFixture.expectPixels(start(), edge);
    });

  it("copies a reply's narration, errors and answer in order as markdown under Copy message, and a person's message as the kit does", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Text, "Building **first**."),
      detail(1, DetailKind.Command, "> npm run build", { tool: "Bash", toolUseId: "t1" }),
      detail(2, DetailKind.Error, "The build failed: `a.ts`."),
      detail(3, DetailKind.Command, "> npm run build", { tool: "Bash", toolUseId: "t2" }),
      detail(4, DetailKind.Text, " "),
      detail(5, DetailKind.Text, "Fixed:\n\n- `a.ts`")
    ]));
    await fixture.whenStable();
    const writer = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;
    const copy = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>(".nol-message-copy") as HTMLButtonElement;

    expect(copy().getAttribute("aria-label")).toBe("Copy message");
    await click(copy());
    await Wait.until(() => expect(writer.texts).toEqual(["Building **first**.\n\nThe build failed: `a.ts`.\n\nFixed:\n\n- `a.ts`"]));

    render(SampleData.userMessage);
    await fixture.whenStable();
    await click(copy());
    await Wait.until(() => expect(writer.texts).toEqual([writer.texts[0], "hello"]));
  });

  describe("the focus once a card is decided", () => {
    let article: HTMLElement | null = null;
    const at = (minute: number): string => `2026-09-10T08:0${minute}:00.000Z`;
    const tool = (id: string, createdAt: string = SampleData.timestamp): Approval => new Approval(id, "m2", ApprovalKind.Tool, "tool", `read ${id}`, null,
      SampleData.approval.options, ApprovalStatus.Pending, null, createdAt, null);
    const answerOrSkip = [new ApprovalOption(Resources.answerOptionId, "Answer", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.skipOptionId, "Skip", ApprovalOutcome.Denied, ApprovalScope.Once)];
    const asking = (id: string, createdAt: string = SampleData.timestamp): Approval => new Approval(id, "m2", ApprovalKind.Question, "AskUserQuestion",
      "Which platform?", null, answerOrSkip, ApprovalStatus.Pending, null, createdAt, null, question().questions);
    const said = (sequence: number, text: string, minute: number): MessageDetail => new MessageDetail(sequence, DetailKind.Text, text, null, at(minute));
    const cardOf = (id: string): HTMLElement | null => element().querySelector<HTMLElement>(`[data-nol-teamrun-approval="${id}"]`);
    const one = <T extends Element>(root: ParentNode, selector: string): T => {
      const found = root.querySelector<T>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    };
    const shownCard = (id: string): HTMLElement => one<HTMLElement>(element(), `[data-nol-teamrun-approval="${id}"]`);
    const firstChoice = (id: string): HTMLInputElement | null => cardOf(id)?.querySelector<HTMLInputElement>("input[type='radio']") ?? null;
    const groups = (): number => element().querySelectorAll("nol-teamrun-reply-approvals").length;
    const decideFrom = (approvals: readonly Approval[]): void => {
      context.answer(MethodName.ApprovalDecide, parameters => {
        const { approvalId, optionId } = ApprovalDecideParams.fromJson(parameters);
        const decided = approvals.find(t => t.id === approvalId);
        if (Object.isUndefined(decided))
          throw new Error(`No approval ${approvalId} to decide.`);
        return decided.withDecision(optionId, decidedAt).toJson();
      });
    };
    const showWith = async (message: Message, approvals: readonly Approval[]): Promise<void> => {
      context.answer(MethodName.ApprovalList, () => approvals.map(t => t.toJson()));
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      await Wait.until(() => expect(store().approvalsOf("m2")).toHaveLength(approvals.length));
      render(message);
      await Wait.until(() => expect(element().querySelector("[data-nol-teamrun-approval]")).not.toBeNull());
      article = document.body.appendChild(document.createElement("div"));
      article.setAttribute("role", "article");
      article.tabIndex = -1;
      article.append(element());
    };
    const choose = async (id: string, optionId: string): Promise<void> => {
      const button = one<HTMLButtonElement>(shownCard(id), `[data-nol-option="${optionId}"]`);
      button.focus();
      await click(button);
      await Wait.until(() => expect(cardOf(id)).toBeNull());
    };

    afterEach(() => {
      article?.remove();
      article = null;
    });

    it("moves the focus from Answer to the reply once the questions are answered, and keeps the card with its answers", async () => {
      const answer = new DeferredResponse();
      context.answer(MethodName.ApprovalDecide, () => answer.promise);
      await showWith(awaiting(), [asking("q1")]);
      const submit = (): HTMLButtonElement => one<HTMLButtonElement>(shownCard("q1"), ".nol-teamrun-question-card-submit");

      await click(firstChoice("q1"));
      submit().focus();
      await click(submit());
      await Wait.until(() => expect(submit().getAttribute("aria-busy")).toBe("true"));
      expect(document.activeElement).toBe(submit());
      answer.resolve(asking("q1").withDecision(Resources.answerOptionId, decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());

      await Wait.until(() => expect(document.activeElement).toBe(article));
      expect(cardOf("q1")?.querySelector(".nol-teamrun-question-card-reply")?.textContent?.trim()).toBe("Web");
    });

    it("moves the focus from Skip to the reply once the questions are skipped", async () => {
      context.answer(MethodName.ApprovalDecide, () => asking("q1").withDecision(Resources.skipOptionId, decidedAt).toJson());
      await showWith(awaiting(), [asking("q1")]);
      const skip = one<HTMLButtonElement>(shownCard("q1"), ".nol-teamrun-question-card-skip");

      skip.focus();
      await click(skip);

      await Wait.until(() => expect(document.activeElement).toBe(article));
      expect(cardOf("q1")).not.toBeNull();
    });

    it("moves the focus from a decided card to the next one, then to the one before it, and to the reply once none is left", async () => {
      const approvals = [SampleData.approval, tool("ap2"), tool("ap3")];
      decideFrom(approvals);
      await showWith(awaiting(), approvals);

      expect(cards().map(t => t.getAttribute("data-nol-teamrun-approval"))).toEqual(["ap1", "ap2", "ap3"]);
      await choose("ap2", "yes");
      await Wait.until(() => expect(document.activeElement).toBe(cardOf("ap3")));
      await choose("ap3", "no");
      await Wait.until(() => expect(document.activeElement).toBe(cardOf("ap1")));
      await choose("ap1", "yes");

      await Wait.until(() => expect(document.activeElement).toBe(article));
      expect(context.count(MethodName.ApprovalDecide)).toBe(3);
    });

    it("moves the focus from a decided card to the next question card's first enabled control, as the card itself takes none", async () => {
      decideFrom([SampleData.approval]);
      await showWith(awaiting(), [SampleData.approval, asking("q1")]);

      await choose("ap1", "yes");

      await Wait.until(() => expect(document.activeElement).toBe(firstChoice("q1")));
      expect(cardOf("q1")?.hasAttribute("tabindex")).toBe(false);
    });

    it("moves the focus to a question card's Answer button while its answer is still sending, as its choices are disabled then", async () => {
      const held = new DeferredResponse();
      context.answer(MethodName.ApprovalDecide, t => ApprovalDecideParams.fromJson(t).approvalId === "q1" ? held.promise
        : SampleData.approval.withDecision("yes", decidedAt).toJson());
      await showWith(awaiting(), [SampleData.approval, asking("q1")]);
      void store().decide("q1", Resources.skipOptionId);
      await Wait.until(() => expect(firstChoice("q1")?.getAttribute("aria-disabled")).toBe("true"));

      await choose("ap1", "yes");

      const answer = [...shownCard("q1").querySelectorAll("button")].find(t => t.textContent?.trim() === Resources.questionAnswerLabel);
      await Wait.until(() => expect(document.activeElement).toBe(answer));
      expect(answer?.getAttribute("aria-disabled")).toBe("true");
      held.resolve(asking("q1").withDecision(Resources.skipOptionId, decidedAt).toJson());
    });

    it("leaves the focus on another control of the same message when the card it left is decided in another window", async () => {
      await showWith(awaiting(), [SampleData.approval]);
      const elsewhere = element().appendChild(document.createElement("button"));
      shownCard("ap1").focus();
      expect(document.activeElement).toBe(cardOf("ap1"));
      elsewhere.focus();

      context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("yes", decidedAt).toJson());
      await Wait.until(() => expect(cardOf("ap1")).toBeNull());
      await fixture.whenStable();

      expect(document.activeElement).toBe(elsewhere);
    });

    it("leaves the focus on the page when the card it left by a click on a blank area is decided in another window", async () => {
      await showWith(awaiting(), [SampleData.approval]);
      shownCard("ap1").focus();
      expect(document.activeElement).toBe(cardOf("ap1"));
      shownCard("ap1").blur();
      expect(document.activeElement).toBe(document.body);

      context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("yes", decidedAt).toJson());
      await Wait.until(() => expect(cardOf("ap1")).toBeNull());
      await fixture.whenStable();

      expect(document.activeElement).toBe(document.body);
    });

    it("moves the focus to a later group's waiting card when the decided card was the only one in its group, which goes", async () => {
      const early = tool("ap2", at(2));
      decideFrom([early]);
      await showWith(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [said(0, "First.", 1), said(1, "Then.", 3)]),
        [early, asking("q1", at(4))]);
      expect(groups()).toBe(2);

      await choose("ap2", "yes");

      await Wait.until(() => expect(document.activeElement).toBe(firstChoice("q1")));
      expect(groups()).toBe(1);
    });

    it("moves the focus to a later group's waiting card when an answered question stays in the decided card's group", async () => {
      const early = tool("ap2", at(2));
      const answered = asking("q1", at(2)).withDecision(Resources.answerOptionId, decidedAt, [new QuestionAnswer("platform", ["Web"], null)]);
      decideFrom([early]);
      await showWith(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [said(0, "First.", 1), said(1, "Then.", 3)]),
        [early, answered, tool("ap3", at(4))]);
      expect(groups()).toBe(2);

      await choose("ap2", "yes");

      await Wait.until(() => expect(document.activeElement).toBe(cardOf("ap3")));
      expect([groups(), Object.isNull(cardOf("q1"))]).toEqual([2, false]);
    });

    it("keeps a waiting card and its chosen answer when a later part moves its group up from the reply's end", async () => {
      const first = said(0, "First.", 1);
      await showWith(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [first]), [asking("q1", at(2))]);
      const card = shownCard("q1");
      one<HTMLInputElement>(card, "input[type='radio']").click();
      await fixture.whenStable();
      expect(firstChoice("q1")?.checked).toBe(true);

      await show(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval, [first, said(1, "Meanwhile, more.", 3)]));
      const later = (): DOMRect => [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === "Meanwhile, more.")?.getBoundingClientRect() ?? new DOMRect();
      await Wait.until(() => expect(later().height).toBeGreaterThan(0), MarkdownWait.coldImport);

      expect(cardOf("q1")).toBe(card);
      expect([card.isConnected, firstChoice("q1")?.checked]).toEqual([true, true]);
      expect(card.getBoundingClientRect().bottom).toBeLessThan(later().top);
    });
  });

  describe("a chat's id in a reply", () => {
    const id = "0192e4f0-7c1a-7b2e-9d3f-5a6b7c8d9e0f";
    const unknown = "0192e4f0-7c1a-7b2e-9d3f-000000000000";
    const text = `Astra messaged me from chat ${id}, not ${unknown}.`;
    const replyWith = (status: MessageStatus, said: string): Message => SampleData.withStatus(SampleData.reply, status, [detail(0, DetailKind.Text, said)]);
    const links = (): string[] => [...element().querySelectorAll("a.nol-markdown-link")].map(t => t.textContent?.trim() ?? "");

    beforeEach(async () => {
      const release = new Conversation(id, null, "Release plan", SampleData.timestamp, SampleData.timestamp);
      context.answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? [release.toJson()] : [SampleData.conversation.toJson()]);
      await Wait.until(() => expect(store().loaded()).toBe(true));
    });

    it("shows a known chat's id as a link titled with the chat's name that opens the chat, while Copy keeps the raw id", async () => {
      render(replyWith(MessageStatus.Completed, text));
      await Wait.until(() => expect(links()).toEqual(["Release plan"]), MarkdownWait.coldImport);
      const writer = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;

      expect(textOf(".nol-markdown-view")).toBe(`Astra messaged me from chat Release plan, not ${unknown}.`);
      await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));
      expect(context.openedDocuments.at(-1)).toMatchObject({ name: Resources.conversationDocumentName, instance: id, title: "Release plan" });
      expect(context.links).toEqual([]);
      await click(element().querySelector<HTMLElement>(".nol-message-copy"));
      await Wait.until(() => expect(writer.texts).toEqual([text]));
    });

    it("keeps an id at a streaming reply's end as text until more of the reply follows it, and links it once the reply ends", async () => {
      render(replyWith(MessageStatus.Running, `from chat ${id.slice(0, 20)}`));
      await Wait.until(() => expect(textOf(".nol-markdown-view")).toBe(`from chat ${id.slice(0, 20)}`), MarkdownWait.coldImport);
      await show(replyWith(MessageStatus.Running, `from chat ${id}`));
      await frames(() => textOf(".nol-markdown-view") === `from chat ${id}`);
      expect([textOf(".nol-markdown-view"), links()]).toEqual([`from chat ${id}`, []]);

      await show(replyWith(MessageStatus.Running, `from chat ${id} and`));
      await frames(() => links().includes("Release plan"));
      expect(links()).toEqual(["Release plan"]);
      await show(replyWith(MessageStatus.Completed, `from chat ${id}`));
      await frames(() => textOf(".nol-markdown-view") === "from chat Release plan");
      expect(textOf(".nol-markdown-view")).toBe("from chat Release plan");
    });

    it("follows the chat's rename after the reply shows, and shows the raw id once the chat is deleted", async () => {
      context.answer(MethodName.ConversationRename, t => new Conversation(id, null, ConversationRenameParams.fromJson(t).title, SampleData.timestamp, SampleData.timestamp).toJson());
      render(replyWith(MessageStatus.Completed, text));
      await Wait.until(() => expect(links()).toEqual(["Release plan"]), MarkdownWait.coldImport);

      await store().renameConversation(id, "Ship plan");
      await Wait.until(() => expect(links()).toEqual(["Ship plan"]));
      context.emit(EventName.ConversationDeleted, new ConversationIdParams(id).toJson());
      await Wait.until(() => expect(textOf(".nol-markdown-view")).toBe(text));
      expect(links()).toEqual([]);
    });

    it("opens nothing for a teamrun-chat link to a chat the window doesn't hold", async () => {
      render(replyWith(MessageStatus.Completed, `See [the gone chat](teamrun-chat:${unknown}).`));
      await Wait.until(() => expect(links()).toEqual(["the gone chat"]), MarkdownWait.coldImport);
      const opened = context.openedDocuments.length;

      await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));
      expect([context.openedDocuments.length, context.links]).toEqual([opened, []]);
    });
  });

  it("offers Rewind to here before Copy under the person's own message, and rewinds from it in its dialog", async () => {
    context.answer(MethodName.ConversationRewind, () => new ConversationRewindResult(SampleData.conversation, ["m1", "m2"], 2, true).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.userMessage);

    expect([...element().querySelectorAll(".nol-message-actions button")].map(t => t.classList.contains("nol-teamrun-rewind"))).toEqual([true, false]);
    expect(element().querySelector(".nol-teamrun-rewind")?.getAttribute("aria-label")).toBe(Resources.rewindLabel);
    expect(textOf(".nol-teamrun-rewind .nol-icon-button-glyph")).toBe(Resources.rewindGlyph);
    expect(box(".nol-teamrun-rewind").right).toBeLessThanOrEqual(box(".nol-message-copy").left);
    expect(box(".nol-message-copy").right).toBeLessThanOrEqual(box(".nol-message-time").left);

    await click(element().querySelector(".nol-teamrun-rewind"));
    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.rewindTitle);
    await Wait.until(() => expect(document.activeElement).toBe(document.querySelector(".nol-teamrun-confirm")));

    document.querySelector<HTMLButtonElement>(".nol-teamrun-confirm")?.click();
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());

    expect(context.parametersOf(MethodName.ConversationRewind)).toEqual(new ConversationRewindParams("c1", "m1", true).toJson());
    expect(store().history()?.held).toEqual([]);
  });

  it("leaves the conversation as it was when the Rewind dialog closes without rewinding", async () => {
    render(SampleData.userMessage);

    await click(element().querySelector(".nol-teamrun-rewind"));
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());

    expect(context.count(MethodName.ConversationRewind)).toBe(0);
  });

  it.each([
    { kind: "a reply", message: SampleData.withStatus(SampleData.reply, MessageStatus.Completed) },
    { kind: "TeamRun's own message", message: new Message("m7", "c1", 6, MessageAuthor.TeamRun, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp) }
  ])("offers no Rewind on $kind", ({ message }) => {
    render(message);

    expect(element().querySelector(".nol-teamrun-rewind")).toBeNull();
    expect(element().querySelector(".nol-message-copy")).not.toBeNull();
  });

  it("shows one card per page a reply showed or edited, after its text, the latest step's page for each, and none for a failed show", async () => {
    const first = SamplePages.page("p1", "Onboarding options");
    const second = SamplePages.page("p1", "Onboarding options", 2);
    const checklist = SamplePages.page("p2", "Launch checklist");
    context.answerModule(SamplePages.list, () => [second.toJson(), checklist.toJson()]);
    const paged = [
      detail(0, DetailKind.Note, "Show a page", { tool: "mcp__teamrun__teamrun_show_page", toolUseId: "u1", input: { path: "options.html", title: "Onboarding options" } }),
      detail(1, DetailKind.Note, JSON.stringify(first.toJson()), { toolUseId: "u1" }),
      detail(2, DetailKind.Note, "Edit a page", { tool: "mcp__teamrun__teamrun_edit_page", toolUseId: "u2", input: { page_id: "p1", base_version: 1 } }),
      detail(3, DetailKind.Note, JSON.stringify(second.toJson()), { toolUseId: "u2" }),
      detail(4, DetailKind.Note, "Show a page", { tool: "mcp__teamrun__teamrun_show_page", toolUseId: "u3", input: { path: "big.html", title: "Big" } }),
      detail(5, DetailKind.Note, "The page is too large.", { toolUseId: "u3", isError: true }),
      detail(6, DetailKind.Note, `MCP tool teamrun/teamrun_show_page\n${JSON.stringify(checklist.toJson())}`, { server: "teamrun", tool: "teamrun_show_page", status: "completed" }),
      detail(7, DetailKind.Text, "Here are three options, each kept to one screen.")
    ];

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, paged));
    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-page-card .title")).toHaveLength(2));

    const cards = [...element().querySelectorAll<HTMLElement>("nol-teamrun-page-card")];
    const text = [...element().querySelectorAll<HTMLElement>(".nol-markdown-view")].at(-1);
    expect(cards.map(t => [t.querySelector(".title")?.textContent?.trim(), t.querySelector(".meta-text")?.textContent?.trim()]))
      .toEqual([["Onboarding options", "v2 · Made by Opus · Edited by Opus · just now"], ["Launch checklist", "Page · v1 · Made by Opus · just now"]]);
    expect(cards.map(t => Object.isUndefined(text) ? null : text.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING))
      .toEqual([Node.DOCUMENT_POSITION_FOLLOWING, Node.DOCUMENT_POSITION_FOLLOWING]);
    AppearanceFixture.expectPixels((cards[0]?.getBoundingClientRect().top ?? 0) - (text?.getBoundingClientRect().bottom ?? 0), AppearanceFixture.measureLook("space-2"));
    AppearanceFixture.expectPixels((cards[1]?.getBoundingClientRect().top ?? 0) - (cards[0]?.getBoundingClientRect().bottom ?? 0), AppearanceFixture.measureLook("space-2"));
  });

  it("shows a running edit's page on its card while the reply's edit runs, and the edited page once it ends", async () => {
    const page = SamplePages.page("p1", "Onboarding options");
    context.answerModule(SamplePages.list, () => [page.toJson()]);
    const call = detail(0, DetailKind.Note, "Edit a page", { tool: "mcp__teamrun__teamrun_edit_page", toolUseId: "u1", input: { page_id: "p1", base_version: 1 } });

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [call]));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-page-card .meta-text")?.textContent?.trim()).toBe("Page · v1 · Made by Opus · just now"));
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
      [call, detail(1, DetailKind.Note, JSON.stringify(SamplePages.page("p1", "Onboarding options", 2).toJson()), { toolUseId: "u1" })]));

    await Wait.until(() => expect(element().querySelector("nol-teamrun-page-card .meta-text")?.textContent?.trim()).toBe("v2 · Made by Opus · Edited by Opus · just now"));
  });

  it("shows no one editing a page once the running reply's edit of it failed", async () => {
    const page = SamplePages.page("p1", "Onboarding options");
    const checklist = SamplePages.page("p2", "Launch checklist");
    context.answerModule(SamplePages.list, () => [page.toJson(), checklist.toJson()]);
    const paged = [
      detail(0, DetailKind.Note, "Edit a page", { tool: "mcp__teamrun__teamrun_edit_page", toolUseId: "u1", input: { page_id: "p1", base_version: 0 } }),
      detail(1, DetailKind.Note, "The page has a newer version, v1.", { toolUseId: "u1", isError: true }),
      detail(2, DetailKind.Note, "Show a page", { tool: "mcp__teamrun__teamrun_show_page", toolUseId: "u2", input: { path: "checklist.html", title: "Launch checklist" } }),
      detail(3, DetailKind.Note, JSON.stringify(checklist.toJson()), { toolUseId: "u2" })
    ];

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, paged));
    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-page-card .title")).toHaveLength(1));

    expect([[...element().querySelectorAll("nol-teamrun-page-card .title")].map(t => t.textContent?.trim()), element().querySelectorAll("nol-teamrun-page-card nol-spinner").length])
      .toEqual([["Launch checklist"], 0]);
  });

  it("shows the images a finished reply wrote in its project after the files it edited, each opening in the viewer among them", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 20;
    const url = canvas.toDataURL("image/png");
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson());
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage], false, false).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    const wrote = [
      detail(0, DetailKind.FileChange, "Wrote the charts", { changes: [{ path: "D:\\repo\\out\\chart.png", kind: "add" }, { path: "D:\\repo\\old.png", kind: "delete" },
        { path: "D:\\repo\\a.ts", kind: "update" }] }),
      detail(1, DetailKind.Text, "Saved D:\\repo\\out\\graph.png and D:\\elsewhere\\x.png.")
    ];

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, wrote));
    expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, wrote));
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-image-frame")).toHaveLength(2));

    const previews = [...element().querySelectorAll<HTMLElement>("nol-teamrun-image-preview")];
    const files = element().querySelector("nol-teamrun-edited-files");
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(previews.map(t => t.querySelector(".nol-teamrun-image-frame")?.getAttribute("aria-label"))).toEqual(["chart.png", "graph.png"]);
    expect(files === null ? null : files.compareDocumentPosition(previews[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((previews[0]!.getBoundingClientRect().top - (files?.getBoundingClientRect().bottom ?? 0)) / rem).toBeCloseTo(1.25, 1);
    expect((previews[1]!.getBoundingClientRect().top - previews[0]!.getBoundingClientRect().bottom) / rem).toBeCloseTo(0.75, 1);
    expect(context.count(MethodName.WrittenImageRead)).toBe(2);
    expect(context.parametersOf(MethodName.WrittenImageRead)).toEqual(new WrittenImageReadParams("c1", SampleData.reply.id, "D:\\repo\\out\\chart.png").toJson());

    previews[1]!.querySelector<HTMLButtonElement>(".nol-teamrun-image-frame")!.click();
    await fixture.whenStable();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("graph.png"));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());
  });

  it("shows each image a reply generated in its place among the answers, column-wide up to 24rem, each opening in the viewer among them", async () => {
    const png = (width: number, height: number): string => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const url = canvas.toDataURL("image/png");
      return url.slice(url.indexOf(",") + 1);
    };
    const stored = "D:\\data\\images\\reply-1.png";
    const contents = new Map([[stored, png(600, 600)], ["D:\\repo\\out\\moon.png", png(2000, 500)]]);
    context.answer(MethodName.WrittenImageRead, parameters => {
      const path = WrittenImageReadParams.fromJson(parameters).path;
      const data = contents.get(path);
      if (data === undefined)
        throw Object.assign(new Error("The image file is gone or changed."), { code: ErrorCode.NotFound });
      return new AttachmentContent(path.slice(path.lastIndexOf("\\") + 1), "image/png", 4, data).toJson();
    });
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    const generated = [
      detail(0, DetailKind.Text, "Here is the sun."),
      detail(1, DetailKind.Note, "Generated image (completed): C:\\Users\\me\\.codex\\generated_images\\sun.png",
        { itemType: "imageGeneration", status: "completed", savedPath: "C:\\Users\\me\\.codex\\generated_images\\sun.png", storedPath: stored, imageData: null,
          mediaType: "image/png" }),
      detail(2, DetailKind.Text, "And the moon, saved in the project."),
      detail(3, DetailKind.Note, "Generated image (completed): D:\\repo\\out\\moon.png",
        { itemType: "imageGeneration", status: "completed", savedPath: "D:\\repo\\out\\moon.png", imageData: null, mediaType: null }),
      detail(4, DetailKind.Note, "Generated image (completed): D:\\repo\\out\\gone.png",
        { itemType: "imageGeneration", status: "completed", savedPath: "D:\\repo\\out\\gone.png", imageData: null, mediaType: null }),
      detail(5, DetailKind.Note, "Generated image (failed): not saved", { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: null, mediaType: null }),
      detail(6, DetailKind.Text, "Done.")
    ];

    const texts = ["Here is the sun.", "And the moon, saved in the project.", "Done."];
    const shownBlocks = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-image-preview, .reply-image-missing, p")]
      .filter(t => t.localName === "nol-teamrun-image-preview" || t.classList.contains("reply-image-missing")
        || t.closest("nol-teamrun-image-preview") === null && texts.includes(t.textContent?.trim() ?? ""));

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, generated));
    element().style.display = "block";
    element().style.width = "40rem";
    await Wait.until(() => expect(shownBlocks()).toHaveLength(7), MarkdownWait.coldImport);
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-image-frame img")).toHaveLength(2));
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-failed")).not.toBeNull());
    fixture.detectChanges();

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const blocks = shownBlocks();
    const names = blocks.map(t => t.querySelector(".nol-teamrun-image-frame")?.getAttribute("aria-label") ?? t.querySelector(".reply-error-text")?.textContent?.trim()
      ?? t.textContent?.trim());
    const [sunText, sun, moonText, moon, gone, failed, done] = blocks.map(t => t.getBoundingClientRect());
    const column = sun!.width;
    const frame = (index: number): DOMRect => blocks[index]!.querySelector(".nol-teamrun-image-frame")!.getBoundingClientRect();
    expect(names).toEqual(["Here is the sun.", "sun.png", "And the moon, saved in the project.", "moon.png", Resources.formatImageLoadFailed("gone.png"),
      Resources.imageGenerationFailed, "Done."]);
    expect([frame(1).width, frame(1).height, frame(3).width, frame(3).height].map(t => t / rem))
      .toEqual([24, 24, column / rem, column / 4 / rem].map(t => expect.closeTo(t, 1)));
    expect(column / rem).toBeGreaterThan(30);
    expect([sun!.top - sunText!.bottom, moonText!.top - sun!.bottom, moon!.top - moonText!.bottom, done!.top - failed!.bottom].map(t => t / rem))
      .toEqual([1.25, 1.25, 1.25, 1.25].map(t => expect.closeTo(t, 1)));
    expect(failed!.top).toBeGreaterThan(gone!.bottom);
    expect((blocks[5]!.querySelector(".reply-error-glyph")!.getBoundingClientRect().left - sunText!.left) / rem).toBeCloseTo(0, 1);
    expect(context.requests.filter(t => t.method === "teamrun.writtenImageRead").map(t => WrittenImageReadParams.fromJson(t.parameters).path).sort())
      .toEqual(["D:\\data\\images\\reply-1.png", "D:\\repo\\out\\gone.png", "D:\\repo\\out\\moon.png"]);

    blocks[1]!.querySelector<HTMLButtonElement>(".nol-teamrun-image-frame")!.click();
    await fixture.whenStable();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("sun.png"));
    document.querySelector<HTMLButtonElement>(`nol-teamrun-image-viewer button[aria-label="${Resources.nextImageLabel}"]`)!.click();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("moon.png"));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());
  });

  it("shows a failed generated image in its place with Codex's reason under it, and says a finished one of an unknown format or over the size cap couldn't be shown",
    async () => {
      const image = (sequence: number, status: string, failure: Record<string, unknown> | null = null): MessageDetail => detail(sequence, DetailKind.Note,
        "Generated image: not saved", { itemType: "imageGeneration", status, savedPath: null, revisedPrompt: null, failure, imageData: null, mediaType: null });
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Text, "Here it is."),
        image(1, "failed", { type: "usageLimitExceeded", limitId: "images", resetsAt: 1761500000 }),
        image(2, "completed"),
        image(3, "completed"),
        detail(4, DetailKind.Text, "Done.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".reply-image-missing")).toHaveLength(3));

      const [failed, unknownFormat, overCap] = [...element().querySelectorAll<HTMLElement>(".reply-image-missing")];
      const lines = (block: HTMLElement): string[] => [...block.querySelectorAll(".reply-error-text")].map(t => t.textContent?.trim() ?? "");
      expect([lines(failed!), lines(unknownFormat!), lines(overCap!)])
        .toEqual([[Resources.imageGenerationFailed, Resources.imageLimitReached], [Resources.imageNotShown], [Resources.imageNotShown]]);
      const [heading, reason] = [...failed!.querySelectorAll(".reply-error-text")].map(t => t.getBoundingClientRect());
      expect(reason!.left).toBeCloseTo(heading!.left, 1);
      expect(reason!.top).toBeGreaterThanOrEqual(heading!.bottom);
      expect(failed!.querySelector(".reply-error-glyph")!.getBoundingClientRect().right).toBeLessThanOrEqual(heading!.left);
      expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    });

  it("shows a failed Grok image in its place with Grok's message under it, wrapped within the reply", async () => {
    const message = "Image generation failed with HTTP 422 Unprocessable Entity: Failed to deserialize the JSON body into the target type: aspect_ratio: "
      + "unknown variant `7:1`, expected one of `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `2:3`, `3:2`, `9:19.5`, `19.5:9`, `9:20`, `20:9`, `1";
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Text, "Drawing it."),
      detail(1, DetailKind.Note, "Generated image: not saved", { itemType: "imageGeneration", status: "failed", savedPath: null, revisedPrompt: null,
        failure: { error: "tool_execution_failed", message }, imageData: null, mediaType: null }),
      detail(2, DetailKind.Text, "It failed.")
    ]));
    element().style.display = "block";
    element().style.width = "40rem";
    await Wait.until(() => expect(element().textContent).toContain("It failed."), MarkdownWait.coldImport);
    await Wait.until(() => expect(element().querySelectorAll(".reply-image-missing")).toHaveLength(1));

    const failed = element().querySelector<HTMLElement>(".reply-image-missing")!;
    const [heading, reason] = [...failed.querySelectorAll<HTMLElement>(".reply-error-text")];
    expect([heading?.textContent?.trim(), reason?.textContent?.trim()]).toEqual([Resources.imageGenerationFailed, message]);
    expect(element().textContent!.indexOf("Drawing it.")).toBeLessThan(element().textContent!.indexOf(message));
    expect(element().textContent!.indexOf(message)).toBeLessThan(element().textContent!.indexOf("It failed."));
    const [top, bottom] = [heading!.getBoundingClientRect(), reason!.getBoundingClientRect()];
    expect(bottom.left).toBeCloseTo(top.left, 1);
    expect(bottom.top).toBeGreaterThanOrEqual(top.bottom);
    expect(bottom.height).toBeGreaterThan(top.height);
    expect(bottom.right).toBeLessThanOrEqual(failed.getBoundingClientRect().right + 0.5);
    expect(reason!.scrollWidth).toBeLessThanOrEqual(reason!.clientWidth);
  });

  it("shows nothing in a running reply for an image still being generated", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Drawing."),
      detail(1, DetailKind.Note, "Generated image: not saved", { itemType: "imageGeneration", status: "inProgress", savedPath: null, imageData: null, mediaType: null })]));
    await Wait.until(() => expect(element().textContent).toContain("Drawing."));

    expect([element().querySelector(".reply-image-missing"), element().querySelector("nol-teamrun-image-preview")]).toEqual([null, null]);
  });

  it("draws each image a finished reply's Markdown takes from its project in its place in the text, opening in the viewer among them, and the alt text of any other", async () => {
    const png = (width: number, height: number): string => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const url = canvas.toDataURL("image/png");
      return url.slice(url.indexOf(",") + 1);
    };
    const contents = new Map([["D:\\repo\\out/chart.png", png(48, 32)], ["D:\\repo\\out/b c.png", png(30, 20)]]);
    context.answer(MethodName.WrittenImageRead, parameters => {
      const path = WrittenImageReadParams.fromJson(parameters).path;
      const data = contents.get(path);
      if (data === undefined)
        throw Object.assign(new Error("The image file is gone or changed."), { code: ErrorCode.NotFound });
      return new AttachmentContent(path.slice(path.lastIndexOf("/") + 1), "image/png", 4, data).toJson();
    });
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    const drew = [
      detail(0, DetailKind.FileChange, "Wrote the chart", { changes: [{ path: "D:\\repo\\out\\chart.png", kind: "add" }] }),
      detail(1, DetailKind.Text, "Here is ![the chart](out/chart.png) beside ![the other](./out/b%20c.png).\n\nNot ![web](https://example.com/a.png), "
        + "![data](data:text/plain;base64,AAAA), ![script](javascript:alert(1)), ![up](../x.png), ![notes](notes.md) or ![gone](out/gone.png).")
    ];
    const images = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-markdown-image")];
    const alts = ["the chart", "the other", "web", "data", "script", "up", "notes", "gone"];

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, drew));
    await Wait.until(() => expect(images()[0]?.textContent?.trim()).toBe(alts[0]), MarkdownWait.coldImport);
    expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, drew));
    await Wait.until(() => expect(images()).toHaveLength(alts.length));
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-image-frame img")).toHaveLength(2));
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-fallback")).not.toBeNull());
    fixture.detectChanges();

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const frames = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-image-frame")];
    const chart = frames[0]!.getBoundingClientRect();
    const paragraph = frames[0]!.closest("p")!;
    expect(frames.map(t => t.getAttribute("aria-label"))).toEqual(["chart.png", "b c.png"]);
    expect(frames.map(t => t.closest(".nol-markdown-image"))).toEqual(images().slice(0, 2));
    expect(images().map(t => t.querySelector(".nol-teamrun-image-frame") === null ? t.textContent?.trim() : null))
      .toEqual([null, null, ...alts.slice(2)]);
    expect(element().querySelectorAll(".nol-teamrun-image-failed, .written-images nol-teamrun-image-preview, .nol-teamrun-image-caption")).toHaveLength(0);
    expect(paragraph.textContent).toContain("Here is");
    expect([chart.width, chart.height].map(t => t / rem)).toEqual([48, 32].map(t => expect.closeTo(t / rem, 1)));
    expect((chart.left - paragraph.getBoundingClientRect().left) / rem).toBeGreaterThan(2);
    expect(context.requests.filter(t => t.method === "teamrun.writtenImageRead").map(t => WrittenImageReadParams.fromJson(t.parameters).path).sort())
      .toEqual(["D:\\repo\\out/b c.png", "D:\\repo\\out/chart.png", "D:\\repo\\out/gone.png"]);
    expect(context.parametersOf(MethodName.WrittenImageRead)).toEqual(expect.objectContaining({ chatId: "c1", messageId: SampleData.reply.id }));

    frames[0]!.click();
    await fixture.whenStable();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("chart.png"));
    document.querySelector<HTMLButtonElement>(`nol-teamrun-image-viewer button[aria-label="${Resources.nextImageLabel}"]`)!.click();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("b c.png"));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());

    const reads = context.count(MethodName.WrittenImageRead);
    render(sentFrom("c1", [detail(0, DetailKind.Text, "See ![my chart](out/chart.png).")]));
    await Wait.until(() => expect(images().map(t => t.textContent?.trim())).toEqual(["my chart"]), MarkdownWait.coldImport);
    expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    expect(context.count(MethodName.WrittenImageRead)).toBe(reads);
  });

  it("draws a finished reply's Markdown image from a data URL in any chat, column-wide up to 24rem, opening in the viewer, and shows a web image as a link it never fetches, opened by a click or a middle click", async () => {
    context.answer(MethodName.ProjectList, () => []);
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 300;
    const png = canvas.toDataURL("image/png");
    const svg = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='900'><rect width='300' height='900'/></svg>")}`;
    const text = `A ![wide](${png}) chart, ![tall](${svg}), ![web](https://example.com/a.png), ![](https://example.com/b.png), ![html](data:text/html;base64,PGI+) `
      + `and ![again](${png}).`;
    const images = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-markdown-image")];
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>(".nol-markdown-image a.nol-markdown-link")];
    await Wait.until(() => expect(store().loaded()).toBe(true));

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, text)]));
    await Wait.until(() => expect(images()).toHaveLength(6), MarkdownWait.coldImport);
    expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, text)]));
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-image-frame img")).toHaveLength(3));
    fixture.detectChanges();

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const frames = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-image-frame")];
    const paragraph = frames[0]!.closest("p")!.getBoundingClientRect();
    const wide = frames[0]!.getBoundingClientRect();
    const tall = frames[1]!.getBoundingClientRect();
    expect(store().selectedProject()).toBeNull();
    expect(frames.map(t => t.closest(".nol-markdown-image"))).toEqual([images()[0], images()[1], images()[5]]);
    expect(wide.width).toBeCloseTo(Math.min(600, paragraph.width), 0);
    expect(wide.width / wide.height).toBeCloseTo(2, 1);
    expect(wide.height).toBeLessThanOrEqual(24 * rem + 0.5);
    expect(wide.right).toBeLessThanOrEqual(paragraph.right + 0.5);
    expect([tall.width / rem, tall.height / rem]).toEqual([expect.closeTo(8, 1), expect.closeTo(24, 1)]);
    expect(images().map(t => t.querySelector(".nol-teamrun-image-frame, a") === null ? t.textContent?.trim() : null)).toEqual([null, null, null, null, "html", null]);
    expect(links().map(t => [t.textContent?.trim(), t.getAttribute("href")])).toEqual([["web", "https://example.com/a.png"],
      ["https://example.com/b.png", "https://example.com/b.png"]]);
    expect(element().querySelectorAll(".nol-markdown-image img:not([src^='data:'])")).toHaveLength(0);
    expect(performance.getEntriesByType("resource").filter(t => t.name.startsWith("https://example.com"))).toEqual([]);
    expect(context.count(MethodName.WrittenImageRead)).toBe(0);

    await click(links()[0]!);
    links()[1]!.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true, cancelable: true }));
    const middle = new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true });
    links()[1]!.dispatchEvent(middle);
    expect([context.links, context.linkGestures]).toEqual([["https://example.com/a.png", "https://example.com/b.png"], [LinkGesture.Plain, LinkGesture.Middle]]);
    expect(middle.defaultPrevented).toBe(true);
    frames[0]!.click();
    await fixture.whenStable();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("Image"));
    expect(document.querySelector<HTMLButtonElement>(`nol-teamrun-image-viewer button[aria-label="${Resources.nextImageLabel}"]`)?.disabled).toBe(false);
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());
  });

  it("opens a finished reply's link to an image of its project in the viewer among its images, opens any other file of its project with the system's default app, shows an image outside it in its folder, and says why a relative path out of it isn't opened", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 20;
    const url = canvas.toDataURL("image/png");
    context.answer(MethodName.WrittenImageRead, parameters => {
      const path = WrittenImageReadParams.fromJson(parameters).path;
      return new AttachmentContent(path.slice(path.lastIndexOf("/") + 1), "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson();
    });
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    const linked = [detail(0, DetailKind.Text, "See [the chart](out/chart.png), [the other](<out/b c.png>), [the code](src/a.ts:42), [the notes](./docs/notes.md#L3-L5), "
      + "[up](../x.ts), [the drive](D:/elsewhere/y.png) and [the docs](https://example.com/docs).")];
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")];
    const link = (text: string): HTMLAnchorElement => links().find(t => ShownText.of(t) === text)!;
    const shownName = (): string | null => document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim() ?? null;

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, linked));
    await Wait.until(() => expect(links().map(t => ShownText.of(t))).toEqual(["the chart", "the other", "the code", "the notes", "up", "the drive", "the docs"]),
      MarkdownWait.coldImport);
    expect(links().map(t => t.querySelector("nol-file-badge") !== null)).toEqual([true, true, true, true, true, true, false]);
    link("the chart").focus();
    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();
    await Wait.until(() => expect(shownName()).toBe("chart.png"));
    await Wait.until(() => expect(document.activeElement?.closest("nol-teamrun-image-dialog")).not.toBeNull());
    document.querySelector<HTMLButtonElement>(`nol-teamrun-image-viewer button[aria-label="${Resources.nextImageLabel}"]`)!.click();
    await Wait.until(() => expect(shownName()).toBe("b c.png"));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull());
    expect(document.activeElement).toBe(link("the chart"));
    expect(context.requests.filter(t => t.method === "teamrun.writtenImageRead").map(t => WrittenImageReadParams.fromJson(t.parameters).path).sort())
      .toEqual(["D:\\repo\\out/b c.png", "D:\\repo\\out/chart.png"]);

    for (const text of ["the code", "the notes", "up", "the drive", "the docs"])
      await click(link(text));
    await Wait.until(() => expect([context.shownInFolder, context.openedFiles]).toEqual([["D:/elsewhere/y.png"], ["D:\\repo\\src/a.ts", "D:\\repo\\docs/notes.md"]]));
    expect(context.links).toEqual(["https://example.com/docs"]);
    expect(context.openedDocuments).toEqual([]);
    expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull();
    expect(context.shownNotices().map(t => [t.title, t.text, t.severity])).toEqual([["Couldn't open the file", Resources.formatLinkedFileRefused("x.ts"), NotificationSeverity.Error]]);
    expect(Resources.formatLinkedFileRefused("x.ts")).toBe("x.ts wasn't opened: a reply's link opens a file in the chat's folder, or elsewhere on this computer by its full path.");
  });

  const stored = "D:/data/attachments/c1/0192f3a4-7b1c-7cde-8f00-5d6e7f809a1b.txt";
  const program = "D:/data/attachments/c1/0192f3a4-7b1c-7cde-8f00-5d6e7f809a1c.exe";
  const refused = "the file's kind isn't opened.";
  const unreadable = "no file can be read at the path.";
  const attached = async (name: string, saved: string): Promise<HTMLButtonElement> => {
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "See the file.")], null,
      SampleData.timestamp, null, SampleData.timestamp, [new MessageAttachment(name, "application/octet-stream", 2048, saved)]));
    await Wait.until(() => expect(element().querySelector(".nol-message-attachment")).not.toBeNull(), MarkdownWait.coldImport);
    const button = element().querySelector(".nol-message-attachment");
    if (!(button instanceof HTMLButtonElement))
      throw new Error("The attached file shows no button.");
    return button;
  };
  for (const [title, name, saved, openFailure, folderFailure, exists, shown, notice] of [
    ["opens a message's attached file with the system's default app when its button is clicked", "notes.txt", stored, null, null, true, [], null],
    ["shows an attached program in its folder rather than running it", "setup.exe", program, refused, null, true, [program], null],
    ["tells that an attached file is gone, rather than failing, once the system can neither open it nor show it and Core no longer has it", "notes.txt", stored,
      unreadable, unreadable, false, [stored], ["Couldn't open the attached file", "notes.txt is no longer in TeamRun's data folder.", NotificationSeverity.Info]],
    ["reports an attached file the system won't open that its folder could not show while Core still has it", "notes.txt", stored, refused, unreadable, true, [stored],
      ["Couldn't show the file in its folder", "notes.txt could not be shown in its folder.", NotificationSeverity.Error]],
    ["reports an attached file its folder could not show when Core can't say whether it still has it", "notes.txt", stored, refused, unreadable, null, [stored],
      ["Couldn't show the file in its folder", "notes.txt could not be shown in its folder.", NotificationSeverity.Error]]
  ] as const)
    it(title, async () => {
      context.openFileFailure = openFailure;
      context.showInFolderFailure = folderFailure;
      if (Object.isNull(exists))
        context.fail(MethodName.AttachmentExists, "Core stopped.");
      else
        context.answer(MethodName.AttachmentExists, t => JSON.stringify(t) === JSON.stringify(new AttachmentReadParams("c1", saved).toJson()) ? exists : null);
      const button = await attached(name, saved);

      await click(button);

      await Wait.until(() => expect([context.openedFiles, context.shownInFolder]).toEqual([[saved], shown]));
      await Wait.until(() => expect(context.shownNotices().map(t => [t.title, t.text, t.severity])).toEqual(Object.isNull(notice) ? [] : [notice]));
    });

  it("posts nothing for an attached file it can neither open nor show once its chat is deleted while Core is asked, and Core no longer finds it", async () => {
    context.openFileFailure = unreadable;
    context.showInFolderFailure = unreadable;
    let asked = 0;
    context.answer(MethodName.AttachmentExists, () => {
      asked++;
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      throw Object.assign(new Error("No chat c1."), { code: ErrorCode.NotFound, details: { error: ErrorCode.NotFound, arguments: ["c1"] } });
    });
    const button = await attached("notes.txt", stored);
    const decided = vi.spyOn(store(), "isDeleted");

    await click(button);
    await Wait.until(() => expect([asked, context.shownInFolder, decided.mock.results.map(t => t.value)]).toEqual([1, [stored], [true]]));
    await fixture.whenStable();

    expect(context.shownNotices()).toEqual([]);
  });

  it("shows an attached file's full path in its tooltip and as its description, keeping its name as the button's name", async () => {
    const button = await attached("notes.txt", stored);

    await userEvent.hover(button);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe(stored));
    const described = (button.getAttribute("aria-describedby") ?? "").split(" ").map(t => document.getElementById(t)?.textContent?.trim());
    await userEvent.unhover(button);

    expect(described).toContain(stored);
    expect(button.getAttribute("aria-label")).toBeNull();
    expect(button.querySelector(".nol-message-attachment-name")?.textContent?.trim()).toBe("notes.txt");
    expect(button.textContent).not.toContain(stored);
  });

  it("opens an attached file from the keyboard with Enter and with Space", async () => {
    const button = await attached("notes.txt", stored);

    button.focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(context.openedFiles).toEqual([stored]));
    await userEvent.keyboard(" ");

    await Wait.until(() => expect(context.openedFiles).toEqual([stored, stored]));
    expect(document.activeElement).toBe(button);
    expect(context.shownNotices()).toEqual([]);
  });

  const linkedFile = "D:\\repo\\docs/notes.md";
  for (const [name, openFailure, folderFailure, opened, shown, error] of [
    ["opens a file a reply links to with the system's default app", null, null, [linkedFile], [], null],
    ["shows a file a reply links to that the system won't open in its folder", "The file's kind isn't opened.", null, [linkedFile], [linkedFile], null],
    ["reports a file a reply links to that the system won't open and its folder could not show", "The file's kind isn't opened.", "The file is gone.", [linkedFile],
      [linkedFile], "notes.md could not be opened or shown in its folder; it may have been moved or deleted."]
  ] as const)
    it(name, async () => {
      context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
      context.openFileFailure = openFailure;
      context.showInFolderFailure = folderFailure;
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the notes](docs/notes.md#L3).")]));
      await Wait.until(() => expect(element().querySelector("a.nol-markdown-link")).not.toBeNull(), MarkdownWait.coldImport);

      await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));

      await Wait.until(() => expect([context.openedFiles, context.shownInFolder, context.noticeText()]).toEqual([opened, shown, error]));
      expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull();
    });

  it("posts nothing for a file a reply links to that it can neither open nor show once its chat is deleted while its folder is asked", async () => {
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.openFileFailure = "The file's kind isn't opened.";
    const shown = vi.spyOn(context, "showInFolderAsync").mockImplementation(() => {
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      return Promise.reject(new Error("The file is gone."));
    });
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the notes](docs/notes.md#L3).")]));
    await Wait.until(() => expect(element().querySelector("a.nol-markdown-link")).not.toBeNull(), MarkdownWait.coldImport);
    const decided = vi.spyOn(store(), "isDeleted");

    await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));
    await Wait.until(() => expect([context.openedFiles, shown.mock.calls, decided.mock.results.map(t => t.value)]).toEqual([[linkedFile], [[linkedFile]], [true]]));
    await fixture.whenStable();

    expect(context.shownNotices()).toEqual([]);
  });

  const saved = "C:/Users/a/Pictures/portrait.png";
  const setup = "C:/Users/a/Downloads/setup.exe";
  const script = "/home/a/bin/clean.sh";
  const neverOpened = "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.";
  for (const [name, target, openFailure, folderFailure, opened, shown, notice] of [
    ["shows an image a reply links to outside its project, by a slash before its drive, in its folder, never opening it though the system could", `/${saved}`,
      null, null, [], [saved], null],
    ["shows a program a reply links to outside its project in its folder, never running it", setup, neverOpened, null, [setup], [setup], null],
    ["shows a script a reply links to outside its project in its folder, never running it", script, neverOpened, null, [script], [script], null],
    ["tells that an image a reply links to outside its project could not be shown in its folder", `/${saved}`, null,
      "No file can be read at the path.", [], [saved],
      ["Couldn't open the file", "portrait.png could not be opened or shown in its folder; it may have been moved or deleted.", NotificationSeverity.Error]],
    ["tells that a file a reply links to outside its project could not be opened or shown once the system can do neither", setup, neverOpened,
      "No file can be read at the path.", [setup], [setup],
      ["Couldn't open the file", "setup.exe could not be opened or shown in its folder; it may have been moved or deleted.", NotificationSeverity.Error]]
  ] as const)
    it(name, async () => {
      context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
      context.openFileFailure = openFailure;
      context.showInFolderFailure = folderFailure;
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, `Done. [The file](${target})`)]));
      await Wait.until(() => expect(element().querySelector("a.nol-markdown-link nol-file-badge")).not.toBeNull(), MarkdownWait.coldImport);

      await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));

      await Wait.until(() => expect([context.openedFiles, context.shownInFolder]).toEqual([opened, shown]));
      await Wait.until(() => expect(context.shownNotices().map(t => [t.title, t.text, t.severity])).toEqual(Object.isNull(notice) ? [] : [notice]));
      expect(context.requests.filter(t => t.method === "teamrun.writtenImageRead")).toEqual([]);
      expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull();
    });

  it("tells a POSIX project's files from a sibling folder's whose name differs only in case, opening only the project's image in the viewer", async () => {
    const canvas = document.createElement("canvas");
    const url = canvas.toDataURL("image/png");
    context.answer(MethodName.ProjectList, () => [SampleData.listed(new Project("p1", "app", "/home/a/app", SampleData.timestamp))]);
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson());
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")];
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text,
      "See [sibling](/home/a/App/notes.txt), [upper](/HOME/A/APP/x.txt), [own](/home/a/app/notes.txt), [relative](OUT/y.txt), "
      + "[sibling chart](/home/a/App/chart.png) and [own chart](/home/a/app/chart.png).")]));
    await Wait.until(() => expect(links()).toHaveLength(6), MarkdownWait.coldImport);
    for (const link of links())
      await click(link);

    expect(store().selectedProject()?.rootPath).toBe("/home/a/app");
    await Wait.until(() => expect(context.openedFiles).toEqual(["/home/a/App/notes.txt", "/HOME/A/APP/x.txt", "/home/a/app/notes.txt", "/home/a/app/OUT/y.txt"]));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("chart.png"));
    expect([...new Set(context.requests.filter(t => t.method === "teamrun.writtenImageRead").map(t => WrittenImageReadParams.fromJson(t.parameters).path))])
      .toEqual(["/home/a/app/chart.png"]);
    expect(context.shownInFolder).toEqual(["/home/a/App/chart.png"]);
    expect(context.noticeText()).toBeNull();
  });

  it("opens only a reply's links to a file by its absolute path when no project is open, and says why the others aren't opened, by their decoded name or a folder's whole path", async () => {
    context.answer(MethodName.ProjectList, () => []);
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")];
    await Wait.until(() => expect(store().loaded()).toBe(true));

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text,
      "See [the chart](out/chart.png), [the code](src/a.ts), [the other](<out/b c.png>), [the folder](out/docs/) and [the notes](/home/a/notes.md:3).")]));
    await Wait.until(() => expect(links()).toHaveLength(5), MarkdownWait.coldImport);
    for (const link of links())
      await click(link);
    expect(store().selectedProject()).toBeNull();
    await Wait.until(() => expect(context.openedFiles).toEqual(["/home/a/notes.md"]));
    expect([context.openedDocuments, context.shownInFolder, document.querySelector("nol-teamrun-image-viewer")]).toEqual([[], [], null]);
    expect(context.shownNotices().map(t => t.text)).toEqual(["chart.png", "a.ts", "b c.png", "out/docs/"].map(t => Resources.formatLinkedFileRefused(t)));
  });

  it("shows a folder a reply links to in the file manager without asking to open it as a file, asking once for a folder and again for a path that wasn't one", async () => {
    const folder = "D:\\repo\\icon-preview";
    const notes = "D:\\repo\\docs/notes.md";
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.answer(MethodName.LinkedFolderList, t => new LinkedPaths(LinkedPaths.fromJson(t).paths.filter(u => u === folder)).toJson());
    const link = (text: string): HTMLAnchorElement | undefined => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")]
      .find(t => ShownText.of(t) === text);
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text,
      "See [the previews](icon-preview), [the notes](docs/notes.md) and [the outside](../outside.md).")]));
    await Wait.until(() => expect(link("the notes")).toBeDefined(), MarkdownWait.coldImport);
    await Wait.until(() => expect(link("the previews")?.querySelector(".nol-file-badge-glyph")?.textContent).toBe("folder"));

    for (const text of ["the previews", "the notes", "the previews"])
      await click(link(text) ?? null);

    await Wait.until(() => expect([context.shownInFolder, context.openedFiles]).toEqual([[folder, folder], [notes]]));
    expect(context.requests.filter(t => t.method === "teamrun.linkedFolderList").map(t => LinkedPaths.fromJson(t.parameters).paths)).toEqual([[folder, notes], [notes]]);
    expect(link("the notes")?.querySelector(".nol-file-badge-glyph")?.textContent).not.toBe("folder");
  });

  it("opens a folder link as a file, as before, when it can't be told a folder, and asks again at the next click", async () => {
    const folder = "D:\\repo\\icon-preview";
    let asked = 0;
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.answer(MethodName.LinkedFolderList, t => {
      asked++;
      if (asked < 3)
        throw new Error("The runtime is restarting.");
      return LinkedPaths.fromJson(t).toJson();
    });
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the previews](icon-preview).")]));
    await Wait.until(() => expect(element().querySelector("a.nol-markdown-link")).not.toBeNull(), MarkdownWait.coldImport);
    await Wait.until(() => expect(asked).toBe(1));

    await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));
    await Wait.until(() => expect([context.openedFiles, context.shownInFolder]).toEqual([[folder], []]));
    await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));

    await Wait.until(() => expect([context.openedFiles, context.shownInFolder, asked]).toEqual([[folder], [folder], 3]));
    expect(context.noticeText()).toBeNull();
  });

  it.each([ThemeMode.Light, ThemeMode.Dark])("draws a linked folder's mark in %s in the place and size of a file's badge", async mode => {
    AppearanceFixture.apply(FixtureTheme.theme, mode);
    const folder = "D:\\repo\\icon-preview";
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.answer(MethodName.LinkedFolderList, t => new LinkedPaths(LinkedPaths.fromJson(t).paths.filter(u => u === folder)).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "[the previews](icon-preview)\n\n[the notes](docs/notes.md)")]));
    await Wait.until(() => expect(element().querySelectorAll("a.nol-markdown-link nol-file-badge")).toHaveLength(2), MarkdownWait.coldImport);
    await Wait.until(() => expect(element().querySelector("a.nol-markdown-link .nol-file-badge-glyph")?.textContent).toBe("folder"));

    const measure = (index: number): { inset: number; width: number; height: number } => {
      const link = element().querySelectorAll<HTMLElement>("a.nol-markdown-link")[index];
      const badge = link?.querySelector("nol-file-badge")?.getBoundingClientRect() ?? new DOMRect();
      return { inset: badge.left - (link?.getBoundingClientRect().left ?? 0), width: badge.width, height: badge.height };
    };
    const [marked, plain] = [measure(0), measure(1)];

    expect(marked.width).toBeGreaterThan(0);
    expect([marked.width, marked.height]).toEqual([plain.width, plain.height]);
    expect(marked.inset).toBeCloseTo(plain.inset, 1);
  });

  it("marks the folders of a reply's latest paths, never those of an answer that came after the paths changed", async () => {
    const [early, late] = ["D:\\repo\\early", "D:\\repo\\late"];
    let release: () => void = () => undefined;
    let asked = 0;
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    context.answer(MethodName.LinkedFolderList, t => ++asked === 1
      ? new Promise<JsonValue>(resolve => release = () => resolve(new LinkedPaths([early]).toJson())) : LinkedPaths.fromJson(t).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "See [early](early).")]));
    await Wait.until(() => expect(asked).toBe(1), MarkdownWait.coldImport);
    await show(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "See [late](late).")]));
    await Wait.until(() => expect(asked).toBe(2));
    await Wait.until(() => expect(element().querySelectorAll(".nol-file-badge-glyph")).toHaveLength(1));
    const marked = (): string[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")]
      .filter(t => t.querySelector(".nol-file-badge-glyph")?.textContent === "folder").map(t => ShownText.of(t));

    await Wait.until(() => expect(marked()).toEqual(["late"]));

    release();
    await store().linkedFoldersAsync(SampleData.reply, [early]);
    await fixture.whenStable();

    expect(marked()).toEqual(["late"]);
    expect(context.requests.filter(t => t.method === "teamrun.linkedFolderList").map(t => LinkedPaths.fromJson(t.parameters).paths)).toEqual([[early], [late]]);
  });

  it("opens a file a reply of a chat without a project links to from that chat's own folder", async () => {
    const scratch = new Conversation("c5", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c5");
    context.answer(MethodName.ProjectList, () => [])
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? [scratch.toJson()] : [])
      .answer(MethodName.MessagePage, () => new MessagePage([], false, false, 0).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c5");

    const reply = new Message("m6", "c5", 1, MessageAuthor.Provider, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the notes](out/notes.txt).")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    render(reply);
    await Wait.until(() => expect(element().querySelector("a.nol-markdown-link")).not.toBeNull(), MarkdownWait.coldImport);
    await click(element().querySelector<HTMLElement>("a.nol-markdown-link"));

    await Wait.until(() => expect([store().selectedProject(), context.openedFiles, context.shownInFolder]).toEqual([null, ["/data/chats/c5/out/notes.txt"], []]));
    expect(context.noticeText()).toBeNull();
  });

  it("opens a reply's linked image in a tab when the setting says so, and shows a person's paths as text", async () => {
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    const linked = [detail(0, DetailKind.Text, "See [the chart](out/chart.png) and [the code](src/a.ts).")];
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-markdown-link")];
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, linked));
    await Wait.until(() => expect(links()).toHaveLength(2), MarkdownWait.coldImport);
    await click(links()[0]!);
    expect(context.openedDocuments.map(t => [t.name, t.title])).toEqual([[Resources.imageDocumentName, "chart.png"]]);
    expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull();

    render(sentFrom("c1", linked));
    await Wait.until(() => expect(element().textContent).toContain("See the chart and the code."), MarkdownWait.coldImport);
    expect(links()).toHaveLength(0);
  });

  it("keeps out a reply's written images when no project is open", async () => {
    const wrote = [detail(0, DetailKind.FileChange, "Wrote", { changes: [{ path: "D:\\repo\\chart.png", kind: "add" }] })];

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, wrote));
    expect(element().querySelector("nol-teamrun-edited-files")).not.toBeNull();
    expect(element().querySelector("nol-teamrun-image-preview")).toBeNull();
    expect(context.count(MethodName.WrittenImageRead)).toBe(0);
  });

  it("keeps the reader's choices in the store's message index, so a row made again shows them, with paths relative to the project", async () => {
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Note, "Read: D:\\repo\\a.ts", { tool: "Read" })]);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, reply], false, false).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    await Wait.until(() => expect(store().history()?.held).toHaveLength(2));

    render(reply);
    await click(element().querySelector(".activity-toggle"));
    expect(store().messageIndex().find(t => t.id === reply.id)?.controls?.activityChoice()).toBe(true);
    expect(textOf(".nol-tool-call-title")).toBe("Read: .\\a.ts");

    fixture.destroy();
    render(reply);
    expect(element().querySelector(".activity-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps a question card's picks and typed text in the store's message index, so a row made again shows them", async () => {
    const reply = awaiting();
    const asking = new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null, [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false),
        new ApprovalQuestion("name", "Name", "Which name?", [], false, true, false)]);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, reply], false, false).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    await Wait.until(() => expect(store().history()?.held).toHaveLength(2));
    render(reply);
    context.emit(EventName.ApprovalCreated, asking.toJson());
    await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull());
    const choice = (): HTMLInputElement | null => element().querySelector<HTMLInputElement>("nol-teamrun-question-card .nol-choice-row input");
    const typed = (): HTMLInputElement | null => element().querySelector<HTMLInputElement>(".nol-teamrun-question-other");

    await click(choice());
    Object.assign(one(".nol-teamrun-question-other"), { value: "Atlas" }).dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.destroy();
    render(reply);
    await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull());

    expect([choice()?.checked, typed()?.value]).toEqual([true, "Atlas"]);
    expect(store().messageIndex().find(t => t.id === reply.id)?.controls?.draftOf("q1")?.texts().get("name")).toBe("Atlas");
  });

  it("offers no Run on a reply's shell code block in a window without chat terminals, and ignores a Run that comes anyway", async () => {
    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "```bash\nls\n```")]));
    await Wait.until(() => expect(element().querySelector(".nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);

    expect(element().querySelector(".nol-code-block-run")).toBeNull();
    (fixture.debugElement.query(By.directive(MessageComponent)).componentInstance as MessageComponent).shellRun.emit(new ShellRun("ls", "bash"));
    await fixture.whenStable();
    expect(context.shownNotices(Resources.chatActionFailedNotice)).toEqual([]);
  });

  it("offers no Run on a shell code block of a reply still being written, and offers it once the reply is complete", async () => {
    const terminals = ChatTerminals.provide(context, store(), { runAsync: () => Promise.resolve("session-1") });
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      const blocks = [detail(0, DetailKind.Text, "Run this:\n\n```bash\nnpm test\n```\n\nAnd then")];
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, blocks));
      await Wait.until(() => expect(element().querySelector(".nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);

      expect(element().querySelector(".nol-code-block-run")).toBeNull();
      fixture.destroy();
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, blocks));
      await Wait.until(() => expect(element().querySelector(".nol-code-block-run")).not.toBeNull(), MarkdownWait.coldImport);
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("hands Run and Copy exactly the code a block shows, with no line break or indentation, for a block at the reply's start and one after text", async () => {
    const runs: unknown[][] = [];
    const terminals = ChatTerminals.provide(context, store(), { runAsync: (...parts) => {
      runs.push(parts);
      return Promise.resolve("session-1");
    } });
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      const writer = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "```bash\nls\n```\n\nThen:\n\n```powershell\nGet-ChildItem\n```")]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(2), MarkdownWait.coldImport);
      const shown = [...element().querySelectorAll(".nol-code-block-body code")].map(t => t.textContent);
      const [firstRun, secondRun] = [...element().querySelectorAll<HTMLElement>(".nol-code-block-run")];
      const [firstCopy, secondCopy] = [...element().querySelectorAll<HTMLElement>(".nol-code-block-copy")];

      await click(firstRun ?? null);
      await click(secondRun ?? null);
      await click(firstCopy ?? null);
      await click(secondCopy ?? null);

      expect(shown).toEqual(["ls", "Get-ChildItem"]);
      await Wait.until(() => expect(runs.map(t => t[1])).toEqual(shown));
      await Wait.until(() => expect(writer.texts).toEqual(shown));
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("offers Run on a shell code block in text moved into Worked for only where the reply's own text offers it, runs it in the chat's terminal, and marks a teammate it names", async () => {
    new TeammateFixture(context);
    await Wait.until(() => expect(store().teammates()).toHaveLength(3));
    const reply = (id: string): Message => SampleData.withStatus(new Message(id, "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [
      detail(0, DetailKind.Text, "Over to @Bob.\n\n```bash\nnpm test\n```"), detail(1, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" }), detail(2, DetailKind.Text, "Done.")
    ], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed);
    const open = async (): Promise<void> => {
      await click(element().querySelector(".activity-toggle"));
      await Wait.until(() => expect(element().querySelector(".step-text .nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);
    };
    render(reply("m6"));
    await open();

    expect([...element().querySelectorAll(".step-text .nol-markdown-mention")].map(t => t.textContent?.trim())).toEqual(["@Bob"]);
    expect(element().querySelector(".nol-code-block-run")).toBeNull();
    fixture.destroy();

    const runs: unknown[][] = [];
    const terminals = ChatTerminals.provide(context, store(), { runAsync: (...parts) => {
      runs.push(parts);
      return Promise.resolve("session-1");
    } });
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(reply("m7"));
      await open();
      await Wait.until(() => expect(element().querySelector(".step-text .nol-code-block-run")).not.toBeNull());

      expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(1);
      await click(element().querySelector(".step-text .nol-code-block-run"));
      await Wait.until(() => expect(runs).toEqual([["teamrun.chat/c1", "npm test", "D:\\repo", [TerminalShellKind.Bash]]]));
      expect(context.shownNotices(Resources.chatActionFailedNotice)).toEqual([]);
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("draws the chat's inline terminal under the block of its latest Run in a reply's text, across the block's width, and moves it under the next Run's block", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1", "session-1"];
    const runs = starter.runs;
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
    const blocks = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-code-block")];
    const hosts = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-inline-terminal")];
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      const text = "First:\n\n```bash\nls\n```\n\nThen:\n\n```bash\npwd\n```\n\nDone.";
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, text)]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(2), MarkdownWait.coldImport);

      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[1] ?? null);
      await Wait.until(() => expect(hosts()).toHaveLength(1));
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));
      fakes.opened[0]?.element.style.setProperty("height", "48px");
      fixture.detectChanges();
      const underSecond = hosts()[0];

      expect([runs, fakes.opened.map(t => [t.sessionId, t.maximumRows]), underSecond?.querySelector(".live")?.firstElementChild === fakes.opened[0]?.element])
        .toEqual([[["teamrun.chat/c1", "pwd", "D:\\repo", [TerminalShellKind.Bash], null, null]], [["session-1", 15]], true]);
      expect(rect(underSecond).top).toBeGreaterThanOrEqual(rect(blocks()[1]).bottom);
      AppearanceFixture.expectPixels(rect(underSecond).left, rect(blocks()[1]).left);
      AppearanceFixture.expectPixels(rect(underSecond).right, rect(blocks()[1]).right);
      AppearanceFixture.expectPixels(rect(underSecond).height, 48);

      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[0] ?? null);
      await Wait.until(() => expect(rect(hosts()[0]).bottom).toBeLessThanOrEqual(rect(blocks()[1]).top));

      expect([hosts().length, hosts()[0]?.querySelector(".live")?.firstElementChild === fakes.opened[0]?.element, fakes.opened.length, runs.length]).toEqual([1, true, 1, 2]);
      expect(rect(hosts()[0]).top).toBeGreaterThanOrEqual(rect(blocks()[0]).bottom);
      fixture.destroy();
      render(SampleData.withStatus(new Message("m9", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [detail(0, DetailKind.Text, text)],
        SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed));
      await Wait.until(() => expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(2), MarkdownWait.coldImport);
      expect(hosts()).toEqual([]);
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("takes Ctrl+` inside the chat's inline terminal to the chat's message box, and leaves it, and every other key there, to the window elsewhere", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1"];
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const focused: string[] = [];
    const removeComposer = CommandTargetsService.of(context).provideComposer("c1", () => focused.push("c1"));
    const reached: string[] = [];
    const windowKey = (event: KeyboardEvent): void => {
      if (!event.defaultPrevented)
        reached.push(`${event.shiftKey ? "Ctrl+Shift+" : event.ctrlKey ? "Ctrl+" : ""}${event.code}`);
    };
    const press = (target: Element | null | undefined, init: KeyboardEventInit): boolean =>
      target?.dispatchEvent(new KeyboardEvent("keydown", { key: "`", code: "Backquote", bubbles: true, cancelable: true, ...init })) ?? false;
    document.addEventListener("keydown", windowKey);
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "Run:\n\n```bash\nls\n```")]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(1), MarkdownWait.coldImport);
      await click(element().querySelector(".nol-code-block-run"));
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));
      const screen = fakes.opened[0]?.element;

      const taken = press(screen, { ctrlKey: true });
      const others = [press(screen, { ctrlKey: true, shiftKey: true }), press(screen, {}), press(screen, { ctrlKey: true, code: "KeyC", key: "c" })];
      const elsewhere = press(element().querySelector("nol-code-block"), { ctrlKey: true });

      expect([taken, others, elsewhere, focused, reached]).toEqual([false, [true, true, true], true, ["c1"],
        ["Ctrl+Shift+Backquote", "Backquote", "Ctrl+KeyC", "Ctrl+Backquote"]]);
    }
    finally {
      document.removeEventListener("keydown", windowKey);
      removeComposer();
      await terminals.removeAsync();
    }
  });

  it("names a Run in a reply's text running while its commands run, Run again once they end, and the block of an earlier Run Run again", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    let end: (value: TerminalRunEnd) => void = () => undefined;
    starter.ends.set("run-1", new Promise<TerminalRunEnd>(resolve => {
      end = resolve;
    }));
    starter.sessions = ["session-1", "session-1"];
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const labels = (): (string | null)[] => [...element().querySelectorAll<HTMLElement>(".nol-code-block-run")].filter(t => Object.isNull(t.closest("nol-teamrun-inline-terminal")))
      .map(t => t.getAttribute("aria-label"));
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "First:\n\n```bash\nnpm test\n```\n\nThen:\n\n```bash\nls\n```")]));
      await Wait.until(() => expect(labels()).toHaveLength(2), MarkdownWait.coldImport);

      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[0] ?? null);
      await Wait.until(() => expect(labels()).toEqual(["Run bash command (running)", "Run bash command"]));
      end(new TerminalRunEnd("Command", 0));
      await Wait.until(() => expect(labels()).toEqual(["Run bash command again", "Run bash command"]));
      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[1] ?? null);
      await Wait.until(() => expect(labels()).toEqual(["Run bash command again", "Run bash command again"]));
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("keeps an earlier Run's output under its block, in a code block across the block's width, once the next Run moves the terminal under another block", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1", "session-1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ pwd", "/repo"));
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
    const blocks = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-code-block")].filter(t => Object.isNull(t.closest("nol-teamrun-inline-terminal")));
    const hosts = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-inline-terminal")];
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "First:\n\n```bash\nls\n```\n\nThen:\n\n```bash\npwd\n```")]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-code-block-run")).toHaveLength(2), MarkdownWait.coldImport);

      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[1] ?? null);
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));
      await click(element().querySelectorAll<HTMLElement>(".nol-code-block-run")[0] ?? null);
      await Wait.until(() => expect(hosts()).toHaveLength(2));
      const [live, kept] = hosts();
      const output = kept?.querySelector<HTMLElement>("nol-code-block.output");

      expect([live?.querySelector(".live")?.firstElementChild === fakes.opened[0]?.element, kept?.querySelector(".live")?.childElementCount,
        output?.querySelector(".nol-code-block-body code")?.textContent, output?.querySelector(".nol-code-block-run"), starter.reads]).toEqual([true, 0, "$ pwd\n/repo", null, ["run-1"]]);
      expect(rect(live).top).toBeGreaterThanOrEqual(rect(blocks()[0]).bottom);
      expect(rect(output).top).toBeGreaterThanOrEqual(rect(blocks()[1]).bottom);
      AppearanceFixture.expectPixels(rect(output).left, rect(blocks()[1]).left);
      AppearanceFixture.expectPixels(rect(output).right, rect(blocks()[1]).right);
      AppearanceFixture.expectPixels(rect(kept).height, rect(output).height);
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("asks under a Run's block while the chat's terminal is busy, its two choices on one line under the question across the block's width, and Stop it and run interrupts and runs there", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1", new TerminalRunNotTypedException("session-1", TerminalRunOutcome.Busy), "session-1"];
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
    const runButtons = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-code-block-run")];
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "First:\n\n```bash\nnpm start\n```\n\nThen:\n\n```bash\nls\n```")]));
      await Wait.until(() => expect(runButtons()).toHaveLength(2), MarkdownWait.coldImport);
      const second = runButtons()[1]?.closest("nol-code-block");

      await click(runButtons()[0] ?? null);
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));
      await click(runButtons()[1] ?? null);
      await Wait.until(() => expect(element().querySelector(".busy")).not.toBeNull());
      const busy = element().querySelector<HTMLElement>(".busy");
      const [question, stop, inNew] = [".busy-text", ".busy-stop", ".busy-new"].map(t => busy?.querySelector<HTMLElement>(t));

      expect([busy?.getAttribute("role"), busy?.getAttribute("aria-label"), question?.textContent?.trim(), stop?.textContent?.trim(), inNew?.textContent?.trim()])
        .toEqual(["group", Resources.shellRunBusy, Resources.shellRunBusy, Resources.shellRunStop, Resources.shellRunNewTerminal]);
      expect(rect(busy).top).toBeGreaterThanOrEqual(rect(second).bottom);
      AppearanceFixture.expectPixels(rect(question).left, rect(second).left);
      AppearanceFixture.expectPixels(rect(stop).left, rect(second).left);
      AppearanceFixture.expectPixels(rect(stop).top, rect(inNew).top);
      expect(rect(stop).top).toBeGreaterThanOrEqual(rect(question).bottom);
      expect(rect(inNew).left).toBeGreaterThan(rect(stop).right);
      expect(rect(inNew).right).toBeLessThanOrEqual(rect(second).right);
      expect(rect(fakes.opened[0]?.element).bottom).toBeLessThanOrEqual(rect(second).top);

      await click(stop ?? null);
      await Wait.until(() => expect(element().querySelector(".busy")).toBeNull());

      expect(starter.runs.map(t => [t[1], t[4], t[5]])).toEqual([["npm start", null, null], ["ls", "session-1", TerminalRunBusy.Refuse],
        ["ls", "session-1", TerminalRunBusy.Interrupt]]);
      expect(rect(fakes.opened[0]?.element).top).toBeGreaterThanOrEqual(rect(second).bottom);
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("gives the chat's inline terminal under a Run's block the rows that fill half the history's height, as the history or the terminal resizes", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1"];
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const view = document.body.appendChild(document.createElement("div"));
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "```bash\nls\n```")]));
      view.classList.add("nol-virtual-list-viewport");
      view.style.cssText = "height: 200px; overflow: auto";
      view.append(element());
      await Wait.until(() => expect(element().querySelector(".nol-code-block-run")).not.toBeNull(), MarkdownWait.coldImport);

      await click(element().querySelector<HTMLElement>(".nol-code-block-run"));
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));
      fakes.opened[0]?.rowHeight.set(20);
      fakes.opened[0]?.element.style.setProperty("height", "20px");
      await Wait.until(() => expect(fakes.opened[0]?.events.at(-1)).toBe("rows 8"));
      view.style.height = "400px";

      await Wait.until(() => expect(fakes.opened[0]?.events.at(-1)).toBe("rows 10"));
    }
    finally {
      view.remove();
      await terminals.removeAsync();
    }
  });

  it("draws the chat's inline terminal under the block of its latest Run in a step's text in Worked for, and under no other step's", async () => {
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-1"];
    const terminals = ChatTerminals.provide(context, store(), null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const steps = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".step-text")];
    try {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(new Message("m8", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [
        detail(0, DetailKind.Text, "```bash\nnpm test\n```"), detail(1, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" }),
        detail(2, DetailKind.Text, "```bash\nnpm run lint\n```"), detail(3, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t2" }), detail(4, DetailKind.Text, "Done.")
      ], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed));
      await click(element().querySelector(".activity-toggle"));
      await Wait.until(() => expect(element().querySelectorAll(".step-text .nol-code-block-run")).toHaveLength(2), MarkdownWait.coldImport);

      const lint = (): HTMLElement | undefined => steps().find(t => t.textContent?.includes("npm run lint") === true);
      await click(lint()?.querySelector<HTMLElement>(".nol-code-block-run") ?? null);
      await Wait.until(() => expect(fakes.opened).toHaveLength(1));

      expect(element().querySelectorAll("nol-teamrun-inline-terminal")).toHaveLength(1);
      expect(lint()?.querySelector("nol-teamrun-inline-terminal .live")?.firstElementChild).toBe(fakes.opened[0]?.element);
      await Wait.until(() => expect(lint()?.querySelector(".nol-code-block-run")?.getAttribute("aria-label")).toBe("Run bash command again"));
      expect(steps().find(t => t.textContent?.includes("npm test") === true)?.querySelector(".nol-code-block-run")?.getAttribute("aria-label")).toBe("Run bash command");
    }
    finally {
      await terminals.removeAsync();
    }
  });

  it("shows a project image in text moved into Worked for as the reply's image preview, framed at its size inside the text's bar, with the images' spacing", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 32;
    const url = canvas.toDataURL("image/png");
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson());
    context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const rect = (target: Element | null): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
    const part = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);

    render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Text, "Here is ![the chart](out/chart.png) inline."), detail(1, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" }), detail(2, DetailKind.Text, "Done.")
    ]));
    await click(part(".activity-toggle"));
    await Wait.until(() => expect(part(".step-text .nol-teamrun-image-frame img")).not.toBeNull(), MarkdownWait.coldImport);
    fixture.detectChanges();
    const text = part(".step-text")!;
    const style = getComputedStyle(text);
    const paragraph = text.querySelector("p")!;
    const holder = text.querySelector(".nol-markdown-image")!;
    const preview = holder.querySelector("nol-teamrun-image-preview")!;
    const frame = holder.querySelector(".nol-teamrun-image-frame")!;

    expect(element().querySelectorAll(".nol-markdown-image")).toHaveLength(1);
    expect(paragraph.textContent).toContain("Here is");
    expect(getComputedStyle(holder).display).toBe("inline-block");
    AppearanceFixture.expectPixels(rect(preview).top - rect(holder).top, space(3));
    AppearanceFixture.expectPixels(rect(holder).bottom - rect(preview).bottom, space(3));
    AppearanceFixture.expectPixels(rect(frame).width, 48);
    AppearanceFixture.expectPixels(rect(frame).height, 32);
    AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(frame).borderTopWidth), AppearanceFixture.measureLook("border-width"));
    expect(rect(frame).left).toBeGreaterThan(rect(paragraph).left);
    expect(rect(paragraph).left).toBeGreaterThanOrEqual(rect(text).left + Number.parseFloat(style.borderInlineStartWidth) + Number.parseFloat(style.paddingInlineStart) - 0.5);
    expect(rect(frame).right).toBeLessThanOrEqual(rect(text).right + 0.5);
    expect(rect(holder).top).toBeGreaterThanOrEqual(rect(text).top - 0.5);
    expect(rect(holder).bottom).toBeLessThanOrEqual(rect(text).bottom + 0.5);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const note = "The chain stopped after 4 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.";
    const textStart = (view: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(view.querySelector("p") ?? view);
      return range.getBoundingClientRect().left;
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sets the latest step's line in the Working line's color, with no border, and its icon in the spinner's column", () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(1, DetailKind.Command, "> ls", { tool: "Bash" })]));
      const line = one(".activity-step");
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gap = Number.parseFloat(getComputedStyle(line).getPropertyValue("--nol-space-2"));

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(getComputedStyle(line).color).toBe(getComputedStyle(one(".activity-text")).color);
      expect(getComputedStyle(line).borderTopWidth).toBe("0px");
      expect(box(".activity-step-glyph").left).toBeCloseTo(box(".activity-line nol-spinner").left, 1);
      expect(box(".activity-step-title").left).toBeCloseTo(box(".activity-text").left, 1);
      expect((box(".activity-step").top - box(".activity-line").bottom) / rem).toBeCloseTo(gap, 2);
    });

    it("offers Run on a reply's shell code block before Copy, on the toolbar's row and spacing, never on the person's own, and runs it in the chat's terminal", async () => {
      const runs: unknown[][] = [];
      const terminals = ChatTerminals.provide(context, store(), { runAsync: (...parts) => {
        runs.push(parts);
        return Promise.resolve("session-1");
      } });
      try {
        await Wait.until(() => expect(store().loaded()).toBe(true));
        const text = "Run this:\n\n```bash\nnpm test\n```";
        render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, text)], null, SampleData.timestamp, null,
          SampleData.timestamp));
        await Wait.until(() => expect(element().querySelector(".nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);
        const personRuns = element().querySelectorAll(".nol-code-block-run").length;
        fixture.destroy();
        render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, text)]));
        await Wait.until(() => expect(element().querySelector(".nol-code-block-run")).not.toBeNull(), MarkdownWait.coldImport);
        const [wrap, run, copy] = [".nol-code-block-wrap", ".nol-code-block-run", ".nol-code-block-copy"].map(t => box(t));
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

        expect(personRuns).toBe(0);
        expect(run!.width).toBeGreaterThan(0);
        expect(run!.left).toBeGreaterThanOrEqual(wrap!.right);
        expect(copy!.left).toBeGreaterThanOrEqual(run!.right);
        expect(Math.abs((copy!.left - run!.right) - (run!.left - wrap!.right)) / rem).toBeLessThan(0.02);
        expect(Math.abs(middleOf(run!) - middleOf(copy!)) / rem).toBeLessThan(0.02);
        expect(Math.abs(run!.height - copy!.height) / rem).toBeLessThan(0.02);
        await click(element().querySelector(".nol-code-block-run"));
        await Wait.until(() => expect(runs).toEqual([["teamrun.chat/c1", "npm test", "D:\\repo", [TerminalShellKind.Bash]]]));
        expect(context.shownNotices(Resources.chatActionFailedNotice)).toEqual([]);
      }
      finally {
        await terminals.removeAsync();
      }
    });

    it("counts a reply's running background tasks in a chip after its state in its header, centred on the author, and drops it once none runs", async () => {
      const task = (id: string, messageId: string, status: BackgroundTaskStatus): BackgroundTask =>
        new BackgroundTask(id, "c1", messageId, "codex", `run ${id}`, status, null, SampleData.timestamp, status === BackgroundTaskStatus.Running ? null : SampleData.timestamp, "");
      const tasks = [task("t1", "m2", BackgroundTaskStatus.Running), task("t2", "m2", BackgroundTaskStatus.Running), task("t3", "m2", BackgroundTaskStatus.Completed),
        task("t4", "m9", BackgroundTaskStatus.Running)];
      context.answer(MethodName.BackgroundTaskList, () => SampleData.tasks(tasks));
      const store = BackgroundTaskStoreService.of(context);
      store.watch("c1");
      await Wait.until(() => expect(store.tasksOf("c1")).toHaveLength(4));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval));
      const chips = (): string[] => [...element().querySelectorAll(".nol-message-header .nol-chip")].map(t => t.textContent?.trim() ?? "");

      expect(chips()).toEqual([Resources.awaitingApprovalLabel, "2 tasks running"]);
      const [state, running] = [...element().querySelectorAll<HTMLElement>(".nol-message-header .nol-chip")].map(t => t.getBoundingClientRect());
      const model = [...element().querySelectorAll<HTMLElement>(".nol-message-header > *")].map(t => t.getBoundingClientRect());
      AppearanceFixture.expectPixels((running as DOMRect).left - (state as DOMRect).right, (model[2] as DOMRect).left - (model[1] as DOMRect).right);
      AppearanceFixture.expectPixels(Math.abs(middleOf(running as DOMRect) - middleOf(box(".nol-message-author"))), 0);
      expect(getComputedStyle(element().querySelector(".nol-teamrun-running-tasks") as Element).height).toBe(getComputedStyle(element().querySelector(".nol-message-header .nol-chip") as Element).height);

      context.emit(EventName.BackgroundTaskUpdated, (tasks[0] as BackgroundTask).withEnd(BackgroundTaskStatus.Stopped, null, SampleData.timestamp).toJson());
      await fixture.whenStable();
      fixture.detectChanges();
      expect(chips()).toEqual([Resources.awaitingApprovalLabel, "1 task running"]);
      context.emit(EventName.BackgroundTaskUpdated, (tasks[1] as BackgroundTask).withEnd(BackgroundTaskStatus.Completed, 0, SampleData.timestamp).toJson());
      await fixture.whenStable();
      fixture.detectChanges();
      expect(chips()).toEqual([Resources.awaitingApprovalLabel]);
    });

    it("frames a reply's plan at its text's width like its code block, with the code block's border, corners, colours and header, its glyph, title, progress and chevron 0.5rem apart, folded to its header alone", async () => {
      const title = `${"Move the cache to the new store ".repeat(8)}now`;
      const text = detail(4, DetailKind.Plan, title, new ReplyPlan([], null, title).toJson());
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Here's my plan.\n\n```text\nnpm test\n```"), text,
        planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending), detail(3, DetailKind.Text, "Done.")]));
      await Wait.until(() => expect(element().querySelector(".nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);
      await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const style = (target: Element | null | undefined): CSSStyleDeclaration => getComputedStyle(target as Element);
      const paragraph = [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === "Here's my plan.");
      const view = paragraph?.closest(".nol-markdown-view");
      const [code, codeHeader] = [".nol-code-block", ".nol-code-block-header"].map(t => element().querySelector(t));
      const card = element().querySelector("nol-teamrun-plan-card");
      const header = element().querySelector("nol-teamrun-plan-card .header");
      const [glyph, name, progress, chevron] = ["glyph", "title", "progress", "chevron"].map(t => element().querySelector(`nol-teamrun-plan-card .${t}`));
      const border = parseFloat(style(card).borderTopWidth);
      const inset = parseFloat(style(codeHeader).paddingLeft);
      const space = AppearanceFixture.measureLook("space-2");

      const frame = ["border-top-width", "border-top-style", "border-top-color", "border-left-color", "border-top-left-radius", "border-bottom-right-radius", "background-color"];
      for (const property of frame)
        expect([property, style(card).getPropertyValue(property)]).toEqual([property, style(code).getPropertyValue(property)]);
      for (const property of ["background-color", "font-size", "line-height"])
        expect([property, style(header).getPropertyValue(property)]).toEqual([property, style(codeHeader).getPropertyValue(property)]);
      expect(style(progress).color).toBe(style(codeHeader).color);
      AppearanceFixture.expectPixels(rect(header).height, rect(codeHeader).height);
      AppearanceFixture.expectPixels(rect(header).height, AppearanceFixture.measureLook("code-header-height"));
      AppearanceFixture.expectPixels(rect(card).height, rect(header).height + 2 * border);
      expect([style(header).borderBottomWidth, element().querySelector("nol-teamrun-plan-card .body")]).toEqual(["0px", null]);
      AppearanceFixture.expectPixels(rect(card).left, rect(view).left);
      AppearanceFixture.expectPixels(rect(card).right, rect(view).right);
      expect(rect(card).top - rect(code).bottom).toBeGreaterThanOrEqual(space - 0.5);
      AppearanceFixture.expectPixels(rect(glyph).left - rect(card).left - border, inset);
      AppearanceFixture.expectPixels(rect(card).right - border - rect(chevron).right, inset);
      AppearanceFixture.expectPixels(rect(name).left - rect(glyph).right, space);
      AppearanceFixture.expectPixels(rect(progress).left - rect(name).right, space);
      AppearanceFixture.expectPixels(rect(chevron).left - rect(progress).right, space);
      expect(rect(name).height).toBeLessThan(rect(name).width);
      expect(name!.scrollWidth).toBeGreaterThan(name!.clientWidth);
      AppearanceFixture.expectPixels(middleOf(rect(name)), middleOf(rect(glyph)));
      AppearanceFixture.expectPixels(middleOf(rect(progress)), middleOf(rect(glyph)));
      AppearanceFixture.expectPixels(middleOf(rect(chevron)), middleOf(rect(header)));
    });

    it("puts Approve plan in a row under the plan's header, ruled like its body, the button at the plan text's start with the body's padding", async () => {
      await planningChat();
      render(awaitingPlan());
      await Wait.until(() => expect(approveButton()).not.toBeNull());
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const style = (target: Element | null | undefined): CSSStyleDeclaration => {
        if (Object.isNullOrUndefined(target))
          throw new Error("The plan card has no such part.");
        return getComputedStyle(target);
      };
      const [card, header, actions] = ["nol-teamrun-plan-card", "nol-teamrun-plan-card .header", "nol-teamrun-plan-card .actions"].map(t => element().querySelector(t));
      const border = parseFloat(style(card).borderTopWidth);
      const space2 = AppearanceFixture.measureLook("space-2");
      const start = rect(approveButton()).left;
      const end = rect(approveButton()).right;

      AppearanceFixture.expectPixels(rect(actions).top, rect(header).bottom);
      expect([parseFloat(style(actions).borderTopWidth), style(actions).borderTopStyle]).toEqual([border, "solid"]);
      AppearanceFixture.expectPixels(rect(approveButton()).top, rect(actions).top + space2);
      AppearanceFixture.expectPixels(rect(card).bottom - border, rect(approveButton()).bottom + space2);
      if (forcedColors === "none")
        expect(style(actions).borderTopColor).toBe(style(card).borderTopColor);
      await click(element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header"));
      const body = element().querySelector("nol-teamrun-plan-card .body");
      const text = (): Element | undefined => [...element().querySelectorAll("nol-teamrun-plan-card .body p")].find(t => t.textContent?.trim() === "Tidy the cache first.");
      await Wait.until(() => expect(text()).toBeDefined(), MarkdownWait.coldImport);
      const markdown = text()?.closest(".nol-markdown-view");
      AppearanceFixture.expectPixels(rect(actions).top, rect(body).bottom);
      AppearanceFixture.expectPixels(rect(approveButton()).left, start);
      AppearanceFixture.expectPixels(start, rect(markdown).left);
      expect(end).toBeLessThanOrEqual(rect(markdown).right + 0.5);
    });

    it("says Not approved in a refused plan text's block header where its progress sits, muted, 0.5rem from its title and chevron and centred on its glyph", async () => {
      const text = detail(4, DetailKind.Plan, "Move the cache", new ReplyPlan([], null, "Move the cache", true).toJson());
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Here's my plan."), text,
        planned(PlanStepStatus.Completed, PlanStepStatus.Pending), detail(3, DetailKind.Text, "Done.")]));
      await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const [glyph, name, progress, chevron] = ["glyph", "title", "progress", "chevron"].map(t => element().querySelector(`nol-teamrun-plan-card .${t}`));
      const space = AppearanceFixture.measureLook("space-2");
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      const muted = getComputedStyle(probe).color;
      probe.remove();

      expect([name?.textContent?.trim(), progress?.textContent?.trim()]).toEqual(["Move the cache", Resources.planNotApproved]);
      AppearanceFixture.expectPixels(rect(progress).left - rect(name).right, space);
      AppearanceFixture.expectPixels(rect(chevron).left - rect(progress).right, space);
      AppearanceFixture.expectPixels(middleOf(rect(progress)), middleOf(rect(glyph)));
      expect(getComputedStyle(progress!).color).toBe(muted);
      if (forcedColors === "none")
        expect(muted).not.toBe(getComputedStyle(name!).color);
    });

    it("opens a reply's plan inside its block, under a header line of the code block's border, its text then its checklist 0.5rem apart with the code block's padding", async () => {
      const text = detail(4, DetailKind.Plan, "Move the cache", new ReplyPlan([], null, "Move the cache first.").toJson());
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Here's my plan.\n\n```text\nnpm test\n```"), text,
        planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending), detail(3, DetailKind.Text, "Done.")]));
      await Wait.until(() => expect(element().querySelector(".nol-code-block-copy")).not.toBeNull(), MarkdownWait.coldImport);
      await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
      await click(element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header"));
      const rect = (target: Element | null | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const style = (target: Element | null | undefined): CSSStyleDeclaration => getComputedStyle(target as Element);
      const paragraph = (value: string): Element | undefined => [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === value);
      await Wait.until(() => expect(paragraph("Move the cache first.")).toBeDefined(), MarkdownWait.coldImport);
      const [codeHeader, codeText] = [".nol-code-block-header", ".nol-code-block-body > code"].map(t => element().querySelector(t));
      const card = element().querySelector("nol-teamrun-plan-card");
      const header = element().querySelector("nol-teamrun-plan-card .header");
      const body = element().querySelector("nol-teamrun-plan-card .body");
      const markdown = paragraph("Move the cache first.")?.closest(".nol-markdown-view");
      const plan = element().querySelector("nol-teamrun-plan-card nol-plan");
      const border = parseFloat(style(card).borderTopWidth);
      const padding = (target: Element | null | undefined): number[] =>
        [style(target).paddingTop, style(target).paddingRight, style(target).paddingBottom, style(target).paddingLeft].map(t => parseFloat(t));
      const [top, end, bottom, start] = padding(codeText) as [number, number, number, number];

      expect([style(body).borderTopWidth, style(body).borderTopStyle, style(body).borderTopColor, style(header).borderBottomWidth])
        .toEqual([style(codeHeader).borderBottomWidth, style(codeHeader).borderBottomStyle, style(codeHeader).borderBottomColor, "0px"]);
      AppearanceFixture.expectPixels(rect(header).height, rect(codeHeader).height);
      AppearanceFixture.expectPixels(rect(body).top, rect(header).bottom);
      const [bodyTop, ...bodyRest] = padding(body) as [number, number, number, number];
      expect([bodyTop + parseFloat(style(body).borderTopWidth), ...bodyRest]).toEqual([top, end, bottom, start]);
      expect(style(body).backgroundColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\)$/u);
      AppearanceFixture.expectPixels(rect(markdown).left, rect(card).left + border + start);
      AppearanceFixture.expectPixels(rect(plan).left, rect(markdown).left);
      expect([style(plan).borderTopWidth, style(plan).borderLeftWidth, style(plan).paddingTop, style(plan).paddingLeft]).toEqual(["0px", "0px", "0px", "0px"]);
      AppearanceFixture.expectPixels(rect(plan?.querySelector(".nol-plan-step")).left, rect(markdown).left);
      AppearanceFixture.expectPixels(rect(plan).right, rect(card).right - border - end);
      AppearanceFixture.expectPixels(rect(markdown).top, rect(header).bottom + top);
      expect(rect(plan).top - rect(paragraph("Move the cache first.")).bottom).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("space-2") - 0.5);
      AppearanceFixture.expectPixels(rect(card).bottom, rect(plan).bottom + bottom + border);
    });

    it("keeps a reply's plan header's glyph, title, progress and chevron, and its height, where they are as the plan opens and closes", async () => {
      const text = detail(4, DetailKind.Plan, "Move the cache", new ReplyPlan([], null, "Move the cache first.").toJson());
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [detail(0, DetailKind.Text, "Here's my plan."), text,
        planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending), detail(3, DetailKind.Text, "Done.")]));
      await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
      const header = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header")!;
      const boxes = (): number[][] => {
        const card = element().querySelector("nol-teamrun-plan-card")!.getBoundingClientRect();
        return [header(), ...["glyph", "title", "progress", "chevron"].map(t => element().querySelector(`nol-teamrun-plan-card .${t}`)!)]
          .map(t => t.getBoundingClientRect()).map(t => [t.left - card.left, t.top - card.top, t.width, t.height]);
      };
      const expectBoxes = (actual: number[][], expected: number[][]): void => actual.forEach((t, i) => t.forEach((u, j) => AppearanceFixture.expectPixels(u, expected[i]![j]!)));
      const closed = boxes();

      await click(header());
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card nol-plan")).not.toBeNull(), MarkdownWait.coldImport);
      expect(header().getAttribute("aria-expanded")).toBe("true");
      expectBoxes(boxes(), closed);
      await click(header());

      expect(element().querySelector("nol-teamrun-plan-card .body")).toBeNull();
      expectBoxes(boxes(), closed);
    });

    it("sets a reply's Markdown image inline in its line, 0.75rem above and below, at its own size in a frame of the border's width, with its alt text in its place while it loads", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 32;
      const url = canvas.toDataURL("image/png");
      let release: () => void = () => undefined;
      context.answer(MethodName.WrittenImageRead, () => new Promise(resolve =>
        release = () => resolve(new AttachmentContent("chart.png", "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson())));
      context.answer(MethodName.MessagePage, () => new MessagePage([SampleData.userMessage], false, false, 1).toJson());
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
      const rect = (target: Element | null): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
      const part = (selector: string): HTMLElement | null => element().querySelector<HTMLElement>(selector);

      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
        [detail(0, DetailKind.Text, "Here is ![the chart](out/chart.png) inline.\n\nAnd the next paragraph.")]));
      await Wait.until(() => expect(part(".nol-teamrun-image-fallback")?.textContent?.trim()).toBe("the chart"), MarkdownWait.coldImport);
      const paragraph = part(".nol-markdown-image")!.closest("p")!;
      const loading = part(".nol-teamrun-image-fallback")!;
      expect(context.count(MethodName.WrittenImageRead)).toBe(1);
      expect(part(".nol-teamrun-image-frame")).toBeNull();
      expect(paragraph.textContent?.replace(/\s+/g, " ").trim()).toBe("Here is the chart inline.");
      expect([getComputedStyle(loading).color, getComputedStyle(loading).fontSize]).toEqual([getComputedStyle(paragraph).color, getComputedStyle(paragraph).fontSize]);
      expect(rect(loading).left).toBeGreaterThan(rect(paragraph).left);
      expect(rect(loading).bottom).toBeLessThanOrEqual(rect(paragraph).bottom + 0.5);

      release();
      await Wait.until(() => expect(part(".nol-teamrun-image-frame img")).not.toBeNull());
      fixture.detectChanges();
      const holder = part(".nol-markdown-image")!;
      const preview = holder.querySelector("nol-teamrun-image-preview")!;
      const frame = holder.querySelector(".nol-teamrun-image-frame")!;
      const next = [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === "And the next paragraph.")!;

      expect(getComputedStyle(holder).display).toBe("inline-block");
      AppearanceFixture.expectPixels(rect(preview).top - rect(holder).top, space(3));
      AppearanceFixture.expectPixels(rect(holder).bottom - rect(preview).bottom, space(3));
      AppearanceFixture.expectPixels(rect(frame).width, 48);
      AppearanceFixture.expectPixels(rect(frame).height, 32);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(frame).borderTopWidth), AppearanceFixture.measureLook("border-width"));
      expect(rect(frame).left).toBeGreaterThan(rect(paragraph).left);
      expect(rect(holder).top).toBeGreaterThanOrEqual(rect(paragraph).top - 0.5);
      expect(rect(holder).bottom).toBeLessThanOrEqual(rect(paragraph).bottom + 0.5);
      expect(rect(next).top).toBeGreaterThanOrEqual(rect(paragraph).bottom);
      expect(part(".nol-teamrun-image-caption")).toBeNull();
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
    });

    it("draws a reply's file link in its line like its web link, at the text's size, in the link colour", async () => {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
        [detail(0, DetailKind.Text, "See [the code](src/a.ts:42) and [the docs](https://example.com/docs) here.")]));
      const links = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("a.nol-markdown-link")];
      await Wait.until(() => expect(links()).toHaveLength(2), MarkdownWait.coldImport);
      const [code, docs] = links() as [HTMLElement, HTMLElement];
      const paragraph = code.closest("p")!;
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = forcedColors === "active" ? "LinkText" : "var(--nol-link)";
      const look = (view: Element): string[] =>
        ["color", "text-decoration-line", "font-size", "line-height", "font-family", "font-weight", "cursor"].map(t => getComputedStyle(view).getPropertyValue(t));

      try {
        expect(ShownText.of(code)).toBe("the code");
        expect([code.querySelector("nol-file-badge")?.getAttribute("aria-hidden"), docs.querySelector("nol-file-badge")]).toEqual(["true", null]);
        expect(look(code)).toEqual(look(docs));
        expect(getComputedStyle(code).color).toBe(getComputedStyle(probe).color);
        expect(getComputedStyle(code).fontSize).toBe(getComputedStyle(paragraph).fontSize);
        AppearanceFixture.expectPixels(code.getBoundingClientRect().height, docs.getBoundingClientRect().height);
        expect(Math.abs(middleOf(code.getBoundingClientRect()) - middleOf(docs.getBoundingClientRect()))).toBeLessThanOrEqual(0.5);
        expect(code.getBoundingClientRect().left).toBeGreaterThan(paragraph.getBoundingClientRect().left);
        expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      }
      finally {
        probe.remove();
      }
    });

    it("puts the sending chat's link in a sent message's header one header gap after the teammate's name, centred on its line, at its size, in the link colour", async () => {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(sentFrom("c1"));
      const link = element().querySelector<HTMLElement>(".sender-chat")!;
      const author = element().querySelector(".nol-message-author")!;
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = forcedColors === "active" ? "LinkText" : "var(--nol-link)";
      const look = (view: Element): string[] => [getComputedStyle(view).fontSize, getComputedStyle(view).lineHeight, getComputedStyle(view).fontFamily];

      try {
        AppearanceFixture.expectPixels(link.getBoundingClientRect().left - author.getBoundingClientRect().right, AppearanceFixture.measureLook("space-3"));
        expect(Math.abs(middleOf(link.getBoundingClientRect()) - middleOf(author.getBoundingClientRect()))).toBeLessThanOrEqual(1);
        expect(look(link)).toEqual(look(author));
        expect(getComputedStyle(link).color).toBe(getComputedStyle(probe).color);
        expect(getComputedStyle(link).cursor).toBe("pointer");
        await userEvent.unhover(link);
        expect(getComputedStyle(link).textDecorationLine).toBe("none");
        await userEvent.hover(link);
        expect(getComputedStyle(link).textDecorationLine).toBe("underline");
      }
      finally {
        await userEvent.unhover(link);
        probe.remove();
      }
    });

    it("puts a waiting reply's approval after the files it edited and above its footer, at the reply's full width and the blocks' spacing, the files' header and rows across their card", async () => {
      await openConversation();
      render(awaiting());
      await Wait.until(() => expect(cards()).toHaveLength(1));
      const [files, approvals, content] = [box("nol-teamrun-edited-files"), box("nol-teamrun-reply-approvals"), box(".nol-message-content")];

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(approvals.height).toBeGreaterThan(0);
      expect(approvals.top - files.bottom).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(approvals.top - files.bottom, AppearanceFixture.measureLook("space-2"));
      expect(approvals.bottom).toBeLessThanOrEqual(box(".nol-message-footer").top + 0.5);
      AppearanceFixture.expectPixels(approvals.left, content.left);
      AppearanceFixture.expectPixels(approvals.width, content.width);
      AppearanceFixture.expectPixels(cards()[0]?.getBoundingClientRect().width ?? 0, approvals.width);
      for (const row of [box("nol-teamrun-edited-files .header"), box("nol-teamrun-edited-files .file")]) {
        AppearanceFixture.expectPixels(row.left, files.left + AppearanceFixture.measureLook("border-width"));
        AppearanceFixture.expectPixels(row.right, files.right - AppearanceFixture.measureLook("border-width"));
      }
    });

    it("keeps a reply's answered question where it was asked, below the text before it and above the plan and text that came after it", async () => {
      const at = (minute: number): string => `2026-09-10T08:0${minute}:00.000Z`;
      const timed = (sequence: number, kind: DetailKind, text: string, minute: number, payload: JsonValue = null): MessageDetail =>
        new MessageDetail(sequence, kind, text, payload, at(minute));
      const asked = new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending,
        null, at(2), null, question().questions);
      const first = timed(0, DetailKind.Text, "Let me ask first.", 1);
      const paragraph = (value: string): DOMRect => [...element().querySelectorAll("p")].find(t => t.textContent?.trim() === value)?.getBoundingClientRect() ?? new DOMRect();
      await openConversation();
      context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());
      await Wait.until(() => expect(store().pendingApprovals()).toEqual([]));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [first]));
      context.emit(EventName.ApprovalCreated, asked.toJson());
      await Wait.until(() => expect(element().querySelector("nol-teamrun-question-card")).not.toBeNull(), MarkdownWait.coldImport);
      context.emit(EventName.ApprovalUpdated, asked.withDecision("yes", at(2), [new QuestionAnswer("platform", ["Web"], null)]).toJson());
      await Wait.until(() => expect(textOf(".nol-teamrun-question-card-reply")).toBe("Web"));
      await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [first,
        timed(1, DetailKind.Plan, "Plan", 3, new ReplyPlan([], null, "## Ship it\n\nThen tell me.").toJson()), timed(2, DetailKind.Text, "Approve it when ready.", 4)]));
      await Wait.until(() => expect(paragraph("Approve it when ready.").height).toBeGreaterThan(0), MarkdownWait.coldImport);
      const [before, card, plan, after] = [paragraph("Let me ask first."), box("nol-teamrun-question-card"), box("nol-teamrun-plan-card"), paragraph("Approve it when ready.")];

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect([before.height, card.height, plan.height].every(t => t > 0)).toBe(true);
      expect(card.top).toBeGreaterThan(before.bottom);
      expect(plan.top).toBeGreaterThan(card.bottom);
      expect(after.top).toBeGreaterThan(plan.bottom);
      expect(element().querySelectorAll("nol-teamrun-reply-approvals")).toHaveLength(1);
    });

    it("keeps a reply's line right under its name from its start past its end, its spinner at its start while working, and opens its steps right under it, moving nothing above them", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 2)));
      await Wait.until(() => expect(element().querySelector("strong")).not.toBeNull(), MarkdownWait.coldImport);
      const line = (): DOMRect => box(".activity-line");
      const header = box(".nol-message-header");
      const start = line();

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(start.top).toBeGreaterThanOrEqual(header.bottom - 0.5);
      expect(start.top - header.bottom).toBeLessThanOrEqual(AppearanceFixture.measureLook("space-4"));
      expect(start.bottom).toBeLessThanOrEqual(box("strong").top);
      AppearanceFixture.expectPixels(start.left, box(".nol-markdown-view").left);
      AppearanceFixture.expectPixels(box(".activity-line nol-spinner").left, start.left);
      AppearanceFixture.expectPixels(box(".activity-toggle").left - box(".activity-line nol-spinner").right, AppearanceFixture.measureLook("space-2"));
      expect(Math.abs(middleOf(box(".activity-line nol-spinner")) - middleOf(box(".activity-toggle")))).toBeLessThanOrEqual(1);
      expect(box(".nol-message-footer").top).toBeGreaterThanOrEqual(box("strong").bottom);

      await click(element().querySelector(".activity-toggle"));
      const opened = box("nol-teamrun-activity-block");
      AppearanceFixture.expectPixels(line().top, start.top);
      AppearanceFixture.expectPixels(box(".nol-message-header").top, header.top);
      expect(opened.top).toBeGreaterThanOrEqual(line().bottom - 0.5);
      expect(opened.top - line().bottom).toBeLessThanOrEqual(AppearanceFixture.measureLook("space-4"));
      AppearanceFixture.expectPixels(opened.left, start.left);
      expect(box("strong").top).toBeGreaterThanOrEqual(opened.bottom);

      await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 2)));
      AppearanceFixture.expectPixels(line().top, start.top);
      AppearanceFixture.expectPixels(line().left, start.left);
      expect(textOf(".activity-text")).toBe("Worked for 0s");
      expect(element().querySelector("nol-spinner")).toBeNull();
      AppearanceFixture.expectPixels(box(".activity-toggle").left, start.left);
      AppearanceFixture.expectPixels(box("nol-teamrun-activity-block").top, opened.top);
    });

    it("shows the note that a hand-off chain stopped as its own muted line after the reply, in the answer's size, from its start edge, outside the reply and its Activity", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Text, "@Bob yours"), detail(1, DetailKind.Note, note, { source: "handOff" })
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const answer = element().querySelector(".nol-markdown-view")!;
      const reply = element().querySelector("nol-message")!;
      const line = element().querySelector(".hand-off-note");
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      const look = (view: Element): string[] => [getComputedStyle(view).fontSize, getComputedStyle(view).lineHeight];

      expect([answer.textContent?.trim(), line?.textContent?.trim()]).toEqual(["@Bob yours", note]);
      expect(reply.contains(line)).toBe(false);
      expect(line!.getBoundingClientRect().top).toBeGreaterThanOrEqual(reply.getBoundingClientRect().bottom);
      AppearanceFixture.expectPixels(line!.getBoundingClientRect().left, answer.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(textStart(line!) - textStart(answer), AppearanceFixture.measureLook("space-3") + 2 * AppearanceFixture.measureLook("border-width"));
      expect(getComputedStyle(line!).color).toBe(getComputedStyle(probe).color);
      expect(look(line!)).toEqual(look(answer));
      expect(element().querySelector(".activity-toggle")).toBeNull();
      probe.remove();
    });

    it("shows a resume note as the reply's first muted line, below its header and above its Activity and answer, in the answer's size, from its start edge", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Note, "The native session could not be resumed, so a fresh one was started: Invalid params", { source: "resume" }),
        detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
        detail(2, DetailKind.Text, "Hi again.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const answer = element().querySelector(".nol-markdown-view")!;
      const reply = element().querySelector("nol-message")!;
      const header = element().querySelector(".nol-message-header")!.getBoundingClientRect();
      const toggle = element().querySelector(".activity-toggle")!.getBoundingClientRect();
      const line = element().querySelector(".resume-note")!;
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      const look = (view: Element): string[] => [getComputedStyle(view).fontSize, getComputedStyle(view).lineHeight];
      const mark = line.getBoundingClientRect();

      expect(reply.contains(line)).toBe(true);
      expect(mark.height).toBeGreaterThan(0);
      expect(mark.top).toBeGreaterThanOrEqual(header.bottom);
      expect(toggle.top).toBeGreaterThanOrEqual(mark.bottom);
      expect(answer.getBoundingClientRect().top).toBeGreaterThan(mark.bottom);
      AppearanceFixture.expectPixels(mark.left, answer.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(textStart(line) - textStart(answer), AppearanceFixture.measureLook("space-3") + 2 * AppearanceFixture.measureLook("border-width"));
      expect(getComputedStyle(line).color).toBe(getComputedStyle(probe).color);
      expect(look(line)).toEqual(look(answer));
      probe.remove();
    });

    it("shows a Sustain move note as the reply's first muted line at the message size, led by its glyph 6 px before its text from the answer's start edge, with no bar", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Note, "Moved to Codex, Spare because Work reached its usage limit; new session with a handover", { source: "sustain" }),
        detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
        detail(2, DetailKind.Text, "Hi again.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const answer = one(".nol-markdown-view");
      const reply = one("nol-message");
      const header = box(".nol-message-header");
      const toggle = box(".activity-toggle");
      const line = one(".sustain-note");
      const glyph = box(".sustain-note-glyph");
      const text = one(".sustain-note-text");
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      probe.style.fontSize = "var(--nol-text-message)";
      probe.style.lineHeight = "calc(var(--nol-text-message) * var(--nol-line-message))";
      const look = (view: Element): string[] => [getComputedStyle(view).color, getComputedStyle(view).fontSize, getComputedStyle(view).lineHeight];
      const mark = line.getBoundingClientRect();
      const glyphLine = Number.parseFloat(getComputedStyle(one(".sustain-note-glyph")).height);

      expect(reply.contains(line)).toBe(true);
      expect(mark.top).toBeGreaterThanOrEqual(header.bottom);
      expect(toggle.top).toBeGreaterThanOrEqual(mark.bottom);
      expect(answer.getBoundingClientRect().top).toBeGreaterThan(mark.bottom);
      AppearanceFixture.expectPixels(glyph.left, answer.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(glyph.width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(glyph.top, mark.top);
      AppearanceFixture.expectPixels(textStart(text) - glyph.right, AppearanceFixture.measureLook("space-1") * 1.5);
      AppearanceFixture.expectPixels(text.getBoundingClientRect().top, mark.top);
      AppearanceFixture.expectPixels(glyphLine, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(probe).fontSize), 13);
      expect(getComputedStyle(line).borderInlineStartWidth).toBe("0px");
      expect(look(text)).toEqual(look(probe));
      probe.remove();
    });

    it("draws Show handover in the link colour right after the note's text, and opened, the handover as a raised box 20 px in under the note, its heading strong, its parts with the summary's line one under another and its closing line muted", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Note, "Moved to Codex, Spare because Work reached its usage limit; new session with a handover.",
          { source: "sustain", handover: "Bob's chat so far", carried: ["Bob's first message, the original request",
            "Claude's last compaction summary, covering messages 1 to 3", "Messages 4 to 9 whole"],
            reads: "Codex reads what was left out with list-messages, as it reads any chat." }),
        detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
        detail(2, DetailKind.Text, "Hi again.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const answer = one(".nol-markdown-view");
      const line = one(".sustain-note");
      const glyph = box(".sustain-note-glyph");
      const text = one(".sustain-note-text");
      const button = one(".sustain-handover-toggle");
      const probe = element().appendChild(document.createElement("div"));
      probe.style.color = forcedColors === "active" ? "LinkText" : "var(--nol-link)";
      probe.style.backgroundColor = "var(--nol-raised)";
      const words = document.createRange();
      words.setStart(text, 0);
      words.setEnd(text, 1);
      const start = answer.getBoundingClientRect().left;

      AppearanceFixture.expectPixels(glyph.left, start);
      AppearanceFixture.expectPixels(textStart(text) - glyph.right, AppearanceFixture.measureLook("space-1") * 1.5);
      expect(button.getBoundingClientRect().left).toBeGreaterThan(words.getBoundingClientRect().left);
      expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(line.getBoundingClientRect().top - 0.5);
      expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(line.getBoundingClientRect().bottom + 0.5);
      expect([getComputedStyle(button).color, getComputedStyle(button).fontSize, getComputedStyle(button).borderTopWidth])
        .toEqual([getComputedStyle(probe).color, getComputedStyle(text).fontSize, "0px"]);

      await click(button);
      const handover = one(".sustain-handover");
      const shown = handover.getBoundingClientRect();
      const style = getComputedStyle(handover);
      const heading = one(".sustain-handover-heading", handover);
      const parts = [...handover.querySelectorAll(".sustain-handover-part")].map(t => t.getBoundingClientRect());
      const reads = one(".sustain-handover-reads", handover);
      const tone = (name: string): string => {
        probe.style.color = `var(--nol-${name})`;
        return getComputedStyle(probe).color;
      };

      AppearanceFixture.expectPixels(shown.top - line.getBoundingClientRect().bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(shown.left - start, AppearanceFixture.measureLook("icon") + AppearanceFixture.measureLook("space-1"));
      expect(box(".activity-toggle").top).toBeGreaterThanOrEqual(shown.bottom);
      expect(answer.getBoundingClientRect().top).toBeGreaterThan(shown.bottom);
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), AppearanceFixture.measureLook("border-width"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), (AppearanceFixture.measureLook("space-2") + AppearanceFixture.measureLook("space-3")) / 2);
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingInlineStart), AppearanceFixture.measureLook("space-3"));
      expect(style.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      AppearanceFixture.expectPixels(heading.getBoundingClientRect().top - shown.top, Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop));
      AppearanceFixture.expectPixels(heading.getBoundingClientRect().left - shown.left, Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft));
      AppearanceFixture.expectPixels((parts[0]?.top ?? 0) - heading.getBoundingClientRect().bottom, AppearanceFixture.measureLook("space-1"));
      expect([...handover.querySelectorAll(".sustain-handover-part")].map(t => t.textContent)[1]).toBe("Claude's last compaction summary, covering messages 1 to 3");
      for (const [above, below] of [[parts[0], parts[1]], [parts[1], parts[2]]] as const) {
        AppearanceFixture.expectPixels((below?.top ?? 0) - (above?.bottom ?? 0), AppearanceFixture.measureLook("space-1"));
        AppearanceFixture.expectPixels(below?.left ?? 0, heading.getBoundingClientRect().left);
      }
      AppearanceFixture.expectPixels(reads.getBoundingClientRect().top - (parts[2]?.bottom ?? 0), AppearanceFixture.measureLook("space-1"));
      expect([getComputedStyle(heading).color, getComputedStyle(reads).color, getComputedStyle(handover.querySelector(".sustain-handover-part") ?? handover).color])
        .toEqual([tone("text-strong"), tone("text-muted"), tone("text")]);
      expect(Number.parseInt(getComputedStyle(heading).fontWeight, 10)).toBeGreaterThan(Number.parseInt(getComputedStyle(reads).fontWeight, 10));
      probe.remove();
    });

    it("shows a chat's wake as a closed row of one pointer target's height below the reply's header and above its Activity, from the answer's start edge, and its replies below it once opened", async () => {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Note, `Received a message from "First".`,
          { source: "wakeReceived", wakeChatId: "c1", wakeReplies: [{ name: "Bob", status: MessageStatus.Completed, text: "The login fix is in." }] }),
        detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
        detail(2, DetailKind.Text, "The tests passed.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const rect = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const middle = (selector: string): number => rect(selector).top + rect(selector).height / 2;
      const target = AppearanceFixture.measureLook("pointer-target");
      const closed = rect(".wake-line");

      expect(one("nol-message").contains(one(".wake-line"))).toBe(true);
      AppearanceFixture.expectPixels(closed.height, target);
      expect(closed.top).toBeGreaterThanOrEqual(rect(".nol-message-header").bottom - 0.5);
      expect(rect(".activity-toggle").top).toBeGreaterThanOrEqual(closed.bottom - 0.5);
      AppearanceFixture.expectPixels(closed.left, rect(".nol-markdown-view").left);
      AppearanceFixture.expectPixels(rect(".wake-toggle").left, closed.left);
      expect(rect(".wake-chat").left).toBeGreaterThanOrEqual(rect(".wake-toggle").right);
      expect(rect(".wake-chevron").left).toBeGreaterThanOrEqual(rect(".wake-chat").right);
      for (const part of [".wake-chat", ".wake-chevron"])
        AppearanceFixture.expectPixels(middle(part), middle(".wake-toggle"));
      expect(getComputedStyle(one(".wake-chevron")).fontFamily).toBe(getComputedStyle(one(".activity-chevron")).fontFamily);

      await click(one(".wake-toggle"));
      await Wait.until(() => expect(element().querySelector(".wake-replies")).not.toBeNull());
      AppearanceFixture.expectPixels(rect(".wake-line").height, target);
      expect(rect(".wake-replies").top).toBeGreaterThanOrEqual(rect(".wake-line").bottom - 0.5);
      AppearanceFixture.expectPixels(rect(".wake-replies").left, closed.left);
      expect(rect(".wake-replies").height).toBeGreaterThan(0);
      expect(rect(".activity-toggle").top).toBeGreaterThanOrEqual(rect(".wake-replies").bottom - 0.5);
    });

    it("shows a woken reply's mark as its first muted line, below its header and above its Activity and answer, in the answer's size, from its start edge, with the command in the code font", async () => {
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        detail(0, DetailKind.Note, "Started when the background task `npm test` ended.", { source: "wake", taskId: "t1", command: "npm test" }),
        detail(1, DetailKind.Command, "> npm test\nok", { tool: "Bash" }),
        detail(2, DetailKind.Text, "The tests passed.")
      ]));
      await Wait.until(() => expect(element().querySelectorAll(".nol-markdown-view")).toHaveLength(1));
      const answer = element().querySelector(".nol-markdown-view")!;
      const reply = element().querySelector("nol-message")!;
      const header = element().querySelector(".nol-message-header")!.getBoundingClientRect();
      const toggle = element().querySelector(".activity-toggle")!.getBoundingClientRect();
      const line = element().querySelector(".wake-note")!;
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      probe.style.fontFamily = "var(--nol-font-mono)";
      const look = (view: Element): string[] => [getComputedStyle(view).fontSize, getComputedStyle(view).lineHeight];
      const mark = line.getBoundingClientRect();

      expect(reply.contains(line)).toBe(true);
      expect(mark.height).toBeGreaterThan(0);
      expect(mark.top).toBeGreaterThanOrEqual(header.bottom);
      expect(toggle.top).toBeGreaterThanOrEqual(mark.bottom);
      expect(answer.getBoundingClientRect().top).toBeGreaterThan(mark.bottom);
      AppearanceFixture.expectPixels(mark.left, answer.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(textStart(line) - textStart(answer), AppearanceFixture.measureLook("space-3") + 2 * AppearanceFixture.measureLook("border-width"));
      expect(getComputedStyle(line).color).toBe(getComputedStyle(probe).color);
      expect(look(line)).toEqual(look(answer));
      expect(getComputedStyle(line.querySelector("code")!).fontFamily).toBe(getComputedStyle(probe).fontFamily);
      probe.remove();
    });

    for (const [shape, message, painted, layer, fill] of [
      ["a person's bubble, with the bubble's corners", (): Message => SampleData.userMessage, "nol-message.nol-message-bubble .nol-message-content", null, "var(--nol-raised)"],
      ["a reply's header and content, on a layer behind them reaching past their edges, with the bubble's corners", (): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 1)),
        "nol-message:not(.nol-message-bubble) .nol-message-main", "::before", "transparent"]
    ] as const)
      it(`flashes a found message from its start on ${shape}, from an accent tint, or a Highlight outline in forced colors, to nothing, painting nothing of its own`, async () => {
        render(message());
        const probe = document.createElement("div");
        probe.style.backgroundColor = `color-mix(in srgb, var(--nol-accent) 18%, ${fill})`;
        probe.style.outline = "calc(var(--nol-border-width) * 2) solid Highlight";
        element().append(probe);
        const [tint, highlight] = [getComputedStyle(probe).backgroundColor, getComputedStyle(probe).outlineColor];
        probe.remove();
        const paint = (color: string): number[] => {
          const context = document.createElement("canvas").getContext("2d");
          if (Object.isNull(context))
            return [];
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data);
        };
        const target = element().querySelector<HTMLElement>(painted)!;
        const row = element().querySelector<HTMLElement>("nol-message")!;
        const drawn = (): CSSStyleDeclaration => getComputedStyle(target, layer);
        const resting = paint(drawn().backgroundColor);

        const flashFrom = async (start: Date): Promise<CSSAnimation[]> => {
          fixture.componentRef.setInput("flashStart", start);
          await fixture.whenStable();
          await new Promise(resolve => requestAnimationFrame(resolve));
          const shown = target.getAnimations({ subtree: true }).filter(t => t instanceof CSSAnimation && t.animationName.startsWith("nol-message-flash")) as CSSAnimation[];
          for (const animation of shown)
            animation.pause();
          return shown;
        };
        const went = (animation: CSSAnimation | undefined): number => Number(animation?.currentTime) - Number(animation?.effect?.getTiming().delay ?? 0);
        const earlier = await flashFrom(new Date(Date.now() - 400));
        const gone = went(earlier[0]);
        const animations = await flashFrom(new Date());
        const flash = animations[0] as CSSAnimation;
        flash.effect?.updateTiming({ delay: 0 });
        flash.currentTime = 0;

        expect([earlier.length, animations.length]).toEqual([1, 1]);
        expect(gone).toBeGreaterThanOrEqual(400);
        expect(flash.effect?.getComputedTiming().duration).toBe(Resources.flashMilliseconds);
        expect([element().getAnimations(), paint(getComputedStyle(element()).backgroundColor)[3], getComputedStyle(element()).outlineStyle]).toEqual([[], 0, "none"]);
        if (Object.isNull(layer))
          expect(target.getBoundingClientRect().width).toBeLessThan(row.getBoundingClientRect().width);
        else {
          const margins = [drawn().marginTop, drawn().marginRight, drawn().marginBottom, drawn().marginLeft].map(t => -Number.parseFloat(t));
          const [block, inline] = [AppearanceFixture.measureLook("space-3"), AppearanceFixture.measureLook("space-4")];
          margins.forEach((margin, index) => AppearanceFixture.expectPixels(margin, index % 2 === 0 ? block : inline));
        }
        AppearanceFixture.expectPixels(Number.parseFloat(drawn().borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
        if (forcedColors === "active") {
          const outline = getComputedStyle(target, layer ?? "::after");
          expect([flash.animationName, outline.outlineStyle, outline.outlineColor, outline.opacity, outline.borderTopLeftRadius]).toEqual(["nol-message-flash-outline", "solid", highlight, "1",
            drawn().borderTopLeftRadius]);
          AppearanceFixture.expectPixels(Number.parseFloat(outline.outlineWidth), AppearanceFixture.measureLook("border-width") * 2);
          flash.currentTime = Resources.flashMilliseconds;
          expect(getComputedStyle(target, layer ?? "::after").opacity).toBe("0");
        } else {
          expect(flash.animationName).toBe("nol-message-flash");
          expect(Math.max(...paint(tint).map((channel, index) => Math.abs(channel - (paint(drawn().backgroundColor)[index] ?? 0))))).toBeLessThanOrEqual(1);
          flash.currentTime = Resources.flashMilliseconds;
          expect(paint(drawn().backgroundColor)).toEqual(resting);
        }
      });

    it("puts a working reply's time at its footer's start, after the copy action, and Stop at the row's end, centred on one line, with nothing of the reply below that row, and leaves the finished row as it was", async () => {
      const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, steps.slice(0, 2));
      const rows = (): string[] => [...element().querySelectorAll(".nol-message-footer > *")].map(t => t.className);
      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 2)));
      await Wait.until(() => expect(element().querySelector("strong")).not.toBeNull(), MarkdownWait.coldImport);
      const finished = rows();
      const finishedTime = box(".nol-message-footer .nol-message-time");
      fixture.destroy();
      render(running);
      await Wait.until(() => expect(element().querySelector("strong")).not.toBeNull(), MarkdownWait.coldImport);
      const footer = box(".nol-message-footer");
      const actions = box(".nol-message-footer .nol-message-actions");
      const time = box(".nol-message-footer .nol-message-time");
      const stop = box(".nol-message-footer .cancel");
      const content = box(".nol-message-content");

      AppearanceFixture.expectPixels(actions.left, content.left);
      AppearanceFixture.expectPixels(time.left - actions.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(stop.right, content.right);
      AppearanceFixture.expectPixels(footer.right, content.right);
      expect(stop.left).toBeGreaterThan(time.right);
      AppearanceFixture.expectPixels(middleOf(stop), middleOf(time));
      AppearanceFixture.expectPixels(middleOf(stop), middleOf(footer));
      expect(content.bottom).toBeLessThanOrEqual(footer.top + 0.5);

      await show(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps.slice(0, 2)));
      expect([element().querySelector(".cancel"), footerEnd()]).toEqual([null, ["stats"]]);
      expect(rows()).toEqual(finished);
      AppearanceFixture.expectPixels(box(".nol-message-footer .nol-message-time").left, finishedTime.left);
    });

    it("keeps a finished reply's Stop at its footer's end after its stats button, on one middle line, while a sub-agent runs, cancels the reply, and drops it once that ends", async () => {
      const agent = (status: SubAgentStatus): MessageDetail =>
        detail(1, DetailKind.SubAgent, "Explore", new SubAgent("t1", null, "Explore", null, status, true).toJson());
      const finished = measured(MessageStatus.Completed, everyFigure);
      const running = SampleData.withStatus(finished, MessageStatus.Completed, [...finished.details, agent(SubAgentStatus.Running)]);
      context.answer(MethodName.MessageCancel, () => running.toJson());
      render(running);
      await fixture.whenStable();
      const ends = [...element().querySelectorAll(".nol-message-footer-end > *")]
        .map(t => t.classList.contains("stats-button") ? "stats" : t.classList.contains("cancel") ? "cancel" : t.className);
      const stats = box(statsSelector);
      const stop = box(".nol-message-footer .cancel");
      const content = box(".nol-message-content");

      expect(ends).toEqual(["stats", "cancel"]);
      AppearanceFixture.expectPixels(stop.right, content.right);
      expect(stats.right).toBeLessThanOrEqual(stop.left + 0.5);
      AppearanceFixture.expectPixels(middleOf(stats), middleOf(stop));

      await click(one(".nol-message-footer .cancel"));
      await Wait.until(() => expect(context.parametersOf(MethodName.MessageCancel)).toEqual(new MessageIdParams(running.id).toJson()));
      await show(SampleData.withStatus(finished, MessageStatus.Completed, [...finished.details, agent(SubAgentStatus.Stopped)]));
      expect([element().querySelector(".cancel"), footerEnd()]).toEqual([null, ["stats"]]);
    });

    it("puts Copy, the time and the stats button in one row on one middle line, and opens the panel under the button, start-aligned, inside the window", async () => {
      render(measured(MessageStatus.Completed, everyFigure));
      await fixture.whenStable();
      const copy = box(".nol-message-footer .nol-message-copy");
      const time = box(".nol-message-footer .nol-message-time");
      const button = one(statsSelector).getBoundingClientRect();
      const answer = one(".nol-markdown-view p").getBoundingClientRect();

      expect([copy.width > 0, time.width > 0, button.width > 0]).toEqual([true, true, true]);
      expect([copy.right <= time.left + 0.5, time.right <= button.left + 0.5, copy.top >= answer.bottom - 0.5]).toEqual([true, true, true]);
      AppearanceFixture.expectPixels(button.left - time.right, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(middleOf(time), middleOf(copy));
      AppearanceFixture.expectPixels(middleOf(button), middleOf(copy));
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const opened = async (): Promise<DOMRect> => {
        const view = await openStats();
        await Wait.until(() => AppearanceFixture.expectPixels(view.getBoundingClientRect().top - one(statsSelector).getBoundingClientRect().bottom,
          AppearanceFixture.measureLook("space-2")));
        return view.getBoundingClientRect();
      };
      const inside = (shown: DOMRect): boolean[] => [shown.left >= 0, shown.top >= 0, shown.right <= window.innerWidth, shown.bottom <= window.innerHeight];

      await page.viewport(400, 800);
      try {
        const narrow = await opened();
        expect([...inside(narrow), narrow.width < AppearanceFixture.measureLook("popover-width")]).toEqual([true, true, true, true, true]);
        await click(statsButton());
        await page.viewport(640, 800);
        const shown = await opened();

        AppearanceFixture.expectPixels(shown.left, one(statsSelector).getBoundingClientRect().left);
        expect(inside(shown)).toEqual([true, true, true, true]);
      }
      finally {
        await page.viewport(viewport.width, viewport.height);
      }
    });

    it("lines the panel's labels up at its padding, its figures at its end, and indents a part of a figure by 0.75rem", async () => {
      render(measured(MessageStatus.Completed, everyFigure));
      await fixture.whenStable();
      const view = await openStats();
      const shown = view.getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("border-width") + AppearanceFixture.measureLook("space-3");
      const textStart = (cell: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return range.getBoundingClientRect().left;
      };
      const label = one(".stats-row:nth-child(1) dt", view);
      const part = one(".stats-row:nth-child(2) dt", view);
      const figure = one(".stats-row:nth-child(1) dd", view);

      AppearanceFixture.expectPixels(textStart(label), shown.left + inset);
      AppearanceFixture.expectPixels(textStart(part) - textStart(label), AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(figure.getBoundingClientRect().right, shown.right - inset);
      AppearanceFixture.expectPixels(one(".stats-row:nth-child(2) dd", view).getBoundingClientRect().top - figure.getBoundingClientRect().bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(middleOf(label.getBoundingClientRect()), middleOf(figure.getBoundingClientRect()));
      if (forcedColors === "none")
        expect(getComputedStyle(label).color).not.toBe(getComputedStyle(figure).color);
    });

    it("closes the panel on Escape, giving focus back to the button, and on a press outside it", async () => {
      render(measured(MessageStatus.Completed, null));
      await fixture.whenStable();
      const view = await openStats();
      await Wait.until(() => expect(document.activeElement).toBe(view));

      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(panel()).toBeNull());
      expect([document.activeElement, statsButton()?.getAttribute("aria-expanded")]).toEqual([statsButton(), "false"]);
      await openStats();
      const outside = element().querySelector<HTMLElement>(".nol-message-content p") ?? element();
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await fixture.whenStable();
      await Wait.until(() => expect(panel()).toBeNull());
    });

    it("keeps the footer shown while the panel opened from the keyboard holds the focus, and after Escape, and hides it once the focus leaves", async () => {
      render(measured(MessageStatus.Completed, everyFigure));
      await fixture.whenStable();
      const footer = one(".nol-message-footer");
      const opacity = (): string => getComputedStyle(footer).opacity;
      const settled = async (): Promise<void> => {
        for (let running = footer.getAnimations(); running.length > 0; running = footer.getAnimations())
          await Promise.allSettled(running.map(t => t.finished));
      };
      await userEvent.unhover(one(".nol-message"));
      await Wait.until(() => expect(opacity()).toBe("0"));

      one(statsSelector).focus();
      await userEvent.keyboard("{Enter}");
      const view = await Wait.until(() => one(panelSelector, document));
      await Wait.until(() => expect(document.activeElement).toBe(view));
      expect(document.querySelectorAll(".nol-message:is(:hover, :focus-within)")).toHaveLength(0);
      await settled();
      expect(opacity()).toBe("1");

      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(panel()).toBeNull());
      await settled();
      expect([document.activeElement, opacity()]).toEqual([statsButton(), "1"]);

      one(statsSelector).blur();
      await Wait.until(() => expect(opacity()).toBe("0"));
    });

    it("marks a sent message's attachment and a reply's file links with the file's type mark, an icon-sized box centred on the name's first line just before it", async () => {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      const rect = (target: Element): DOMRect => target.getBoundingClientRect();
      const firstLine = (target: Element): DOMRect => {
        const range = document.createRange();
        range.selectNodeContents(target);
        return range.getClientRects()[0] ?? new DOMRect();
      };
      const lineMiddleOf = (name: Element): number => {
        const block = name.closest("p, .nol-message-attachment-name")!;
        const [top, line] = [rect(block).top, Number.parseFloat(getComputedStyle(block).lineHeight)];
        return top + (Math.floor((middleOf(firstLine(name)) - top) / line) + 0.5) * line;
      };
      const expectMark = (badge: HTMLElement | null, name: Element, gap: string): void => {
        expect(badge?.getAttribute("aria-hidden")).toBe("true");
        AppearanceFixture.expectPixels(rect(badge!).width, AppearanceFixture.measureLook("icon"));
        AppearanceFixture.expectPixels(rect(badge!).height, AppearanceFixture.measureLook("icon"));
        AppearanceFixture.expectPixels(middleOf(rect(badge!)), lineMiddleOf(name));
        AppearanceFixture.expectPixels(firstLine(name).left - rect(badge!).right, AppearanceFixture.measureLook(gap));
      };

      render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "Here are the notes.")], null,
        SampleData.timestamp, null, SampleData.timestamp, [new MessageAttachment("notes.txt", "text/plain", 2048, "D:/data/attachments/notes.txt")]));
      await Wait.until(() => expect(element().querySelector(".nol-message-attachment-name")).not.toBeNull(), MarkdownWait.coldImport);
      const name = element().querySelector(".nol-message-attachment-name")!;
      const attachment = name.closest("button")!;
      expectMark(attachment.querySelector("nol-file-badge"), name, "space-2");
      AppearanceFixture.expectPixels(rect(attachment.querySelector("nol-file-badge")!).left - rect(attachment).left,
        Number.parseFloat(getComputedStyle(attachment).paddingInlineStart) + Number.parseFloat(getComputedStyle(attachment).borderInlineStartWidth));
      expect(attachment.getAttribute("aria-label") ?? ShownText.of(attachment)).toContain("notes.txt");

      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
        [detail(0, DetailKind.Text, "[src/b.ts](src/b.ts) starts this line, and [the code](src/a.ts:42) sits in it.")]));
      const links = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("a.nol-markdown-file-link")];
      await Wait.until(() => expect(links()).toHaveLength(2), MarkdownWait.coldImport);
      const paragraph = links()[0]!.closest("p")!;
      for (const link of links()) {
        const badge = link.querySelector<HTMLElement>("nol-file-badge");
        expectMark(badge, link.querySelector(".nol-markdown-file-text")!, "space-1");
        AppearanceFixture.expectPixels(rect(badge!).left, rect(link).left);
      }
      expect(links().map(t => ShownText.of(t))).toEqual(["src/b.ts", "the code"]);
      AppearanceFixture.expectPixels(rect(links()[0]!).left, rect(paragraph).left);

      render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, "Here's my plan."),
        detail(1, DetailKind.Plan, "Move the cache", new ReplyPlan([], null, "Move [the cache](src/cache.ts) first.").toJson())]));
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header")).not.toBeNull(), MarkdownWait.coldImport);
      await click(element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header"));
      const planLink = (): HTMLElement | null => element().querySelector<HTMLElement>("nol-teamrun-plan-card a.nol-markdown-file-link");
      await Wait.until(() => expect(planLink()).not.toBeNull(), MarkdownWait.coldImport);
      expectMark(planLink()!.querySelector("nol-file-badge"), planLink()!.querySelector(".nol-markdown-file-text")!, "space-1");
      expect(ShownText.of(planLink()!)).toBe("the cache");
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const parts: readonly { name: string; open: () => Promise<void>; iconOnly?: readonly string[] }[] = [
      { name: "finished reply with its steps open and the files it edited", open: async () => {
        render(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, steps));
        await Wait.until(() => expect(element().querySelector(".nol-markdown-view")?.textContent?.trim()).toBe("Done."), MarkdownWait.coldImport);
        await click(element().querySelector(".activity-toggle"));
        await Wait.until(() => expect([element().querySelector("nol-teamrun-activity-block"), element().querySelector("nol-teamrun-edited-files")]).not.toContain(null));
      } },
      { name: "running reply with its plan open", open: async () => {
        render(planReply(planned(PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending)));
        await Wait.until(() => expect(element().textContent).toContain("Done."), MarkdownWait.coldImport);
        await click(element().querySelector<HTMLButtonElement>("nol-teamrun-plan-card .header"));
        await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header")?.getAttribute("aria-expanded")).toBe("true"));
      } },
      { name: "waiting reply's request and question", open: async () => {
        await openConversation();
        render(awaiting());
        context.emit(EventName.ApprovalCreated, question().toJson());
        await Wait.until(() => expect([cards().length, element().querySelectorAll("nol-teamrun-question-card").length]).toEqual([1, 1]));
        await settle();
      } },
      { name: "plan waiting for approval", open: async () => {
        await planningChat();
        render(awaitingPlan());
        await Wait.until(() => expect(approveButton()).not.toBeNull());
        await settle();
      } },
      { name: "person's message with an attachment and a link", open: async () => {
        render(new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, "See [the docs](https://example.com/docs).")], null,
          SampleData.timestamp, null, SampleData.timestamp, [new MessageAttachment("notes.txt", "text/plain", 2048, "D:/data/attachments/notes.txt")]));
        await Wait.until(() => expect(element().querySelector(".nol-message-bubble a")).not.toBeNull(), MarkdownWait.coldImport);
      }, iconOnly: [".nol-file-badge:has(> .material-symbols-rounded)"] }
    ];

    it.each(parts)("keeps every control, state and focus ring in a $name visible under forced colours", async ({ open }) => {
      await open();
      expect(await AccessibilityFixture.expectVisibleForcedAsync(element())).toBeGreaterThan(0);
    });

    it.each(parts)("neither cuts, crosses nor loses a control in a $name at 200% zoom", async ({ open, iconOnly }) => {
      await open();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle, iconOnly);
    });

    it("keeps a finished reply's stats panel whole at 200% zoom and visible under forced colours", async () => {
      render(measured(MessageStatus.Completed, everyFigure));
      const view = await AccessibilityFixture.zoomedAsync(async () => {
        const opened = await openStats();
        await AccessibilityFixture.expectFitsZoomedAsync(opened, settle);
        return opened;
      });

      expect([statRows(view).length > 0, panel()]).toEqual([true, view]);
      await AccessibilityFixture.expectVisibleForcedAsync(view);
    });
  });
  describe("with GitHub references", () => {
    const readMethod = "git-github.readReference";
    const signedIn = HostSignIn.signedIn(new HostAccount("monalisa", null, null, ["repo"])).toJson();
    const longTitle = "Show in specs that no provider's model list takes longer than the window's first paint to arrive, on every platform and in every theme";
    const pullUrl = "https://github.com/octocat/hello-world/pull/42";
    const avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGNoCrgPRwzEcQC6IhsRLJyGqgAAAABJRU5ErkJggg==";
    const issueUrl = "https://github.com/octocat/hello-world/issues/7";
    const replyText = `It closes ${pullUrl} and [the README issue](${issueUrl}), as https://example.com/a says.`;
    const pull = (title: string = "Fix the greeting"): JsonValue => new HostItem(new HostReference("git-github", "octocat", "hello-world", 42), ReferenceKind.PullRequest,
      ReferenceState.Merged, title, pullUrl, new HostPerson("monalisa", avatar, null), Date.parse(SampleData.timestamp) - 2 * 3_600_000,
      Date.parse(SampleData.timestamp) - 300_000, 4,
      new HostChanges(106, 1, 7, "monalisa/fix-greeting", "main", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d")).toJson();
    const issue = new HostItem(new HostReference("git-github", "octocat", "hello-world", 7), ReferenceKind.Issue, ReferenceState.Open, "Add a README", issueUrl,
      new HostPerson("octocat", null, null), Date.parse(SampleData.timestamp) - 3_600_000, null, 3, null).toJson();
    const reply = (text: string = replyText): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [detail(0, DetailKind.Text, text)]);
    const own = (text: string = replyText): Message => new Message("m5", "c1", 4, MessageAuthor.User, null, MessageStatus.Completed, [detail(0, DetailKind.Text, text)], null,
      SampleData.timestamp, null, SampleData.timestamp);
    const chips = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("a.nol-link-reference-chip")];
    const plainLinks = (): string[] => [...element().querySelectorAll("a.nol-markdown-link:not(.nol-link-reference-chip)")].map(t => t.textContent?.trim() ?? "");
    const card = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-link-reference-card");
    const cardText = (selector: string): string[] => [...(card()?.querySelectorAll(selector) ?? [])].map(t => t.textContent?.trim() ?? "");
    const colorOf = (value: string): string => {
      const probe = document.createElement("span");
      probe.style.color = value;
      element().append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const answering = (answer: (number: number) => JsonValue | Promise<JsonValue>): void => {
      context.answerModule(readMethod, t => answer(HostReference.fromJson(t).number));
    };

    beforeEach(() => {
      answering(t => t === 42 ? pull() : issue);
      context.answerModule("git-github.readSignIn", () => signedIn);
      GitHubReferenceSource.register(context);
      context.emitModule("git-github.signInChanged", signedIn);
    });

    afterEach(() => {
      GitHubReferenceSource.release(context);
    });

    it("draws a reply's GitHub pull request and issue links as chips with their reference and title, and leaves other links plain", async () => {
      render(reply());

      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting", "octocat/hello-world#7 · Add a README"]),
        MarkdownWait.coldImport);
      expect(plainLinks()).toEqual(["https://example.com/a"]);
      expect(chips().map(t => t.getAttribute("href"))).toEqual([pullUrl, issueUrl]);
      expect(context.requests.filter(t => t.method === readMethod).map(t => HostReference.fromJson(t.parameters).number)).toEqual([42, 7]);
    });

    it("draws owner/repo#N written in a reply's text as a chip, and leaves a bare #N and one in code as written", async () => {
      render(reply("Merged octocat/hello-world#42; see #7 and `octocat/hello-world#7`."));

      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting"]), MarkdownWait.coldImport);
      expect(element().querySelector(".nol-markdown-view code")?.textContent).toBe("octocat/hello-world#7");
      expect(element().querySelector(".nol-markdown-view")?.textContent).toContain("see #7 and");
      expect(context.requests.filter(t => t.method === readMethod).map(t => HostReference.fromJson(t.parameters).number)).toEqual([42]);
    });

    it("draws a bare #N as an item of the GitHub repository the chat's folder pushes to, once Git has read the folder", async () => {
      context.answerModule("git.status", () =>
        new GitStatus("main", null, null, [], false, "f1", null, new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)).toJson());
      await planningChat(false, [reply("Fixed #7.")]);
      render(reply("Fixed #7."));

      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#7 · Add a README"]), MarkdownWait.coldImport);
      expect(chips().map(t => t.getAttribute("href"))).toEqual([issueUrl]);
      expect(context.requests.filter(t => t.method === "git.status").map(t => t.parameters)).toEqual([{ folder: SampleData.project.rootPath }]);
    });

    it("opens the item on GitHub when its chip is clicked", async () => {
      render(reply());
      await Wait.until(() => expect(chips()).toHaveLength(2), MarkdownWait.coldImport);

      chips()[1]?.click();

      await Wait.until(() => expect(context.links).toEqual([issueUrl]));
    });

    it("opens each part of a pull request's and an issue's card on its own GitHub page through the app's link path", async () => {
      render(reply());
      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting", "octocat/hello-world#7 · Add a README"]),
        MarkdownWait.coldImport);
      const point = (chip: number, type: string): void => {
        (chips()[chip] ?? one("a.nol-link-reference-chip")).dispatchEvent(new PointerEvent(type));
      };
      const parts = async (chip: number): Promise<HTMLAnchorElement[]> => {
        point(chip, "pointerenter");
        await Wait.until(() => expect(card()?.querySelector(".nol-link-reference-card-title a") ?? null).not.toBeNull(), MarkdownWait.coldImport);
        return [...(card()?.querySelectorAll<HTMLAnchorElement>("a.nol-link-reference-card-link") ?? [])];
      };
      const pages = async (chip: number): Promise<(string | null)[]> => {
        const hrefs = (await parts(chip)).map(t => t.getAttribute("href"));
        point(chip, "pointerdown");
        await Wait.until(() => expect(card()).toBeNull());
        return hrefs;
      };
      const pullPages = [pullUrl, "https://github.com/octocat/hello-world", pullUrl, pullUrl, "https://github.com/monalisa", `${pullUrl}/files`, `${pullUrl}/files`];
      const issuePages = [issueUrl, "https://github.com/octocat/hello-world", issueUrl, issueUrl, "https://github.com/octocat", issueUrl];

      expect([await pages(0), await pages(1)]).toEqual([pullPages, issuePages]);
      for (const [chip, count] of [[0, pullPages.length], [1, issuePages.length]] as const)
        for (let index = 0; index < count; index++) {
          (await parts(chip))[index]?.click();
          await Wait.until(() => expect(card()).toBeNull());
        }

      expect(context.links).toEqual([...pullPages, ...issuePages]);
    });

    it("shows a pull request's card on hover, with its state, place, age, whole title, author, lines and files", async () => {
      answering(t => t === 42 ? pull(longTitle) : issue);
      render(reply());
      await Wait.until(() => expect(chips()[0]?.textContent).toContain("octocat/hello-world#42 · Show in specs"), MarkdownWait.coldImport);

      await userEvent.hover(one("a.nol-link-reference-chip"));

      await Wait.until(() => expect(card()).not.toBeNull(), MarkdownWait.coldImport);
      expect([cardText(".nol-link-reference-card-state"), cardText(".nol-link-reference-card-location"), cardText(".nol-link-reference-card-title"),
        cardText(".nol-link-reference-card-author")]).toEqual([["Merged"], ["octocat/hello-world #42"], [longTitle], ["monalisa"]]);
      expect(cardText(".nol-link-reference-card-age")).toHaveLength(1);
      expect([cardText(".nol-link-reference-card-added"), cardText(".nol-link-reference-card-removed")]).toEqual([["+106"], ["−1"]]);
      expect(cardText(".nol-link-reference-card-pill").slice(1)).toEqual(["7 files"]);
      await userEvent.unhover(one("a.nol-link-reference-chip"));
    });

    it("shows an issue's card when its chip is focused from the keyboard, with its comment count and no lines", async () => {
      render(reply());
      await Wait.until(() => expect(chips()[1]?.textContent).toContain("Add a README"), MarkdownWait.coldImport);

      TestBed.inject(FocusMonitor).focusVia(one("a.nol-link-reference-chip:nth-of-type(2)"), "keyboard");

      await Wait.until(() => expect(cardText(".nol-link-reference-card-title")).toEqual(["Add a README"]));
      const pills = cardText(".nol-link-reference-card-pill");
      expect([cardText(".nol-link-reference-card-state"), pills.length, pills[0]?.endsWith("3"), cardText(".nol-link-reference-card-added")])
        .toEqual([["Open"], 1, true, []]);
    });

    it("draws a signed-out person's reply with every GitHub link plain from the start, reads nothing, and draws chips once they sign in", async () => {
      context.emitModule("git-github.signInChanged", HostSignIn.signedOut().toJson());
      render(reply());

      await Wait.until(() => expect(plainLinks()).toEqual([pullUrl, "the README issue", "https://example.com/a"]), MarkdownWait.coldImport);
      expect([chips(), context.requests.filter(t => t.method === readMethod)]).toEqual([[], []]);
      context.emitModule("git-github.signInChanged", signedIn);
      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting", "octocat/hello-world#7 · Add a README"]));
    });

    it("draws the person's own GitHub links as the same chips as a reply's, and copies the message with its links as typed", async () => {
      render(own());

      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting", "octocat/hello-world#7 · Add a README"]),
        MarkdownWait.coldImport);
      expect([plainLinks(), chips().map(t => t.getAttribute("href")), chips().every(t => !Object.isNull(t.closest(".nol-message-bubble")))])
        .toEqual([["https://example.com/a"], [pullUrl, issueUrl], true]);
      expect(context.requests.filter(t => t.method === readMethod).map(t => HostReference.fromJson(t.parameters).number)).toEqual([42, 7]);
      await click(one(".nol-message-copy"));
      await Wait.until(() => expect((TestBed.inject(ClipboardWriter) as ClipboardWriterFixture).texts).toEqual([replyText]));
    });

    it("hands the person's own message to the composer with its GitHub links as typed when they rewind to it", async () => {
      context.answer(MethodName.ConversationRewind, () => new ConversationRewindResult(SampleData.conversation, ["m5"], 0, true).toJson());
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await store().selectConversation("c1");
      render(own());
      await Wait.until(() => expect(chips()).toHaveLength(2), MarkdownWait.coldImport);

      await click(one(".nol-teamrun-rewind"));
      await Wait.until(() => expect(document.activeElement).toBe(document.querySelector(".nol-teamrun-confirm")));
      document.querySelector<HTMLButtonElement>(".nol-teamrun-confirm")?.click();

      await Wait.until(() => expect(store().rewoundDraft()?.text).toBe(replyText));
    });

    it("draws the person's own GitHub links plain while they're signed out, reading nothing, and as chips once they sign in", async () => {
      context.emitModule("git-github.signInChanged", HostSignIn.signedOut().toJson());
      render(own());

      await Wait.until(() => expect(plainLinks()).toEqual([pullUrl, "the README issue", "https://example.com/a"]), MarkdownWait.coldImport);
      expect([chips(), context.requests.filter(t => t.method === readMethod)]).toEqual([[], []]);
      context.emitModule("git-github.signInChanged", signedIn);
      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting", "octocat/hello-world#7 · Add a README"]));
    });

    it("keeps the person's own GitHub links plain, with no card, when the read finds nothing or fails", async () => {
      answering(t => t === 42 ? null : Promise.reject(new Error("GitHub answered 502.")));
      render(own());
      await Wait.until(() => expect(context.requests.filter(t => t.method === readMethod)).toHaveLength(2), MarkdownWait.coldImport);

      await Wait.until(() => expect(plainLinks()).toEqual([pullUrl, "the README issue", "https://example.com/a"]));
      TestBed.inject(FocusMonitor).focusVia(one("a.nol-markdown-link"), "keyboard");

      expect([chips(), card(), context.dialogs]).toEqual([[], null, []]);
    });

    it("keeps each reference exactly as the reply wrote it, with no card, when no one is signed in to GitHub or the read fails", async () => {
      answering(t => t === 42 ? null : Promise.reject(new Error("GitHub answered 502.")));
      render(reply());
      await Wait.until(() => expect(context.requests.filter(t => t.method === readMethod)).toHaveLength(2), MarkdownWait.coldImport);

      await Wait.until(() => expect(plainLinks()).toEqual([pullUrl, "the README issue", "https://example.com/a"]));
      TestBed.inject(FocusMonitor).focusVia(one("a.nol-markdown-link"), "keyboard");

      expect([chips(), card(), context.dialogs, context.methods.filter(t => t.startsWith("git-github.") && t !== readMethod)]).toEqual([[], null, [], ["git-github.readSignIn"]]);
    });

    it("shows a chip being read by its reference with a muted icon and no card, and fills in its title when the read ends", async () => {
      const held = new DeferredResponse();
      answering(t => t === 42 ? held.promise : issue);
      render(reply(`It closes ${pullUrl}.`));
      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42"]), MarkdownWait.coldImport);
      TestBed.inject(FocusMonitor).focusVia(one("a.nol-link-reference-chip"), "keyboard");

      expect([getComputedStyle(one(".nol-link-reference-chip-icon")).color, card()]).toEqual([colorOf("var(--nol-text-muted)"), null]);
      held.resolve(pull());

      await Wait.until(() => expect(chips().map(t => t.textContent?.trim())).toEqual(["octocat/hello-world#42 · Fix the greeting"]));
    });

    describe.each([
      { look: "light", mode: ThemeMode.Light, forcedColors: "none", merged: "rgb(130, 80, 223)" },
      { look: "dark", mode: ThemeMode.Dark, forcedColors: "none", merged: "rgb(163, 113, 247)" },
      { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active", merged: "LinkText" }
    ])("in $look", ({ mode, forcedColors, merged }) => {
      beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

      beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

      afterAll(() => EmulatedMediaFixture.resetAsync());

      const shownReply = async (): Promise<readonly HTMLAnchorElement[]> => {
        answering(t => t === 42 ? pull(longTitle) : issue);
        render(reply(`It closes ${issueUrl} and ${pullUrl} today.`));
        await Wait.until(() => expect(chips().map(t => t.textContent?.includes("·"))).toEqual([true, true]), MarkdownWait.coldImport);
        expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
        return chips();
      };
      const remsOf = (token: string): number => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
      const paragraphOf = (chip: HTMLElement): HTMLElement => {
        const paragraph = chip.closest<HTMLElement>("p");
        if (Object.isNull(paragraph))
          throw new Error("The chip is in no paragraph.");
        return paragraph;
      };

      it("lays a chip out as the kit's tokens say: GitHub's mark, then the state's icon, then the text, a first space apart and centred on the text's line", async () => {
        const [issueChip] = await shownReply();
        if (Object.isUndefined(issueChip))
          throw new Error("The reply has no chip.");
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const [chip, mark, icon, text] = [issueChip, one(".nol-link-reference-chip-mark", issueChip), one(".nol-link-reference-chip-icon", issueChip),
          one(".nol-link-reference-chip-text", issueChip)].map(t => t.getBoundingClientRect());
        if (Object.isUndefined(chip) || Object.isUndefined(mark) || Object.isUndefined(icon) || Object.isUndefined(text))
          throw new Error("The chip lacks a part.");
        const before = document.createRange();
        before.setStart(paragraphOf(issueChip), 0);
        before.setEndBefore(issueChip);
        const line = before.getBoundingClientRect();
        const [markSize, iconSize, space] = ["--nol-reference-mark", "--nol-icon", "--nol-space-1"].map(t => remsOf(t));

        for (const [size, expected] of [[mark.width, markSize], [mark.height, markSize], [icon.width, iconSize], [icon.height, iconSize]] as const)
          expect(size / rem).toBeCloseTo(expected ?? Number.NaN, 2);
        expect((icon.left - mark.right) / rem).toBeCloseTo(space ?? Number.NaN, 2);
        expect((text.left - icon.right) / rem).toBeCloseTo(space ?? Number.NaN, 2);
        expect(mark.left).toBeCloseTo(chip.left, 1);
        expect([mark, icon, text].map(t => Math.abs(middleOf(t) - middleOf(line)) <= 1)).toEqual([true, true, true]);
      });

      it("cuts a long title with an ellipsis at the kit's chip width within the reply's, and draws the state's icon in its colour and the mark in the text's", async () => {
        const [, pullChip] = await shownReply();
        if (Object.isUndefined(pullChip))
          throw new Error("The reply has no second chip.");
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const textView = one(".nol-link-reference-chip-text", pullChip);
        const chip = pullChip.getBoundingClientRect();

        expect(chip.width / rem).toBeCloseTo(remsOf("--nol-reference-chip-max-width"), 2);
        expect(chip.right).toBeLessThanOrEqual(paragraphOf(pullChip).getBoundingClientRect().right + 1);
        expect([getComputedStyle(textView).textOverflow, textView.scrollWidth > textView.clientWidth]).toEqual(["ellipsis", true]);
        expect(getComputedStyle(one(".nol-link-reference-chip-icon", pullChip)).color).toBe(colorOf(merged));
        expect(getComputedStyle(one(".nol-link-reference-chip-mark", pullChip)).color).toBe(colorOf(forcedColors === "active" ? "LinkText" : "var(--nol-text-strong)"));
      });

      it("keeps the person's own chips inside their bubble's padding, at the kit's chip width, centred on the text's line", async () => {
        answering(t => t === 42 ? pull(longTitle) : issue);
        render(own(`It closes ${issueUrl} and ${pullUrl} today.`));
        await Wait.until(() => expect(chips().map(t => t.textContent?.includes("·"))).toEqual([true, true]), MarkdownWait.coldImport);
        expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const bubble = one(".nol-message-bubble");
        const style = getComputedStyle(bubble);
        const outer = bubble.getBoundingClientRect();
        const inner = { left: outer.left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth),
          right: outer.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth) };
        const [issueChip, pullChip] = chips();
        if (Object.isUndefined(issueChip) || Object.isUndefined(pullChip))
          throw new Error("The person's message has fewer than two chips.");
        const before = document.createRange();
        before.setStart(paragraphOf(issueChip), 0);
        before.setEndBefore(issueChip);
        const line = before.getBoundingClientRect();
        const parts = [".nol-link-reference-chip-mark", ".nol-link-reference-chip-icon", ".nol-link-reference-chip-text"].map(t => one(t, issueChip).getBoundingClientRect());

        for (const chip of [issueChip, pullChip].map(t => t.getBoundingClientRect()))
          expect([chip.left >= inner.left - 0.5, chip.right <= inner.right + 0.5]).toEqual([true, true]);
        expect(pullChip.getBoundingClientRect().width / rem).toBeCloseTo(remsOf("--nol-reference-chip-max-width"), 2);
        expect(parts.map(t => Math.abs(middleOf(t) - middleOf(line)) <= 1)).toEqual([true, true, true]);
        expect(getComputedStyle(one(".nol-link-reference-chip-icon", pullChip)).color).toBe(colorOf(merged));
        expect(getComputedStyle(one(".nol-link-reference-chip-mark", pullChip)).color).toBe(colorOf(forcedColors === "active" ? "LinkText" : "var(--nol-text-strong)"));
        const paint = getComputedStyle(one(".nol-message-content", bubble)).backgroundColor;
        for (const chip of [issueChip, pullChip]) {
          const text = getComputedStyle(one(".nol-link-reference-chip-text", chip)).color;
          if (forcedColors === "active")
            expect(AppearanceFixture.contrast(text, paint), `the chip's text ${text} on the bubble ${paint}`).toBeGreaterThanOrEqual(4.5);
          else
            expect([text, paint]).toEqual([colorOf("var(--nol-link)"), colorOf("var(--nol-raised)")]);
        }
      });

      it("draws the card author's picture at the kit's byline avatar size inside the avatar's border, and an author with none by their initial", async () => {
        const [issueChip, pullChip] = await shownReply();
        if (Object.isUndefined(issueChip) || Object.isUndefined(pullChip))
          throw new Error("The reply has fewer than two chips.");
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const avatarOf = (): HTMLElement => {
          const shown = card();
          if (Object.isNull(shown))
            throw new Error("No card is shown.");
          return one(".nol-link-reference-card-foot nol-avatar", shown);
        };
        await userEvent.hover(pullChip);
        await Wait.until(() => expect(cardText(".nol-link-reference-card-author")).toEqual(["monalisa"]), MarkdownWait.coldImport);
        const pictured = avatarOf();
        const image = one("img.nol-avatar-image", pictured);
        if (!(image instanceof HTMLImageElement))
          throw new Error("The author's avatar has no image.");
        await image.decode();
        const border = Number.parseFloat(getComputedStyle(pictured).borderLeftWidth);
        const [box, picture] = [pictured.getBoundingClientRect(), image.getBoundingClientRect()];
        await userEvent.unhover(pullChip);
        TestBed.inject(FocusMonitor).focusVia(issueChip, "keyboard");
        await Wait.until(() => expect(cardText(".nol-link-reference-card-author")).toEqual(["octocat"]));
        const initial = avatarOf();
        const plain = initial.getBoundingClientRect();

        expect([image.src, image.complete, image.naturalWidth, border > 0]).toEqual([avatar, true, 4, forcedColors === "active"]);
        const byline = remsOf("--nol-avatar-byline");
        for (const [size, expected] of [[box.width / rem, byline], [box.height / rem, byline], [picture.left - box.left, border], [picture.top - box.top, border],
          [picture.width, box.width - 2 * border], [picture.height, box.height - 2 * border], [plain.width / rem, byline], [plain.height / rem, byline]] as const)
          expect(size).toBeCloseTo(expected, 1);
        expect([initial.querySelector("img"), initial.textContent?.trim()]).toEqual([null, "O"]);
      });
    });
  });
});
