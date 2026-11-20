/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, untracked } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Approval,
  ApprovalKind,
  ApprovalQuestion,
  ApprovalStatus,
  AttachmentContent,
  ChatFolderAttachParams,
  Conversation,
  ConversationSearchHit,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessagePage,
  MessagePageParams,
  MessageSender,
  MessageStatus,
  MethodName,
  PlanStep,
  PlanStepStatus,
  QuestionOption,
  ReadingPositionSaveParams,
  ReplyPlan,
  SubAgent,
  SubAgentStatus,
  WrittenImageReadParams
} from "@noldova/teamrun.protocol";
import { ThemeMode, VirtualListAlign, VirtualListComponent, VirtualListPosition } from "@noldova/ui.components.angular";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";
import { HistoryComponent } from "../../../../src/app/components/history/history.component";
import { HistoryMessageComponent } from "../../../../src/app/components/history-message/history-message.component";
import { ChatAction } from "../../../../src/app/enums/chat-action";
import { MessageFocus } from "../../../../src/app/models/message-focus";
import { ReadingPosition } from "../../../../src/app/models/reading-position";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { PaintPacerService } from "../../../../src/app/services/paint-pacer.service";
import { Resources } from "../../../../src/resources";

describe("HistoryComponent", () => {
  const all = Array.from({ length: 5_000 }, (_, index) => new Message(`m${index}`, "c1", index, MessageAuthor.User, null, MessageStatus.Completed,
    [SampleData.detail(0, DetailKind.Text, `Message ${index}`)], null, SampleData.timestamp, null, SampleData.timestamp));
  const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const empty = new Conversation("c3", "p1", "Empty", SampleData.timestamp, SampleData.timestamp);
  const others = [
    ...[0, 1].map(t => new Message(`n${t}`, "c2", t, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Other ${t}`)], null,
      SampleData.timestamp, null, SampleData.timestamp)),
    new Message("n2", "c2", 2, MessageAuthor.Provider, "n1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null)
  ];
  const chain = new Conversation("c4", "p1", "Chain", SampleData.timestamp, SampleData.timestamp);
  const stopped = "The chain stopped after 4 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.";
  const replies = ["@Bob yours", "@Carol yours", "Done."].map((text, index) => new Message(`h${index}`, "c4", index, MessageAuthor.Provider, null,
    MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, text), ...index === 0 ? [new MessageDetail(1, DetailKind.Note, stopped, { source: "handOff" }, SampleData.timestamp)] : []],
    SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp));
  const left = ["code", "long-code", "math", "image", "up", "inside", "plan", "cut-end", "cut-above", "agent", "step-end", "step-above", "step-inside", "step-goes", "step-tall"].map(t => new Conversation(`left-${t}`, "p1", `Left ${t}`, SampleData.timestamp, SampleData.timestamp));
  const leftMessages = left.flatMap(chat => Array.from({ length: 11 }, (_, index) => index % 2 === 0
    ? new Message(`${chat.id}-${index}`, chat.id, index, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Message ${index}`)], null,
      SampleData.timestamp, null, SampleData.timestamp)
    : new Message(`${chat.id}-${index}`, chat.id, index, MessageAuthor.Provider, `${chat.id}-${index - 1}`, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, `Message ${index}`)], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp)));
  const far = new Conversation("far", "p1", "Far", SampleData.timestamp, SampleData.timestamp);
  const paragraphs = (from: number): string => Array.from({ length: 60 }, (_, index) => `Paragraph ${from + index}`).join("\n\n");
  const farPlan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.Pending, null)], null);
  const farMessages = Array.from({ length: 400 }, (_, index) => index === 5
    ? new Message("far-5", far.id, 5, MessageAuthor.Provider, "far-4", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Message 5\n\n${paragraphs(0)}`),
      new MessageDetail(1, DetailKind.Plan, "Plan", farPlan.toJson(), SampleData.timestamp), SampleData.detail(2, DetailKind.Text, paragraphs(60))],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp)
    : new Message(`far-${index}`, far.id, index, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Message ${index}`)], null,
      SampleData.timestamp, null, SampleData.timestamp));
  const farAgent = new Conversation("far-agent", "p1", "Far agent", SampleData.timestamp, SampleData.timestamp);
  const farSubAgent = new SubAgent("tf", "Explore", "Find where plans are stored", "Haiku 5.5", SubAgentStatus.Completed, false, 14, 38200, 72000, "They're in the store.");
  const farAgentMessages = Array.from({ length: 400 }, (_, index) => index === 5
    ? new Message("far-agent-5", farAgent.id, 5, MessageAuthor.Provider, "far-agent-4", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Message 5\n\n${paragraphs(0)}`),
      ...Array.from({ length: 60 }, (_, step) => new MessageDetail(step + 1, DetailKind.Command, "> ls\nout", { tool: "Bash", toolUseId: `f${step + 1}` }, SampleData.timestamp)),
      new MessageDetail(61, DetailKind.SubAgent, farSubAgent.description, farSubAgent.toJson(), SampleData.timestamp), SampleData.detail(62, DetailKind.Text, paragraphs(60))],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp)
    : new Message(`far-agent-${index}`, farAgent.id, index, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, `Message ${index}`)], null,
      SampleData.timestamp, null, SampleData.timestamp));
  const arrived: Message[] = [];
  const codeLines = Array.from({ length: 60 }, (_, index) => `const value${index} = ${index};`);
  let context: FakeWindowPartContext;
  let clock: FakeClock;
  let fixture: ComponentFixture<HistoryComponent>;

  const pageOf = (parameters: JsonValue): JsonValue => {
    const params = MessagePageParams.fromJson(parameters);
    const before = params.beforeSequence;
    const after = params.afterSequence;
    const listed = [...all, ...others, ...replies, ...leftMessages, ...farMessages, ...farAgentMessages, ...arrived].filter(t => t.conversationId === params.conversationId);
    const slice = !Object.isNull(before) ? listed.filter(t => t.sequence < before).slice(-params.limit)
      : !Object.isNull(after) ? listed.filter(t => t.sequence > after).slice(0, params.limit) : listed.slice(-params.limit);
    const first = slice[0];
    const last = slice.at(-1);
    return new MessagePage(slice, !Object.isUndefined(first) && first.sequence > 0, !Object.isUndefined(last) && last.sequence < listed.length - 1, listed.length)
      .toJson();
  };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const store = (): ChatStoreService => TestBed.inject(ChatStoreService);
  const viewport = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-virtual-list-viewport");
  const rowOf = (index: number): HTMLElement | undefined =>
    [...element().querySelectorAll<HTMLElement>(".nol-virtual-list-slot")].find(t => new RegExp(`^Message ${index}(?!\\d)`).test(t.querySelector(".nol-markdown-view")?.textContent?.trim() ?? ""));
  const flashing = (): Element[] => [...element().querySelectorAll("nol-message.nol-message-flashing")];
  const flashStartOf = (index: number): number | null => {
    const host = rowOf(index)?.querySelector("nol-teamrun-history-message");
    const message = fixture.debugElement.queryAll(By.directive(HistoryMessageComponent)).find(t => t.nativeElement === host)?.componentInstance as HistoryMessageComponent | undefined;
    return message?.flashStart()?.getTime() ?? null;
  };
  const offsetOf = (index: number): number | null => {
    const row = rowOf(index);
    const view = viewport();
    return Object.isUndefined(row) || Object.isNull(view) ? null : row.getBoundingClientRect().top - view.getBoundingClientRect().top;
  };
  const shape = (): string => `${element().querySelectorAll("[data-nol-row]").length} ${viewport()?.scrollHeight} ${viewport()?.scrollTop}`;
  const renderedFrame = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  }));
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    let last = shape();
    for (let pass = 0; pass < 10; pass++) {
      await renderedFrame();
      await fixture.whenStable();
      const now = shape();
      if (now === last)
        return;
      last = now;
    }
    throw new Error(`The feed still changed after 10 frames: ${last}.`);
  };
  const until = (check: () => void, options: { readonly timeout?: number } = {}): Promise<void> => Wait.until(check, options);
  const decodedImage = async (container: () => Element | null): Promise<HTMLImageElement> => {
    const shown = (): HTMLImageElement | null => container()?.querySelector<HTMLImageElement>(".nol-teamrun-image-frame img") ?? null;
    const image = shown() ?? await new Promise<HTMLImageElement>(resolve => new MutationObserver((_, observer) => {
      const added = shown();
      if (Object.isNull(added))
        return;
      observer.disconnect();
      resolve(added);
    }).observe(element(), { childList: true, subtree: true }));
    await image.decode();
    return image;
  };
  const partRevealed = (): Promise<void> => {
    const history = fixture.componentInstance;
    const reveal = history.revealPart.bind(history);
    return new Promise<void>(resolve => vi.spyOn(history, "revealPart").mockImplementation((index: number, part: Element) => {
      reveal(index, part);
      resolve();
    }));
  };
  const revealLimit = 30_000;
  const reads = (): (number | null)[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage))
    .map(t => MessagePageParams.fromJson(t.parameters).beforeSequence);
  const earliestShown = (): number =>
    Math.min(...[...element().querySelectorAll(".nol-virtual-list-slot")]
      .map(t => /^Message (\d+)/.exec(t.querySelector(".nol-markdown-view")?.textContent?.trim() ?? "")?.[1])
      .filter(t => !Object.isUndefined(t))
      .map(Number));
  const expectAtTop = (index: number): void => expect(Math.abs(offsetOf(index) ?? Number.NaN)).toBeLessThan(1);
  const observers: MutationObserver[] = [];
  const list = (): VirtualListComponent<Message> => fixture.debugElement.query(By.directive(VirtualListComponent)).componentInstance as VirtualListComponent<Message>;
  const rowRevealed = (): Promise<void> => {
    const shown = list();
    const reveal = shown.reveal.bind(shown);
    return new Promise<void>(resolve => vi.spyOn(shown, "reveal").mockImplementation((...args: Parameters<typeof reveal>) => {
      const result = reveal(...args);
      resolve();
      return result;
    }));
  };
  const traceList = (traced: Record<string, unknown> = list() as unknown as Record<string, unknown>): (() => string) => {
    const began = performance.now();
    const lines: string[] = [];
    const note = (line: () => string): void => {
      if (lines.length >= 500)
        return;
      try {
        lines.push(`${Math.round(performance.now() - began)} ms ${untracked(line)}`);
      }
      catch (error) {
        lines.push(`${Math.round(performance.now() - began)} ms the trace couldn't record: ${String(error)}`);
      }
    };
    const read = (name: string): unknown => {
      const value = traced[name];
      return typeof value === "function" ? (value as () => unknown).call(traced) : value;
    };
    const where = (): string => {
      const anchor = traced["anchor"] as { index: number; distance: number } | undefined;
      return `top ${String(read("scrollTop"))}, pending ${String(read("pendingTop"))}, dom ${String(read("domTop"))}, anchor ${anchor?.index} + ${anchor?.distance}`;
    };
    const record = (target: Record<string, unknown> | undefined, name: string, describe: (args: unknown[]) => string): void => {
      const original = target?.[name];
      if (Object.isUndefined(target) || typeof original !== "function") {
        note(() => `the trace skips ${name}, which the list doesn't have`);
        return;
      }
      target[name] = (...args: unknown[]): unknown => {
        const result: unknown = original.apply(target, args);
        note(() => `${name}(${describe(args)}): ${where()}`);
        return result;
      };
    };
    for (const name of ["show", "scrollTo", "onScroll", "settle", "correct", "resolve"])
      record(traced, name, args => args.join(", "));
    record(traced, "measure", args => (args[0] as readonly ResizeObserverEntry[]).map(t => `${t.target.getAttribute("data-nol-row") ?? "viewport"}: ${t.contentRect.height}`).join(", "));
    let cache: Record<string, unknown> | undefined;
    try {
      cache = (read("state") as { cache?: Record<string, unknown> } | undefined)?.cache;
    }
    catch {
      cache = undefined;
    }
    record(cache, "receive", args => `page ${String(args[0])}`);
    const slots = (nodes: NodeList): string => [...nodes].filter(t => t instanceof HTMLElement && t.classList.contains("nol-virtual-list-slot"))
      .map(t => (t as HTMLElement).getAttribute("data-nol-row")).join(", ");
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        const added = slots(change.addedNodes);
        const removed = slots(change.removedNodes);
        if (added !== "" || removed !== "")
          note(() => `slots added [${added}], removed [${removed}]`);
      }
    });
    observer.observe(element(), { childList: true, subtree: true });
    observers.push(observer);
    return () => lines.join("\n");
  };
  const shownRows = (): string => [...element().querySelectorAll<HTMLElement>(".nol-virtual-list-slot")]
    .map(t => `${t.getAttribute("data-nol-row")}: ${JSON.stringify(t.querySelector(".nol-markdown-view")?.textContent?.trim().slice(0, 16) ?? null)}`).join(", ");
  const open = async (conversationId: string): Promise<void> => {
    if (!store().loaded())
      await renderedFrame();
    expect(store().loaded()).toBe(true);
    await store().selectConversation(conversationId);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    AppearanceFixture.apply();
    context = SampleData.createContext()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), empty.toJson(), chain.toJson(), ...left.map(t => t.toJson()), far.toJson(), farAgent.toJson()])
      .answer(MethodName.MessagePage, pageOf);
    clock = new FakeClock(Date.parse(SampleData.timestamp));
    TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true) }, ChatStoreService.provider,
        { provide: ClockService, useValue: clock }, provideMarkdown(), provideCodeHighlighting()]
    });
    fixture = TestBed.createComponent(HistoryComponent);
    fixture.componentRef.setInput("chatId", "c1");
    element().style.height = "600px";
    fixture.detectChanges();
  });

  afterEach(() => {
    for (const observer of observers.splice(0))
      observer.disconnect();
    arrived.splice(0);
    ChatStoreService.release(context);
    AppearanceFixture.reset();
    vi.restoreAllMocks();
  });

  it("keeps the list's own calls working while its trace can't read what it records, and skips what the list doesn't have", () => {
    const traced: Record<string, unknown> = {
      show: (row: number) => row + 1,
      scrollTop: () => {
        throw new Error("No scroll top");
      },
      state: () => {
        throw new Error("No state");
      }
    };
    const trace = traceList(traced);

    const shown = (traced["show"] as (row: number) => number)(4);

    expect([shown, "correct" in traced, trace().split("\n").map(t => t.replace(/^\d+ ms /, ""))]).toEqual([5, false, [
      "the trace skips scrollTo, which the list doesn't have", "the trace skips onScroll, which the list doesn't have", "the trace skips settle, which the list doesn't have",
      "the trace skips correct, which the list doesn't have", "the trace skips resolve, which the list doesn't have", "the trace skips measure, which the list doesn't have",
      "the trace skips receive, which the list doesn't have", "the trace couldn't record: Error: No scroll top"]]);
  });

  it("opens 5,000 messages at the newest, with scroll space for all of them, and reads and renders only the rows near the view", async () => {
    await open("c1");

    await until(() => expect(rowOf(4_999)).toBeDefined());
    await settle();
    const rendered = element().querySelectorAll("nol-teamrun-history-message").length;
    expect(store().history()?.length()).toBe(5_000);
    expect(viewport()?.scrollHeight).toBeGreaterThan(4_000 * Resources.historyEstimate);
    expect(rowOf(4_999)?.getAttribute("data-nol-row")).toBe("4999");
    expect(reads()[0]).toBeNull();
    expect(Math.min(...reads().map(t => t ?? Number.POSITIVE_INFINITY))).toBeGreaterThanOrEqual(4_850);
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(25);
    expect(element().querySelector("[role=feed]")?.getAttribute("aria-label")).toBe("Messages");
    expect(element().querySelector("[role=feed]")?.getAttribute("aria-busy")).toBe("false");
  });

  it("reads the rows above the newest while the reader is still at the bottom, and keeps the rows in view where they were", async () => {
    const earlier = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).beforeSequence === 4_950 ? earlier.promise : pageOf(t));
    await open("c1");
    await until(() => expect(offsetOf(4_999)).not.toBeNull());
    await until(() => expect(reads()).toContain(4_950));
    await settle();
    const before = offsetOf(4_999);

    earlier.resolve(pageOf(new MessagePageParams("c1", 4_950, null, 50).toJson()));
    await until(() => expect(store().history()?.find("m4900")?.sequence).toBe(4_900));
    await settle();

    expect(offsetOf(4_999)).toBe(before);
  });

  it("opens at the position the store remembered for the conversation", async () => {
    store().rememberPosition("c1", new ReadingPosition("m4900", 4_900, 0));
    await open("c1");

    await until(() => expectAtTop(4_900));
    expect(store().pendingPosition()).toBeNull();
    await settle();
    expectAtTop(4_900);
    expect(store().history()?.length()).toBe(5_000);
  });

  describe("Jump to latest", () => {
    const pagesFrom = (from: number): MessagePageParams[] => context.requests.slice(from)
      .filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)).map(t => MessagePageParams.fromJson(t.parameters));
    const jumpButton = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-virtual-list-jump-shown");
    const expectAtEnd = (): void => {
      const view = viewport() as HTMLElement;
      expect(Math.abs((rowOf(4_999)?.getBoundingClientRect().bottom ?? Number.NaN) - view.getBoundingClientRect().bottom)).toBeLessThan(1);
      expect(view.scrollHeight - view.scrollTop - view.clientHeight).toBeLessThanOrEqual(1);
    };
    const openFarUp = async (): Promise<void> => {
      store().rememberPosition("c1", new ReadingPosition("m2500", 2_500, 0));
      await open("c1");
      await until(() => expectAtTop(2_500));
      await settle();
      expect(store().history()?.holdsNewest()).toBe(false);
    };

    it("reads the newest page first from a place whose window doesn't hold it, shows it in a new history at its end and follows it, never reading the old window's end", { timeout: 2 * revealLimit }, async () => {
      await openFarUp();
      const opened = store().history();
      const asked = context.requests.length;

      expect(jumpButton()).not.toBeNull();
      jumpButton()?.click();
      await until(() => expect(store().history()).not.toBe(opened));
      await until(() => expect(rowOf(4_999)).toBeDefined());
      await settle();

      expect(pagesFrom(asked)[0]).toEqual(new MessagePageParams("c1", null, null, Resources.messagePageSize));
      expect(pagesFrom(asked).filter(t => !Object.isNull(t.beforeSequence) && t.beforeSequence > 2_700 && t.beforeSequence - t.limit < 4_800)).toEqual([]);
      expect(pagesFrom(asked).filter(t => (t.beforeSequence ?? 0) > 4_950)).toEqual([]);
      expect(store().history()?.holdsNewest()).toBe(true);
      expectAtEnd();
      expect(jumpButton()).toBeNull();
    });

    it("scrolls to the end it already holds without reading the newest page again, keeping its history", { timeout: 2 * revealLimit }, async () => {
      await open("c1");
      await until(() => expect(rowOf(4_999)).toBeDefined());
      await settle();
      const view = viewport() as HTMLElement;
      view.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      view.scrollTop -= 3_000;
      view.dispatchEvent(new Event("scroll"));
      await settle();
      const opened = store().history();
      const asked = context.requests.length;

      expect(jumpButton()).not.toBeNull();
      jumpButton()?.click();
      await until(expectAtEnd);
      await settle();

      expect(pagesFrom(asked).filter(t => Object.isNull(t.beforeSequence) && Object.isNull(t.afterSequence))).toEqual([]);
      expect(store().history()).toBe(opened);
      expectAtEnd();
    });

    it("posts a newest page that failed, and lets the list scroll to the end of the window it has", { timeout: 2 * revealLimit }, async () => {
      await openFarUp();
      const opened = store().history();
      context.answer(MethodName.MessagePage, t => {
        const params = MessagePageParams.fromJson(t);
        if (Object.isNull(params.beforeSequence) && Object.isNull(params.afterSequence))
          throw new Error("The runtime stopped.");
        return pageOf(t);
      });

      expect(jumpButton()).not.toBeNull();
      jumpButton()?.click();
      await until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.text]))
        .toEqual([[Resources.formatNoticeKey(ChatAction.ShowLatest, "c1"), "The runtime stopped."]]));
      await until(expectAtEnd);
      await settle();

      expect(store().history()).toBe(opened);
      expectAtEnd();
    });
  });

  it("remembers where the reader is and whether the feed follows its end, keeps it while the row in view is still loading, and forgets it where the feed follows its end from a row still loading", async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const remembered = vi.spyOn(store(), "rememberPosition");

    list().positionChange.emit(new VirtualListPosition(4_851, "m4851", 12));
    expect(remembered).toHaveBeenLastCalledWith("c1", new ReadingPosition("m4851", 4_851, 12, false));
    list().positionChange.emit(new VirtualListPosition(4_999, "m4999", 40));
    expect(remembered).toHaveBeenLastCalledWith("c1", new ReadingPosition("m4999", 4_999, 40, false));
    list().positionChange.emit(new VirtualListPosition(4_994, "m4994", 123, true));
    expect(remembered).toHaveBeenLastCalledWith("c1", new ReadingPosition("m4994", 4_994, 123, true));
    list().positionChange.emit(new VirtualListPosition(1_000, null, 0));
    expect(remembered).toHaveBeenCalledTimes(3);
    list().positionChange.emit(new VirtualListPosition(4_998, null, 0, true));
    expect(remembered).toHaveBeenLastCalledWith("c1", null);
    expect(remembered).toHaveBeenCalledTimes(4);
  });

  it("writes the reader's place 2 s after the last scroll, and once when the window closes or quits inside those 2 s", async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const written = (): string[][] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ReadingPositionSave))
      .map(t => ReadingPositionSaveParams.fromJson(t.parameters).positions.map(u => u.messageId));

    list().positionChange.emit(new VirtualListPosition(4_851, "m4851", 12));
    clock.advance(1_500);
    list().positionChange.emit(new VirtualListPosition(4_850, "m4850", 4));
    clock.advance(1_500);
    expect(written()).toEqual([]);
    clock.advance(500);
    await until(() => expect(written()).toEqual([["m4850"]]));
    list().positionChange.emit(new VirtualListPosition(4_800, "m4800", 0));
    clock.advance(1_000);
    for (const save of context.saves)
      await save();
    expect(written()).toEqual([["m4850"], ["m4800"]]);
    clock.advance(2_000);
    await Promise.resolve();
    expect(written()).toEqual([["m4850"], ["m4800"]]);
  });

  describe("a steered message", () => {
    const at = (seconds: number): string => new Date(Date.parse(SampleData.timestamp) + seconds * 1000).toISOString();
    const text = (sequence: number, body: string, seconds: number): MessageDetail => new MessageDetail(sequence, DetailKind.Text, body, null, at(seconds));
    const asked = new Message("s0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [text(0, "Write the plan.", 0)], null, at(0), null, at(0));
    const command = new MessageDetail(1, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" }, at(5));
    const reply = (status: MessageStatus, details: readonly MessageDetail[]): Message => new Message("s1", "c3", 1, MessageAuthor.Provider, "s0", status, [...details],
      SampleData.provenance, at(1), at(1), status === MessageStatus.Running ? null : at(40));
    const steer = (attachments: readonly MessageAttachment[] = []): Message => new Message("s2", "c3", 2, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Keep it short.", { steeredInto: "s1" }, at(12))], null, at(12), null, at(12), [...attachments]);
    const thanks = new Message("s3", "c3", 3, MessageAuthor.User, null, MessageStatus.Completed, [text(0, "Thanks.", 50)], null, at(50), null, at(50));
    const replyHost = (): HTMLElement | null => element().querySelector<HTMLElement>('nol-teamrun-history-message[data-message-id="s1"]');
    const partOf = (body: string): HTMLElement | undefined => [...replyHost()?.querySelectorAll<HTMLElement>(".nol-markdown-view") ?? []]
      .find(t => t.textContent?.trim() === body && Object.isNull(t.closest(".steered-message")));
    const steeredRow = (): HTMLElement | null => replyHost()?.querySelector<HTMLElement>("nol-teamrun-history-message.steered-message") ?? null;
    const steered = (): HTMLElement | null => steeredRow()?.querySelector<HTMLElement>("nol-message") ?? null;
    const hiddenRow = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-virtual-list-slot-hidden");
    const isAbove = (upper: Element | null | undefined, lower: Element | null | undefined): boolean => !Object.isNullOrUndefined(upper)
      && !Object.isNullOrUndefined(lower) && upper.getBoundingClientRect().bottom <= lower.getBoundingClientRect().top;
    const openSteered = async (): Promise<void> => {
      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      await until(() => expect(replyHost()).not.toBeNull());
    };
    const update = async (message: Message, event: EventName): Promise<void> => {
      arrived.splice(0, arrived.length, ...arrived.filter(t => t.id !== message.id), message);
      context.emit(event, message.toJson());
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it("shows inside the running reply where it went in, at the reply's end and then before the part written after it, and not as its own row", async () => {
      arrived.push(asked, reply(MessageStatus.Running, [text(0, "First part.", 2), command]));
      await openSteered();

      await update(steer(), EventName.MessageCreated);
      await until(() => expect(steered()?.textContent).toContain("Keep it short."));
      expect(steered()?.classList.contains("nol-message-bubble")).toBe(true);
      expect(isAbove(partOf("First part."), steered())).toBe(true);
      expect([hiddenRow()?.getBoundingClientRect().height, hiddenRow()?.querySelector("nol-teamrun-history-message")]).toEqual([0, null]);
      expect([...element().querySelectorAll(".nol-markdown-view")].filter(t => t.textContent?.trim() === "Keep it short." && t.getClientRects().length > 0)).toHaveLength(1);

      await update(reply(MessageStatus.Running, [text(0, "First part.", 2), command, text(2, "Second part.", 36)]), EventName.MessageUpdated);
      await until(() => expect(partOf("Second part.")).toBeDefined());
      expect([isAbove(partOf("First part."), steered()), isAbove(steered(), partOf("Second part."))]).toEqual([true, true]);
    });

    it("shows inside the ended reply after the chat opens again, with its file, between its steps and the part written after it, with the next message below the reply", async () => {
      const file = new MessageAttachment("notes.txt", "text/plain", 12, "D:/data/attachments/c3/notes.txt");
      arrived.push(asked, reply(MessageStatus.Completed, [text(0, "First part.", 2), command, text(2, "Second part.", 36)]), steer([file]), thanks);
      await openSteered();

      await until(() => expect(steered()?.textContent).toContain("Keep it short."));
      expect(steered()?.textContent).toContain("notes.txt");
      const thanksRow = element().querySelector('nol-teamrun-history-message[data-message-id="s3"]');
      expect([isAbove(replyHost()?.querySelector(".activity-line"), steered()), isAbove(steered(), partOf("Second part.")), isAbove(replyHost(), thanksRow)])
        .toEqual([true, true, true]);
      expect([hiddenRow()?.getBoundingClientRect().height, hiddenRow()?.querySelector("nol-teamrun-history-message")]).toEqual([0, null]);
    });

    it("takes no space with its own row, so the gap after its reply is the one between any two rows", async () => {
      arrived.push(asked, reply(MessageStatus.Completed, [text(0, "First part.", 2), command, text(2, "Second part.", 36)]), steer(), thanks);
      await openSteered();

      await until(() => expect(steered()?.textContent).toContain("Keep it short."));
      const box = (id: string): DOMRect => element().querySelector(`nol-teamrun-history-message[data-message-id="${id}"]`)?.getBoundingClientRect()
        ?? new DOMRect(0, Number.NaN);
      const between = box("s1").top - box("s0").bottom;
      expect(between).toBeGreaterThan(0);
      expect(Math.abs(box("s3").top - box("s1").bottom - between)).toBeLessThan(0.5);
    });

    it("keeps a person's Copy and Rewind on it, Rewind before Copy, and shows its image as a preview, not as a file", async () => {
      const shot = new MessageAttachment("shot.png", "image/png", 2048, "D:/data/attachments/c3/shot.png");
      arrived.push(asked, reply(MessageStatus.Completed, [text(0, "First part.", 2), command, text(2, "Second part.", 36)]), steer([shot]), thanks);
      await openSteered();

      await until(() => expect(steered()?.textContent).toContain("Keep it short."));
      const part = (selector: string): Element | null => steeredRow()?.querySelector(selector) ?? null;
      const box = (selector: string): DOMRect => part(selector)?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
      expect([part(".nol-message-copy")?.getAttribute("aria-label"), part(".nol-teamrun-rewind")?.getAttribute("aria-label")])
        .toEqual(["Copy message", Resources.rewindLabel]);
      expect([box(".nol-message-copy").width > 0, box(".nol-teamrun-rewind").right <= box(".nol-message-copy").left]).toEqual([true, true]);
      expect([box("nol-teamrun-image-preview").height > 0, part(".nol-message-attachment")]).toEqual([true, null]);
    });

    it("flashes inside the reply it went into, in view, when a search hit or a focus names it, and not its hidden row", async () => {
      arrived.push(asked, reply(MessageStatus.Completed, [text(0, "First part.", 2), command, text(2, "Second part.", 36)]), steer(), thanks);
      await openSteered();
      await until(() => expect(steered()?.textContent).toContain("Keep it short."));

      store().focusMessage(new MessageFocus("c3", "s2", 2));
      await until(() => {
        fixture.detectChanges();
        expect(flashing()).toEqual([steered()]);
      });
      const view = viewport()?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
      const shown = steered()?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
      expect([shown.top >= view.top - 0.5, shown.bottom <= view.bottom + 0.5]).toEqual([true, true]);
    });
  });

  describe("a message that arrives in a chat on screen", () => {
    const arriving = (details: readonly MessageDetail[]): Message => new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Running, details,
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    const slot = (): HTMLElement | null => element().querySelector<HTMLElement>("[data-nol-row='5000']");
    const partsOf = (row: HTMLElement | null): string => Object.isNull(row) ? "none"
      : [row.querySelectorAll("nol-message").length, row.querySelectorAll("nol-markdown-view").length, row.querySelectorAll(".activity-line").length].join(" ");
    const record = (): { readonly states: string[]; readonly texts: Set<string> } => {
      const states: string[] = [];
      const texts: Set<string> = new Set();
      const observer = new MutationObserver(() => {
        const text = slot()?.querySelector(".nol-markdown-view")?.textContent?.trim() ?? String.empty;
        if (text !== String.empty)
          texts.add(text);
        const now = partsOf(slot());
        if (now !== "none" && states.at(-1) !== now)
          states.push(now);
      });
      observer.observe(element(), { childList: true, subtree: true, characterData: true });
      observers.push(observer);
      return { states, texts };
    };
    const openShown = async (): Promise<HTMLElement> => {
      await open("c1");
      await store().conversationInView("c1");
      await until(() => expect(rowOf(4_999)).toBeDefined());
      await settle();
      const view = viewport();
      if (Object.isNull(view))
        throw new Error("The history shows no view.");
      return view;
    };

    const textsOf = (): (string | undefined)[] => [...element().querySelectorAll(".nol-markdown-view")].map(t => t.textContent?.trim()).filter(t => t?.startsWith("Message 5000") === true);
    const holdSlots = (): { readonly held: (() => void)[]; readonly stopped: number[] } => {
      const held: (() => void)[] = [];
      const stopped: number[] = [];
      vi.spyOn(TestBed.inject(PaintPacerService), "afterPaint").mockImplementation((done: () => void) => {
        held.push(done);
        return () => stopped.push(held.length);
      });
      return { held, stopped };
    };

    it("shows its header and its whole text first, then its slots after a paint, each part once, with the feed at its end at each part and the row's height settled after the last part", async () => {
      const view = await openShown();
      const { held } = holdSlots();
      const { states, texts } = record();
      const measure = async (): Promise<{ readonly height: number; readonly atEnd: boolean }> => {
        await settle();
        return { height: slot()?.getBoundingClientRect().height ?? Number.NaN, atEnd: view.scrollHeight - view.scrollTop - view.clientHeight <= 1 };
      };

      context.emit(EventName.MessageCreated, arriving([SampleData.detail(0, DetailKind.Text, "Message 5000")]).toJson());
      await until(() => expect(partsOf(slot())).toBe("1 1 0"));
      const text = await measure();
      held.shift()?.();
      await until(() => expect(partsOf(slot())).toBe("1 1 1"));
      const whole = await measure();
      for (let frame = 0; frame < 5; frame++)
        await renderedFrame();
      const after = await measure();

      expect({
        states: states.filter(t => !t.startsWith("0 ")),
        growsAtLastPart: text.height < whole.height,
        atEnd: [text.atEnd, whole.atEnd, after.atEnd],
        settled: after.height - whole.height,
        texts: [...texts],
        shown: textsOf(),
        waiting: held.length
      }).toEqual({ states: ["1 1 0", "1 1 1"], growsAtLastPart: true, atEnd: [true, true, true], settled: 0, texts: ["Message 5000"], shown: ["Message 5000"], waiting: 0 });
    });

    it("keeps a change that comes before its slots show, showing it once", async () => {
      await openShown();
      const { held } = holdSlots();

      context.emit(EventName.MessageCreated, arriving([SampleData.detail(0, DetailKind.Text, "Message 5000")]).toJson());
      await until(() => expect(partsOf(slot())).toBe("1 1 0"));
      context.emit(EventName.MessageUpdated, arriving([SampleData.detail(0, DetailKind.Text, "Message 5000, changed")]).toJson());
      await settle();
      held.shift()?.();
      await until(() => expect(partsOf(slot())).toBe("1 1 1"));

      await until(() => expect(textsOf()).toEqual(["Message 5000, changed"]));
    });

    it("stops waiting to show its slots when the chat closes first", async () => {
      await openShown();
      const { held, stopped } = holdSlots();

      context.emit(EventName.MessageCreated, arriving([SampleData.detail(0, DetailKind.Text, "Message 5000")]).toJson());
      await until(() => expect(partsOf(slot())).toBe("1 1 0"));
      const before = stopped.length;
      fixture.destroy();

      expect([held.length, before, stopped]).toEqual([1, 0, [1]]);
    });

    it("shows a row read from the history whole when it first renders", async () => {
      const partial: string[] = [];
      const observer = new MutationObserver(records => {
        for (const added of records.flatMap(t => [...t.addedNodes]))
          if (added instanceof HTMLElement)
            for (const row of [added, ...added.querySelectorAll<HTMLElement>("nol-teamrun-history-message")].filter(t => t.matches("nol-teamrun-history-message")))
              if (Object.isNull(row.querySelector("nol-markdown-view")))
                partial.push(row.closest("[data-nol-row]")?.getAttribute("data-nol-row") ?? "?");
      });
      observer.observe(element(), { childList: true, subtree: true });
      observers.push(observer);

      await openShown();

      expect([partial, element().querySelectorAll("nol-teamrun-history-message").length > 0]).toEqual([[], true]);
    });
  });

  describe("a chat left and opened again", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 400;
    const picture = canvas.toDataURL("image/png");
    const slotOf = (row: number): HTMLElement | null => element().querySelector<HTMLElement>(`.nol-virtual-list-slot[data-nol-row="${row}"]`);
    const leave = async (conversationId: string): Promise<void> => {
      fixture.componentRef.setInput("chatId", "c2");
      await open("c2");
      await until(() => expect(store().isHistoryLoaded(conversationId)).toBe(false));
    };
    const reopen = async (conversationId: string): Promise<void> => {
      fixture.componentRef.setInput("chatId", conversationId);
      await open(conversationId);
    };
    const answer = (conversationId: string, details: readonly MessageDetail[]): void => {
      const reply = new Message(`${conversationId}-11`, conversationId, 11, MessageAuthor.Provider, `${conversationId}-10`, MessageStatus.Completed, [...details],
        SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
      arrived.push(reply);
      context.emit(EventName.MessageCreated, reply.toJson());
    };

    it.each([
      { kind: "a code block", conversationId: "left-code", text: `Here it is:\n\n\`\`\`ts\n${codeLines.slice(0, 8).join("\n")}\n\`\`\``, isImage: false,
        isSettled: (row: HTMLElement) => !Object.isNull(row.querySelector("pre")) },
      { kind: "a long code block", conversationId: "left-long-code", text: `Here it is:\n\n\`\`\`ts\n${codeLines.join("\n")}\n\`\`\``, isImage: false,
        isSettled: (row: HTMLElement) => !Object.isNull(row.querySelector("pre")) },
      { kind: "math", conversationId: "left-math", text: "The area is\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$", isImage: false,
        isSettled: (row: HTMLElement) => !Object.isNull(row.querySelector(".katex")) },
      { kind: "an image", conversationId: "left-image", text: "Here it is:", isImage: true,
        isSettled: (row: HTMLElement) => row.querySelector<HTMLImageElement>(".nol-teamrun-image-frame img")?.naturalWidth === 300 }
    ])("shows the end of a reply that ended in $kind and came while the chat was left at its end, measured once the reply's height settles", { timeout: 2 * revealLimit }, async ({ conversationId, text, isImage, isSettled }) => {
      const stored = `D:\\TeamRun\\images\\${conversationId}-11.png`;
      const read = new DeferredResponse();
      context.answer(MethodName.WrittenImageRead, () => read.promise);
      await reopen(conversationId);
      await until(() => expect(slotOf(10)).not.toBeNull());
      await settle();
      await leave(conversationId);
      answer(conversationId, [SampleData.detail(0, DetailKind.Text, text), ...isImage ? [new MessageDetail(1, DetailKind.Note, "Generated image (completed): astra.png",
        { itemType: "imageGeneration", status: "completed", savedPath: "astra.png", revisedPrompt: "Astra", failure: null, imageData: null, mediaType: "image/png", storedPath: stored },
        SampleData.timestamp)] : []]);

      await reopen(conversationId);
      await until(() => expect(slotOf(11)).not.toBeNull());
      await settle();
      const shown = isImage ? Wait.settled(decodedImage(() => slotOf(11)), "The image's decode", { timeout: revealLimit }) : Promise.resolve(null);
      read.resolve(new AttachmentContent("astra.png", "image/png", 4, picture.slice(picture.indexOf(",") + 1)).toJson());
      await shown;
      await until(() => expect(isSettled(slotOf(11) ?? element())).toBe(true));
      await settle();

      const view = viewport();
      const end = slotOf(11)?.getBoundingClientRect().bottom ?? Number.NaN;
      expect(Math.abs(end - (view?.getBoundingClientRect().bottom ?? Number.NaN))).toBeLessThan(1);
      expect((view?.scrollHeight ?? 0) - (view?.scrollTop ?? 0) - (view?.clientHeight ?? 0)).toBeLessThanOrEqual(1);
    });

    it("opens a chat left scrolled up inside its long last reply at the place it was left, not at its end", async () => {
      await reopen("left-inside");
      await until(() => expect(slotOf(10)).not.toBeNull());
      await settle();
      answer("left-inside", [SampleData.detail(0, DetailKind.Text, Array.from({ length: 60 }, (_, index) => `Paragraph ${index}`).join("\n\n"))]);
      await until(() => expect(slotOf(11)?.textContent).toContain("Paragraph 59"));
      await settle();
      const inside = (): number => (slotOf(11)?.getBoundingClientRect().top ?? Number.NaN) - (viewport()?.getBoundingClientRect().top ?? Number.NaN);
      const view = viewport();
      view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      if (!Object.isNull(view))
        view.scrollTop += inside() + 200;
      await until(() => expect(Math.abs(inside() + 200)).toBeLessThan(1));
      await settle();
      const before = inside();
      await leave("left-inside");

      await reopen("left-inside");
      await until(() => expect(slotOf(11)?.textContent).toContain("Paragraph 59"));
      await settle();

      expect(Math.abs(before + 200)).toBeLessThan(1);
      expect(Math.abs(inside() - before)).toBeLessThan(1);
      expect((viewport()?.scrollHeight ?? 0) - (viewport()?.scrollTop ?? 0) - (viewport()?.clientHeight ?? 0)).toBeGreaterThan(200);
    });

    it("shows the reply a Plans view plan asks for in the kit's flash, grown by a bubble's padding with its corners, moving nothing, then scrolls the least that shows the plan deep in it, unlike a search hit", { timeout: 2 * revealLimit }, async () => {
      const plan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.Pending, null)], null);
      await reopen("left-plan");
      await settle();
      expect(slotOf(10)).not.toBeNull();
      answer("left-plan", [SampleData.detail(0, DetailKind.Text, paragraphs(0)), new MessageDetail(1, DetailKind.Plan, "Plan", plan.toJson(), SampleData.timestamp),
        SampleData.detail(2, DetailKind.Text, paragraphs(60))]);
      await settle();
      expect(slotOf(11)?.textContent).toContain("Paragraph 119");
      const view = viewport() as HTMLElement;
      const block = (): DOMRect => slotOf(11)?.querySelector("nol-teamrun-plan-card")?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
      const top = (): number => (slotOf(11)?.getBoundingClientRect().top ?? Number.NaN) - view.getBoundingClientRect().top;
      const shown = (): void => {
        expect(block().top).toBeGreaterThanOrEqual(view.getBoundingClientRect().top - 0.5);
        expect(block().bottom).toBeLessThanOrEqual(view.getBoundingClientRect().bottom + 0.5);
      };

      const scrolled = rowRevealed();
      store().focusMessage(new MessageFocus("left-plan", "left-plan-11", 11));
      await Wait.settled(scrolled, "The row reveal", { timeout: revealLimit });
      await settle();
      expect(Math.abs(top())).toBeLessThan(1);
      expect(block().top).toBeGreaterThan(view.getBoundingClientRect().bottom);
      view.scrollTop = 0;
      view.dispatchEvent(new Event("scroll"));
      await settle();
      clock.advance(Resources.flashMilliseconds);
      fixture.detectChanges();

      const revealed = partRevealed();
      store().showPlan(new MessageFocus("left-plan", "left-plan-11", 11, true));
      await Wait.settled(revealed, "The part reveal", { timeout: revealLimit });
      await settle();
      shown();
      expect(Math.abs(block().bottom - view.getBoundingClientRect().bottom)).toBeLessThan(1);
      expect(flashing()).toEqual([slotOf(11)?.querySelector("nol-message")]);
      expect([store().focus(), store().planFocus()?.messageId]).toEqual([null, "left-plan-11"]);

      const message = slotOf(11)?.querySelector("nol-message") as HTMLElement;
      const main = message.querySelector(".nol-message-main") as HTMLElement;
      const offsets = (): number[] => [".nol-message-header", ".nol-message-content"].flatMap(t => {
        const part = (main.querySelector(t) as HTMLElement).getBoundingClientRect();
        return [part.top - message.getBoundingClientRect().top, part.left - message.getBoundingClientRect().left, part.width, part.height];
      });
      const flash = getComputedStyle(main, "::before");
      const during = offsets();
      expect([flash.content, flash.gridRowStart, flash.gridRowEnd]).toEqual(["\"\"", "1", "3"]);
      for (const [margin, token] of [[flash.marginTop, "space-3"], [flash.marginBottom, "space-3"], [flash.marginLeft, "space-4"], [flash.marginRight, "space-4"]] as const)
        AppearanceFixture.expectPixels(-Number.parseFloat(margin), AppearanceFixture.measureLook(token));
      AppearanceFixture.expectPixels(Number.parseFloat(flash.borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      AppearanceFixture.expectPixels(Number.parseFloat(flash.borderBottomRightRadius), AppearanceFixture.measureLook("radius-medium"));
      expect(main.getBoundingClientRect().left - AppearanceFixture.measureLook("space-4")).toBeGreaterThanOrEqual(view.getBoundingClientRect().left + view.clientLeft);
      expect(main.getBoundingClientRect().right + AppearanceFixture.measureLook("space-4"))
        .toBeLessThanOrEqual(view.getBoundingClientRect().left + view.clientLeft + view.clientWidth);
      clock.advance(Resources.flashMilliseconds);
      fixture.detectChanges();
      await settle();
      expect(flashing()).toEqual([]);
      expect(offsets()).toEqual(during);
    });

    it.each([
      { place: "more than the list's follow distance from the end, at the view's bottom edge", after: 40, aligned: true, reader: false },
      { place: "near the end, wherever the list's follow of its end leaves it", after: 0, aligned: false, reader: false },
      { place: "and leaves the view where the reader scrolls it right after", after: 16, aligned: false, reader: true }
    ])("opens the activity and the row of the sub-agent the Sub-agents view asks for, then shows the row deep in the reply $place", { timeout: 2 * revealLimit }, async ({ after, aligned, reader }) => {
      const followDistance = 120;
      const command = (sequence: number): MessageDetail =>
        new MessageDetail(sequence, DetailKind.Command, "> ls\nout", { tool: "Bash", toolUseId: `t${sequence}` }, SampleData.timestamp);
      const agent = new SubAgent("ta", "Explore", "Find where plans are stored", "Haiku 5.5", SubAgentStatus.Completed, false, 14, 38200, 72000, "They're in the store.");
      const closing = ["Done.", ...Array.from({ length: after }, (_, index) => `Finding ${index + 1}.`)].join("\n\n");
      await reopen("left-agent");
      await settle();
      expect(slotOf(10)).not.toBeNull();
      answer("left-agent", [SampleData.detail(0, DetailKind.Text, "Looking."), ...Array.from({ length: 60 }, (_, index) => command(index + 1)),
        new MessageDetail(61, DetailKind.SubAgent, agent.description, agent.toJson(), SampleData.timestamp), SampleData.detail(62, DetailKind.Text, closing)]);
      await settle();
      expect(slotOf(11)?.textContent).toContain("Done.");
      const view = viewport() as HTMLElement;
      const row = (): Element | null => slotOf(11)?.querySelector(`${Resources.subAgentStepSelector}[data-step="61"]`) ?? null;
      const box = (): DOMRect => row()?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
      const shown = (): void => {
        expect(box().top).toBeGreaterThanOrEqual(view.getBoundingClientRect().top - 0.5);
        expect(box().bottom).toBeLessThanOrEqual(view.getBoundingClientRect().bottom + 0.5);
      };

      const revealed = partRevealed();
      store().showSubAgent(new MessageFocus("left-agent", "left-agent-11", 11, false, 61));
      await Wait.settled(revealed, "The part reveal", { timeout: revealLimit });
      await settle();
      expect(row()?.querySelector("[aria-expanded='true']")).not.toBeNull();
      shown();
      const readerTop = view.scrollTop - 200;
      if (reader) {
        view.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        view.scrollTop = readerTop;
      }
      await settle();

      if (reader)
        expect(Math.abs(view.scrollTop - readerTop)).toBeLessThan(1);
      else
        shown();
      if (aligned) {
        expect(Math.abs(box().bottom - view.getBoundingClientRect().bottom)).toBeLessThan(1);
        expect(view.scrollHeight - view.scrollTop - view.clientHeight).toBeGreaterThan(followDistance);
      }
      expect(flashing()).toEqual([slotOf(11)?.querySelector("nol-message")]);
      expect([store().focus(), store().subAgentFocus()?.step]).toEqual([null, 61]);
      expect(slotOf(11)?.querySelectorAll(`${Resources.subAgentStepSelector}`)).toHaveLength(1);
    });

    it("opens a chat left scrolled up where it was left, though a reply came while it was away", async () => {
      await reopen("left-up");
      await until(() => expect(slotOf(10)).not.toBeNull());
      await settle();
      const fromEnd = (): number => (viewport()?.scrollHeight ?? 0) - (viewport()?.scrollTop ?? 0) - (viewport()?.clientHeight ?? 0);
      const view = viewport();
      view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      if (!Object.isNull(view))
        view.scrollTop += (offsetOf(3) ?? Number.NaN) + 40;
      await until(() => expect(Math.abs((offsetOf(3) ?? Number.NaN) + 40)).toBeLessThan(1));
      await settle();
      const before = offsetOf(3);
      expect(view?.scrollTop).toBeGreaterThan(200);
      expect(fromEnd()).toBeGreaterThan(200);
      await leave("left-up");
      answer("left-up", [SampleData.detail(0, DetailKind.Text, "Message 11")]);

      await reopen("left-up");
      await until(() => expect(store().history()?.length()).toBe(12));
      await until(() => expect(rowOf(3)).toBeDefined());
      await settle();

      expect(Math.abs((before ?? Number.NaN) + 40)).toBeLessThan(1);
      expect(Math.abs((offsetOf(3) ?? Number.NaN) - (before ?? Number.NaN))).toBeLessThan(1);
      expect(viewport()?.scrollTop).toBeGreaterThan(200);
      expect(fromEnd()).toBeGreaterThan(200);
    });

    describe("a working reply's latest step line", () => {
      const fromEnd = (): number => (viewport()?.scrollHeight ?? 0) - (viewport()?.scrollTop ?? 0) - (viewport()?.clientHeight ?? 0);
      const heightOf = (): number => slotOf(11)?.getBoundingClientRect().height ?? Number.NaN;
      const replyOf = (conversationId: string, status: MessageStatus, details: readonly MessageDetail[]): Message =>
        new Message(`${conversationId}-11`, conversationId, 11, MessageAuthor.Provider, `${conversationId}-10`, status, [...details],
          SampleData.provenance, SampleData.timestamp, SampleData.timestamp, status === MessageStatus.Running ? null : SampleData.timestamp);
      const text = SampleData.detail(0, DetailKind.Text, Array.from({ length: 30 }, (_, index) => `Paragraph ${index}`).join("\n\n"));
      const step = new MessageDetail(1, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t9" }, SampleData.timestamp);
      const answer = SampleData.detail(2, DetailKind.Text, Array.from({ length: 30 }, (_, index) => `Answer ${index}`).join("\n\n"));
      const workOn = async (conversationId: string, details: readonly MessageDetail[], end: string): Promise<void> => {
        await reopen(conversationId);
        await until(() => expect(slotOf(10)).not.toBeNull());
        await settle();
        const reply = replyOf(conversationId, MessageStatus.Running, details);
        arrived.push(reply);
        context.emit(EventName.MessageCreated, reply.toJson());
        await until(() => expect(slotOf(11)?.textContent).toContain(end));
        await settle();
      };
      const work = (conversationId: string): Promise<void> => workOn(conversationId, [text], "Paragraph 29");
      const viewTop = (): number => viewport()?.getBoundingClientRect().top ?? Number.NaN;
      const readAsync = async (part: () => Element | undefined, at = 40): Promise<() => number> => {
        const inside = (): number => (part()?.getBoundingClientRect().top ?? Number.NaN) - viewTop();
        const view = viewport();
        view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        if (!Object.isNull(view))
          view.scrollTop += inside() - at;
        await until(() => expect(Math.abs(inside() - at)).toBeLessThan(1));
        await settle();
        return inside;
      };
      const paintedAsync = async (inside: () => number, change: () => Promise<void>): Promise<number[]> => {
        const before = inside();
        const seen: number[] = [];
        const painted = new ResizeObserver(() => seen.push(Math.round(inside() - before) || 0));
        const tick = document.body.appendChild(document.createElement("div"));
        tick.style.cssText = "position: absolute; height: 1px; width: 1px";
        for (const target of [slotOf(11), viewport()?.firstElementChild, tick])
          if (!Object.isNull(target) && !Object.isUndefined(target))
            painted.observe(target);
        let frame = 0;
        const eachFrame = (): void => {
          tick.style.width = tick.style.width === "1px" ? "2px" : "1px";
          frame = requestAnimationFrame(eachFrame);
        };
        frame = requestAnimationFrame(eachFrame);
        await change();
        cancelAnimationFrame(frame);
        painted.disconnect();
        tick.remove();
        return [...new Set([...seen, Math.round(inside() - before) || 0])];
      };
      const paragraph = (words: string): Element | undefined => [...(slotOf(11)?.querySelectorAll("p") ?? [])].find(t => t.textContent?.trim() === words);
      const appear = async (conversationId: string): Promise<void> => {
        context.emit(EventName.DetailAppended, new DetailEventPayload(`${conversationId}-11`, step).toJson());
        await until(() => expect(slotOf(11)?.querySelector(".activity-step")).not.toBeNull());
        await settle();
      };
      const finish = async (conversationId: string): Promise<void> => {
        context.emit(EventName.MessageUpdated, replyOf(conversationId, MessageStatus.Completed, [text, step, answer]).toJson());
        await until(() => expect(slotOf(11)?.querySelector(".activity-step")).toBeNull());
        await settle();
      };

      it("keeps a reader at the feed's end at the end as the line appears and goes, and the list's height follows the reply's", async () => {
        await work("left-step-end");
        const scroll = (): number => viewport()?.scrollHeight ?? Number.NaN;
        const height = heightOf();
        const scrolled = scroll();
        expect(fromEnd()).toBeLessThanOrEqual(1);

        await appear("left-step-end");

        expect(fromEnd()).toBeLessThanOrEqual(1);
        expect(heightOf()).toBeGreaterThan(height);
        expect(Math.abs((scroll() - scrolled) - (heightOf() - height))).toBeLessThan(1);
        const shownHeight = heightOf();
        const shownScroll = scroll();

        await finish("left-step-end");

        expect(fromEnd()).toBeLessThanOrEqual(1);
        expect(Math.abs((scroll() - shownScroll) - (heightOf() - shownHeight))).toBeLessThan(1);
      });

      it("keeps the text a reader is on where it was in every painted frame as the line appears above their view", async () => {
        await work("left-step-inside");
        const inside = await readAsync(() => paragraph("Paragraph 4"));

        const moved = await paintedAsync(inside, () => appear("left-step-inside"));

        expect(slotOf(11)?.querySelector(".activity-step")?.getBoundingClientRect().bottom).toBeLessThan(viewTop());
        expect(moved).toEqual([0]);
      });

      it("keeps the text a reader is on where it was in every painted frame as the line goes from above their view", async () => {
        const id = "left-step-goes";
        await workOn(id, [step, answer], "Answer 29");
        const inside = await readAsync(() => paragraph("Answer 4"));
        expect(slotOf(11)?.querySelector(".activity-step")?.getBoundingClientRect().bottom).toBeLessThan(viewTop());

        const moved = await paintedAsync(inside, async () => {
          context.emit(EventName.MessageUpdated, replyOf(id, MessageStatus.Completed, [step, answer]).toJson());
          await until(() => expect(slotOf(11)?.querySelector(".activity-step")).toBeNull());
          await settle();
        });

        expect(moved).toEqual([0]);
      });

      it("keeps a block taller than the view where the reader is on it in every painted frame as the line appears above it", async () => {
        const id = "left-step-tall";
        const tall = SampleData.detail(0, DetailKind.Text, "word ".repeat(20_000).trimEnd());
        await workOn(id, [tall], "word word");
        const inside = await readAsync(() => [...(slotOf(11)?.querySelectorAll("p") ?? [])].find(t => t.textContent?.startsWith("word")), -200);

        const moved = await paintedAsync(inside, () => appear(id));

        expect(slotOf(11)?.querySelector(".activity-step")?.getBoundingClientRect().bottom).toBeLessThan(viewTop());
        expect(moved).toEqual([0]);
      });

      it("keeps a reader on an earlier message where they were as the line appears and goes", async () => {
        await work("left-step-above");
        const inside = (): number => (slotOf(10)?.getBoundingClientRect().top ?? Number.NaN) - (viewport()?.getBoundingClientRect().top ?? Number.NaN);
        const view = viewport();
        view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        if (!Object.isNull(view))
          view.scrollTop += inside();
        await until(() => expect(Math.abs(inside())).toBeLessThan(1));
        await settle();
        const before = inside();

        await appear("left-step-above");
        expect(Math.abs(inside() - before)).toBeLessThan(1);

        await finish("left-step-above");
        expect(Math.abs(inside() - before)).toBeLessThan(1);
      });
    });

    describe("a working reply whose middle text a background sub-agent's reply leaves", () => {
      const fromEnd = (): number => (viewport()?.scrollHeight ?? 0) - (viewport()?.scrollTop ?? 0) - (viewport()?.clientHeight ?? 0);
      const views = (): number => slotOf(11)?.querySelectorAll(".nol-markdown-view").length ?? 0;
      const work = async (conversationId: string): Promise<void> => {
        await reopen(conversationId);
        await until(() => expect(slotOf(10)).not.toBeNull());
        await settle();
        const reply = new Message(`${conversationId}-11`, conversationId, 11, MessageAuthor.Provider, `${conversationId}-10`, MessageStatus.Running, [
          SampleData.detail(0, DetailKind.Text, Array.from({ length: 30 }, (_, index) => `Paragraph ${index}`).join("\n\n")),
          new MessageDetail(1, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t9" }, SampleData.timestamp),
          SampleData.detail(2, DetailKind.Text, "The todo's first line.The notes' first line."),
          new MessageDetail(3, DetailKind.Note, "read_agent", { tool: "read" }, SampleData.timestamp),
          SampleData.detail(4, DetailKind.Text, Array.from({ length: 30 }, (_, index) => `Closing ${index}`).join("\n\n"))],
        SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
        arrived.push(reply);
        context.emit(EventName.MessageCreated, reply.toJson());
        await until(() => expect(slotOf(11)?.textContent).toContain("Closing 29"));
        await settle();
      };
      const cut = async (conversationId: string): Promise<void> => {
        context.emit(EventName.DetailUpdated, new DetailEventPayload(`${conversationId}-11`, SampleData.detail(2, DetailKind.Text, "")).toJson());
        await until(() => expect(slotOf(11)?.textContent).not.toContain("The todo's first line."));
        await settle();
      };

      it("keeps a reader at its end at the end, with no block left for the emptied text", async () => {
        await work("left-cut-end");
        const height = slotOf(11)?.getBoundingClientRect().height ?? Number.NaN;
        expect(fromEnd()).toBeLessThanOrEqual(1);
        expect(views()).toBe(3);

        await cut("left-cut-end");

        expect(fromEnd()).toBeLessThanOrEqual(1);
        expect(views()).toBe(2);
        expect(slotOf(11)?.getBoundingClientRect().height ?? Number.NaN).toBeLessThan(height - 8);
      });

      it("keeps a reader reading above the emptied text where they were", async () => {
        await work("left-cut-above");
        const inside = (): number => (slotOf(11)?.getBoundingClientRect().top ?? Number.NaN) - (viewport()?.getBoundingClientRect().top ?? Number.NaN);
        const view = viewport();
        view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        if (!Object.isNull(view))
          view.scrollTop += inside() + 200;
        await until(() => expect(Math.abs(inside() + 200)).toBeLessThan(1));
        await settle();
        const before = inside();

        await cut("left-cut-above");

        expect(Math.abs(before + 200)).toBeLessThan(1);
        expect(Math.abs(inside() - before)).toBeLessThan(1);
        expect(fromEnd()).toBeGreaterThan(200);
      });
    });
  });

  it("shows the reply a plan in the Plans view asks for from far outside the rendered rows with the kit's flash, then scrolls the least that shows its plan block once the reply is measured", { timeout: 2 * revealLimit }, async () => {
    fixture.componentRef.setInput("chatId", far.id);
    await open(far.id);
    await settle();
    expect(rowOf(399)).not.toBeUndefined();
    const view = viewport() as HTMLElement;
    const slot = (): HTMLElement | null => element().querySelector<HTMLElement>('.nol-virtual-list-slot[data-nol-row="5"]');
    const block = (): DOMRect => slot()?.querySelector("nol-teamrun-plan-card")?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
    const shown = (): void => {
      expect(block().top).toBeGreaterThanOrEqual(view.getBoundingClientRect().top - 0.5);
      expect(block().bottom).toBeLessThanOrEqual(view.getBoundingClientRect().bottom + 0.5);
    };
    expect(slot()).toBeNull();

    const revealed = partRevealed();
    store().showPlan(new MessageFocus(far.id, "far-5", 5, true));
    await Wait.settled(revealed, "The part reveal", { timeout: revealLimit });
    await settle();

    shown();
    expect(Math.abs(block().bottom - view.getBoundingClientRect().bottom)).toBeLessThan(1);
    expect(slot()?.getBoundingClientRect().top).toBeLessThan(view.getBoundingClientRect().top);
    expect(flashing()).toEqual([slot()?.querySelector("nol-message")]);
    expect([store().focus(), store().planFocus()?.messageId]).toEqual([null, "far-5"]);
  });

  it("opens the activity and the row of the sub-agent the Sub-agents view asks for from far outside the rendered rows, then shows the row deep in the reply at the view's bottom edge once the reply is measured", { timeout: 2 * revealLimit }, async () => {
    fixture.componentRef.setInput("chatId", farAgent.id);
    await open(farAgent.id);
    await settle();
    expect(rowOf(399)).not.toBeUndefined();
    const view = viewport() as HTMLElement;
    const slot = (): HTMLElement | null => element().querySelector<HTMLElement>('.nol-virtual-list-slot[data-nol-row="5"]');
    const row = (): Element | null => slot()?.querySelector(`${Resources.subAgentStepSelector}[data-step="61"]`) ?? null;
    const box = (): DOMRect => row()?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
    expect(slot()).toBeNull();

    const revealed = partRevealed();
    store().showSubAgent(new MessageFocus(farAgent.id, "far-agent-5", 5, false, 61));
    await Wait.settled(revealed, "The part reveal", { timeout: revealLimit });
    await settle();

    expect(row()?.querySelector("[aria-expanded='true']")).not.toBeNull();
    expect(box().top).toBeGreaterThanOrEqual(view.getBoundingClientRect().top - 0.5);
    expect(Math.abs(box().bottom - view.getBoundingClientRect().bottom)).toBeLessThan(1);
    expect(slot()?.getBoundingClientRect().top).toBeLessThan(view.getBoundingClientRect().top);
    expect(flashing()).toEqual([slot()?.querySelector("nol-message")]);
    expect([store().focus(), store().subAgentFocus()?.step]).toEqual([null, 61]);
  });

  it("flashes the reply a plan in the Plans view asks for, for the kit's 1.6 s from when it renders, and scrolls the least that shows its plan block, though its page answers after the flash's length", { timeout: 2 * revealLimit }, async () => {
    fixture.componentRef.setInput("chatId", far.id);
    await open(far.id);
    await settle();
    const view = viewport() as HTMLElement;
    const slot = (): HTMLElement | null => element().querySelector<HTMLElement>('.nol-virtual-list-slot[data-nol-row="5"]');
    const block = (): DOMRect => slot()?.querySelector("nol-teamrun-plan-card")?.getBoundingClientRect() ?? new DOMRect(0, Number.NaN);
    let isHeld = true;
    const pages: (() => void)[] = [];
    context.answer(MethodName.MessagePage, parameters => {
      if (!isHeld)
        return pageOf(parameters);
      const page = new DeferredResponse();
      pages.push(() => page.resolve(pageOf(parameters)));
      return page.promise;
    });

    store().showPlan(new MessageFocus(far.id, "far-5", 5, true));
    await until(() => expect(pages.length).toBeGreaterThan(0), { timeout: revealLimit });
    clock.advance(Resources.flashMilliseconds);
    fixture.detectChanges();
    await settle();
    expect([slot()?.querySelector("nol-teamrun-history-message") ?? null, flashing()]).toEqual([null, []]);
    const revealed = partRevealed();
    const rendered = clock.now();
    isHeld = false;
    pages.forEach(t => t());
    await Wait.settled(revealed, "The part reveal", { timeout: revealLimit });
    await settle();

    expect(block().top).toBeGreaterThanOrEqual(view.getBoundingClientRect().top - 0.5);
    expect(Math.abs(block().bottom - view.getBoundingClientRect().bottom)).toBeLessThan(1);
    expect(slot()?.getBoundingClientRect().top).toBeLessThan(view.getBoundingClientRect().top);
    expect([flashing(), flashStartOf(5)]).toEqual([[slot()?.querySelector("nol-message")], rendered]);
    clock.advance(Resources.flashMilliseconds - 1);
    fixture.detectChanges();
    expect(flashing()).toHaveLength(1);
    clock.advance(1);
    fixture.detectChanges();
    expect([flashing(), flashStartOf(5)]).toEqual([[], null]);
  });

  it.each([
    {
      away: "scrolls the list away",
      leave: async (): Promise<void> => {
        const view = viewport() as HTMLElement;
        view.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true }));
        view.scrollTop = view.scrollHeight;
        view.dispatchEvent(new Event("scroll"));
        await settle();
      },
      back: (): Promise<void> => settle()
    },
    {
      away: "opens another chat",
      leave: async (): Promise<void> => {
        fixture.componentRef.setInput("chatId", "c1");
        await settle();
      },
      back: async (): Promise<void> => {
        fixture.componentRef.setInput("chatId", far.id);
        await settle();
      }
    }
  ])("doesn't flash or reveal the part of a far reply the Plans view asked for when the person $away before its page answers, and comes back to it later", { timeout: 2 * revealLimit }, async ({ leave, back }) => {
    fixture.componentRef.setInput("chatId", far.id);
    await open(far.id);
    await settle();
    const slot = (): HTMLElement | null => element().querySelector<HTMLElement>('.nol-virtual-list-slot[data-nol-row="5"]');
    let isHeld = true;
    const pages: (() => void)[] = [];
    context.answer(MethodName.MessagePage, parameters => {
      if (!isHeld)
        return pageOf(parameters);
      const page = new DeferredResponse();
      pages.push(() => page.resolve(pageOf(parameters)));
      return page.promise;
    });
    const parts = vi.spyOn(fixture.componentInstance, "revealPart");

    store().showPlan(new MessageFocus(far.id, "far-5", 5, true));
    await until(() => expect(pages.length).toBeGreaterThan(0), { timeout: revealLimit });
    await leave();
    isHeld = false;
    pages.forEach(t => t());
    await settle();
    await back();
    list().reveal(5, VirtualListAlign.Start);
    await until(() => expect(slot()?.querySelector("nol-teamrun-history-message")).not.toBeNull(), { timeout: revealLimit });
    await settle();

    expect([flashing(), flashStartOf(5), parts.mock.calls.length]).toEqual([[], null, 0]);
  });

  it("shows the first message when the scrollbar is put at the top, reading only the rows there, each read taking two frames", { timeout: 2 * revealLimit }, async () => {
    context.answer(MethodName.MessagePage, async t => {
      await renderedFrame();
      await renderedFrame();
      return pageOf(t);
    });
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    await settle();
    const height = viewport()?.scrollHeight;

    const trace = traceList();
    const view = viewport();
    view?.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    if (!Object.isNull(view))
      view.scrollTop = 0;

    await until(() => expect(earliestShown()).toBe(0), { timeout: revealLimit }).catch((error: unknown) => {
      throw new Error(`${String(error)}\n${trace()}\nEnded with message ${earliestShown()} first shown, the reads ${JSON.stringify(reads())}, the viewport at ${viewport()?.scrollTop} of ${viewport()?.scrollHeight} px.`);
    });
    expect(height).toBeGreaterThan(4_000 * Resources.historyEstimate);
    expect(reads()).toContain(50);
    expect(reads().filter(t => !Object.isNull(t) && t < 4_850).every(t => (t ?? 0) <= 300)).toBe(true);
  });

  it("loads and shows its own conversation once the store has loaded, before and without its being selected", async () => {
    await until(() => expect(store().loaded()).toBe(true));
    await fixture.whenStable();
    fixture.detectChanges();
    await until(() => expect(rowOf(4_999)).toBeDefined());
    await settle();
    expect(store().selectedConversationId()).toBeNull();
    const trace = traceList();

    await open("c2");

    if (Object.isUndefined(rowOf(4_999))) {
      const shown = shownRows();
      const later: string[] = [];
      for (let frame = 1; frame <= 5; frame++) {
        await renderedFrame();
        later.push(`frame ${frame}: ${Object.isUndefined(rowOf(4_999)) ? "missing" : "shown"}`);
      }
      throw new Error(`Row 4,999 wasn't shown right after another conversation was selected.\nRows shown: ${shown}\n${trace()}\nAfterwards: ${later.join(", ")}`);
    }
    expect(rowOf(4_999)).toBeDefined();
    expect(element().textContent).not.toContain("Other 1");
    expect(context.parametersOf(MethodName.MessagePage)).toEqual(new MessagePageParams("c1", null, null, 50).toJson());
  });

  it("follows its own conversation's streaming reply and reads its own history while another tab's conversation is selected", async () => {
    store().rememberPosition("c1", new ReadingPosition("m4900", 4_900, 0));
    await open("c1");
    await until(() => expectAtTop(4_900));

    await open("c2");
    await settle();
    expect(store().history()?.length()).toBe(3);
    expectAtTop(4_900);
    expect(element().querySelector("[role=feed]")?.getAttribute("aria-busy")).toBe("false");
    const remembered = vi.spyOn(store(), "rememberPosition");
    const elsewhere = new MessageFocus("c2", "n1", 1);
    list().positionChange.emit(new VirtualListPosition(4_803, "m4803", 0));
    store().focusMessage(elsewhere);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(remembered).toHaveBeenLastCalledWith("c1", new ReadingPosition("m4803", 4_803, 0));
    expect(store().focus()).toBe(elsewhere);
    expect(element().textContent).not.toContain("Other 1");

    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null);
    context.emit(EventName.MessageCreated, reply.toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m5000", SampleData.detail(0, DetailKind.Text, "Message 5000 streams in")).toJson());
    list().reveal(5_000, VirtualListAlign.Start);
    await until(() => expect(element().textContent).toContain("Message 5000 streams in"));
    expect(element().querySelector("[role=feed]")?.getAttribute("aria-busy")).toBe("true");
    expect(store().selectedConversationId()).toBe("c2");
    expect(store().history()?.length()).toBe(3);

    await open("c1");
    expect(store().history()?.length()).toBe(5_001);
  });

  it("shows both conversations side by side after a restart, though only one is selected", async () => {
    const beside = TestBed.createComponent(HistoryComponent);
    beside.componentRef.setInput("chatId", "c2");
    (beside.nativeElement as HTMLElement).style.height = "600px";
    beside.detectChanges();

    await open("c2");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    await until(() => {
      beside.detectChanges();
      expect((beside.nativeElement as HTMLElement).textContent).toContain("Other 1");
    });

    expect(store().selectedConversationId()).toBe("c2");
    expect(element().textContent).not.toContain("Other 1");
    beside.destroy();
  });

  it("lets its window go when it closes, unless the selection holds it", async () => {
    await open("c2");
    await until(() => expect(store().isHistoryLoaded("c1")).toBe(true));

    fixture.destroy();

    expect(store().isHistoryLoaded("c1")).toBe(false);
    expect(store().historyOf("c1")).toBeNull();
    expect(store().history()?.length()).toBe(3);
  });

  it("follows new and changed messages, and marks the feed busy while a reply works", async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Running, [SampleData.detail(0, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);

    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    expect(element().querySelector("[role=feed]")?.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps a working reply's end at the view's bottom in every painted frame and as each batch grows it, six frames (100 ms) apart, its height never shrinking and its top never sliding back down past a pixel", { timeout: 2 * revealLimit }, async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const text = ["Message 5000", ...Array.from({ length: 40 }, (_, index) => `Line ${index} of a working reply, long enough to wrap once the view is narrow.`)].join("\n\n");
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Running, [SampleData.detail(0, DetailKind.Text, text.slice(0, 80))],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    await settle();
    const view = viewport();
    if (!(view instanceof HTMLElement))
      throw new Error("The history shows no view.");
    const row = (): HTMLElement => {
      const found = rowOf(5_000);
      if (found === undefined)
        throw new Error("The history shows no row for the working reply.");
      return found;
    };
    const [gaps, tops, heights, scrolls, moments]: [number[], number[], [number, number][], [number, number][], string[]] = [[], [], [], [], []];
    let [resizes, shown] = [0, 0];
    const measure = (moment: string): void => {
      const box = row().getBoundingClientRect();
      gaps.push(view.scrollHeight - view.scrollTop - view.clientHeight);
      tops.push(box.top - view.getBoundingClientRect().top);
      heights.push([box.height, view.clientHeight]);
      scrolls.push([view.scrollTop, view.scrollHeight]);
      moments.push(`${moment} at ${shown} characters`);
    };
    const sizes = new ResizeObserver(() => {
      resizes++;
      measure("a resize");
    });
    sizes.observe(row());

    try {
      for (let length = 400; length < text.length + 400; length += 400) {
        shown = Math.min(length, text.length);
        context.emit(EventName.DetailUpdated, new DetailEventPayload("m5000", SampleData.detail(0, DetailKind.Text, text.slice(0, length))).toJson());
        for (let frame = 0; frame < 6; frame++) {
          await renderedFrame();
          measure(`frame ${frame + 1}`);
        }
      }
      await until(() => expect(row().textContent).toContain(text.slice(text.lastIndexOf("\n") + 1)), { timeout: revealLimit });
      await settle();
    }
    finally {
      sizes.disconnect();
    }

    expect(resizes).toBeGreaterThan(3);
    expect(gaps.flatMap((g, index) => g > 1
      ? [`sample ${index} of ${gaps.length}, ${moments[index]}: ${g} px from the end, scroll top and height ${scrolls[index]?.join(" and ")}, reply and view heights ${heights[index]?.join(" and ")}`]
      : []).slice(0, 12)).toEqual([]);
    expect(heights.flatMap((h, index) => index > 0 && (h[0] < (heights[index - 1]?.[0] ?? 0) || h[1] < (heights[index - 1]?.[1] ?? 0))
      ? [`sample ${index} of ${heights.length}: reply and view heights ${heights[index - 1]?.join(" and ")} to ${h.join(" and ")}`]
      : [])).toEqual([]);
    expect(tops.flatMap((t, index) => index > 0 && t > (tops[index - 1] ?? 0) + 1
      ? [`sample ${index} of ${tops.length}: top ${tops[index - 1]} to ${t}, reply and view heights ${heights[index - 1]?.join(" and ")} to ${heights[index]?.join(" and ")}`]
      : []), "the reply's height is fractional, so the scroll position settles up to 1 px on either side of the view's end").toEqual([]);
  });

  it("keeps the top of the feed's last reply where it was when the reader opens its activity, and the reply grows downward", async () => {
    vi.spyOn(Date, "now").mockReturnValue(clock.now());
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t9" }, SampleData.timestamp), SampleData.detail(1, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    await settle();
    const top = offsetOf(5_000)!;
    const height = rowOf(5_000)!.getBoundingClientRect().height;

    rowOf(5_000)!.querySelector<HTMLElement>(".activity-toggle")!.click();
    await settle();

    expect(rowOf(5_000)!.querySelector(".activity-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(rowOf(5_000)!.getBoundingClientRect().height).toBeGreaterThan(height + 8);
    expect(Math.abs(offsetOf(5_000)! - top)).toBeLessThan(1);
  });

  it("keeps the top of the feed's last reply where it was when the reader opens a file's diff from its expand button, and the reply grows downward", async () => {
    vi.spyOn(Date, "now").mockReturnValue(clock.now());
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const edit = { tool: "Edit", input: { file_path: "/srv/repo/a.ts", old_string: "one\ntwo", new_string: "three\nfour" } };
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.FileChange, "Edit: /srv/repo/a.ts", edit, SampleData.timestamp), SampleData.detail(1, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)?.querySelector("nol-teamrun-edited-files")).not.toBeNull());
    await settle();
    const top = offsetOf(5_000)!;
    const height = rowOf(5_000)!.getBoundingClientRect().height;
    const expand = rowOf(5_000)!.querySelector<HTMLButtonElement>("nol-teamrun-edited-files button[aria-label=\"Expand diff\"]")!;

    expand.click();
    await settle();

    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(rowOf(5_000)!.querySelector("nol-teamrun-edited-files .diff")).not.toBeNull();
    expect(rowOf(5_000)!.getBoundingClientRect().height).toBeGreaterThan(height + 8);
    expect(Math.abs(offsetOf(5_000)! - top)).toBeLessThan(1);
  });

  it("reveals the message the store focuses, such as a search hit, flashes it on its own shape for 1.6 s from the time it was found, and clears the focus", { timeout: 2 * revealLimit }, async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());

    const trace = traceList();
    const found = clock.now();
    await store().showMessage(new ConversationSearchHit("c1", "p1", "First", "m4000", "Message 4000", SampleData.timestamp, 4_000));
    await until(() => expectAtTop(4_000), { timeout: revealLimit }).catch((error: unknown) => {
      throw new Error(`${String(error)}\n${trace()}\nEnded with the hit at ${offsetOf(4_000)} px, the viewport at ${viewport()?.scrollTop} of ${viewport()?.scrollHeight} px.`);
    });
    expect(store().focus()).toBeNull();
    const hit = rowOf(4_000)?.querySelector("nol-message");
    expect([flashing(), flashStartOf(4_000)]).toEqual([[hit], found]);

    clock.advance(Resources.flashMilliseconds - 1);
    fixture.detectChanges();
    expect([flashing(), flashStartOf(4_000)]).toEqual([[hit], found]);
    clock.advance(1);
    fixture.detectChanges();
    expect([flashing(), flashStartOf(4_000)]).toEqual([[], null]);
  });

  it("keeps a revealed message at the top when the rows just above it arrive after it has shown, and their measures move it up", { timeout: 2 * revealLimit }, async () => {
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    const pages = new Map<number | null, () => void>();
    context.answer(MethodName.MessagePage, parameters => {
      const page = new DeferredResponse();
      pages.set(MessagePageParams.fromJson(parameters).beforeSequence, () => page.resolve(pageOf(parameters)));
      return page.promise;
    });
    const release = (before: number): void => pages.get(before)?.();

    const trace = traceList();
    await store().showMessage(new ConversationSearchHit("c1", "p1", "First", "m4000", "Message 4000", SampleData.timestamp, 4_000));
    await until(() => expect([...pages.keys()]).toEqual(expect.arrayContaining([3_950, 4_000, 4_050, 4_100])), { timeout: revealLimit });
    for (const before of [4_050, 4_100, 3_950])
      release(before);
    await until(() => expect(rowOf(4_000)).toBeDefined(), { timeout: revealLimit });
    await settle();
    expect(rowOf(3_999)).toBeUndefined();
    const placed = viewport()?.scrollTop ?? Number.NaN;
    release(4_000);
    await until(() => expect(rowOf(3_999)).toBeDefined(), { timeout: revealLimit });
    await settle();

    await until(() => expectAtTop(4_000), { timeout: revealLimit }).catch((error: unknown) => {
      throw new Error(`${String(error)}\n${trace()}\nEnded with the hit at ${offsetOf(4_000)} px, the viewport at ${viewport()?.scrollTop} of ${viewport()?.scrollHeight} px.`);
    });
    expect(Math.abs((viewport()?.scrollTop ?? Number.NaN) - placed)).toBeGreaterThanOrEqual(1);
  });

  it("goes on with a found message's flash from the time it was found when it comes back mid-flash, and doesn't flash it again after the flash's time", { timeout: 3 * revealLimit }, async () => {
    const find = async (): Promise<void> => {
      await store().showMessage(new ConversationSearchHit("c1", "p1", "First", "m4000", "Message 4000", SampleData.timestamp, 4_000));
      await until(() => expectAtTop(4_000), { timeout: revealLimit });
      await settle();
      expect(flashing()).toHaveLength(1);
    };
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());

    const found = clock.now();
    await find();
    list().reveal(4_030, VirtualListAlign.Start);
    await until(() => expect(rowOf(4_000)).toBeUndefined(), { timeout: revealLimit });
    clock.advance(800);
    list().reveal(4_000, VirtualListAlign.Start);
    await until(() => expectAtTop(4_000), { timeout: revealLimit });
    await settle();
    expect([flashing(), flashStartOf(4_000)]).toEqual([[rowOf(4_000)?.querySelector("nol-message")], found]);
    clock.advance(Resources.flashMilliseconds - 800);
    fixture.detectChanges();
    expect(flashing()).toEqual([]);

    await find();
    list().reveal(4_030, VirtualListAlign.Start);
    await until(() => expect(rowOf(4_000)).toBeUndefined(), { timeout: revealLimit });
    clock.advance(Resources.flashMilliseconds);
    list().reveal(4_000, VirtualListAlign.Start);
    await until(() => expectAtTop(4_000), { timeout: revealLimit });
    await settle();
    expect(flashing()).toEqual([]);

    await find();
    element().style.display = "none";
    await settle();
    clock.advance(Resources.flashMilliseconds);
    element().style.display = String.empty;
    await settle();
    expect(rowOf(4_000)).toBeDefined();
    expect(flashing()).toEqual([]);
  });

  it("keeps a pending question's pick and typed text while its row is off the screen, and forgets them once the question closes while it's away", { timeout: 3 * revealLimit }, async () => {
    const asking = new Approval("q1", "m5000", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null, [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false),
        new ApprovalQuestion("name", "Name", "Which name?", [], false, true, false)]);
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.AwaitingApproval, [SampleData.detail(0, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    const card = (): Element | null => rowOf(5_000)?.querySelector("nol-teamrun-question-card") ?? null;
    const field = (selector: string): HTMLInputElement => {
      const found = card()?.querySelector<HTMLInputElement>(selector);
      if (Object.isNullOrUndefined(found))
        throw new Error(`The question card has no ${selector}.`);
      return found;
    };
    const draft = (): unknown => store().messageIndex().find(t => t.id === "m5000")?.controls?.draftOf("q1") ?? null;
    const away = async (): Promise<void> => {
      list().reveal(4_920, VirtualListAlign.Start);
      await until(() => expect(rowOf(5_000)).toBeUndefined(), { timeout: revealLimit });
      expect(rowOf(4_920)).toBeDefined();
      expect(element().querySelectorAll("nol-teamrun-question-card")).toHaveLength(0);
    };
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    arrived.push(reply);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    context.emit(EventName.ApprovalCreated, asking.toJson());
    await until(() => expect(card()).not.toBeNull());

    field(".nol-choice-row input").click();
    Object.assign(field(".nol-teamrun-question-other"), { value: "Atlas" }).dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect([field(".nol-choice-row input").checked, field(".nol-teamrun-question-other").value]).toEqual([true, "Atlas"]);
    await away();
    expect(draft()).not.toBeNull();
    list().reveal(5_000, VirtualListAlign.Start);
    await until(() => expect(card()).not.toBeNull(), { timeout: revealLimit });
    await settle();
    expect([field(".nol-choice-row input").checked, field(".nol-teamrun-question-other").value]).toEqual([true, "Atlas"]);

    await away();
    expect(draft()).not.toBeNull();
    context.emit(EventName.ApprovalUpdated, asking.withCancellation(SampleData.timestamp).toJson());
    await fixture.whenStable();
    expect(draft()).toBeNull();
  });

  it("keeps a pending question's pick and typed text through a far jump and back, and forgets them once the question closes while it's far away", { timeout: 3 * revealLimit }, async () => {
    const asking = new Approval("q1", "m5000", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null, [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false),
        new ApprovalQuestion("name", "Name", "Which name?", [], false, true, false)]);
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.AwaitingApproval, [SampleData.detail(0, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    const card = (): Element | null => rowOf(5_000)?.querySelector("nol-teamrun-question-card") ?? null;
    const field = (selector: string): HTMLInputElement => {
      const found = card()?.querySelector<HTMLInputElement>(selector);
      if (Object.isNullOrUndefined(found))
        throw new Error(`The question card has no ${selector}.`);
      return found;
    };
    const draft = (): unknown => store().messageControlsOf("c1", "m5000")?.draftOf("q1") ?? null;
    const farAway = async (): Promise<void> => {
      list().reveal(4_000, VirtualListAlign.Start);
      await until(() => expect(rowOf(4_000)).toBeDefined(), { timeout: revealLimit });
      await until(() => expect([store().messageIndex().some(t => t.id === "m5000"), rowOf(5_000)]).toEqual([false, undefined]), { timeout: revealLimit });
    };
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    arrived.push(reply);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    context.emit(EventName.ApprovalCreated, asking.toJson());
    await until(() => expect(card()).not.toBeNull());

    field(".nol-choice-row input").click();
    Object.assign(field(".nol-teamrun-question-other"), { value: "Atlas" }).dispatchEvent(new Event("input"));
    await fixture.whenStable();
    await farAway();
    expect(draft()).not.toBeNull();
    list().reveal(5_000, VirtualListAlign.Start);
    await until(() => expect(card()).not.toBeNull(), { timeout: revealLimit });
    await settle();
    expect([field(".nol-choice-row input").checked, field(".nol-teamrun-question-other").value]).toEqual([true, "Atlas"]);

    await farAway();
    expect(draft()).not.toBeNull();
    context.emit(EventName.ApprovalUpdated, asking.withCancellation(SampleData.timestamp).toJson());
    await fixture.whenStable();
    expect(draft()).toBeNull();
  });

  it("keeps the pick and typed text of a question that arrives after a far jump and back, through the next far jump and back", { timeout: 4 * revealLimit }, async () => {
    const asking = new Approval("q1", "m5000", ApprovalKind.Question, "AskUserQuestion", "Which platform?", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null, [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false),
        new ApprovalQuestion("name", "Name", "Which name?", [], false, true, false)]);
    const reply = new Message("m5000", "c1", 5_000, MessageAuthor.Provider, "m4999", MessageStatus.AwaitingApproval, [SampleData.detail(0, DetailKind.Text, "Message 5000")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    const card = (): Element | null => rowOf(5_000)?.querySelector("nol-teamrun-question-card") ?? null;
    const field = (selector: string): HTMLInputElement => {
      const found = card()?.querySelector<HTMLInputElement>(selector);
      if (Object.isNullOrUndefined(found))
        throw new Error(`The question card has no ${selector}.`);
      return found;
    };
    const farAway = async (): Promise<void> => {
      list().reveal(4_000, VirtualListAlign.Start);
      await until(() => expect(rowOf(4_000)).toBeDefined(), { timeout: revealLimit });
      await until(() => expect([store().messageIndex().some(t => t.id === "m4999"), rowOf(4_999)]).toEqual([false, undefined]), { timeout: revealLimit });
    };
    await open("c1");
    await until(() => expect(rowOf(4_999)).toBeDefined());
    await farAway();
    list().reveal(4_999, VirtualListAlign.Start);
    await until(() => expect(rowOf(4_999)).toBeDefined(), { timeout: revealLimit });
    const indexed = store().messageIndex().some(t => t.id === "m4999");
    arrived.push(reply);
    context.emit(EventName.MessageCreated, reply.toJson());
    await until(() => expect(rowOf(5_000)).toBeDefined());
    context.emit(EventName.ApprovalCreated, asking.toJson());
    await until(() => expect(card()).not.toBeNull());

    field(".nol-choice-row input").click();
    Object.assign(field(".nol-teamrun-question-other"), { value: "Atlas" }).dispatchEvent(new Event("input"));
    await fixture.whenStable();
    await farAway();
    list().reveal(5_000, VirtualListAlign.Start);
    await until(() => expect(card()).not.toBeNull(), { timeout: revealLimit });
    await settle();

    expect([indexed, field(".nol-choice-row input").checked, field(".nol-teamrun-question-other").value]).toEqual([false, true, "Atlas"]);
  });

  it("asks for the first message in the messages' column, its first 18px line 2rem down, while its conversation has none, and shows the first that comes", async () => {
    fixture.componentRef.setInput("chatId", "c3");
    await open("c3");
    const text = element().querySelector<HTMLElement>(".empty");
    const host = element().getBoundingClientRect();
    const side = Math.max(AppearanceFixture.measureLook("space-4") * 2, (host.width - 55 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)) / 2);

    expect(text?.textContent?.trim()).toBe(Resources.emptyHistoryText);
    expect(element().querySelector("nol-virtual-list")).toBeNull();
    AppearanceFixture.expectPixels((text?.getBoundingClientRect().left ?? Number.NaN) - host.left, side);
    AppearanceFixture.expectPixels(host.right - (text?.getBoundingClientRect().right ?? Number.NaN), side);
    AppearanceFixture.expectPixels((text?.getBoundingClientRect().top ?? Number.NaN) + Number.parseFloat(getComputedStyle(text!).paddingTop) - host.top,
      AppearanceFixture.measureLook("space-2") + AppearanceFixture.measureLook("space-6"));
    AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(text!).lineHeight), 18);

    context.emit(EventName.MessageCreated, new Message("e0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Message 0")],
      null, SampleData.timestamp, null, SampleData.timestamp).toJson());
    await until(() => expect(rowOf(0)).toBeDefined());
    expect(element().querySelector(".empty")).toBeNull();
  });

  it("shows an image Codex generated in a reply saved before, from the copy TeamRun stored, reading only that copy and sending nothing", { timeout: 2 * revealLimit }, async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 32;
    const url = canvas.toDataURL("image/png");
    const stored = "D:\\TeamRun\\images\\r1-0.png";
    const saved = "C:\\Users\\owner\\.codex\\generated_images\\astra.png";
    const reply = new Message("r1", "c3", 1, MessageAuthor.Provider, "q0", MessageStatus.Completed, [new MessageDetail(0, DetailKind.Note, `Generated image (completed): ${saved}`,
      { itemType: "imageGeneration", status: "completed", savedPath: saved, revisedPrompt: "Astra", failure: null, imageData: null, mediaType: "image/png", storedPath: stored },
      SampleData.timestamp)], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    const question = new Message("q0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Draw Astra.")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c3" ? new MessagePage([question, reply], false, false, 2).toJson() : pageOf(t))
      .answer(MethodName.WrittenImageRead, () => new AttachmentContent("r1-0.png", "image/png", 4, url.slice(url.indexOf(",") + 1)).toJson());

    fixture.componentRef.setInput("chatId", "c3");
    await open("c3");
    expect((await Wait.settled(decodedImage(element), "The image's decode", { timeout: revealLimit })).naturalWidth).toBe(48);

    expect(element().querySelector(".nol-teamrun-image-frame")?.getAttribute("aria-label")).toBe("astra.png");
    expect(context.parametersOf(MethodName.WrittenImageRead)).toEqual(new WrittenImageReadParams("c3", "r1", stored).toJson());
    expect(context.count(MethodName.WrittenImageRead)).toBe(1);
    expect(context.count(MethodName.MessageSend)).toBe(0);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const replyOf = (text: string): HTMLElement | undefined =>
      [...element().querySelectorAll<HTMLElement>("nol-teamrun-history-message")].find(t => t.querySelector(".nol-markdown-view")?.textContent?.trim() === text);
    const bounds = (row: HTMLElement | undefined): DOMRect => row?.querySelector("nol-message")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
    const contentTop = (row: HTMLElement | undefined): number => row?.querySelector(".nol-message-main")?.getBoundingClientRect().top ?? Number.NaN;
    const textBottom = (row: HTMLElement | undefined): number => row?.querySelector(".nol-message-content")?.getBoundingClientRect().bottom ?? Number.NaN;

    beforeEach(async () => {
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      await EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors);
    });

    afterEach(async () => {
      await EmulatedMediaFixture.resetAsync();
    });

    it("offers Open a folder under an empty chat's text while no folder is open, on the text's start edge, and drops it once one opens", async () => {
      context.answer(MethodName.ProjectForget, () => null).answer(MethodName.ProjectOpen, () => SampleData.project.toJson());
      context.chosenFolder = SampleData.project.rootPath;
      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      const button = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>(".nol-teamrun-history-open-folder");
      expect(button()).toBeNull();

      await store().forgetProject(SampleData.project.id);
      await until(() => expect(button()).not.toBeNull());
      const text = element().querySelector(".nol-teamrun-history-empty-text")!.getBoundingClientRect();
      const shown = button()!.getBoundingClientRect();
      const empty = element().querySelector(".empty")!.getBoundingClientRect();

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(button()?.textContent?.trim()).toBe(Resources.openFolderLabel);
      AppearanceFixture.expectPixels(shown.left, text.left);
      AppearanceFixture.expectPixels(shown.top - text.bottom, AppearanceFixture.measureLook("space-4"));
      expect([shown.width > 0, shown.right <= empty.right + 0.5, element().scrollWidth <= element().clientWidth]).toEqual([true, true, true]);
      const own = new Conversation("c3", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c3");
      context.answer(MethodName.ChatFolderAttach, t => own.withAttachedFolder(ChatFolderAttachParams.fromJson(t).folder, SampleData.timestamp).toJson())
        .answer(MethodName.ChatFolderDetach, () => own.toJson());
      await store().attachFolder("c3", "/work/site");
      await until(() => expect(button()).toBeNull());
      expect(element().querySelector(".nol-teamrun-history-empty-text")?.textContent?.trim()).toBe(Resources.emptyHistoryText);
      await store().detachFolder("c3");
      await until(() => expect(button()).not.toBeNull());

      button()!.click();
      await until(() => expect(context.parametersOf(MethodName.ProjectOpen)).toEqual({ rootPath: SampleData.project.rootPath }));
      await until(() => expect(button()).toBeNull());
      expect(element().querySelector(".nol-teamrun-history-empty-text")?.textContent?.trim()).toBe(Resources.emptyHistoryText);
    });

    it("puts the note that a hand-off chain stopped in its own row after the reply, outside its bounds, with the gap between two replies' texts above and below it", async () => {
      fixture.componentRef.setInput("chatId", "c4");
      await open("c4");
      await until(() => expect(replyOf("Done.")).toBeDefined());
      await settle();
      const [first, middle, last] = ["@Bob yours", "@Carol yours", "Done."].map(replyOf);
      const note = first?.querySelector(".hand-off-note")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const between = contentTop(last) - textBottom(middle);

      expect(first?.querySelector("nol-message .hand-off-note")).toBeNull();
      expect(note.top).toBeGreaterThanOrEqual(bounds(first).bottom);
      AppearanceFixture.expectPixels(note.top - textBottom(first), between);
      AppearanceFixture.expectPixels(contentTop(middle) - note.bottom, between);
      AppearanceFixture.expectPixels(note.left, first?.querySelector(".nol-markdown-view")?.getBoundingClientRect().left ?? Number.NaN);
    });

    it("draws a reply that ran no turn at a usage limit as one muted line with its glyph in place of the reply, on the reply column's edges", async () => {
      const at = SampleData.timestamp;
      const handedOff = "Bob handed off to Rita: out of usage";
      const noOneLeft = "Bob is out of usage, and no teammate it hands off to has usage left. Nothing more runs until you send again.";
      const usageReply = (id: string, sequence: number, text: string, handsOff: boolean): Message => new Message(id, "c3", sequence, MessageAuthor.Provider, "q0",
        MessageStatus.Completed, [new MessageDetail(0, DetailKind.Note, text, { source: "usageHandOff", handedOff: handsOff }, at)], SampleData.provenance, at, at, at);
      const messages = [new Message("q0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Add a retry.")], null, at, null, at),
        usageReply("r1", 1, handedOff, true),
        new Message("r2", "c3", 2, MessageAuthor.Provider, "q0", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Capped it.")], SampleData.provenance, at, at, at),
        usageReply("r3", 3, noOneLeft, false)];
      context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c3" ? new MessagePage(messages, false, false, 4).toJson() : pageOf(t));
      const lines = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-usage-hand-off-line")];
      const rectOf = (line: HTMLElement, part: string): DOMRect => line.querySelector(`.nol-teamrun-usage-hand-off-${part}`)?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);

      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      await until(() => expect([lines().length, replyOf("Capped it.")]).toEqual([2, expect.anything()]));
      await settle();
      const reply = bounds(replyOf("Capped it."));
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = "CanvasText";
      const muted = forcedColors === "active" ? getComputedStyle(probe).color : AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted");
      probe.remove();

      expect(lines().map(t => [t.querySelector("[role='note'] > .nol-teamrun-usage-hand-off-glyph")?.textContent?.trim(),
        t.querySelector("[role='note'] > .nol-teamrun-usage-hand-off-text")?.textContent?.trim()]))
        .toEqual([[Resources.usageHandedOffGlyph, handedOff], [Resources.usageStoppedGlyph, noOneLeft]]);
      expect(element().querySelectorAll("nol-teamrun-history-message").length).toBe(2);
      for (const line of lines()) {
        const glyph = rectOf(line, "glyph");
        const text = rectOf(line, "text");
        const shown = line.querySelector<HTMLElement>(".nol-teamrun-usage-hand-off-text") ?? line;
        const style = getComputedStyle(shown);
        expect(document.getElementById(line.closest("[role='article']")?.getAttribute("aria-labelledby") ?? "")).toBe(shown);
        AppearanceFixture.expectPixels(glyph.left, reply.left);
        AppearanceFixture.expectPixels(glyph.width, AppearanceFixture.measureLook("icon"));
        AppearanceFixture.expectPixels(text.left - glyph.right, AppearanceFixture.measureLook("space-2"));
        AppearanceFixture.expectPixels(text.top, glyph.top);
        AppearanceFixture.expectPixels(Number.parseFloat(style.fontSize), AppearanceFixture.measureLook("text-label"));
        AppearanceFixture.expectPixels(Number.parseFloat(style.lineHeight), AppearanceFixture.measureLook("line-label"));
        expect(text.right).toBeLessThanOrEqual(reply.right + 0.5);
        expect([style.color, getComputedStyle(line.querySelector(".nol-teamrun-usage-hand-off-glyph") ?? line).color]).toEqual([muted, muted]);
      }
    });

    it("draws a chat's wake as one closed row at the top of the reply it started, hiding the wake's own message, and one that started no turn as the row alone, on the reply column's edges", async () => {
      const at = SampleData.timestamp;
      const agent = "The work you sent to chat \"Second\" (c2) has ended.\n\n@Bob replied (message n9):\nDone.\n\nRead a message whole with `teamrun_list_messages`.";
      const view = { wakeChatId: "c2", wakeReplies: [{ name: "Bob", status: MessageStatus.Completed, text: "Done." }] };
      const wake = (id: string, sequence: number, reply: string | null): Message => new Message(id, "c3", sequence, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, agent, { source: "chatWake", wakeId: `${id}-wake`, wakeSourceMessageId: "q0", ...view, ...Object.isNull(reply) ? {} : { wakeReplyId: reply } }, at)],
        null, at, null, at, [], null, null, [], new MessageSender("c2", "bob", "Bob"));
      const messages = [new Message("q0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Ask Bob.")], null, at, null, at),
        wake("w1", 1, "r2"),
        new Message("r2", "c3", 2, MessageAuthor.Provider, "w1", MessageStatus.Completed, [new MessageDetail(0, DetailKind.Note, `Received a message from "Second".`,
          { source: "wakeReceived", ...view }, at), SampleData.detail(1, DetailKind.Text, "Thanks, Bob.")], SampleData.provenance, at, at, at),
        wake("w3", 3, null)];
      context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c3" ? new MessagePage(messages, false, false, 4).toJson() : pageOf(t));
      const lines = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-wake-line")];

      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      await until(() => expect([lines().length, replyOf("Thanks, Bob.")]).toEqual([2, expect.anything()]));
      await settle();
      const [inside, alone] = lines();
      const reply = bounds(replyOf("Thanks, Bob."));

      expect(element().querySelectorAll("nol-teamrun-history-message").length).toBe(2);
      expect(replyOf("Thanks, Bob.")?.contains(inside ?? null)).toBe(true);
      expect(alone?.closest("nol-teamrun-history-message")).toBeNull();
      expect(element().textContent).not.toMatch(/has ended|teamrun_list_messages|\(c2\)|n9/);
      for (const line of [inside, alone])
        expect([line?.querySelector(".wake-toggle")?.textContent?.trim(), line?.querySelector(".wake-chat")?.textContent?.trim()]).toEqual(["Received a message from", "Second"]);
      const row = alone?.querySelector(".wake-line")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      expect(document.getElementById(alone?.closest("[role='article']")?.getAttribute("aria-labelledby") ?? "")).toBe(alone?.querySelector(".wake-line"));
      AppearanceFixture.expectPixels(row.left, reply.left);
      AppearanceFixture.expectPixels(row.height, AppearanceFixture.measureLook("pointer-target"));
      expect(row.right).toBeLessThanOrEqual(reply.right + 0.5);
    });

    it("draws a wake that started no turn as its row with the wake's note below it, a lost or deleted chat's wake as no reply coming back, and an old wake from its sender's chat or as its own chat's task, never with an ID", async () => {
      const at = SampleData.timestamp;
      const view = { wakeChatId: "c2", wakeReplies: [{ name: "Bob", status: MessageStatus.Completed, text: "Done." }] };
      const ended = (end: string, chatId: string): JsonObject => ({ wakeChatId: chatId, wakeReplies: [], wakeEnd: end });
      const wake = (id: string, sequence: number, text: string, payload: JsonObject, notes: readonly string[], senderChat: string = "c2"): Message =>
        new Message(id, "c3", sequence, MessageAuthor.User, null, MessageStatus.Completed,
          [new MessageDetail(0, DetailKind.Text, text, { source: "chatWake", wakeId: `${id}-wake`, wakeSourceMessageId: "q0", ...payload }, at),
            ...notes.map((t, i) => new MessageDetail(i + 1, DetailKind.Note, t, null, at))], null, at, null, at, [], null, null, [], new MessageSender(senderChat, "bob", "Bob"));
      const notWoken = "This chat wasn't woken: the teammate that asked for it is no longer in this chat.";
      const stopped = "The chain stopped after 2 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.";
      const messages = [new Message("q0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Ask Bob.")], null, at, null, at),
        wake("w1", 1, "The work you sent to chat \"Second\" (c2) has ended.", view, [notWoken]),
        wake("w2", 2, "The work you sent to chat \"Second\" (c2) has ended.", view, [stopped]),
        wake("w3", 3, "TeamRun restarted before the work you sent to chat \"Second\" (c2) ended.", ended("lost", "c2"), []),
        wake("w4", 4, "The chat gone-chat that you sent work to was deleted.", ended("chatDeleted", "gone-chat"), [], "gone-chat"),
        wake("w5", 5, "@Bob replied (message n9): Done. Read a message whole with `teamrun_list_messages`.", {}, []),
        wake("w6", 6, "Your sub-agent \"Search\" (agent-1) ended as completed.", {}, [], "c3")];
      context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c3" ? new MessagePage(messages, false, false, 7).toJson() : pageOf(t));
      const lines = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-wake-line")];
      const textOf = (line: HTMLElement | undefined, selector: string): readonly string[] =>
        [...line?.querySelectorAll(selector) ?? []].map(t => t.textContent?.trim() ?? "");

      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      await until(() => expect(lines().length).toBe(6));
      await settle();
      const [lost, deleted] = [lines()[2], lines()[3]];
      for (const line of [lost, deleted])
        line?.querySelector<HTMLButtonElement>(".wake-toggle")?.click();
      await settle();

      expect(lines().map(t => [...textOf(t, ".wake-toggle, .wake-label"), ...textOf(t, ".wake-chat, .wake-chat-gone")])).toEqual([
        ["Received a message from", "Second"], ["Received a message from", "Second"], ["No reply came back from", "Second"],
        ["No reply came back from", "a deleted chat"], ["Received a message from", "Second"], ["A sub-agent or background command of this chat ended"]]);
      expect(lines().map(t => textOf(t, ".wake-note"))).toEqual([[notWoken], [stopped], [], [], [], []]);
      expect([lost, deleted].map(t => textOf(t, ".wake-replies"))).toEqual([["TeamRun restarted before the work sent there ended."],
        ["The chat was deleted before the work sent there ended."]]);
      expect([4, 5].flatMap(t => [lines()[t]?.querySelector(".wake-toggle"), lines()[t]?.querySelector(".wake-chevron")])).toEqual([null, null, null, null]);
      expect(element().querySelectorAll("nol-teamrun-history-message").length).toBe(1);
      expect(element().textContent).not.toMatch(/has ended|restarted before the work you sent|teamrun_list_messages|\(c2\)|n9|gone-chat|w\d-wake|agent-1/);
      const row = lines()[0]?.querySelector(".wake-line")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const note = lines()[0]?.querySelector(".wake-note")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      AppearanceFixture.expectPixels(note.left, row.left);
      expect(note.top).toBeGreaterThanOrEqual(row.bottom - 0.5);
    });

    it("draws a sub-agent's or command's wake as a closed row naming it and how it ended, opening to its result or why none came, never with an ID", async () => {
      const at = SampleData.timestamp;
      const task = (kind: string, name: string, ending: string | null, text: string | null): JsonObject => ({ kind, name, ending, text });
      const wake = (id: string, sequence: number, text: string, wakeTask: JsonObject, end: string | null = null): Message =>
        new Message(id, "c3", sequence, MessageAuthor.User, null, MessageStatus.Completed,
          [new MessageDetail(0, DetailKind.Text, text, { source: "chatWake", wakeId: `${id}-wake`, wakeTask, ...Object.isNull(end) ? {} : { wakeEnd: end } }, at)],
          null, at, null, at, [], null, null, [], new MessageSender("c3", null, "TeamRun"));
      const messages = [new Message("q0", "c3", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Run them.")], null, at, null, at),
        wake("w1", 1, "Your sub-agent \"Search\" (agent-1) ended as completed:\n> Found 3 files.", task("subAgent", "Search", "ended as completed", "Found 3 files.")),
        wake("w2", 2, "Your background command \"Run the tests\" (bg-7) exited with code 1.", task("command", "Run the tests", "exited with code 1", "1 failed\n2 passed")),
        wake("w3", 3, "TeamRun restarted before your background command \"Build\" (bg-8) ended.", task("command", "Build", null, null), "lost"),
        wake("w4", 4, "TeamRun restarted before your sub-agent \"Plan\" (agent-2) ended.", task("subAgent", "Plan", null, null), "lost"),
        wake("w5", 5, "Your sub-agent \"Quiet\" (agent-3) ended as failed.", task("subAgent", "Quiet", "ended as failed", null))];
      context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c3" ? new MessagePage(messages, false, false, 6).toJson() : pageOf(t));
      const lines = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-teamrun-wake-line")];
      const textOf = (line: HTMLElement | undefined, selector: string): readonly string[] =>
        [...line?.querySelectorAll(selector) ?? []].map(t => t.textContent?.trim() ?? "");

      fixture.componentRef.setInput("chatId", "c3");
      await open("c3");
      await until(() => expect(lines().length).toBe(5));
      await settle();

      expect(lines().map(t => textOf(t, ".wake-toggle, .wake-label"))).toEqual([["Sub-agent \"Search\" ended as completed"],
        ["Background command \"Run the tests\" exited with code 1"], ["Background command \"Build\" was stopped"], ["Sub-agent \"Plan\" didn't come back"],
        ["Sub-agent \"Quiet\" ended as failed"]]);
      expect(lines().map(t => [t.querySelector(".wake-toggle")?.getAttribute("aria-expanded") ?? null, t.querySelectorAll(".wake-chevron").length]))
        .toEqual([["false", 1], ["false", 1], ["false", 1], ["false", 1], [null, 0]]);
      expect(lines().map(t => t.querySelectorAll(".wake-replies, .wake-chat, .wake-chat-gone").length)).toEqual([0, 0, 0, 0, 0]);
      for (const line of lines().slice(0, 4))
        line.querySelector<HTMLButtonElement>(".wake-toggle")?.click();
      await settle();

      expect(lines().map(t => t.querySelector(".wake-toggle")?.getAttribute("aria-expanded") ?? null)).toEqual(["true", "true", "true", "true", null]);
      expect(lines().map(t => textOf(t, ".wake-reply-text"))).toEqual([["Found 3 files."], ["1 failed\n2 passed"],
        ["TeamRun restarted before it ended, so it was stopped."], ["TeamRun restarted before it ended."], []]);
      const fontOf = (line: HTMLElement | undefined): string => getComputedStyle(line?.querySelector(".wake-reply-text") ?? element()).fontFamily;
      expect(lines()[1]?.querySelector(".wake-reply-text")?.classList.contains("wake-command-text")).toBe(true);
      expect(fontOf(lines()[1])).not.toBe(fontOf(lines()[0]));
      const mono = document.createElement("span");
      mono.style.fontFamily = "var(--nol-font-mono)";
      element().append(mono);
      expect(fontOf(lines()[1])).toBe(getComputedStyle(mono).fontFamily);
      mono.remove();
      expect(element().querySelectorAll("nol-teamrun-history-message").length).toBe(1);
      expect(element().textContent).not.toMatch(/agent-\d|bg-\d|w\d-wake|Your sub-agent|Your background command|restarted before your/);
    });
  });
});

describe("HistoryComponent over 10,000 messages with files and edits", () => {
  const count = 10_000;
  const scrolled = 150;
  const pageReadFrames = 2;
  const paragraph = "A paragraph of the conversation that wraps across the width of the history, as a real reply does when it explains a change.";
  const messageAt = (sequence: number): Message => {
    const text = [`Message ${sequence}`, ...Array.from({ length: sequence % 5 }, () => paragraph)].join("\n\n");
    if (sequence % 2 === 0)
      return new Message(`m${sequence}`, "c1", sequence, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, text, null, SampleData.timestamp)], null, SampleData.timestamp, null, SampleData.timestamp,
        sequence % 4 === 0 ? [new MessageAttachment("screen.png", "image/png", 48_000, "/shots/screen.png"), new MessageAttachment("notes.pdf", "application/pdf", 9_000, "/notes.pdf")] : []);
    const path = `/repo/src/file-${sequence}.ts`;
    return new Message(`m${sequence}`, "c1", sequence, MessageAuthor.Provider, `m${sequence - 1}`, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Command, "> npm test\nok", { tool: "Bash", toolUseId: `c${sequence}` }, SampleData.timestamp),
      new MessageDetail(1, DetailKind.FileChange, `Edit: ${path}`, { tool: "Edit", toolUseId: `e${sequence}`, input: { file_path: path, old_string: "a", new_string: "b" } },
        SampleData.timestamp),
      new MessageDetail(2, DetailKind.Text, `${text}\n\n\`\`\`ts\nconst value = ${sequence};\n\`\`\``, null, SampleData.timestamp)
    ], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
  };
  const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));
  const pageOf = async (parameters: JsonValue): Promise<JsonValue> => {
    const params = MessagePageParams.fromJson(parameters);
    const end = Object.isNull(params.beforeSequence) ? Object.isNull(params.afterSequence) ? count : Math.min(count, params.afterSequence + 1 + params.limit) : params.beforeSequence;
    const start = Object.isNull(params.afterSequence) ? Math.max(0, end - params.limit) : params.afterSequence + 1;
    const page = new MessagePage(Array.from({ length: end - start }, (_, index) => messageAt(start + index)), start > 0, end < count, count);
    for (let frames = 0; frames < pageReadFrames; frames += 1)
      await frame();
    return page.toJson();
  };
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<HistoryComponent>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const store = (): ChatStoreService => TestBed.inject(ChatStoreService);
  const viewport = (): HTMLElement => element().querySelector<HTMLElement>(".nol-virtual-list-viewport") ?? element();
  const isShown = (sequence: number): boolean =>
    [...element().querySelectorAll(".nol-virtual-list-slot")].some(t => new RegExp(`^Message ${sequence}(?!\\d)`).test(t.querySelector(".nol-markdown-view")?.textContent?.trim() ?? ""));
  const loadingInView = (): number => {
    const view = viewport().getBoundingClientRect();
    const placeholders = [...element().querySelectorAll<HTMLElement>(".nol-virtual-list-slot")].filter(t => {
      const row = t.getBoundingClientRect();
      return row.bottom > view.top && row.top < view.bottom && t.querySelector(".nol-virtual-list-row")?.getAttribute("aria-hidden") === "true";
    });
    return placeholders.length + element().querySelectorAll(".nol-virtual-list-status-shown").length;
  };
  const earliestShown = (): number =>
    Math.min(...[...element().querySelectorAll(".nol-virtual-list-slot")]
      .map(t => /^Message (\d+)/.exec(t.querySelector(".nol-markdown-view")?.textContent?.trim() ?? "")?.[1])
      .filter(t => !Object.isUndefined(t))
      .map(Number));
  const settle = async (): Promise<void> => {
    let height = -1;
    for (let steady = 0, frames = 0; steady < 5; frames += 1) {
      if (frames === 300)
        throw new Error(`The history's scroll height was still changing after 300 frames; the last read was ${height}px.`);
      await frame();
      steady = viewport().scrollHeight === height ? steady + 1 : 0;
      height = viewport().scrollHeight;
    }
  };
  const frames = async (frameCount: number): Promise<void> => {
    for (let index = 0; index < frameCount; index += 1)
      await frame();
  };
  const slotAtTop = (): readonly [number, number] => {
    const top = viewport().getBoundingClientRect().top;
    const slot = [...element().querySelectorAll<HTMLElement>(".nol-virtual-list-slot")].find(t => {
      const row = t.getBoundingClientRect();
      return row.top <= top + 0.5 && row.bottom > top + 0.5;
    });
    return Object.isUndefined(slot) ? [Number.NaN, Number.NaN] : [Number(slot.getAttribute("data-nol-row")), slot.getBoundingClientRect().top - top];
  };
  const grabThumb = (): { readonly writes: () => number; readonly moveTo: (top: number) => void } => {
    const view = viewport();
    const box = view.getBoundingClientRect();
    const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop") as PropertyDescriptor;
    let writes = 0;
    Object.defineProperty(view, "scrollTop", {
      configurable: true,
      get: () => scrollTop.get?.call(view),
      set: (value: number) => {
        writes += 1;
        scrollTop.set?.call(view, value);
      }
    });
    view.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: box.left + (view.clientWidth + box.width) / 2, clientY: box.top + 8, button: 0, buttons: 1 }));
    view.dispatchEvent(new Event("scroll"));
    return { writes: () => writes, moveTo: top => scrollTop.set?.call(view, top) };
  };
  const scrollUntilReached = async (sequence: number, move: (view: HTMLElement) => void): Promise<number> => {
    let loading = 0;
    for (let frames = 0; frames < 1_500 && earliestShown() > sequence; frames += 1) {
      move(viewport());
      await frame();
      loading += loadingInView();
    }
    expect(earliestShown()).toBeLessThanOrEqual(sequence);
    return loading;
  };

  beforeEach(async () => {
    AppearanceFixture.apply();
    context = SampleData.createContext()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson()])
      .answer(MethodName.MessagePage, pageOf);
    TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true) }, ChatStoreService.provider,
        provideMarkdown(), provideCodeHighlighting()]
    });
    fixture = TestBed.createComponent(HistoryComponent);
    fixture.componentRef.setInput("chatId", "c1");
    element().style.height = "600px";
    fixture.detectChanges();
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await store().selectConversation("c1");
    await Wait.until(() => expect(isShown(count - 1)).toBe(true));
  });

  afterEach(() => {
    ChatStoreService.release(context);
    AppearanceFixture.reset();
  });

  it("scrolls 150 messages up under a wheel four screens a frame, reading at least two pages on the way, without a loading row in view", { timeout: 120_000 }, async () => {
    const read = context.count(MethodName.MessagePage);
    const loading = await scrollUntilReached(count - scrolled, view => {
      view.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      view.scrollBy(0, -4 * view.clientHeight);
    });

    expect(loading).toBe(0);
    expect(context.count(MethodName.MessagePage) - read).toBeGreaterThanOrEqual(scrolled / 50 - 1);
  });

  it("shows the first message when the scrollbar is put at the top, and the last when it is put at the bottom", { timeout: 25_000 }, async () => {
    await settle();
    viewport().dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    viewport().scrollTop = 0;
    await Wait.until(() => expect(isShown(0)).toBe(true), { timeout: 5_000 });

    await settle();
    viewport().dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    viewport().scrollTop = viewport().scrollHeight;
    await Wait.until(() => expect(isShown(count - 1)).toBe(true), { timeout: 5_000 });
    expect(store().history()?.length()).toBe(count);
  });

  it("counts all 10,000 messages from its first page, so the earlier pages it reads never change its count, while the rows it measures change its scroll height when no drag holds it", { timeout: 25_000 }, async () => {
    const opened = store().history()?.length();
    const reads = context.count(MethodName.MessagePage);
    await settle();
    const room = viewport().scrollHeight - viewport().clientHeight;
    const seen: (readonly [number | undefined, number])[] = [];

    for (let step = 1; step <= 10; step += 1) {
      viewport().dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      viewport().scrollTop = Math.round(room * (1 - step / 10));
      await frames(6);
      seen.push([store().history()?.length(), viewport().scrollHeight]);
    }

    expect([opened, seen.every(([length]) => length === count), new Set(seen.map(([, height]) => height)).size > 1, context.count(MethodName.MessagePage) > reads])
      .toEqual([count, true, true, true]);
  });

  it("keeps the thumb's place and size through a drag to the first message and back while pages load, the top message moving one way, shows each end within 30 frames, and moves nothing on release", { timeout: 60_000 }, async () => {
    await settle();
    const view = viewport();
    const height = view.scrollHeight;
    const room = height - view.clientHeight;
    const legs: (readonly [number, number, number])[][] = [];
    const ends: boolean[] = [];
    const reads = context.count(MethodName.MessagePage);
    let place = room;

    const thumb = grabThumb();
    for (const to of [0, room]) {
      const from = place;
      const leg: (readonly [number, number, number])[] = [];
      for (let step = 1; step <= 12; step += 1) {
        place = Math.round(from + (to - from) * step / 12);
        thumb.moveTo(place);
        await frames(4);
        leg.push([view.scrollTop - place, view.scrollHeight, slotAtTop()[0]]);
      }
      legs.push(leg);
      const end = to === 0 ? 0 : count - 1;
      for (let waited = 0; waited < 30 && !isShown(end); waited += 1)
        await frame();
      ends.push(isShown(end));
    }
    const last = element().querySelector(`.nol-virtual-list-slot[data-nol-row="${count - 1}"]`)?.getBoundingClientRect().bottom;
    const held = thumb.writes();
    const isRead = context.count(MethodName.MessagePage) > reads;
    const [index, offset] = slotAtTop();
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await frames(3);
    await settle();
    const [released, releasedOffset] = slotAtTop();

    const isOneWay = (values: readonly number[], sign: number): boolean => values.every((t, step) => step === 0 || (t - (values[step - 1] as number)) * sign >= 0);
    expect([
      legs.map((leg, step) => [leg.every(t => Math.abs(t[0]) < 1), leg.every(t => t[1] === height), isOneWay(leg.map(t => t[2]), step === 0 ? -1 : 1)]),
      legs[0]?.at(-1)?.[2], ends, Math.abs(Number(last) - view.getBoundingClientRect().top - view.clientHeight) < 1, held, isRead, released, Math.abs(releasedOffset - offset) < 1
    ]).toEqual([[[true, true, true], [true, true, true]], 0, [true, true], true, 0, true, index, true]);
  });
});
