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
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  ApprovalStatus,
  EventName,
  Message,
  MessageAuthor,
  MessageStatus,
  MethodName,
  QuestionAnswer,
  QuestionOption
} from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { QuestionCardComponent } from "../../../../src/app/components/question-card/question-card.component";
import { ReplyApprovalsComponent } from "../../../../src/app/components/reply-approvals/reply-approvals.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("QuestionCardComponent", () => {
  const decidedAt = "2026-09-10T08:05:00.000Z";
  const reply = new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
    SampleData.timestamp, null, [], "alice", "Alice");
  const options = [
    new ApprovalOption("answer", "Answer", ApprovalOutcome.Approved, ApprovalScope.Once),
    new ApprovalOption("skip", "Skip", ApprovalOutcome.Denied, ApprovalScope.Once)
  ];
  const platform = new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window"), new QuestionOption("Web", "A browser")],
    false, true, false);
  const parts = new ApprovalQuestion("parts", "Parts", "Which parts?", [new QuestionOption("Attachments", "Files"), new QuestionOption("Slash commands", String.empty)],
    true, true, false);
  const token = new ApprovalQuestion("token", "Token", "Which token?", [], false, true, true);
  const asking = (questions: readonly ApprovalQuestion[] = [platform, parts], payload: Approval["payload"] = null): Approval => new Approval("q1", "m2",
    ApprovalKind.Question, "AskUserQuestion", questions[0]!.text, payload, options, ApprovalStatus.Pending, null, SampleData.timestamp, null, questions);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ReplyApprovalsComponent>;

  const render = async (approval: Approval = asking(), shown: Message = reply): Promise<ChatStoreService> => {
    context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.selectConversation("c1");
    fixture = TestBed.createComponent(ReplyApprovalsComponent);
    fixture.componentRef.setInput("reply", shown);
    await fixture.whenStable();
    return store;
  };
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const card = (): HTMLElement => root().querySelector<HTMLElement>("nol-teamrun-question-card")!;
  const all = (selector: string): HTMLElement[] => [...root().querySelectorAll<HTMLElement>(selector)];
  const texts = (selector: string): (string | undefined)[] => all(selector).map(t => t.textContent?.trim());
  const textOf = (selector: string): string | undefined => root().querySelector(selector)?.textContent?.trim();
  const row = (label: string): HTMLElement => all(".nol-choice-row").find(t => t.querySelector(".nol-choice-row-label")?.textContent?.trim() === label)!;
  const choice = (label: string): HTMLInputElement => row(label).querySelector("input")!;
  const isDisabled = (input: HTMLInputElement): boolean => input.getAttribute("aria-disabled") === "true";
  const others = (): HTMLInputElement[] => all(".nol-teamrun-question-other") as HTMLInputElement[];
  const submit = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-question-card-submit")!;
  const skip = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-question-card-skip")!;
  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await fixture.whenStable();
  };
  const type = async (field: HTMLInputElement, text: string): Promise<void> => {
    field.value = text;
    field.dispatchEvent(new Event("input"));
    await fixture.whenStable();
  };
  const decided = (): ApprovalDecideParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ApprovalDecide))
    .map(t => ApprovalDecideParams.fromJson(t.parameters));
  const sent = (): unknown[] => decided().map(t => [t.optionId, t.answers?.map(u => u.toJson()) ?? null]);
  const redraw = async (): Promise<void> => {
    fixture.destroy();
    fixture = TestBed.createComponent(ReplyApprovalsComponent);
    fixture.componentRef.setInput("reply", reply);
    await fixture.whenStable();
  };

  beforeEach(() => {
    context = SampleData.createContext();
  });

  afterEach(() => {
    ChatStoreService.release(context);
    vi.useRealTimers();
  });

  it("shows the teammate's questions with their headers, choices, Pick any and Other field, and keeps Answer off until each has an answer", async () => {
    await render();

    expect(textOf(".nol-teamrun-question-card-heading")).toBe("Alice asks you");
    expect([all(".nol-teamrun-question-card-asker").length, card().getAttribute("aria-describedby")]).toEqual([0, null]);
    expect(card().getAttribute("role")).toBe("group");
    expect(texts(".nol-teamrun-question-header")).toEqual(["Platform", "Parts"]);
    expect(texts(".nol-teamrun-question-hint")).toEqual(["Pick any"]);
    expect(texts(".nol-teamrun-question-text")).toEqual(["Which platform?", "Which parts?"]);
    expect(all(".nol-teamrun-question").map(t => t.getAttribute("role"))).toEqual([null, "group"]);
    expect(all(".nol-teamrun-question nol-radio-group").map(t => [t.getAttribute("role"), t.getAttribute("aria-label")])).toEqual([["radiogroup", "Which platform?"]]);
    expect(texts(".nol-choice-row-label")).toEqual(["Desktop app", "Web", "Attachments", "Slash commands"]);
    expect(texts(".nol-choice-row-description")).toEqual(["The window", "A browser", "Files"]);
    expect(all(".nol-choice-row input").map(t => (t as HTMLInputElement).type)).toEqual(["radio", "radio", "checkbox", "checkbox"]);
    expect(new Set([choice("Desktop app").name, choice("Web").name]).size).toBe(1);
    expect(choice("Web").name).not.toBe(String.empty);
    expect(others().map(t => [t.type, t.placeholder])).toEqual([["text", "Other…"], ["text", "Other…"]]);
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    expect(skip().getAttribute("aria-disabled")).toBeNull();

    await click(submit());
    await click(choice("Web"));
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    await click(choice("Attachments"));
    expect(submit().getAttribute("aria-disabled")).toBeNull();
    await click(choice("Attachments"));
    expect([choice("Attachments").checked, submit().getAttribute("aria-disabled")]).toEqual([false, "true"]);
    await click(choice("Attachments"));

    expect(submit().getAttribute("aria-disabled")).toBeNull();
    expect(decided()).toEqual([]);
  });

  it("asks a question that takes only its options, with no header, for a reply that names no teammate, and folds it under its text", async () => {
    const size = new ApprovalQuestion("size", String.empty, "Which size?", [new QuestionOption("Small", String.empty), new QuestionOption("Large", String.empty)],
      false, false, false);
    const unnamed = new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null, []);
    context.answer(MethodName.ApprovalDecide, () => asking([size]).withDecision("answer", decidedAt, [new QuestionAnswer("size", ["Large"], null)]).toJson());
    await render(asking([size]), unnamed);

    expect(textOf(".nol-teamrun-question-card-heading")).toBe("Codex · Work asks you");
    expect(all(".nol-teamrun-question-title")).toEqual([]);
    expect(others()).toEqual([]);
    await click(choice("Large"));
    await click(submit());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You answered Codex · Work"));
    expect(sent()).toEqual([["answer", [{ questionId: "size", choices: ["Large"], text: null }]]]);
    expect(texts(".nol-teamrun-question-card-label")).toEqual(["Which size?"]);
    expect(texts(".nol-teamrun-question-card-reply")).toEqual(["Large"]);
  });

  it("sends the picked and typed answers, shows them on their way, and folds to each header and its answers once answered", async () => {
    const answer = new DeferredResponse();
    context.answer(MethodName.ApprovalDecide, () => answer.promise);
    await render();

    await click(choice("Web"));
    await click(choice("Desktop app"));
    await click(choice("Slash commands"));
    await click(choice("Attachments"));
    await type(others()[1]!, "Themes");
    await click(submit());
    await Wait.until(() => expect(submit().getAttribute("aria-busy")).toBe("true"));
    expect([submit().getAttribute("aria-disabled"), skip().getAttribute("aria-disabled"), skip().getAttribute("aria-busy")]).toEqual([null, "true", null]);
    expect(root().querySelector(".nol-teamrun-question-card-sending")).toBeNull();
    expect(isDisabled(choice("Web"))).toBe(true);
    await click(submit());
    await click(skip());
    const answers = [new QuestionAnswer("platform", ["Desktop app"], null), new QuestionAnswer("parts", ["Attachments", "Slash commands"], "Themes")];
    answer.resolve(asking().withDecision("answer", decidedAt, answers).toJson());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You answered Alice"));
    expect(sent()).toEqual([["answer", answers.map(t => t.toJson())]]);
    expect(texts(".nol-teamrun-question-card-label")).toEqual(["Platform", "Parts"]);
    expect(texts(".nol-teamrun-question-card-reply")).toEqual(["Desktop app", "Attachments, Slash commands, Themes"]);
    expect(all(".nol-choice-row")).toEqual([]);
    expect(root().querySelector(".nol-teamrun-question-card-submit")).toBeNull();
  });

  it("clears a single choice's Other text when an option is picked, and its pick when Other text is typed", async () => {
    context.answer(MethodName.ApprovalDecide, () => asking([platform]).withDecision("answer", decidedAt, [new QuestionAnswer("platform", [], "Both")]).toJson());
    await render(asking([platform]));

    await type(others()[0]!, "Linux");
    await click(choice("Web"));
    expect([others()[0]!.value, choice("Web").checked]).toEqual([String.empty, true]);
    await type(others()[0]!, "Both");
    expect(all(".nol-choice-row input").filter(t => (t as HTMLInputElement).checked)).toEqual([]);
    await click(submit());

    await Wait.until(() => expect(texts(".nol-teamrun-question-card-reply")).toEqual(["Both"]));
    expect(sent()).toEqual([["answer", [{ questionId: "platform", choices: [], text: "Both" }]]]);
  });

  it("masks what a secret question's answer types, sends it, and folds it as hidden since it isn't kept", async () => {
    context.answer(MethodName.ApprovalDecide, () => asking([platform, token]).withDecision("answer", decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());
    await render(asking([platform, token]));

    expect(others().map(t => [t.type, t.placeholder, t.autocomplete])).toEqual([["text", "Other…", "off"], ["password", "Your answer", "off"]]);
    await click(choice("Web"));
    await type(others()[1]!, "  ");
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    await type(others()[1]!, "s3cret");
    await click(submit());

    await Wait.until(() => expect(texts(".nol-teamrun-question-card-reply")).toEqual(["Web", "Hidden"]));
    expect(sent()).toEqual([["answer", [{ questionId: "platform", choices: ["Web"], text: null }, { questionId: "token", choices: [], text: "s3cret" }]]]);
  });

  it("skips the questions without answers, Skip busy while it sends, and folds to say so", async () => {
    const skipping = new DeferredResponse();
    context.answer(MethodName.ApprovalDecide, () => skipping.promise);
    await render();

    await click(choice("Web"));
    await click(skip());
    await Wait.until(() => expect(skip().getAttribute("aria-busy")).toBe("true"));
    expect([skip().getAttribute("aria-disabled"), submit().getAttribute("aria-busy"), submit().getAttribute("aria-disabled")]).toEqual([null, null, "true"]);
    skipping.resolve(asking().withDecision("skip", decidedAt).toJson());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You skipped Alice's questions"));
    expect(sent()).toEqual([["skip", null]]);
    expect(root().querySelector(".nol-teamrun-question-card-summary")).toBeNull();
  });

  it("says when the answer couldn't be sent, keeps what was picked, and sends it again on Answer", async () => {
    context.fail(MethodName.ApprovalDecide, "The runtime part is gone");
    await render(asking([platform]));

    await click(choice("Web"));
    await click(submit());
    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-failed")).toBe("Your answer couldn't be sent. Try again."));
    expect(root().querySelector(".nol-teamrun-question-card-failed")?.getAttribute("role")).toBe("alert");
    expect([submit().getAttribute("aria-busy"), submit().getAttribute("aria-disabled"), skip().getAttribute("aria-busy"), skip().getAttribute("aria-disabled")])
      .toEqual([null, null, null, null]);
    expect(choice("Web").checked).toBe(true);
    expect(context.noticeText()).toContain("The runtime part is gone");
    context.answer(MethodName.ApprovalDecide, () => asking([platform]).withDecision("answer", decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());
    await click(submit());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You answered Alice"));
    expect(sent().map(t => (t as unknown[])[0])).toEqual(["answer", "answer"]);
  });

  it("says the answer is on its way once for each send, again when sent after a failure, and not again when the card is drawn again", async () => {
    const [first, second] = [Date.parse(decidedAt), Date.parse(decidedAt) + 1_000];
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(first);
    let release: () => void = () => undefined;
    context.answer(MethodName.ApprovalDecide, () => new Promise((_, reject) => {
      release = () => reject(new Error("The runtime part is gone"));
    }));
    await render(asking([platform]));
    const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
    const sending = (): [unknown, unknown][] => announce.mock.calls.filter(t => t[0] === Resources.questionSending).map(t => [t[1], t[2]?.key]);
    const timeOf = (key: unknown): number => Number(String(key).replace(`${Resources.questionSendingKeyPrefix}q1-`, ""));

    await click(choice("Web"));
    await click(submit());
    await Wait.until(() => expect(submit().getAttribute("aria-busy")).toBe("true"));
    const firstKey = sending()[0]?.[1];
    expect(sending()).toEqual([[AnnouncementPoliteness.Polite, firstKey]]);
    expect(timeOf(firstKey)).toBeGreaterThanOrEqual(first);
    expect(timeOf(firstKey)).toBeLessThan(second);
    release();
    await Wait.until(() => expect(root().querySelector(".nol-teamrun-question-card-failed")).not.toBeNull());
    const answer = new DeferredResponse();
    context.answer(MethodName.ApprovalDecide, () => answer.promise);
    vi.setSystemTime(second);
    await click(submit());
    await Wait.until(() => expect(submit().getAttribute("aria-busy")).toBe("true"));
    await redraw();

    expect(submit().getAttribute("aria-busy")).toBe("true");
    const secondKey = sending()[1]?.[1];
    expect(sending()).toEqual([[AnnouncementPoliteness.Polite, firstKey], ...[0, 1].map(() => [AnnouncementPoliteness.Polite, secondKey])]);
    expect(timeOf(secondKey)).toBeGreaterThanOrEqual(second);
    answer.resolve(asking([platform]).withDecision("answer", decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());
    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You answered Alice"));
  });

  it("says the questions were withdrawn when the reply's run withdraws them", async () => {
    await render();

    context.emit(EventName.ApprovalUpdated, asking().withCancellation(decidedAt).toJson());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("Alice's questions were withdrawn"));
    expect(all(".nol-teamrun-question")).toEqual([]);
    expect(root().querySelector(".nol-teamrun-question-card-summary")).toBeNull();
  });

  it("forgets the typed text, a secret's too, once the questions are no longer open", async () => {
    await render(asking([platform, token]));
    const typed = (): ReadonlyMap<string, string> =>
      (fixture.debugElement.query(By.directive(QuestionCardComponent)).componentInstance as unknown as { texts: () => ReadonlyMap<string, string> }).texts();

    await type(others()[0]!, "Tablet");
    await type(others()[1]!, "s3cret");
    expect([...typed().values()]).toEqual(["Tablet", "s3cret"]);
    context.emit(EventName.ApprovalUpdated, asking([platform, token]).withCancellation(decidedAt).toJson());

    await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("Alice's questions were withdrawn"));
    expect([...typed().values()]).toEqual([]);
  });

  it("names the sub-agent that asks under the heading, as its approvals do", async () => {
    await render(asking([platform], { subAgent: "Explore the parser" }));
    const asker = root().querySelector<HTMLElement>(".nol-teamrun-question-card-asker")!;

    expect([textOf(".nol-teamrun-question-card-heading"), asker.textContent?.trim()]).toEqual(["Alice asks you", "Explore the parser asks"]);
    expect(card().getAttribute("aria-describedby")).toBe(asker.id);
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

    it("lines the card's text, choices, Other fields and buttons up on its padding, at its full width", async () => {
      await render();
      root().style.width = "30rem";
      await click(choice("Web"));
      const host = card().getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");
      const start = host.left + inset;
      const end = host.right - inset;
      const rows = all(".nol-choice-row").map(t => t.getBoundingClientRect());
      const [first, second, third, fourth] = rows;

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(host.width, AppearanceFixture.toPixels(30));
      for (const element of [...all(".nol-teamrun-question-card-heading"), ...all(".nol-teamrun-question-text"), ...all(".nol-teamrun-question-title"), ...others()])
        AppearanceFixture.expectPixels(element.getBoundingClientRect().left, start);
      for (const element of [...all(".nol-choice-row"), ...others()]) {
        AppearanceFixture.expectPixels(element.getBoundingClientRect().left, start);
        AppearanceFixture.expectPixels(element.getBoundingClientRect().right, end);
      }
      AppearanceFixture.expectPixels(second!.top, first!.bottom);
      AppearanceFixture.expectPixels(fourth!.top, third!.bottom);
      AppearanceFixture.expectPixels(submit().getBoundingClientRect().left, start);
      AppearanceFixture.expectPixels(skip().getBoundingClientRect().left - submit().getBoundingClientRect().right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(host.bottom - submit().getBoundingClientRect().bottom, inset);
    });

    it("sets the sub-agent that asks a step under the heading, on the card's text edge, in muted text, and keeps the questions a section below it", async () => {
      await render(asking([platform], { subAgent: "Explore the parser and the lexer with a description long enough to wrap" }));
      root().style.width = "16rem";
      await fixture.whenStable();
      const host = card().getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");
      const heading = root().querySelector(".nol-teamrun-question-card-heading")!.getBoundingClientRect();
      const element = root().querySelector<HTMLElement>(".nol-teamrun-question-card-asker")!;
      const asker = element.getBoundingClientRect();
      const question = root().querySelector(".nol-teamrun-question-title")!.getBoundingClientRect();

      AppearanceFixture.expectPixels(heading.top, host.top + inset);
      AppearanceFixture.expectPixels(asker.top - heading.bottom, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(asker.left, host.left + inset);
      AppearanceFixture.expectPixels(asker.right, host.right - inset);
      AppearanceFixture.expectPixels(question.top - asker.bottom, AppearanceFixture.measureLook("space-3"));
      expect(asker.height).toBeGreaterThan(Number.parseFloat(getComputedStyle(element).lineHeight) * 1.5);
      expect(getComputedStyle(element).fontSize).toBe(getComputedStyle(root().querySelector(".nol-teamrun-question-text")!).fontSize);
      if (forcedColors === "none")
        expect(getComputedStyle(element).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("sets each choice's mark on its label's first line, its text a step after the mark, and shows the pick by the mark alone", async () => {
      await render();
      await click(choice("Web"));
      const [desktop, web] = [row("Desktop app"), row("Web")];
      const box = choice("Web").getBoundingClientRect();
      const bounds = web.getBoundingClientRect();
      const name = web.querySelector(".nol-choice-row-label")!.getBoundingClientRect();
      const description = web.querySelector(".nol-choice-row-description")!.getBoundingClientRect();

      AppearanceFixture.expectPixels(box.left, bounds.left + AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(name.left - box.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(description.left, name.left);
      AppearanceFixture.expectPixels(name.top, bounds.top + AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box.top + box.height / 2, name.top + name.height / 2);
      AppearanceFixture.expectPixels(box.width, AppearanceFixture.measureLook("checkbox-size"));
      expect([choice("Web").checked, choice("Desktop app").checked]).toEqual([true, false]);
      expect(getComputedStyle(web.querySelector(".nol-radio-dot")!).visibility).toBe("visible");
      expect(getComputedStyle(desktop.querySelector(".nol-radio-dot")!).visibility).toBe("hidden");
      expect(getComputedStyle(web).backgroundColor).toBe(getComputedStyle(desktop).backgroundColor);
      expect(getComputedStyle(web).borderTopWidth).toBe("0px");
      if (forcedColors === "none")
        expect(getComputedStyle(web.querySelector(".nol-choice-row-description")!).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("centres a box on its label's first line and wraps a long label and description beside it at a narrow width", async () => {
      const long = new ApprovalQuestion("parts", "Parts", "Which parts?", [new QuestionOption("Attachments, slash commands and the composer's mention list",
        "Files and images dropped on the composer or picked from the disk")], true, false, false);
      await render(asking([long]));
      root().style.width = "16rem";
      await fixture.whenStable();
      const option = all(".nol-choice-row")[0]!;
      await click(option.querySelector("input")!);
      const bounds = option.getBoundingClientRect();
      const box = option.querySelector("input")!.getBoundingClientRect();
      const mark = option.querySelector(".nol-checkbox-mark")!.getBoundingClientRect();
      const nameElement = option.querySelector<HTMLElement>(".nol-choice-row-label")!;
      const descriptionElement = option.querySelector<HTMLElement>(".nol-choice-row-description")!;
      const name = nameElement.getBoundingClientRect();
      const description = descriptionElement.getBoundingClientRect();
      const line = Number.parseFloat(getComputedStyle(nameElement).lineHeight);

      expect(option.querySelector("input")!.type).toBe("checkbox");
      expect(name.height).toBeGreaterThan(line * 1.5);
      expect(description.height).toBeGreaterThan(Number.parseFloat(getComputedStyle(descriptionElement).lineHeight) * 1.5);
      AppearanceFixture.expectPixels(box.top + box.height / 2, name.top + line / 2);
      AppearanceFixture.expectPixels(mark.top + mark.height / 2, box.top + box.height / 2);
      AppearanceFixture.expectPixels(mark.left + mark.width / 2, box.left + box.width / 2);
      AppearanceFixture.expectPixels(name.left - box.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(description.left, name.left);
      AppearanceFixture.expectPixels(description.top, name.bottom);
      expect(Math.max(name.right, description.right)).toBeLessThanOrEqual(bounds.right - AppearanceFixture.measureLook("space-3") + 0.5);
      AppearanceFixture.expectPixels(bounds.bottom - description.bottom, AppearanceFixture.measureLook("space-2"));
      expect(card().scrollWidth).toBeLessThanOrEqual(card().clientWidth);
    });

    it("sets the failure note on the card's padding above the buttons, and sends with Answer busy at its own size and no spinner beside it", async () => {
      context.fail(MethodName.ApprovalDecide, "The runtime part is gone");
      await render(asking([platform]));
      root().style.width = "30rem";
      await click(choice("Web"));
      await click(submit());
      await Wait.until(() => expect(root().querySelector(".nol-teamrun-question-card-failed")).not.toBeNull());
      await fixture.whenStable();
      const host = card().getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");
      const failed = root().querySelector(".nol-teamrun-question-card-failed")!.getBoundingClientRect();
      const question = all(".nol-teamrun-question")[0]!.getBoundingClientRect();
      const actions = root().querySelector(".nol-teamrun-question-card-answer")!.getBoundingClientRect();

      AppearanceFixture.expectPixels(failed.left, host.left + inset);
      expect(failed.right).toBeLessThanOrEqual(host.right - inset + 0.5);
      AppearanceFixture.expectPixels(failed.top - question.bottom, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(actions.top - failed.bottom, AppearanceFixture.measureLook("space-3"));

      const answer = new DeferredResponse();
      context.answer(MethodName.ApprovalDecide, () => answer.promise);
      const idle = submit().getBoundingClientRect();
      const skipped = skip().getBoundingClientRect();
      await click(submit());
      await Wait.until(() => expect(submit().getAttribute("aria-busy")).toBe("true"));
      const button = submit().getBoundingClientRect();

      AppearanceFixture.expectPixels(button.width, idle.width);
      AppearanceFixture.expectPixels(button.height, idle.height);
      AppearanceFixture.expectPixels(skip().getBoundingClientRect().left, skipped.left);
      expect(root().querySelectorAll("nol-spinner")).toHaveLength(1);
      expect(submit().querySelector("nol-spinner")).not.toBeNull();
      expect(root().querySelector(".nol-teamrun-question-card-sending")).toBeNull();
      answer.resolve(asking([platform]).withDecision("answer", decidedAt, [new QuestionAnswer("platform", ["Web"], null)]).toJson());
      await Wait.until(() => expect(textOf(".nol-teamrun-question-card-heading")).toBe("You answered Alice"));
    });

    it.each([
      { state: "skipped", heading: "You skipped Alice's questions", approval: (): Approval => asking().withDecision("skip", decidedAt) },
      { state: "withdrawn", heading: "Alice's questions were withdrawn", approval: (): Approval => asking().withCancellation(decidedAt) }
    ])("folds a $state card to its heading alone on its padding", async ({ heading, approval }) => {
      await render(approval());
      root().style.width = "30rem";
      await fixture.whenStable();
      const host = card().getBoundingClientRect();
      const element = root().querySelector<HTMLElement>(".nol-teamrun-question-card-heading")!;
      const text = element.getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");

      expect(element.textContent?.trim()).toBe(heading);
      expect(card().children).toHaveLength(1);
      AppearanceFixture.expectPixels(text.left, host.left + inset);
      AppearanceFixture.expectPixels(text.right, host.right - inset);
      AppearanceFixture.expectPixels(text.top - host.top, inset);
      AppearanceFixture.expectPixels(host.bottom - text.bottom, inset);
      if (forcedColors === "none")
        expect(getComputedStyle(element).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-strong"));
    });

    it("folds an answered card to rows of its header and answers, each answer a step after its header", async () => {
      await render(asking().withDecision("answer", decidedAt, [new QuestionAnswer("platform", ["Web"], null), new QuestionAnswer("parts", ["Attachments"], null)]));
      root().style.width = "30rem";
      await fixture.whenStable();
      const host = card().getBoundingClientRect();
      const rows = all(".nol-teamrun-question-card-row").map(t => t.getBoundingClientRect());
      const labels = all(".nol-teamrun-question-card-label").map(t => t.getBoundingClientRect());
      const replies = all(".nol-teamrun-question-card-reply").map(t => t.getBoundingClientRect());
      const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");

      for (const [index, label] of labels.entries()) {
        AppearanceFixture.expectPixels(label.left, host.left + inset);
        AppearanceFixture.expectPixels(replies[index]!.left - label.right, AppearanceFixture.measureLook("space-2"));
      }
      AppearanceFixture.expectPixels(rows[1]!.top - rows[0]!.bottom, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(host.bottom - rows[1]!.bottom, inset);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in a reply's question card visible under forced colours", async () => {
      await render();
      expect(await AccessibilityFixture.expectVisibleForcedAsync(root())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in a reply's question card at 200% zoom", async () => {
      await render();
      await AccessibilityFixture.expectFitsZoomedAsync(root(), () => fixture.whenStable());
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in a reply's question card by keyboard, with a visible ring", async () => {
      await render();
      expect(await AccessibilityFixture.expectKeyboardAsync(root())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in a reply's question card", async () => {
      await render();
      expect(AccessibilityFixture.expectNamed(root())).toBeGreaterThan(0);
    });
  });
});
