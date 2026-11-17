/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Approval,
  Conversation,
  ConversationListParams,
  DetailKind,
  ErrorCode,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessagePageParams,
  MessageStatus,
  MethodName,
  PlanStep,
  PlanStepStatus,
  ReplyPlan,
  SubAgent,
  SubAgentStatus
} from "@noldova/teamrun.protocol";
import { GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { AnnouncementPoliteness, Announcer, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, CodeHighlightingFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";
import { ComposerComponent } from "../../../../src/app/components/composer/composer.component";
import { ConversationComponent } from "../../../../src/app/components/conversation/conversation.component";
import { HistoryComponent } from "../../../../src/app/components/history/history.component";
import { MessageFocus } from "../../../../src/app/models/message-focus";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { GitHubReferenceSource } from "../../../../src/app/services/github-reference-source";
import { CommandTargetsService } from "../../../../src/app/services/command-targets.service";
import { Resources } from "../../../../src/resources";

describe("ConversationComponent", () => {
  const answer = new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed,
    [SampleData.detail(0, DetailKind.Text, "Use `npm test`:\n\n```ts\nconst done = true;\n```\n\nThat is **all**.")], SampleData.provenance, SampleData.timestamp,
    SampleData.timestamp, SampleData.timestamp);
  const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const elsewhere = new Message("n0", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "From the *second* tab")], null,
    SampleData.timestamp, null, SampleData.timestamp);
  let context: FakeWindowPartContext;
  let shown: WritableSignal<boolean>;
  let fixture: ComponentFixture<ConversationComponent>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const store = (): ChatStoreService => ChatStoreService.of(context);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    shown = signal(false);
    context = SampleData.createContext()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()])
      .answer(MethodName.MessagePage, t => SampleData.page(MessagePageParams.fromJson(t).conversationId === "c2" ? [elsewhere] : [SampleData.userMessage, answer], false, false)
        .toJson())
      .answer(MethodName.ConversationRename, () => new Conversation("c1", "p1", "Renamed", SampleData.timestamp, SampleData.timestamp).toJson());
    TestBed.configureTestingModule({
      imports: [ConversationComponent],
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: shown.asReadonly() }]
    });
    fixture = TestBed.createComponent(ConversationComponent);
    fixture.componentRef.setInput("instance", "c1");
    fixture.componentRef.setInput("title", "First");
    element().style.height = "600px";
    fixture.detectChanges();
  });

  afterEach(() => ChatStoreService.release(context));

  it("selects its conversation once shown and shows the history with markdown and highlighted code", async () => {
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await settle();
    expect(store().selectedConversationId()).toBeNull();

    shown.set(true);
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
    await settle();

    await Wait.until(() => expect(element().querySelector(".history strong")?.textContent).toBe("all"), MarkdownWait.coldImport);
    expect(element().querySelector(".history code")?.textContent).toBe("npm test");
    expect(element().querySelector(".history nol-code-block")?.textContent).toContain("const done = true;");
    expect(context.updates).toEqual([]);
  });

  it("shows the composer for its conversation under the history, across the document's width", async () => {
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await settle();

    const composer = fixture.debugElement.query(By.directive(ComposerComponent));
    const history = element().querySelector(".history")?.getBoundingClientRect();
    const box = (composer.nativeElement as HTMLElement).getBoundingClientRect();
    expect((composer.componentInstance as ComposerComponent).conversationId()).toBe("c1");
    expect(box.top).toBeGreaterThanOrEqual(history?.bottom ?? Number.NaN);
    expect(box.bottom).toBeCloseTo(element().getBoundingClientRect().bottom, 0);
    expect(box.width).toBeCloseTo(element().getBoundingClientRect().width, 0);
  });

  it("keeps the Plans view's selection on a press on a plan block, and clears it on a press anywhere else in the chat: a message, the composer or the empty area", async () => {
    const planned = new Message("m3", "c1", 2, MessageAuthor.Provider, "m1", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Here's my plan."),
      new MessageDetail(1, DetailKind.Plan, "Plan", new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Pending, null)], null).toJson(), SampleData.timestamp)],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, answer, planned], false, false).toJson());
    shown.set(true);
    await Wait.until(() => expect(element().querySelector("nol-teamrun-plan-card .header")).not.toBeNull(), MarkdownWait.coldImport);
    await Wait.until(() => expect(element().querySelector(".history strong")).not.toBeNull(), MarkdownWait.coldImport);
    await settle();
    const press = (target: Element | null): boolean => target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })) ?? false;
    const select = (): void => store().showPlan(new MessageFocus("c1", "m3", 2, true));
    const outside = [".history strong", "nol-teamrun-composer", ".nol-virtual-list-viewport"].map(t => element().querySelector(t));

    select();
    expect(press(element().querySelector("nol-teamrun-plan-card .title"))).toBe(true);
    expect(store().planFocus()?.messageId).toBe("m3");
    for (const target of outside) {
      select();
      expect(press(target)).toBe(true);
      expect(store().planFocus()).toBeNull();
    }
  });

  it("keeps the Sub-agents view's selection on a press on its sub-agent's row, and clears it on a press anywhere else in the chat: another sub-agent's row, a message, " +
    "the composer or the empty area", async () => {
    const agent = new SubAgent("ta", "Explore", "Find where plans are stored", "Haiku 5.5", SubAgentStatus.Completed, false, 14, 38200, 72000, "They're in the store.");
    const other = new SubAgent("tb", "Explore", "Read the tests", "Haiku 5.5", SubAgentStatus.Completed, false, 3, 9000, 12000, "They pass.");
    const started = new Message("m3", "c1", 2, MessageAuthor.Provider, "m1", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Looking **now**."),
      new MessageDetail(1, DetailKind.SubAgent, agent.description, agent.toJson(), SampleData.timestamp),
      new MessageDetail(2, DetailKind.SubAgent, other.description, other.toJson(), SampleData.timestamp)],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, answer, started], false, false).toJson());
    shown.set(true);
    await Wait.until(() => expect(element().querySelector(".history strong")).not.toBeNull(), MarkdownWait.coldImport);
    const select = (): void => store().showSubAgent(new MessageFocus("c1", "m3", 2, false, 1));
    select();
    await Wait.until(() => expect(element().querySelector(`${Resources.subAgentStepSelector} nol-tool-call`)).not.toBeNull());
    await settle();
    const press = (target: Element | null): boolean => target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })) ?? false;
    const outside = [`${Resources.subAgentStepSelector}[data-step="2"] nol-tool-call`, ".history strong", "nol-teamrun-composer", ".nol-virtual-list-viewport"]
      .map(t => element().querySelector(t));

    expect(outside.every(t => !Object.isNull(t))).toBe(true);
    expect(press(element().querySelector(`${Resources.subAgentStepSelector}[data-step="1"] nol-tool-call`))).toBe(true);
    expect(store().subAgentFocus()?.step).toBe(1);
    for (const target of outside) {
      select();
      expect(press(target)).toBe(true);
      expect(store().subAgentFocus()).toBeNull();
    }
  });

  describe("with a reply running", () => {
    const running = SampleData.withStatus(answer, MessageStatus.Running);
    let cancel: DeferredResponse;
    let park: HTMLElement | null = null;

    const press = (target: Element, init: KeyboardEventInit = {}): boolean =>
      target.dispatchEvent(new KeyboardEvent("keydown", { key: Resources.escapeKey, bubbles: true, cancelable: true, ...init }));
    const point = (target: Element): boolean => target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const placed = (html: string): Element => {
      const holder = element().querySelector(".history")!.appendChild(document.createElement("div"));
      holder.innerHTML = html;
      return holder.querySelector("[data-focus]")!;
    };

    beforeAll(async () => {
      park = await AppearanceFixture.parkPointerAsync();
    });

    afterAll(() => {
      park?.remove();
      park = null;
    });

    beforeEach(async () => {
      cancel = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, running], false, false).toJson())
        .answer(MethodName.ConversationCancel, () => cancel.promise);
      shown.set(true);
      await Wait.until(() => expect(store().runningReplyOf("c1")?.id).toBe("m2"));
      await settle();
      await Wait.until(() => expect(document.querySelector("nol-tooltip")).toBeNull());
    });

    it.each([
      ["a control in the history", (): Element => placed("<button data-focus></button>")],
      ["the member strip", (): Element => element().querySelector(".members")!],
      ["the composer's field", (): Element => element().querySelector(".nol-teamrun-composer-text")!]
    ])("stops it once on Escape from %s, and leaves Escape alone while it stops and once nothing runs", async (_, target) => {
      expect(press(target())).toBe(false);
      expect(press(target())).toBe(true);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);

      cancel.resolve([SampleData.withStatus(running, MessageStatus.Cancelled).toJson()]);
      await Wait.until(() => expect(store().runningReplyOf("c1")).toBeNull());
      expect(press(target())).toBe(true);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
    });

    it("stops it once on Escape from the page only while its tab is in view and its chat is selected, not from outside the chat", async () => {
      const outside = document.body.appendChild(document.createElement("button"));
      await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
      point(element().querySelector(".members")!);

      const fromOutside = press(outside);
      outside.remove();
      shown.set(false);
      await settle();
      const hidden = press(document.body);
      shown.set(true);
      await settle();
      await store().selectConversation("c2");
      await settle();
      const unselected = press(document.body);
      await store().selectConversation("c1");
      await settle();

      expect([fromOutside, hidden, unselected]).toEqual([true, true, true]);
      expect(context.count(MethodName.ConversationCancel)).toBe(0);
      expect(press(document.body)).toBe(false);
      expect(press(document.body)).toBe(true);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
    });

    it("stops it once on Escape from the page after a click in its history while an opened project sets its chat aside", async () => {
      context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson(), second.toJson()] : [])
        .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
      await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
      await store().openProject(SampleData.otherProject.rootPath);
      const history = element().querySelector("nol-teamrun-history");
      expect(Object.isNull(history) ? false : point(history)).toBe(true);
      await settle();

      expect([store().selectedConversationId(), store().shownConversationId()]).toEqual([null, "c1"]);
      expect(press(document.body)).toBe(false);
      expect(context.parametersOf(MethodName.ConversationCancel)).toEqual({ chatId: "c1" });
    });

    it("leaves Escape from the page alone once the last click or focus was outside TeamRun or on no element, and takes it after one in any TeamRun view", async () => {
      const blank = document.body.appendChild(document.createElement("div"));
      const view = document.body.appendChild(document.createElement("nol-teamrun-projects-view")).appendChild(document.createElement("button"));
      await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));

      point(element().querySelector(".members")!);
      point(blank);
      const afterBlank = press(document.body);
      point(view);
      document.dispatchEvent(new FocusEvent("focusin"));
      const afterDocument = press(document.body);
      point(view);
      view.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      blank.remove();
      view.parentElement!.remove();

      expect([afterBlank, afterDocument]).toEqual([true, true]);
      expect(context.count(MethodName.ConversationCancel)).toBe(0);
      expect(press(document.body)).toBe(false);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
    });

    it("asks once to stop it from the store, Stop, Escape and the reply's own Stop, and keeps Stop disabled while any of them stops it", async () => {
      const stop = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-stop")!;
      await Wait.until(() => expect(element().querySelector(".nol-message-footer .cancel")).not.toBeNull(), MarkdownWait.coldImport);
      const first = store().stop("c1");
      await settle();

      expect(stop().disabled).toBe(true);
      expect(press(element().querySelector(".nol-teamrun-composer-text")!)).toBe(true);
      element().querySelector<HTMLButtonElement>(".nol-message-footer .cancel")!.click();
      expect(await store().stop("c1")).toBe(false);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
      expect(context.count(MethodName.MessageCancel)).toBe(0);
      cancel.resolve([SampleData.withStatus(running, MessageStatus.Cancelled).toJson()]);
      expect(await first).toBe(true);
    });

    it("leaves Escape to a field, menu, list or dialog with the focus, to a control that used it, and with a modifier or while composing", () => {
      const owners = ["<input data-focus>", "<textarea data-focus></textarea>", "<select data-focus></select>", "<div contenteditable data-focus></div>",
        "<div role=\"menu\"><button data-focus></button></div>", "<div role=\"listbox\"><div data-focus></div></div>",
        "<div role=\"dialog\"><button data-focus></button></div>", "<dialog open><button data-focus></button></dialog>"].map(placed);
      const used = placed("<button data-focus></button>");
      used.addEventListener("keydown", event => event.preventDefault());
      const plain = placed("<button data-focus></button>");
      const held: KeyboardEventInit[] = [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { key: "a" }];

      expect(owners.map(t => press(t))).toEqual(owners.map(() => true));
      expect(held.map(t => press(plain, t))).toEqual(held.map(() => true));
      expect(press(used)).toBe(false);
      expect(context.count(MethodName.ConversationCancel)).toBe(0);
      expect(press(placed("<div contenteditable=\"false\"><button data-focus></button></div>"))).toBe(false);
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light },
    { look: "dark", mode: ThemeMode.Dark }
  ])("in $look", ({ mode }) => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));
    afterEach(() => AppearanceFixture.reset());

    it("starts the history right under the teammate row, with no line between them", async () => {
      await Wait.until(() => expect(store().loaded()).toBe(true));
      await settle();
      const members = element().querySelector(".members")!;
      const history = element().querySelector(".history")!;

      AppearanceFixture.expectPixels(history.getBoundingClientRect().top, members.getBoundingClientRect().bottom);
      expect(getComputedStyle(members).borderBottomStyle).toBe("none");
      expect(getComputedStyle(history).borderTopStyle).toBe("none");
    });

    it.each([1_400, 600])("puts the messages in one centred column with the composer's edges, %d px wide", async width => {
      element().style.width = `${width}px`;
      shown.set(true);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message")).toHaveLength(2));
      await settle();
      const card = element().querySelector(".nol-teamrun-composer-card")?.getBoundingClientRect();
      const column = 55 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const host = element().getBoundingClientRect();

      for (const message of element().querySelectorAll<HTMLElement>("nol-teamrun-history-message")) {
        const style = getComputedStyle(message);
        const box = message.getBoundingClientRect();
        AppearanceFixture.expectPixels(box.left + Number.parseFloat(style.paddingLeft), card?.left ?? Number.NaN);
        AppearanceFixture.expectPixels(box.right - Number.parseFloat(style.paddingRight), card?.right ?? Number.NaN);
      }
      AppearanceFixture.expectPixels(((card?.left ?? Number.NaN) + (card?.right ?? Number.NaN)) / 2, (host.left + host.right) / 2);
      if (width > column)
        AppearanceFixture.expectPixels(card?.width ?? Number.NaN, column);
      else
        expect(card?.width).toBeLessThan(column);
    });
  });

  it("shows its conversation while its tab is open, even while another document covers it, and no longer once the tab closes", async () => {
    shown.set(true);
    await Wait.until(() => expect(store().shownConversationId()).toBe("c1"));
    const states: (string | null)[] = [];

    shown.set(false);
    await settle();
    states.push(store().shownConversationId());
    shown.set(true);
    await settle();
    await Wait.until(() => expect(store().shownConversationId()).toBe("c1"));
    states.push(store().shownConversationId());
    fixture.destroy();
    states.push(store().shownConversationId());

    expect(states).toEqual(["c1", "c1", null]);
    expect(store().selectedConversationId()).toBe("c1");
  });

  it("waits for the conversations to load before it shows its conversation in a tab already in view", async () => {
    fixture.destroy();
    ChatStoreService.release(context);
    const listed = new DeferredResponse();
    context.answer(MethodName.ConversationList, () => listed.promise);
    fixture = TestBed.createComponent(ConversationComponent);
    fixture.componentRef.setInput("instance", "c1");
    shown.set(true);
    fixture.detectChanges();
    const before = [store().loaded(), store().shownConversationId(), store().selectedConversationId()];

    listed.resolve([SampleData.conversation.toJson(), second.toJson()]);

    await Wait.until(() => expect(store().shownConversationId()).toBe("c1"));
    expect(before).toEqual([false, null, null]);
  });

  it("keeps a Focus the composer asked for while its tab is hidden, and focuses the composer once the tab shows", async () => {
    shown.set(true);
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
    await settle();
    const field = (): HTMLTextAreaElement | null => element().querySelector<HTMLTextAreaElement>(".nol-teamrun-composer-text");
    await Wait.until(() => expect(field()?.disabled).toBe(false));
    shown.set(false);
    await settle();

    CommandTargetsService.of(context).focusComposer("c1");
    await settle();
    expect(document.activeElement).not.toBe(field());

    shown.set(true);
    await settle();
    await Wait.until(() => expect(document.activeElement).toBe(field()));
  });

  it("follows its conversation's title in the tab, once it changes", async () => {
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await settle();
    expect(context.updates).toEqual([]);

    await store().renameConversation("c1", "Renamed");
    await settle();
    expect(context.updates).toEqual([{ name: "teamrun.conversation", instance: "c1", update: { title: "Renamed" } }]);

    fixture.componentRef.setInput("title", "Renamed");
    await settle();
    expect(context.updates).toHaveLength(1);
  });

  it("selects whichever of two tabs side by side the person moves into, while each keeps its own messages in view", async () => {
    const other = TestBed.createComponent(ConversationComponent);
    other.componentRef.setInput("instance", "c2");
    other.componentRef.setInput("title", "Second");
    (other.nativeElement as HTMLElement).style.height = "600px";
    other.detectChanges();
    const otherElement = other.nativeElement as HTMLElement;
    const settleBoth = async (): Promise<void> => {
      await settle();
      await other.whenStable();
      other.detectChanges();
    };

    shown.set(true);
    await Wait.until(() => expect(store().selectedConversationId()).not.toBeNull());
    otherElement.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c2"));
    await settleBoth();
    await Wait.until(() => expect(otherElement.querySelector(".history em")?.textContent).toBe("second"));

    element().querySelector(".history")?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
    await settleBoth();
    await Wait.until(() => expect(element().querySelector(".history strong")?.textContent).toBe("all"));
    expect(otherElement.querySelector(".history em")?.textContent).toBe("second");

    otherElement.querySelector(".history")?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c2"));
    await settleBoth();
    expect(element().querySelector(".history strong")?.textContent).toBe("all");
    other.destroy();
  });

  it("keeps a project opened while its chat shows as the selection when focus or a click lands back in the chat, until the chat is shown anew", async () => {
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson(), second.toJson()] : [])
      .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    shown.set(true);
    await Wait.until(() => expect(store().selectedConversationId()).toBe("c1"));
    const selection = (): readonly (string | null)[] => [store().selectedProjectId(), store().selectedConversationId()];

    await store().openProject(SampleData.otherProject.rootPath);
    expect(selection()).toEqual([SampleData.otherProject.id, null]);
    expect(element().querySelector(".nol-teamrun-composer-text")?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))).toBe(true);
    expect(element().querySelector(".history")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))).toBe(true);
    await settle();

    expect(selection()).toEqual([SampleData.otherProject.id, null]);
    expect(store().shownConversationId()).toBe("c1");

    shown.set(false);
    await settle();
    shown.set(true);
    await Wait.until(() => expect(selection()).toEqual([SampleData.project.id, "c1"]));
  });

  it("forgets a restored tab whose chat Core no longer has once the conversations load, without an error", async () => {
    context.refuse(MethodName.ConversationListMembers, ErrorCode.NotFound, "Conversation gone was not found.", "gone");
    fixture.componentRef.setInput("instance", "gone");
    await Wait.until(() => expect(store().loaded()).toBe(true));
    await settle();

    await Wait.until(() => expect(context.forgottenDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "gone" }]));
    expect(context.count(MethodName.ConversationListMembers)).toBe(1);
    expect(store().isDeleted("gone")).toBe(true);
    expect(context.noticeText()).toBeNull();
  });

  it("names a tab whose conversation the store does not know by the title it opened with", async () => {
    fixture.componentRef.setInput("instance", "gone");
    fixture.componentRef.setInput("title", "Kept");
    await Wait.until(() => expect(store().loaded()).toBe(true));
    shown.set(true);
    await settle();

    await Wait.until(() => expect(context.count(MethodName.ConversationListMembers)).toBe(1));
    expect(store().selectedConversationId()).toBeNull();
    expect(context.updates).toEqual([]);
    expect(context.forgottenDocuments).toEqual([]);
  });

  describe("announcing replies", () => {
    const working = new Message("m9", "c1", 4, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    const card = new Approval("ap9", "m9", SampleData.approval.kind, SampleData.approval.nativeKind, SampleData.approval.summary, null,
      SampleData.approval.options, SampleData.approval.status, null, SampleData.timestamp, null);
    const asked = [Resources.formatAsks("Codex · Work", "Run a command"), AnnouncementPoliteness.Polite, { key: `${Resources.approvalAskedKeyPrefix}ap9` }];
    const start = async (): Promise<() => unknown[][]> => {
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      await Wait.until(() => expect(store().loaded()).toBe(true));
      shown.set(true);
      await Wait.until(() => expect(store().isHistoryLoaded("c1")).toBe(true));
      await settle();
      context.emit(EventName.MessageCreated, working.toJson());
      await Wait.until(() => expect(store().workingReplies().map(t => t.id)).toEqual(["m9"]));
      await settle();
      return () => announce.mock.calls.filter(t => [Resources.replyEndedKeyPrefix, Resources.approvalAskedKeyPrefix].some(u => String(t[2]?.key).startsWith(u)));
    };

    afterEach(() => vi.restoreAllMocks());

    it("says once, politely, that the teammate replied when a reply in the chat on screen ends, nothing while it streams, and what it asks when a card appears", async () => {
      const said = await start();
      context.emit(EventName.MessageUpdated, SampleData.withStatus(working, MessageStatus.Running, [SampleData.detail(0, DetailKind.Text, "Half a reply")]).toJson());
      context.emit(EventName.ApprovalCreated, card.toJson());
      await Wait.until(() => expect(store().pendingApprovals().map(t => t.id)).toContain("ap9"));
      await settle();
      const streaming = said();
      context.emit(EventName.MessageUpdated, SampleData.withStatus(working, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "A reply")]).toJson());
      await Wait.until(() => expect(store().workingReplies()).toEqual([]));
      await settle();

      expect(streaming).toEqual([asked]);
      expect(said().slice(1)).toEqual([[Resources.formatReplied("Codex · Work"), AnnouncementPoliteness.Polite, { key: `${Resources.replyEndedKeyPrefix}m9` }]]);
    });

    it.each([MessageStatus.Cancelled, MessageStatus.Failed])("says nothing, rather than that the teammate replied, when a reply in the chat on screen ends %s", async status => {
      const said = await start();
      context.emit(EventName.MessageUpdated, SampleData.withStatus(working, status).toJson());
      await Wait.until(() => expect(store().workingReplies()).toEqual([]));
      await settle();

      expect(said()).toEqual([]);
    });

    it("says what the teammate asks when a card appears in a reply of the chat on screen after the reply ended", async () => {
      const said = await start();
      context.emit(EventName.MessageUpdated, SampleData.withStatus(working, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "A reply")]).toJson());
      await Wait.until(() => expect(store().workingReplies()).toEqual([]));
      await settle();
      context.emit(EventName.ApprovalCreated, card.toJson());
      await Wait.until(() => expect(store().pendingApprovals().map(t => t.id)).toContain("ap9"));
      await settle();

      expect(said().slice(1)).toEqual([asked]);
    });

    it("says nothing for a card the store loads with the chat's working reply when the window starts", async () => {
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      fixture.destroy();
      ChatStoreService.release(context);
      context.answer(MethodName.MessageListOpen, () => [working.toJson()]).answer(MethodName.ApprovalListPending, () => [card.toJson()]);
      shown.set(true);
      fixture = TestBed.createComponent(ConversationComponent);
      fixture.componentRef.setInput("instance", "c1");
      fixture.componentRef.setInput("title", "First");
      fixture.detectChanges();
      await Wait.until(() => expect(store().pendingApprovals().map(t => t.id)).toContain("ap9"));
      await Wait.until(() => expect(store().isHistoryLoaded("c1")).toBe(true));
      await settle();

      expect(announce.mock.calls.filter(t => String(t[2]?.key).startsWith(Resources.approvalAskedKeyPrefix))).toEqual([]);
    });

    it("says nothing for a card in an ended reply that the chat's approval list brings when its history loads", async () => {
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      await Wait.until(() => expect(store().loaded()).toBe(true));
      shown.set(true);
      await Wait.until(() => expect(store().isHistoryLoaded("c1")).toBe(true));
      await Wait.until(() => expect(store().pendingApprovals().map(t => t.id)).toEqual([SampleData.approval.id]));
      await settle();

      expect([store().historyOf("c1")?.find(SampleData.approval.messageId)?.status, announce.mock.calls.filter(t => String(t[2]?.key).startsWith(Resources.approvalAskedKeyPrefix))])
        .toEqual([MessageStatus.Completed, []]);
    });

    it("says nothing when a reply ends while its chat's tab is hidden", async () => {
      const said = await start();
      shown.set(false);
      await settle();
      context.emit(EventName.MessageUpdated, SampleData.withStatus(working, MessageStatus.Completed).toJson());
      await Wait.until(() => expect(store().workingReplies()).toEqual([]));
      await settle();

      expect(said()).toEqual([]);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the conversation visible under forced colours", async () => {
      shown.set(true);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message")).toHaveLength(2));
      await settle();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the conversation at 200% zoom", async () => {
      shown.set(true);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message")).toHaveLength(2));
      await settle();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), async () => {
        element().style.height = "100vh";
        await settle();
      });
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the conversation by keyboard, with a visible ring", async () => {
      shown.set(true);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message")).toHaveLength(2));
      await settle();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the conversation", async () => {
      shown.set(true);
      await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message")).toHaveLength(2));
      await settle();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });

  it("reads the chat folder's GitHub repository again each time the chat opens, so a remote changed since links its bare #N", async () => {
    let path = "octocat/old";
    context.answerModule("git.status", () => new GitStatus("main", null, null, [], false, "f1", null, new GitRemote("origin", "github.com", path, RemoteTransport.Https))
      .toJson());
    GitHubReferenceSource.register(context);
    let reopened: ComponentFixture<ConversationComponent> | null = null;
    try {
      await Wait.until(() => expect(store().folderOf("c1")).toBe(SampleData.project.rootPath));
      const home = GitHubReferenceSource.of(context)?.homeOf(SampleData.project.rootPath);
      await Wait.until(() => expect(home?.()).toBe("octocat/old"));

      path = "octocat/hello-world";
      reopened = TestBed.createComponent(ConversationComponent);
      reopened.componentRef.setInput("instance", "c1");
      reopened.componentRef.setInput("title", "First");
      reopened.detectChanges();

      await Wait.until(() => expect(home?.()).toBe("octocat/hello-world"));
      expect(context.requests.filter(t => t.method === "git.status").map(t => t.parameters))
        .toEqual([{ folder: SampleData.project.rootPath }, { folder: SampleData.project.rootPath }]);
    }
    finally {
      reopened?.destroy();
      GitHubReferenceSource.release(context);
    }
  });
});

describe("ConversationComponent's idle preload", () => {
  const idleTime: number = 50;

  afterEach(() => vi.unstubAllGlobals());

  it("loads the code languages replies use most once the window is idle, such as Python, before any reply shows one", async () => {
    const started = performance.now();
    const timings: string[] = [];
    const stamp = (what: string, at: number = performance.now()): string => `${what} at ${Math.round(at - started)} ms`;
    let idleSteps = 0;
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback): number => {
      idleSteps += 1;
      const step = idleSteps;
      timings.push(stamp(`idle step ${step} asked`));
      return window.setTimeout(() => {
        timings.push(stamp(`idle step ${step} ran`));
        callback({ didTimeout: false, timeRemaining: () => idleTime });
        timings.push(stamp(`idle step ${step} returned`));
      });
    });
    vi.stubGlobal("cancelIdleCallback", (handle: number): void => window.clearTimeout(handle));
    const context = SampleData.createContext();
    TestBed.configureTestingModule({
      imports: [ConversationComponent],
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(false).asReadonly() }]
    });
    const idle = TestBed.createComponent(ConversationComponent);
    idle.componentRef.setInput("instance", "c1");
    idle.componentRef.setInput("title", "First");
    idle.detectChanges();
    const highlighting = idle.debugElement.query(By.directive(HistoryComponent)).injector;
    const loaded = (): readonly string[] => Resources.preloadedCodeLanguages.filter(t => CodeHighlightingFixture.isLanguageLoaded(highlighting, t));
    const progress = (): number => idleSteps + loaded().length;
    const timeline = (): string => [...timings, `languages loaded: ${loaded().join(", ")}`, ...performance.getEntriesByType("resource")
      .filter(t => t.startTime >= started && new URL(t.name).pathname.endsWith(".js"))
      .map(t => `${stamp(`${new URL(t.name).pathname} fetch started`, t.startTime)}, ${stamp("ended", t.startTime + t.duration)}`), stamp("checked")].join("; ");
    try {
      for (let steps = progress(); !loaded().includes("python"); steps = progress())
        await Wait.until(() => expect(progress() > steps || loaded().includes("python"), timeline()).toBe(true), MarkdownWait.coldImport);
    }
    finally {
      idle.destroy();
      ChatStoreService.release(context);
    }
  }, 6 * MarkdownWait.coldImport.timeout);
});
