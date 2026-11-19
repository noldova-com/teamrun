/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusMonitor } from "@angular/cdk/a11y";
import { afterNextRender } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FileSaveOutcome, type StatusBarItem, WindowPartTokens } from "@noldova/desktop.window";
import {
  AbilityCell,
  AttachmentInput,
  AttachmentReadParams,
  AuthStatus,
  ChatMemberModeParams,
  ChatMemberSettings,
  ChatPlanFirstParams,
  ComposerDefaultSaveParams,
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  ConversationMember,
  ConversationResponder,
  ConversationResponderParams,
  ConversationRewindResult,
  ContextUsage,
  DetailKind,
  Draft,
  DraftSaveParams,
  ErrorCode,
  DefaultTeammate,
  DefaultTeammateSetParams,
  EventName,
  Harness,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDelivery,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  MethodName,
  ObservedSettings,
  PlanUsage,
  PlanUsageParams,
  PlanWindow,
  PlanWindowName,
  Provenance,
  Provider,
  ProviderAbility,
  ProviderIdParams,
  ProviderKind,
  ProviderListModelsParams,
  ProviderMode,
  ProviderModel,
  ProviderProfile,
  ProviderSpeed,
  ProviderTool,
  ReplyUsage,
  RequestedSettings,
  Teammate,
  TeammateMention,
  TeammateUpdateParams,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessagesPayload
} from "@noldova/teamrun.protocol";
import { ClipboardWriter, DefaultTheme, MentionValue, ThemeMode, TooltipDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { ComposerComponent } from "../../../../src/app/components/composer/composer.component";
import { ChatAction } from "../../../../src/app/enums/chat-action";
import { ImageOpenMode } from "../../../../src/app/enums/image-open-mode";
import { SendKey } from "../../../../src/app/enums/send-key";
import { ComposerAttachment } from "../../../../src/app/models/composer-attachment";
import { ComposerBar } from "../../../../src/app/models/composer-bar";
import { ComposerChoices } from "../../../../src/app/models/composer-choices";
import { ComposerSettings } from "../../../../src/app/models/composer-settings";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { CommandTargetsService } from "../../../../src/app/services/command-targets.service";
import { ComposerChoicesService } from "../../../../src/app/services/composer-choices.service";
import { ComposerDefaultService } from "../../../../src/app/services/composer-default.service";
import { ComposerDraftService } from "../../../../src/app/services/composer-draft.service";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { PlanUsageStatus } from "../../../../src/app/services/plan-usage-status";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { UsageFormatterService } from "../../../../src/app/services/usage-formatter.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeTerminalLauncher } from "../../../fixtures/fake-terminal-launcher.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ComposerComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ComposerComponent>;
  const required = <T>(value: T | null | undefined): T => {
    if (Object.isNullOrUndefined(value))
      throw new Error("The part the spec reads isn't there.");
    return value;
  };
  const providerOf =(kind: string, id: string = `${kind}-1`): Provider =>
    new Provider(id, kind, "Work", `D:\\profiles\\${kind}`, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);

  const configure = (): void => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
      { provide: ComposerDraftService.interval, useValue: 60 * 60 * 1000 }] });
  };
  const prepare = async (terminals?: FakeTerminalLauncher): Promise<ChatStoreService> => {
    configure();
    const store = ChatStoreService.of(context, terminals);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.selectConversation("c1");
    return store;
  };
  const render = async (conversationId: string = "c1"): Promise<void> => {
    fixture = TestBed.createComponent(ComposerComponent);
    fixture.componentRef.setInput("conversationId", conversationId);
    await fixture.whenStable();
  };
  const remember = (settings: ComposerSettings, conversationId: string = "c1"): void => TestBed.inject(ComposerChoicesService).remember(conversationId, settings);
  const choice = (conversationId: string = "c1"): ComposerSettings | null => TestBed.inject(ComposerChoicesService).choiceOf(conversationId);
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const box = (): HTMLTextAreaElement => root().querySelector("textarea")!;
  const picker = (): HTMLButtonElement => required(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-picker"));
  const loading = (): HTMLElement => root().querySelector<HTMLElement>(".nol-teamrun-composer-loading")!;
  const summary = (): string | null => picker().getAttribute("aria-label");
  const reason = (): string | undefined => root().querySelector(".nol-teamrun-composer-unavailable nol-field-message")?.textContent?.trim();
  const sendButton = (): HTMLButtonElement | null => root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send");
  const rows = (): NodeListOf<HTMLElement> => root().querySelectorAll<HTMLElement>(".nol-teamrun-composer-attachment");
  const previews = (): HTMLImageElement[] => [...root().querySelectorAll<HTMLImageElement>(".nol-teamrun-composer-preview")];
  const fileNames = (): (string | null)[] => [...rows()].map(t => t.querySelector(".nol-teamrun-composer-attachment-name")?.textContent ?? null);
  const frames = (): HTMLButtonElement[] => [...root().querySelectorAll<HTMLButtonElement>(".nol-teamrun-composer-frame")];
  const pixels = (width: number = 3): string => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = 2;
    const url = canvas.toDataURL("image/png");
    return url.slice(url.indexOf(",") + 1);
  };
  const clipboard = (): ClipboardWriterFixture => TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;
  const nextWrite = (answer: () => Promise<boolean> = () => Promise.resolve(true)): Promise<void> =>
    new Promise<void>(resolve => clipboard().answer = () => (resolve(), answer()));
  const openImageMenu = async (preview: HTMLElement): Promise<void> => {
    const bounds = preview.getBoundingClientRect();
    preview.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: bounds.left + 10, clientY: bounds.top + 10 }));
    await fixture.whenStable();
  };
  const imageFile = (name: string, width: number = 3): File => new File([Uint8Array.from(atob(pixels(width)), t => t.charCodeAt(0))], name, { type: "image/png" });
  const alert = (): string | undefined => root().querySelector('[role="alert"]')?.textContent?.trim();
  const menuLabels = (): string[] => [...[...document.querySelectorAll("nol-menu")].at(-1)!.querySelectorAll(".nol-menu-item-label")].map(t => t.textContent!.trim());
  const note = (): string | undefined => root().querySelector('.nol-teamrun-composer-note[role="status"]')?.textContent?.trim();
  const items = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const labels = (): string[] => items().map(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim());
  const item = (label: string): HTMLButtonElement => items().find(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim() === label)!;
  const names = (): string[] => [...document.querySelectorAll(".nol-mention-name")].map(t => t.textContent!.trim());
  const sent = (): MessageSendParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessageSend))
    .map(t => MessageSendParams.fromJson(t.parameters));
  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await fixture.whenStable();
  };
  const ready = (): Promise<void> => Wait.until(() => expect(loading().textContent).toBe(""));
  const choose = async (...path: string[]): Promise<void> => {
    await ready();
    await click(picker());
    for (const label of path)
      await click(item(label));
  };
  const chooseProvider = async (...path: string[]): Promise<void> => {
    await choose();
    await click(providerRow());
    for (const label of path)
      await click(item(label));
  };
  const chooseKind = async (...path: string[]): Promise<void> => {
    await chooseProvider();
    await click(required(document.querySelector<HTMLButtonElement>(".nol-teamrun-kind")));
    for (const label of path)
      await click(item(label));
  };
  const rowsOf = (column: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(`.nol-teamrun-composer-${column} button[nol-menu-item]`)];
  const labelOf = (row: HTMLElement): string => required(required(row.querySelector(".nol-menu-item-label")).textContent).trim();
  const buttonLabel = (): string | undefined => picker().querySelector(".nol-teamrun-composer-label")?.textContent?.trim();
  const providerLine = (): string | undefined => root().querySelector(".nol-teamrun-composer-provider")?.textContent?.trim();
  const answerAs = async (name: string): Promise<void> => {
    await type(`@${name} over to you`);
    await send();
    await Wait.until(() => expect(buttonLabel()?.startsWith(`@${name} `)).toBe(true));
    await ready();
  };
  const providerRow = (): HTMLButtonElement => required(document.querySelector<HTMLButtonElement>(".nol-teamrun-provider-row"));
  const providerRowLabel = (): string | undefined => providerRow().querySelector(".nol-menu-item-label")?.textContent?.trim();
  const close = (): Promise<void> => click(picker());
  const access = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-access")!;
  const modeLabel = (): string | undefined => access().querySelector(".nol-teamrun-composer-label")?.textContent?.trim();
  const risky = (): HTMLElement | null => access().querySelector<HTMLElement>(".nol-teamrun-composer-risky");
  const modeRows = (): string[][] => [...[...document.querySelectorAll("nol-menu")].at(-1)!.querySelectorAll<HTMLElement>("button[nol-menu-item]")]
    .map(t => [t.querySelector(".nol-menu-item-label")!.textContent!.trim(), t.querySelector(".nol-menu-item-description")?.textContent?.trim() ?? "",
      t.querySelector(".nol-menu-item-tag")?.textContent?.trim() ?? "", t.querySelector(".nol-menu-item-icon")?.textContent?.trim() ?? "", String(t.getAttribute("aria-checked"))]);
  const chatSettings = (): unknown[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationSetMemberSettings))
    .map(t => t.parameters);
  const memberModes = (): (string | null)[][] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationSetMemberMode))
    .map(t => ChatMemberModeParams.fromJson(t.parameters)).map(t => [t.chatId, t.teammateId, t.mode]);
  const chooseMode = async (name: string): Promise<void> => {
    await ready();
    await click(access());
    await click([...[...document.querySelectorAll("nol-menu")].at(-1)!.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")]
      .find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === name)!);
  };
  const refresh = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>(".nol-teamrun-refresh-models")!;
  const refreshes = (): number => document.querySelectorAll(".nol-teamrun-refresh-models").length;
  const refreshModels = async (): Promise<void> => {
    await choose();
    await click(refresh());
    await close();
  };
  const reopen = async (): Promise<void> => {
    await ready();
    if (!Object.isNull(document.querySelector("nol-menu")))
      await close();
    await choose();
  };
  const type = async (text: string): Promise<void> => {
    box().value = text;
    box().setSelectionRange(text.length, text.length);
    box().dispatchEvent(new Event("input", { bubbles: true }));
    await fixture.whenStable();
  };
  const key = async (name: string, options: KeyboardEventInit = {}): Promise<void> => {
    box().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options }));
    await fixture.whenStable();
  };
  const send = async (): Promise<void> => {
    await Wait.until(() => expect(sendButton()?.disabled).toBe(false));
    await click(sendButton()!);
  };
  const pick = async (files: readonly File[]): Promise<void> => {
    const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: files, configurable: true });
    input.dispatchEvent(new Event("change"));
    await fixture.whenStable();
  };
  const sized = (name: string, size: number, mediaType: string = ""): File => {
    const file = new File(["a"], name, { type: mediaType });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };
  const answered = (): JsonValue => new MessageSendResult(SampleData.userMessage, []).toJson();
  const refusing = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.ChooseEffort]: AbilityCell.cannot("its models each have one fixed setting"),
      [ProviderAbility.ChooseSpeed]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet"), [ProviderAbility.PlanMode]: AbilityCell.cannot("it has no plan mode") }));
  const tooltip = (): HTMLElement | null => document.querySelector<HTMLElement>(".cdk-overlay-container nol-tooltip");
  const shownTooltip = (): HTMLElement => {
    const found = tooltip();
    if (Object.isNull(found))
      throw new Error("No tooltip shows.");
    return found;
  };
  const modes = [new ProviderMode("auto", "Default", "Edits files in the workspace, and asks before anything else."),
    new ProviderMode("read-only", "Read Only", "Reads files, and asks before any change."),
    new ProviderMode("full-access", "Full Access", "Edits files and runs commands anywhere without asking.", true)];
  const withModes = (): void => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true)], true, false, null, false,
      modes, "auto"));
  };
  const withPlanMode = (planMode: string | null = "plan"): void => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true)], true, false, null, false,
      [...modes, new ProviderMode("plan", "Plan", "Reads files and plans, and changes nothing.", false, true)], "auto", false, planMode));
  };
  const planFirstRow = (): HTMLButtonElement | null => document.querySelector<HTMLButtonElement>(".nol-teamrun-plan-first");
  const shownPlanFirstRow = (): HTMLButtonElement => {
    const row = planFirstRow();
    if (Object.isNull(row))
      throw new Error("The permissions menu shows no Plan first row.");
    return row;
  };
  const plansFirst = (): (string | boolean)[][] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationSetPlanFirst))
    .map(t => ChatPlanFirstParams.fromJson(t.parameters)).map(t => [t.chatId, t.planFirst]);
  const answerPlanFirst = (): void => {
    context.answer(MethodName.ConversationSetPlanFirst, t => SampleData.conversation.withPlanFirst(ChatPlanFirstParams.fromJson(t).planFirst).toJson());
  };
  const listPlanFirst = (planFirst: () => boolean): void => {
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id
      ? [SampleData.conversation.withPlanFirst(planFirst()).toJson()] : []);
  };
  const confirmTitle = (): string | undefined => document.querySelector("nol-teamrun-confirm-dialog .nol-dialog-title")?.textContent?.trim();
  const answerConfirm = async (button: string): Promise<void> => {
    document.querySelector<HTMLButtonElement>(`nol-teamrun-confirm-dialog ${button}`)!.click();
    await fixture.whenStable();
  };
  const keptChoices = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationResponderSet))
    .map(t => JSON.stringify(ConversationResponderParams.fromJson(t.parameters).toJson()));
  const choiceParams = (responder: ConversationResponder, conversationId: string = "c1", chosen: boolean = false): string =>
    JSON.stringify(new ConversationResponderParams(conversationId, responder, chosen).toJson());

  beforeEach(() => {
    localStorage.removeItem(Resources.composerChoicesStorageKey);
    context = SampleData.createContext().answer(MethodName.MessagePage, () =>
      SampleData.page([SampleData.userMessage, SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false).toJson());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ImageViewerService.release(context);
    PlanUsageStatus.release(context);
    ChatStoreService.release(context);
    ComposerDefaultService.release(context);
    localStorage.removeItem(Resources.composerChoicesStorageKey);
  });

  it("opens one picker with the Model and Effort columns side by side and the provider below while no teammate answers, with no responder rows", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();

    await choose();

    const groups = [...document.querySelectorAll<HTMLElement>('nol-menu-group[role="group"]')];
    expect(groups.map(t => required(required(t.querySelector(".nol-menu-label")).textContent).trim())).toEqual([Resources.modelLabel, Resources.effortLabel]);
    expect(required(groups[0]).getBoundingClientRect().right).toBeLessThanOrEqual(required(groups[1]).getBoundingClientRect().left + 0.5);
    expect(required(groups[0]).getBoundingClientRect().top).toBeCloseTo(required(groups[1]).getBoundingClientRect().top, 1);
    expect(labels()).toEqual([Resources.formatProviderDefault("Codex", "gpt-5"), "gpt-5", "gpt-5-mini", "Medium", "High", "Work · Codex"]);
    expect(items().map(t => t.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false", "true", null]);
    expect(items().map(t => t.getAttribute("aria-haspopup"))).toEqual([null, null, null, null, null, "menu"]);
    expect([document.querySelectorAll("nol-menu").length, document.querySelector(".nol-teamrun-composer-scope")]).toEqual([1, null]);
    await close();
  });

  it("names a teammate's model and effort for this chat, offers to make them its default, and edits it or answers without it from the footer", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();

    await choose();

    expect(labels()).toEqual([Resources.formatProviderDefault("Codex", "gpt-5"), "gpt-5", "gpt-5-mini", "Medium", "High", Resources.formatMakeDefault("Alice"),
      "Work · Codex", Resources.formatEditTeammate("@Alice"), Resources.answerWithoutTeammateLabel]);
    expect(items().map(t => t.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false", "true", null, null, null, null]);
    expect([document.querySelector(".nol-teamrun-composer-scope")?.textContent?.trim(), item(Resources.formatMakeDefault("Alice")).getAttribute("aria-disabled")])
      .toEqual([Resources.formatAppliesInChat("Alice"), "true"]);

    await click(item(Resources.formatEditTeammate("@Alice")));
    await Wait.until(() => expect(document.querySelector<HTMLInputElement>("input.nol-teamrun-teammate-name")?.value).toBe("Alice"));
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")!.click();
    await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
  });

  it("moves a named teammate to another enabled provider of its kind from its Provider row, clearing its permission mode and keeping a model the provider offers", async () => {
    const data = new TeammateFixture(context);
    data.teammates = [new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "plan"), data.bob];
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    const old = new Provider("a4", "codex", "Old", "D:/old", AuthStatus.LoggedIn, null, null, null, null, "t", false);
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson(), old.toJson(), providerOf("claude").toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider();
    const offered = [...document.querySelectorAll("nol-menu")[1]!.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
    expect(offered.map(t => [t.querySelector(".nol-menu-item-label")!.textContent!.trim(), t.getAttribute("aria-checked")]))
      .toEqual([["Personal · This computer", "false"], ["Work · This computer", "true"]]);
    await click(item("Personal · This computer"));

    await Wait.until(() => expect(context.count(MethodName.TeammateUpdate)).toBe(1));
    expect(context.parametersOf(MethodName.TeammateUpdate)).toEqual({ teammateId: "alice", providerId: "a3", mode: null, expectedProviderId: "a1" });
    await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
      .map(t => ProviderListModelsParams.fromJson(t.parameters).providerId)).toContain("a3"));
    await choose();
    expect(providerRowLabel()).toBe("Personal · Codex");
    expect(context.count(MethodName.TeammateUpdate)).toBe(1);
  });

  it("starts a named teammate moved to a provider that doesn't offer its model at that provider's default model", async () => {
    new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => SampleData.catalog([ProviderListModelsParams.fromJson(t).providerId === "a3"
        ? new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low"], true, null, true) : new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]));
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");

    await Wait.until(() => expect([store.teammate("alice")?.providerId, store.teammate("alice")?.model]).toEqual(["a3", null]));
    expect([context.count(MethodName.TeammateUpdate), context.parametersOf(MethodName.TeammateUpdate)])
      .toEqual([1, { teammateId: "alice", providerId: "a3", model: null, effort: null, expectedProviderId: "a1" }]);
  });

  it("saves a named teammate's move once its new provider's models load, even when the person picks another responder meanwhile", async () => {
    new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    let release: () => void = () => undefined;
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => ProviderListModelsParams.fromJson(t).providerId === "a3"
        ? new Promise<JsonValue>(resolve => release = () => resolve(SampleData.catalog([new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low"], true, null, true)])))
        : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]));
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");
    await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
      .map(t => ProviderListModelsParams.fromJson(t.parameters).providerId)).toContain("a3"));
    await choose(Resources.answerWithoutTeammateLabel);
    expect(context.count(MethodName.TeammateUpdate)).toBe(0);
    release();

    await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a3"));
    expect([context.count(MethodName.TeammateUpdate), context.parametersOf(MethodName.TeammateUpdate)])
      .toEqual([1, { teammateId: "alice", providerId: "a3", model: null, effort: null, expectedProviderId: "a1" }]);
  });

  it("keeps a named teammate's model, effort and speed when its new provider's models can't load", async () => {
    new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => {
        if (ProviderListModelsParams.fromJson(t).providerId === "a3")
          throw new Error("Personal is offline.");
        return SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]);
      });
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");

    await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a3"));
    expect([context.count(MethodName.TeammateUpdate), store.teammate("alice")?.model, store.teammate("alice")?.effort, context.parametersOf(MethodName.TeammateUpdate)])
      .toEqual([1, "gpt-5", "high", { teammateId: "alice", providerId: "a3" }]);
  });

  it("saves nothing for a named teammate deleted while its new provider's models load", async () => {
    new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    let release: () => void = () => undefined;
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => ProviderListModelsParams.fromJson(t).providerId === "a3"
        ? new Promise<JsonValue>(resolve => release = () => resolve(SampleData.catalog([])))
        : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]));
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");
    await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
      .map(t => ProviderListModelsParams.fromJson(t.parameters).providerId)).toContain("a3"));
    expect(await store.deleteTeammate(store.teammate("alice")!)).toBe(true);
    release();
    await store.modelCatalogs.load("codex", "a3");
    await fixture.whenStable();

    expect([context.count(MethodName.TeammateUpdate), store.teammate("alice")]).toEqual([0, null]);
  });

  describe("while a named teammate's move waits for its new provider's models", () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    const lab = new Provider("a5", "codex", "Lab", "D:/lab", AuthStatus.LoggedIn, null, null, null, null, "t");
    const updates = (): (string | undefined)[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.TeammateUpdate))
      .map(t => TeammateUpdateParams.fromJson(t.parameters).providerId);
    let release: () => void = () => undefined;

    beforeEach(() => {
      new TeammateFixture(context);
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson(), lab.toJson()])
        .answer(MethodName.ProviderModelCatalog, t => ProviderListModelsParams.fromJson(t).providerId === "a3"
          ? new Promise<JsonValue>(resolve => release = () => resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)])))
          : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]));
    });

    const pickPersonal = async (store: ChatStoreService): Promise<void> => {
      await chooseProvider("Personal · This computer");
      await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
        .map(t => ProviderListModelsParams.fromJson(t.parameters).providerId)).toContain("a3"));
      await choose();
      expect([providerRowLabel(), store.teammate("alice")?.providerId]).toEqual(["Personal · Codex", "a1"]);
      await click(providerRow());
      expect([...document.querySelectorAll("nol-menu")[1]!.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")]
        .filter(t => t.getAttribute("aria-checked") === "true").map(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim())).toEqual(["Personal · This computer"]);
      await close();
    };

    it("shows the picked provider, and a newer pick replaces it, so only the newer one saves", async () => {
      const store = await prepare();
      remember(new ComposerSettings("codex", null, null, null, "alice"));
      await render();
      await pickPersonal(store);

      await chooseProvider("Lab · This computer");
      await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a5"));
      release();
      await store.modelCatalogs.load("codex", "a3");
      await fixture.whenStable();

      expect([updates(), store.teammate("alice")?.providerId]).toEqual([["a5"], "a5"]);
      await choose();
      expect(providerRowLabel()).toBe("Lab · Codex");
    });

    it("cancels the move when the teammate's own provider is picked again, saving nothing", async () => {
      const store = await prepare();
      remember(new ComposerSettings("codex", null, null, null, "alice"));
      await render();
      await pickPersonal(store);

      await chooseProvider("Work · This computer");
      await choose();
      expect(providerRowLabel()).toBe("Work · Codex");
      await close();
      release();
      await store.modelCatalogs.load("codex", "a3");
      await fixture.whenStable();

      expect([updates(), store.teammate("alice")?.providerId]).toEqual([[], "a1"]);
    });
  });

  describe("when a named teammate's effort and provider change at once", () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    const saved = (): unknown[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.TeammateUpdate)).map(t => t.parameters);
    const move = { teammateId: "alice", providerId: "a3" };
    const medium = (chatId: string): object => ({ chatId, teammateId: "alice", settings: { model: "gpt-5", effort: "medium", speed: null } });
    let releaseSave: () => void = () => undefined;
    let releaseCatalog: () => void = () => undefined;
    let saves = 0;

    const start = async (holdCatalog: boolean): Promise<ChatStoreService> => {
      const data = new TeammateFixture(context);
      data.members.push(new ConversationMember("c2", "alice", "t", null, false));
      const catalog = SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["medium", "high"], true, null, true)]);
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
        .answer(MethodName.ProviderModelCatalog, t => holdCatalog && ProviderListModelsParams.fromJson(t).providerId === "a3"
          ? new Promise<JsonValue>(resolve => releaseCatalog = () => resolve(catalog)) : catalog)
        .answer(MethodName.TeammateUpdate, t => {
          const params = TeammateUpdateParams.fromJson(t);
          const teammate = params.applyTo(data.teammates.find(u => u.id === params.teammateId)!, "t");
          data.teammates = data.teammates.map(u => u.id === teammate.id ? teammate : u);
          saves += 1;
          return saves === 1 ? new Promise<JsonValue>(resolve => releaseSave = () => resolve(teammate.toJson())) : teammate.toJson();
        });
      saves = 0;
      const store = await prepare();
      remember(new ComposerSettings("codex", null, null, null, "alice"));
      await render();
      return store;
    };

    it("saves an effort picked while the teammate's move saves for this chat only, leaving the teammate's own effort", async () => {
      const store = await start(false);

      await chooseProvider("Personal · This computer");
      await Wait.until(() => expect(saves).toBe(1));
      await choose("Medium");
      await Wait.until(() => expect(chatSettings()).toEqual([medium("c1")]));
      releaseSave();

      await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a3"));
      expect([saved(), store.teammate("alice")?.effort]).toEqual([[move], "high"]);
    });

    it("saves an effort picked while a move waits for its models for this chat at once, and the move after it", async () => {
      const store = await start(true);

      await chooseProvider("Personal · This computer");
      await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
        .map(t => ProviderListModelsParams.fromJson(t.parameters).providerId)).toContain("a3"));
      await choose("Medium");
      await Wait.until(() => expect(chatSettings()).toEqual([medium("c1")]));
      releaseCatalog();
      await store.modelCatalogs.load("codex", "a3");
      await Wait.until(() => expect(saves).toBe(1));
      releaseSave();

      await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a3"));
      expect([saved(), store.teammate("alice")?.effort]).toEqual([[move], "high"]);
    });

    it("saves an effort picked in another chat's composer while the teammate's move saves for that chat, and shows the move there", async () => {
      context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(),
        new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp, false, null, new ConversationResponder("alice")).toJson()]);
      const store = await start(false);

      await chooseProvider("Personal · This computer");
      await Wait.until(() => expect(saves).toBe(1));
      const first = fixture;
      await render("c2");
      await choose();
      expect([first.componentRef.hostView.destroyed, first.componentInstance === fixture.componentInstance]).toEqual([false, false]);
      expect(providerRowLabel()).toBe("Personal · Codex");
      await click(item("Medium"));
      await Wait.until(() => expect(chatSettings()).toEqual([medium("c2")]));
      releaseSave();

      await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a3"));
      expect(saved()).toEqual([move]);
    });
  });

  it("saves a pick made while an earlier move saves after that save, so the later pick wins", async () => {
    const data = new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    let release: () => void = () => undefined;
    let saves = 0;
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]))
      .answer(MethodName.TeammateUpdate, t => {
        const params = TeammateUpdateParams.fromJson(t);
        const teammate = params.applyTo(data.teammates.find(u => u.id === params.teammateId)!, "t");
        data.teammates = data.teammates.map(u => u.id === teammate.id ? teammate : u);
        saves += 1;
        return saves === 1 ? new Promise<JsonValue>(resolve => release = () => resolve(teammate.toJson())) : teammate.toJson();
      });
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");
    await Wait.until(() => expect(saves).toBe(1));
    await chooseProvider("Work · This computer");
    expect(saves).toBe(1);
    release();

    await Wait.until(() => expect(saves).toBe(2));
    await Wait.until(() => expect(store.teammate("alice")?.providerId).toBe("a1"));
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.TeammateUpdate))
      .map(t => TeammateUpdateParams.fromJson(t.parameters).providerId)).toEqual(["a3", "a1"]);
  });

  it("keeps a named teammate on its provider and says why when Core refuses the move while one of its chats has an open reply", async () => {
    new TeammateFixture(context);
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    const refusal = "The chat \"c1\" already has a reply in progress.";
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]))
      .refuse(MethodName.TeammateUpdate, ErrorCode.Conflict, refusal, "c1");
    const store = await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();

    await chooseProvider("Personal · This computer");

    await Wait.until(() => expect(context.noticeText()).toBe(Resources.formatTeammateError("Alice", refusal)));
    expect([context.count(MethodName.TeammateUpdate), store.teammate("alice")?.providerId]).toEqual([1, "a1"]);
    await choose();
    expect(providerRowLabel()).toBe("Work · Codex");
  });

  it("says the models are loading in the model submenu and in a hidden status, which stays open with Refresh models off, with no plan note, while a refresh runs", async () => {
    const refreshed = new DeferredResponse();
    let calls = 0;
    context.answer(MethodName.ProviderModelCatalog, () => ++calls === 1
      ? SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]) : refreshed.promise);
    await prepare();
    remember(new ComposerSettings("codex", null, null, null));
    await render();

    await choose();
    await click(refresh());
    expect(labels()).toContain(Resources.loadingModelsLabel);
    expect([item(Resources.loadingModelsLabel).getAttribute("aria-disabled"), refresh().getAttribute("aria-disabled")]).toEqual(["true", "true"]);
    const box = loading().getBoundingClientRect();
    expect([loading().getAttribute("role"), loading().textContent, picker().hasAttribute("aria-busy"), box.width, box.height, getComputedStyle(loading()).position])
      .toEqual(["status", Resources.loadingModelsLabel, false, 1, 1, "absolute"]);

    refreshed.resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]));
    await ready();
    expect(calls).toBe(2);
    expect([loading().textContent, picker().hasAttribute("aria-busy")]).toEqual(["", false]);
  });

  it("names its model column's default row for the model the catalog marks as its default, and checks only that row while no model is chosen", async () => {
    await prepare();
    remember(new ComposerSettings("codex", null, null, "a1"));
    await render();

    const rows = (): HTMLElement[] => rowsOf("models");
    const checked = (): string[] => rows().filter(t => t.getAttribute("aria-checked") === "true").map(labelOf);

    await choose();

    expect(summary()).toContain("Codex · Work · This computer · gpt-5");
    expect(rows().map(labelOf)).toEqual([Resources.formatProviderDefault("Codex", "gpt-5"), "gpt-5", "gpt-5-mini"]);
    expect(checked()).toEqual([Resources.formatProviderDefault("Codex", "gpt-5")]);
    await close();
    await choose("gpt-5");
    await choose();
    expect(checked()).toEqual(["gpt-5"]);
    await close();
  });

  it("lists one default row, named after the model it resolves to, and not the provider's own default row that stands for a listed model, checking it for a chat on that row", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("default", "Opus 5.5", "", null, true, "claude-opus-5-5", true),
      new ProviderModel("opus", "Opus 5.5", "", null, false, "claude-opus-5-5", true), new ProviderModel("sonnet", "Sonnet 5.5", "", null, false, "claude-sonnet-5-5", true)]));
    await prepare();
    remember(new ComposerSettings("codex", "default", null, "a1"));
    await render();

    const rows = (): HTMLElement[] => rowsOf("models");
    await choose();

    expect(rows().map(labelOf)).toEqual([Resources.formatProviderDefault("Codex", "Opus 5.5"), "Opus 5.5", "Sonnet 5.5"]);
    expect(rows().filter(t => t.getAttribute("aria-checked") === "true").map(labelOf)).toEqual([Resources.formatProviderDefault("Codex", "Opus 5.5")]);
    await close();
  });

  it("shows the provider type, the model and the effort on the button while no teammate answers, and the provider beside it", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();
    await ready();

    expect([buttonLabel(), providerLine()]).toEqual(["Codex · gpt-5 · High", "Work · Codex"]);
    await choose("Medium");
    await Wait.until(() => expect(buttonLabel()).toBe("Codex · gpt-5 · Medium"));
    expect(root().querySelector(".nol-teamrun-composer-short")?.textContent?.trim()).toBe("Codex");
  });

  it("names a teammate on the button by @ and its name, with its model and effort, and its provider beside it", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    expect([buttonLabel(), root().querySelector(".nol-teamrun-composer-short")?.textContent?.trim(), providerLine()]).toEqual(["@Alice · gpt-5 · High", "@Alice", "Work · Codex"]);
  });

  it("tells apart providers of one kind by name beside the button and on the picker's provider row, and names a provider called as its kind once", async () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    const plain = new Provider("a4", "codex", "Codex", "D:/codex", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson(), plain.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a3"));
    await render();
    await ready();

    expect(providerLine()).toBe("Personal · Codex");
    await choose();
    expect(providerRowLabel()).toBe("Personal · Codex");
    await close();
    await chooseProvider("Codex · This computer");
    await ready();
    expect(providerLine()).toBe("Codex");
  });

  it("names the model on the button as its provider's catalog does, showing the stored id only until that catalog loads", async () => {
    const models = new DeferredResponse();
    context.answer(MethodName.ProviderModelCatalog, () => models.promise);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5-mini", "high", "a1"));
    await render();

    await Wait.until(() => expect(buttonLabel()).toBe("Codex · gpt-5-mini · High"));
    models.resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5 Astra", "", ["high"], true, null, true),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["high"], false, null, true)]));
    await Wait.until(() => expect(buttonLabel()).toBe("Codex · GPT-5 Mini · High"));
  });

  it("sorts each section of the mention completions and the kind's providers by name, ignoring case with an accented name beside its letter", async () => {
    const teammates = new TeammateFixture(context);
    teammates.teammates = ["zoe", "edgar", "Émile", "bob", "Élise", "Alice", "dora"].map(t => new Teammate(t, t, null, "a1", Harness.Provider, null, null, "t", "t"));
    teammates.members = ["zoe", "Émile", "bob", "Alice"].map(t => new ConversationMember("c1", t, "t", null, false));
    const provider = (id: string, label: string): Provider => new Provider(id, "codex", label, `D:/${id}`, AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [provider("a1", "work"), provider("a2", "Émile"), provider("a3", "alpha")].map(t => t.toJson()));
    await prepare();
    remember(new ComposerSettings("codex", null, null, "a1"));
    await render();

    await type("@");
    await Wait.until(() => expect(names()).toEqual(["Alice", "bob", "Émile", "zoe", "dora", "edgar", "Élise"]));
    await key("Escape");
    await chooseProvider();
    expect(menuLabels()).toEqual([Resources.kindLabel, "alpha · This computer", "Émile · This computer", "work · This computer"]);
    await close();
  });

  for (const way of ["Enter", "a click"])
    it(`paints the picker above the composer low in the window, at the size and place it settles at, in the first frame after it opens by ${way}`, async () => {
      new TeammateFixture(context);
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
      await render();
      await ready();
      root().style.marginTop = `${window.innerHeight - root().getBoundingClientRect().bottom}px`;
      const menu = (): DOMRect | undefined => document.querySelector(".cdk-overlay-container nol-menu")?.getBoundingClientRect();
      const focused = (): string | undefined => document.activeElement?.querySelector(".nol-menu-item-label")?.textContent?.trim();

      picker().focus();
      const painted = new Promise<DOMRect | undefined>(resolve => void afterNextRender({ read: () => resolve(menu()) }, { injector: fixture.componentRef.injector }));
      if (way === "Enter")
        picker().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
      else
        picker().click();
      const first = await painted;
      await Wait.until(() => expect(focused()).toBe("gpt-5"));
      await fixture.whenStable();
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));
      const settled = menu();

      expect([first, settled].map(t => t !== undefined)).toEqual([true, true]);
      AppearanceFixture.expectPixels(settled?.bottom ?? Number.NaN, picker().getBoundingClientRect().top);
      for (const [shown, place] of [[first?.top ?? 0, settled?.top ?? Number.NaN], [first?.height ?? 0, settled?.height ?? Number.NaN], [first?.left ?? 0, settled?.left ?? Number.NaN]] as const)
        AppearanceFixture.expectPixels(shown, place);
      await userEvent.keyboard("{Escape}");
    });

  it("reaches every row of the picker from the keyboard, opening at its checked model, Right opening the provider's submenu at its checked row and Left closing it back to its row", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();
    await ready();
    const press = async (name: string): Promise<void> => {
      await userEvent.keyboard(`{${name}}`);
      await fixture.whenStable();
    };
    const focused = (): string | undefined => document.activeElement?.querySelector(".nol-menu-item-label")?.textContent?.trim();

    picker().focus();
    await press("Enter");
    await Wait.until(() => expect(focused()).toBe("gpt-5"));
    const reached = [focused()];
    for (let step = 0; step < 4; step++) {
      await press("ArrowDown");
      reached.push(focused());
    }
    expect(reached).toEqual(["gpt-5", "gpt-5-mini", "Medium", "High", "Work · Codex"]);
    await press("ArrowRight");
    await Wait.until(() => expect(focused()).toBe("Work · This computer"));
    expect(document.querySelectorAll("nol-menu")).toHaveLength(2);
    await press("ArrowLeft");
    await Wait.until(() => expect(focused()).toBe("Work · Codex"));
    expect(document.querySelectorAll("nol-menu")).toHaveLength(1);
    for (let step = 0; step < 3; step++)
      await press("ArrowUp");
    await Wait.until(() => expect(focused()).toBe("gpt-5-mini"));
    await press("Enter");
    await Wait.until(() => expect(choice()?.model).toBe("gpt-5-mini"));
    expect(document.querySelectorAll("nol-menu")).toHaveLength(0);
  });

  it("keeps the model and its effort when another provider's catalog still offers them", async () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()]);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();
    await ready();

    await chooseProvider("Personal · This computer");
    await ready();

    expect(summary()).toContain("Personal · This computer · gpt-5 · High");
  });

  it("names the effort levels as the provider does, tags and checks the model's default while none is chosen and sends none, keeps a level when the same model is chosen again, and starts another model at its default", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true, "high", { high: "Deep" }),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low", "medium"], false, null, true)
    ])).answer(MethodName.MessageSend, answered);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5-mini", "low", "a1"));
    await render();
    const effortMenu = (): HTMLElement[] => rowsOf("efforts");
    const tags = (): (string | null)[] => effortMenu().map(t => t.querySelector(".nol-menu-item-tag")?.textContent?.trim() ?? null);
    const checked = (): string[] => effortMenu().filter(t => t.getAttribute("aria-checked") === "true").map(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim());

    await choose("GPT-5");
    await ready();
    expect(choice()?.effort).toBeNull();
    await choose();
    expect(buttonLabel()).toBe("Codex · GPT-5 · Deep");
    expect(effortMenu().map(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim())).toEqual(["Low", "Deep"]);
    expect(checked()).toEqual(["Deep"]);
    expect(tags()).toEqual([null, Resources.recommendedEffortTag]);
    await close();

    await type("hello");
    root().querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.requested?.effort).toBeNull();
    await choose("Low");
    await choose("GPT-5");
    await ready();
    expect(choice()?.effort).toBe("low");

    await choose("GPT-5 Mini");
    await ready();
    await choose();
    expect(buttonLabel()).toBe(`Codex · GPT-5 Mini · ${Resources.modelDefaultEffort}`);
    expect(checked()).toEqual([]);
    expect(tags()).toEqual([null, null]);
  });

  it("sends the chat's chosen speed with its turn, and starts another model at its default speed", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("priority", "Fast")], null),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", null, false, null, true)
    ])).answer(MethodName.MessageSend, answered);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1", null, "priority"));
    await render();
    await ready();

    await type("hello");
    root().querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.requested?.speed).toBe("priority");
    await choose("GPT-5 Mini");
    await ready();
    expect([choice()?.model, choice()?.speed]).toEqual(["gpt-5-mini", null]);
  });

  it("offers Claude's fast mode as a speed column under Effort beside Standard, keeps it with the chat, and says why it can't serve with the provider's reason", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], "standard"),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", null, false, null, true)
    ]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    const rows = (): string[][] => rowsOf("speeds").map(t => [labelOf(t), String(t.getAttribute("aria-checked"))]);
    const note = (): string | undefined => document.querySelector(".nol-teamrun-speed-note .nol-menu-item-label")?.textContent?.trim();

    await choose();
    expect(rows()).toEqual([["Standard", "true"], ["Fast", "false"]]);
    const [effort, speed] = [document.querySelector(".nol-teamrun-composer-efforts"), document.querySelector(".nol-teamrun-composer-speeds")];
    expect([effort, speed?.parentElement?.classList.contains("nol-teamrun-composer-column")]).toEqual([null, true]);
    await click(item("Fast"));
    await ready();
    expect(choice()?.speed).toBe("fast");
    if (!Object.isNull(document.querySelector("nol-menu")))
      await close();
    const reply = new Message("r9", "c1", 9, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance("a1",
      new RequestedSettings("codex", "gpt-5", null, "fast"), new ObservedSettings("codex", "gpt-5", null, null, false, null, "extra_usage_disabled"), "s1", false),
      SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
    await reopen();
    expect(rows()).toEqual([["Standard", "false"], ["Fast", "true"], ["Fast mode needs usage credits, which are turned off. Replies run at standard speed.", "null"]]);
    expect(note()).toBe("Fast mode needs usage credits, which are turned off. Replies run at standard speed.");
    await close();
    await choose("Standard");
    await ready();
    expect(choice()?.speed).toBe("standard");
    if (!Object.isNull(document.querySelector("nol-menu")))
      await close();
    await choose("GPT-5 Mini");
    await reopen();
    expect(document.querySelector(".nol-teamrun-composer-speeds")).toBeNull();
  });

  it("offers Codex's service tiers as a speed column by their own names and descriptions, with the model's default checked while none is chosen", async () => {
    const tiers = [new ProviderSpeed("priority", "Fast", "Faster replies at a higher cost."), new ProviderSpeed("flex", "Flex", "Slower replies at a lower cost.")];
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, tiers, null),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", null, false, null, true, null, {}, tiers, "priority")
    ]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    const rows = (): string[][] => rowsOf("speeds").map(t => [labelOf(t), t.querySelector(".nol-menu-item-description")?.textContent?.trim() ?? "",
      String(t.getAttribute("aria-checked"))]);

    await choose();
    expect(rows()).toEqual([[Resources.modelDefaultSpeed, "", "true"], ["Fast", "Faster replies at a higher cost.", "false"], ["Flex", "Slower replies at a lower cost.", "false"]]);
    await click(item("Flex"));
    await ready();
    expect(choice()?.speed).toBe("flex");
    if (!Object.isNull(document.querySelector("nol-menu")))
      await close();
    const reply = new Message("r9", "c1", 9, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance("a1",
      new RequestedSettings("codex", "gpt-5", null, "flex"), new ObservedSettings("codex", "gpt-5", null, null, false, "priority", "tier_not_served"), "s1", false),
      SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
    await reopen();
    expect(document.querySelector(".nol-teamrun-speed-note .nol-menu-item-label")?.textContent?.trim()).toBe("The provider served another speed. Replies run at Fast speed.");
    await close();
    await choose("GPT-5 Mini");
    await reopen();
    expect(rows().map(t => t[2])).toEqual(["true", "false"]);
  });

  it("offers each kind's own providers and sends with the chosen local provider", async () => {
    const home = new Provider("a2", "claude", "Home", "D:/home", AuthStatus.LoggedIn, null, null, null, null, "t");
    const studio = new Provider("a5", "claude", "Studio", "D:/studio", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson(), studio.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => ProviderListModelsParams.fromJson(t).providerId === "a2"
        ? SampleData.catalog([new ProviderModel("other", "Other model", "", ["low"], true, null, true)])
        : SampleData.catalog([new ProviderModel("gpt-5", "GPT5", "", ["high"], true, null, true)]))
      .answer(MethodName.MessageSend, answered);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();

    await chooseKind("Codex");
    await chooseProvider();
    expect(labels()).toContain("Work · This computer");
    expect(labels()).not.toContain("Home · This computer");
    await click(item("Work · This computer"));
    expect(context.count(MethodName.ProviderModelCatalog)).toBe(1);
    await chooseKind("Claude Code");
    await Wait.until(() => expect(summary()).toContain("Claude Code · Home · This computer"));
    await ready();
    await choose("Other model");
    expect(summary()).toContain("Other model");
    await chooseProvider();
    expect(menuLabels()).toEqual([Resources.kindLabel, "Home · This computer", "Studio · This computer"]);
    await click(item("Studio · This computer"));
    await ready();
    expect(summary()).toContain("Claude Code · Studio · This computer");
    expect(summary()).not.toContain("Other model");

    await type("hello");
    root().querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.providerId).toBe("a5");
    expect(sent()[0]?.requested?.kind).toBe("claude");
    expect(sent()[0]?.requested?.model).toBeNull();
    expect(sent()[0]?.requested?.effort).toBeNull();
  });

  it("lists exactly the added providers of the chosen kind, and starts a kind on the one in its usual folder, else on its first", async () => {
    const home = new Provider("a2", "codex", "Home", "D:/codex-home", AuthStatus.LoggedIn, null, null, null, null, "t");
    const desk = new Provider("a3", "claude", "Desk", "D:/claude-desk", AuthStatus.LoggedIn, null, null, null, null, "t");
    const studio = new Provider("a4", "claude", "Studio", "D:/claude-studio", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [home.toJson(), SampleData.provider.toJson(), desk.toJson(), studio.toJson()]);
    await prepare();
    remember(new ComposerSettings("claude", null, null, "a4"));
    await render();
    await ready();

    await chooseProvider();
    expect(menuLabels()).toEqual([Resources.kindLabel, "Desk · This computer", "Studio · This computer"]);
    await close();
    await chooseKind("Codex");
    await ready();
    expect(summary()).toContain("Codex · Work · This computer");
    await chooseProvider();
    expect(menuLabels()).toEqual([Resources.kindLabel, "Home · This computer", "Work · This computer"]);
    await close();
    await chooseKind("Claude Code");
    await ready();
    expect(summary()).toContain("Claude Code · Desk · This computer");
    expect(choice()?.providerId).toBe("a3");
  });

  it("starts a kind on its first enabled provider when the one in its usual folder is disabled, and on none when all are", async () => {
    const work = new Provider("a1", "codex", "Work", "D:\\profiles\\codex", AuthStatus.LoggedIn, null, null, null, null, "t", false);
    const home = new Provider("a2", "codex", "Home", "D:/codex-home", AuthStatus.LoggedIn, null, null, null, null, "t");
    const desk = new Provider("a3", "claude", "Desk", "D:/claude-desk", AuthStatus.LoggedIn, null, null, null, null, "t", false);
    context.answer(MethodName.ProviderList, () => [work.toJson(), home.toJson(), desk.toJson()]);
    await prepare();
    remember(new ComposerSettings("codex", null, null, "a2"));
    await render();
    await ready();

    await chooseKind("Claude Code");
    expect(choice()?.providerId).toBeNull();
    await chooseKind("Codex");
    await ready();
    expect(summary()).toContain("Codex · Home · This computer");
    expect(choice()?.providerId).toBe("a2");
  });

  describe("opening a chat on a provider type the person has", () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
    const pilot = new Teammate("pilot", "Pilot", null, "copilot-1", Harness.Provider, null, null, "t", "t");
    const open = async (providers: readonly Provider[], teammates: readonly Teammate[] = []): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderList, () => providers.map(t => t.toJson()))
        .answer(MethodName.TeammateList, () => teammates.map(t => t.toJson()))
        .answer(MethodName.ConversationListMembers, () => teammates.map(t => new ConversationMember("c1", t.id, "t", null, false).toJson()));
      await prepare();
      await render();
      await ready();
    };
    const opened = async (kind: string, providerId: string): Promise<void> => {
      expect([choice()?.kind, choice()?.providerId]).toEqual([kind, providerId]);
      expect(reason()).toBeUndefined();
      await type("Hello");
      await Wait.until(() => expect(sendButton()?.disabled).toBe(false));
    };

    it("opens on the chat's teammate's type when only a Copilot provider is found, with Send enabled", async () => {
      await open([providerOf("copilot")], [pilot]);

      await opened("copilot", "copilot-1");
    });

    it("opens on the only type found when the chat has no teammate", async () => {
      await open([providerOf("copilot")]);

      await opened("copilot", "copilot-1");
    });

    it("opens on the only type found when it is neither the first type nor Copilot", async () => {
      await open([providerOf("claude")]);

      await opened("claude", "claude-1");
    });

    it("opens on the chat's teammate's type over the first type and the default teammate's when several types are found", async () => {
      context.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("claude", null, null), "claude-1").toJson());
      await open([SampleData.provider, providerOf("claude"), providerOf("copilot")], [pilot]);

      await opened("copilot", "copilot-1");
    });

    it("keeps the default teammate's model and effort when the chat's teammate is on the same type", async () => {
      context.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("copilot", "gpt-5", "high"), "copilot-1").toJson());
      await open([SampleData.provider, providerOf("copilot")], [pilot]);

      expect([choice()?.model, choice()?.effort]).toEqual(["gpt-5", "high"]);
      await opened("copilot", "copilot-1");
    });

    it("takes the chat's teammate's provider when the default teammate on the same type names none, keeping its model and effort", async () => {
      context.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("copilot", "gpt-5", "high")).toJson());
      await open([SampleData.provider, providerOf("copilot")], [pilot]);

      expect([choice()?.model, choice()?.effort]).toEqual(["gpt-5", "high"]);
      await opened("copilot", "copilot-1");
    });

    it("takes its type's first enabled provider when the starting choice names a disabled one", async () => {
      const off = new Provider("a1", "codex", "Work", "D:\\profiles\\codex", AuthStatus.LoggedIn, null, null, null, null, "t", false);
      context.answer(MethodName.ComposerDefaultRead, () => new ComposerSettings("codex", "gpt-5", null, "a1").toJson());
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderList, () => [off.toJson(), providerOf("codex", "a2").toJson(), providerOf("copilot").toJson()]);
      await prepare();
      await Wait.until(() => expect(ComposerDefaultService.of(context).defaultChoice()?.kind).toBe("codex"));
      await render();
      await ready();

      expect(choice()?.model).toBe("gpt-5");
      await opened("codex", "a2");
    });

    it("opens on the first type with a provider when several types are found and the first has none", async () => {
      await open([providerOf("claude"), providerOf("copilot")]);

      await opened("claude", "claude-1");
    });

    const solo = async (providers: readonly Provider[], teammates: readonly Teammate[]): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderList, () => providers.map(t => t.toJson()))
        .answer(MethodName.TeammateList, () => teammates.map(t => t.toJson()))
        .answer(MethodName.ConversationListMembers, () => []);
      await prepare();
      await render();
      await ready();
    };

    it("opens a chat with no teammate on the only teammate's type and provider when no default teammate is set", async () => {
      await solo([SampleData.provider, providerOf("claude"), providerOf("copilot")], [pilot]);

      await opened("copilot", "copilot-1");
    });

    it("opens a chat made in the window after a chat on Codex on the only teammate's type and provider when no default teammate is set", async () => {
      const claudePilot = new Teammate("pilot", "Pilot", null, "claude-1", Harness.Provider, null, null, "t", "t");
      context.answer(MethodName.ConversationCreate, () => new Conversation("c2", "p1", "New chat", SampleData.timestamp, SampleData.timestamp).toJson());
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()])
        .answer(MethodName.TeammateList, () => [claudePilot.toJson()])
        .answer(MethodName.ConversationListMembers, () => []);
      const store = await prepare();
      remember(new ComposerSettings("codex", null, null, "a1"));
      await render();
      await ready();
      expect(summary()).toContain("Codex · Work · This computer");

      expect((await store.createConversation(null, "p1"))?.id).toBe("c2");
      fixture.componentRef.setInput("conversationId", "c2");
      await fixture.whenStable();
      await ready();

      expect(summary()).toContain("Claude Code · Work · This computer");
      expect([choice("c2")?.kind, choice("c2")?.providerId]).toEqual(["claude", "claude-1"]);
    });

    it("opens a chat with no teammate on the default teammate over the only teammate", async () => {
      context.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("claude", null, null), "claude-1").toJson());
      await solo([SampleData.provider, providerOf("claude"), providerOf("copilot")], [pilot]);

      await opened("claude", "claude-1");
    });

    it("opens a chat with no teammate on the first type when the person has two teammates", async () => {
      const second = new Teammate("second", "Second", null, "claude-1", Harness.Provider, null, null, "t", "t");
      await solo([SampleData.provider, providerOf("claude"), providerOf("copilot")], [pilot, second]);

      await opened("codex", "a1");
    });

    it("opens a chat with no teammate on the first type when the only teammate's provider is off", async () => {
      const off = new Provider("copilot-1", "copilot", "Work", "D:/profiles/copilot", AuthStatus.LoggedIn, null, null, null, null, "t", false);
      await solo([SampleData.provider, off], [pilot]);

      await opened("codex", "a1");
    });

    it("opens on a type with a provider when the default teammate's type has none", async () => {
      context.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("claude", null, null)).toJson());
      await open([providerOf("copilot")]);

      await opened("copilot", "copilot-1");
    });

    it("opens on a type with a provider when the last sent choice's type has none left", async () => {
      context.answer(MethodName.ComposerDefaultRead, () => new ComposerSettings("codex", null, null, "a1").toJson());
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderList, () => [providerOf("copilot").toJson()]);
      await prepare();
      await Wait.until(() => expect(ComposerDefaultService.of(context).defaultChoice()?.kind).toBe("codex"));
      await render();
      await ready();

      await opened("copilot", "copilot-1");
    });
  });

  it("sets the named teammate's model and effort for this chat only, keeping its effort when the same model is chosen again, and makes them its default on request", async () => {
    const data = new TeammateFixture(context);
    const store = await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    const chosen = (model: string, effort: string | null): object => ({ chatId: "c1", teammateId: "alice", settings: { model, effort, speed: null } });

    await choose("gpt-5-mini");
    await Wait.until(() => expect(chatSettings()).toEqual([chosen("gpt-5-mini", null)]));
    await choose("Medium");
    await Wait.until(() => expect(chatSettings()).toEqual([chosen("gpt-5-mini", null), chosen("gpt-5-mini", "medium")]));
    await Wait.until(() => expect(summary()).toContain("Alice · gpt-5-mini · Medium · Codex · Work · This computer"));

    expect([choice()?.model, context.count(MethodName.TeammateUpdate), store.teammate("alice")?.model, store.teammate("alice")?.effort]).toEqual(["gpt-5", 0, "gpt-5", "high"]);
    await choose("gpt-5-mini");
    expect(chatSettings()).toHaveLength(2);
    await choose();
    expect(item(Resources.formatMakeDefault("Alice")).getAttribute("aria-disabled")).not.toBe("true");
    await click(item(Resources.formatMakeDefault("Alice")));
    await Wait.until(() => expect(chatSettings()).toHaveLength(3));
    expect([context.parametersOf(MethodName.TeammateUpdate), chatSettings()[2], data.members.find(t => t.teammateId === "alice")?.settings])
      .toEqual([{ teammateId: "alice", model: "gpt-5-mini", effort: "medium", expectedProviderId: "a1" }, { chatId: "c1", teammateId: "alice", settings: null }, null]);
    await Wait.until(() => expect(store.teammate("alice")?.effort).toBe("medium"));
    expect(summary()).toContain("Alice · gpt-5-mini · Medium");
    await store.removeMember("c1", "alice");
    await Wait.until(() => expect(choice()?.responderTeammateId).toBeNull());
    expect(summary()).toContain("gpt-5 · Medium");
    expect(data.members).toEqual([]);
  });

  it("keeps the chat's own model for its teammate when making them its default fails", async () => {
    new TeammateFixture(context);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await choose("gpt-5-mini");
    await Wait.until(() => expect(chatSettings()).toHaveLength(1));
    context.fail(MethodName.TeammateUpdate, "Refused");

    await choose();
    await click(item(Resources.formatMakeDefault("Alice")));

    await Wait.until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).at(-1)?.title).toBe(Resources.chatActionTitles[ChatAction.SaveTeammate]));
    await fixture.whenStable();
    expect([context.count(MethodName.TeammateUpdate), chatSettings(), summary()?.includes("Alice · gpt-5-mini")])
      .toEqual([1, [{ chatId: "c1", teammateId: "alice", settings: { model: "gpt-5-mini", effort: null, speed: null } }], true]);
  });

  it("sets nothing for the chat when its teammate's own model and effort are chosen again, and clears what the chat chose", async () => {
    const data = new TeammateFixture(context);
    data.members = [new ConversationMember("c1", "alice", "t", null, false, null, new ChatMemberSettings("gpt-5-mini", null))];
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();
    expect(buttonLabel()).toBe(`@Alice · gpt-5-mini · ${Resources.formatEffort(null)}`);

    await choose("gpt-5");

    await Wait.until(() => expect(chatSettings()).toEqual([{ chatId: "c1", teammateId: "alice", settings: null }]));
    await Wait.until(() => expect(buttonLabel()).toBe("@Alice · gpt-5 · High"));
    expect(context.count(MethodName.TeammateUpdate)).toBe(0);
  });

  it("drops a teammate removed from the chat an opened project sets aside on screen as that chat's responder", async () => {
    const data = new TeammateFixture(context);
    data.members = [new ConversationMember("c1", "alice", "t", null, false), new ConversationMember("c3", "bob", "t", null, false)];
    context.answer(MethodName.ConversationListMembers, t => data.members.filter(u => u.conversationId === ConversationIdParams.fromJson(t).conversationId).map(u => u.toJson()))
      .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p2"
        ? [new Conversation("c3", "p2", "Third", SampleData.timestamp, SampleData.timestamp).toJson()] : [SampleData.conversation.toJson()])
      .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    const store = await prepare();
    await store.conversationInView("c1");
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();
    expect(summary()).toContain("Alice");

    await store.openProject(SampleData.otherProject.rootPath);
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c3"));
    await store.removeMember("c1", "alice");
    await Wait.until(() => expect(choice()?.responderTeammateId).toBeNull());
    await ready();

    expect(store.screenConversationId()).toBe("c1");
    expect(summary()).not.toContain("Alice");
    expect(data.members.map(t => t.teammateId)).toEqual(["bob"]);
  });

  it("names a chosen or served speed the provider gives no name by its id", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("priority", "Fast"), new ProviderSpeed("flex")], null)]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1", null, "flex"));
    await render();
    await ready();

    await choose();

    expect(rowsOf("speeds").filter(t => t.getAttribute("aria-checked") === "true").map(labelOf)).toEqual([Resources.formatEffort("flex")]);
    const reply = new Message("r9", "c1", 9, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance("a1",
      new RequestedSettings("codex", "gpt-5", null, "flex"), new ObservedSettings("codex", "gpt-5", null, null, false, "turbo", "tier_not_served"), "s1", false),
      SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
    await reopen();
    expect(document.querySelector(".nol-teamrun-speed-note .nol-menu-item-label")?.textContent?.trim())
      .toBe(Resources.formatSpeedUnavailable("tier_not_served", Resources.formatEffort("turbo")));
  });

  it("names the named teammate's speed by its id when its model no longer lists it", async () => {
    const data = new TeammateFixture(context);
    data.teammates = [new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", "turbo")];
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("priority", "Fast")], null)]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    await choose();

    expect(rowsOf("speeds").filter(t => t.getAttribute("aria-checked") === "true").map(labelOf)).toEqual([Resources.formatUnlisted(Resources.formatEffort("turbo"))]);
  });

  it("sets the named teammate's speed for this chat from its Speed column without changing the default responder's speed or the teammate", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], "standard")]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();

    await choose("Fast");

    await Wait.until(() => expect(chatSettings()).toEqual([{ chatId: "c1", teammateId: "alice", settings: { model: "gpt-5", effort: "high", speed: "fast" } }]));
    expect([choice()?.speed, context.count(MethodName.TeammateUpdate)]).toEqual([null, 0]);
  });

  it("keeps the named teammate's chosen mode in the chat when its speed changes there", async () => {
    const data = new TeammateFixture(context);
    data.members = [new ConversationMember("c1", "alice", "t", null, false).withMode("plan")];
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true, null, {}, [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], "standard")]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();

    await choose("Fast");

    await Wait.until(() => expect(data.members[0]?.settings?.speed).toBe("fast"));
    expect([data.members[0]?.mode, context.count(MethodName.TeammateUpdate)]).toEqual(["plan", 0]);
  });

  it("opens the provider's permission modes from the permission button, under the provider's name, by their names and descriptions, with the default tagged and checked", async () => {
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    await ready();

    expect([modeLabel(), access().querySelector(".nol-teamrun-composer-glyph")?.textContent?.trim(), access().getAttribute("aria-label"), access().disabled])
      .toEqual(["Default", Resources.permissionsGlyph, Resources.formatChatPermissions("Default"), false]);
    await click(access());
    const menu = document.querySelector("nol-menu")!;
    expect([menu.getAttribute("aria-label"), menu.querySelector(".nol-menu-label")?.textContent?.trim()]).toEqual([Resources.chatPermissionsLabel, Resources.formatChatPermissionsOf("Codex")]);
    expect(modeRows()).toEqual([["Default", modes[0]!.description, Resources.defaultModeTag, "", "true"], ["Read Only", modes[1]!.description, "", "", "false"],
      ["Full Access", modes[2]!.description, "", Resources.unrestrictedModeGlyph, "false"], [Resources.toolsFollowMode, "", "", "", "null"]]);
    expect(item(Resources.toolsFollowMode).getAttribute("aria-disabled")).toBe("true");
    await click(access());

    await choose();
    expect(labels()).not.toContain(Resources.permissionsLabel);
    expect(labels()).not.toContain(Resources.chatPermissionsLabel);
  });

  describe("with /logout", () => {
    const signingOut = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, true);
    const failure = (): string | undefined => root().querySelector(".nol-teamrun-composer-sign-out-failure")?.textContent?.trim();
    const inTerminal = new ProviderKind("codex", "Codex", true, false, null, new ProviderProfile("CODEX_HOME", null, "D:\\profiles\\codex", "codex"),
      false, "/logout");
    const start = async (configure: () => void = () => undefined, settings: ComposerSettings = new ComposerSettings("codex", "gpt-5", null, "a1")): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [signingOut.toJson(), SampleData.claude.toJson()])
        .answer(MethodName.ProviderSignOut, () => SampleData.provider.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null).toJson())
        .answer(MethodName.MessageSend, answered);
      configure();
      await prepare();
      remember(settings);
      await render();
    };
    const byCommand = new ProviderKind("codex", "Codex", true, false, null, new ProviderProfile("CODEX_HOME", null, "D:\\profiles\\codex"),
      false, "codex logout", true);
    const startInTerminal = async (terminals: FakeTerminalLauncher, checked: AuthStatus, kind: ProviderKind = inTerminal): Promise<ChatStoreService> => {
      context.answer(MethodName.ProviderKindList, () => [kind.toJson(), SampleData.claude.toJson()])
        .answer(MethodName.ProviderCheck, () => SampleData.provider.withCheck(checked, null, "1.0", SampleData.timestamp, null).toJson())
        .answer(MethodName.MessageSend, answered);
      const store = await prepare(terminals);
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      return store;
    };
    const confirmLogout = async (): Promise<void> => {
      await type("/logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));
      await answerConfirm(".nol-teamrun-confirm");
    };

    it("asks to sign the chat's provider out for /logout alone, as the Providers page does, sends nothing, signs it out once confirmed and says so",
      async () => {
        await start();

        await type(" /Logout ");
        await send();
        await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));

        expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatSignOut("Work", "Codex"));
        expect(context.count(MethodName.ProviderSignOut)).toBe(0);
        await answerConfirm(".nol-teamrun-confirm");
        await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Work")));
        expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignOut)).providerId).toBe("a1");
        expect([sent(), box().value, failure()]).toEqual([[], "", undefined]);
      });

    it("keeps /logout in the box and signs nothing out when the person cancels", async () => {
      await start();

      await type("/logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));
      await answerConfirm(".nol-teamrun-cancel");

      expect([context.count(MethodName.ProviderSignOut), sent(), box().value, note(), failure()]).toEqual([0, [], "/logout", undefined, undefined]);
    });

    it("shows in the chat why a confirmed sign-out failed", async () => {
      await start(() => context.fail(MethodName.ProviderSignOut, "\"Work\" is still signed in after signing out: its tool keeps another sign-in."));

      await type("/logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));
      await answerConfirm(".nol-teamrun-confirm");

      await Wait.until(() => expect(failure()).toBe("\"Work\" is still signed in after signing out: its tool keeps another sign-in."));
      expect([note(), sent()]).toEqual([undefined, []]);
    });

    it("sends /logout with other text as a message, asking nothing", async () => {
      await start();

      await type("/logout now");
      await send();

      await Wait.until(() => expect(sent().map(t => t.text)).toEqual(["/logout now"]));
      expect([confirmTitle(), context.count(MethodName.ProviderSignOut)]).toEqual([undefined, 0]);
    });

    it("sends /logout with an attachment as a message, asking nothing", async () => {
      await start();

      await type("/logout");
      await pick([new File(["hello"], "notes.txt", { type: "text/plain" })]);
      await send();

      await Wait.until(() => expect(sent().map(t => [t.text, t.attachments.length])).toEqual([["/logout", 1]]));
      expect([confirmTitle(), context.count(MethodName.ProviderSignOut)]).toEqual([undefined, 0]);
    });

    it("signs out the provider of the teammate who answers the chat, not the chat's own", async () => {
      const studio = new Provider("a2", "codex", "Studio", "D:\\profiles\\studio", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp);
      new TeammateFixture(context).teammates = [new Teammate("alice", "Alice", null, "a2", Harness.Provider, null, null, "t", "t")];
      await start(() => context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), studio.toJson()]),
        new ComposerSettings("codex", "gpt-5", null, "a1", "alice"));

      await type("/logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));

      expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatSignOut("Studio", "Codex"));
      await answerConfirm(".nol-teamrun-confirm");
      await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Studio")));
      expect([ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignOut)).providerId, sent()]).toEqual(["a2", []]);
    });

    it("signs out the provider of the teammate a /logout names, as a bare /logout in that teammate's chat does, and sends nothing", async () => {
      const studio = new Provider("a2", "codex", "Studio", "D:\\profiles\\studio", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp);
      new TeammateFixture(context).teammates = [new Teammate("alice", "Alice", null, "a2", Harness.Provider, null, null, "t", "t")];
      await start(() => context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), studio.toJson()]));

      await type("@Alice /logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));

      expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatSignOut("Studio", "Codex"));
      await answerConfirm(".nol-teamrun-confirm");
      await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Studio")));
      expect([ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignOut)).providerId, sent(), box().value]).toEqual(["a2", [], ""]);
    });

    it("sends a /logout that names a teammate with other text as a message, asking nothing", async () => {
      new TeammateFixture(context).teammates = [new Teammate("alice", "Alice", null, "a1", Harness.Provider, null, null, "t", "t")];
      await start();

      await type("@Alice /logout now");
      await send();

      await Wait.until(() => expect(sent().map(t => [t.text, t.mentionedTeammateIds])).toEqual([["@Alice /logout now", ["alice"]]]));
      expect([confirmTitle(), context.count(MethodName.ProviderSignOut)]).toEqual([undefined, 0]);
    });

    it("signs out a provider whose tool signs out only in its own session through the Providers page's terminal, and says so once the tool ends signed out",
      async () => {
        const terminals = new FakeTerminalLauncher();
        await startInTerminal(terminals, AuthStatus.LoggedOut);

        await type("/logout");
        await send();
        await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));
        expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim())
          .toBe(Resources.formatSignOutInTool("Work", "Codex", "/logout", "D:\\profiles\\codex"));
        await answerConfirm(".nol-teamrun-confirm");
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        await fixture.whenStable();

        expect(note()).toBeUndefined();
        terminals.endCommand(0, 0);
        await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Work")));
        expect([context.count(MethodName.ProviderSignOut), terminals.closes, sent(), box().value, failure()]).toEqual([0, [0], [], "", undefined]);
      });

    it("signs out a provider whose kind signs out with its own command once the command ends without an error, whatever the check then finds", async () => {
      const terminals = new FakeTerminalLauncher();
      await startInTerminal(terminals, AuthStatus.LoggedIn, byCommand);

      await type("/logout");
      await send();
      await Wait.until(() => expect(confirmTitle()).toBe(Resources.signOutLabel));
      expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim())
        .toBe(Resources.formatSignOutByCommand("Work", "Codex", "codex logout", "D:\\profiles\\codex"));
      await answerConfirm(".nol-teamrun-confirm");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 0);

      await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Work")));
      expect([terminals.launches[0]?.request.command, terminals.launches[0]?.request.notice, terminals.closes, failure()])
        .toEqual(["codex logout", Resources.terminalSignOutCommandNotice, [0], undefined]);
    });

    it("says TeamRun couldn't tell whether a sign-out with its own command finished when its terminal closes without the command's exit code", async () => {
      const terminals = new FakeTerminalLauncher();
      await startInTerminal(terminals, AuthStatus.LoggedIn, byCommand);

      await confirmLogout();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0);

      await Wait.until(() => expect(note()).toBe(Resources.formatSignOutUnknown("Work")));
      expect([terminals.closes, failure(), sent()]).toEqual([[], undefined, []]);
    });

    it("says the provider is still signed in when its terminal sign-out is stopped", async () => {
      const terminals = new FakeTerminalLauncher();
      const store = await startInTerminal(terminals, AuthStatus.LoggedIn);

      await confirmLogout();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await store.stopTerminalSignOut("a1");

      await Wait.until(() => expect(note()).toBe(Resources.formatStillSignedIn("Work")));
      expect([terminals.closes, failure(), sent()]).toEqual([[0], undefined, []]);
    });

    it("follows a terminal sign-out already running for the provider, rather than saying at once that it's still signed in", async () => {
      const terminals = new FakeTerminalLauncher();
      const store = await startInTerminal(terminals, AuthStatus.LoggedOut);
      const running = store.signOutInTerminal("a1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      await confirmLogout();
      await fixture.whenStable();

      expect(note()).toBeUndefined();
      terminals.endCommand(0, 0);
      await running;
      await Wait.until(() => expect(note()).toBe(Resources.formatSignedOut("Work")));
      expect(terminals.launches).toHaveLength(1);
    });

    it("says nothing was signed out, and sends nothing, when the chat's provider can't sign out from TeamRun", async () => {
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]).answer(MethodName.MessageSend, answered);
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();

      await type("/logout");
      await send();

      await Wait.until(() => expect(failure()).toBe(Resources.logoutUnavailable));
      expect([confirmTitle(), sent(), box().value]).toEqual([undefined, [], "/logout"]);
    });
  });

  it("disables the permission button and names no mode for a provider that lists no modes", async () => {
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    await ready();

    expect([access().disabled, modeLabel(), access().getAttribute("aria-label")]).toEqual([true, Resources.permissionsLabel, Resources.formatChatPermissions(Resources.permissionsLabel)]);
  });

  it("offers Plan first as a checkbox under the modes of a provider that names a plan mode, turns it on and off for the chat, and names it on the permission button", async () => {
    withPlanMode();
    answerPlanFirst();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    await ready();
    await click(access());

    expect([planFirstRow()?.getAttribute("role"), planFirstRow()?.getAttribute("aria-checked"), planFirstRow()?.querySelector(".nol-menu-item-label")?.textContent?.trim(),
      planFirstRow()?.querySelector(".nol-menu-item-description")?.textContent?.trim()]).toEqual(["menuitemcheckbox", "false", Resources.planFirstLabel, Resources.planFirstDescription]);
    await click(shownPlanFirstRow());
    await Wait.until(() => expect(modeLabel()).toBe(Resources.planFirstLabel));
    expect([plansFirst(), access().querySelector(".nol-teamrun-composer-glyph")?.textContent?.trim(), access().getAttribute("aria-label"), choice()?.mode ?? null])
      .toEqual([[["c1", true]], Resources.planFirstGlyph, Resources.formatChatPermissions(Resources.planFirstLabel), null]);
    await ready();
    await click(access());
    expect(planFirstRow()?.getAttribute("aria-checked")).toBe("true");
    await click(shownPlanFirstRow());
    await Wait.until(() => expect(modeLabel()).toBe("Default"));
    expect([plansFirst(), access().querySelector(".nol-teamrun-composer-glyph")?.textContent?.trim()]).toEqual([[["c1", true], ["c1", false]], Resources.permissionsGlyph]);
  });

  it.each([
    { kind: "names no plan mode", settings: new ComposerSettings("codex", "gpt-5", null, "a1"), planMode: null, mode: "Default" },
    { kind: "runs in a read-only mode", settings: new ComposerSettings("codex", "gpt-5", null, "a1", null, null, "plan"), planMode: "plan", mode: "Plan" }
  ])("offers no Plan first and names the chat's mode while its provider $kind, even with the chat's Plan first on", async ({ settings, planMode, mode }) => {
    withPlanMode(planMode);
    listPlanFirst(() => true);
    await prepare();
    remember(settings);
    await render();
    await ready();
    await click(access());

    expect([planFirstRow(), modeLabel(), access().querySelector(".nol-teamrun-composer-glyph")?.textContent?.trim()]).toEqual([null, mode, Resources.permissionsGlyph]);
  });

  describe("with a provider whose cells say it can't", () => {
    const start = async (settings: ComposerSettings = new ComposerSettings("codex", "gpt-5", null, "a1")): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [refusing.toJson(), SampleData.claude.toJson()]);
      withPlanMode();
      answerPlanFirst();
      await prepare();
      remember(settings);
      await render();
      await ready();
    };
    const reach = async (row: () => HTMLElement): Promise<void> => {
      await Wait.until(() => expect(document.querySelector("nol-menu")?.contains(document.activeElement)).toBe(true));
      for (let step = 0; step < 12 && document.activeElement !== row(); step++)
        await userEvent.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(row());
    };
    const closeMenu = async (): Promise<void> => {
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(tooltip()).toBeNull());
      expect(document.querySelector("nol-menu")).not.toBeNull();
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector("nol-menu")).toBeNull());
    };

    it("says why in the Effort and Speed columns with a row each that chooses nothing", async () => {
      await start();
      await choose();
      const [effort, speed] = [rowsOf("efforts"), rowsOf("speeds")];

      expect([effort.map(labelOf), speed.map(labelOf), effort[0]?.getAttribute("aria-disabled"), speed[0]?.getAttribute("aria-disabled")])
        .toEqual([["Codex can't change effort: its models each have one fixed setting."], ["Codex can't change speed: TeamRun doesn't support this for it yet."], "true", "true"]);
      await click(required(effort[0]));
      expect([document.querySelectorAll("nol-menu").length, choice()?.effort]).toEqual([1, null]);
      await close();
    });

    it("reaches why Effort can't change from the keyboard in the picker", async () => {
      await start();
      picker().focus();
      await userEvent.keyboard("{Enter}");
      await reach(() => required(rowsOf("efforts")[0]));

      expect(labelOf(document.activeElement as HTMLElement)).toBe("Codex can't change effort: its models each have one fixed setting.");
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector("nol-menu")).toBeNull());
    });

    it("shows Plan first disabled and unchecked under the modes, says why on hover, and turns nothing on", async () => {
      await start();
      await click(access());
      const row = shownPlanFirstRow();

      expect([row.getAttribute("aria-disabled"), row.getAttribute("aria-checked")]).toEqual(["true", "false"]);
      await userEvent.hover(row);
      await Wait.until(() => expect(tooltip()?.textContent?.trim()).toBe("Codex can't plan first: it has no plan mode."));
      await click(row);
      expect([plansFirst(), modeLabel()]).toEqual([[], "Default"]);
      await userEvent.unhover(row);
    });

    it("says why Plan first is disabled when the keyboard reaches it in the permissions menu", async () => {
      await start();
      access().focus();
      await userEvent.keyboard("{Enter}");
      await reach(shownPlanFirstRow);

      await Wait.until(() => expect(tooltip()?.textContent?.trim()).toBe("Codex can't plan first: it has no plan mode."));
      await closeMenu();
    });

    it("leaves out Plan first in a read-only mode, as for a provider that can plan", async () => {
      await start(new ComposerSettings("codex", "gpt-5", null, "a1", null, null, "plan"));
      await click(access());

      expect([planFirstRow(), modeLabel()]).toEqual([null, "Plan"]);
    });
  });

  describe("with a provider whose rows refuse a read-only and an unrestricted mode", () => {
    const refusingModes = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.ReadOnlyMode]: AbilityCell.cannot("its guide lists read-only mode as missing"),
        [ProviderAbility.UnrestrictedMode]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }));
    const refusedRows = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(".nol-teamrun-refused-mode")];
    const start = async (open: () => Promise<void> = () => click(access())): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [refusingModes.toJson(), SampleData.claude.toJson()]);
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", null, true, null, true)], true, false, null, false,
        modes.slice(0, 1), "auto"));
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
      await open();
      await Wait.until(() => expect(refusedRows()).toHaveLength(2));
    };

    it("lists each refused mode disabled after the modes, the unrestricted one with its mark, and chooses nothing", async () => {
      await start();

      expect(modeRows().slice(0, 3)).toEqual([["Default", "Edits files in the workspace, and asks before anything else.", Resources.defaultModeTag, "", "true"],
        ["Read-only", "", "", "", "null"], ["Unrestricted", "", "", Resources.unrestrictedModeGlyph, "null"]]);
      expect(refusedRows().map(t => t.getAttribute("aria-disabled"))).toEqual(["true", "true"]);
      await click(required(refusedRows()[1]));
      expect(modeLabel()).toBe("Default");
    });

    it("reaches a refused mode by the arrow keys, says its reason as its tooltip and description, and keeps Default on Enter", async () => {
      await start(async () => {
        access().focus();
        await userEvent.keyboard("{Enter}");
      });
      const row = required(refusedRows()[0]);
      const described = (): string => (row.getAttribute("aria-describedby") ?? "").split(" ").filter(t => t.length > 0)
        .map(t => document.getElementById(t)?.textContent?.trim() ?? "").join(" ");
      const reason = "Codex can't use a read-only mode: its guide lists read-only mode as missing.";
      await Wait.until(() => expect(document.querySelector("nol-menu")?.contains(document.activeElement)).toBe(true));
      for (let step = 0; step < 12 && document.activeElement !== row; step++)
        await userEvent.keyboard("{ArrowDown}");

      expect([document.activeElement === row, row.getAttribute("aria-disabled")]).toEqual([true, "true"]);
      await Wait.until(() => expect(tooltip()?.textContent?.trim()).toBe(reason));
      expect(described()).toBe(reason);
      await userEvent.keyboard("{Enter}");

      expect([modeLabel(), document.activeElement === row]).toEqual(["Default", true]);
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(tooltip()).toBeNull());
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector("nol-menu")).toBeNull());
      expect(modeLabel()).toBe("Default");
    });

    it("says each refused mode's row reason on hover", async () => {
      await start();

      for (const [index, reason] of ["Codex can't use a read-only mode: its guide lists read-only mode as missing.",
        "Codex can't use an unrestricted mode: TeamRun doesn't support this for it yet."].entries()) {
        const row = required(refusedRows()[index]);
        await userEvent.hover(row);
        await Wait.until(() => expect(tooltip()?.textContent?.trim()).toBe(reason));
        await userEvent.unhover(row);
        await Wait.until(() => expect(tooltip()).toBeNull());
      }
    });

    it("gives a refused mode the offered mode's start, end and name start, and the plain row's height and name top, in rem", async () => {
      await start();
      const rem = (pixels: number): number => pixels / AppearanceFixture.toPixels(1);
      const offered = required(document.querySelector<HTMLElement>(".nol-teamrun-composer-permissions button[nol-menu-item]"));
      const plain = item(Resources.toolsFollowMode);
      const label = (row: HTMLElement): DOMRect => required(row.querySelector(".nol-menu-item-label")).getBoundingClientRect();
      const [offeredBox, offeredLabel, plainBox, plainLabel] = [offered.getBoundingClientRect(), label(offered), plain.getBoundingClientRect(), label(plain)];

      expect(rem(plainBox.height)).toBeGreaterThan(0);
      expect(refusedRows().map(t => {
        const [box, name] = [t.getBoundingClientRect(), label(t)];
        return [rem(box.left - offeredBox.left), rem(box.right - offeredBox.right), rem(name.left - offeredLabel.left), rem(box.height - plainBox.height),
          rem(name.top - box.top - (plainLabel.top - plainBox.top))].map(u => Math.round(u * 1000) / 1000 + 0);
      })).toEqual([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
    });
  });

  it("names the chat's mode again once its Plan first turns off elsewhere, as an approved plan turns it off", async () => {
    let planFirst = true;
    withPlanMode();
    listPlanFirst(() => planFirst);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    await ready();
    await Wait.until(() => expect(modeLabel()).toBe(Resources.planFirstLabel));

    planFirst = false;
    context.emit(EventName.StateInvalidated, null);

    await Wait.until(() => expect(modeLabel()).toBe("Default"));
    expect(plansFirst()).toEqual([]);
  });

  it("names the chat's mode once the responder's own plan is approved while Plan first stays on, and turning it on again plans first again", async () => {
    let chat = SampleData.conversation.withPlanFirst(true);
    withPlanMode();
    answerPlanFirst();
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [chat.toJson()] : []);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();
    await ready();
    await Wait.until(() => expect(modeLabel()).toBe(Resources.planFirstLabel));

    chat = chat.withPlanApproved(null);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(modeLabel()).toBe("Default"));
    await click(access());
    expect([chat.planFirst, planFirstRow()?.getAttribute("aria-checked")]).toEqual([true, "false"]);
    await click(shownPlanFirstRow());

    await Wait.until(() => expect(modeLabel()).toBe(Resources.planFirstLabel));
    expect(plansFirst()).toEqual([["c1", true]]);
  });

  it("sends the chat's chosen restricted mode with its turn without asking, keeps it as the chat's responder, and no mode once the default is chosen again", async () => {
    withModes();
    context.answer(MethodName.MessageSend, answered);
    const store = await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();

    await chooseMode("Read Only");
    await ready();

    expect([confirmTitle(), choice()?.mode, risky()]).toEqual([undefined, "read-only", null]);
    await Wait.until(() => expect(store.conversation("c1")?.responder?.requested?.mode).toBe("read-only"));
    await type("hello");
    root().querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.requested?.mode).toBe("read-only");
    await chooseMode("Default");
    await ready();
    expect(choice()?.mode).toBeNull();
    await Wait.until(() => expect(store.conversation("c1")?.responder?.requested?.mode).toBeNull());
  });

  describe("when a new chat opens after another chat chose Plan", () => {
    const listTwoChats = (): void => {
      context.answer(MethodName.ConversationList, () =>
        [SampleData.conversation.toJson(), new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp).toJson()]);
    };
    const moveTo = async (conversationId: string): Promise<void> => {
      fixture.componentRef.setInput("conversationId", conversationId);
      await fixture.whenStable();
      await ready();
    };

    it("starts it in the default mode when its composer moves to it, keeping the other chat's model, effort and provider", async () => {
      withPlanMode();
      listTwoChats();
      const store = await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
      await render();
      await chooseMode("Plan");
      await Wait.until(() => expect(store.conversation("c1")?.responder?.requested?.mode).toBe("plan"));

      await moveTo("c2");

      expect(modeLabel()).toBe("Default");
      await Wait.until(() => expect(store.conversation("c2")?.responder?.toJson()).toEqual(new ConversationResponder(null, new RequestedSettings("codex", "gpt-5", "high"), "a1").toJson()));
      expect([choice("c2")?.mode ?? null, store.conversation("c1")?.responder?.requested?.mode]).toEqual([null, "plan"]);
      await moveTo("c1");
      expect(modeLabel()).toBe("Plan");
    });

    it("starts it in the default mode when a composer opens on it after a turn sent in Plan", async () => {
      withPlanMode();
      listTwoChats();
      context.answer(MethodName.MessageSend, answered);
      const store = await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
      await render();
      await chooseMode("Plan");
      await type("hello");
      await send();
      await Wait.until(() => expect(sent()).toHaveLength(1));
      expect(sent()[0]?.requested?.mode).toBe("plan");
      await Wait.until(() => expect(ComposerDefaultService.of(context).defaultChoice()?.mode).toBe("plan"));

      fixture.destroy();
      await render("c2");
      await ready();

      expect(modeLabel()).toBe("Default");
      await Wait.until(() => expect(store.conversation("c2")?.responder?.toJson()).toEqual(new ConversationResponder(null, new RequestedSettings("codex", "gpt-5", "high"), "a1").toJson()));
    });
  });

  it.each([
    { answer: "Close", button: ".nol-teamrun-cancel", kept: null },
    { answer: "Use Full Access", button: ".nol-teamrun-confirm", kept: "full-access" }
  ])("asks before the chat takes an unrestricted mode, and $answer keeps $kept", async ({ button, kept }) => {
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
    await render();

    await chooseMode("Full Access");

    expect(confirmTitle()).toBe(Resources.formatUnrestrictedModeTitle("Full Access"));
    expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatUnrestrictedModeText("Codex", modes[2]!.description));
    expect(choice()?.mode ?? null).toBeNull();
    await answerConfirm(button);

    expect([confirmTitle(), choice()?.mode ?? null, Object.isNull(risky())]).toEqual([undefined, kept, Object.isNull(kept)]);
  });

  it("marks the permission button while the chat runs in an unrestricted mode, names the mode in the picker's accessible name, and asks nothing when it is chosen again", async () => {
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", null, "a1", null, null, "full-access"));
    await render();
    await ready();

    expect([...picker().querySelectorAll<HTMLElement>(".material-symbols-rounded:not(.nol-teamrun-composer-glyph)")].map(t => getComputedStyle(t).display)).toEqual(["none"]);
    expect([risky()?.textContent?.trim(), modeLabel(), access().getAttribute("aria-label")]).toEqual([Resources.unrestrictedModeGlyph, "Full Access", Resources.formatChatPermissions("Full Access")]);
    expect(summary()?.endsWith(`${Resources.titleSeparator}Full Access`)).toBe(true);
    await chooseMode("Full Access");
    expect([confirmTitle(), choice()?.mode]).toEqual([undefined, "full-access"]);
    await chooseMode("Default");
    await fixture.whenStable();
    expect([risky(), access().querySelector(".nol-teamrun-composer-glyph")?.textContent?.trim(), summary()?.includes("Full Access")])
      .toEqual([null, Resources.permissionsGlyph, false]);
  });

  it("sets the named teammate's mode for this chat only after asking for an unrestricted one, marks the permission button while it runs in it, and follows its default again", async () => {
    const data = new TeammateFixture(context);
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();

    await chooseMode("Full Access");
    expect(confirmTitle()).toBe(Resources.formatUnrestrictedModeTitle("Full Access"));
    await answerConfirm(".nol-teamrun-confirm");

    await Wait.until(() => expect(risky()).not.toBeNull());
    expect([memberModes(), context.count(MethodName.TeammateUpdate), data.teammates.find(t => t.id === "alice")?.mode, modeLabel(), risky()?.textContent?.trim(), choice()?.mode])
      .toEqual([[["c1", "alice", "full-access"]], 0, null, "Full Access", Resources.unrestrictedModeGlyph, null]);
    await chooseMode("Default");
    await Wait.until(() => expect(risky()).toBeNull());
    expect([memberModes().at(-1), modeLabel(), risky()]).toEqual([["c1", "alice", null], "Default", null]);
  });

  it("starts a chat at the named teammate's own default, tags it with the teammate's name, and links to change that default", async () => {
    const data = new TeammateFixture(context);
    data.teammates = data.teammates.map(t => t.id === data.alice.id
      ? new Teammate(t.id, t.name, t.role, t.providerId, t.harness, t.model, t.effort, t.createdAt, t.updatedAt, null, "read-only")
      : t);
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    expect(modeLabel()).toBe("Read Only");
    await click(access());
    expect(modeRows()).toEqual([["Default", modes[0]!.description, "", "", "false"], ["Read Only", modes[1]!.description, Resources.formatOwnDefaultMode("Alice"), "", "true"],
      ["Full Access", modes[2]!.description, "", Resources.unrestrictedModeGlyph, "false"], [Resources.formatChangeDefaultMode("Alice"), Resources.toolsFollowMode, "", "", "null"]]);
    await click(item(Resources.formatChangeDefaultMode("Alice")));

    await Wait.until(() => expect(document.querySelector<HTMLInputElement>("input.nol-teamrun-teammate-name")?.value).toBe("Alice"));
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")!.click();
    await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
    expect(memberModes()).toEqual([]);
  });

  it("shows and sets the current responder's mode, each teammate keeping its own for the chat, and its own default for a mode its provider no longer lists", async () => {
    const data = new TeammateFixture(context);
    data.members = [new ConversationMember("c1", "alice", "t", null, false, "full-access"), new ConversationMember("c1", "bob", "t", null, false, "gone")];
    context.answer(MethodName.MessageSend, answered);
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    expect([modeLabel(), Object.isNull(risky())]).toEqual(["Full Access", false]);
    await answerAs("Bob");
    expect([modeLabel(), Object.isNull(risky())]).toEqual(["Default", true]);
    await chooseMode("Read Only");
    await Wait.until(() => expect(modeLabel()).toBe("Read Only"));
    await answerAs("Alice");

    expect([modeLabel(), memberModes()]).toEqual(["Full Access", [["c1", "bob", "read-only"]]]);
  });

  it("names the named teammate's mode as not in the catalog when its provider no longer lists it", async () => {
    const data = new TeammateFixture(context);
    data.teammates = data.teammates.map(t => t.id === data.alice.id
      ? new Teammate(t.id, t.name, t.role, t.providerId, t.harness, t.model, t.effort, t.createdAt, t.updatedAt, null, "gone")
      : t);
    withModes();
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    expect(modeLabel()).toBe(Resources.formatUnlisted("gone"));
    await click(access());

    const first = [...document.querySelector("nol-menu")!.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")][0]!;
    expect([first.querySelector(".nol-menu-item-label")?.textContent?.trim(), first.getAttribute("aria-checked"), first.getAttribute("aria-disabled")])
      .toEqual([Resources.formatUnlisted("gone"), "true", "true"]);
    expect(risky()).toBeNull();
  });

  it("says why the named teammate's model or effort could not change in the chat, and keeps what it had", async () => {
    new TeammateFixture(context);
    context.fail(MethodName.ConversationSetMemberSettings, "Chat refused");
    const store = await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();

    await choose("gpt-5-mini");
    await Wait.until(() => expect(context.noticeText()).toBe("Chat refused"));
    await choose("Medium");

    await Wait.until(() => expect(context.count(MethodName.ConversationSetMemberSettings)).toBe(2));
    expect([store.teammate("alice")?.model, store.teammate("alice")?.effort, store.membersOf("c1").find(t => t.teammateId === "alice")?.settings]).toEqual(["gpt-5", "high", null]);
    expect([choice()?.model, context.count(MethodName.TeammateUpdate)]).toEqual(["gpt-5", 0]);
    expect(summary()).toContain("Alice · gpt-5 · High");
  });

  it("completes members first without sending, resolves mentions and continues with the mentioned teammate", async () => {
    const data = new TeammateFixture(context);
    context.answer(MethodName.MessageSend, () => {
      data.members.push(new ConversationMember("c1", "bob", "t", null, false));
      return answered();
    });
    await prepare();
    remember(new ComposerSettings("codex", null, null, null, "alice"));
    await render();
    expect(summary()).toContain("Alice");

    await type("@");
    await Wait.until(() => expect(names()).toEqual(["Alice", "Bob", "Offline"]));
    expect([...document.querySelectorAll(".nol-mention-section")].map(t => t.textContent!.trim())).toEqual(["Chat members", "Other teammates"]);
    expect(document.querySelector(".nol-mention-option-unavailable")?.textContent).toContain("Offline");
    await key("ArrowDown");
    await key("Enter");

    expect(box().value).toBe("@Bob ");
    expect(sent()).toEqual([]);
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.mentionedTeammateIds).toEqual(["bob"]);
    expect(sent()[0]?.responderTeammateId).toBe("alice");
    expect(sent()[0]?.requested).toBeNull();
    await Wait.until(() => expect(box().value).toBe(""));
    expect(choice()?.responderTeammateId).toBe("bob");

    fixture.destroy();
    await render();
    expect(summary()).toContain("Bob");
  });

  it("resolves a written name with spaces to its teammate, shows its initials, and offers it in completion", async () => {
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer, new Teammate("code", "Code", null, "a1", Harness.Provider, null, null, "t", "t"));
    data.members.push(new ConversationMember("c1", "reviewer", "t", null, false));
    context.answer(MethodName.MessageSend, answered);
    await prepare();
    remember(new ComposerSettings("codex", null, null, null, "reviewer"));
    await render();
    expect(summary()).toContain("Code Reviewer");
    expect(buttonLabel()?.startsWith("@Code Reviewer")).toBe(true);

    await type("@");
    await Wait.until(() => expect(names()).toContain("Code"));
    expect(names()).toContain("Code Reviewer");
    await key("Escape");
    await type("@code   reviewer, then @Code Reviewers");
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.mentionedTeammateIds).toEqual(["reviewer", "code"]);
    expect(sent()[0]?.responderTeammateId).toBe("reviewer");
  });

  it("completes a name with spaces across the space it's typed with, writing the whole name as one mention", async () => {
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer, new Teammate("code", "Code", null, "a1", Harness.Provider, null, null, "t", "t"));
    context.answer(MethodName.MessageSend, answered);
    await prepare();
    await render();

    await type("Ask @code r");
    await Wait.until(() => expect(names()).toEqual(["Code Reviewer"]));
    await key("Enter");
    await type(`${box().value}please`);
    const chips = [...root().querySelectorAll(".nol-mention-chip")].map(t => t.textContent?.replaceAll("\u200b", "").trim());
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([chips, sent()[0]?.text, sent()[0]?.mentionedTeammateIds]).toEqual([["@Code Reviewer"], "Ask @Code Reviewer please", ["reviewer"]]);
  });

  it("opens the mention list on the card, a field's width wide, its bottom on the field's top at the field's start, with the card low in the window", async () => {
    new TeammateFixture(context);
    await prepare();
    await render();
    root().style.marginTop = "24rem";

    await type("@");
    await Wait.until(() => expect(names()).toContain("Alice"));
    const field = box().getBoundingClientRect();
    const list = document.querySelector("nol-mention-list")!.getBoundingClientRect();

    expect(getComputedStyle(root().querySelector(".nol-teamrun-composer-card")!).position).toBe("relative");
    expect([list.left - field.left, list.width - field.width, list.bottom - field.top].map(t => Math.abs(t) < 0.5)).toEqual([true, true, true]);
  });

  it("clears the field and the text it draws once a message that wraps past two lines with a mention is sent, leaving only the placeholder at the field's first height", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.MessageSend, answered);
    await prepare();
    await render();
    const empty = box().getBoundingClientRect().height;
    const line = Number.parseFloat(getComputedStyle(box()).lineHeight);
    const words = "thank you for looking at the build and the tests, ".repeat(12);
    const copy = root().querySelector<HTMLElement>(".nol-mention-backdrop")!;
    const drawnWidth = (): number => {
      const drawn = document.createRange();
      drawn.selectNodeContents(copy);
      return [...drawn.getClientRects()].reduce((width, t) => width + t.width, 0);
    };
    await type(`${words}@Ali`);
    await Wait.until(() => expect(names()).toContain("Alice"));
    await key("Enter");
    const grown = box().getBoundingClientRect().height;
    const typed = drawnWidth();
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    await Wait.until(() => expect(box().value).toBe(""));

    expect([grown - empty > line * 2, typed > 0]).toEqual([true, true]);
    expect([sent()[0]?.text, copy.textContent?.replaceAll("\u200b", ""), copy.querySelectorAll(".nol-mention-chip").length]).toEqual([`${words}@Alice`, "", 0]);
    expect(drawnWidth()).toBeLessThan(0.5);
    expect(Math.abs(box().getBoundingClientRect().height - empty)).toBeLessThan(0.5);
    expect([box().placeholder, box().matches(":placeholder-shown")]).toEqual([Resources.composerPlaceholder, true]);
  });

  it("keeps its text and mentions while a send runs, with Backspace by a mention and Enter or Tab on the list changing nothing", async () => {
    new TeammateFixture(context);
    const answer = new DeferredResponse();
    context.answer(MethodName.MessageSend, () => answer.promise);
    await prepare();
    await render();
    await type("Thanks @Ali");
    await Wait.until(() => expect(names()).toContain("Alice"));
    await key("Enter");
    const mentioned = box().value.trimEnd();
    await type(`${box().value}and @Bo`);
    await Wait.until(() => expect(names()).toContain("Bob"));
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    await fixture.whenStable();
    const held = box().value;

    expect([box().readOnly, root().querySelectorAll(".nol-mention-chip").length, names().includes("Bob")]).toEqual([true, 1, true]);
    await key("Enter");
    await key("Tab");
    box().setSelectionRange(mentioned.length, mentioned.length);
    await key("Backspace");
    box().setSelectionRange(mentioned.indexOf("@"), mentioned.indexOf("@"));
    await key("Delete");
    expect([box().value, root().querySelectorAll(".nol-mention-chip").length, sent().length]).toEqual([held, 1, 1]);
    answer.resolve(answered());
    await Wait.until(() => expect(box().value).toBe(""));
  });

  it("continues with the last mentioned teammate only after a successful send, and sends to its own conversation while another is selected", async () => {
    const data = new TeammateFixture(context);
    const reply = (): JsonValue => {
      if (!data.members.some(t => t.teammateId === "bob"))
        data.members.push(new ConversationMember("c1", "bob", "t", null, false));
      return answered();
    };
    data.members.push(new ConversationMember("c2", "alice", "t", null, false));
    context.answer(MethodName.MessageSend, reply).answer(MethodName.ConversationList, () =>
      [SampleData.conversation.toJson(), new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp).toJson()]);
    const store = await prepare();
    await render();
    const sendText = async (text: string, count: number): Promise<void> => {
      await type(text);
      await send();
      await Wait.until(() => expect(sent()).toHaveLength(count));
      await fixture.whenStable();
    };

    await sendText("@Alice and @Bob, please review", 1);
    expect(sent()[0]?.mentionedTeammateIds).toEqual(["alice", "bob"]);
    await Wait.until(() => expect(choice()?.responderTeammateId).toBe("bob"));
    expect(summary()).toContain("Bob");

    context.fail(MethodName.MessageSend, "Disconnected");
    await sendText("@Alice, once more", 2);
    await Wait.until(() => expect(context.noticeText()).toBe("Disconnected"));
    expect(choice()?.responderTeammateId).toBe("bob");
    expect(box().value).toBe("@Alice, once more");

    context.answer(MethodName.MessageSend, reply);
    await store.selectConversation("c2");
    await fixture.whenStable();
    expect(choice()?.responderTeammateId).toBe("bob");
    await sendText("@Alice, back to you", 3);
    expect(sent()[2]?.conversationId).toBe("c1");
    expect(sent()[2]?.responderTeammateId).toBe("bob");
    await Wait.until(() => expect(choice()?.responderTeammateId).toBe("alice"));
    expect(choice("c2")).toBeNull();
  });

  it("offers no disabled provider, and answers without a member whose provider is disabled", async () => {
    const off = new Provider("a2", "codex", "Off", "D:/off", AuthStatus.LoggedIn, null, null, null, null, "t", false);
    const data = new TeammateFixture(context);
    data.teammates.push(new Teammate("carol", "Carol", null, "a2", Harness.Provider, null, null, "t", "t"));
    data.members.push(new ConversationMember("c1", "carol", "t", null, false));
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), off.toJson()]);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", null, "carol"));
    await render();

    expect([summary()?.includes("Carol"), buttonLabel()?.startsWith("Codex")]).toEqual([false, true]);
    await chooseProvider();
    expect(labels()).toContain("Work · This computer");
    expect(labels()).not.toContain("Off · This computer");
  });

  it("names the default responder's provider as disabled in the summary, beside the button and on the picker's provider row", async () => {
    const off = new Provider("a2", "codex", "Off", "D:/off", AuthStatus.LoggedIn, null, null, null, null, "t", false);
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), off.toJson()]);
    await prepare();
    remember(new ComposerSettings("codex", null, null, "a2"));
    await render();

    expect(summary()).toContain(Resources.formatDisabledProviderOption("Codex · Off · This computer"));
    await ready();
    expect(providerLine()).toBe(Resources.formatDisabledProviderOption("Off · Codex"));
    await choose();
    expect(providerRowLabel()).toBe(Resources.formatDisabledProviderOption("Off · Codex"));
  });

  it("answers with the default responder while the chosen teammate is unavailable, and keeps the choice", async () => {
    const data = new TeammateFixture(context);
    data.members.push(new ConversationMember("c1", "offline", "t", null, false));
    context.answer(MethodName.MessageSend, answered);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", null, "offline"));
    await render();
    expect([summary()?.includes("Offline"), buttonLabel()?.startsWith("Codex")]).toEqual([false, true]);
    await choose();
    expect(labels()).not.toContain(Resources.answerWithoutTeammateLabel);
    await close();

    await type("Any news?");
    await send();

    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.responderTeammateId).toBeNull();
    expect(sent()[0]?.mentionedTeammateIds).toEqual([]);
    expect(sent()[0]?.requested?.kind).toBe("codex");
    expect(choice()?.responderTeammateId).toBe("offline");
  });

  it("keeps its chat's choice in the runtime, a teammate or the default teammate's settings and provider, as the person picks it, mentions and sends, saying which picks are the person's", async () => {
    const data = new TeammateFixture(context);
    data.members.push(new ConversationMember("c1", "alice", "t", null, false));
    context.answer(MethodName.MessageSend, answered);
    const store = await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();
    const fallback = (model: string, chosen: boolean = false): string =>
      choiceParams(new ConversationResponder(null, new RequestedSettings("codex", model, model === "gpt-5" ? "high" : null), "a1"), "c1", chosen);
    const alice = (chosen: boolean): string => choiceParams(new ConversationResponder("alice"), "c1", chosen);

    await Wait.until(() => expect(keptChoices()).toEqual([fallback("gpt-5")]));
    await choose("gpt-5-mini");
    expect(keptChoices()).toEqual([fallback("gpt-5"), fallback("gpt-5-mini", true)]);
    await type("Any news?");
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(keptChoices()).toHaveLength(2);
    await type("@Alice, have a look");
    await send();
    await Wait.until(() => expect(keptChoices()).toEqual([fallback("gpt-5"), fallback("gpt-5-mini", true), alice(false)]));
    expect(store.conversation("c1")?.responder?.teammateId).toBe("alice");
    await choose(Resources.answerWithoutTeammateLabel);
    await Wait.until(() => expect(keptChoices()).toEqual([fallback("gpt-5"), fallback("gpt-5-mini", true), alice(false), fallback("gpt-5-mini", true)]));
    expect(store.conversation("c1")?.responder?.teammateId ?? null).toBeNull();
  });

  it("keeps a pick made while a send is on its way, which writes nothing back", async () => {
    const reply = new DeferredResponse();
    context.answer(MethodName.MessageSend, () => reply.promise);
    const store = await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    await render();
    const fallback = (model: string, chosen: boolean = false): string =>
      choiceParams(new ConversationResponder(null, new RequestedSettings("codex", model, model === "gpt-5" ? "high" : null), "a1"), "c1", chosen);
    await Wait.until(() => expect(keptChoices()).toEqual([fallback("gpt-5")]));

    await type("Any news?");
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    await choose("gpt-5-mini");
    await close();
    reply.resolve(answered());
    await Wait.until(() => expect(box().value).toBe(""));
    await fixture.whenStable();

    expect(keptChoices()).toEqual([fallback("gpt-5"), fallback("gpt-5-mini", true)]);
    expect(summary()).toContain("gpt-5-mini");
    expect([choice()?.model, store.conversation("c1")?.responder?.requested?.model]).toEqual(["gpt-5-mini", "gpt-5-mini"]);
  });

  it("follows each chat's kept choice when its composer moves from one chat to another and back", async () => {
    new TeammateFixture(context).members.push(new ConversationMember("c2", "alice", "t", null, false));
    context.answer(MethodName.ConversationList, () => [
      SampleData.conversation.withResponder(new ConversationResponder(null, new RequestedSettings("claude", null, null))).toJson(),
      new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp, false, null, new ConversationResponder("alice")).toJson()
    ]);
    await prepare();
    await render();
    await ready();
    const move = async (conversationId: string): Promise<void> => {
      fixture.componentRef.setInput("conversationId", conversationId);
      await fixture.whenStable();
      await ready();
    };

    expect(summary()).toContain("Claude Code");
    expect(reason()).toBe(Resources.formatProviderNeeded("Claude Code"));
    await move("c2");
    expect(summary()).toContain("Alice");
    await move("c1");
    expect(summary()).toContain("Claude Code");
    expect(summary()).not.toContain("Alice");
    expect(context.count(MethodName.ConversationResponderSet)).toBe(0);
  });

  it("keeps an older chat's first choice free of the teammate chosen in the chat its composer moves from", async () => {
    new TeammateFixture(context).members.push(new ConversationMember("c1", "alice", "t", null, false));
    context.answer(MethodName.ConversationList, () => [
      SampleData.conversation.withResponder(new ConversationResponder("alice")).toJson(),
      new Conversation("c3", "p1", "Older", SampleData.timestamp, SampleData.timestamp).toJson()
    ]);
    const store = await prepare();
    await render();
    await ready();
    expect(summary()).toContain("Alice");

    fixture.componentRef.setInput("conversationId", "c3");
    await fixture.whenStable();
    await ready();

    expect(summary()).toContain("Codex");
    expect(summary()).not.toContain("Alice");
    const written = context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationResponderSet))
      .map(t => ConversationResponderParams.fromJson(t.parameters));
    expect(written.length).toBeGreaterThan(0);
    expect(written.map(t => [t.conversationId, t.responder?.teammateId, t.responder?.requested?.kind].join())).toEqual(written.map(() => "c3,,codex"));
    expect([store.conversation("c3")?.responder?.teammateId, store.conversation("c1")?.responder?.teammateId]).toEqual([null, "alice"]);
  });

  it("takes its chat's kept choice when it opens, over the window's own copy, which then follows it", async () => {
    new TeammateFixture(context).members.push(new ConversationMember("c2", "alice", "t", null, false));
    context.answer(MethodName.ConversationList, () => [
      SampleData.conversation.withResponder(new ConversationResponder(null, new RequestedSettings("claude", null, null))).toJson(),
      new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp, false, null, new ConversationResponder("alice")).toJson()
    ]);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
    remember(new ComposerSettings("codex", "gpt-5", "high", "a1"), "c2");
    await render();
    await ready();

    expect(summary()).toContain("Claude Code");
    expect(choice()?.equals(new ComposerSettings("claude", null, null, null))).toBe(true);
    fixture.destroy();
    await render("c2");
    await ready();
    expect(summary()).toContain("Alice");
    expect(choice("c2")?.equals(new ComposerSettings("codex", "gpt-5", "high", "a1", "alice"))).toBe(true);
    expect(context.count(MethodName.ConversationResponderSet)).toBe(0);
  });

  it("keeps the first provider's choice in place of a kept choice whose provider is gone", async () => {
    context.answer(MethodName.ConversationList, () => [
      SampleData.conversation.withResponder(new ConversationResponder(null, new RequestedSettings("gone", "m1", null))).toJson()
    ]);
    const store = await prepare();
    await render();
    await ready();

    expect(summary()).toContain("Codex · Work · This computer");
    const kept = store.conversation("c1")?.responder;
    expect([kept?.teammateId, kept?.requested?.kind, kept?.providerId].join()).toBe(",codex,a1");
    expect(ConversationResponderParams.fromJson(context.parametersOf(MethodName.ConversationResponderSet)!).responder?.requested?.kind).toBe("codex");
  });

  it("refuses images only while no one in the chat takes them, and uses each model's effort levels", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("text", "Text only", "", ["low"], true, null, false),
      new ProviderModel("image", "Image capable", "", ["high"], false, null, true),
      new ProviderModel("gpt-5", "GPT-5", "", ["high"], false, null, false)
    ]));
    await prepare();
    await render();

    await pick([imageFile("image.png")]);
    await Wait.until(() => expect(alert()).toBe(Resources.modelImagesUnsupported));
    await Wait.until(() => expect(previews().map(t => t.alt)).toEqual(["image.png"]));
    expect(sendButton()?.disabled).toBe(true);
    expect(note()).toBeUndefined();
    for (const written of ["@Bob please look", "@Offline please look", "@Alice please look"]) {
      await type(written);
      expect(alert(), written).toBe(Resources.modelImagesUnsupported);
    }
    await type("please look");

    await choose("Image capable");
    expect(alert()).toBeUndefined();
    expect(note()).toBeUndefined();
    await Wait.until(() => expect(sendButton()?.disabled).toBe(false));
    await choose();
    expect(labels()).toContain("High");
    expect(labels()).not.toContain("Low");
    await click(item("High"));
    expect(summary()).toContain("Image capable · High");
    expect(sent()).toEqual([]);
  });

  it("takes an image that a teammate in the chat takes, names each recipient that won't see it, and sends it", async () => {
    const data = new TeammateFixture(context);
    data.teammates.push(new Teammate("carol", "Carol", null, "a1", Harness.Provider, "unlisted", null, "t", "t"),
      new Teammate("dave", "Dave", null, "a1", Harness.Provider, "text", null, "t", "t"));
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("text", "Text only", "", ["low"], true, null, false),
      new ProviderModel("gpt-5", "GPT-5", "", ["high"], false, null, true)
    ]));
    context.answer(MethodName.MessageSend, () => answered());
    await prepare();
    await render();

    await pick([imageFile("image.png"), sized("notes.txt", 4, "text/plain")]);
    await Wait.until(() => expect(note()).toMatch(/^\S.* won't see the attached images: its model doesn't take images\.$/));
    expect(note()).not.toContain("Alice");
    expect(alert()).toBeUndefined();
    await type("@Alice @Bob @Carol please look");
    expect(note()).toBe(Resources.formatImagesNotSeen(["Bob"]));
    await type("@Alice @Offline please look");
    expect(note()).toBeUndefined();
    await type("@Bob @Dave please look");
    expect(note()).toBe("Bob, Dave won't see the attached images: their models don't take images.");
    expect(alert()).toBeUndefined();
    await type("@Alice please look");
    expect(note()).toBeUndefined();

    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.mentionedTeammateIds).toEqual(["alice"]);
    expect(sent()[0]?.attachments.map(t => t.name)).toEqual(["image.png", "notes.txt"]);
  });

  it("prepares files one at a time and keeps the draft when a later preparation fails", async () => {
    const first = new DeferredResponse();
    let uploads = 0;
    let preparing = 0;
    let mostAtOnce = 0;
    context.answer(MethodName.AttachmentPrepare, t => {
      const input = AttachmentInput.fromJson(t);
      if (Object.isNull(input.path))
        return new MessageAttachment(input.name, input.mediaType, 1, `D:/data/attachments/drafts/${input.name}`).toJson();
      uploads++;
      preparing++;
      mostAtOnce = Math.max(mostAtOnce, preparing);
      const answer = uploads === 1 ? first.promise : Promise.reject(new Error("Preparation failed"));
      return answer.finally(() => preparing--);
    });
    await prepare();
    await render();
    await pick(Array.from({ length: 10 }, (_, index) => sized(`${index}.bin`, 100 * 1024 * 1024)));
    expect(rows()).toHaveLength(10);

    await ready();
    root().querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(uploads).toBe(1));
    first.resolve(new MessageAttachment("0.bin", "application/octet-stream", 1, "D:/data/attachments/drafts/first.bin").toJson());

    await Wait.until(() => expect(context.count(MethodName.AttachmentDiscard)).toBe(11));
    await fixture.whenStable();
    expect(uploads).toBe(2);
    expect(mostAtOnce).toBe(1);
    expect(sent()).toEqual([]);
    expect(rows()).toHaveLength(10);
    expect(alert()).toContain("could not be read");
  });

  it("takes files chosen, pasted and dropped, keeps them when sending fails, then sends a message of files alone", async () => {
    context.fail(MethodName.MessageSend, "Disconnected");
    await prepare();
    await render();
    const form = root().querySelector("form")!;
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const transfer = new DataTransfer();
    transfer.items.add(file);

    await pick([file, file]);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    box().dispatchEvent(paste);
    const empty = new Event("paste", { bubbles: true, cancelable: true });
    box().dispatchEvent(empty);
    const over = new DragEvent("dragover", { dataTransfer: transfer, bubbles: true, cancelable: true });
    form.dispatchEvent(over);
    await fixture.whenStable();
    expect(root().querySelector(".nol-teamrun-composer-card")?.classList).toContain("nol-teamrun-composer-dropping");
    form.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
    await fixture.whenStable();
    expect(root().querySelector(".nol-teamrun-composer-card")?.classList).not.toContain("nol-teamrun-composer-dropping");
    const plain = new DragEvent("dragover", { bubbles: true, cancelable: true });
    form.dispatchEvent(plain);
    form.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
    const drop = new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true });
    form.dispatchEvent(drop);
    await fixture.whenStable();

    expect([paste.defaultPrevented, empty.defaultPrevented, over.defaultPrevented, plain.defaultPrevented, drop.defaultPrevented])
      .toEqual([true, false, true, false, true]);
    expect(rows()).toHaveLength(4);
    await click(root().querySelector<HTMLButtonElement>('button[aria-label="Remove attachment: notes.txt"]')!);
    expect(rows()).toHaveLength(3);
    await ready();
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(context.noticeText()).toBe("Disconnected"));
    await fixture.whenStable();
    expect(sent()).toHaveLength(1);
    expect(rows()).toHaveLength(3);
    expect(sent()[0]?.text).toBe("");
    expect(sent()[0]?.attachments.map(t => t.data)).toEqual([null, null, null]);
    expect(sent()[0]?.attachments[0]?.path).toBe("D:/data/attachments/drafts/notes.txt");
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.AttachmentPrepare))
      .map(t => AttachmentInput.fromJson(t.parameters)).map(t => [t.data, t.grant]))
      .toEqual([[null, "grant-1"], [null, "grant-2"], [null, "grant-3"], [null, null], [null, null], [null, null]]);
    expect(context.count(MethodName.AttachmentDiscard)).toBe(6);

    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await Wait.until(() => expect(sent()).toHaveLength(2));
    await Wait.until(() => expect(rows()).toHaveLength(0));
  });

  it("refuses files beyond the limits and keeps what is already attached", async () => {
    await prepare();
    await render();
    await pick([new File(["a"], "notes.txt")]);

    await pick([sized("large.bin", 101 * 1024 * 1024)]);
    expect(alert()).toBe("Attach up to 10 files: 10 MiB per image and 100 MiB per file.");
    await pick([sized("large.png", 11 * 1024 * 1024, "image/png")]);
    expect(alert()).toContain("10 MiB per image");
    await pick(Array.from({ length: 10 }, (_, index) => new File(["a"], `${index}.txt`)));
    expect(alert()).toContain("Attach up to 10 files");

    expect(rows()).toHaveLength(1);
    await pick([new File(["a"], "small.png", { type: "image/png" })]);
    expect(alert()).toBeUndefined();
    expect(rows()).toHaveLength(2);
  });

  it("keeps a picked image the page can't decode as a file row without a preview, and sends it", async () => {
    const failed = vi.spyOn(ComposerAttachment.prototype, "previewFailed");
    context.answer(MethodName.MessageSend, () => answered());
    await prepare();
    await render();

    await pick([new File(["fixture"], "broken.png", { type: "image/png" })]);
    await Wait.until(() => expect(failed).toHaveBeenCalledOnce());
    await fixture.whenStable();
    expect([rows().length, previews().length, alert()]).toEqual([1, 0, undefined]);
    expect(rows()[0]?.textContent).toContain("broken.png");

    await type("look");
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.attachments.map(t => [t.name, t.mediaType])).toEqual([["broken.png", "image/png"]]);
  });

  it("keeps the text when the runtime part refuses the send", async () => {
    context.fail(MethodName.MessageSend, "Disconnected");
    await prepare();
    await render();

    await type("Keep this draft");
    await ready();
    await key("Enter");

    await Wait.until(() => expect(context.noticeText()).toBe("Disconnected"));
    expect(box().value).toBe("Keep this draft");
    expect(ComposerDefaultService.of(context).defaultChoice()).toBeNull();
    expect(context.count(MethodName.ComposerDefaultSave)).toBe(0);
    expect(context.keptDocuments).toEqual([]);
  });

  it("waits for the providers, sends to its conversation on Enter while idle, and stays open for the next message while its reply runs", async () => {
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson())
      .answer(MethodName.ConversationCancel, () => [SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson()]);
    const kinds = new DeferredResponse();
    context.answer(MethodName.ProviderKindList, () => kinds.promise);
    configure();
    await render();
    expect(picker().disabled).toBe(true);
    expect(summary()).toContain("TeamRun");
    await type("  ship it  ");
    expect(sendButton()?.disabled).toBe(true);

    kinds.resolve([SampleData.codex.toJson(), SampleData.claude.toJson()]);
    await Wait.until(() => expect(picker().disabled).toBe(false));
    await ready();
    await key("Enter", { shiftKey: true });
    await key("Enter", { isComposing: true });
    expect(sent()).toEqual([]);
    await key("Enter");

    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.conversationId).toBe("c1");
    expect(sent()[0]?.text).toBe("ship it");
    expect(sent()[0]?.requested?.kind).toBe("codex");
    await Wait.until(() => expect(root().querySelector(".nol-teamrun-composer-stop")).not.toBeNull());
    expect(context.keptDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c1" }]);
    expect(getComputedStyle(root().querySelector(".nol-teamrun-composer-card")!).opacity).toBe("1");
    expect([box().readOnly, box().value]).toEqual([false, ""]);
    expect(sendButton()).toBeNull();
    await pick([new File(["a"], "late.txt")]);
    expect(rows()).toHaveLength(1);
    await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-stop")!);
    await Wait.until(() => expect(sendButton()).not.toBeNull());
    expect(context.count(MethodName.ConversationCancel)).toBe(1);
  });

  it("disables Stop while its cancel runs, and takes a cancel refused because the reply already ended as done", async () => {
    const cancel = new DeferredResponse();
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson())
      .answer(MethodName.ConversationCancel, async () => {
        await cancel.promise;
        throw Object.assign(new Error("The reply is not open."), { code: ErrorCode.Conflict });
      });
    await prepare();
    await render();
    await type("ship it");
    await send();
    const stop = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-stop")!;
    await Wait.until(() => expect(stop()).not.toBeNull());

    await click(stop());
    expect(stop().disabled).toBe(true);
    await click(stop());
    expect(context.count(MethodName.ConversationCancel)).toBe(1);
    cancel.resolve(null);
    await Wait.until(() => expect(stop().disabled).toBe(false));
    expect(context.noticeText()).toBeNull();

    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    await Wait.until(() => expect(stop()).toBeNull());
    expect(context.noticeText()).toBeNull();
  });

  it("says why a cancel failed and offers Stop again", async () => {
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson())
      .fail(MethodName.ConversationCancel, "Disconnected");
    await prepare();
    await render();
    await type("ship it");
    await send();
    const stop = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-stop")!;
    await Wait.until(() => expect(stop()).not.toBeNull());

    await click(stop());

    await Wait.until(() => expect(context.noticeText()).toBe("Disconnected"));
    expect(stop().disabled).toBe(false);
    expect(box().readOnly).toBe(false);
  });

  describe("while its reply runs", () => {
    const present = <T>(value: T | null | undefined): T => {
      if (value === null || value === undefined)
        throw new Error("Not found.");
      return value;
    };
    const deliver = (): HTMLElement | null => root().querySelector<HTMLElement>(".nol-teamrun-composer-deliver");
    const main = (): HTMLButtonElement => present(deliver()?.querySelector<HTMLButtonElement>(".nol-split-button-main"));
    const arrow = (): HTMLButtonElement => present(deliver()?.querySelector<HTMLButtonElement>(".nol-split-button-arrow"));
    const offered = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button.nol-teamrun-deliver")];
    const added = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.WaitingMessageAdd))
      .map(t => WaitingMessageAddParams.fromJson(t.parameters)).map(t => `${t.delivery}:${t.message.chatId}:${t.message.text}`);
    const edited = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.WaitingMessageEdit))
      .map(t => WaitingMessageEditParams.fromJson(t.parameters)).map(t => `${t.id}:${t.message.text}:${t.message.attachments.length}`);
    const editingNote = (): string | undefined => root().querySelector(".nol-teamrun-composer-editing .nol-teamrun-composer-note")?.textContent?.trim();
    const waiting = (id: string, text: string, attachments: readonly AttachmentInput[] = []): WaitingMessage =>
      new WaitingMessage(id, MessageDelivery.Queue, new MessageSendParams("c1", text, SampleData.provenance.requested, "a1", attachments), SampleData.timestamp);
    const listed = (...messages: readonly WaitingMessage[]): Promise<void> => {
      context.emit(EventName.WaitingMessagesChanged, new WaitingMessagesPayload("c1", messages).toJson());
      return fixture.whenStable();
    };
    const write = async (text: string, options: KeyboardEventInit = {}): Promise<void> => {
      await type(text);
      await key("Enter", options);
    };
    const escape = async (): Promise<void> => {
      box().addEventListener("keydown", t => fixture.componentInstance.stopOnEscape(t), { once: true });
      await key("Escape");
    };
    const running = async (): Promise<void> => {
      context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson())
        .answer(MethodName.WaitingMessageAdd, t => {
          const params = WaitingMessageAddParams.fromJson(t);
          return new WaitingMessage(`w${context.count(MethodName.WaitingMessageAdd)}`, params.delivery, params.message, SampleData.timestamp).toJson();
        })
        .answer(MethodName.WaitingMessageEdit, () => null)
        .answer(MethodName.ConversationCancel, () => [SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson()]);
      await prepare();
      await render();
      await type("ship it");
      await send();
      await Wait.until(() => expect(deliver()).not.toBeNull());
    };

    it("steers on Enter, queues on Alt+Enter, stops and sends on Ctrl+Enter or Cmd+Enter, keeps Shift+Enter for a new line, and follows the setting", async () => {
      await running();

      await write("look again");
      await write("then the docs", { altKey: true });
      await write("wrong file", { ctrlKey: true });
      await write("wrong again", { metaKey: true });
      await write("two lines", { shiftKey: true });
      expect(box().value).toBe("two lines");
      await write("ignored", { altKey: true, shiftKey: true });
      await write("stop for this", { altKey: true, ctrlKey: true });
      expect(added()).toEqual(["Steer:c1:look again", "Queue:c1:then the docs", "StopAndSend:c1:wrong file", "StopAndSend:c1:wrong again",
        "StopAndSend:c1:stop for this"]);

      context.changeSetting(Resources.whileReplyingSetting, MessageDelivery.Queue);
      await write("after it");
      expect(added().at(-1)).toBe("Queue:c1:after it");
      expect([sent().length, box().value]).toEqual([1, ""]);
    });

    it("takes Enter for a new line and Ctrl+Enter or Cmd+Enter for the setting's choice while the send key asks for it, and Ctrl+Shift+Enter to stop and send", async () => {
      context.changeSetting(Resources.sendKeySetting, SendKey.ModEnter);
      await running();

      await write("new line");
      expect(added()).toEqual([]);
      await write("look again", { ctrlKey: true });
      await write("now", { metaKey: true, shiftKey: true });
      await write("later", { altKey: true });
      expect(added()).toEqual(["Steer:c1:look again", "StopAndSend:c1:now", "Queue:c1:later"]);
    });

    it.each([
      { platform: "MacIntel", modifier: "Cmd" },
      { platform: "Win32", modifier: "Ctrl" }
    ])("offers each way to send beside Stop with its key on $platform, and sends by the one picked", async ({ platform, modifier }) => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      await running();
      expect([main().getAttribute("aria-label"), arrow().getAttribute("aria-label")]).toEqual([Resources.deliveryLabels[MessageDelivery.Steer], Resources.deliveryMenuLabel]);
      const stop = present(root().querySelector(".nol-teamrun-composer-stop"));
      expect(stop.nextElementSibling).toBe(deliver());

      await click(arrow());
      expect(offered().map(t => [t.dataset["delivery"], t.querySelector(".nol-menu-item-label")?.textContent?.trim(), t.querySelector(".nol-menu-item-shortcut")?.textContent?.trim()]))
        .toEqual([["Steer", "Steer", "Enter"], ["Queue", "Queue", "Alt+Enter"], ["StopAndSend", "Stop and send", `${modifier}+Enter`]]);
      await click(arrow());

      await type("then the docs");
      await click(arrow());
      await click(present(offered().find(t => t.dataset["delivery"] === MessageDelivery.Queue)));
      await type("look again");
      await click(main());
      expect(added()).toEqual(["Queue:c1:then the docs", "Steer:c1:look again"]);

      context.changeSetting(Resources.sendKeySetting, SendKey.ModEnter);
      await fixture.whenStable();
      await click(arrow());
      expect(offered().map(t => t.querySelector(".nol-menu-item-shortcut")?.textContent?.trim()))
        .toEqual([`${modifier}+Enter`, "Alt+Enter", `${modifier}+Shift+Enter`]);
      await click(arrow());
      context.changeSetting(Resources.whileReplyingSetting, MessageDelivery.StopAndSend);
      await fixture.whenStable();
      expect(main().getAttribute("aria-label")).toBe(Resources.deliveryLabels[MessageDelivery.StopAndSend]);
      await click(arrow());
      expect(offered().map(t => t.querySelector(".nol-menu-item-shortcut")?.textContent?.trim()))
        .toEqual([undefined, "Alt+Enter", `${modifier}+Enter`]);
    });

    it("edits the last waiting message on Up in an empty field, saves it on Enter with its files, and cancels on Escape or Cancel without stopping the reply", async () => {
      await running();
      const files = [new AttachmentInput("notes.txt", "text/plain", "YQ==", null)];
      await key("ArrowUp");
      expect(editingNote()).toBeUndefined();
      await listed(waiting("w1", "first"), waiting("w2", "second", files));

      await type("draft");
      await key("ArrowUp");
      expect(editingNote()).toBeUndefined();
      await type("");
      for (const options of [{ shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }])
        await key("ArrowUp", options);
      expect(editingNote()).toBeUndefined();

      await key("ArrowUp");
      expect([editingNote(), box().value, document.activeElement === box()]).toEqual([Resources.editingWaitingNote, "second", true]);
      expect(main().getAttribute("aria-label")).toBe(Resources.saveWaitingLabel);
      await click(arrow());
      expect(offered().map(t => t.getAttribute("aria-disabled"))).toEqual(["true", "true", "true"]);
      await click(arrow());
      await write("second, changed", { ctrlKey: true });
      expect(edited()).toEqual(["w2:second, changed:1"]);
      expect([editingNote(), box().value, added()]).toEqual([undefined, "", []]);

      await key("ArrowUp");
      await escape();
      expect([editingNote(), box().value]).toEqual([undefined, ""]);
      await key("ArrowUp");
      await click(present(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-cancel-edit")));
      expect([editingNote(), box().value]).toEqual([undefined, ""]);
      expect(context.count(MethodName.ConversationCancel)).toBe(0);
      await escape();
      expect(context.count(MethodName.ConversationCancel)).toBe(1);
    });

    it("ends editing once its message no longer waits, and keeps the text to send as a new message", async () => {
      await running();
      await listed(waiting("w1", "first"));
      await key("ArrowUp");
      expect(editingNote()).toBe(Resources.editingWaitingNote);
      await type("first, changed");

      await listed();
      expect([editingNote(), box().value, main().getAttribute("aria-label")]).toEqual([undefined, "first, changed", Resources.deliveryLabels[MessageDelivery.Steer]]);
      await key("Enter");
      expect([edited(), added()]).toEqual([[], ["Steer:c1:first, changed"]]);
    });

    it("keeps the text of an edit out of the chat's unsent message, saving nothing for it on a save, after Escape or as the tab closes", async () => {
      await running();
      await listed(waiting("w1", "And run the linter after that"));
      const saves = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DraftSave))
        .map(t => DraftSaveParams.fromJson(t.parameters).text);

      await key("ArrowUp");
      await type("And run the linter after that too");
      await Promise.all([...context.saves].map(t => t()));
      const whileEditing = saves();
      await escape();
      await key("ArrowUp");
      await type("And run the linter after that, then the tests");
      fixture.destroy();
      await Promise.resolve();

      expect([whileEditing, saves()]).toEqual([[], []]);
      expect(context.count(MethodName.ConversationCancel)).toBe(0);
    });

    it("cancels an edit without stopping the reply on Escape from the editing note's Cancel or the split button, once its tooltip is closed, and stops the reply from them otherwise",
      async () => {
        await running();
        await listed(waiting("w1", "first"));
        const escapeOn = async (target: HTMLElement): Promise<void> => {
          target.addEventListener("keydown", t => fixture.componentInstance.stopOnEscape(t), { once: true });
          target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
          await fixture.whenStable();
        };
        const state = (): unknown[] => [editingNote(), box().value, context.count(MethodName.ConversationCancel)];

        await key("ArrowUp");
        const cancel = present(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-cancel-edit"));
        cancel.focus();
        await escapeOn(cancel);
        const fromCancel = state();
        await key("ArrowUp");
        TestBed.inject(FocusMonitor).focusVia(main(), "keyboard");
        await Wait.until(() => expect(document.querySelector("nol-tooltip")).not.toBeNull());
        await escapeOn(main());
        const underTooltip = state();
        await escapeOn(main());
        const fromMain = state();
        await escapeOn(main());

        expect(fromCancel).toEqual([undefined, "", 0]);
        expect(underTooltip).toEqual([Resources.editingWaitingNote, "first", 0]);
        expect(fromMain).toEqual([undefined, "", 0]);
        expect(context.count(MethodName.ConversationCancel)).toBe(1);
      });

    it("offers Edit on a waiting message only while the field is empty, and puts the picked one in the field", async () => {
      await running();
      await listed(waiting("w1", "first"), waiting("w2", "second"));
      const edit = (): HTMLButtonElement => present(document.querySelector<HTMLButtonElement>(".nol-teamrun-waiting-edit"));
      const menuOf = async (row: number): Promise<void> => click(present(root().querySelectorAll<HTMLButtonElement>(".nol-teamrun-waiting-menu")[row]));

      await type("draft");
      await menuOf(0);
      expect(edit().getAttribute("aria-disabled")).toBe("true");
      await menuOf(0);
      await type("");
      await menuOf(0);
      await click(edit());
      expect([editingNote(), box().value]).toEqual([Resources.editingWaitingNote, "first"]);
      await key("Enter");
      expect(edited()).toEqual(["w1:first:0"]);

      await pick([new File(["a"], "late.txt")]);
      await key("ArrowUp");
      expect(editingNote()).toBeUndefined();
      await menuOf(0);
      expect(edit().getAttribute("aria-disabled")).toBe("true");
    });

    it("lines the editing note and its Cancel up with the field's text, above it", async () => {
      await running();
      await listed(waiting("w1", "first"));
      await key("ArrowUp");
      const note = present(root().querySelector<HTMLElement>(".nol-teamrun-composer-editing .nol-teamrun-composer-note")).getBoundingClientRect();
      const field = box().getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(box()).paddingInlineStart);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      expect((note.left - field.left - inset) / rem).toBeCloseTo(0, 1);
      expect(note.bottom).toBeLessThanOrEqual(field.top + 0.5);
    });

    describe("under forced colours and at 200% zoom", () => {
      const settle = (): Promise<void> => fixture.whenStable();
      const lastMenu = (): HTMLElement => present([...document.querySelectorAll<HTMLElement>("nol-menu")].at(-1));
      const shut = async (trigger: HTMLElement): Promise<void> => {
        if (!Object.isNull(document.querySelector("nol-menu")))
          await click(trigger);
        await Wait.until(() => expect(document.querySelector("nol-menu")).toBeNull());
      };
      const busy = async (): Promise<void> => {
        await running();
        await listed(waiting("w1", "look again"), waiting("w2", "", [new AttachmentInput("notes.txt", "text/plain", "YQ==", null)]),
          new WaitingMessage("w3", MessageDelivery.Steer, new MessageSendParams("c1", "then the docs", SampleData.provenance.requested, "a1"), SampleData.timestamp,
            "The provider refused it."));
        await Wait.until(() => expect(root().querySelectorAll(".nol-teamrun-waiting-row")).toHaveLength(3));
      };
      const waitingMenu = (): HTMLButtonElement => present(root().querySelector<HTMLButtonElement>(".nol-teamrun-waiting-menu"));

      it("keeps Stop, the ways to send, the waiting messages and both their menus visible under forced colours, with their states and focus rings", async () => {
        await busy();
        expect(await AccessibilityFixture.expectVisibleForcedAsync(root())).toBeGreaterThan(0);
        await click(arrow());
        await AccessibilityFixture.expectVisibleForcedAsync(lastMenu());
        await shut(arrow());
        await click(waitingMenu());
        await AccessibilityFixture.expectVisibleForcedAsync(lastMenu());
        await shut(waitingMenu());
      });

      it("neither cuts, crosses nor loses Stop, the ways to send, the waiting messages or their menus at 200% zoom", async () => {
        await busy();
        await AccessibilityFixture.expectFitsZoomedAsync(root(), settle, [".nol-teamrun-context-track-only"]);
        for (const trigger of [arrow, waitingMenu])
          await AccessibilityFixture.zoomedAsync(async () => {
            await click(trigger());
            await AccessibilityFixture.expectFitsZoomedAsync(lastMenu(), settle);
            await shut(trigger());
          });
      });
    });
  });

  it("sends only on Ctrl+Enter or Cmd+Enter while the send key setting asks for it, and on Enter again once it changes back", async () => {
    context.answer(MethodName.MessageSend, () => answered()).changeSetting(Resources.sendKeySetting, SendKey.ModEnter);
    await prepare();
    await render();
    await ready();

    await type("first");
    await key("Enter");
    expect(sent()).toEqual([]);
    await key("Enter", { ctrlKey: true });
    await Wait.until(() => expect(sent()).toHaveLength(1));
    await type("second");
    await key("Enter", { metaKey: true });
    await Wait.until(() => expect(sent()).toHaveLength(2));
    context.changeSetting(Resources.sendKeySetting, SendKey.Enter);
    await type("third");
    await key("Enter");

    await Wait.until(() => expect(sent().map(t => t.text)).toEqual(["first", "second", "third"]));
  });

  it("takes focus from the Focus the composer command for its own conversation, and stops offering it when it leaves", async () => {
    await prepare();
    await render();
    const targets = CommandTargetsService.of(context);
    expect([targets.canFocusComposer("c1"), targets.canFocusComposer("c2")]).toEqual([true, false]);

    targets.focusComposer("c1");
    expect(document.activeElement).toBe(box());
    fixture.componentRef.setInput("conversationId", "c2");
    await fixture.whenStable();
    expect([targets.canFocusComposer("c1"), targets.canFocusComposer("c2")]).toEqual([false, true]);
    fixture.destroy();

    expect(targets.canFocusComposer("c2")).toBe(false);
  });

  it("tells a panel request the person is typing while its box has the window's focus with text in it", async () => {
    await prepare();
    await render();
    const targets = CommandTargetsService.of(context);
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const states: boolean[] = [targets.isTypingInAnyChat()];

    box().focus();
    states.push(targets.isTypingInAnyChat());
    await type("Ask");
    states.push(targets.isTypingInAnyChat());
    hasFocus.mockReturnValue(false);
    states.push(targets.isTypingInAnyChat());
    hasFocus.mockReturnValue(true);
    box().blur();
    states.push(targets.isTypingInAnyChat());

    expect(states).toEqual([false, false, true, false, false]);
  });

  it("opens no picker when a failed reply asks to choose a model while it has no provider", async () => {
    context.answer(MethodName.ProviderKindList, () => []);
    await prepare();
    await render();
    CommandTargetsService.of(context).openComposerSettings("c1");
    await fixture.whenStable();
    expect(items()).toEqual([]);
  });

  it("opens the picker at Refresh models, first in its keyboard order, when a failed reply asks to choose a model, with nothing else in it focused first, the models under it, and the arrow keys going on from it", async () => {
    await prepare();
    await render();
    await ready();
    const reached: Element[] = [];
    const track = (event: FocusEvent): void => {
      if (event.target instanceof Element && !Object.isNull(event.target.closest(".nol-teamrun-composer-models")))
        reached.push(event.target);
    };
    document.addEventListener("focusin", track);
    try {
      CommandTargetsService.of(context).openComposerSettings("c1");
      await fixture.whenStable();
      expect(refreshes()).toBe(1);
      expect(labels()).toContain("gpt-5");
      await Wait.until(() => expect(document.activeElement).toBe(refresh()));
      const first = [...reached];
      await userEvent.keyboard("{ArrowDown}");
      await fixture.whenStable();

      expect([first, document.activeElement === refresh(), refresh().closest("nol-menu")!.contains(document.activeElement)]).toEqual([[refresh()], false, true]);
    }
    finally {
      document.removeEventListener("focusin", track);
    }
    await close();
  });

  it("tells New chat its chat is fresh only while nothing is sent and it holds no text, mention or attachment", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson()).answer(MethodName.MessageSend, answered);
    const store = await prepare();
    await render();
    const targets = CommandTargetsService.of(context);
    await Wait.until(() => expect(store.isHistoryLoaded("c1")).toBe(true));
    const states: boolean[] = [targets.isFresh("c1")];

    await type("Ask");
    states.push(targets.isFresh("c1"));
    await type(" ");
    states.push(targets.isFresh("c1"));
    await type("@Ali");
    await Wait.until(() => expect(names()).toContain("Alice"));
    await key("Enter");
    const chips = root().querySelectorAll(".nol-mention-chip").length;
    states.push(targets.isFresh("c1"));
    await type("");
    await pick([sized("notes.txt", 4, "text/plain")]);
    states.push(targets.isFresh("c1"));
    await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-remove")!);
    states.push(targets.isFresh("c1"));
    await type("Ask");
    await send();
    await Wait.until(() => expect(box().value).toBe(""));

    expect([chips, [...states, targets.isFresh("c1")]]).toEqual([1, [true, false, true, false, false, true, false]]);
  });

  it("falls back to the first provider when the remembered one is gone", async () => {
    await prepare();
    remember(new ComposerSettings("gone", null, null, null));

    await render();

    expect(summary()).toContain("Codex · Work · This computer");
  });

  it("offers the default model every level a listed model offers when the provider says its unlisted default takes them, as Copilot's Auto, with a remembered one checked", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("claude-opus", "Claude Opus", "", ["high", "max"], false, null, true),
      new ProviderModel("gpt-5-mini", "GPT-5 mini", "", ["low", "medium"], false, null, true)], true, false, null, false, [], null, true));
    await prepare();
    remember(new ComposerSettings("codex", null, "medium", null));
    await render();
    await ready();

    await choose();
    expect(rowsOf("efforts").map(labelOf)).toEqual(["Low", "Medium", "High", "Max"]);
    expect(rowsOf("efforts").filter(t => t.getAttribute("aria-checked") === "true").map(labelOf)).toEqual(["Medium"]);
    await close();
  });

  it("checks the effort the provider's configuration sets while none is chosen, as an unlisted row when the model doesn't list it, and tags the model's own default", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "GPT-5", "", ["low", "high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" }, [], null, null, null, "xhigh"),
      new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low", "medium"], false, null, true, "medium", { xhigh: "Extra high" }, [], null, null, null, "xhigh")
    ]));
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5-mini", "low", "a1"));
    await render();
    const labels = (): string[] => rowsOf("efforts").map(labelOf);
    const checked = (): string[] => rowsOf("efforts").filter(t => t.getAttribute("aria-checked") === "true").map(labelOf);
    const tags = (): (string | null)[] => rowsOf("efforts").map(t => t.querySelector(".nol-menu-item-tag")?.textContent?.trim() ?? null);

    await choose("GPT-5");
    await ready();
    await choose();
    expect([choice()?.effort ?? null, buttonLabel()]).toEqual([null, "Codex · GPT-5 · Extra high"]);
    expect([labels(), checked(), tags()]).toEqual([["Low", "High", "Extra high"], ["Extra high"], [null, Resources.recommendedEffortTag, null]]);
    await close();

    await choose("GPT-5 Mini");
    await ready();
    await choose();
    expect([choice()?.effort ?? null, buttonLabel()]).toEqual([null, "Codex · GPT-5 Mini · Extra high"]);
    expect([labels(), checked(), tags()])
      .toEqual([[Resources.formatUnlisted("Extra high"), "Low", "Medium"], [Resources.formatUnlisted("Extra high")], [null, null, Resources.recommendedEffortTag]]);
    await close();
  });

  it("offers no levels for the default model of a provider that marks no default and doesn't say its default takes the listed ones", async () => {
    context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5-mini", "GPT-5 mini", "", ["low", "medium"], false, null, true),
      new ProviderModel("gpt-5.5", "GPT-5.5", "", ["medium", "high"], false, null, true)]));
    await prepare();
    remember(new ComposerSettings("codex", null, "medium", null));
    await render();
    await ready();

    await choose();
    expect(rowsOf("efforts").map(labelOf)).toEqual([Resources.formatUnlisted("medium")]);
    await close();
  });

  it("keeps remembered choices the catalogs no longer offer, marked unavailable, checks the model's, and refreshes the models", async () => {
    await prepare();
    remember(new ComposerSettings("codex", "old-model", "max", "missing"));
    await render();
    await ready();
    expect(summary()).toContain("Codex · gpt-5, old-model not available · Max");

    await chooseProvider();
    expect(labels()).toContain("Saved provider unavailable");
    await close();
    await choose();
    expect(rowsOf("models").filter(t => t.getAttribute("aria-checked") === "true").map(labelOf)).toEqual(["old-model (not in the current catalog)"]);
    await close();
    await choose();
    expect(labels()).toContain("max (not in the current catalog)");
    await close();

    context.fail(MethodName.ProviderModelCatalog, "offline");
    await refreshModels();
    await ready();
    await choose();
    expect(labels()).toContain("Models could not be refreshed. Previously loaded choices are kept.");
    expect(labels()).toContain("gpt-5");
    expect(context.count(MethodName.ProviderModelCatalog)).toBe(2);
  });

  it("drops a model list that answers after the provider changed", async () => {
    const codexModels = new DeferredResponse();
    context.answer(MethodName.ProviderModelCatalog, t => ProviderListModelsParams.fromJson(t).kind === "codex" ? codexModels.promise
      : SampleData.catalog([new ProviderModel("sonnet", "Sonnet", "", [], true, null, true)]))
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    await prepare();
    await render();

    await click(picker());
    await click(providerRow());
    await click(required(document.querySelector<HTMLButtonElement>(".nol-teamrun-kind")));
    await click(item("Claude Code"));
    codexModels.resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]));

    await choose();
    expect(labels()).toContain("Sonnet");
    expect(labels()).not.toContain("GPT-5");
  });

  it("offers each enabled provider of another kind on the picker's first level, and answers with it in one choice", async () => {
    context.answer(MethodName.ProviderModelCatalog, t => SampleData.catalog(ProviderListModelsParams.fromJson(t).kind === "claude"
      ? [new ProviderModel("sonnet", "Sonnet", "", [], true, null, true)] : [new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]))
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    await prepare();
    await render();

    await choose();
    const others = [...document.querySelectorAll<HTMLElement>(".nol-teamrun-other-provider")];
    const offered = others.map(t => labelOf(t));
    await click(required(others[0]));
    await choose();
    const after = [labels(), providerRowLabel(), document.querySelectorAll(".nol-teamrun-other-provider").length];
    await close();

    expect(offered).toEqual(["Work · Claude Code"]);
    expect(after[0]).toContain("Sonnet");
    expect(after.slice(1)).toEqual(["Work · Claude Code", 1]);
  });

  it("leaves a provider of another kind that needs a new sign-in or is disabled off the picker's first level, and offers one whose check hasn't run or couldn't tell", async () => {
    const other = (id: string, label: string, status: AuthStatus, enabled: boolean = true): Provider =>
      new Provider(id, "claude", label, `D:\\profiles\\${id}`, status, null, null, null, null, SampleData.timestamp, enabled);
    context.answer(MethodName.ProviderList, () => [SampleData.provider, providerOf("claude"), other("c2", "Lab", AuthStatus.LoggedOut), other("c3", "Old", AuthStatus.Expired),
      other("c4", "New", AuthStatus.Unknown), other("c5", "Odd", AuthStatus.Error), other("c6", "Off", AuthStatus.LoggedIn, false)].map(t => t.toJson()));
    await prepare();
    await render();

    await choose();
    const offered = [...document.querySelectorAll<HTMLElement>(".nol-teamrun-other-provider")].map(t => labelOf(t));
    await close();

    expect(offered).toEqual(["New · Claude Code", "Odd · Claude Code", "Work · Claude Code"]);
  });

  it("puts the other kinds' providers right under the provider row, uncut inside the menu, in the smallest window at 200% zoom", async () => {
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    await prepare();
    await render();

    await AccessibilityFixture.zoomedAsync(async () => {
      await choose();
      const menu = required(document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu")).getBoundingClientRect();
      const row = providerRow().getBoundingClientRect();
      const other = required(document.querySelector<HTMLElement>(".nol-teamrun-other-provider"));
      const box = other.getBoundingClientRect();
      const label = required(other.querySelector<HTMLElement>(".nol-menu-item-label"));
      const rowLabel = required(providerRow().querySelector<HTMLElement>(".nol-menu-item-label")).getBoundingClientRect();
      const found = { below: box.top >= row.bottom - 0.5, next: box.top - row.bottom < row.height, inside: box.left >= menu.left - 0.5 && box.right <= menu.right + 0.5,
        onScreen: menu.left >= -0.5 && menu.right <= window.innerWidth + 0.5, uncut: label.scrollWidth <= label.clientWidth + 0.5,
        sameLeft: Math.abs(box.left - row.left) < 0.5, sameLabelStart: Math.abs(label.getBoundingClientRect().left - rowLabel.left) < 0.5, sameHeight: Math.abs(box.height - row.height) < 0.5 };
      await close();

      expect(found).toEqual({ below: true, next: true, inside: true, onScreen: true, uncut: true, sameLeft: true, sameLabelStart: true, sameHeight: true });
    });
  });

  it("reaches a provider of another kind by ArrowDown, switches to it on Enter, and gives focus back to the picker", async () => {
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    await prepare();
    await render();
    await ready();
    const press = async (name: string): Promise<void> => {
      await userEvent.keyboard(`{${name}}`);
      await fixture.whenStable();
    };
    const focused = (): string | undefined => document.activeElement?.querySelector(".nol-menu-item-label")?.textContent?.trim();

    picker().focus();
    await press("Enter");
    await Wait.until(() => expect(focused()).toBeDefined());
    for (let step = 0; step < 12 && focused() !== "Work · Claude Code"; step++)
      await press("ArrowDown");
    const reached = focused();
    await press("Enter");
    await Wait.until(() => expect(choice()?.kind).toBe("claude"));

    expect([reached, choice()?.providerId, document.querySelectorAll("nol-menu").length, document.activeElement === picker()]).toEqual(["Work · Claude Code", "claude-1", 0, true]);
  });

  it("offers no provider of another kind while a teammate answers", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    await prepare();
    remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    await render();
    await ready();

    await choose();
    const others = document.querySelectorAll(".nol-teamrun-other-provider").length;
    await close();

    expect(others).toBe(0);
  });

  it("turns the model off with a reason for a provider that lists no models, and offers no effort levels of its own", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("copilot").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => SampleData.catalog(ProviderListModelsParams.fromJson(t).kind === "copilot" ? []
        : [new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)], true));
    await prepare();
    remember(new ComposerSettings("copilot", null, null, "copilot-1"));
    await render();

    await choose();
    expect(item(Resources.formatModelsNotListed("GitHub Copilot")).getAttribute("aria-disabled")).toBe("true");
    expect(labels()).toContain(Resources.formatProviderDefault("GitHub Copilot", null));
    await close();
    await choose();
    expect(document.querySelector(".nol-teamrun-composer-efforts")).toBeNull();
    await close();

    await chooseKind("Codex");
    await choose();
    expect(labels()).not.toContain(Resources.formatModelsNotListed("Codex"));
    await close();
    await choose();
    expect(document.querySelector(".nol-teamrun-composer-efforts")).toBeNull();
  });

  it("says Copilot's model list came back empty first under the Model label, with Refresh models on the label's line, and lists again on Refresh", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    let calls = 0;
    context.answer(MethodName.ProviderList, () => [providerOf("copilot").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => ++calls === 1 ? SampleData.catalog([], true, true)
        : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("copilot", null, null, "copilot-1"));
    await render();

    const empty = `${Resources.formatModelsCameBackEmpty("GitHub Copilot")} ${Resources.formatCopilotPlanChange("D:\\profiles\\copilot")}`;
    await choose();
    const menu = required(document.querySelector(".nol-teamrun-composer-models"));
    const reason = item(empty).getBoundingClientRect();
    const label = menu.querySelector(".nol-menu-label")!.getBoundingClientRect();
    const action = refresh().getBoundingClientRect();
    expect(empty).toContain("copilot login in a terminal with COPILOT_HOME set to D:\\profiles\\copilot, then");
    expect(item(empty).getAttribute("aria-disabled")).toBe("true");
    expect([refreshes(), labels().includes(Resources.refreshModelsLabel)]).toEqual([1, false]);
    expect([menu.querySelector(".nol-menu-label")!.textContent!.trim(), menu.querySelector("button[nol-menu-item]")]).toEqual([Resources.modelLabel, item(empty)]);
    expect(action.top + action.height / 2).toBeGreaterThan(label.top);
    expect(action.top + action.height / 2).toBeLessThan(Math.min(label.bottom, reason.top));
    expect(action.left).toBeGreaterThan(label.left);
    expect(labels()).not.toContain(Resources.modelCatalogUnavailable);
    await click(refresh());
    await close();

    await choose();
    expect(calls).toBe(2);
    expect(labels()).toContain("GPT-5");
    expect(labels()).not.toContain(empty);
    expect(refreshes()).toBe(1);
  });

  it("names no folder in Copilot's plan-change hint while its saved provider is gone", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    context.answer(MethodName.ProviderList, () => []).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.ProviderKindList, () => [copilot.toJson()]).answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([], true, true));
    await prepare();
    remember(new ComposerSettings("copilot", null, null, "gone"));
    await render();

    await choose();
    expect(labels()).toContain(`${Resources.formatModelsCameBackEmpty("GitHub Copilot")} ${Resources.formatCopilotPlanChange(null)}`);
  });

  it("says Antigravity's models aren't listed yet before the provider's first reply, with Refresh, and lists them on Refresh", async () => {
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    let calls = 0;
    context.answer(MethodName.ProviderList, () => [providerOf("antigravity", "g1").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [antigravity.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => ++calls === 1 ? SampleData.catalog([], true, false, null, true)
        : SampleData.catalog([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("antigravity", null, null, "g1"));
    await render();

    await choose();
    expect(item(Resources.formatModelsAwaitFirstReply("Antigravity")).getAttribute("aria-disabled")).toBe("true");
    expect(refreshes()).toBe(1);
    expect(labels()).not.toContain(Resources.formatModelsNotListed("Antigravity"));
    await click(refresh());
    await close();

    await choose();
    expect(calls).toBe(2);
    expect(labels()).toContain("Gemini Pro");
    expect(labels()).not.toContain(Resources.formatModelsAwaitFirstReply("Antigravity"));
  });

  it("lists Antigravity's models without Refresh once a reply on its provider ends, and not after a reply on another provider or provider", async () => {
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    let calls = 0;
    context.answer(MethodName.ProviderList, () => [providerOf("antigravity", "g1").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [antigravity.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => ++calls === 1 ? SampleData.catalog([], true, false, null, true)
        : SampleData.catalog([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("antigravity", null, null, "g1"));
    await render();
    const end = (id: string, provenance: Provenance): void => {
      const reply = new Message(id, "c1", 3, MessageAuthor.Provider, "m1", MessageStatus.Running, [], provenance, SampleData.timestamp, SampleData.timestamp, null);
      context.emit(EventName.MessageCreated, reply.toJson());
      context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
    };
    const on = (kind: string, providerId: string | null): Provenance => new Provenance(providerId, new RequestedSettings(kind, null, null),
      new ObservedSettings(kind, null, null, "1.3.0"), "s1", false);
    await choose();
    expect(labels()).toContain(Resources.formatModelsAwaitFirstReply("Antigravity"));
    await close();

    end("m3", on("codex", "a1"));
    end("m4", on("antigravity", "g2"));
    await fixture.whenStable();
    expect(calls).toBe(1);
    end("m5", on("antigravity", "g1"));
    await Wait.until(() => expect(calls).toBe(2));

    await choose();
    expect(labels()).toContain("Gemini Pro");
    expect(labels()).not.toContain(Resources.formatModelsAwaitFirstReply("Antigravity"));
    expect(refreshes()).toBe(1);
  });

  it("names a teammate's model on the picker's button as the provider's catalog does once the composer loads that catalog again, not by its id", async () => {
    let calls = 0;
    new TeammateFixture(context);
    context.answer(MethodName.ProviderModelCatalog, () => ++calls === 1 ? SampleData.catalog([])
      : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5 Astra", "", ["high"], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("codex", null, null, "a1", "alice"));
    await render();

    await Wait.until(() => expect(buttonLabel()?.startsWith(["@Alice", "gpt-5"].join(Resources.titleSeparator))).toBe(true));
    await refreshModels();
    await Wait.until(() => expect(calls).toBe(2));
    await ready();

    expect(buttonLabel()?.startsWith(["@Alice", "GPT-5 Astra"].join(Resources.titleSeparator))).toBe(true);
  });

  it("says Copilot Free includes only Auto, right above Auto, and drops the note when Refresh lists models", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    let calls = 0;
    context.answer(MethodName.ProviderList, () => [providerOf("copilot").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => ++calls === 1 ? SampleData.catalog([], true, false, "Copilot Free")
        : SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)]));
    await prepare();
    remember(new ComposerSettings("copilot", null, null, "copilot-1"));
    await render();

    const free = `${Resources.formatPlanIncludesOnly("Copilot Free", "Auto")} ${Resources.formatCopilotPlanChange("D:\\profiles\\copilot")}`;
    await choose();
    const note = item(free);
    const auto = item(Resources.formatProviderDefault("GitHub Copilot", "Auto"));
    expect(free).toContain("copilot login in a terminal with COPILOT_HOME set to D:\\profiles\\copilot, then");
    expect(note.getAttribute("aria-disabled")).toBe("true");
    expect(auto.getAttribute("aria-disabled")).not.toBe("true");
    expect(labels().indexOf(Resources.formatProviderDefault("GitHub Copilot", "Auto"))).toBe(labels().indexOf(free) + 1);
    expect(Math.abs(auto.getBoundingClientRect().top - note.getBoundingClientRect().bottom)).toBeLessThan(0.5);
    expect(Math.abs(auto.getBoundingClientRect().left - note.getBoundingClientRect().left)).toBeLessThan(0.5);
    expect(labels()).not.toContain(Resources.formatModelsNotListed("GitHub Copilot"));
    expect(labels()).not.toContain(Resources.formatModelsCameBackEmpty("GitHub Copilot"));
    expect(refreshes()).toBe(1);
    await click(refresh());
    await close();

    await choose();
    expect(calls).toBe(2);
    expect(labels()).toContain("GPT-5");
    expect(labels()).not.toContain(free);
  });

  it("names a Copilot provider's own folder in its plan-change hint, so the sign-in it asks for renews that provider's", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const work = new Provider("c1", "copilot", "Work", "D:/copilot-work", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [work.toJson()]).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.ProviderKindList, () => [copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([], true, false, "Copilot Free"));
    await prepare();
    remember(new ComposerSettings("copilot", null, null, work.id));
    await render();

    const free = `${Resources.formatPlanIncludesOnly("Copilot Free", "Auto")} ${Resources.formatCopilotPlanChange(work.profileDir)}`;
    await choose();
    expect(item(free).getAttribute("aria-disabled")).toBe("true");
    expect(free).toContain("copilot login in a terminal with COPILOT_HOME set to D:/copilot-work, then");
  });

  it("names a set model the plan doesn't offer as Auto with that model not available, a listed one by its name, and with no list the set model", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const work = new Provider("c1", "copilot", "Work", "D:/copilot-work", AuthStatus.LoggedIn, null, null, null, null, "t");
    const home = new Provider("c2", "copilot", "Home", "D:/copilot-home", AuthStatus.LoggedIn, null, null, null, null, "t");
    const other = new Provider("c3", "copilot", "Other", "D:/copilot-other", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [work.toJson(), home.toJson(), other.toJson()]).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.ProviderKindList, () => [copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => {
        const providerId = ProviderListModelsParams.fromJson(t).providerId;
        return providerId === work.id ? SampleData.catalog([], true, false, "Copilot Free")
          : SampleData.catalog(providerId === home.id ? [new ProviderModel("kimi-k3", "Kimi K3", "", [], false, null, true)] : []);
      });
    await prepare();
    remember(new ComposerSettings("copilot", "kimi-k3", "max", work.id));
    await render();
    await ready();

    expect(summary()).toContain("Auto, kimi-k3 not available · Max");
    remember(new ComposerSettings("copilot", "kimi-k3", "max", home.id));
    await render();
    await ready();
    expect(summary()).toContain("Kimi K3 · Max");
    remember(new ComposerSettings("copilot", "kimi-k3", "max", other.id));
    await render();
    await ready();
    expect(summary()).toContain("kimi-k3 · Max");
    expect(summary()).not.toContain("not available");
  });

  it("names the default model row after its provider and the model the provider names, and the settings after that model", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("copilot").toJson()]).answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, t => SampleData.catalog(ProviderListModelsParams.fromJson(t).kind === "copilot" ? []
        : [new ProviderModel("gpt-5", "GPT-5", "", [], false, null, true)], true));
    await prepare();
    remember(new ComposerSettings("copilot", null, "max", null));
    await render();
    await ready();

    expect(summary()).toContain("Auto · Max");
    await choose();
    expect(labels()).toContain(Resources.formatProviderDefault("GitHub Copilot", "Auto"));
    expect(labels()).not.toContain(Resources.providerDefaultModel);
    await close();

    await chooseKind("Codex");
    await ready();
    expect(summary()).not.toContain("Auto");
    await choose();
    expect(labels()).toContain(Resources.formatProviderDefault("Codex", null));
    expect(labels()).not.toContain(Resources.formatProviderDefault("GitHub Copilot", "Auto"));
  });

  it("drops an effort level the provider lacks when it moves to another provider of a provider that lists no models", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
    const work = new Provider("c1", "copilot", "Work", "D:/copilot-work", AuthStatus.LoggedIn, null, null, null, null, "t");
    const home = new Provider("c2", "copilot", "Home", "D:/copilot-home", AuthStatus.LoggedIn, null, null, null, null, "t");
    context.answer(MethodName.ProviderList, () => [work.toJson(), home.toJson()]).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.ProviderKindList, () => [copilot.toJson()])
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([]));
    await prepare();
    remember(new ComposerSettings("copilot", null, "ultra", "c1"));
    await render();
    await ready();
    expect(summary()).toContain("Ultra");

    await chooseProvider("Home · This computer");
    await ready();

    expect(summary()).toContain("Home · This computer");
    expect(summary()).not.toContain("Ultra");
  });

  it("completes and resolves mentions next to emoji and combining characters", async () => {
    const data = new TeammateFixture(context);
    data.teammates.push(new Teammate("zoe", "Zoë", null, "a1", Harness.Provider, null, null, "t", "t"));
    context.answer(MethodName.MessageSend, answered);
    await prepare();
    await render();

    await type("hi 👋 @zoe\u0308");
    await Wait.until(() => expect(names()).toEqual(["Zoë"]));
    await key("Enter");
    expect(box().value).toBe("hi 👋 @Zoë ");
    await type("👋@Al");
    await fixture.whenStable();
    expect(names()).toEqual([]);

    await type("👋@Alice, @Zoe\u0308🎉 and @Bob\u200d please");
    await send();

    await Wait.until(() => expect(sent()).toHaveLength(1));
    expect(sent()[0]?.mentionedTeammateIds).toEqual(["alice", "zoe", "bob"]);
  });

  it("restores its conversation's stored choice, starts another from the last sent one, and keeps unsent picks while stored choices change", async () => {
    const key = Resources.composerChoicesStorageKey;
    const storeElsewhere = (value: unknown): void => {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new StorageEvent("storage", { key }));
    };
    const claude = new ComposerSettings("claude", null, null, "claude-1");
    context.answer(MethodName.MessageSend, answered).answer(MethodName.ComposerDefaultRead, () => claude.toJson())
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    localStorage.setItem(key, JSON.stringify(new ComposerChoices(new Map([["c1", new ComposerSettings("codex", "gpt-5-mini", "high", "a1")]])).toJson()));
    await prepare();
    await render();
    await ready();
    expect(summary()).toContain("Codex · Work · This computer · gpt-5-mini · High");

    fixture.destroy();
    await render("c2");
    await ready();
    expect(summary()).toContain("Claude Code · Work · This computer");
    await choose("gpt-5");
    remember(new ComposerSettings("codex", null, null, null));
    await fixture.whenStable();
    expect(summary()).toContain("Claude Code · Work · This computer · gpt-5");
    await type("hello");
    await send();
    await Wait.until(() => expect(sent()).toHaveLength(1));
    const sentChoice = new ComposerSettings("claude", "gpt-5", null, "claude-1");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(new ComposerChoices(
      new Map([["c1", new ComposerSettings("codex", null, null, null)], ["c2", sentChoice]])).toJson());
    await Wait.until(() => expect(ComposerDefaultSaveParams.fromJson(context.parametersOf(MethodName.ComposerDefaultSave)).toJson())
      .toEqual(new ComposerDefaultSaveParams(sentChoice.toJson()).toJson()));

    await choose("gpt-5-mini");
    storeElsewhere(JSON.parse(localStorage.getItem(key)!));
    await fixture.whenStable();
    expect(summary()).toContain("gpt-5-mini");
    storeElsewhere(new ComposerChoices(new Map([["c2", new ComposerSettings("codex", null, null, null)]])).toJson());
    await Wait.until(() => expect(summary()).toContain("Codex · Work · This computer"));
    storeElsewhere(new ComposerChoices().toJson());
    await fixture.whenStable();
    expect(summary()).toContain("Codex · Work · This computer");
  });

  it("starts a chat with no choice of its own from the default teammate, keeps a chat's kept choice when the default changes, and starts from the last sent one, moved from local storage, once it's cleared", async () => {
    const key = Resources.composerChoicesStorageKey;
    const moved = new ComposerSettings("codex", "gpt-5-mini", null, null);
    localStorage.setItem(key, JSON.stringify({ defaultChoice: moved.toJson(), chats: {} }));
    context.answer(MethodName.DefaultTeammateSet, t => DefaultTeammateSetParams.fromJson(t).defaultTeammate?.toJson() ?? null)
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), providerOf("claude").toJson()]);
    const store = await prepare();
    const work = new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a1");
    expect(await store.setDefaultTeammate(work)).toBe(true);
    await render();
    await ready();
    expect(summary()).toContain("Codex · Work · This computer · gpt-5 · High");
    await Wait.until(() => expect(keptChoices()).toEqual([choiceParams(new ConversationResponder(null, work.requested, "a1"))]));

    expect(await store.setDefaultTeammate(new DefaultTeammate(new RequestedSettings("claude", null, null)))).toBe(true);
    await fixture.whenStable();
    expect(summary()).toContain("Codex · Work · This computer · gpt-5 · High");
    expect(keptChoices()).toHaveLength(1);
    fixture.destroy();
    await render("c2");
    await ready();
    expect(summary()).toContain("Claude Code · Work · This computer");
    expect(reason()).toBeUndefined();
    await type("Hello");
    await Wait.until(() => expect(sendButton()?.disabled).toBe(false));
    await type(String.empty);

    expect(await store.setDefaultTeammate(null)).toBe(true);
    expect(store.defaultTeammate()).toBeNull();
    fixture.destroy();
    await render("c3");
    await ready();
    expect(summary()).toContain("Codex · Work · This computer · gpt-5-mini");
    expect(ComposerDefaultSaveParams.fromJson(context.parametersOf(MethodName.ComposerDefaultSave)).toJson()).toEqual(new ComposerDefaultSaveParams(moved.toJson(), true).toJson());
    expect(JSON.parse(localStorage.getItem(key)!)).not.toHaveProperty(Resources.defaultChoiceField);
  });

  it("offers a new tab, Copy Image and Download in an attached image's context menu, puts the image's bytes on the clipboard, and says so when it can't", async () => {
    await prepare();
    await render();
    const writer = clipboard();
    await pick([imageFile("shot.png"), new File(["a"], "notes.txt")]);
    await Wait.until(() => expect(previews()).toHaveLength(1));

    expect([frames().length, frames()[0]!.tabIndex, frames()[0]!.getAttribute("aria-label")]).toEqual([1, 0, "shot.png"]);
    await openImageMenu(frames()[0]!);
    expect(labels()).toEqual(["Open in a new tab", "Copy Image", "Download Image"]);
    let written = nextWrite();
    await click(item("Copy Image"));
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(writer.images).toHaveLength(1);
    expect([...writer.images[0]!]).toEqual([...Uint8Array.from(atob(pixels()), t => t.charCodeAt(0))]);
    expect(alert()).toBeUndefined();

    written = nextWrite(() => Promise.resolve(false));
    await openImageMenu(frames()[0]!);
    await click(item("Copy Image"));
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(alert()).toBe(Resources.imageCopyFailed));
    expect(writer.images).toHaveLength(2);
  });

  it("offers an attached image's open and Download, but no Copy Image, while the window can't copy images", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ClipboardWriter, useValue: null }] });
    await prepare();
    await render();
    await pick([imageFile("shot.png")]);
    await Wait.until(() => expect(previews()).toHaveLength(1));

    expect(frames()[0]!.tabIndex).toBe(0);
    await openImageMenu(frames()[0]!);
    expect(labels()).toEqual(["Open in a new tab", "Download Image"]);
  });

  it("opens an attached image in the viewer's popup on a click, stepping through the attached images, and returns to it when the popup closes", async () => {
    await prepare();
    await render();
    await pick([imageFile("first.png"), new File(["a"], "notes.txt"), imageFile("second.png", 4)]);
    await Wait.until(() => expect(previews()).toHaveLength(2));
    const viewer = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-image-viewer");
    const shownName = (): string | undefined => viewer()?.querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim();

    await click(frames()[0]!);
    await Wait.until(() => expect(shownName()).toBe("first.png"));
    expect(context.openedDocuments).toEqual([]);
    await click(viewer()!.querySelector<HTMLButtonElement>(".nol-teamrun-image-next")!);
    await Wait.until(() => expect(shownName()).toBe("second.png"));
    expect(viewer()!.querySelector<HTMLButtonElement>(".nol-teamrun-image-next")!.disabled).toBe(true);

    await click(viewer()!.querySelector<HTMLButtonElement>(".nol-teamrun-image-close")!);
    await Wait.until(() => expect(viewer()).toBeNull());
    expect(document.activeElement).toBe(frames()[0]);
  });

  it("opens an attached image in a tab on a click when the setting says so, and offers the popup in its menu instead", async () => {
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    await prepare();
    await render();
    await pick([imageFile("shot.png")]);
    await Wait.until(() => expect(previews()).toHaveLength(1));
    const viewer = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-image-viewer");

    await click(frames()[0]!);
    expect(context.openedDocuments.map(t => [t.name, t.title])).toEqual([[Resources.imageDocumentName, "shot.png"]]);
    expect(viewer()).toBeNull();

    await openImageMenu(frames()[0]!);
    expect(labels()).toEqual(["Open modal", "Copy Image", "Download Image"]);
    await click(item("Open modal"));
    await Wait.until(() => expect(viewer()?.querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("shot.png"));
    await click(viewer()!.querySelector<HTMLButtonElement>(".nol-teamrun-image-close")!);
    await Wait.until(() => expect(viewer()).toBeNull());
    expect([context.openedDocuments.length, document.activeElement]).toEqual([1, frames()[0]]);
  });

  it("hides the image's tooltip when its menu opens the popup, so the first Escape closes the popup", async () => {
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    await prepare();
    await render();
    await pick([imageFile("shot.png")]);
    await Wait.until(() => expect(previews()).toHaveLength(1));
    const viewer = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-image-viewer");

    const frame = frames()[0]!;
    try {
      await userEvent.hover(frame);
      await Wait.until(() => expect(document.querySelector("nol-tooltip")?.textContent?.trim()).toBe("shot.png"));
      await openImageMenu(frame);
      await click(item("Open modal"));
      await Wait.until(() => expect(viewer()?.querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("shot.png"));
      expect(document.querySelector("nol-tooltip")).toBeNull();
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await Wait.until(() => expect(viewer()).toBeNull());
      expect(document.activeElement).toBe(frame);
    }
    finally {
      await userEvent.unhover(frame);
    }
  });

  it("opens each attached image in its own tab from its menu, even beside another image of the same name", async () => {
    await prepare();
    await render();
    await pick([imageFile("shot.png"), imageFile("shot.png", 4)]);
    await Wait.until(() => expect(previews()).toHaveLength(2));
    const viewer = ImageViewerService.of(context);

    for (const frame of frames()) {
      await openImageMenu(frame);
      await click(item("Open in a new tab"));
    }

    const opened = context.openedDocuments.map(t => viewer.find(t.instance));
    expect(opened.map(t => [t?.name, t?.conversationId, t?.data])).toEqual([["shot.png", "c1", pixels()], ["shot.png", "c1", pixels(4)]]);
    expect(new Set(opened.map(t => t?.key)).size).toBe(2);
    expect(document.querySelector("nol-teamrun-image-viewer")).toBeNull();
  });

  it("downloads an attached image from its menu, and clears a failed copy or download only when the same action next succeeds", async () => {
    await prepare();
    await render();
    const writer = clipboard();
    await pick([imageFile("shot.png")]);
    await Wait.until(() => expect(previews()).toHaveLength(1));
    const run = async (label: string): Promise<void> => {
      await openImageMenu(frames()[0]!);
      await click(item(label));
    };

    await run("Download Image");
    await Wait.until(() => expect(context.savedFiles.map(t => t.name)).toEqual(["shot.png"]));
    expect(alert()).toBeUndefined();

    context.saveOutcome = FileSaveOutcome.Failed;
    await run("Download Image");
    await Wait.until(() => expect(alert()).toBe(Resources.imageSaveFailed));
    let written = nextWrite();
    await run("Copy Image");
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(writer.images).toHaveLength(1);
    expect(alert()).toBe(Resources.imageSaveFailed);

    written = nextWrite(() => Promise.resolve(false));
    await run("Copy Image");
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(alert()).toBe(Resources.imageCopyFailed));
    context.saveOutcome = FileSaveOutcome.Saved;
    await run("Download Image");
    await Wait.until(() => expect(context.savedFiles).toHaveLength(3));
    expect(alert()).toBe(Resources.imageCopyFailed);

    written = nextWrite();
    await run("Copy Image");
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(alert()).toBeUndefined());
  });

  it("holds an attached image's Copy Image while a copy runs, and copies once", async () => {
    await prepare();
    await render();
    const writer = clipboard();
    const answers: ((value: boolean) => void)[] = [];
    const written = nextWrite(() => new Promise<boolean>(resolve => answers.push(resolve)));
    await pick([imageFile("first.png"), imageFile("second.png")]);
    await Wait.until(() => expect(previews()).toHaveLength(2));

    await openImageMenu(frames()[0]!);
    await click(item("Copy Image"));
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(answers).toHaveLength(1);
    await openImageMenu(frames()[1]!);
    expect(item("Copy Image").getAttribute("aria-disabled") === "true").toBe(true);
    await click(item("Copy Image"));
    expect([writer.images.length, alert()]).toEqual([1, undefined]);

    answers[0]!(true);
    await Wait.until(() => expect(ImageViewerService.of(context).copying()).toBe(false));
    await openImageMenu(frames()[1]!);
    expect(item("Copy Image").getAttribute("aria-disabled") === "true").toBe(false);
  });

  describe("the unsent message", () => {
    const drafted = (conversationId: string, text: string, attachments: readonly MessageAttachment[] = [], missing: readonly string[] = [],
      revision: number = 2): JsonValue => new Draft(conversationId, text, attachments, missing, revision, SampleData.timestamp).toJson();
    const saves = (): DraftSaveParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DraftSave))
      .map(t => DraftSaveParams.fromJson(t.parameters));
    const notes = new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/notes.txt");
    const saveStep = (): (() => Promise<void>) => [...context.saves].at(-1)!;
    const picture = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");
    const photo = new MessageAttachment("photo.png", "image/png", 5, "D:/data/attachments/drafts/c1/photo.png");
    const shareBack = (attachment: MessageAttachment, data: string = pixels()): JsonValue => context.share(Resources.formatDataUrl(attachment.mediaType, data));
    const reads = (): AttachmentReadParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.AttachmentShare))
      .map(t => AttachmentReadParams.fromJson(t.parameters));
    const released = (dispose: { readonly mock: { readonly contexts: readonly unknown[] } }): (string | null)[][] =>
      dispose.mock.contexts.map(t => t as ComposerAttachment).map(t => [t.name, t.previewUrl()]);

    beforeEach(() => context.answer(MethodName.MessageSend, answered));

    it("saves what is typed, the latest text once, with the files beside it", async () => {
      await prepare();
      await render();
      await pick([new File(["a"], "notes.txt", { type: "text/plain" })]);

      await type("hel");
      await type("hello");
      await saveStep()();

      expect(saves().map(t => t.text)).toEqual(["hello"]);
      expect(saves()[0]?.conversationId).toBe("c1");
      expect(saves()[0]?.attachments.map(t => t.name)).toEqual(["notes.txt"]);
    });

    it("drops the unsent message of its chat once another window deletes it, so the save as its forgotten tab closes writes nothing", async () => {
      await prepare();
      await render();
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c3").toJson());
      await type("hello");
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
      await saveStep()();

      await type("hello again");
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      await saveStep()();

      expect(saves().map(t => t.text)).toEqual(["hello"]);
      expect(context.noticeText()).toBeNull();
      expect(context.forgottenDocuments.map(t => t.instance)).toEqual(["c3", "c2", "c1"]);
    });

    it("ends a save under way when its chat is deleted with no error, and doesn't save it again", async () => {
      const held = new DeferredResponse();
      context.answer(MethodName.DraftSave, () => held.promise.then(() => {
        throw Object.assign(new Error("Conversation c1 was not found."), { code: ErrorCode.NotFound, details: { error: ErrorCode.NotFound, arguments: ["c1"] } });
      }));
      await prepare();
      await render();
      await type("hello");
      const saving = saveStep()();
      await Wait.until(() => expect(context.count(MethodName.DraftSave)).toBe(1));

      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      held.resolve(null);
      await saving;
      await saveStep()();

      expect(context.count(MethodName.DraftSave)).toBe(1);
      expect(context.noticeText()).toBeNull();
    });

    it("brings back a conversation's unsent text and files when it opens, and sends the files by their stored paths", async () => {
      context.answer(MethodName.DraftRead, () => drafted("c1", "where were we", [notes]));
      await prepare();
      await render();

      expect(box().value).toBe("where were we");
      expect([...rows()].map(t => t.textContent)).toEqual([expect.stringContaining("notes.txt")]);
      await send();

      expect(AttachmentInput.fromJson(context.parametersOf(MethodName.AttachmentPrepare)!).path).toBe(notes.path);
      expect(sent()[0]?.text).toBe("where were we");
      await Wait.until(() => expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 2 }));
      expect(box().value).toBe("");
    });

    it("reads its chat's unsent message again, with no error, when another window saved a newer one, and bases its next save on that one", async () => {
      const more = new MessageAttachment("more.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/more.txt");
      context.answer(MethodName.DraftRead, () => drafted("c1", "where were we", [notes]));
      await prepare();
      await render();
      context.refuse(MethodName.DraftSave, ErrorCode.Conflict, "The draft changed.", "c1")
        .answer(MethodName.DraftRead, () => drafted("c1", "where we are now", [notes, more], [], 4));

      await type("where were we?");
      await saveStep()();
      await Wait.until(() => expect(box().value).toBe("where we are now"));

      expect([...rows()].map(t => t.textContent)).toEqual([expect.stringContaining("notes.txt"), expect.stringContaining("more.txt")]);
      expect(context.noticeText()).toBeNull();
      context.answer(MethodName.DraftSave, t => SampleData.savedDraft(DraftSaveParams.fromJson(t), 5).toJson());
      await type("where we are now!");
      await saveStep()();
      expect(saves().map(t => [t.text, t.revision])).toEqual([["where were we?", 2], ["where we are now!", 4]]);
    });

    describe("sent while it saves", () => {
      const prepares = (): [boolean, string | null][] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.AttachmentPrepare))
        .map(t => AttachmentInput.fromJson(t.parameters)).map(t => [!Object.isNull(t.grant), t.path]);

      it("waits for the save under way and sends a new file once, by the path that save stored", async () => {
        const held = new DeferredResponse();
        context.answer(MethodName.DraftSave, t => held.promise.then(() => SampleData.savedDraft(DraftSaveParams.fromJson(t), 3).toJson()));
        await prepare();
        await render();
        await pick([new File(["a"], "notes.txt", { type: "text/plain" })]);
        await type("hello");
        const saving = saveStep()();
        await Wait.until(() => expect(context.count(MethodName.DraftSave)).toBe(1));

        await send();
        expect(sent()).toEqual([]);
        held.resolve(null);
        await saving;
        await Wait.until(() => expect(sent()).toHaveLength(1));

        expect(prepares()).toEqual([[true, null], [false, "D:/data/attachments/drafts/c1/notes.txt"]]);
        expect(sent()[0]?.attachments.map(t => t.name)).toEqual(["notes.txt"]);
      });

      it("still sends a new file from its data when the save it waits for fails, and says the save failed", async () => {
        context.fail(MethodName.DraftSave, "disk full");
        await prepare();
        await render();
        await pick([new File(["a"], "notes.txt", { type: "text/plain" })]);
        await type("hello");

        await send();
        await Wait.until(() => expect(sent()).toHaveLength(1));

        expect(prepares()).toEqual([[true, null], [true, null]]);
        expect(sent()[0]?.attachments.map(t => t.name)).toEqual(["notes.txt"]);
        expect(context.noticeText()).toBe(Resources.formatDraftNotSaved("disk full"));
      });
    });

    it("saves a chosen teammate as a mention by its id, and shows it as one again when the chat opens anew", async () => {
      new TeammateFixture(context);
      await prepare();
      await render();
      await type("Ask @Ali");
      await Wait.until(() => expect(names()).toContain("Alice"));
      await key("Enter");
      await saveStep()();
      const saved = MentionValue.parse(saves()[0]!.text);
      fixture.destroy();
      context.answer(MethodName.DraftRead, () => drafted("c1", saves()[0]!.text));
      await render();

      expect([saved.text.trimEnd(), saved.chips.map(t => [t.id, t.text])]).toEqual(["Ask @Alice", [["alice", "@Alice"]]]);
      await Wait.until(() => expect(box().value).toBe(saved.text));
      expect([...document.querySelectorAll(".nol-mention-chip")].map(t => t.textContent?.trim())).toEqual(["@Alice"]);
    });

    describe("after a rewind", () => {
      const file = new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/c1/notes.txt");
      const asked = new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed,
        [SampleData.detail(0, DetailKind.Text, "first"), SampleData.detail(1, DetailKind.Text, "second")], null, SampleData.timestamp, null, SampleData.timestamp, [file]);
      const rewound = "first\n\nsecond";
      const title = (): string | null | undefined => document.querySelector(".nol-dialog-title")?.textContent;

      beforeEach(() => {
        context.answer(MethodName.MessagePage, () => SampleData.page([asked, SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false).toJson());
        context.answer(MethodName.ConversationRewind, () => new ConversationRewindResult(SampleData.conversation, ["m1", "m2"], null).toJson());
      });

      it("puts the rewound message's text and files in an empty composer, focused, and keeps them as the unsent message", async () => {
        const store = await prepare();
        await render();

        await store.rewind(asked, false);
        await fixture.whenStable();

        expect(box().value).toBe(rewound);
        expect([...rows()].map(t => t.textContent)).toEqual([expect.stringContaining("notes.txt")]);
        expect(document.activeElement).toBe(box());
        expect(store.rewoundDraft()).toBeNull();
        expect(title()).toBeUndefined();
        await saveStep()();

        expect(saves().map(t => [t.conversationId, t.text, t.attachments.map(u => u.path)])).toEqual([["c1", rewound, [file.path]]]);
      });

      it("puts a rewound mention back as the plain text the composer sent it as", async () => {
        new TeammateFixture(context);
        const mentioned = new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed,
          [SampleData.detail(0, DetailKind.Text, "Ask @Alice")], null, SampleData.timestamp, null, SampleData.timestamp, [], null, null, [new TeammateMention("alice", "Alice")]);
        context.answer(MethodName.MessagePage, () => SampleData.page([mentioned, SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false).toJson());
        const store = await prepare();
        await render();

        await store.rewind(mentioned, false);
        await fixture.whenStable();

        expect([box().value, document.querySelectorAll(".nol-mention-chip").length]).toEqual(["Ask @Alice", 0]);
        await saveStep()();
        expect(saves().map(t => t.text)).toEqual(["Ask @Alice"]);
      });

      it.each([
        { answer: "Close", button: ".nol-teamrun-cancel", kept: "mine" },
        { answer: "Replace", button: ".nol-teamrun-confirm", kept: rewound }
      ])("asks before it puts the rewound message over a typed one, and $answer leaves $kept", async ({ button, kept }) => {
        const store = await prepare();
        await render();
        await type("mine");

        await store.rewind(asked, false);
        await fixture.whenStable();

        expect(title()).toBe(Resources.replaceDraftTitle);
        expect(document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()).toBe(Resources.replaceDraftLabel);
        expect(document.querySelector(".nol-teamrun-confirm")?.classList).toContain("nol-button-danger");
        expect(box().value).toBe("mine");
        expect(store.rewoundDraft()).toBeNull();

        document.querySelector<HTMLButtonElement>(button)?.click();
        await fixture.whenStable();

        expect(title()).toBeUndefined();
        expect(box().value).toBe(kept);
      });

      it("asks before it puts the rewound message over a file alone, and Replace lets that file go", async () => {
        const store = await prepare();
        await render();
        await pick([new File(["a"], "mine.txt", { type: "text/plain" })]);
        const dispose = vi.spyOn(ComposerAttachment.prototype, "dispose");

        await store.rewind(asked, false);
        await fixture.whenStable();

        expect(title()).toBe(Resources.replaceDraftTitle);
        document.querySelector<HTMLButtonElement>(".nol-teamrun-confirm")?.click();
        await fixture.whenStable();

        expect(released(dispose)).toEqual([["mine.txt", null]]);
        expect([...rows()].map(t => t.textContent)).toEqual([expect.stringContaining("notes.txt")]);
      });

      it("shows a rewound image's thumbnail, read from the unsent message it saves first", async () => {
        const shot = new MessageAttachment("shot.png", "image/png", 5, "D:/data/attachments/c1/shot.png");
        const pictured = new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed,
          [SampleData.detail(0, DetailKind.Text, "look")], null, SampleData.timestamp, null, SampleData.timestamp, [shot]);
        context.answer(MethodName.AttachmentShare, t => {
          if (!AttachmentReadParams.fromJson(t).path.startsWith("D:/data/attachments/drafts/"))
            throw new Error("The attachment is not found.");
          return shareBack(shot);
        });
        const store = await prepare();
        await render();

        await store.rewind(pictured, false);

        await Wait.until(() => expect(previews()[0]?.getAttribute("src")).toBe(`data:image/png;base64,${pixels()}`));
        expect(reads()).toEqual([new AttachmentReadParams("c1", "D:/data/attachments/drafts/c1/shot.png")]);
      });

      it("holds the rewound message while a send prepares its files, and puts it in the composer that send empties", async () => {
        const preparation = new DeferredResponse();
        context.answer(MethodName.AttachmentPrepare, () => preparation.promise);
        const store = await prepare();
        await render();
        await type("mine");
        await pick([new File(["a"], "mine.txt", { type: "text/plain" })]);
        await send();
        await Wait.until(() => expect(context.count(MethodName.AttachmentPrepare)).toBe(1));

        await store.rewind(asked, false);
        await fixture.whenStable();

        expect(title()).toBeUndefined();
        expect(box().value).toBe("mine");
        preparation.resolve(new MessageAttachment("mine.txt", "text/plain", 1, "D:/data/attachments/prepared/mine.txt").toJson());
        await Wait.until(() => expect(box().value).toBe(rewound));
        expect(title()).toBeUndefined();
        expect([...rows()].map(t => t.textContent)).toEqual([expect.stringContaining("notes.txt")]);
      });

      it("keeps the rewound message for its own conversation until the composer shows it", async () => {
        const store = await prepare();
        await render("c2");

        await store.rewind(asked, false);
        await fixture.whenStable();

        expect(box().value).toBe("");
        expect(store.rewoundDraft()?.text).toBe(rewound);

        fixture.componentRef.setInput("conversationId", "c1");
        await Wait.until(() => expect(box().value).toBe(rewound));
        expect(store.rewoundDraft()).toBeNull();
      });

      it("puts nothing in the composer when the person switched away before Replace", async () => {
        const store = await prepare();
        await render();
        await type("mine");
        await store.rewind(asked, false);
        await fixture.whenStable();

        fixture.componentRef.setInput("conversationId", "c2");
        await Wait.until(() => expect(box().value).toBe(""));
        document.querySelector<HTMLButtonElement>(".nol-teamrun-confirm")?.click();
        await fixture.whenStable();

        expect(box().value).toBe("");
      });
    });

    it("previews a restored image at the address of its share, and keeps one it can't share or load as a file row beside the rest of the draft", async () => {
      const gone = new MessageAttachment("gone.png", "image/png", 5, "D:/data/attachments/drafts/c1/gone.png");
      const refused = new MessageAttachment("refused.webp", "image/webp", 5, "D:/data/attachments/drafts/c1/refused.webp");
      const broken = new MessageAttachment("broken.jpg", "image/jpeg", 5, "D:/data/attachments/drafts/c1/broken.jpg");
      const failures = new Map([[gone.path, { code: ErrorCode.NotFound, message: "The attachment is gone." }],
        [refused.path, { code: ErrorCode.InvalidParams, message: "The attachment isn't one of the conversation's." }]]);
      const data = pixels();
      context.answer(MethodName.DraftRead, () => drafted("c1", "look", [picture, gone, notes, refused, broken]))
        .answer(MethodName.AttachmentShare, t => {
          const path = AttachmentReadParams.fromJson(t).path;
          const failure = failures.get(path);
          if (path === broken.path)
            return shareBack(broken, "AAAA");
          return Object.isUndefined(failure) ? shareBack(picture, data) : Promise.reject(Object.assign(new Error(failure.message), { code: failure.code }));
        });
      const failed = new Promise<void>(resolve => {
        const listen = (event: Event): void => {
          if (event.target instanceof HTMLImageElement && event.target.src === "data:image/jpeg;base64,AAAA")
            resolve();
        };
        document.addEventListener("error", listen, { capture: true });
        onTestFinished(() => document.removeEventListener("error", listen, { capture: true }));
      });
      await prepare();
      await render();
      await Wait.settled(failed, "the broken image's load error");

      await Wait.until(() => expect([previews().map(t => t.src), fileNames()]).toEqual([[`data:image/png;base64,${data}`], [null, "gone.png", "notes.txt", "refused.webp", "broken.jpg"]]));
      const grantOf = (url: string): string | undefined => [...context.fileAddresses].find(([, t]) => t === url)?.[0];
      expect(previews()[0]?.alt).toBe("picture.png");
      expect(rows()[0]?.classList).toContain("nol-teamrun-composer-image");
      expect(reads()).toEqual([picture, gone, refused, broken].map(t => new AttachmentReadParams("c1", t.path)));
      expect(context.discardedGrants).toEqual([grantOf("data:image/jpeg;base64,AAAA")]);
      expect(context.methods).not.toContain(FakeWindowPartContext.qualify(MethodName.AttachmentRead));
      expect(box().value).toBe("look");
      expect(alert()).toBeUndefined();
    });

    it("keeps the field open and shows the text and the other files while a restored image is read", async () => {
      const response = new DeferredResponse();
      context.answer(MethodName.DraftRead, () => drafted("c1", "look", [picture, notes])).answer(MethodName.AttachmentShare, () => response.promise);
      await prepare();
      await render();

      expect(box().readOnly).toBe(false);
      expect(box().value).toBe("look");
      expect(fileNames()).toEqual(["picture.png", "notes.txt"]);
      expect(reads()).toHaveLength(1);
      response.resolve(shareBack(picture));

      await Wait.until(() => expect(previews().map(t => t.alt)).toEqual(["picture.png"]));
      expect(fileNames()).toEqual([null, "notes.txt"]);
    });

    it("opens a restored image in the viewer from its saved file, which the viewer shares by its path", async () => {
      context.answer(MethodName.DraftRead, () => drafted("c1", "look", [picture])).answer(MethodName.AttachmentShare, () => shareBack(picture));
      await prepare();
      await render();
      await Wait.until(() => expect(previews()).toHaveLength(1));
      const viewer = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-image-viewer");

      await click(frames()[0]!);

      await Wait.until(() => expect(viewer()?.querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("picture.png"));
      expect(reads()).toEqual([picture, picture].map(t => new AttachmentReadParams("c1", t.path)));
      expect(context.methods).not.toContain(FakeWindowPartContext.qualify(MethodName.AttachmentRead));
      await click(viewer()!.querySelector<HTMLButtonElement>(".nol-teamrun-image-close")!);
      await Wait.until(() => expect(viewer()).toBeNull());
    });

    it("releases a restored image's preview when it is removed or sent", async () => {
      const dispose = vi.spyOn(ComposerAttachment.prototype, "dispose");
      context.answer(MethodName.DraftRead, () => drafted("c1", "look", [picture, photo]))
        .answer(MethodName.AttachmentShare, t => shareBack(AttachmentReadParams.fromJson(t).path === picture.path ? picture : photo));
      await prepare();
      await render();
      await Wait.until(() => expect(previews()).toHaveLength(2));

      await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-remove")!);
      expect(released(dispose)).toEqual([["picture.png", null]]);
      expect(previews().map(t => t.alt)).toEqual(["photo.png"]);
      await send();

      await Wait.until(() => expect(released(dispose)).toEqual([["picture.png", null], ["photo.png", null]]));
      expect(previews()).toHaveLength(0);
      expect(context.discardedGrants.toSorted()).toEqual([...context.fileAddresses.keys()].toSorted());
      expect(context.discardedGrants).toHaveLength(2);
    });

    it("releases the previews of the conversation it leaves, drops one read after it, and releases the shown ones when the composer goes", async () => {
      const dispose = vi.spyOn(ComposerAttachment.prototype, "dispose");
      const late = new DeferredResponse();
      const other = new MessageAttachment("other.png", "image/png", 5, "D:/data/attachments/drafts/c2/other.png");
      context.answer(MethodName.DraftRead, t => ConversationIdParams.fromJson(t).conversationId === "c1"
        ? drafted("c1", "", [picture, photo]) : drafted("c2", "", [other]))
        .answer(MethodName.AttachmentShare, t => AttachmentReadParams.fromJson(t).path === photo.path ? late.promise : shareBack(picture));
      await prepare();
      await render();
      await Wait.until(() => expect(previews().map(t => t.alt)).toEqual(["picture.png"]));

      fixture.componentRef.setInput("conversationId", "c2");
      await fixture.whenStable();
      late.resolve(shareBack(photo));
      await Wait.until(() => expect(context.discardedGrants).toHaveLength(2));
      expect(previews().map(t => t.alt)).toEqual(["other.png"]);

      expect(released(dispose)).toEqual([["picture.png", null], ["photo.png", null]]);
      expect(reads().at(-1)).toEqual(new AttachmentReadParams("c2", other.path));
      fixture.destroy();
      expect(released(dispose)).toEqual([["picture.png", null], ["photo.png", null], ["other.png", null]]);
      expect(context.discardedGrants.toSorted()).toEqual([...context.fileAddresses.keys()].toSorted());
      expect(context.discardedGrants).toHaveLength(3);
    });

    it("shows a new and a restored image under the desktop window's image policy, which refuses blob URLs", async () => {
      const frame = document.body.appendChild(document.createElement("iframe"));
      onTestFinished(() => frame.remove());
      const opened = new Promise(resolve => frame.addEventListener("load", resolve, { once: true }));
      frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="img-src 'self' data: desktop-file:">`;
      await opened;
      const decode = async (src: string): Promise<number[]> => {
        const image = frame.contentDocument!.createElement("img");
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      };
      const blob = URL.createObjectURL(imageFile("blob.png"));
      await expect(decode(blob)).rejects.toThrow();
      URL.revokeObjectURL(blob);
      context.answer(MethodName.DraftRead, () => drafted("c1", "", [picture])).answer(MethodName.AttachmentShare, () => shareBack(picture));
      await prepare();
      await render();

      await pick([imageFile("new.png")]);
      await Wait.until(() => expect(previews().map(t => t.alt)).toEqual(["picture.png", "new.png"]));

      expect(await Promise.all(previews().map(t => decode(t.src)))).toEqual([[3, 2], [3, 2]]);
    });

    it("says which files of the unsent message are gone", async () => {
      context.answer(MethodName.DraftRead, () => drafted("c1", "hello", [], ["gone.txt", "old.png"]));
      await prepare();
      await render();

      expect(alert()).toBe(Resources.formatDraftFilesMissing(["gone.txt", "old.png"]));
      expect(box().value).toBe("hello");
    });

    it("says when the unsent message could not be read, and keeps nothing written there over it", async () => {
      context.answer(MethodName.DraftRead, t => ConversationIdParams.fromJson(t).conversationId === "c1"
        ? Promise.reject(new Error("unreadable")) : Promise.reject("offline"));
      await prepare();
      await render();

      expect(alert()).toBe(Resources.formatDraftUnreadable("unreadable"));
      expect(box().readOnly).toBe(false);
      await type("hello");
      await saveStep()();
      expect(context.count(MethodName.DraftSave)).toBe(0);

      fixture.componentRef.setInput("conversationId", "c2");
      await fixture.whenStable();
      expect(alert()).toBe(Resources.formatDraftUnreadable("offline"));
    });

    it("keeps the field closed and takes no files until the unsent message is read", async () => {
      const response = new DeferredResponse();
      context.answer(MethodName.DraftRead, () => response.promise);
      await prepare();
      fixture = TestBed.createComponent(ComposerComponent);
      fixture.componentRef.setInput("conversationId", "c1");
      fixture.detectChanges();

      expect(box().readOnly).toBe(true);
      const input = root().querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      if (input !== null) {
        Object.defineProperty(input, "files", { value: [new File(["a"], "early.txt")], configurable: true });
        input.dispatchEvent(new Event("change"));
      }
      fixture.detectChanges();
      expect(rows()).toHaveLength(0);
      response.resolve(drafted("c1", "hello"));
      await fixture.whenStable();

      expect(box().readOnly).toBe(false);
      expect(box().value).toBe("hello");
    });

    it("holds a focus the Focus the composer command asks for while the unsent message is read, and takes it once the field opens", async () => {
      const response = new DeferredResponse();
      context.answer(MethodName.DraftRead, () => response.promise);
      await prepare();
      fixture = TestBed.createComponent(ComposerComponent);
      fixture.componentRef.setInput("conversationId", "c1");
      fixture.detectChanges();
      const targets = CommandTargetsService.of(context);

      expect(targets.canFocusComposer("c1")).toBe(false);
      targets.focusComposer("c1");
      response.resolve(drafted("c1", "hello"));
      await fixture.whenStable();

      await Wait.until(() => expect(document.activeElement).toBe(box()));
      expect(targets.canFocusComposer("c1")).toBe(true);
    });

    it("discards the unsent message when its text is cleared", async () => {
      context.answer(MethodName.DraftRead, () => drafted("c1", "hello", [], [], 5));
      await prepare();
      await render();

      await type("  ");

      await Wait.until(() => expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 5 }));
      expect(context.count(MethodName.DraftSave)).toBe(0);
    });

    it("discards the unsent message when its last file is removed", async () => {
      context.answer(MethodName.DraftRead, () => drafted("c1", "", [notes], [], 3));
      await prepare();
      await render();

      await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-remove")!);

      await Wait.until(() => expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 3 }));
    });

    it("saves nothing of a message sent before its save was due", async () => {
      await prepare();
      await render();

      await type("hello");
      await send();
      await saveStep()();

      expect(sent()[0]?.text).toBe("hello");
      expect(context.count(MethodName.DraftSave)).toBe(0);
      expect(context.count(MethodName.DraftDiscard)).toBe(0);
    });

    it("keeps the unsent message when its send is refused", async () => {
      await prepare();
      await render();
      context.fail(MethodName.MessageSend, "offline");

      await type("hello");
      await send();
      await saveStep()();

      expect(saves().map(t => t.text)).toEqual(["hello"]);

      expect(context.count(MethodName.DraftDiscard)).toBe(0);
      expect(box().value).toBe("hello");
    });

    it("gives the window a save step that saves the pending message before it closes, and takes it back when it goes", async () => {
      await prepare();
      const steps = [...context.saves];
      await render();
      expect(context.saves.size).toBe(steps.length + 1);

      await type("hello");
      await saveStep()();

      expect(saves().map(t => t.text)).toEqual(["hello"]);
      fixture.destroy();
      expect([...context.saves]).toEqual(steps);
    });

    it("saves the pending message when it goes", async () => {
      await prepare();
      await render();

      await type("hello");
      fixture.destroy();

      await Wait.until(() => expect(saves().map(t => t.text)).toEqual(["hello"]));
    });

    it("keeps the window open when the unsent message cannot be saved, and says why", async () => {
      await prepare();
      await render();
      context.fail(MethodName.DraftSave, "disk full");

      await type("hello");

      await expect(saveStep()()).rejects.toThrow(Resources.draftNotSaved);
      expect(context.noticeText()).toBe(Resources.formatDraftNotSaved("disk full"));
    });

    it("saves the conversation it leaves, with its files, and shows the next one's unsent message alone", async () => {
      context.answer(MethodName.DraftRead, t => ConversationIdParams.fromJson(t).conversationId === "c2" ? drafted("c2", "other") : null);
      await prepare();
      await render();

      await pick([new File(["a"], "notes.txt", { type: "text/plain" })]);
      await type("mine");
      fixture.componentRef.setInput("conversationId", "c2");
      await fixture.whenStable();

      expect(saves().map(t => [t.conversationId, t.text, t.attachments.map(u => u.name)])).toEqual([["c1", "mine", ["notes.txt"]]]);
      expect(box().value).toBe("other");
      expect(rows()).toHaveLength(0);
    });

    it("shows the open conversation's unsent message when an earlier one's answers late", async () => {
      const late = new DeferredResponse();
      context.answer(MethodName.DraftRead, t => ConversationIdParams.fromJson(t).conversationId === "c1" ? late.promise : drafted("c2", "other"));
      await prepare();
      fixture = TestBed.createComponent(ComposerComponent);
      fixture.componentRef.setInput("conversationId", "c1");
      fixture.detectChanges();
      fixture.componentRef.setInput("conversationId", "c2");
      fixture.detectChanges();

      late.resolve(drafted("c1", "stale"));
      await fixture.whenStable();

      expect(box().value).toBe("other");
      expect(box().readOnly).toBe(false);
    });

    it("shows the last opening's unsent message when an earlier opening of the same conversation answers after it", async () => {
      const reads: DeferredResponse[] = [];
      context.answer(MethodName.DraftRead, () => {
        const read = new DeferredResponse();
        reads.push(read);
        return read.promise;
      });
      await prepare();
      fixture = TestBed.createComponent(ComposerComponent);
      for (const id of ["c1", "c2", "c1"]) {
        fixture.componentRef.setInput("conversationId", id);
        fixture.detectChanges();
      }
      await Wait.until(() => expect(reads).toHaveLength(3));

      reads[2]!.resolve(drafted("c1", "latest"));
      reads[0]!.resolve(drafted("c1", "first"));
      reads[1]!.resolve(drafted("c2", "other"));
      await fixture.whenStable();

      expect(box().value).toBe("latest");
      expect(box().readOnly).toBe(false);
    });

    it("starts no preview read for an unsent message that comes back after the field is closed", async () => {
      const read = new DeferredResponse();
      context.answer(MethodName.DraftRead, () => read.promise).answer(MethodName.AttachmentShare, () => shareBack(picture));
      const restore = vi.spyOn(ComposerDraftService.prototype, "restore");
      const preview = vi.spyOn(ComposerAttachment.prototype, "loadPreview");
      await prepare();
      fixture = TestBed.createComponent(ComposerComponent);
      fixture.componentRef.setInput("conversationId", "c1");
      fixture.detectChanges();
      await Wait.until(() => expect(restore).toHaveBeenCalledTimes(1));

      fixture.destroy();
      read.resolve(drafted("c1", "look", [picture]));

      await expect(restore.mock.results[0]!.value).resolves.toBeInstanceOf(Draft);
      expect(preview).not.toHaveBeenCalled();
      expect(reads()).toEqual([]);
    });

    it("keeps the files of the conversation it leaves from being removed into the next one's draft while it switches", async () => {
      const held = new DeferredResponse();
      context.answer(MethodName.DraftRead, t => ConversationIdParams.fromJson(t).conversationId === "c2" ? drafted("c2", "other") : null);
      await prepare();
      await render();
      await pick([new File(["a"], "notes.txt", { type: "text/plain" }), new File(["b"], "more.txt", { type: "text/plain" })]);
      await type("mine");
      context.answer(MethodName.DraftSave, () => held.promise);
      const saving = saveStep()();
      await Wait.until(() => expect(saves()).toHaveLength(1));

      fixture.componentRef.setInput("conversationId", "c2");
      fixture.detectChanges();
      const remove = root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-remove")!;
      expect(remove.disabled).toBe(true);
      remove.click();
      held.resolve(SampleData.savedDraft(saves()[0]!, 1).toJson());
      await saving;
      await fixture.whenStable();
      await saveStep()();

      expect(saves().map(t => [t.conversationId, t.text])).toEqual([["c1", "mine"]]);
      expect(box().value).toBe("other");
    });

    it("sends with Enter while an unsent message is being saved", async () => {
      const held = new DeferredResponse();
      const store = await prepare();
      await render();
      await type("hello");
      context.answer(MethodName.DraftSave, () => held.promise);
      const saving = saveStep()();
      await Wait.until(() => expect(saves()).toHaveLength(1));

      expect(store.isBusy()).toBe(false);
      await key("Enter");

      await Wait.until(() => expect(sent().map(t => t.text)).toEqual(["hello"]));
      held.resolve(SampleData.savedDraft(saves()[0]!, 1).toJson());
      await saving;
      await Wait.until(() => expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 1 }));
    });
  });

  describe("for a kind that follows its own configuration", () => {
    const following = new ProviderKind("codex", "Codex", true, true, null, null, false, null, false, null, true, null, SampleData.abilities());
    const listedAs = (name: string): ProviderModel[] => [new ProviderModel("gpt-config", name, "", ["high", "low"], true, null, true, "low"),
      new ProviderModel("gpt-other", "Other", "", ["high", "low"], false, null, true, "high")];
    const reply = (id: string, sequence: number, model: string, effort: string, provider: string | null = "a1"): Message =>
      new Message(id, "c1", sequence, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance(provider,
        new RequestedSettings("codex", null, null), new ObservedSettings("codex", model, effort, null), "s1", false), SampleData.timestamp, SampleData.timestamp, null);
    const end = (message: Message): void => {
      context.emit(EventName.MessageCreated, message.toJson());
      context.emit(EventName.MessageUpdated, SampleData.withStatus(message, MessageStatus.Completed).toJson());
    };
    const catalogRequests = (): ProviderListModelsParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog))
      .map(t => ProviderListModelsParams.fromJson(t.parameters));
    const start = async (): Promise<ChatStoreService> => {
      context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson())
        .answer(MethodName.ProviderList, () => [SampleData.provider.toJson()]).answer(MethodName.TeammateList, () => [])
        .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [following.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(listedAs("Config")));
      const store = await prepare();
      remember(new ComposerSettings("codex", null, null, "a1"));
      await render();
      await ready();
      return store;
    };
    const shows = async (model: string, effort: string): Promise<void> => {
      await Wait.until(() => expect(summary()).toContain(model));
      expect(buttonLabel()?.endsWith(`${Resources.titleSeparator}${effort}`)).toBe(true);
    };

    it("shows the configuration's model and effort in a new chat, and what the chat's last reply reported once it has a thread, by its name", async () => {
      await start();
      await shows("Config", "Low");

      end(reply("r1", 1, "gpt-other", "high"));
      await shows("Other", "High");
      expect(summary()).not.toContain("Config");

      end(reply("r2", 2, "gpt-unlisted", "low"));
      await shows("gpt-unlisted", "Low");
    });

    it("shows the configuration's again once an effort is chosen, and doesn't take another provider's reply for this one's thread", async () => {
      await start();
      end(reply("r0", 1, "gpt-other", "high", "elsewhere"));
      await fixture.whenStable();
      await shows("Config", "Low");

      end(reply("r1", 2, "gpt-other", "low"));
      await shows("Other", "Low");
      await choose("High");
      await shows("Config", "High");
    });

    it("names a teammate's thread's pair on the button once it answers, and the configuration's while no teammate answers and the chat has no thread", async () => {
      const teammates = new TeammateFixture(context);
      teammates.teammates = [teammates.bob];
      teammates.members = [new ConversationMember("c1", "bob", "t", null, false)];
      context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson())
        .answer(MethodName.ProviderList, () => [SampleData.provider.toJson()]).answer(MethodName.ProviderKindList, () => [following.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(listedAs("Config"))).answer(MethodName.MessageSend, answered);
      await prepare();
      remember(new ComposerSettings("codex", null, null, "a1"));
      await render();
      await ready();
      const bobsReply = new Message("r1", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], reply("r1", 1, "gpt-other", "high").provenance, SampleData.timestamp,
        SampleData.timestamp, SampleData.timestamp, [], "bob", "Bob");

      context.emit(EventName.MessageCreated, bobsReply.toJson());
      await shows("Config", "Low");
      await answerAs("Bob");
      await shows("Other", "High");
    });

    it("shows the configuration's in a chat whose session was reset, whatever an earlier reply reported", async () => {
      context.answer(MethodName.ConversationList, () => [new Conversation("c1", "p1", "First", SampleData.timestamp, SampleData.timestamp, true).toJson()]);
      await start();

      end(reply("r1", 1, "gpt-other", "high"));
      await fixture.whenStable();

      await shows("Config", "Low");
    });

    it("asks for the list with the chat's folder, past the cache on focus and at a reply's end, and keeps the list it has when such a reload fails", async () => {
      const store = await start();
      const loads = catalogRequests().length;
      expect(store.folderOf("c1")).not.toBeNull();
      expect(catalogRequests().at(-1)?.workingDirectory).toBe(store.folderOf("c1"));
      let reloads = 0;
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(listedAs(`Config ${++reloads}`)));

      globalThis.dispatchEvent(new Event("focus"));
      await Wait.until(() => expect(summary()).toContain("Config 1"));
      expect(catalogRequests().at(-1)?.refresh).toBe(true);

      end(reply("r1", 1, "gpt-config", "low"));
      await Wait.until(() => expect(summary()).toContain("Config 2"));
      expect(catalogRequests().at(-1)?.refresh).toBe(true);

      context.answer(MethodName.ProviderModelCatalog, () => Promise.reject(new Error("no list")));
      globalThis.dispatchEvent(new Event("focus"));
      await Wait.until(() => expect(catalogRequests().length).toBe(loads + 3));
      await store.modelCatalogs.load("codex", "a1", true, store.folderOf("c1"));
      await choose();

      expect(items().some(t => String(t.textContent).includes("Other"))).toBe(true);
      expect(item(Resources.modelCatalogUnavailable)).toBeUndefined();
    });
  });

  describe("when no reply can start", () => {
    const hint = (): string | undefined => root().querySelector(".nol-teamrun-composer-unavailable nol-field-message")?.textContent?.trim();
    const hinted = (): Element | null => root().querySelector(".nol-teamrun-composer-unavailable");
    const grok = new ProviderKind("grok", "Grok", false);
    const loggedOut = new Provider("a1", "codex", "Work", "D:\\profiles\\codex", AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null,
      SampleData.timestamp);

    it("says the chosen provider isn't signed in, opens the Providers tab from its Providers button, and clears once the provider signs in", async () => {
      context.answer(MethodName.ProviderList, () => [loggedOut.toJson()]);
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
      await render();
      await ready();

      expect(hint()).toBe("Codex isn't signed in. Choose Providers to connect one.");
      expect(root().querySelector(".nol-teamrun-composer-manage")?.textContent?.trim()).toBe("Providers");
      await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-manage")!);
      expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.providers", "providers", "Providers"]]);
      expect(context.dialogs).toEqual([]);

      context.emit(EventName.ProviderUpdated, SampleData.provider.toJson());
      await fixture.whenStable();
      expect(hinted()).toBeNull();
    });

    it("says the chosen provider can't list its models, and clears once they load", async () => {
      context.fail(MethodName.ProviderModelCatalog, "not signed in");
      await prepare();
      await render();
      await Wait.until(() => expect(hint()).toBe(Resources.formatProviderModelsUnavailable("Codex")));

      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT5", "", ["high"], true, null, true)]));
      await refreshModels();
      await ready();
      expect(hinted()).toBeNull();
    });

    it("asks for a provider, with Send off and no model list asked for, while the chat's kind has none, and offers Add provider in its place", async () => {
      context.answer(MethodName.ProviderList, () => []).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null);
      await prepare();
      await render();
      await ready();
      await type("hello");

      expect(hint()).toBe(Resources.formatProviderNeeded("Codex"));
      expect(sendButton()?.disabled).toBe(true);
      expect(picker().disabled).toBe(false);
      expect(context.count(MethodName.ProviderModelCatalog)).toBe(0);
      await chooseProvider();
      expect(menuLabels()).toEqual([Resources.kindLabel, Resources.addProviderLabel]);
      await click(item(Resources.addProviderLabel));
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-provider-name")).not.toBeNull());
      expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.addProviderLabel);
      document.querySelector<HTMLInputElement>(".nol-teamrun-existing-folder input[type=radio]")!.click();
      await fixture.whenStable();
      document.querySelector<HTMLButtonElement>(".nol-teamrun-choose-folder")!.click();
      await Wait.until(() => expect(context.folderChoices).toBe(1));
      document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
      await fixture.whenStable();

      context.emit(EventName.ProviderUpdated, SampleData.provider.toJson());
      await Wait.until(() => expect(hinted()).toBeNull());
      expect(summary()).toContain("Codex · Work · This computer");
      await Wait.until(() => expect(sendButton()?.disabled).toBe(false));
    });

    it.each([SampleData.codex, SampleData.claude, grok])(
      "says $displayName on its provider isn't signed in before a send when its model list says so, and clears once it says signed in", async kind => {
        const models = [new ProviderModel("model", "Model", "", null, true, null, true)];
        context.answer(MethodName.ProviderList, () => [providerOf(kind.id).toJson()]).answer(MethodName.TeammateList, () => [])
          .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), grok.toJson()])
          .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models, false));
        await prepare();
        remember(new ComposerSettings(kind.id, null, null, `${kind.id}-1`));
        await render();
        await ready();

        expect(hint()).toBe(Resources.formatProviderNotSignedIn(kind.displayName));
        expect(context.parametersOf(MethodName.ProviderModelCatalog)).toEqual({ kind: kind.id, providerId: `${kind.id}-1`, refresh: false });
        expect(sent()).toEqual([]);

        context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models, true));
        await refreshModels();
        await ready();
        expect(hinted()).toBeNull();
      });

    it("offers Add a provider instead of Providers when no provider is added yet, which opens the Providers tab with no dialog", async () => {
      context.answer(MethodName.ProviderList, () => []).answer(MethodName.TeammateList, () => []).answer(MethodName.DefaultTeammateRead, () => null)
        .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("model", "Model", "", null, true, null, true)], false))
        .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", false, null, "curl -fsSL https://chatgpt.com/codex/install.sh | sh").toJson()]);
      await prepare();
      remember(new ComposerSettings(SampleData.codex.id, null, null, null));
      await render();
      await ready();

      expect(root().querySelector(".nol-teamrun-composer-manage")).toBeNull();
      expect(root().querySelector(".nol-teamrun-composer-add-provider")?.textContent?.trim()).toBe(Resources.addAProviderLabel);
      await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-add-provider")!);

      expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.providers", "providers", "Providers"]]);
      expect(document.querySelector(".nol-dialog-title")).toBeNull();
    });

    it("reloads a signed-out model list when the window regains focus, and only while it says signed out", async () => {
      const models = [new ProviderModel("model", "Model", "", null, true, null, true)];
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson()]).answer(MethodName.TeammateList, () => [])
        .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models, false));
      await prepare();
      remember(new ComposerSettings(SampleData.codex.id, null, null, null));
      await render();
      await ready();
      const loads = context.count(MethodName.ProviderModelCatalog);
      expect(hint()).toBe(Resources.formatProviderNotSignedIn(SampleData.codex.displayName));

      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models, true));
      globalThis.dispatchEvent(new Event("focus"));
      await Wait.until(() => expect(context.count(MethodName.ProviderModelCatalog)).toBe(loads + 1));
      await ready();
      await Wait.until(() => expect(hinted()).toBeNull());

      globalThis.dispatchEvent(new Event("focus"));
      await fixture.whenStable();
      await ready();
      expect(context.count(MethodName.ProviderModelCatalog)).toBe(loads + 1);
    });

    it("keeps Send enabled and the settings idle while a focus reload of a signed-out model list runs", async () => {
      const models = [new ProviderModel("model", "Model", "", null, true, null, true)];
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson()]).answer(MethodName.TeammateList, () => [])
        .answer(MethodName.DefaultTeammateRead, () => null).answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models, false));
      await prepare();
      remember(new ComposerSettings(SampleData.codex.id, null, null, null));
      await render();
      await ready();
      await type("hello");
      const loads = context.count(MethodName.ProviderModelCatalog);
      const reload = new DeferredResponse();
      context.answer(MethodName.ProviderModelCatalog, () => reload.promise);

      globalThis.dispatchEvent(new Event("focus"));
      await Wait.until(() => expect(context.count(MethodName.ProviderModelCatalog)).toBe(loads + 1));
      await fixture.whenStable();
      expect(sendButton()?.disabled).toBe(false);
      expect(loading().textContent).toBe("");

      reload.resolve(SampleData.catalog(models, true));
      await Wait.until(() => expect(hinted()).toBeNull());
      expect(sendButton()?.disabled).toBe(false);
    });

    it("shows nothing while the providers load, says so when they can't, and loads them again from Retry", async () => {
      const kinds = new DeferredResponse();
      context.answer(MethodName.ProviderKindList, () => kinds.promise.then(() => {
        throw new Error("offline");
      }));
      configure();
      const store = ChatStoreService.of(context);
      await render();
      expect(hinted()).toBeNull();

      kinds.resolve(null);
      await Wait.until(() => expect(store.kindsFailed()).toBe(true));
      await fixture.whenStable();
      expect(hint()).toBe(Resources.kindsUnavailable);

      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()]);
      await click(root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!);
      await Wait.until(() => expect(store.loaded()).toBe(true));
      await fixture.whenStable();
      expect(store.kindsFailed()).toBe(false);
      expect(hinted()).toBeNull();
      expect(document.activeElement).not.toBe(box());
    });

    it("marks Retry disabled while it loads the providers again, keeps the focus on it, asks nothing on a second click, and takes it once they fail again", async () => {
      context.fail(MethodName.ProviderKindList, "offline");
      configure();
      const store = ChatStoreService.of(context);
      await render();
      await Wait.until(() => expect(hint()).toBe(Resources.kindsUnavailable));
      const retry = (): HTMLButtonElement => root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!;
      const kinds = new DeferredResponse();
      context.answer(MethodName.ProviderKindList, () => kinds.promise.then(() => {
        throw new Error("still offline");
      }));
      const asked = context.count(MethodName.ProviderKindList);

      retry().focus();
      await click(retry());
      expect([retry().getAttribute("aria-disabled"), retry().disabled, document.activeElement === retry()]).toEqual(["true", false, true]);
      await click(retry());
      expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);

      kinds.resolve(null);
      await Wait.until(() => expect(retry().getAttribute("aria-disabled")).toBe("false"));
      expect(store.kindsFailed()).toBe(true);
      expect(document.activeElement).toBe(retry());
      expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);
    });

    it("moves the focus from Retry to the message field once the providers load and its row goes", async () => {
      context.fail(MethodName.ProviderKindList, "offline");
      configure();
      const store = ChatStoreService.of(context);
      await render();
      await Wait.until(() => expect(hint()).toBe(Resources.kindsUnavailable));
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()]);
      const retry = root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!;

      retry.focus();
      await click(retry);
      await Wait.until(() => expect(store.kindsFailed()).toBe(false));
      await fixture.whenStable();

      expect(retry.isConnected).toBe(false);
      expect(document.activeElement).toBe(box());
    });

    it("leaves the focus where the person moved it while Retry's load ran, once the providers load and its row goes", async () => {
      context.fail(MethodName.ProviderKindList, "offline");
      configure();
      const store = ChatStoreService.of(context);
      await render();
      await Wait.until(() => expect(hint()).toBe(Resources.kindsUnavailable));
      const kinds = new DeferredResponse();
      context.answer(MethodName.ProviderKindList, () => kinds.promise.then(() => [SampleData.codex.toJson()]));
      const retry = root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!;
      const elsewhere = document.body.appendChild(document.createElement("button"));
      onTestFinished(() => elsewhere.remove());

      retry.focus();
      await click(retry);
      elsewhere.focus();
      kinds.resolve(null);
      await Wait.until(() => expect(store.kindsFailed()).toBe(false));
      await fixture.whenStable();

      expect(retry.isConnected).toBe(false);
      expect(document.activeElement).toBe(elsewhere);
    });

    it("moves the focus from Retry to the message field when a load Retry didn't start makes its row go", async () => {
      context.fail(MethodName.ProviderKindList, "offline");
      configure();
      const store = ChatStoreService.of(context);
      await render();
      await Wait.until(() => expect(hint()).toBe(Resources.kindsUnavailable));
      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()]);
      const retry = root().querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!;

      retry.focus();
      await store.initialize();
      await fixture.whenStable();

      expect(retry.isConnected).toBe(false);
      expect(document.activeElement).toBe(box());
    });

    it("marks every chat's Retry disabled while one of them loads the window's providers again", async () => {
      context.fail(MethodName.ProviderKindList, "offline");
      configure();
      const store = ChatStoreService.of(context);
      await render();
      const other = TestBed.createComponent(ComposerComponent);
      other.componentRef.setInput("conversationId", "c2");
      await other.whenStable();
      await Wait.until(() => expect(hint()).toBe(Resources.kindsUnavailable));
      const retryOf = (target: ComponentFixture<ComposerComponent>): HTMLButtonElement =>
        (target.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(".nol-teamrun-composer-retry")!;
      const kinds = new DeferredResponse();
      context.answer(MethodName.ProviderKindList, () => kinds.promise.then(() => {
        throw new Error("still offline");
      }));
      const asked = context.count(MethodName.ProviderKindList);

      await click(retryOf(fixture));
      await other.whenStable();
      expect([retryOf(fixture), retryOf(other)].map(t => t.getAttribute("aria-disabled"))).toEqual(["true", "true"]);
      retryOf(other).click();
      expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);

      kinds.resolve(null);
      await Wait.until(() => expect(retryOf(fixture).getAttribute("aria-disabled")).toBe("false"));
      await other.whenStable();
      expect(store.kindsFailed()).toBe(true);
      expect(retryOf(other).getAttribute("aria-disabled")).toBe("false");
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const usage = (id: string, teammateId: string | null, teammateName: string | null, used: number): Message => new Message(id, "c1", Number(id.slice(1)), MessageAuthor.Provider,
      "m1", MessageStatus.Completed, [], new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null,
        new ReplyUsage(1, 2, null, new ContextUsage(used, 100, null))), SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammateId, teammateName);
    const border = (): number => AppearanceFixture.measureLook("border-width");
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const part = (selector: string, within: ParentNode = root()): HTMLElement => within.querySelector<HTMLElement>(selector)!;
    const card = (): HTMLElement => part(".nol-teamrun-composer-card");
    const field = (): HTMLTextAreaElement => root().querySelector<HTMLTextAreaElement>(".nol-teamrun-composer-text")!;
    const lineHeight = (): number => Number.parseFloat(getComputedStyle(field()).lineHeight);
    const lines = (count: number): string => Array.from({ length: count }, (_, index) => `line ${index}`).join("\n");
    const colorOf = (token: string): string => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = `var(--nol-${token})`;
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const show = async (): Promise<void> => {
      await prepare();
      await render();
      await ready();
    };
    const paintedSelection = async (): Promise<[string, string]> => {
      const image = new Image();
      image.src = `data:image/png;base64,${await page.screenshot({ element: field(), save: false })}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = [image.width, image.height];
      const drawing = canvas.getContext("2d")!;
      drawing.drawImage(image, 0, 0);
      const { data } = drawing.getImageData(0, 0, image.width, image.height);
      const inset = Math.ceil(2 * image.width / box(field()).width);
      const pixels: [number, number, string][] = [];
      for (let y = inset; y < image.height - inset; y++)
        for (let x = inset; x < image.width - inset; x++) {
          const index = (y * image.width + x) * 4;
          pixels.push([x, y, `rgb(${data[index]}, ${data[index + 1]}, ${data[index + 2]})`]);
        }
      const counts = (within: readonly [number, number, string][]): [string, number][] => {
        const found = new Map<string, number>();
        for (const [, , color] of within)
          found.set(color, (found.get(color) ?? 0) + 1);
        return [...found].sort((t, u) => u[1] - t[1]);
      };
      const band = counts(pixels)[1]?.[0] ?? String.empty;
      const rows = new Map<number, [number, number]>();
      for (const [x, y] of pixels.filter(t => t[2] === band))
        rows.set(y, [Math.min(rows.get(y)?.[0] ?? x, x), Math.max(rows.get(y)?.[1] ?? x, x)]);
      const text = counts(pixels.filter(([x, y]) => x >= (rows.get(y)?.[0] ?? Infinity) && x <= (rows.get(y)?.[1] ?? -Infinity))).filter(t => t[1] >= 5)
        .map(t => t[0]).sort((t, u) => AppearanceFixture.contrast(u, band) - AppearanceFixture.contrast(t, band))[0] ?? String.empty;
      return [band, text];
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("names Stop Stopping… in its label and tooltip while its cancel runs, without changing its size or moving the composer", async () => {
      const cancel = new DeferredResponse();
      context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson())
        .answer(MethodName.ConversationCancel, async () => {
          await cancel.promise;
          return null;
        });
      await show();
      await type("ship it");
      await send();
      const stop = (): HTMLButtonElement => {
        const found = root().querySelector(".nol-teamrun-composer-stop");
        if (!(found instanceof HTMLButtonElement))
          throw new Error("Stop is not shown.");
        return found;
      };
      await Wait.until(() => expect(root().querySelector(".nol-teamrun-composer-stop")).not.toBeNull());
      const tooltip = (): string => fixture.debugElement.query(By.css(".nol-teamrun-composer-stop")).injector.get(TooltipDirective).text();
      const before = [box(stop()), box(card())] as const;
      const idle = [stop().getAttribute("aria-label"), tooltip()];

      await click(stop());
      fixture.detectChanges();

      expect([idle, [stop().getAttribute("aria-label"), tooltip(), stop().disabled]])
        .toEqual([[Resources.stopLabel, Resources.stopLabel], [Resources.stoppingLabel, Resources.stoppingLabel, true]]);
      for (const [earlier, after] of [[before[0], box(stop())], [before[1], box(card())]] as const)
        for (const edge of ["left", "top", "width", "height"] as const)
          AppearanceFixture.expectPixels(after[edge], earlier[edge]);
      cancel.resolve(null);
      await Wait.until(() => expect(stop().disabled).toBe(false));
      expect(stop().getAttribute("aria-label")).toBe(Resources.stopLabel);
    });

    it.each([
      { hint: "Providers", action: ".nol-teamrun-composer-manage", method: MethodName.ProviderModelCatalog },
      { hint: "Retry", action: ".nol-teamrun-composer-retry", method: MethodName.ProviderKindList }
    ])("puts the hint with $hint above the field, its text at the field's text start, level with its action at the field's end", async ({ action: selector, method }) => {
      context.fail(method, "not signed in");
      if (method === MethodName.ProviderKindList) {
        configure();
        ChatStoreService.of(context);
        await render();
      }
      else
        await show();
      await Wait.until(() => expect(root().querySelector(`.nol-teamrun-composer-unavailable ${selector}`)).not.toBeNull());
      await fixture.whenStable();
      const message = part(".nol-teamrun-composer-unavailable nol-field-message");
      const [shown, action, text] = [box(message), box(part(selector)), box(field())];
      const padding = Number.parseFloat(getComputedStyle(field()).paddingInlineStart);
      const baselineOf = (element: Element): number => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, t => t.textContent!.trim() === "" ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT);
        const text = walker.nextNode()!;
        const probe = text.parentNode!.insertBefore(document.createElement("span"), text);
        probe.style.display = "inline-block";
        const baseline = probe.getBoundingClientRect().bottom;
        probe.remove();
        return baseline;
      };

      AppearanceFixture.expectPixels(padding, space(1));
      AppearanceFixture.expectPixels(shown.left, text.left + padding);
      AppearanceFixture.expectPixels(text.right - Number.parseFloat(getComputedStyle(field()).paddingInlineEnd) - action.right, 0);
      expect(action.left - shown.right).toBeGreaterThanOrEqual(space(2) - 0.5);
      AppearanceFixture.expectPixels(baselineOf(part(selector)), baselineOf(message));
      expect(text.top + Number.parseFloat(getComputedStyle(field()).paddingTop) - Math.max(shown.bottom, action.bottom)).toBeGreaterThanOrEqual(space(2) - 0.5);
      expect(getComputedStyle(message).color).not.toBe(getComputedStyle(card()).backgroundColor);
    });

    const startRefused = async (): Promise<void> => {
      context.answer(MethodName.ProviderKindList, () => [refusing.toJson(), SampleData.claude.toJson()]);
      withPlanMode();
      answerPlanFirst();
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
    };
    const expectAbove = (row: HTMLElement): void => {
      const tip = box(shownTooltip());
      const anchor = box(row);
      AppearanceFixture.expectPixels(anchor.top - tip.bottom, space(2));
      AppearanceFixture.expectPixels((tip.left + tip.right) / 2, (anchor.left + anchor.right) / 2);
      expect([tip.left >= 0, tip.top >= 0, tip.right <= window.innerWidth, tip.bottom <= window.innerHeight]).toEqual([true, true, true, true]);
      expect(shownTooltip().scrollWidth).toBeLessThanOrEqual(shownTooltip().clientWidth);
    };

    it("shows a refused column's reason whole as its row, at the Model rows' text start and height", async () => {
      await startRefused();
      await click(picker());
      const [effort, model] = [required(rowsOf("efforts")[0]), required(rowsOf("models")[0])];
      const label = (row: HTMLElement): DOMRect => box(part(".nol-menu-item-label", row));

      expect(labelOf(effort)).toBe("Codex can't change effort: its models each have one fixed setting.");
      expect(part(".nol-menu-item-label", effort).scrollWidth).toBeLessThanOrEqual(part(".nol-menu-item-label", effort).clientWidth);
      expect(label(effort).left - box(effort).left).toBeCloseTo(label(model).left - box(model).left, 0);
      AppearanceFixture.expectPixels(box(effort).height, box(model).height);
      await close();
    });

    it("shows the check mark of a configured level the model doesn't list, on its disabled row, at the listed rows' check column and centred in its row", async () => {
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low", "medium"], true, null, true, "medium", { xhigh: "Extra high" }, [], null, null, null, "xhigh")]));
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5-mini", null, "a1"));
      await render();
      await ready();
      await click(picker());
      const [unlisted, listed] = [required(rowsOf("efforts")[0]), required(rowsOf("efforts")[1])];
      const check = (row: HTMLElement): HTMLElement => part(".nol-menu-item-check", row);
      const color = getComputedStyle(check(unlisted)).color;

      expect([labelOf(unlisted), unlisted.getAttribute("aria-checked"), unlisted.getAttribute("aria-disabled")]).toEqual([Resources.formatUnlisted("Extra high"), "true", "true"]);
      expect([getComputedStyle(check(unlisted)).visibility, box(check(unlisted)).width > 0]).toEqual(["visible", true]);
      expect(AppearanceFixture.contrast(color, colorOf("menu")), `the mark ${color}`).toBeGreaterThan(1);
      AppearanceFixture.expectPixels(box(check(unlisted)).right, box(check(listed)).right);
      AppearanceFixture.expectPixels((box(check(unlisted)).top + box(check(unlisted)).bottom) / 2, (box(unlisted).top + box(unlisted).bottom) / 2);
      AppearanceFixture.expectPixels(box(unlisted).height, box(listed).height);
      await close();
    });

    it("shows Plan first's reason whole in a tooltip centred above the permissions menu's last row and inside the window", async () => {
      await startRefused();
      await click(access());
      const row = shownPlanFirstRow();

      await userEvent.hover(row);
      await Wait.until(() => expect(tooltip()?.textContent?.trim()).toBe("Codex can't plan first: it has no plan mode."));
      expectAbove(row);
      await userEvent.unhover(row);
    });

    it("paints its selected text, from inside a mention on into the plain text after it, in the theme's selection colours, or at least 4.5:1 on the system's band under forced colours", async () => {
      new TeammateFixture(context);
      await show();
      await type("thank you. @Al");
      await Wait.until(() => expect(names()).toEqual(["Alice"]));
      await key("Enter");
      await type(`${field().value}will look at it later today`);
      field().focus();
      field().setSelectionRange(field().value.indexOf("lice"), field().value.length);
      await fixture.whenStable();

      const [band, text] = await paintedSelection();

      expect(root().querySelectorAll(".nol-mention-chip")).toHaveLength(1);
      if (forcedColors !== "active")
        expect([band, text]).toEqual([AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-selection"),
          AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-selection-foreground")]);
      else
        expect(AppearanceFixture.contrast(text, band), `the selected text ${text} on the band ${band}`).toBeGreaterThanOrEqual(4.5);
    });

    it("frames the field and bar in a card, centred at most 55rem wide inside the composer's insets", async () => {
      await show();
      const form = box(part("form"));
      const frame = box(card());
      const text = box(field());
      const bar = box(part(".nol-teamrun-composer-bar"));
      const style = getComputedStyle(card());

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(frame.left - form.left, Math.max(space(4) * 2, (form.width - AppearanceFixture.toPixels(55)) / 2));
      AppearanceFixture.expectPixels(form.right - frame.right, frame.left - form.left);
      AppearanceFixture.expectPixels(frame.top - form.top, space(1));
      AppearanceFixture.expectPixels(form.bottom - frame.bottom, space(6));
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), border());
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopLeftRadius), AppearanceFixture.measureLook("radius-large"));
      AppearanceFixture.expectPixels(text.left - frame.left, space(3) + border());
      AppearanceFixture.expectPixels(frame.right - text.right, border());
      AppearanceFixture.expectPixels(text.top - frame.top, border());
      AppearanceFixture.expectPixels(bar.top - text.bottom, space(2));
      AppearanceFixture.expectPixels(frame.bottom - bar.bottom, space(2) + border());
      expect(getComputedStyle(field()).borderTopStyle).toBe("none");
    });

    it("grows the field with its text from two lines to ten, then scrolls", async () => {
      await show();
      const lineCount = (): number => (box(field()).height - space(3)) / lineHeight();
      expect(lineCount()).toBeCloseTo(2, 2);

      await type(lines(4));
      expect(lineCount()).toBeCloseTo(4, 2);
      await type(lines(15));

      expect(lineCount()).toBeCloseTo(10, 2);
      expect(field().scrollHeight).toBeGreaterThan(field().clientHeight);
      expect(getComputedStyle(field()).resize).toBe("none");
    });

    it.each(["ltr", "rtl"])("scrolls the field from the card's top and end edges in %s, inside its border, with its text a padding inside where the card's padding put it", async direction => {
      await show();
      root().dir = direction;
      await type(lines(15));
      const frame = box(card());
      const text = box(field());
      const style = getComputedStyle(field());
      const [start, end] = direction === "rtl" ? [frame.right - text.right, text.left - frame.left] : [text.left - frame.left, frame.right - text.right];

      expect(field().scrollHeight).toBeGreaterThan(field().clientHeight);
      AppearanceFixture.expectPixels(text.top - frame.top, border());
      AppearanceFixture.expectPixels(end, border());
      AppearanceFixture.expectPixels(start + Number.parseFloat(style.paddingInlineStart), space(3) + border() + space(1));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), space(3));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingInlineEnd), space(3) + space(1));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingInlineStart), space(1));
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderStartEndRadius), AppearanceFixture.measureLook("radius-large") - border());
    });

    it.each(["ltr", "rtl"])("scrolls the field from under the attachments and the card's end edge in %s when an attachment is above it, its text a gap below them, which stay on top", async direction => {
      await show();
      root().dir = direction;
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      const frame = box(card());
      const text = box(field());
      const style = getComputedStyle(field());
      const attachments = part(".nol-teamrun-composer-attachments");
      const above = box(attachments);
      const preview = box(previews()[0]!);

      AppearanceFixture.expectPixels(text.top + Number.parseFloat(style.paddingTop) - above.bottom, space(2));
      AppearanceFixture.expectPixels(above.bottom - text.top, space(3) - space(2));
      expect(attachments.contains(document.elementFromPoint(preview.left + preview.width / 2, above.bottom - (space(3) - space(2)) / 2))).toBe(true);
      AppearanceFixture.expectPixels(direction === "rtl" ? text.left - frame.left : frame.right - text.right, border());
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), space(3));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingInlineEnd), space(3) + space(1));
    });

    it("keeps a mention's chip on its text as an attachment comes above the field and goes", async () => {
      new TeammateFixture(context);
      await show();
      await type("Ask @Ali");
      await Wait.until(() => expect(names()).toContain("Alice"));
      await key("Enter");
      const offset = (): number => box(part(".nol-mention-chip")).top - box(field()).top - Number.parseFloat(getComputedStyle(field()).paddingTop);
      const attached = (): number => root().querySelectorAll(".nol-teamrun-composer-attachment").length;
      const alone = offset();

      await pick([sized("notes.txt", 4, "text/plain")]);
      await Wait.until(() => expect(attached()).toBe(1));
      await fixture.whenStable();
      const below = offset();
      await click(part(".nol-teamrun-composer-remove"));
      await Wait.until(() => expect(attached()).toBe(0));
      await fixture.whenStable();

      expect(root().querySelectorAll(".nol-mention-chip")).toHaveLength(1);
      AppearanceFixture.expectPixels(below, alone);
      AppearanceFixture.expectPixels(offset(), alone);
    });

    it("marks the card while the field has focus", async () => {
      await show();

      field().focus();
      await fixture.whenStable();

      if (forcedColors === "active")
        expect(getComputedStyle(card()).outlineStyle).toBe("solid");
      else
        expect(getComputedStyle(card()).borderTopColor).toBe(colorOf("accent"));
    });

    it("sets the context gauge after the bar's free space, a quarter step before the provider line, level with the picker", async () => {
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage,
        new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
          new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null,
            new ReplyUsage(1, 2, null, new ContextUsage(50, 100, null))), SampleData.timestamp, SampleData.timestamp, SampleData.timestamp)], false, false).toJson());
      await show();
      const gauge = box(part(".nol-teamrun-composer-context"));
      const access = box(part(".nol-teamrun-composer-access"));
      const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

      AppearanceFixture.expectPixels(box(part(".nol-teamrun-composer-provider")).left - gauge.right, space(1));
      expect(gauge.left - access.right).toBeGreaterThan(space(1));
      AppearanceFixture.expectPixels(middle(gauge), middle(box(picker())));
      expect(gauge.height).toBeLessThanOrEqual(box(picker()).height + 0.5);
    });

    it("keeps the whole context gauge as the model, the effort or the responder changes", async () => {
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, usage("m2", null, null, 5), usage("m3", "alice", "Alice", 40)], false, false).toJson())
        .answer(MethodName.MessageSend, answered);
      new TeammateFixture(context);
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "high", null, null));
      await render();
      root().style.display = "block";
      root().style.width = "28rem";
      await ready();
      const whole = async (step: string, figure: string): Promise<void> => {
        await fixture.whenStable();
        const gauge = part(".nol-teamrun-composer-context");
        const meter = part("[role='meter']", gauge);
        const text = part(".nol-teamrun-context-text", gauge);
        expect([step, meter.textContent?.trim(), meter.scrollWidth <= meter.clientWidth, text.scrollWidth <= text.clientWidth])
          .toEqual([step, figure, true, true]);
        expect(box(picker()).left).toBeGreaterThanOrEqual(box(gauge).right + space(1) - 0.5);
      };

      await whole("default", "Context 5%");
      await choose("gpt-5-mini");
      await whole("default's model", "Context 5%");
      await choose("Medium");
      await whole("default's effort", "Context 5%");
      await answerAs("Alice");
      await whole("Alice", "Context 40%");
      await choose("gpt-5-mini");
      await Wait.until(() => expect(chatSettings()).toHaveLength(1));
      await whole("Alice's model", "Context 40%");
      await choose("Medium");
      await Wait.until(() => expect(chatSettings()).toHaveLength(2));
      await whole("Alice's effort", "Context 40%");
      await choose(Resources.answerWithoutTeammateLabel);
      await whole("default again", "Context 5%");
    });

    describe.each([
      { geometry: "the fixture theme's", theme: FixtureTheme.theme },
      { geometry: "the default theme's", theme: DefaultTheme.theme }
    ])("the picker with $geometry geometry", ({ theme }) => {
      const look = (name: string): number => AppearanceFixture.measureLook(name);
      const open = async (teammates: TeammateFixture, teammateId: string | null = null): Promise<void> => {
        teammates.members = teammates.teammates.map(t => new ConversationMember("c1", t.id, "t", null, false));
        await prepare();
        remember(new ComposerSettings("codex", "gpt-5", "high", "a1", teammateId));
        await render();
        await choose();
      };
      const textStart = (row: HTMLElement): number => box(part(".nol-menu-item-label", row)).left - box(row).left;

      beforeEach(() => AppearanceFixture.apply(theme, mode));

      it("sets the Effort column beside the Model column, their labels and first rows level, each row's text a menu inset and padding inside it", async () => {
        await open(new TeammateFixture(context));
        const [models, efforts] = [part(".nol-teamrun-composer-models", document), part(".nol-teamrun-composer-efforts", document)];
        const [model, effort] = [required(rowsOf("models")[0]), required(rowsOf("efforts")[0])];

        expect(box(efforts).left).toBeGreaterThanOrEqual(box(models).right - 0.5);
        AppearanceFixture.expectPixels(box(part(".nol-menu-label", efforts)).top, box(part(".nol-menu-label", models)).top);
        AppearanceFixture.expectPixels(box(effort).top, box(model).top);
        AppearanceFixture.expectPixels(box(effort).height, box(model).height);
        for (const row of [model, effort])
          AppearanceFixture.expectPixels(textStart(row), look("menu-item-inset") + look("menu-item-padding"));
        expect(box(part("nol-menu", document)).right).toBeLessThanOrEqual(window.innerWidth + 0.5);
      });

      it("sets the Speed column under Effort at its text start, and its note as a row under the speeds", async () => {
        context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
          new ProviderModel("gpt-5", "gpt-5", "", ["medium", "high"], true, null, true, null, {}, [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")],
            "standard")]));
        await open(new TeammateFixture(context));
        await click(item("Fast"));
        if (!Object.isNull(document.querySelector("nol-menu")))
          await close();
        const reply = new Message("r9", "c1", 9, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance("a1",
          new RequestedSettings("codex", "gpt-5", "high", "fast"), new ObservedSettings("codex", "gpt-5", "high", null, false, null, "cooldown"), "s1", false),
          SampleData.timestamp, SampleData.timestamp, null);
        context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
        await reopen();
        const [efforts, speeds] = [part(".nol-teamrun-composer-efforts", document), part(".nol-teamrun-composer-speeds", document)];
        const [effort, speed, note] = [required(rowsOf("efforts").at(-1)), required(rowsOf("speeds")[0]), part(".nol-teamrun-speed-note", document)];

        expect(box(speeds).top).toBeGreaterThanOrEqual(box(efforts).bottom - 0.5);
        AppearanceFixture.expectPixels(box(speeds).left, box(efforts).left);
        AppearanceFixture.expectPixels(box(part(".nol-menu-item-label", speed)).left, box(part(".nol-menu-item-label", effort)).left);
        expect(box(note).top).toBeGreaterThanOrEqual(box(required(rowsOf("speeds").at(-2))).bottom - 0.5);
        AppearanceFixture.expectPixels(box(part(".nol-menu-item-label", note)).left, box(part(".nol-menu-item-label", speed)).left);
        expect(box(part(".nol-menu-item-label", note)).right).toBeLessThanOrEqual(box(part("nol-menu", document)).right + 0.5);
      });

      it("says why a model can't be chosen on its own disabled row, at the other models' text start and height", async () => {
        context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-6 Sol", "", ["medium"], true, null, true),
          new ProviderModel("terra", "GPT-6 Terra", "", ["medium"], false, null, true, null, {}, [], null, null, "needs Codex 0.167")]));
        await open(new TeammateFixture(context));
        const [sol, terra] = [item("GPT-6 Sol"), item(Resources.formatModelUnavailable("GPT-6 Terra", "needs Codex 0.167"))];

        expect([terra.getAttribute("aria-disabled"), terra.getAttribute("aria-checked"), terra.classList.contains("nol-teamrun-unavailable-model")]).toEqual(["true", "false", true]);
        AppearanceFixture.expectPixels(textStart(terra), textStart(sol));
        AppearanceFixture.expectPixels(box(terra).height, box(sol).height);
        await click(terra);
        expect([choice()?.model, document.querySelectorAll("nol-menu").length]).toEqual(["gpt-5", 1]);
      });

      it("puts a named teammate's scope line under the columns at their text start, then Make it its default, then the provider, Edit and Answer without a teammate rows", async () => {
        await open(new TeammateFixture(context), "alice");
        const model = required(rowsOf("models").at(-1));
        const scope = part(".nol-teamrun-composer-scope", document);
        const [make, provider, edit, without] = [item(Resources.formatMakeDefault("Alice")), providerRow(), item(Resources.formatEditTeammate("@Alice")),
          item(Resources.answerWithoutTeammateLabel)];

        expect(box(scope).top).toBeGreaterThanOrEqual(Math.max(box(model).bottom, box(required(rowsOf("efforts").at(-1))).bottom) - 0.5);
        AppearanceFixture.expectPixels(box(scope).left + Number.parseFloat(getComputedStyle(scope).paddingInlineStart), box(part(".nol-menu-item-label", model)).left);
        expect(getComputedStyle(scope).color).toBe(colorOf("text-muted"));
        for (const [above, below] of [[scope, make], [make, provider], [provider, edit], [edit, without]] as const)
          expect(box(below).top).toBeGreaterThanOrEqual(box(above).bottom - 0.5);
        for (const row of [make, provider, edit, without])
          AppearanceFixture.expectPixels(box(part(".nol-menu-item-label", row)).left, box(part(".nol-menu-item-label", model)).left);
        expect(part(".nol-menu-item-chevron", provider)).not.toBeNull();
      });
    });

    describe("narrowed down to a chat's 13.75rem minimum", () => {
      const levelOf = (): number => [part(".nol-teamrun-composer-provider").classList.contains("nol-teamrun-composer-folded"),
        part("form").classList.contains("nol-teamrun-composer-tight"), picker().classList.contains("nol-teamrun-composer-folded"),
        part("[role='meter']").classList.contains("nol-teamrun-context-track-only"), access().classList.contains("nol-teamrun-composer-folded"),
        access().classList.contains("nol-teamrun-composer-in-menu")].filter(Boolean).length;
      const observed = (element: Element): Promise<void> => new Promise(resolve => {
        const watcher = new ResizeObserver(() => {
          watcher.disconnect();
          requestAnimationFrame(() => resolve());
        });
        watcher.observe(element);
      });
      const resize = async (rem: number, signal: AbortSignal | null = null): Promise<void> => {
        signal?.throwIfAborted();
        const level = levelOf();
        root().style.width = `${rem}rem`;
        await observed(root());
        await fixture.whenStable();
        if (levelOf() !== level) {
          await observed(part(".nol-teamrun-composer-bar > button"));
          await fixture.whenStable();
        }
        signal?.throwIfAborted();
      };
      const inside = (inner: Element, outer: Element): boolean => box(inner).left >= box(outer).left - 0.5 && box(inner).right <= box(outer).right + 0.5;
      const edges = (element: Element): number => Number.parseFloat(getComputedStyle(element).paddingInlineStart) + Number.parseFloat(getComputedStyle(element).paddingInlineEnd)
        + Number.parseFloat(getComputedStyle(element).borderInlineStartWidth) + Number.parseFloat(getComputedStyle(element).borderInlineEndWidth);
      const open = async (used: number = 100, mode: string | null = null, planFirst: boolean = false): Promise<ChatStoreService> => {
        context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, usage("m2", null, null, used)], false, false).toJson());
        context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(["gpt-5", "gpt-5-mini"].map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"],
          index === 0, null, true)), true, false, null, false, planFirst ? [...modes, new ProviderMode("plan", "Plan", "Reads files and plans, and changes nothing.", false, true)] : modes,
          "auto", false, planFirst ? "plan" : null));
        if (planFirst)
          listPlanFirst(() => true);
        const store = await prepare();
        remember(new ComposerSettings("codex", "gpt-5", "high", null, null, null, mode));
        await render();
        root().style.display = "block";
        await ready();
        return store;
      };
      const unfoldedNeeds = (): [number, number, number, number, number, number] => {
        const bar = part(".nol-teamrun-composer-bar");
        const gauge = part(".nol-teamrun-composer-context");
        const ends = box(part("button", bar)).width + box(sendButton()!).width;
        const accessMinimum = Number.parseFloat(getComputedStyle(access()).minWidth);
        const pickerShort = box(picker()).width - box(part(".nol-teamrun-composer-label", picker())).width + box(part(".nol-teamrun-composer-short", picker())).width;
        const chrome = box(card()).width - box(bar).width;
        const held = ends + box(access()).width + box(picker()).width + box(gauge).width + space(1) * 5 + chrome;
        const short = ends + accessMinimum + pickerShort + space(1) * 5 + chrome + space(2) * 2;
        const rem = (pixels: number): number => pixels / AppearanceFixture.toPixels(1);
        return [rem(held + box(part(".nol-teamrun-composer-provider")).width + space(1) + space(4) * 4), rem(held + space(4) * 4), rem(held + space(2) * 2),
          rem(short + box(gauge).width), rem(short + space(1) * 2 + space(6)),
          rem(short - accessMinimum + AppearanceFixture.measureLook("icon") + edges(access()) + space(1) * 2 + space(6))];
      };

      describe.each([
        { geometry: "the fixture theme's", theme: FixtureTheme.theme },
        { geometry: "the default theme's", theme: DefaultTheme.theme }
      ])("with $geometry geometry", ({ theme }) => {
        beforeEach(() => AppearanceFixture.apply(theme, mode));

        describe.each([
          { permissions: "a restricted mode", mode: null, planFirst: false, warned: false },
          { permissions: "Full Access, whose mark the permission button keeps at every width", mode: "full-access", planFirst: false, warned: true },
          { permissions: "Full Access with Plan first on, where nothing warns", mode: "full-access", planFirst: true, warned: false }
        ])("in $permissions", ({ mode, planFirst, warned }) => {
          describe.each([
            { widths: "the widest third of the widths", band: 0 },
            { widths: "the middle third of the widths", band: 1 },
            { widths: "the narrowest third of the widths", band: 2 }
          ])("over $widths", ({ band }) => {
            it("hides the provider line, then folds the inset, then the picker to who answers, then the gauge's label, then the permissions to their glyph, then into the picker's menu, so at every width nothing in the bar overflows or overlaps and Send ends it", async ({ signal }) => {
              const bands = 3;
              await open(100, mode, planFirst);
              await resize(64, signal);
              const points = unfoldedNeeds();
              const folds = points.filter(t => t > 13.75).length;
              const widest = Math.ceil(points[0] * 4) / 4 + 0.25;
              const count = (widest - 13.75) / 0.25 + 1;
              const [first, end] = [Math.floor(count * band / bands), Math.floor(count * (band + 1) / bands)];
              const before = widest - (first - 1) * 0.25;
              for (const point of points.filter(t => t - 1 / 16 > before))
                await resize(point - 1 / 16, signal);
              await resize(before, signal);
              const levels: number[] = [levelOf()];
              for (let width = widest - first * 0.25; width > widest - end * 0.25; width -= 0.25) {
                await resize(width, signal);
                const level = levelOf();
                levels.push(level);
                const bar = part(".nol-teamrun-composer-bar");
                const shown = [...bar.children].filter(t => !t.classList.contains("nol-teamrun-composer-space") && getComputedStyle(t).display !== "none"
                  && getComputedStyle(t).visibility === "visible");
                const gaps = shown.slice(1).map((t, index) => box(t).left - box(shown[index]!).right);
                const gauge = part(".nol-teamrun-composer-context");
                const text = part(".nol-teamrun-context-text", gauge);
                const glyphs = [...access().querySelectorAll(".nol-teamrun-composer-glyph")].filter(t => getComputedStyle(t).visibility === "visible");

                expect([width, gaps.every(t => t >= space(1) - 0.5), shown.every(t => inside(t, bar)), shown.includes(gauge), shown.includes(part(".nol-teamrun-composer-provider")) === (level < ComposerBar.lineHidden),
                  level >= ComposerBar.gaugeTrack || text.scrollWidth <= text.clientWidth, shown.includes(access()) === (level < ComposerBar.accessInMenu),
                  level >= ComposerBar.accessInMenu || glyphs.length === (level >= ComposerBar.accessIcon ? 1 : 2) && glyphs.every(t => inside(t, access())),
                  inside(part(".nol-teamrun-composer-glyph", picker()), picker()),
                  Object.isNull(risky()) !== warned]).toEqual([width, true, true, true, true, true, true, true, true, true]);
                AppearanceFixture.expectPixels(box(sendButton()!).right, box(bar).right);
                AppearanceFixture.expectPixels(box(card()).left - box(part("form")).left,
                  level >= ComposerBar.tight ? space(2) : Math.max(space(4) * 2, (box(part("form")).width - AppearanceFixture.toPixels(55)) / 2));
              }
              const steps = levels.slice(1).map((t, index) => t - required(levels[index]));
              expect([levels, steps.every(t => t === 0 || t === 1)]).toEqual([levels, true]);
              expect([band === 0 ? levels[1] : ComposerBar.unfolded, band === bands - 1 ? levels.at(-1) : folds]).toEqual([ComposerBar.unfolded, folds]);
            });
          });

          it("folds each step just below the width the bar needs unfolded, and changes once each time the width crosses it, either way", async ({ signal }) => {
            await open(100, mode, planFirst);
            await resize(64, signal);
            const points = unfoldedNeeds();
            const changes: MutationRecord[] = [];
            const watcher = new MutationObserver(records => changes.push(...records));
            for (const target of [part(".nol-teamrun-composer-provider"), part("form"), access(), part("[role='meter']"), picker()])
              watcher.observe(target, { attributes: true, attributeFilter: ["class"] });
            const step = 1 / 16;

            for (const [index, point] of points.entries()) {
              await resize(point + step, signal);
              expect([point, levelOf()]).toEqual([point, index]);
              for (const [width, level] of [[point - step, index + 1], [point + step, index], [point - step, index + 1]]) {
                changes.splice(0);
                await resize(width!, signal);
                expect([width, levelOf(), changes.length]).toEqual([width, level, 1]);
              }
            }
            watcher.disconnect();
          });
        });

        it("shows the gauge as its track alone, a half step either side, with the figure in its tooltip and accessible name", async () => {
          await open(40);
          await resize(32);
          const meter = part("[role='meter']");
          const track = part(".nol-teamrun-context-track");
          const detail = meter.getAttribute("aria-label");
          await resize(13.75);
          const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

          AppearanceFixture.expectPixels(box(track).width, space(6));
          AppearanceFixture.expectPixels(box(track).left - box(meter).left, space(1));
          AppearanceFixture.expectPixels(box(meter).right - box(track).right, space(1));
          AppearanceFixture.expectPixels(middle(box(track)), middle(box(picker())));
          const edges = Number.parseFloat(getComputedStyle(track).borderInlineStartWidth) + Number.parseFloat(getComputedStyle(track).borderInlineEndWidth);
          AppearanceFixture.expectPixels(box(part(".nol-teamrun-context-fill")).width, (box(track).width - edges) * 0.4);
          expect([getComputedStyle(part(".nol-teamrun-context-text")).visibility, meter.getAttribute("aria-valuetext"), meter.getAttribute("aria-label"),
            inside(meter, part(".nol-teamrun-composer-bar"))]).toEqual(["hidden", "Context 40%", `Context 40%. ${detail}`, true]);
        });

        it("shows the picker as who answers alone, in the same button with the same name and menu, and its full label again once it fits", async () => {
          await open();
          await resize(40);
          const point = required(unfoldedNeeds()[ComposerBar.buttonShort - 1]);
          await resize(point + 1 / 16);
          const button = picker();
          const name = button.getAttribute("aria-label");
          expect([getComputedStyle(part(".nol-teamrun-composer-label", button)).visibility, getComputedStyle(part(".nol-teamrun-composer-short", button)).visibility])
            .toEqual(["visible", "hidden"]);
          await resize(point - 1 / 16);
          const short = part(".nol-teamrun-composer-short", button);
          const glyph = part(".nol-teamrun-composer-glyph", button);
          const start = Number.parseFloat(getComputedStyle(button).paddingInlineStart) + Number.parseFloat(getComputedStyle(button).borderInlineStartWidth);

          expect([picker(), short.textContent?.trim(), getComputedStyle(short).visibility, getComputedStyle(part(".nol-teamrun-composer-label", button)).visibility,
            button.getAttribute("aria-label")]).toEqual([button, "Codex", "visible", "hidden", name]);
          AppearanceFixture.expectPixels(box(short).left - box(button).left, start);
          AppearanceFixture.expectPixels(box(glyph).left - box(short).right, space(1));
          AppearanceFixture.expectPixels(box(button).right - box(glyph).right, edges(button) - start);
          await click(button);
          expect(document.querySelector(".nol-teamrun-composer-columns")).not.toBeNull();
          await close();
          await resize(point + 1 / 16);
          expect([getComputedStyle(part(".nol-teamrun-composer-label", button)).visibility, inside(glyph, button)]).toEqual(["visible", true]);
        });

        it("shows the permissions as their glyph alone just above the width where they fold into the picker's menu, centred, keeping the unrestricted mark, the same name and menu, and the focus", async () => {
          await open(100, "full-access");
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          await resize(40);
          access().focus();
          const name = access().getAttribute("aria-label");
          await resize(point + 1 / 16);
          const glyph = required(risky());

          expect([levelOf(), document.activeElement === access(), access().getAttribute("aria-label"), getComputedStyle(part(".nol-teamrun-composer-summary", access())).visibility,
            getComputedStyle(glyph).visibility, glyph.textContent?.trim()]).toEqual([ComposerBar.accessIcon, true, name, "hidden", "visible", Resources.unrestrictedModeGlyph]);
          AppearanceFixture.expectPixels(box(access()).width, AppearanceFixture.measureLook("icon") + edges(access()));
          AppearanceFixture.expectPixels(box(glyph).left - box(access()).left, box(access()).right - box(glyph).right);
          AppearanceFixture.expectPixels(box(required(sendButton())).right, box(part(".nol-teamrun-composer-bar")).right);
          await click(access());
          expect([document.querySelector("nol-menu")?.getAttribute("aria-label"), labels()[0]]).toEqual([Resources.chatPermissionsLabel, "Default"]);
        });

        it("folds the permissions into the picker's menu just below the width where the bar's parts fit, keeping every part inside the bar, the picker's expand glyph inside it and Send at its end there and at 13.75rem", async ({ signal }) => {
          await open(100, "full-access");
          await resize(64, signal);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          const bar = part(".nol-teamrun-composer-bar");
          for (const [width, level] of [[point + 1 / 16, ComposerBar.accessIcon], [point - 1 / 16, ComposerBar.accessInMenu], [13.75, null]] as const) {
            await resize(width, signal);
            const shown = [...bar.children].filter(t => !t.classList.contains("nol-teamrun-composer-space") && getComputedStyle(t).display !== "none"
              && getComputedStyle(t).visibility === "visible");
            const gaps = shown.slice(1).map((t, index) => box(t).left - box(required(shown[index])).right);

            expect([width, Object.isNull(level) || levelOf() === level, shown.every(t => inside(t, bar)), gaps.every(t => t >= space(1) - 0.5),
              inside(part(".nol-teamrun-composer-glyph", picker()), picker())]).toEqual([width, true, true, true, true]);
            AppearanceFixture.expectPixels(box(required(sendButton())).right, box(bar).right);
          }
        });

        for (const [where, level, narrowest] of [["just above where the permissions fold into the picker's menu", ComposerBar.accessIcon, false],
          ["at 13.75rem, with the permissions in the picker's menu", ComposerBar.accessInMenu, true]] as const)
          it.runIf(mode === ThemeMode.Light && forcedColors === "none")(
            `keeps every control and state visible under forced colours and whole at 200% zoom ${where}, in Full Access, with the picker's menu open`, async () => {
              await open(100, "full-access");
              await resize(64);
              const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
              await resize(narrowest ? 13.75 : point + 1 / 16);
              expect(levelOf()).toBe(level);
              const folded = async (): Promise<boolean[]> => {
                await Wait.until(() => expect(levelOf()).toBe(level));
                await fixture.whenStable();
                const badge = part(".nol-teamrun-composer-badge", picker());
                return [getComputedStyle(access()).display === "none", getComputedStyle(badge).display !== "none" && inside(badge, picker())];
              };

              expect([await AccessibilityFixture.forcedAsync(folded), await AccessibilityFixture.zoomedAsync(folded)]).toEqual([[narrowest, narrowest], [narrowest, narrowest]]);
              await AccessibilityFixture.expectVisibleForcedAsync(root());
              await AccessibilityFixture.expectFitsZoomedAsync(root(), () => fixture.whenStable(), [".nol-teamrun-context-track-only"]);
              await click(picker());
              const menu = required(document.querySelector<HTMLElement>("nol-menu"));
              await AccessibilityFixture.expectVisibleForcedAsync(menu);
              await AccessibilityFixture.expectFitsZoomedAsync(menu, () => fixture.whenStable());
            });

        it("moves the chat's permissions to the top of the picker's menu once the button folds, opening the same modes, and back to the bar once it fits again", async () => {
          await open();
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          const unfolded = required(summary());
          const chosen = unfolded.slice(Resources.formatPicker(String.empty).length);
          await resize(point - 1 / 16);

          expect([getComputedStyle(access()).display, summary()]).toEqual(["none", Resources.formatPermissionsAndPicker("Default", chosen)]);
          await click(picker());
          const row = item(Resources.chatPermissionsLabel);
          expect([document.querySelector("nol-menu")?.getAttribute("aria-label"), labels()[0], part(".nol-menu-item-value", row).textContent?.trim(),
            part(".nol-menu-item-icon", row).textContent?.trim()]).toEqual([Resources.permissionsAndPickerLabel, Resources.chatPermissionsLabel, "Default", Resources.permissionsGlyph]);
          await click(row);
          expect([...document.querySelectorAll("nol-menu")].at(-1)?.getAttribute("aria-label")).toBe(Resources.chatPermissionsLabel);
          expect(modeRows().map(t => t[0])).toEqual(["Default", "Read Only", "Full Access", Resources.toolsFollowMode]);
          await click(item("Read Only"));
          await Wait.until(() => expect(choice()?.mode).toBe("read-only"));
          await resize(64);
          await click(picker());
          expect([getComputedStyle(access()).display === "none", labels().includes(Resources.chatPermissionsLabel), document.querySelector("nol-menu")?.getAttribute("aria-label"),
            summary(), modeLabel()]).toEqual([false, false, Resources.pickerLabel, unfolded, "Read Only"]);
        });

        it("hands the focus from the permission button to the picker when the button folds into its menu", async () => {
          await open();
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          access().focus();
          expect(document.activeElement).toBe(access());

          await resize(point - 1 / 16);

          expect(document.activeElement).toBe(picker());
        });

        it("closes the permissions menu open while its button folds into the picker's menu, and hands the focus to the picker", async () => {
          await open();
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          await click(access());
          expect([document.querySelector("nol-menu")?.getAttribute("aria-label"), labels()[0]]).toEqual([Resources.chatPermissionsLabel, "Default"]);

          await resize(point - 1 / 16);

          expect([document.querySelector("nol-menu"), document.activeElement]).toEqual([null, picker()]);
        });

        it("hands the focus from the folded permissions row to a row of the picker's menu once the button goes back to the bar, and the arrow keys go on from it", async () => {
          await open();
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          await resize(point - 1 / 16);
          picker().focus();
          await userEvent.keyboard("{Enter}");
          item(Resources.chatPermissionsLabel).focus();
          expect(document.activeElement).toBe(item(Resources.chatPermissionsLabel));

          await resize(64);

          const first = document.activeElement;
          expect([document.querySelector("nol-menu")?.getAttribute("aria-label"), items().some(t => t === first), labels().includes(Resources.chatPermissionsLabel)])
            .toEqual([Resources.pickerLabel, true, false]);
          await userEvent.keyboard("{ArrowDown}");
          expect([document.activeElement !== first, items().some(t => t === document.activeElement)]).toEqual([true, true]);
        });

        it("keeps the picker's menu open with the focus on a row that stays, such as a model, when the chat widens", async () => {
          await open();
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          await resize(point - 1 / 16);
          picker().focus();
          await userEvent.keyboard("{Enter}");
          const model = required(rowsOf("models").at(-1));
          model.focus();
          expect(document.activeElement).toBe(model);

          await resize(64);

          expect([document.querySelector("nol-menu")?.getAttribute("aria-label"), document.activeElement === model]).toEqual([Resources.pickerLabel, true]);
        });

        it("puts the unrestricted mode's mark on the picker's expand glyph's end corner as a badge once the permissions fold into its menu, adding no width, with Send ending the bar", async () => {
          await open(100, "full-access");
          await resize(64);
          const point = required(unfoldedNeeds()[ComposerBar.accessInMenu - 1]);
          const badge = (): HTMLElement => part(".nol-teamrun-composer-badge", picker());
          await resize(point + 1 / 16);
          expect([levelOf(), getComputedStyle(badge()).display]).toEqual([ComposerBar.accessIcon, "none"]);

          await resize(point - 1 / 16);
          const glyph = box(part(".nol-teamrun-composer-glyph", picker()));
          const mark = box(badge());

          expect([levelOf(), badge().textContent?.trim(), badge().getAttribute("aria-hidden"), inside(badge(), picker()), getComputedStyle(badge()).color])
            .toEqual([ComposerBar.accessInMenu, Resources.unrestrictedModeGlyph, "true", true, colorOf("error")]);
          AppearanceFixture.expectPixels(mark.right, glyph.right);
          AppearanceFixture.expectPixels(mark.bottom, glyph.bottom);
          AppearanceFixture.expectPixels(mark.width, AppearanceFixture.measureLook("icon") / 2);
          AppearanceFixture.expectPixels(mark.height, AppearanceFixture.measureLook("icon") / 2);
          AppearanceFixture.expectPixels(box(required(sendButton())).right, box(part(".nol-teamrun-composer-bar")).right);
        });
      });
    });

    it("starts the bar with Add files and ends it with Send, a quarter step apart from their neighbours", async () => {
      await show();
      const bar = box(part(".nol-teamrun-composer-bar"));
      const buttons = [...part(".nol-teamrun-composer-bar").children].filter(t => t.tagName === "BUTTON").map(t => box(t));
      const send = box(sendButton()!);

      AppearanceFixture.expectPixels(buttons[0]!.left, bar.left);
      AppearanceFixture.expectPixels(send.right, bar.right);
      AppearanceFixture.expectPixels(buttons[1]!.left - buttons[0]!.right, space(1));
      AppearanceFixture.expectPixels(send.left - box(picker()).right, space(1));
      for (const button of buttons)
        AppearanceFixture.expectPixels(button.top + button.height / 2, bar.top + bar.height / 2);
    });

    it("fills Send as a circle the button height across in the button color, and in the border color with a muted glyph while there is nothing to send", async () => {
      await show();
      const send = sendButton()!;
      const system = (name: string): string => {
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.color = name;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const look = (): string[] => {
        const circle = getComputedStyle(send, "::before");
        return [circle.borderRadius, forcedColors === "active" ? circle.borderTopColor : circle.backgroundColor, getComputedStyle(send).color];
      };

      AppearanceFixture.expectPixels(box(send).width, AppearanceFixture.measureLook("button-height"));
      AppearanceFixture.expectPixels(box(send).height, AppearanceFixture.measureLook("button-height"));
      expect([send.disabled, ...look()]).toEqual(forcedColors === "active" ? [true, "50%", system("GrayText"), system("GrayText")]
        : [true, "50%", colorOf("widget-border"), colorOf("text-muted")]);
      await type("Ask");
      await Wait.until(() => expect(send.disabled).toBe(false));
      expect(look()).toEqual(forcedColors === "active" ? ["50%", system("ButtonText"), system("ButtonText")] : ["50%", colorOf("button"), colorOf("button-text")]);
    });

    it("sizes the provider and kind submenus 15.75rem wide while their rows are narrower, and the permissions menu at least that, 252px like the 18rem of a 14px root", async () => {
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true, null, {},
        [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], "standard")], true, false, null, false,
        [new ProviderMode("auto", "Default", "Asks first."), new ProviderMode("read-only", "Read Only", "Reads only.")], "auto"));
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
      const width = Math.round(AppearanceFixture.toPixels(Resources.settingsMenuWidth));
      const last = (): number => box(required([...document.querySelectorAll("nol-menu")].at(-1))).width;

      await click(access());
      const permissions = last();
      await click(access());
      await choose();
      await click(providerRow());
      const provider = Math.round(last());
      await click(required(document.querySelector<HTMLButtonElement>(".nol-teamrun-kind")));
      const kind = Math.round(last());
      await close();

      expect([provider, kind, document.querySelectorAll("nol-menu").length]).toEqual([width, width, 0]);
      expect(permissions).toBeGreaterThanOrEqual(width - 0.5);
    });

    it("spaces the permission button's glyph a quarter step before the mode's name and its expand glyph a quarter step after it, all level and inside the button", async () => {
      withModes();
      await show();
      const access = part(".nol-teamrun-composer-access");
      const [lead, chevron] = [...access.querySelectorAll<HTMLElement>(".nol-teamrun-composer-glyph")].map(t => box(t));
      const label = box(part(".nol-teamrun-composer-label", access));
      const middle = (rect: DOMRect): number => rect.top + rect.height / 2;
      const tooltip = fixture.debugElement.query(By.css(".nol-teamrun-composer-access")).injector.get(TooltipDirective).text();

      expect([label.width > 0, box(part(".nol-teamrun-composer-summary", access)).right <= box(access).right + 0.5, tooltip]).toEqual([true, true, Resources.chatPermissionsLabel]);
      AppearanceFixture.expectPixels(label.left - lead!.right, space(1));
      AppearanceFixture.expectPixels(chevron!.left - label.right, space(1));
      AppearanceFixture.expectPixels(box(access).right - chevron!.right, border() + AppearanceFixture.measureLook("button-padding"));
      for (const glyph of [lead!, chevron!])
        AppearanceFixture.expectPixels(middle(glyph), middle(label));
    });

    it("shows an unrestricted mode's warning glyph on the permission button in the error color, where its shield was, without moving the name", async () => {
      withModes();
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
      const access = part(".nol-teamrun-composer-access");
      const before = [box(part(".nol-teamrun-composer-glyph", access)), box(part(".nol-teamrun-composer-label", access))];

      await chooseMode("Full Access");
      await answerConfirm(".nol-teamrun-confirm");
      await Wait.until(() => expect(risky()).not.toBeNull());
      const after = [box(risky()!), box(part(".nol-teamrun-composer-label", access))];

      expect(risky()!.textContent?.trim()).toBe(Resources.unrestrictedModeGlyph);
      for (const [index, rect] of after.entries())
        AppearanceFixture.expectPixels(rect.left, before[index]!.left);
      if (forcedColors !== "active")
        expect(getComputedStyle(risky()!).color).toBe(colorOf("error"));
    });

    it("shows Plan first's glyph on the permission button where its shield was, muted like it, and its name where the mode's was, inside the button", async () => {
      withPlanMode();
      answerPlanFirst();
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
      const access = part(".nol-teamrun-composer-access");
      const glyph = (): HTMLElement => part(".nol-teamrun-composer-glyph", access);
      const label = (): HTMLElement => part(".nol-teamrun-composer-label", access);
      const before = [box(glyph()), box(label()), getComputedStyle(glyph()).color] as const;

      await click(access);
      await click(shownPlanFirstRow());
      await Wait.until(() => expect(label().textContent?.trim()).toBe(Resources.planFirstLabel));

      expect([glyph().textContent?.trim(), box(part(".nol-teamrun-composer-summary", access)).right <= box(access).right + 0.5]).toEqual([Resources.planFirstGlyph, true]);
      AppearanceFixture.expectPixels(box(glyph()).left, before[0].left);
      AppearanceFixture.expectPixels(box(label()).left, before[1].left);
      AppearanceFixture.expectPixels(box(glyph()).top, before[0].top);
      if (forcedColors !== "active")
        expect(getComputedStyle(glyph()).color).toBe(before[2]);
    });

    it("outlines the permission button in the border color, with its glyph and label muted, a quarter step by half a step inside", async () => {
      withModes();
      await show();
      const access = part(".nol-teamrun-composer-access");
      const style = getComputedStyle(access);
      const glyph = box(part(".nol-teamrun-composer-glyph", access));

      expect(style.borderTopStyle).toBe("solid");
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), border());
      AppearanceFixture.expectPixels(glyph.left - box(access).left, border() + AppearanceFixture.measureLook("button-padding"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), space(1));
      if (forcedColors !== "active") {
        expect(style.borderTopColor).toBe(colorOf("border"));
        expect(style.color).toBe(colorOf("text-muted"));
      }
    });

    it("shows who answers, the model and the effort on a borderless button as high as Send, on the permission button's middle line, with the expand glyph a quarter step after them", async () => {
      new TeammateFixture(context);
      withModes();
      await prepare();
      remember(new ComposerSettings("codex", null, null, null, "alice"));
      await render();
      await ready();
      const button = box(picker());
      const style = getComputedStyle(picker());
      const label = part(".nol-teamrun-composer-label", picker());
      const glyph = box(part(".nol-teamrun-composer-summary .nol-teamrun-composer-glyph", picker()));
      const inset = AppearanceFixture.measureLook("button-padding");
      const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

      expect([required(label.textContent).trim().startsWith("@Alice · GPT-5"), picker().querySelector("nol-avatar")]).toEqual([true, null]);
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), 0);
      AppearanceFixture.expectPixels(button.height, AppearanceFixture.measureLook("button-height"));
      AppearanceFixture.expectPixels(button.height, box(sendButton()!).height);
      AppearanceFixture.expectPixels(middle(button), middle(box(access())));
      AppearanceFixture.expectPixels(box(label).left - button.left, inset);
      AppearanceFixture.expectPixels(glyph.left - box(label).right, space(1));
      AppearanceFixture.expectPixels(button.right - glyph.right, inset);
      for (const part of [box(label), glyph])
        AppearanceFixture.expectPixels(middle(part), middle(button));
    });

    it("shows an attached image as a 7rem card, whose remove button shows in its corner on focus, a white × on the overlay's round fill that reads on any image", async () => {
      await show();
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      const image = part(".nol-teamrun-composer-image");
      const remove = part(".nol-teamrun-composer-remove", image);
      const preview = box(part(".nol-teamrun-composer-preview"));

      AppearanceFixture.expectPixels(box(image).width, AppearanceFixture.toPixels(7));
      AppearanceFixture.expectPixels(box(image).height, AppearanceFixture.toPixels(7));
      AppearanceFixture.expectPixels(preview.left - box(image).left, border());
      AppearanceFixture.expectPixels(preview.width, AppearanceFixture.toPixels(7) - 2 * border());
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(image).borderTopLeftRadius), AppearanceFixture.measureLook("radius-large"));
      AppearanceFixture.expectPixels(box(image).right - box(remove).right, border() + space(1) / 2);
      AppearanceFixture.expectPixels(box(remove).top - box(image).top, border() + space(1) / 2);
      AppearanceFixture.expectPixels(box(image).left, box(field()).left);
      expect(getComputedStyle(remove).opacity).toBe("0");
      remove.focus();
      expect(getComputedStyle(remove).opacity).toBe("1");
      expect(image.querySelector(".nol-teamrun-composer-attachment-name")).toBeNull();
      const disc = getComputedStyle(remove, "::before");
      AppearanceFixture.expectPixels(Number.parseFloat(disc.width), AppearanceFixture.measureLook("icon-button"));
      AppearanceFixture.expectPixels(Number.parseFloat(disc.height), AppearanceFixture.measureLook("icon-button"));
      expect(disc.borderTopLeftRadius).toBe("50%");
      if (forcedColors !== "active") {
        expect(getComputedStyle(remove).color).toBe(colorOf("overlay-text"));
        expect(disc.backgroundColor).toBe(colorOf("overlay"));
      }
    });

    it.each(["Enter", "Send"])("keeps the focus and its ring on the field after a send by %s, while the send and its reply run, the chat is renamed and moves up, "
      + "and after the reply ends", async way => {
      const fresh = new Conversation("c1", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
      const other = new Conversation("c2", "p1", "Second", "2026-09-15T08:00:00.000Z", "2026-09-15T08:00:00.000Z");
      const answer = new DeferredResponse();
      context.answer(MethodName.ConversationList, () => [fresh.toJson(), other.toJson()])
        .answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson())
        .answer(MethodName.MessageSend, () => answer.promise);
      const listed = (): string[] => ChatStoreService.of(context).newestConversationsOf("p1").map(t => `${t.id} ${t.title}`);
      const ringed = (): void => {
        const style = getComputedStyle(card());
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.color = "Highlight";
        const highlight = getComputedStyle(probe).color;
        probe.remove();
        expect(document.activeElement).toBe(field());
        if (forcedColors === "active") {
          expect([style.outlineStyle, style.outlineColor]).toEqual(["solid", highlight]);
          AppearanceFixture.expectPixels(Number.parseFloat(style.outlineWidth), 2 * border());
        }
        else
          expect(style.borderTopColor).toBe(colorOf("accent"));
      };
      await show();
      field().focus();
      await type("ship it");
      expect(listed()).toEqual(["c2 Second", `c1 ${Resources.newConversationTitle}`]);

      if (way === "Enter")
        await key("Enter");
      else {
        sendButton()!.focus();
        await click(sendButton()!);
      }
      await Wait.until(() => expect(sent()).toHaveLength(1));
      await fixture.whenStable();
      ringed();
      answer.resolve(new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson());
      context.answer(MethodName.ConversationList, () => [fresh.withTitle("ship it", SampleData.touchedAt).toJson(), other.toJson()])
        .answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(listed()).toEqual(["c1 ship it", "c2 Second"]));
      await Wait.until(() => expect(root().querySelector(".nol-teamrun-composer-stop")).not.toBeNull());
      await fixture.whenStable();
      ringed();
      expect([field().readOnly, field().value]).toEqual([false, ""]);
      context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
      await Wait.until(() => expect(sendButton()).not.toBeNull());
      await fixture.whenStable();

      ringed();
      expect(field().readOnly).toBe(false);
    });

    it("rings an attached image inside its card when it takes focus, and opens its menu from the keyboard", async () => {
      await show();
      await pick([imageFile("shot.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      const preview = frames()[0]!;
      const remove = part(".nol-teamrun-composer-remove");

      preview.focus();
      const style = getComputedStyle(preview);
      const card = box(part(".nol-teamrun-composer-image"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineWidth), 2 * border());
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineOffset), -2 * border());
      AppearanceFixture.expectPixels(box(preview).left - card.left, border());
      AppearanceFixture.expectPixels(card.right - box(preview).right, border());
      expect(style.outlineStyle).toBe("solid");
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = forcedColors === "active" ? "Highlight" : "var(--nol-accent)";
      expect(style.outlineColor).toBe(getComputedStyle(probe).color);
      probe.remove();
      expect(getComputedStyle(remove).opacity).toBe("1");

      preview.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true }));
      await fixture.whenStable();
      await Wait.until(() => expect(labels()).toEqual(["Open in a new tab", "Copy Image", "Download Image"]));
      const menu = document.querySelector<HTMLElement>("nol-menu")!.getBoundingClientRect();
      AppearanceFixture.expectPixels(menu.left, box(preview).left);
    });

    it("shows a restored image as the same 7rem card, in the same place, as a newly attached image", async () => {
      const restored = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");
      context.answer(MethodName.DraftRead, () => new Draft("c1", "", [restored], [], 2, SampleData.timestamp).toJson())
        .answer(MethodName.AttachmentShare, () => context.share(Resources.formatDataUrl(restored.mediaType, pixels())));
      await show();
      await Wait.until(() => expect(previews()).toHaveLength(1));
      const shown = (): DOMRect[] => [box(part(".nol-teamrun-composer-image")), box(part(".nol-teamrun-composer-preview"))];
      const before = shown();

      await click(part(".nol-teamrun-composer-remove"));
      await pick([imageFile("new.png")]);
      await Wait.until(() => expect(previews().map(t => t.alt)).toEqual(["new.png"]));

      AppearanceFixture.expectPixels(before[0]!.width, AppearanceFixture.toPixels(7));
      AppearanceFixture.expectPixels(before[0]!.height, AppearanceFixture.toPixels(7));
      AppearanceFixture.expectPixels(before[1]!.left - before[0]!.left, border());
      AppearanceFixture.expectPixels(before[0]!.left, box(field()).left);
      for (const [index, after] of shown().entries())
        for (const edge of ["left", "top", "width", "height"] as const)
          AppearanceFixture.expectPixels(after[edge], before[index]![edge]);
    });

    it("lays out an attached file's type mark, an icon-sized box on the name's line, and its name half a step apart inside its row, and truncates the name at 12rem", async () => {
      await show();
      await pick([new File(["a"], `${"long-name-".repeat(10)}.txt`), new File(["a"], "notes.txt")]);
      const [first, second] = [...rows()];
      const badge = part("nol-file-badge", first);
      const glyph = box(badge);
      const name = part(".nol-teamrun-composer-attachment-name", first);

      expect([badge.getAttribute("aria-hidden"), badge.textContent?.trim(), [...first!.querySelectorAll(".material-symbols-rounded")].filter(t => !t.closest("nol-file-badge, .nol-teamrun-composer-remove")).length])
        .toEqual(["true", "description", 0]);
      AppearanceFixture.expectPixels(glyph.width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(glyph.height, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(glyph.top + glyph.height / 2, box(name).top + box(name).height / 2);
      expect(getComputedStyle(name).whiteSpace).toBe("nowrap");
      AppearanceFixture.expectPixels(glyph.left - box(first!).left, space(2) + border());
      AppearanceFixture.expectPixels(box(name).left - glyph.right, space(2));
      AppearanceFixture.expectPixels(box(name).width, AppearanceFixture.toPixels(12));
      expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
      AppearanceFixture.expectPixels(box(second!).left - box(first!).right, space(2));
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(first!).borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
    });

    it("outlines the card with a dashed line inside its edge while files are dragged over it", async () => {
      await show();
      const transfer = new DataTransfer();
      transfer.items.add(new File(["a"], "notes.txt"));

      part("form").dispatchEvent(new DragEvent("dragover", { dataTransfer: transfer, bubbles: true, cancelable: true }));
      await fixture.whenStable();
      const style = getComputedStyle(card());

      expect(style.outlineStyle).toBe("dashed");
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineWidth), border());
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineOffset), -border());
    });
  });

  describe("usage", () => {
    const withContext = (id: string, startedAt: string, used: number, compactAt: number | null = 180_000): Message =>
      new Message(id, "c1", Number(id.slice(1)), MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
        new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null,
          new ReplyUsage(1, 2, null, new ContextUsage(used, 200_000, compactAt))), SampleData.timestamp, startedAt, startedAt);
    const plan = (percent: number, readAt: string = "2026-10-22T09:00:00.000Z", providerId: string | null = "a1"): PlanUsage =>
      new PlanUsage("codex", providerId, [new PlanWindow(PlanWindowName.FiveHour, percent, null), new PlanWindow(PlanWindowName.Weekly, 20, null)], readAt);
    const gauge = (): HTMLElement | null => root().querySelector<HTMLElement>(".nol-teamrun-composer-context [role='meter']");
    const statusItem = (): StatusBarItem => context.statusBarItems.find(t => t.name === Resources.planUsageStatusItem)!;

    it("shows how full the replying session is from the chat's latest reply, and follows each new reply", async () => {
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, withContext("m2", "2026-10-22T08:00:00.000Z", 172_000)], false, false).toJson());
      const store = await prepare();
      await render();

      expect(gauge()?.textContent?.trim()).toBe("Context 86%");
      expect(gauge()?.getAttribute("aria-label")).toBe("Codex's session holds 172,000 of 200,000 tokens. It compacts at 90%.");
      context.emit(EventName.MessageCreated, withContext("m3", "2026-10-22T09:00:00.000Z", 20_000, null).toJson());
      await fixture.whenStable();
      expect(gauge()?.textContent?.trim()).toBe("Context 10%");
      expect(store.contextOf("c1", null)?.messageId).toBe("m3");
    });

    it("names the chosen teammate in the gauge's detail, and TeamRun when no provider is chosen", async () => {
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, withContext("m2", "2026-10-22T08:00:00.000Z", 50_000, null)], false, false).toJson());
      new TeammateFixture(context);
      const store = await prepare();
      remember(new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
      await render();
      await Wait.until(() => expect(store.teammate("alice")).not.toBeNull());
      context.emit(EventName.MessageCreated, new Message("m3", "c1", 3, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
        new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null,
          new ReplyUsage(1, 2, null, new ContextUsage(30_000, 200_000, null))), SampleData.timestamp, "2026-10-22T09:00:00.000Z", "2026-10-22T09:00:00.000Z", [],
        "alice", "Alice").toJson());
      await Wait.until(() => expect(gauge()?.getAttribute("aria-label")).toBe("Alice's session holds 30,000 of 200,000 tokens."));
      TestBed.resetTestingModule();
      ChatStoreService.release(context);

      context = SampleData.createContext().answer(MethodName.ProviderKindList, () => [])
        .answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, withContext("m2", "2026-10-22T08:00:00.000Z", 50_000, null)], false, false).toJson());
      await prepare();
      await render();
      await Wait.until(() => expect(gauge()?.getAttribute("aria-label")).toBe("TeamRun's session holds 50,000 of 200,000 tokens."));
    });

    it("shows no gauge when no reply in the chat sent its context", async () => {
      await prepare();
      await render();

      expect(root().querySelector("nol-teamrun-context-gauge")).toBeNull();
    });

    it("shows no notice above the box while the chosen provider is used up, tags it in the provider menu and says so beside the picker, keeps Send on, and shows none once Core lets it go",
      async () => {
        const teammates = new TeammateFixture(context);
        teammates.teammates = [new Teammate("alice", "Alice", null, "a1", Harness.Provider, null, null, "t", "t")];
        teammates.members = [new ConversationMember("c1", "alice", "t", null, false)];
        await prepare();
        remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));
        await render();
        await ready();
        const notes = (): string[] => [...root().querySelectorAll(".nol-teamrun-composer-note")].map(t => (t.textContent ?? String.empty).trim());
        const tags = (menu: Element | null | undefined): string[] => {
          if (Object.isNull(menu) || Object.isUndefined(menu))
            throw new Error("The composer shows no such menu.");
          return [...menu.querySelectorAll(".nol-menu-item-tag")].map(t => (t.textContent ?? String.empty).trim());
        };
        const windows = [new PlanWindow(PlanWindowName.FiveHour, 100, null)];
        const before = notes();

        context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z", null, true).toJson());
        await fixture.whenStable();
        await type("hello");
        const shown = notes();
        const send = sendButton()?.disabled;
        await chooseProvider();
        const providerTags = tags([...document.querySelectorAll("nol-menu")].at(-1));
        await close();
        const line = providerLine();
        context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z").toJson());
        await fixture.whenStable();

        expect(before).toEqual([]);
        expect(shown).toEqual([]);
        expect(send).toBe(false);
        expect([providerTags, line?.endsWith(Resources.usedUpLabel)]).toEqual([[Resources.usedUpLabel], true]);
        expect(notes()).toEqual([]);
      });

    it("reads the chosen provider's plan once and shows it on the status bar while the chat is shown, warning near the limit", async () => {
      PlanUsageStatus.register(context);
      context.answer(MethodName.PlanUsageRead, t => plan(64, "2026-10-22T09:00:00.000Z", PlanUsageParams.fromJson(t).providerId).toJson());
      const store = await prepare();
      await render();
      await ready();
      expect([statusItem().state(), context.count(MethodName.PlanUsageRead)]).toEqual([UsageFormatterService.hidden, 0]);

      await store.conversationInView("c1");
      await Wait.until(() => expect(statusItem().state().text).toBe("5h 64% · Week 20%"));
      const read = PlanUsageParams.fromJson(context.parametersOf(MethodName.PlanUsageRead));
      expect(read.kind).toBe("codex");
      expect([statusItem().state().icon, statusItem().state().isHidden, statusItem().state().command]).toEqual(["data_usage", false, Resources.showProvidersCommand]);
      expect(statusItem().state().tooltip).toMatch(/^Codex[^.]*\. 5-hour: 64% used, no reset time reported\. Weekly: 20% used, no reset time reported\.$/);
      context.emit(EventName.PlanUsageUpdated, plan(83, "2026-10-22T10:00:00.000Z", read.providerId).toJson());
      await fixture.whenStable();
      expect([statusItem().state().text, statusItem().state().icon]).toEqual(["5h 83% · Week 20%", "warning"]);
      expect(statusItem().state().tooltip).toMatch(/^Codex[^.]*\. Near the plan limit\. 5-hour: 83% used, no reset time reported\. Weekly: 20% used, no reset time reported\.$/);
      expect(context.count(MethodName.PlanUsageRead)).toBe(1);

      fixture.destroy();
      expect(statusItem().state()).toBe(UsageFormatterService.hidden);
    });

    it("redraws the status bar's tooltip in the new time format when the setting changes while it shows", async () => {
      PlanUsageStatus.register(context);
      TimeFormatService.register(context);
      const resetsAt = new Date(Date.now() + 60_000).toISOString();
      context.answer(MethodName.PlanUsageRead, t => new PlanUsage("codex", PlanUsageParams.fromJson(t).providerId, [new PlanWindow(PlanWindowName.FiveHour, 64, resetsAt)],
        "2026-10-22T09:00:00.000Z").toJson());
      try {
        const store = await prepare();
        await render();
        await ready();
        await store.conversationInView("c1");
        await Wait.until(() => expect(statusItem().state().tooltip).toMatch(/resets [^.]*\d{1,2}:\d{2} [AP]M\.$/u));
        context.changeSetting("desktop.timeFormat", "HH:mm");
        context.changeSetting("desktop.dateTimeFormat", "d MMM yyyy, HH:mm");

        await Wait.until(() => expect(statusItem().state().tooltip).toMatch(/resets [^.]*\d{2}:\d{2}\.$/u));
      }
      finally {
        TimeFormatService.release(context);
      }
    });

    it("says No usage reported on the status bar when the provider reports a plan with no windows", async () => {
      PlanUsageStatus.register(context);
      context.answer(MethodName.PlanUsageRead, t => new PlanUsage("codex", PlanUsageParams.fromJson(t).providerId, [], "2026-10-22T09:00:00.000Z").toJson());
      const store = await prepare();
      await render();
      await ready();
      await store.conversationInView("c1");

      await Wait.until(() => expect(statusItem().state().text).toBe("No usage reported"));
      expect([statusItem().state().isHidden, statusItem().state().icon]).toEqual([false, "data_usage"]);
      expect(statusItem().state().tooltip).toMatch(/^Codex[^.]*\. No usage reported\.$/);
    });

    it("keeps the status bar item hidden when the provider reports no plan", async () => {
      PlanUsageStatus.register(context);
      const store = await prepare();
      await render();
      await ready();
      await store.conversationInView("c1");

      await Wait.until(() => expect(context.count(MethodName.PlanUsageRead)).toBe(1));
      await fixture.whenStable();
      expect(statusItem().state()).toBe(UsageFormatterService.hidden);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the composer visible under forced colours", async () => {
      await prepare();
      await render();
      await ready();
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      await AccessibilityFixture.expectVisibleForcedAsync(root());
    });

    it("neither cuts, crosses nor loses a control in the composer at 200% zoom", async () => {
      await prepare();
      await render();
      await ready();
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      await AccessibilityFixture.expectFitsZoomedAsync(root(), () => fixture.whenStable());
    });

    it("keeps the chat's permissions menu visible under forced colours, with the chosen mode's state and each focus ring, and whole at 200% zoom", async () => {
      withModes();
      await prepare();
      remember(new ComposerSettings("codex", "gpt-5", null, "a1"));
      await render();
      await ready();
      const opened = async (): Promise<HTMLElement> => {
        await click(access());
        return required(document.querySelector<HTMLElement>("nol-menu"));
      };

      await AccessibilityFixture.expectVisibleForcedAsync(await opened());
      if (!Object.isNull(document.querySelector("nol-menu")))
        await click(access());
      await Wait.until(() => expect(document.querySelector("nol-menu")).toBeNull());
      await AccessibilityFixture.zoomedAsync(async () => {
        await AccessibilityFixture.expectFitsZoomedAsync(await opened(), () => fixture.whenStable());
        await click(access());
      });
    });

    it("keeps the mention list whole when it opens at 200% zoom, and marks its active teammate apart from the others under forced colours", async () => {
      const teammates = new TeammateFixture(context);
      teammates.teammates = ["alice", "bob", "carol"].map(t => new Teammate(t, t, null, "a1", Harness.Provider, null, null, "t", "t"));
      teammates.members = ["alice", "bob"].map(t => new ConversationMember("c1", t, "t", null, false));
      await prepare();
      remember(new ComposerSettings("codex", null, null, "a1"));
      await render();
      const open = async (): Promise<HTMLElement> => {
        await type("@");
        await Wait.until(() => expect(names().length).toBeGreaterThan(1));
        return required(document.querySelector<HTMLElement>("nol-mention-list"));
      };
      const zoomed = await AccessibilityFixture.zoomedAsync(async () => {
        const shown = await open();
        await fixture.whenStable();
        const found = { clipped: AccessibilityFixture.clipped(shown), overlapping: AccessibilityFixture.overlapping(shown), outside: AccessibilityFixture.outside(shown) };
        await key("Escape");
        await type("");
        return found;
      });
      const list = await open();
      const look = (option: Element): string => ["background-color", "color", "outline-style", "outline-color", "border-top-color", "box-shadow"]
        .map(t => getComputedStyle(option).getPropertyValue(t)).join("|");
      const options = (selected: string): string[] => [...list.querySelectorAll(`[role='option'][aria-selected='${selected}']`)].map(look);

      const [active, others] = await AccessibilityFixture.forcedAsync(async (): Promise<readonly [string[], string[]]> => {
        await fixture.whenStable();
        return [options("true"), options("false")];
      });
      expect([active.length, others.length > 0, others.filter(t => active.includes(t))]).toEqual([1, true, []]);
      expect(zoomed, JSON.stringify(zoomed)).toEqual({ clipped: [], overlapping: [], outside: [] });
      await key("Escape");
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the composer by keyboard, with a visible ring", async () => {
      await prepare();
      await render();
      await ready();
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      expect(await AccessibilityFixture.expectKeyboardAsync(root())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the composer", async () => {
      await prepare();
      await render();
      await ready();
      await pick([imageFile("image.png")]);
      await Wait.until(() => expect(previews()).toHaveLength(1));
      expect(AccessibilityFixture.expectNamed(root())).toBeGreaterThan(0);
    });
  });
});
