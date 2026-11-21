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
import { AbilityCell, ConversationListParams, ConversationRewindParams, ConversationRewindResult, DetailKind, Message, MessageAuthor, MessageStatus, MethodName, ObservedSettings, Provenance, ProviderAbility, ProviderKind,
  RequestedSettings } from "@noldova/teamrun.protocol";
import { DialogService, DialogTokens, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { RewindDialogComponent } from "../../../../src/app/components/rewind-dialog/rewind-dialog.component";
import type { RewoundDraft } from "../../../../src/app/models/rewound-draft";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { DialogDescriptionFixture } from "../../../fixtures/dialog-description.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("RewindDialogComponent", () => {
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let fixture: ComponentFixture<RewindDialogComponent>;
  let closes: number;
  let draftsAtClose: (RewoundDraft | null)[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const field = <T extends HTMLElement>(selector: string): T => {
    const found = element().querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The rewind dialog shows no ${selector}.`);
    return found;
  };
  const box = (): HTMLInputElement => field<HTMLInputElement>(".nol-teamrun-restore-files input[type=checkbox]");
  const isDisabled = (input: HTMLInputElement): boolean => input.getAttribute("aria-disabled") === "true";
  const submit = async (): Promise<void> => {
    field<HTMLButtonElement>(".nol-teamrun-confirm").click();
    await settle();
  };
  const ids = (): readonly string[] => store.history()?.held.map(t => t.id) ?? [];
  const rewound = (): ConversationRewindResult => new ConversationRewindResult(SampleData.conversation, ["m1", "m2"], 2, true);
  const kinds: readonly ProviderKind[] = [new ProviderKind("copilot", "GitHub Copilot", true), new ProviderKind("antigravity", "Antigravity", true),
    new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, null, SampleData.abilities()),
    new ProviderKind("cursor", "Cursor", true, false, null, null, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.Fork]: AbilityCell.cannot("it offers no fork") }))];
  const reply = (sequence: number, kind: string, teammateId: string | null = null): Message => new Message(`r${sequence}`, "c1", sequence,
    MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
    new Provenance(null, new RequestedSettings(kind, null, null), new ObservedSettings(kind, null, null, null), "s1", false),
    SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammateId, Object.isNull(teammateId) ? null : "Reviewer");
  const asked = (sequence: number): Message => new Message(`u${sequence}`, "c1", sequence, MessageAuthor.User, null, MessageStatus.Completed,
    [SampleData.detail(0, DetailKind.Text, "again")], null, SampleData.timestamp, null, SampleData.timestamp);
  const showing = (messages: readonly Message[]): ((t: FakeWindowPartContext) => void) => (t: FakeWindowPartContext): void => {
    t.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, ...messages], false, false).toJson());
    t.answer(MethodName.ProviderKindList, () => kinds.map(u => u.toJson()));
  };
  const text = (): string | undefined => field(".nol-teamrun-rewind-text").textContent?.trim();
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, select: boolean = true,
    message: Message = SampleData.userMessage): Promise<void> => {
    context = SampleData.createContext();
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    if (select)
      await store.selectConversation(SampleData.conversation.id);
    fixture = TestBed.createComponent(RewindDialogComponent);
    fixture.componentRef.setInput("store", store);
    fixture.componentRef.setInput("message", message);
    closes = 0;
    draftsAtClose = [];
    fixture.componentInstance.closed.subscribe(() => {
      closes++;
      draftsAtClose.push(store.rewoundDraft());
    });
    fixture.autoDetectChanges();
    await settle();
  };

  afterEach(() => {
    ChatStoreService.release(context);
  });

  it("says what a rewind removes, restores the files by default, then rewinds from the message, closes, and only then offers the message back", async () => {
    await create(t => t.answer(MethodName.ConversationRewind, () => rewound().toJson()));

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.rewindTitle);
    expect(text()).toBe(`${Resources.rewindRemovedText} ${Resources.rewindKeptText}`);
    expect(field(".nol-teamrun-restore-files").textContent?.trim()).toBe(Resources.restoreFilesLabel);
    expect(box().checked).toBe(true);
    expect(field(".nol-teamrun-confirm").textContent?.trim()).toBe(Resources.rewindConfirmLabel);
    expect(ids()).toEqual(["m1", "m2"]);

    await submit();

    expect(context.parametersOf(MethodName.ConversationRewind)).toEqual(new ConversationRewindParams("c1", "m1", true).toJson());
    expect(ids()).toEqual([]);
    expect([closes, draftsAtClose, store.rewoundDraft()?.conversationId]).toEqual([1, [null], "c1"]);
  });

  it("is described by what a rewind removes and keeps, under the title, when Rewind takes the first focus", async () => {
    await create();
    fixture.destroy();
    const reference = TestBed.inject(DialogService).open(RewindDialogComponent, ".nol-teamrun-confirm");
    reference.componentRef?.setInput("store", store);
    reference.componentRef?.setInput("message", SampleData.userMessage);

    DialogDescriptionFixture.expectDescribedBy(await DialogDescriptionFixture.focusedAsync(".nol-teamrun-confirm"),
      [`${Resources.rewindRemovedText} ${Resources.rewindKeptText}`]);

    await DialogDescriptionFixture.closeAsync(reference);
  });

  it.each([
    { kind: "copilot", name: "GitHub Copilot" },
    { kind: "antigravity", name: "Antigravity" }
  ])("says in the sentence every provider without a fork shares that $name can't fork when the reply the rewind keeps is its", async ({ kind, name }) => {
    await create(showing([reply(1, kind), asked(2)]), true, asked(2));

    expect(text()).toBe(`${Resources.rewindRemovedText} ${name} can't fork a session, so the next reply starts a fresh one that is told what was said before.`);
    expect(text()).toBe(`${Resources.rewindRemovedText} ${Resources.formatForkUnavailable(name)}`);
  });

  it("gives the fork row's reason when the reply the rewind keeps is from a provider whose table says it can't fork", async () => {
    await create(showing([reply(1, "cursor"), asked(2)]), true, asked(2));

    expect(text()).toBe(`${Resources.rewindRemovedText} Cursor can't rewind within its session: it offers no fork. The next reply starts a fresh one that is told what was said before.`);
  });

  it.each([
    { case: "the kept reply's provider forks", messages: [reply(1, "codex"), asked(2)], target: asked(2) },
    { case: "only a named teammate's reply follows a forking default teammate's", messages: [reply(1, "codex"), reply(2, "copilot", "t1"), asked(3)], target: asked(3) },
    { case: "the kept reply's provider isn't listed", messages: [reply(1, "gemini"), asked(2)], target: asked(2) },
    { case: "no reply is kept", messages: [reply(1, "copilot"), asked(2)], target: SampleData.userMessage },
    { case: "the message isn't in the shown history", messages: [reply(1, "copilot")], target: asked(5) }
  ])("keeps the general sentence when $case", async ({ messages, target }) => {
    await create(showing(messages), true, target);

    expect(text()).toBe(`${Resources.rewindRemovedText} ${Resources.rewindKeptText}`);
  });

  it("keeps the files as they are when the person clears the box", async () => {
    await create(t => t.answer(MethodName.ConversationRewind, () => rewound().toJson()));

    box().click();
    await settle();

    expect(box().checked).toBe(false);

    await submit();

    expect(ConversationRewindParams.fromJson(context.parametersOf(MethodName.ConversationRewind)).restoreFiles).toBe(false);
    expect(closes).toBe(1);
  });

  it("stays open on a refusal and shows it in the dialog only, the conversation unchanged", async () => {
    await create(t => t.fail(MethodName.ConversationRewind, "A reply in this conversation is in progress."));

    await submit();

    expect(field("nol-field-message").textContent?.trim()).toBe("A reply in this conversation is in progress.");
    expect(context.noticeText()).toBeNull();
    expect(ids()).toEqual(["m1", "m2"]);
    expect([closes, store.rewoundDraft()]).toEqual([0, null]);
    expect(field<HTMLButtonElement>(".nol-teamrun-confirm").disabled).toBe(false);
  });

  it("says the kept reply's provider can't fork for the chat on screen while an opened project sets it aside and no chat is selected", async () => {
    await create(t => {
      showing([reply(1, "copilot"), asked(2)])(t);
      t.answer(MethodName.ConversationList, u => ConversationListParams.fromJson(u).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [])
        .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    }, false, asked(2));
    store.showConversation(SampleData.conversation.id);
    await store.conversationInView(SampleData.conversation.id);

    await store.openProject(SampleData.otherProject.rootPath);
    await settle();

    expect([store.selectedConversationId(), store.shownConversationId()]).toEqual([null, SampleData.conversation.id]);
    expect(text()).toBe(`${Resources.rewindRemovedText} ${Resources.formatForkUnavailable("GitHub Copilot")}`);
  });

  it("rewinds the message's own conversation, whichever conversation is selected", async () => {
    const elsewhere = new Message("m9", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "there")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    await create(t => t.answer(MethodName.ConversationRewind, () => rewound().toJson()), false, elsewhere);

    await submit();

    expect(context.parametersOf(MethodName.ConversationRewind)).toEqual(new ConversationRewindParams("c2", "m9", true).toJson());
    expect(closes).toBe(1);
  });

  it("clears an earlier refusal when the person tries again", async () => {
    let refuse = true;
    await create(t => t.answer(MethodName.ConversationRewind, () => {
      if (refuse)
        throw new Error("A reply in this conversation is in progress.");
      return rewound().toJson();
    }));
    await submit();

    expect(element().querySelector("nol-field-message")).not.toBeNull();

    refuse = false;
    await submit();

    expect(element().querySelector("nol-field-message")).toBeNull();
    expect(closes).toBe(1);
  });

  it("closes from Close or Escape, but not while it rewinds, with its controls held", async () => {
    const answer = new DeferredResponse();
    await create(t => t.answer(MethodName.ConversationRewind, () => answer.promise));
    const dialog = fixture.debugElement.query(By.css("nol-dialog"));

    field<HTMLButtonElement>(".nol-teamrun-cancel").click();
    dialog.triggerEventHandler("dismissed");

    expect(closes).toBe(2);

    field<HTMLFormElement>("form").requestSubmit();
    await fixture.whenStable();
    field<HTMLFormElement>("form").requestSubmit();
    dialog.triggerEventHandler("dismissed");
    await fixture.whenStable();

    expect(field<HTMLButtonElement>(".nol-teamrun-confirm").disabled).toBe(true);
    expect(field<HTMLButtonElement>(".nol-teamrun-cancel").disabled).toBe(true);
    expect(isDisabled(box())).toBe(true);
    expect(context.count(MethodName.ConversationRewind)).toBe(1);
    expect(closes).toBe(2);

    answer.resolve(rewound().toJson());
    await settle();

    expect(closes).toBe(3);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const rect = (target: Element): DOMRect => target.getBoundingClientRect();

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("writes the text in the muted colour and the box's label in the text colour", async () => {
      await create();
      const colourOf = (token: string): string => {
        const probe = document.createElement("span");
        probe.style.color = `var(--nol-${token})`;
        element().append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };

      expect(getComputedStyle(field(".nol-teamrun-rewind-text")).color).toBe(colourOf("text-muted"));
      expect(getComputedStyle(field(".nol-teamrun-restore-files .nol-checkbox-text")).color).toBe(colourOf("text"));
    });

    it("keeps the sentence for a provider without a fork in the text's place and colour, the box a form gap under it", async () => {
      await create(showing([reply(1, "copilot"), asked(2)]), true, asked(2));
      const probe = document.createElement("span");
      probe.style.color = "var(--nol-text-muted)";
      element().append(probe);
      const muted = getComputedStyle(probe).color;
      probe.remove();
      const form = rect(field("form"));
      const sentence = rect(field(".nol-teamrun-rewind-text"));
      const restore = rect(field(".nol-teamrun-restore-files"));

      expect(text()).toContain(Resources.formatForkUnavailable("GitHub Copilot"));
      AppearanceFixture.expectPixels(sentence.top, form.top);
      AppearanceFixture.expectPixels(sentence.left, form.left);
      AppearanceFixture.expectPixels(restore.top - sentence.bottom, space(3));
      expect(getComputedStyle(field(".nol-teamrun-rewind-text")).color).toBe(muted);
    });

    it("puts the box a form gap under the text, and a refusal below them a step away, each from the form's start edge", async () => {
      await create(t => t.fail(MethodName.ConversationRewind, "A reply in this conversation is in progress."));
      await submit();
      const form = rect(field("form"));
      const text = rect(field(".nol-teamrun-rewind-text"));
      const restore = rect(field(".nol-teamrun-restore-files"));
      const choice = rect(field(".nol-teamrun-rewind-choice"));
      const refusal = rect(field("nol-field-message"));

      AppearanceFixture.expectPixels(text.top, form.top);
      AppearanceFixture.expectPixels(restore.top - text.bottom, space(3));
      AppearanceFixture.expectPixels(restore.bottom, choice.bottom);
      AppearanceFixture.expectPixels(refusal.top - choice.bottom, space(3) + space(1));
      AppearanceFixture.expectPixels(refusal.bottom, form.bottom);
      for (const part of [text, restore, refusal])
        AppearanceFixture.expectPixels(part.left, form.left);
      expect(text.right).toBeLessThanOrEqual(form.right + 0.5);
      expect(restore.right).toBeLessThanOrEqual(form.right + 0.5);
    });

    it("puts Close as a text button before Rewind, half a rem apart, with Rewind at the end of the actions", async () => {
      await create();

      DialogActionsFixture.expectCloseThenPrimary(element(), ".nol-teamrun-confirm");
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the rewind dialog visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the rewind dialog at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the rewind dialog by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the rewind dialog", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
