/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
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
  DetailKind,
  ErrorCode,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  MethodName,
  ObservedSettings,
  Provenance,
  QuestionOption,
  RequestedSettings
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ReplyApprovalsComponent } from "../../../../src/app/components/reply-approvals/reply-approvals.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { FocusRing } from "../../../fixtures/focus-ring.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ReplyApprovalsComponent", () => {
  const decidedAt = "2026-09-10T08:05:00.000Z";
  const reply = new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
    SampleData.timestamp, null, [], "alice", "Alice");
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ReplyApprovalsComponent>;

  const render = async (shown: Message = reply): Promise<ChatStoreService> => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.selectConversation("c1");
    fixture = TestBed.createComponent(ReplyApprovalsComponent);
    fixture.componentRef.setInput("reply", shown);
    await fixture.whenStable();
    return store;
  };
  const redraw = async (): Promise<void> => {
    fixture.destroy();
    fixture = TestBed.createComponent(ReplyApprovalsComponent);
    fixture.componentRef.setInput("reply", reply);
    await fixture.whenStable();
  };
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const cards = (): HTMLElement[] => [...root().querySelectorAll<HTMLElement>("nol-permission-card")];
  const textOf = (selector: string): string | undefined => root().querySelector(selector)?.textContent?.trim();
  const option = (id: string): HTMLButtonElement | null => root().querySelector<HTMLButtonElement>(`[data-nol-option="${id}"]`);
  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await fixture.whenStable();
  };
  const decided = (): ApprovalDecideParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ApprovalDecide))
    .map(t => ApprovalDecideParams.fromJson(t.parameters));
  const gone = (): Promise<void> => Wait.until(() => expect(cards()).toEqual([]));
  const askPlatform = (): Approval => {
    const options = [new ApprovalOption(Resources.answerOptionId, "Answer", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption(Resources.skipOptionId, "Skip", ApprovalOutcome.Denied, ApprovalScope.Once)];
    const platform = new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window"), new QuestionOption("Web", "A browser")],
      false, true, false);
    return new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", platform.text, null, options, ApprovalStatus.Pending, null, SampleData.timestamp, null,
      [platform]);
  };

  const browserStep = (sequence: number, tool: string, fields: JsonObject = {}): MessageDetail => new MessageDetail(sequence, DetailKind.Note,
    `mcp__teamrun__${tool}`, { tool: `mcp__teamrun__${tool}`, toolUseId: `tu-${sequence}`, servedTool: tool, servedInput: {},
      page: { url: "https://shop.test/cart", title: "Cart" }, ...fields }, SampleData.timestamp);
  const browsed = (details: readonly MessageDetail[]): Message => new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, details,
    SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null, [], "alice", "Alice");
  const done = (sequence: number, call: number): MessageDetail => new MessageDetail(sequence, DetailKind.Note, "done", { toolUseId: `tu-${call}`, isError: false },
    SampleData.timestamp);
  const lowRiskSteps = [
    browserStep(0, "browser_snapshot"),
    done(1, 0),
    browserStep(2, "browser_click", { element: { role: "button", name: "Search", isSecret: false }, permission: { risk: "Low", decision: "AllowedOnce", isRemembered: false, isAsked: false } }),
    done(3, 2),
    browserStep(4, "browser_type", { element: { role: "textbox", name: "Card number", isSecret: false } })
  ];
  const lowRiskLine = (): HTMLElement | null => root().querySelector<HTMLElement>(".nol-teamrun-low-risk-line");
  const required = (selector: string): HTMLElement => {
    const found = root().querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`${selector} is missing.`);
    return found;
  };

  beforeEach(() => {
    context = SampleData.createContext();
  });

  afterEach(() => {
    ChatStoreService.release(context);
  });

  it("shows a pending approval in its reply with what the teammate asks to do", async () => {
    await render();

    expect(cards()).toHaveLength(1);
    expect(textOf(".nol-permission-card-heading")).toBe("Run a command");
    expect(textOf(".nol-permission-card-requester")).toBe("Alice, Teammate");
    expect(textOf(".nol-permission-card-code")).toBe("run tests\nKind: exec");
    expect([option("yes")?.textContent?.trim(), option("no")?.textContent?.trim()]).toEqual(["Approve", "Deny"]);
  });

  it("says the reply's provider and the request's kind in plain words under its heading, not the provider's own kind", async () => {
    await render();
    const ask = (id: string, kind: ApprovalKind, nativeKind: string): Approval => new Approval(id, "m2", kind, nativeKind, "run tests", null,
      SampleData.approval.options, ApprovalStatus.Pending, null, SampleData.timestamp, null);
    context.emit(EventName.ApprovalCreated, ask("ap2", ApprovalKind.Command, "commandExecution").toJson());
    context.emit(EventName.ApprovalCreated, ask("ap3", ApprovalKind.FileChange, "fileChange").toJson());
    await Wait.until(() => expect(cards()).toHaveLength(3));
    const shown = cards().slice(1).map(card => {
      const heading = card.querySelector(".nol-permission-card-heading")!.getBoundingClientRect();
      const kind = card.querySelector<HTMLElement>(".nol-permission-card-kind");
      return [kind?.textContent?.trim(), (kind?.getBoundingClientRect().top ?? Number.NaN) >= heading.bottom, kind?.getBoundingClientRect().left === heading.left];
    });

    expect(shown).toEqual([["Codex · command", true, true], ["Codex · file change", true, true]]);
    expect(cards().slice(1).map(t => [t.querySelector(".nol-permission-card-heading")?.textContent?.trim(), t.querySelector(".nol-permission-card-code")?.textContent]))
      .toEqual([["Run a command", "run tests\nKind: commandExecution"], ["Change files", "run tests\nKind: fileChange"]]);
  });

  it("names the requested provider when the reply observed none, and leaves the kind line out for a provider TeamRun doesn't know or its own message", async () => {
    const requested = new Provenance("a2", new RequestedSettings("claude", null, null), new ObservedSettings(null, null, null, null), "s2", false);
    await render(new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], requested, SampleData.timestamp,
      SampleData.timestamp, null, [], "alice", "Alice"));
    const claude = textOf(".nol-permission-card-kind");
    fixture.componentRef.setInput("reply", new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [],
      new Provenance("a3", new RequestedSettings("removed-agent", null, null), new ObservedSettings(null, null, null, null), "s3", false), SampleData.timestamp,
      SampleData.timestamp, null, [], "alice", "Alice"));
    await fixture.whenStable();
    const unknown = root().querySelector(".nol-permission-card-kind");
    fixture.componentRef.setInput("reply", new Message("m2", "c1", 1, MessageAuthor.TeamRun, "m1", MessageStatus.AwaitingApproval, [], null,
      SampleData.timestamp, null, null, []));
    await fixture.whenStable();

    expect([claude, unknown, cards().length, root().querySelector(".nol-permission-card-kind")]).toEqual(["Claude Code · command", null, 1, null]);
  });

  it("names an unnamed teammate as its reply's header does, by its provider", async () => {
    await render(new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null, []));

    expect(textOf(".nol-permission-card-requester")).toBe("Codex · Work, Teammate");
  });

  it("shows only the approvals it's given, when given some, so a reply can show each where it was asked", async () => {
    await render();
    context.emit(EventName.ApprovalCreated, askPlatform().toJson());
    await Wait.until(() => expect(root().querySelector("nol-teamrun-question-card")).not.toBeNull());
    const shown = (): [number, number] => [cards().length, root().querySelectorAll("nol-teamrun-question-card").length];
    expect(shown()).toEqual([1, 1]);

    fixture.componentRef.setInput("ids", ["q1"]);
    await fixture.whenStable();
    expect(shown()).toEqual([0, 1]);
    fixture.componentRef.setInput("ids", [SampleData.approval.id]);
    await fixture.whenStable();
    expect(shown()).toEqual([1, 0]);
  });

  it("shows nothing for a reply without approvals", async () => {
    await render(SampleData.userMessage);

    expect(cards()).toEqual([]);
  });

  it("allows the request, sends the decision to the runtime part and removes the card once decided", async () => {
    const answer = new DeferredResponse();
    context.answer(MethodName.ApprovalDecide, () => answer.promise);
    await render();

    await click(option("yes")!);
    await Wait.until(() => expect(textOf(".nol-permission-card-sending")).toBe("Sending your answer"));
    expect(cards()).toHaveLength(1);
    answer.resolve(SampleData.approval.withDecision("yes", decidedAt).toJson());
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "yes"]]);
  });

  it("denies the request and removes the card", async () => {
    context.answer(MethodName.ApprovalDecide, () => SampleData.approval.withDecision("no", decidedAt).toJson());
    await render();

    await click(option("no")!);
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "no"]]);
  });

  it("removes the card when the approval is decided in another window", async () => {
    await render();

    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("yes", decidedAt).toJson());
    await gone();

    expect(decided()).toEqual([]);
  });

  it("removes the card when the reply's run withdraws the approval", async () => {
    await render();

    context.emit(EventName.ApprovalUpdated, SampleData.approval.withCancellation(decidedAt).toJson());

    await gone();
  });

  it("removes the card at once when its reply is stopped before the decision reaches it, before the run withdraws the approval", async () => {
    context.refuse(MethodName.ApprovalDecide, ErrorCode.Conflict, "Message m2 is not open.", "m2");
    await render();

    await click(option("yes")!);
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "yes"]]);
    expect(context.noticeText()).toBeNull();
  });

  it("says when a decision fails to send and sends it again on Retry", async () => {
    context.fail(MethodName.ApprovalDecide, "The runtime part is gone");
    const store = await render();

    await click(option("yes")!);
    await Wait.until(() => expect(textOf(".nol-permission-card-failed")).toContain("Your answer couldn't be sent."));
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1"]);
    expect(context.noticeText()).toContain("The runtime part is gone");

    context.answer(MethodName.ApprovalDecide, () => SampleData.approval.withDecision("yes", decidedAt).toJson());
    await click(root().querySelector<HTMLButtonElement>(".nol-permission-card-retry")!);
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "yes"], ["ap1", "yes"]]);
  });

  describe("for the Browser's requests", () => {
    const browser = (id: string, risk: string, options: readonly ApprovalOption[]): Approval => new Approval(id, "m2", ApprovalKind.Permission, "browser.type",
      "Type into \"Card number\"", { module: "browser", subject: "pay.example.com", risk, details: [] }, options, ApprovalStatus.Pending, null, SampleData.timestamp, null);
    const allowOnce = new ApprovalOption("allowOnce", "Allow once", ApprovalOutcome.Approved, ApprovalScope.Once);
    const deny = new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);
    const labels = (): (string | undefined)[] => [...root().querySelectorAll<HTMLButtonElement>(".nol-permission-card-option")].map(t => t.textContent?.trim());
    const choose = async (id: string): Promise<void> => {
      const button = option(id);
      expect(button).toBeInstanceOf(HTMLButtonElement);
      if (!Object.isNull(button))
        await click(button);
    };

    it("shows a medium-risk card's Allow once, the module's own allow-always label and Deny, and sends the label's option", async () => {
      const approval = browser("ap1", "Medium", [allowOnce, new ApprovalOption("allowAlways", "Allow for this chat", ApprovalOutcome.Approved, ApprovalScope.Session), deny]);
      context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
      context.answer(MethodName.ApprovalDecide, () => approval.withDecision("allowAlways", decidedAt).toJson());
      await render();

      expect(labels()).toEqual(["Allow once", "Allow for this chat", "Deny"]);
      await choose("allowAlways");
      await gone();

      expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "allowAlways"]]);
    });

    it("shows a high-risk card's Allow once, Deny and the module's take-over label, and sends a take-over without asking again", async () => {
      const approval = browser("ap1", "High", [allowOnce, deny, new ApprovalOption("takeOver", "I'll type it myself", ApprovalOutcome.Denied, ApprovalScope.Session)]);
      context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
      context.answer(MethodName.ApprovalDecide, () => approval.withDecision("takeOver", decidedAt).toJson());
      await render();

      expect(labels()).toEqual(["Allow once", "Deny", "I'll type it myself"]);
      await choose("takeOver");
      await gone();

      expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "takeOver"]]);
    });

    it("shows a card for a site the project hasn't allowed with the module's Allow always label and Deny only, and sends the label's option", async () => {
      const approval = browser("ap1", "Medium", [new ApprovalOption("allowAlways", "Allow this site for the project", ApprovalOutcome.Approved, ApprovalScope.Session), deny]);
      context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
      context.answer(MethodName.ApprovalDecide, () => approval.withDecision("allowAlways", decidedAt).toJson());
      await render();

      expect(labels()).toEqual(["Allow this site for the project", "Deny"]);
      await choose("allowAlways");
      await gone();

      expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "allowAlways"]]);
    });

    it("shows a high-risk card for a form that holds a secret with Allow once and Deny only", async () => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "High", [allowOnce, deny]).toJson()]);
      await render();

      expect(labels()).toEqual(["Allow once", "Deny"]);
    });

    it.each([
      ["a medium-risk card", (): Approval => browser("ap1", "Medium", [allowOnce,
        new ApprovalOption("allowAlways", "Allow for this chat", ApprovalOutcome.Approved, ApprovalScope.Session), deny]), "allowAlways"],
      ["a high-risk card", (): Approval => browser("ap1", "High", [allowOnce, deny,
        new ApprovalOption("takeOver", "I'll type it myself", ApprovalOutcome.Denied, ApprovalScope.Session)]), "takeOver"],
      ["a new site's card", (): Approval => browser("ap1", "Medium", [
        new ApprovalOption("allowAlways", "Allow this site for the project", ApprovalOutcome.Approved, ApprovalScope.Session), deny]), "allowAlways"],
      ["a secret form's card", (): Approval => browser("ap1", "High", [allowOnce, deny]), "deny"]
    ])("reaches %s by Tab with a visible ring and every option by the arrow keys, keeps them visible under forced colours and whole at 200%% zoom, and sends an option on Enter",
      async (_, make, id) => {
        const approval = make();
        context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
        context.answer(MethodName.ApprovalDecide, () => approval.withDecision(id, decidedAt).toJson());
        await render();

        expect(await AccessibilityFixture.expectKeyboardAsync(root())).toBeGreaterThan(0);
        expect(await AccessibilityFixture.expectVisibleForcedAsync(root())).toBeGreaterThan(0);
        await AccessibilityFixture.expectFitsZoomedAsync(root(), () => fixture.whenStable());
        const ids = approval.options.map(t => t.id);
        option(ids[0] ?? "")?.focus();
        const reached: (string | null)[] = [];
        for (let index = 0; index < ids.length; index++) {
          reached.push(document.activeElement?.getAttribute("data-nol-option") ?? null);
          await userEvent.keyboard("{ArrowRight}");
        }
        expect(reached).toEqual(ids);
        option(id)?.focus();
        expect(document.activeElement).toBe(option(id));
        await userEvent.keyboard("{Enter}");
        await gone();

        expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", id]]);
      });

    it("says above the first card which Browser calls went ahead without asking, by the teammate's name, and not the call still waiting", async () => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "Medium", [allowOnce, deny]).toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      await render(browsed(lowRiskSteps));

      expect(lowRiskLine()?.querySelector(".nol-teamrun-low-risk-text")?.textContent)
        .toBe("Low risk, allowed without asking: Alice read shop.test/cart · clicked \"Search\"");
      expect(lowRiskLine()?.querySelector(".nol-teamrun-low-risk-glyph")?.getAttribute("aria-hidden")).toBe("true");
      expect([...root().children].map(t => t.localName)).toEqual(["p", "nol-permission-card", "nol-permission-card"]);
    });

    it("keeps the low-risk line and the Browser cards under it whole at 200% zoom, with one Tab stop per card's answers, visible under forced colours", async () => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "Medium", [allowOnce, deny]).toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      await render(browsed(lowRiskSteps));

      const settleAsync = async (): Promise<void> => {
        await fixture.whenStable();
        await AccessibilityFixture.framesAsync(2);
      };
      const zoomed = await AccessibilityFixture.zoomedAsync(async () => {
        await settleAsync();
        const line = required(".nol-teamrun-low-risk-line");
        const box = line.getBoundingClientRect();
        const host = root().getBoundingClientRect();
        const first = cards()[0]?.getBoundingClientRect();
        const answers = [...root().querySelectorAll(".nol-permission-card-answer")].map(t => t.getBoundingClientRect());
        return {
          line: [box.width > 0 && box.height > 0, box.left >= host.left, box.right <= Math.min(host.right, window.innerWidth), line.scrollWidth <= line.clientWidth,
            !Object.isUndefined(first) && box.bottom <= first.top],
          answers: answers.map(t => t.width > 0 && t.height > 0 && t.left >= 0 && t.right <= window.innerWidth)
        };
      });

      expect(zoomed).toEqual({ line: [true, true, true, true, true], answers: [true, true] });
      expect(await AccessibilityFixture.expectKeyboardAsync(root())).toBe(2);
      expect(await AccessibilityFixture.expectVisibleForcedAsync(root())).toBe(2);
      await AccessibilityFixture.expectFitsZoomedAsync(root(), settleAsync);
      expect(AccessibilityFixture.expectNamed(root())).toBeGreaterThanOrEqual(4);
    });

    it.each([
      { look: "light", mode: ThemeMode.Light, isForced: false },
      { look: "dark", mode: ThemeMode.Dark, isForced: false },
      { look: "forced colours", mode: ThemeMode.Light, isForced: true }
    ])("draws the kit's ring in $look on each Browser card's answers, one border width wide and two outside the option", async ({ mode, isForced }) => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "Medium", [allowOnce, deny]).toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      try {
        await render(browsed(lowRiskSteps));
        const read = async (): Promise<[FocusRing[], string]> =>
          [await AccessibilityFixture.focusRingsAsync(root()), FocusRing.colorOf(root(), isForced ? "Highlight" : "var(--nol-accent)")];
        const [rings, color] = isForced ? await AccessibilityFixture.forcedAsync(read) : await read();
        const unit = FocusRing.borderWidthOf(root());
        const ring = [true, "solid", (isForced ? 2 : 1) * unit, color, 2 * unit];

        expect(rings.map(t => [t.element.classList.contains("nol-permission-card-option"), t.style, t.width, t.color, t.offset])).toEqual([ring, ring]);
      }
      finally {
        AppearanceFixture.reset();
      }
    });

    it("moves the focus from the first card's answers to the second's on Tab and back on Shift+Tab, along a card's answers on the Left and Right arrow keys, and sends the focused answer on Enter", async () => {
      const first = browser("ap1", "Medium", [allowOnce, deny]);
      context.answer(MethodName.ApprovalList, () => [first.toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      context.answer(MethodName.ApprovalDecide, () => first.withDecision("deny", decidedAt).toJson());
      await render(browsed(lowRiskSteps));
      const options = (index: number): HTMLButtonElement[] => [...cards()[index]?.querySelectorAll<HTMLButtonElement>(".nol-permission-card-option") ?? []];
      const focused = (): [number, number] => {
        const index = cards().findIndex(t => t.contains(document.activeElement));
        return [index, options(index).findIndex(t => t === document.activeElement)];
      };
      const reached: [number, number][] = [];
      options(0).find(t => t.tabIndex === 0)?.focus();
      reached.push(focused());
      await userEvent.tab();
      reached.push(focused());
      await userEvent.tab({ shift: true });
      reached.push(focused());
      const [, start] = reached[0] ?? [0, 0];
      await userEvent.keyboard("{ArrowRight}");
      reached.push(focused());
      await userEvent.keyboard("{ArrowLeft}");
      reached.push(focused());
      await userEvent.keyboard("{ArrowRight}");
      reached.push(focused());

      expect(reached).toEqual([[0, start], [1, options(1).findIndex(t => t.tabIndex === 0)], [0, start], [0, (start + 1) % 2], [0, start], [0, (start + 1) % 2]]);
      if (focused()[1] === 0)
        await userEvent.keyboard("{ArrowRight}");
      await userEvent.keyboard("{Enter}");
      await Wait.until(() => expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "deny"]]));
    });

    it("draws the low-risk line's text and shield, and the Browser cards' edges, in the system's colours under forced colours, in a light and a dark palette", async () => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "Medium", [allowOnce, deny]).toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      await render(browsed(lowRiskSteps));
      const read = async (): Promise<[string[], string[]]> => [[
        getComputedStyle(required(".nol-teamrun-low-risk-text")).color,
        getComputedStyle(required(".nol-teamrun-low-risk-glyph")).color,
        ...cards().map(t => getComputedStyle(t).borderTopColor)
      ], ["CanvasText", "ButtonText", "ButtonBorder", "GrayText"].map(t => FocusRing.colorOf(root(), t))];
      const readIn = async (mode: ThemeMode): Promise<[string[], string[]]> => {
        AppearanceFixture.apply(FixtureTheme.theme, mode);
        try {
          return await AccessibilityFixture.forcedAsync(read, mode === ThemeMode.Dark ? "dark" : "light");
        }
        finally {
          AppearanceFixture.reset();
        }
      };
      const looks = [await readIn(ThemeMode.Light), await readIn(ThemeMode.Dark)];

      expect(looks[0]?.[1][0]).not.toBe(looks[1]?.[1][0]);
      expect(looks.map(([colors, system]) => [colors.length, colors[0] === system[0], colors[1] === system[0], colors.filter(t => !system.includes(t))]))
        .toEqual([[4, true, true, []], [4, true, true, []]]);
    });

    it("leaves the line out of a group without the reply's first card, and out of a reply with no call allowed without asking", async () => {
      context.answer(MethodName.ApprovalList, () => [browser("ap1", "Medium", [allowOnce, deny]).toJson(), browser("ap2", "High", [allowOnce, deny]).toJson()]);
      await render(browsed(lowRiskSteps));
      fixture.componentRef.setInput("ids", ["ap2"]);
      await fixture.whenStable();
      const inLaterGroup = [lowRiskLine(), cards().length];
      fixture.componentRef.setInput("ids", null);
      fixture.componentRef.setInput("reply", browsed(lowRiskSteps.slice(4)));
      await fixture.whenStable();

      expect([...inLaterGroup, lowRiskLine(), cards().length]).toEqual([null, 1, null, 2]);
    });

    it("draws the line just before the first permission card when a question card comes ahead of it in the group", async () => {
      context.answer(MethodName.ApprovalList, () => [askPlatform().toJson(), browser("r1", "Medium", [allowOnce, deny]).toJson()]);
      await render(browsed(lowRiskSteps));

      expect([...root().children].map(t => t.localName)).toEqual(["nol-teamrun-question-card", "p", "nol-permission-card"]);
      expect(lowRiskLine()?.nextElementSibling?.getAttribute("data-nol-teamrun-approval")).toBe("r1");
    });

    it("leaves the line out while the reply asks only a question", async () => {
      context.answer(MethodName.ApprovalList, () => [askPlatform().toJson()]);
      await render(browsed(lowRiskSteps));

      expect([lowRiskLine(), root().querySelectorAll("nol-teamrun-question-card").length]).toEqual([null, 1]);
    });
  });

  it("asks before allowing for the session, and sends that option once confirmed", async () => {
    const options = [
      new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved, ApprovalScope.Session),
      new ApprovalOption("decline", "Decline", ApprovalOutcome.Denied, ApprovalScope.Once)
    ];
    const approval = new Approval("ap1", "m2", ApprovalKind.Command, "native", "run tests", null, options, ApprovalStatus.Pending, null, SampleData.timestamp,
      null);
    context.answer(MethodName.ApprovalList, () => [approval.toJson()]);
    context.answer(MethodName.ApprovalDecide, () => approval.withDecision("acceptForSession", decidedAt).toJson());
    await render();

    await click(option("acceptForSession")!);
    expect(decided()).toEqual([]);
    expect(textOf(".nol-permission-card-question")).toBe("Allow this request?");
    await click(root().querySelector<HTMLButtonElement>(".nol-permission-card-confirm")!);
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "acceptForSession"]]);
  });

  it("removes a card whose failed decision was made in another window meanwhile", async () => {
    context.fail(MethodName.ApprovalDecide, "Already decided");
    await render();

    await click(option("yes")!);
    await Wait.until(() => expect(root().querySelector(".nol-permission-card-failed")).not.toBeNull());
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", decidedAt).toJson());

    await gone();
  });

  it("keeps an answer on its way when the reply's card is drawn again, and sends it once", async () => {
    const answer = new DeferredResponse();
    context.answer(MethodName.ApprovalDecide, () => answer.promise);
    const store = await render();

    await click(option("yes")!);
    await redraw();
    expect(textOf(".nol-permission-card-sending")).toBe("Sending your answer");
    expect(option("no")?.getAttribute("aria-disabled")).toBe("true");
    await click(option("no")!);
    expect(await store.decide("ap1", "no")).toBe(false);
    answer.resolve(SampleData.approval.withDecision("yes", decidedAt).toJson());
    await gone();

    expect(decided().map(t => [t.approvalId, t.optionId])).toEqual([["ap1", "yes"]]);
  });

  it("keeps a failed answer and its Retry when the reply's card is drawn again", async () => {
    context.fail(MethodName.ApprovalDecide, "The runtime part is gone");
    await render();

    await click(option("yes")!);
    await Wait.until(() => expect(root().querySelector(".nol-permission-card-failed")).not.toBeNull());
    await redraw();

    expect(textOf(".nol-permission-card-failed")).toContain("Your answer couldn't be sent.");
    context.answer(MethodName.ApprovalDecide, () => SampleData.approval.withDecision("yes", decidedAt).toJson());
    await click(root().querySelector<HTMLButtonElement>(".nol-permission-card-retry")!);
    await gone();
    expect(decided().map(t => t.optionId)).toEqual(["yes", "yes"]);
  });

  it("shows each of the reply's pending approvals in the order they were asked, and none answered or of another reply's", async () => {
    const tool = new Approval("ap2", "m2", ApprovalKind.Tool, "tool", "read a file", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null);
    const elsewhere = new Approval("ap3", "m9", ApprovalKind.FileChange, "edit", "edit a file", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null);
    const answered = new Approval("ap4", "m2", ApprovalKind.Command, "exec", "list files", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null).withDecision("no", decidedAt);
    await render();

    context.emit(EventName.ApprovalCreated, tool.toJson());
    context.emit(EventName.ApprovalCreated, elsewhere.toJson());
    context.emit(EventName.ApprovalUpdated, answered.toJson());
    await fixture.whenStable();

    expect([...root().querySelectorAll(".nol-permission-card-heading")].map(t => t.textContent?.trim())).toEqual(["Run a command", "Use a tool"]);
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

    it("stacks the reply's cards at its full width, half a step apart", async () => {
      await render();
      context.emit(EventName.ApprovalCreated, new Approval("ap2", "m2", ApprovalKind.Tool, "tool", "read a file", null, SampleData.approval.options,
        ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson());
      await fixture.whenStable();
      root().style.width = "30rem";
      const host = root().getBoundingClientRect();
      const [first, second] = cards().map(t => t.getBoundingClientRect());

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(host.width, AppearanceFixture.toPixels(30));
      for (const card of [first!, second!]) {
        AppearanceFixture.expectPixels(card.left, host.left);
        AppearanceFixture.expectPixels(card.width, host.width);
      }
      AppearanceFixture.expectPixels(first!.top, host.top);
      AppearanceFixture.expectPixels(second!.top - first!.bottom, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(host.bottom, second!.bottom);
    });

    const moduleCard = (details: JsonObject[]): Approval => new Approval("ap1", "m2", ApprovalKind.Permission, "git.commit",
      "Commit 2 files to dev8/1719-gemini-folder-trust", { module: "git", subject: "teamrun", risk: "Medium", details }, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null);

    it("shows a module's details one per line without the action's ID, so a commit card's two details are two lines tall and not cut", async () => {
      context.answer(MethodName.ApprovalList, () => [moduleCard([{ label: "Message", kind: "AgentText", value: "Name the chat's folder" },
        { label: "Files", kind: "Code", value: "M src/a.ts" }]).toJson()]);
      await render();
      root().style.width = "40rem";
      const details = required(".nol-permission-card-code");
      const style = getComputedStyle(details);
      const content = details.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(details.textContent).toBe("Message: Name the chat's folder\nFiles: M src/a.ts");
      expect(root().querySelector(".nol-permission-card-more")).toBeNull();
      AppearanceFixture.expectPixels(content, 2 * Number.parseFloat(style.lineHeight));
    });

    it("names under a served call's title its module, its tool, the teammate and the chat, never the action's ID, as the design draws it", async () => {
      context.answer(MethodName.ApprovalList, () => [new Approval("ap1", "m2", ApprovalKind.Permission, "git.commit", "Commit 2 files to dev8/1719-gemini-folder-trust",
        { module: "git", subject: "teamrun", risk: "Medium", details: [], servedTool: "git_commit", servedInput: { message: "Name the chat's folder" } },
        SampleData.approval.options, ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson()]);
      await render();
      root().style.width = "40rem";
      const heading = required(".nol-permission-card-heading").getBoundingClientRect();
      const kind = required(".nol-permission-card-kind");

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect([kind.textContent?.trim(), root().textContent?.includes("git.commit")]).toEqual(["Git · git_commit · Alice in \"First\"", false]);
      AppearanceFixture.expectPixels(kind.getBoundingClientRect().left, heading.left);
      expect(kind.getBoundingClientRect().top).toBeGreaterThanOrEqual(heading.bottom - 1);

      fixture.componentRef.setInput("reply", new Message("m2", "c9", 1, MessageAuthor.Provider, "m1", MessageStatus.AwaitingApproval, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null, [], "alice", "Alice"));
      await fixture.whenStable();

      expect(textOf(".nol-permission-card-kind")).toBe("Git · git_commit · Alice");
    });

    it("shows a push card's five details whole, five lines tall with no Show all", async () => {
      context.answer(MethodName.ApprovalList, () => [moduleCard([{ label: "Remote", kind: "Text", value: "origin" },
        { label: "Branch", kind: "Text", value: "main to origin/main" }, { label: "Commits", kind: "Code", value: "a1b2c3d Name the chat's folder" },
        { label: "Author", kind: "Text", value: "Site Author" }, { label: "Hooks that will run", kind: "Text", value: "None" }]).toJson()]);
      await render();
      root().style.width = "40rem";
      const details = required(".nol-permission-card-code");
      const style = getComputedStyle(details);
      const content = details.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(details.textContent?.split("\n").length).toBe(5);
      expect(root().querySelector(".nol-permission-card-more")).toBeNull();
      AppearanceFixture.expectPixels(content, 5 * Number.parseFloat(style.lineHeight));
    });

    it("shows a request's first 12 detail lines and Show all for its thirteenth", async () => {
      const lines = Array.from({ length: 13 }, (_, t) => ({ label: `Line ${t + 1}`, kind: "Text", value: "value" }));
      context.answer(MethodName.ApprovalList, () => [moduleCard(lines).toJson()]);
      await render();
      root().style.width = "40rem";
      const details = required(".nol-permission-card-code");
      const style = getComputedStyle(details);
      const content = details.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(required(".nol-permission-card-more").textContent?.trim()).toBe("Show all 13 lines");
      AppearanceFixture.expectPixels(content, 12 * Number.parseFloat(style.lineHeight));
    });

    it("shows a module's card with no details without a details block, its answers one card gap under the heading row", async () => {
      context.answer(MethodName.ApprovalList, () => [moduleCard([]).toJson()]);
      await render();
      root().style.width = "40rem";
      const header = required(".nol-permission-card-header").getBoundingClientRect();
      const answer = required(".nol-permission-card-answer").getBoundingClientRect();
      const gap = AppearanceFixture.measureLook("space-2");

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(root().querySelector(".nol-permission-card-details")).toBeNull();
      AppearanceFixture.expectPixels(answer.top - header.bottom, gap);
    });

    it("draws the low-risk line at the top in muted label text, after a 0.875rem shield 0.375rem from the text, three quarters of a step above the card", async () => {
      await render(browsed(lowRiskSteps));
      root().style.width = "40rem";
      const host = root().getBoundingClientRect();
      const line = required(".nol-teamrun-low-risk-line");
      const glyph = required(".nol-teamrun-low-risk-glyph").getBoundingClientRect();
      const text = required(".nol-teamrun-low-risk-text").getBoundingClientRect();
      const card = required("nol-permission-card").getBoundingClientRect();
      const box = line.getBoundingClientRect();
      const probe = root().appendChild(document.createElement("span"));
      probe.style.color = "var(--nol-text-muted)";
      const muted = getComputedStyle(probe).color;
      probe.remove();

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      expect(getComputedStyle(line).color).toBe(muted);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(line).fontSize), AppearanceFixture.measureLook("text-label"));
      AppearanceFixture.expectPixels(box.top, host.top);
      AppearanceFixture.expectPixels(glyph.left, host.left);
      AppearanceFixture.expectPixels(glyph.width, AppearanceFixture.toPixels(0.875));
      AppearanceFixture.expectPixels(glyph.height, AppearanceFixture.toPixels(0.875));
      AppearanceFixture.expectPixels(text.left - glyph.right, AppearanceFixture.toPixels(0.375));
      AppearanceFixture.expectPixels(text.height, box.height);
      AppearanceFixture.expectPixels((glyph.top + glyph.bottom) / 2, (box.top + box.bottom) / 2);
      AppearanceFixture.expectPixels(card.top - box.bottom, AppearanceFixture.measureLook("space-3"));
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in a reply's approval card visible under forced colours", async () => {
      await render();
      expect(await AccessibilityFixture.expectVisibleForcedAsync(root())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in a reply's approval card at 200% zoom", async () => {
      await render();
      await AccessibilityFixture.expectFitsZoomedAsync(root(), () => fixture.whenStable());
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in a reply's approval card by keyboard, with a visible ring", async () => {
      await render();
      expect(await AccessibilityFixture.expectKeyboardAsync(root())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in a reply's approval card", async () => {
      await render();
      expect(AccessibilityFixture.expectNamed(root())).toBeGreaterThan(0);
    });
  });
});
