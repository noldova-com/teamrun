/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { NotificationSeverity } from "@noldova/desktop.protocol";
import { WindowPartTokens } from "@noldova/desktop.window";
import { DetailKind, Message, MessageDetail, MessageDetailsAfterParams, MessageIdParams, MessageStatus, MethodName, PlanStep, PlanStepStatus, Provenance, ReplyPanel,
  ReplyPlan, ReplySummary, ReplyUsage } from "@noldova/teamrun.protocol";
import { DefaultTheme, MessageComponent, ThemeMode } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ReplyHistoryRowComponent } from "../../../../src/app/components/reply-history-row/reply-history-row.component";
import { TeammateAvatarComponent } from "../../../../src/app/components/teammate-avatar/teammate-avatar.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ReplyHistoryService } from "../../../../src/app/services/reply-history.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { ShownText } from "../../../fixtures/shown-text.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ReplyHistoryRowComponent", () => {
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let fixture: ComponentFixture<ReplyHistoryRowComponent>;
  let history: ReplyHistoryService;
  let reads: Promise<Message | null>[];
  let afters: MessageDetailsAfterParams[];

  const edited = (id: string, path: string, text: string = "b"): Message =>
    SampleData.withStatus(new Message(id, "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.FileChange, `Edit: ${path}`,
      { tool: "Edit", input: { file_path: path, old_string: "a", new_string: text } }, SampleData.timestamp)]);
  const running = (steps: number): Message =>
    SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null), MessageStatus.Running, Array.from({ length: steps }, (_, index) =>
      new MessageDetail(index, DetailKind.Command, `> step ${index}\nout ${index}`, { tool: "Bash", toolUseId: `t${index}` }, SampleData.timestamp)));
  const measured = (status: MessageStatus): Message => SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [],
    new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null, new ReplyUsage(48_000, 1_250, 0.37, null)),
    SampleData.timestamp, SampleData.timestamp, null), status, [new MessageDetail(0, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash" }, SampleData.timestamp)]);
  const openFile = (message: Message): void => {
    const path = ReplySummary.fromMessage(message).files[0]?.path as string;
    history.expansionOf(message.id).files.set(new Set([path]));
  };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const within = (root: ParentNode, selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const click = async (selector: string): Promise<void> => {
    element().querySelector<HTMLButtonElement>(selector)?.click();
    await fixture.whenStable();
  };
  const pending = (): { readonly promise: Promise<JsonValue>; resolve: (value: JsonValue) => void; reject: (reason: unknown) => void } => {
    let resolve: (value: JsonValue) => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise<JsonValue>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  };
  const show = async (message: Message): Promise<void> => {
    fixture.componentRef.setInput("summary", ReplySummary.fromMessage(message));
    await fixture.whenStable();
  };
  const create = async (answers: ReadonlyMap<string, () => Promise<JsonValue>>, first: Message): Promise<void> => {
    context.answer(MethodName.MessageDetails, t => (answers.get(MessageIdParams.fromJson(t).messageId) as () => Promise<JsonValue>)());
    context.answer(MethodName.MessageDetailsAfter, async t => {
      const params = MessageDetailsAfterParams.fromJson(t);
      afters.push(params);
      const value = await (answers.get(params.messageId) as () => Promise<JsonValue>)();
      const message = Object.isNull(value) ? null : Message.fromJson(value);
      return message?.withDetails(message.details.filter(u => u.sequence > params.afterSequence || params.sequences.includes(u.sequence))).toJson() ?? null;
    });
    const read = history.readDetails.bind(history);
    vi.spyOn(history, "readDetails").mockImplementation(id => {
      const details = read(id);
      reads.push(details);
      return details;
    });
    const readAfter = history.readDetailsAfter.bind(history);
    vi.spyOn(history, "readDetailsAfter").mockImplementation((id, after, sequences) => {
      const details = readAfter(id, after, sequences);
      reads.push(details);
      return details;
    });
    fixture = TestBed.createComponent(ReplyHistoryRowComponent);
    fixture.componentRef.setInput("panel", ReplyPanel.Changes);
    fixture.componentRef.setInput("summary", ReplySummary.fromMessage(first));
    fixture.autoDetectChanges();
    await fixture.whenStable();
  };
  const settle = async (read: Promise<unknown>): Promise<void> => {
    await read.catch(() => undefined);
    await fixture.whenStable();
  };

  beforeEach(() => {
    reads = [];
    afters = [];
    context = SampleData.createContext();
    store = new ChatStoreService(context);
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ChatStoreService, useValue: store }, ReplyHistoryService, provideMarkdown()]
    });
    history = TestBed.inject(ReplyHistoryService);
  });

  afterEach(() => {
    store.dispose();
  });

  it("shows a reply's steps in the Activity panel as compact rows, not as tool-call cards", async () => {
    const reply = edited("r1", "D:\\repo\\a.ts");
    await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);

    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-activity-block button.step")).toHaveLength(1));
    expect(element().querySelector(".step-glyph")?.textContent).toBe("edit_document");
    expect(element().querySelector("nol-tool-call")).toBeNull();
  });

  it("shows a finished reply's tokens, time and cost after its time in its header in the Activity panel only, and its time alone without figures", async () => {
    const reply = measured(MessageStatus.Completed);
    await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
    expect(element().querySelector(".nol-teamrun-reply-stats")).toBeNull();

    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    expect(element().querySelector(".nol-teamrun-reply-stats")?.textContent?.trim()).toBe("48,000 tokens in · 1,250 tokens out · 0s · $0.37");
    expect(element().querySelector(".nol-teamrun-reply-header > .nol-teamrun-reply-name")?.nextElementSibling?.classList.contains("nol-teamrun-reply-stats")).toBe(true);
    await show(measured(MessageStatus.Running));
    expect(element().querySelector(".nol-teamrun-reply-stats")).toBeNull();
    await show(edited("r1", "D:\\repo\\a.ts"));
    expect(element().querySelector(".nol-teamrun-reply-stats")?.textContent?.trim()).toBe("0s");
  });

  it("reads no details until a step opens, then only the newer ones on each change while one is open, and none once every step is closed", async () => {
    let reply = running(3);
    await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    reply = running(4);
    await show(reply);
    expect(context.count(MethodName.MessageDetails)).toBe(0);
    expect(element().querySelector(".step-body")).toBeNull();

    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));
    element().querySelectorAll<HTMLButtonElement>("button.step")[1]?.click();
    await Wait.until(() => expect(element().querySelectorAll(".step-body")).toHaveLength(2));
    expect(context.count(MethodName.MessageDetails)).toBe(1);
    element().querySelectorAll<HTMLButtonElement>("button.step")[1]?.click();
    reply = running(5);
    await show(reply);
    await Wait.until(() => expect(context.count(MethodName.MessageDetailsAfter)).toBe(1));
    await settle(reads[1] as Promise<Message | null>);
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["3 []"]);
    await click("button.step");
    reply = running(6);
    await show(reply);
    await settle(Promise.resolve());

    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(context.count(MethodName.MessageDetailsAfter)).toBe(1);
    expect(element().querySelectorAll("button.step")).toHaveLength(6);
    expect(element().querySelector(".step-body")).toBeNull();
  });

  it("reads the details again when the reply changes while they are read, and opens the step on the newer ones", async () => {
    let reply = running(2);
    const first = pending();
    let calls = 0;
    await create(new Map([["r1", () => ++calls === 1 ? first.promise : Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    expect(context.count(MethodName.MessageDetails)).toBe(0);

    element().querySelector<HTMLButtonElement>("button.step")?.click();
    reply = running(3);
    await show(reply);
    first.resolve(running(2).toJson());

    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));
    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["1 []"]);
    expect(element().querySelectorAll("button.step")).toHaveLength(3);
  });

  it("puts an edit that lands while a read is in flight into the next read, and shows the newer diff", async () => {
    let reply = edited("r1", "D:\repo\a.ts", "early");
    const first = pending();
    let calls = 0;
    openFile(reply);
    await create(new Map([["r1", () => ++calls === 1 ? first.promise : Promise.resolve(reply.toJson())]]), reply);

    reply = edited("r1", "D:\repo\a.ts", "late");
    history.restoreChanged("r1", new Set([0]));
    await show(reply);
    expect(context.count(MethodName.MessageDetails)).toBe(1);
    first.resolve(edited("r1", "D:\repo\a.ts", "early").toJson());

    await Wait.until(() => expect(element().querySelector(".diff")?.textContent ?? "").toContain("+late"));
    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["0 [0]"]);
  });

  it("reads only the details after the last one it holds and the held ones that changed, and shows both", async () => {
    let reply = running(3);
    await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));

    reply = SampleData.withStatus(reply, MessageStatus.Running, [
      new MessageDetail(0, DetailKind.Command, "> step 0\nchanged 0", { tool: "Bash", toolUseId: "t0" }, SampleData.timestamp), ...running(5).details.slice(1)]);
    history.restoreChanged("r1", new Set([0]));
    await show(reply);

    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("changed 0"));
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["2 [0]"]);
    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(element().querySelectorAll("button.step")).toHaveLength(5);
    element().querySelectorAll<HTMLButtonElement>("button.step")[4]?.click();
    await Wait.until(() => expect(element().querySelectorAll(".step-body")[1]?.textContent).toBe("out 4"));
  });

  it("keeps the changed steps of a failed read for the next one", async () => {
    let reply = running(2);
    let fails = false;
    await create(new Map([["r1", () => fails ? Promise.reject("The runtime stopped.") : Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));

    fails = true;
    history.restoreChanged("r1", new Set([0]));
    reply = running(3);
    await show(reply);
    await Wait.until(() => expect(element().querySelector("[role='alert']")?.textContent?.trim()).toBe("The runtime stopped."));
    fails = false;
    [...element().querySelectorAll<HTMLButtonElement>("button.nol-button")].find(t => t.textContent?.trim() === Resources.replyHistoryRetry)?.click();

    await Wait.until(() => expect(afters).toHaveLength(2));
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["1 [0]", "1 [0]"]);
    await Wait.until(() => expect(element().querySelector("[role='alert']")).toBeNull());
  });

  it("keeps the changed steps of every read since the last shown details when a later read of the same refresh fails", async () => {
    let reply = running(2);
    const first = pending();
    let calls = 0;
    await create(new Map([["r1", () => {
      calls++;
      return calls === 2 ? first.promise : calls === 3 ? Promise.reject("The runtime stopped.") : Promise.resolve(reply.toJson());
    }]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));

    history.restoreChanged("r1", new Set([0]));
    reply = running(3);
    await show(reply);
    await Wait.until(() => expect(afters).toHaveLength(1));
    history.restoreChanged("r1", new Set([1]));
    reply = running(4);
    await show(reply);
    first.resolve(running(3).toJson());

    await Wait.until(() => expect(element().querySelector("[role='alert']")?.textContent?.trim()).toBe("The runtime stopped."));
    expect(afters.map(t => `${t.afterSequence} [${t.sequences.join(",")}]`)).toEqual(["1 [0]", "2 [1]"]);
    expect([...history.takeChanged("r1")].sort()).toEqual([0, 1]);
  });

  it("reads the whole message again once more held steps changed than one read may name", async () => {
    let reply = running(2);
    await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));

    history.restoreChanged("r1", new Set(Array.from({ length: Resources.changedDetailsLimit + 1 }, (_, index) => index)));
    reply = running(3);
    await show(reply);

    await Wait.until(() => expect(context.count(MethodName.MessageDetails)).toBe(2));
    expect(afters).toHaveLength(0);
    expect(history.takeChanged("r1").size).toBe(0);
  });

  it("opens no step when the runtime no longer has the reply's details, and says nothing failed", async () => {
    const reply = running(2);
    await create(new Map([["r1", () => Promise.resolve(null)]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();

    await click("button.step");
    await settle(reads[0] as Promise<Message | null>);

    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(element().querySelector(".step-body")).toBeNull();
    expect(element().querySelector("button.step")?.getAttribute("aria-expanded")).toBe("false");
    expect(element().querySelector("[role='alert'], [role='status']")).toBeNull();
  });

  it("keeps the steps it holds when the runtime no longer has the reply for a read of the newer ones, and says nothing failed", async () => {
    let reply: Message | null = running(2);
    await create(new Map([["r1", () => Promise.resolve(reply?.toJson() ?? null)]]), reply);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    await fixture.whenStable();
    await click("button.step");
    await Wait.until(() => expect(element().querySelector(".step-body")?.textContent).toBe("out 0"));

    reply = null;
    await show(running(3));
    await Wait.until(() => expect(afters).toHaveLength(1));
    await settle(reads[1] as Promise<Message | null>);

    expect(context.count(MethodName.MessageDetails)).toBe(1);
    expect(element().querySelector(".step-body")?.textContent).toBe("out 0");
    expect(element().querySelector("[role='alert']")).toBeNull();
  });

  it("lists a reply's files from its summary and opens a file's diff once its details are read", async () => {
    const reply = edited("r1", "D:\\repo\\a.ts", "late");
    const read = pending();
    await create(new Map([["r1", () => read.promise]]), reply);

    expect(element().querySelector("nol-teamrun-edited-files")?.textContent ?? "").toContain("D:\\repo\\a.ts");
    expect(context.count(MethodName.MessageDetails)).toBe(0);
    await click("nol-teamrun-edited-files button.name");
    expect(element().querySelector("[role='status']")?.textContent?.trim()).toBe(Resources.replyHistoryLoading);
    expect(element().querySelector(".diff")).toBeNull();
    read.resolve(reply.toJson());

    await Wait.until(() => expect(element().querySelector(".diff")?.textContent ?? "").toContain("+late"));
    expect(element().querySelector("[role='status']")).toBeNull();
    expect(context.count(MethodName.MessageDetails)).toBe(1);
  });

  it("shows only the open details of the reply it shows now, whichever reply's answer comes last, and their whole paths when no project is open", async () => {
    const earlier = edited("r1", "D:\\repo\\earlier.ts", "early");
    const later = edited("r2", "D:\\repo\\later.ts", "late");
    const first = pending();
    const second = pending();
    openFile(earlier);
    openFile(later);
    await create(new Map([["r1", () => first.promise], ["r2", () => second.promise]]), earlier);

    await show(later);
    second.resolve(later.toJson());
    await Wait.until(() => expect(element().querySelector(".diff")?.textContent ?? "").toContain("+late"));
    first.resolve(earlier.toJson());
    await settle(reads[0] as Promise<Message | null>);

    expect(context.count(MethodName.MessageDetails)).toBe(2);
    expect(element().querySelector("nol-teamrun-edited-files")?.textContent ?? "").toContain("D:\\repo\\later.ts");
    expect(element().textContent).not.toContain("early");
  });

  it("shows no failure of a reply it no longer shows, and says why its own details failed in plain text", async () => {
    const first = pending();
    const alerts = (): (string | undefined)[] => [...element().querySelectorAll("[role='alert']")].map(t => t.textContent?.trim());
    const earlier = edited("r1", "D:\\repo\\a.ts");
    const later = edited("r2", "D:\\repo\\b.ts");
    openFile(earlier);
    openFile(later);
    await create(new Map([["r1", () => first.promise], ["r2", () => Promise.reject("The runtime stopped.")]]), earlier);

    await show(later);
    await Wait.until(() => expect(alerts()).toEqual(["The runtime stopped."]));
    first.reject(new Error("Too late."));
    await settle(reads[0] as Promise<Message | null>);

    expect(context.count(MethodName.MessageDetails)).toBe(2);
    expect(alerts()).toEqual(["The runtime stopped."]);
  });

  it("opens a plan's links in the Plan view as the chat does, without choosing the row: a file of its project, a file elsewhere by its full path, an image elsewhere in its folder, and a web link, and says why a relative path out of it isn't opened", async () => {
    void store.initialize();
    await Wait.until(() => expect(store.folderOf("c1")).toBe("D:\\repo"));
    const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan([], null,
      "# Read the code\n\nSee [the code](src/a.ts:42), [the notes](D:/elsewhere/notes.md), [the drive](D:/elsewhere/y.png), [up](../x.ts) and [the docs](https://example.com/docs).")
      .toJson(), SampleData.timestamp)]);
    const links = (): HTMLAnchorElement[] => [...element().querySelectorAll<HTMLAnchorElement>("nol-teamrun-plan-card a.nol-markdown-link")];
    const link = (text: string): HTMLAnchorElement | undefined => links().find(t => ShownText.of(t) === text);
    let chosen = 0;
    await create(new Map(), planned);
    fixture.componentInstance.chosen.subscribe(() => chosen++);
    fixture.componentRef.setInput("panel", ReplyPanel.Plan);
    await fixture.whenStable();

    await Wait.until(() => expect(links().map(t => ShownText.of(t))).toEqual(["the code", "the notes", "the drive", "up", "the docs"]), MarkdownWait.coldImport);
    for (const text of ["the code", "the notes", "the drive", "up", "the docs"]) {
      link(text)?.click();
      await fixture.whenStable();
    }

    await Wait.until(() => expect(context.shownInFolder).toEqual(["D:/elsewhere/y.png"]));
    expect(context.openedFiles).toEqual(["D:\\repo\\src/a.ts", "D:/elsewhere/notes.md"]);
    expect(context.links).toEqual(["https://example.com/docs"]);
    expect(context.shownNotices().map(t => [t.title, t.text, t.severity])).toEqual([["Couldn't open the file", Resources.formatLinkedFileRefused("x.ts"), NotificationSeverity.Error]]);
    expect(chosen).toBe(0);
    link("the code")?.closest("p")?.click();
    expect(chosen).toBe(1);
  });

  it("shows a plan's linked file in its folder in the Plan view when it doesn't open, and says so as the chat does when neither works", async () => {
    void store.initialize();
    await Wait.until(() => expect(store.folderOf("c1")).toBe("D:\\repo"));
    const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan",
      new ReplyPlan([], null, "# Change the code\n\nChange [the code](src/a.ts).").toJson(), SampleData.timestamp)]);
    const link = (): HTMLAnchorElement | null => element().querySelector<HTMLAnchorElement>("nol-teamrun-plan-card a.nol-markdown-link");
    context.openFileFailure = "No app opens it.";
    await create(new Map(), planned);
    fixture.componentRef.setInput("panel", ReplyPanel.Plan);
    await fixture.whenStable();
    await Wait.until(() => expect(link()).not.toBeNull(), MarkdownWait.coldImport);

    link()?.click();
    await Wait.until(() => expect(context.shownInFolder).toEqual(["D:\\repo\\src/a.ts"]));
    expect(context.shownNotices()).toEqual([]);
    context.showInFolderFailure = "The folder is gone.";
    link()?.click();

    await Wait.until(() => expect(context.shownNotices().map(t => [t.title, t.text, t.severity]))
      .toEqual([["Couldn't open the file", Resources.formatLinkedFileFailed("a.ts"), NotificationSeverity.Error]]));
    expect(context.openedFiles).toEqual(["D:\\repo\\src/a.ts", "D:\\repo\\src/a.ts"]);
  });

  it("draws a Default reply's avatar in the Plan view with the Default's letter and colours, as the members row does", async () => {
    const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Move the cache",
      new ReplyPlan([], null, "# Move the cache", false).toJson(), SampleData.timestamp)]);
    const look = (avatar: HTMLElement | null): string[] => [avatar?.textContent?.trim() ?? "", avatar?.style.getPropertyValue("--nol-avatar-fill") ?? "",
      avatar?.style.getPropertyValue("--nol-avatar-letter") ?? ""];
    const member = TestBed.createComponent(TeammateAvatarComponent);
    member.componentRef.setInput("teammate", null);
    member.detectChanges();
    await create(new Map(), planned);
    fixture.componentRef.setInput("panel", ReplyPanel.Plan);
    await fixture.whenStable();

    await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-plan nol-teamrun-plan-card nol-avatar")).not.toBeNull());
    const shown = look(element().querySelector(".nol-teamrun-reply-plan nol-teamrun-plan-card nol-avatar"));

    expect(shown).toEqual(look((member.nativeElement as HTMLElement).querySelector("nol-avatar")));
    expect(shown[0]).toBe("D");
  });

  it("gives the Plan view's message the plan's text, then its checklist a step a line, as the text its Copy writes, and none for a reply without a plan", async () => {
    const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, "Fixing the bug")];
    const planned = (plan: ReplyPlan): Message => SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan",
      plan.toJson(), SampleData.timestamp)]);
    const copied = (): string | null => (fixture.debugElement.query(By.directive(MessageComponent)).componentInstance as MessageComponent).copyText();
    await create(new Map(), planned(new ReplyPlan([], null, "# Move the cache\n\nMove it.")));
    fixture.componentRef.setInput("panel", ReplyPanel.Plan);
    await fixture.whenStable();

    await Wait.until(() => expect(element().querySelector(".nol-teamrun-reply-plan")).not.toBeNull());
    expect(copied()).toBe("# Move the cache\n\nMove it.");
    expect([element().querySelectorAll(".nol-message-copy").length, element().querySelector(".nol-message-copy")?.tagName]).toEqual([1, "BUTTON"]);
    await show(planned(new ReplyPlan(steps, null)));
    expect(copied()).toBe("Read the code\nFix the bug");
    await show(planned(new ReplyPlan(steps, null, "# Move the cache")));
    expect(copied()).toBe("# Move the cache\n\nRead the code\nFix the bug");
    await show(SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, []));
    expect(copied()).toBeNull();
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

    it("overlays Loading at the row's bottom end on the raised background with medium corners, without moving the row", async () => {
      const reply = edited("r1", "D:\\repo\\a.ts");
      await create(new Map([["r1", () => new Promise<JsonValue>(() => undefined)]]), reply);
      const before = element().getBoundingClientRect();

      await click("nol-teamrun-edited-files button.name");
      const loading = element().querySelector<HTMLElement>("[role='status']") as HTMLElement;
      const row = element().getBoundingClientRect();
      const box = loading.getBoundingClientRect();
      const style = getComputedStyle(loading);

      expect(AppearanceFixture.measureLook("space-1")).toBeGreaterThan(0);
      expect(style.position).toBe("absolute");
      AppearanceFixture.expectPixels(row.height, before.height);
      AppearanceFixture.expectPixels(row.bottom - box.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(row.right - box.right, AppearanceFixture.measureLook("content-padding-inline"));
      for (const padding of [style.paddingTop, style.paddingInlineStart, style.paddingBottom, style.paddingInlineEnd])
        AppearanceFixture.expectPixels(Number.parseFloat(padding), AppearanceFixture.measureLook("space-1"));
      expect(AppearanceFixture.measureLook("radius-medium")).toBeGreaterThan(0);
      for (const radius of [style.borderStartStartRadius, style.borderStartEndRadius, style.borderEndStartRadius, style.borderEndEndRadius])
        AppearanceFixture.expectPixels(Number.parseFloat(radius), AppearanceFixture.measureLook("radius-medium"));
      if (forcedColors !== "active")
        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"));
    });

    it("keeps Loading at the content's bottom end in a feed's last row and in a plan's row, inside the row's padding", async () => {
      const reply = edited("r1", "D:\\repo\\a.ts");
      await create(new Map([["r1", () => new Promise<JsonValue>(() => undefined)]]), reply);
      await click("nol-teamrun-edited-files button.name");
      const loading = element().querySelector<HTMLElement>("[role='status']") as HTMLElement;
      const inline = AppearanceFixture.measureLook("content-padding-inline");
      const block = AppearanceFixture.measureLook("view-padding-block");
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${String(n)}`);
      const expectGaps = (end: number, bottom: number): void => {
        const row = element().getBoundingClientRect();
        const box = loading.getBoundingClientRect();
        AppearanceFixture.expectPixels(row.right - box.right, end);
        AppearanceFixture.expectPixels(row.bottom - box.bottom, bottom);
      };

      expect([inline, block].every(t => t > 0)).toBe(true);
      element().classList.add("nol-teamrun-reply-first", "nol-teamrun-reply-last");
      await fixture.whenStable();
      expectGaps(inline, space(1) + block);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      expectGaps(inline, space(2) + block);
      element().classList.remove("nol-teamrun-reply-first", "nol-teamrun-reply-last");
      await fixture.whenStable();
      expectGaps(inline, 0);
    });

    it("puts a reply's stats half a rem after its time on the header's line, in the header's muted type, and at the header's start on the next line when they don't fit", async () => {
      const reply = measured(MessageStatus.Completed);
      await create(new Map([["r1", () => Promise.resolve(reply.toJson())]]), reply);
      fixture.componentRef.setInput("panel", ReplyPanel.Activity);
      await fixture.whenStable();
      const header = element().querySelector<HTMLElement>(".nol-teamrun-reply-header")!;
      const time = header.querySelector<HTMLElement>(".nol-teamrun-reply-name > span:last-child")!;
      const stats = element().querySelector<HTMLElement>(".nol-teamrun-reply-stats")!;
      const middle = (box: DOMRect): number => (box.top + box.bottom) / 2;

      expect(header.contains(stats)).toBe(true);
      AppearanceFixture.expectPixels(stats.getBoundingClientRect().left - time.getBoundingClientRect().right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(middle(stats.getBoundingClientRect()), middle(time.getBoundingClientRect()));
      AppearanceFixture.expectPixels(header.getBoundingClientRect().height, time.getBoundingClientRect().height);
      expect([getComputedStyle(stats).color, getComputedStyle(stats).fontSize]).toEqual([getComputedStyle(header).color, getComputedStyle(header).fontSize]);

      element().style.width = "12rem";
      await fixture.whenStable();
      AppearanceFixture.expectPixels(stats.getBoundingClientRect().left, header.getBoundingClientRect().left);
      AppearanceFixture.expectPixels(stats.getBoundingClientRect().top, time.getBoundingClientRect().bottom);
      expect(stats.getBoundingClientRect().right).toBeLessThanOrEqual(header.getBoundingClientRect().right);
    });

    it("says Not approved once, at the end of a refused plan's card header in the Plan view, after the teammate and time, in the header's muted type, and nothing for one not refused", async () => {
      const planned = (rejected: boolean): Message => SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [],
        SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Move the cache",
        new ReplyPlan([], null, "# Move the cache", rejected).toJson(), SampleData.timestamp)]);
      await create(new Map(), planned(false));
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();

      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const kept = element().textContent?.includes(Resources.planNotApproved);
      await show(planned(true));
      const header = within(element(), "nol-teamrun-plan-card .header");
      const [time, progress] = [within(header, ".time"), within(header, ".progress")];

      expect([kept, progress.textContent?.trim(), element().textContent?.split(Resources.planNotApproved).length, time.textContent?.trim()])
        .toEqual([false, Resources.planNotApproved, 2, TestBed.inject(TimeFormatService).time(SampleData.timestamp)]);
      expect(progress.getBoundingClientRect().left).toBeGreaterThan(time.getBoundingClientRect().right);
      expect([getComputedStyle(progress).color, getComputedStyle(progress).fontSize]).toEqual([getComputedStyle(time).color, getComputedStyle(header).fontSize]);
      if (forcedColors !== "active")
        expect(getComputedStyle(progress).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("heads a plan's card in the Plan view with its teammate's avatar, name muted at weight 400 as the row above it was, and time in place of Plan, on one line with its progress at the end, Copy centred on the header past the progress, and no row above the card", async () => {
      const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.Completed, null)];
      const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan(steps, null).toJson(),
        SampleData.timestamp)]);
      await create(new Map(), planned);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const message = within(element(), ".nol-teamrun-reply-plan");
      const card = within(message, "nol-teamrun-plan-card");
      const header = within(card, ".header");
      const parts = [...header.children].map(t => t.localName === "nol-avatar" ? "avatar" : t.classList[0]);
      const avatar = within(header, "nol-avatar").getBoundingClientRect();
      const name = within(header, ".name").getBoundingClientRect();
      const time = within(header, ".time").getBoundingClientRect();
      const progress = within(header, ".progress").getBoundingClientRect();
      const box = header.getBoundingClientRect();
      const middle = (rect: DOMRect): number => rect.top + rect.height / 2;
      const gap = Number.parseFloat(getComputedStyle(header).columnGap);

      expect([parts, name.width > 0, header.textContent?.includes(Resources.planTitle), message.querySelectorAll(".nol-message-header, .nol-message-author").length,
        header.querySelector(".name")?.textContent?.trim(), header.querySelector(".progress")?.textContent?.trim()])
        .toEqual([["avatar", "name", "time", "progress"], true, false, 0, element().querySelector(".nol-message-label")?.textContent?.split(",")[0], "2 of 2"]);
      expect(getComputedStyle(within(header, ".name")).fontWeight).toBe("400");
      if (forcedColors !== "active")
        expect(getComputedStyle(within(header, ".name")).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
      for (const part of [avatar, name, time, progress])
        AppearanceFixture.expectPixels(middle(part), middle(box));
      AppearanceFixture.expectPixels(name.left - avatar.right, gap);
      AppearanceFixture.expectPixels(time.left - name.right, gap);
      expect(progress.left).toBeGreaterThan(time.right + gap);

      const copy = within(message, ".nol-message-copy").getBoundingClientRect();
      AppearanceFixture.expectPixels(middle(copy), middle(box));
      expect(copy.left).toBeGreaterThanOrEqual(progress.right + gap - 0.5);
      expect(copy.right).toBeLessThanOrEqual(card.getBoundingClientRect().right + 0.5);
    });

    it("sets a plan card's avatar and Copy's hover square at one gap from the card's top corners, the avatar's from the start and Copy's from the end the same as Copy's from the top", async () => {
      const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.Pending, null)];
      const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan(steps, null).toJson(),
        SampleData.timestamp)]);
      await create(new Map(), planned);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const message = within(element(), ".nol-teamrun-reply-plan");
      const outer = within(message, "nol-teamrun-plan-card").getBoundingClientRect();
      const avatar = within(message, "nol-teamrun-plan-card .header nol-avatar").getBoundingClientRect();
      const button = within(message, ".nol-message-copy");
      const target = button.getBoundingClientRect();
      const square = Number.parseFloat(getComputedStyle(button, "::before").width);
      const squareTop = target.top + (target.height - square) / 2;
      const squareEnd = target.right - (target.width - square) / 2;
      const corner = squareTop - outer.top;

      expect(corner).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(square, AppearanceFixture.measureLook("icon-button"));
      AppearanceFixture.expectPixels(outer.right - squareEnd, corner);
      AppearanceFixture.expectPixels(avatar.left - outer.left, corner);
    });

    it("draws a plan card's ring in the card border colour on all four sides, selected or not and hovered or not, apart from the selected row's background, and under forced colours outlines the selected message in Highlight", async () => {
      const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null)];
      const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan(steps, null).toJson(),
        SampleData.timestamp)]);
      await create(new Map(), planned);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const message = within(element(), ".nol-teamrun-reply-plan");
      const card = within(message, "nol-teamrun-plan-card");
      const sides = (): string[] => {
        const style = getComputedStyle(card);
        return [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor];
      };
      const unselected = sides();
      fixture.componentRef.setInput("selected", true);
      await fixture.whenStable();
      const selected = sides();
      await userEvent.hover(card);
      const hovered = sides();
      await userEvent.unhover(card);
      const width = Number.parseFloat(getComputedStyle(card).borderTopWidth);

      expect([card.classList.contains("selected"), width > 0]).toEqual([true, true]);
      if (forcedColors !== "active") {
        expect(unselected).toEqual(Array(4).fill(AppearanceFixture.readColor(FixtureTheme.theme, mode, "card-border")));
        expect(selected).toEqual(unselected);
        expect(hovered).toEqual(unselected);
        expect(getComputedStyle(message).backgroundColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"));
        expect(selected[0]).not.toBe(getComputedStyle(message).backgroundColor);
      }
      else {
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.color = "Highlight";
        const highlight = getComputedStyle(probe).color;
        probe.remove();
        const outline = getComputedStyle(message);
        expect([outline.outlineStyle, outline.outlineColor]).toEqual(["solid", highlight]);
        AppearanceFixture.expectPixels(Number.parseFloat(outline.outlineWidth), 2 * AppearanceFixture.measureLook("border-width"));
      }
    });

    it.each([["the fixture theme"], ["the kit's own theme"]])("fills a plan card's header inside its ring and raises it a step above the selected row, hovered or not, in %s", async look => {
      const theme = look === "the fixture theme" ? FixtureTheme.theme : DefaultTheme.theme;
      AppearanceFixture.apply(theme, mode);
      const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null)];
      const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan(steps, null).toJson(),
        SampleData.timestamp)]);
      await create(new Map(), planned);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const message = within(element(), ".nol-teamrun-reply-plan");
      const card = within(message, "nol-teamrun-plan-card");
      const header = within(card, ".header");
      const measure = (): { color: string; insets: number[] } => {
        const box = card.getBoundingClientRect();
        const inner = header.getBoundingClientRect();
        const border = Number.parseFloat(getComputedStyle(card).borderTopWidth);
        return { color: getComputedStyle(header).backgroundColor, insets: [inner.left - box.left - border, box.right - border - inner.right, inner.top - box.top - border] };
      };
      const states = [measure()];
      await userEvent.hover(card);
      states.push(measure());
      const actions = within(message, ".nol-message-actions");
      const overlay = actions.getBoundingClientRect().top - card.getBoundingClientRect().top - Number.parseFloat(getComputedStyle(card).borderTopWidth);
      expect([getComputedStyle(actions).opacity, overlay >= -0.5, getComputedStyle(actions).backgroundColor.endsWith(", 0)")]).toEqual(["1", true, true]);
      fixture.componentRef.setInput("selected", true);
      await fixture.whenStable();
      states.push(measure());
      await userEvent.unhover(card);
      states.push(measure());
      const row = getComputedStyle(message).backgroundColor;

      for (const inset of states.flatMap(t => t.insets))
        AppearanceFixture.expectPixels(inset, 0);
      if (forcedColors !== "active") {
        const plain = AppearanceFixture.readColor(theme, mode, "code-header");
        const raised = AppearanceFixture.readColor(theme, mode, "code-header-raised");
        expect(states.map(t => t.color)).toEqual([plain, plain, raised, raised]);
        if (theme === FixtureTheme.theme)
          expect(row).toBe(AppearanceFixture.readColor(theme, mode, "raised"));
        if (theme === FixtureTheme.theme || mode === ThemeMode.Dark)
          expect(raised).not.toBe(row);
        else
          expect(raised).toBe(plain);
      }
    });

    it("centres Copy on the plan card's header in the kit's own theme too, with the message's padding the same all round", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const steps = [new PlanStep("Read the code", PlanStepStatus.Completed, null)];
      const planned = SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan(steps, null).toJson(),
        SampleData.timestamp)]);
      await create(new Map(), planned);
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();
      await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header .name")).not.toBeNull());
      const message = within(element(), ".nol-teamrun-reply-plan");
      const header = within(message, "nol-teamrun-plan-card .header").getBoundingClientRect();
      const copy = within(message, ".nol-message-copy").getBoundingClientRect();
      const padding = getComputedStyle(message);

      AppearanceFixture.expectPixels(copy.top + copy.height / 2, header.top + header.height / 2);
      expect([padding.paddingTop, padding.paddingRight, padding.paddingBottom]).toEqual([padding.paddingLeft, padding.paddingLeft, padding.paddingLeft]);
      AppearanceFixture.expectPixels(Number.parseFloat(padding.paddingTop), AppearanceFixture.measureLook("space-2"));
    });

    it("shows the step its reply left in progress as not done in the Plan view once the reply ends, its mark the size and place of a step not started", async () => {
      const planned = (status: MessageStatus): Message => SampleData.withStatus(new Message("r1", "c1", 1, SampleData.reply.author, null, MessageStatus.Running, [],
        SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), status, [new MessageDetail(0, DetailKind.Plan, "Plan", new ReplyPlan([
        new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, "Fixing the bug"),
        new PlanStep("Run the tests", PlanStepStatus.Pending, null)], null).toJson(), SampleData.timestamp)]);
      const steps = (): (string | boolean)[][] => [...element().querySelectorAll("nol-plan .nol-plan-step")]
        .map(t => [t.querySelector(".nol-plan-text")?.textContent?.trim() ?? "", !Object.isNull(t.querySelector(".nol-plan-spinner"))]);
      await create(new Map(), planned(MessageStatus.Running));
      fixture.componentRef.setInput("panel", ReplyPanel.Plan);
      await fixture.whenStable();

      await Wait.until(() => expect(steps()).toEqual([["Read the code", false], ["Fixing the bug", true], ["Run the tests", false]]));
      await show(planned(MessageStatus.Interrupted));
      const markers = [...element().querySelectorAll("nol-plan .nol-plan-marker")].map(t => t.getBoundingClientRect());
      expect(markers.length).toBe(3);
      const [ended = new DOMRect(), pending = new DOMRect()] = markers.slice(1);

      expect(steps()).toEqual([["Read the code", false], ["Fix the bug", false], ["Run the tests", false]]);
      AppearanceFixture.expectPixels(ended.left, pending.left);
      AppearanceFixture.expectPixels(ended.width, pending.width);
      AppearanceFixture.expectPixels(ended.height, pending.height);
    });
  });
});
