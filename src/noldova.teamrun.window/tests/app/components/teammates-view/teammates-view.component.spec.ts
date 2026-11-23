/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  AuthStatus, Conversation, ConversationCreateParams, ConversationListParams, ConversationMemberParams, DefaultTeammate, DefaultTeammateSetParams, EventName, Harness,
  MethodName, PlanUsage, PlanWindow, PlanWindowName, Provider, ProviderKind, ProviderModel, ProviderModelList, RequestedSettings, Teammate, TeammateIdParams
} from "@noldova/teamrun.protocol";
import { AvatarComponent, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { TeammatesViewComponent } from "../../../../src/app/components/teammates-view/teammates-view.component";
import { ComposerSettings } from "../../../../src/app/models/composer-settings";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { CommandTargetsService } from "../../../../src/app/services/command-targets.service";
import { ComposerChoicesService } from "../../../../src/app/services/composer-choices.service";
import { ComposerDefaultService } from "../../../../src/app/services/composer-default.service";
import { ConversationActions } from "../../../../src/app/services/conversation-actions";
import { EngineResync } from "../../../../src/app/services/engine-resync";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PointerEventsFixture } from "../../../fixtures/pointer-events.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammatesViewComponent", () => {
  let context: FakeWindowPartContext;
  let data: TeammateFixture;
  let fixture: ComponentFixture<TeammatesViewComponent>;
  let store: ChatStoreService;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const row = (name: string): HTMLElement => {
    const found = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-item")].find(t => t.querySelector(".nol-teamrun-item-name")?.textContent === name);
    if (Object.isUndefined(found))
      throw new Error(`No row shows ${name}.`);
    return found;
  };
  const button = (selector: string, root: ParentNode = element()): HTMLButtonElement => {
    const found = root.querySelector<HTMLButtonElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const onDisabledProvider = (context: FakeWindowPartContext): void => {
    const off = new Provider("a2", "codex", "Off", "D:\profiles\off", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, false);
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), off.toJson()]);
    data.teammates.push(new Teammate("carol", "Carol", null, "a2", Harness.Provider, null, null, "t", "t"));
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    data = new TeammateFixture(context);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(TeammatesViewComponent);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await settle();
  };

  let park: HTMLElement | null = null;
  const parkPointerAsync = async (): Promise<void> => {
    park = await AppearanceFixture.parkPointerAsync();
  };

  afterEach(() => {
    park?.remove();
    park = null;
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    ChatStoreService.release(context);
    ComposerDefaultService.release(context);
    localStorage.removeItem(Resources.composerChoicesStorageKey);
  });

  it("names the effort of a teammate on its provider's default model as the provider's model list does", async () => {
    await create(t => {
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5", "gpt-5", "Fixture", ["high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" })]));
      data.teammates = [new Teammate("erin", "Erin", null, "a1", Harness.Provider, null, "xhigh", "t", "t")];
    });

    await Wait.until(() => expect(texts(".nol-teamrun-effort")).toEqual(["Extra high"]));
  });

  it("lists the teammates with their provider, model and effort, in the window's own store", async () => {
    await create();

    expect(fixture.debugElement.injector.get(ChatStoreService)).toBe(store);
    const teammates = element().querySelector(".nol-teamrun-teammates")!;
    expect(texts(".nol-configuration-table-heading")).toEqual(["Default teammate", "Teammates"]);
    expect(texts(".nol-configuration-table-explanation", teammates)).toEqual(["Create and configure teammates here. Add them to a chat using its member strip or an @mention."]);
    expect(texts("th", teammates)).toEqual([Resources.teammateNameLabel, Resources.connectionColumn, Resources.modelLabel, Resources.effortLabel, String.empty]);
    expect(teammates.querySelectorAll("th")[4]?.getAttribute("aria-label")).toBe(Resources.actionsColumn);
    expect(texts(".nol-teamrun-item-name")).toEqual(["Alice", "Bob", "Offline"]);
    expect(texts(".nol-teamrun-connection")).toEqual(["Codex · Work", "Codex · Work", Resources.unavailableTeammateLabel]);
    expect(texts(".nol-teamrun-model-name")).toEqual(["gpt-5", Resources.providerDefaultModel, Resources.providerDefaultModel]);
    expect(texts(".nol-teamrun-effort")).toEqual(["High", Resources.modelDefaultEffort, Resources.modelDefaultEffort]);
    expect(row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Alice · Codex · Work · gpt-5 · High");
    expect(row("Alice").querySelector("nol-avatar")?.textContent?.trim()).toBe("A");
    expect(row("Offline").querySelector("nol-avatar")?.getAttribute("aria-label"))
      .toBe(`Offline · ${Resources.unavailableTeammateLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}, unavailable`);
    expect(row("Offline").querySelector(".nol-avatar-unavailable")).not.toBeNull();
    expect(row("Alice").querySelector(".nol-avatar-unavailable")).toBeNull();
    expect(button(".nol-teamrun-edit", row("Alice")).getAttribute("aria-label")).toBe("Edit Alice");
    expect(button(".nol-teamrun-delete", row("Alice")).getAttribute("aria-label")).toBe("Delete teammate Alice");
    expect(button(".nol-teamrun-delete", row("Alice")).classList).toContain("nol-icon-button-danger");
    expect(element().querySelectorAll(".nol-icon-button-danger")).toHaveLength(element().querySelectorAll(".nol-teamrun-delete").length);
  });

  it("names each teammate's provider on its avatar as on its row, so two providers of one kind read apart", async () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    await create(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()]);
      data.teammates.push(new Teammate("pam", "Pam", null, "a3", Harness.Provider, "gpt-5", "high", "t", "t"));
    });

    expect(texts(".nol-teamrun-connection", row("Alice"))).toEqual(["Codex · Work"]);
    expect(texts(".nol-teamrun-connection", row("Pam"))).toEqual(["Codex · Personal"]);
    expect(row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Alice · Codex · Work · gpt-5 · High");
    expect(row("Pam").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Pam · Codex · Personal · gpt-5 · High");
  });

  it("says a teammate on a used-up provider is Used up under its connection until Core lets it go, and a teammate on another provider isn't", async () => {
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 100, null)];
    await create(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()]);
      t.answer(MethodName.PlanUsageList, () => [new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z", null, true).toJson()]);
      data.teammates.push(new Teammate("pam", "Pam", null, "a3", Harness.Provider, "gpt-5", "high", "t", "t"));
    });
    await Wait.until(() => expect(texts(".nol-teamrun-used-up", row("Alice"))).toEqual([Resources.usedUpLabel]));
    const pam = texts(".nol-teamrun-used-up", row("Pam"));

    context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z").toJson());
    await settle();

    expect(pam).toEqual([]);
    expect(texts(".nol-teamrun-connection-name", row("Alice"))).toEqual(["Codex · Work"]);
    expect(texts(".nol-teamrun-used-up")).toEqual([]);
  });

  it("names a provider named after its kind by the kind alone, enabled or disabled", async () => {
    const named = new Provider("a3", "codex", "Codex", "D:/named", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const off = new Provider("a4", "codex", "Codex", "D:/named-off", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, false);
    await create(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), named.toJson(), off.toJson()]);
      data.teammates.push(new Teammate("nia", "Nia", null, "a3", Harness.Provider, "gpt-5", "high", "t", "t"),
        new Teammate("oto", "Oto", null, "a4", Harness.Provider, "gpt-5", "high", "t", "t"));
    });

    expect(texts(".nol-teamrun-connection", row("Nia"))).toEqual(["Codex"]);
    expect(texts(".nol-teamrun-connection", row("Oto (provider disabled)"))).toEqual(["Codex (disabled)"]);
    expect(row("Nia").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Nia · Codex · gpt-5 · High");
  });

  it("sorts the teammates by name, ignoring case with an accented name beside its letter", async () => {
    await create(() => {
      data.teammates = ["zoe", "Émile", "bob", "Alice", "edgar"].map(t => new Teammate(t, t, null, "a1", Harness.Provider, null, null, "t", "t"));
    });

    expect(texts(".nol-teamrun-item-name")).toEqual(["Alice", "bob", "edgar", "Émile", "zoe"]);
  });

  it("greys a teammate on a disabled provider, says so after its name, and names its provider as disabled", async () => {
    await create(onDisabledProvider);
    const carol = row("Carol (provider disabled)");

    expect(texts(".nol-teamrun-item-name")).toEqual(["Alice", "Bob", "Carol (provider disabled)", "Offline"]);
    expect(texts(".nol-teamrun-connection", carol)).toEqual(["Codex · Off (disabled)"]);
    expect(carol.querySelector(".nol-avatar-unavailable")).not.toBeNull();
    expect(carol.querySelector(".nol-teamrun-item-name")?.classList).toContain("nol-teamrun-unavailable");
    expect(texts(".nol-teamrun-connection", row("Alice"))).toEqual(["Codex · Work"]);
  });

  it("names a default teammate's provider as disabled", async () => {
    await create(t => {
      onDisabledProvider(t);
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", null, null), "a2").toJson());
    });

    expect(texts(".nol-teamrun-default-connection")).toEqual(["Codex · Off (disabled)"]);
  });

  it("shows Last message sent until a default teammate is chosen in its dialog, then its provider, model and effort, and clears it", async () => {
    let stored: JsonValue = null;
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => stored)
      .answer(MethodName.DefaultTeammateSet, u => stored = DefaultTeammateSetParams.fromJson(u).defaultTeammate?.toJson() ?? null));
    const sets = (): JsonValue[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DefaultTeammateSet)).map(t => t.parameters);
    const bounds = (target: Element): number[] => [target.getBoundingClientRect().left, target.getBoundingClientRect().right];
    const expectChangeOverEdit = (): void => bounds(button(".nol-teamrun-edit", row("Bob")))
      .forEach((edge, index) => expect(Math.abs(edge - bounds(button(".nol-teamrun-change-default"))[index]!)).toBeLessThan(0.5));
    const reachable = (): number => element().querySelectorAll(".nol-teamrun-default-row button:not([inert])").length;

    expect(texts(".nol-teamrun-default-teammate .nol-configuration-table-explanation")).toEqual([Resources.defaultTeammateHint]);
    expect(texts(".nol-teamrun-default-connection")).toEqual([Resources.lastMessageSentLabel]);
    expect(element().querySelector(".nol-teamrun-clear-default")).toBeNull();
    expect(button(".nol-teamrun-change-default").getAttribute("aria-label")).toBe(Resources.changeDefaultTeammateLabel);
    expectChangeOverEdit();
    expect(reachable()).toBe(1);
    button(".nol-teamrun-change-default").click();
    await settle();
    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.defaultTeammateTitle);
    expect([document.querySelector(".nol-teamrun-teammate-name"), document.querySelector(".nol-teamrun-teammate-role")]).toEqual([null, null]);
    button(".nol-teamrun-save", document).click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")).toBeNull();
    expect(sets()).toEqual([new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("codex", null, null), "a1")).toJson()]);
    expect([texts(".nol-teamrun-default-connection"), texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")])
      .toEqual([["Codex · Work"], [Resources.providerDefaultModel], [Resources.modelDefaultEffort]]);
    expect(button(".nol-teamrun-clear-default").getAttribute("aria-label")).toBe(Resources.clearDefaultTeammateLabel);
    expect(button(".nol-teamrun-clear-default").textContent?.trim()).toBe(Resources.closeIcon);
    expectChangeOverEdit();
    expect(reachable()).toBe(2);
    const edges = (table: string): number[] => [...element().querySelectorAll(`${table} thead th`)].slice(-3).flatMap(t => [t.getBoundingClientRect().left, t.getBoundingClientRect().right]);
    const chosen = edges(".nol-teamrun-default-teammate");
    expect(chosen).toHaveLength(6);
    edges(".nol-teamrun-teammates").forEach((edge, index) => expect(Math.abs(edge - chosen[index]!)).toBeLessThan(0.5));

    button(".nol-teamrun-clear-default").click();
    await settle();
    expect(sets().at(-1)).toEqual({ defaultTeammate: null });
    expect(texts(".nol-teamrun-default-connection")).toEqual([Resources.lastMessageSentLabel]);
  });

  it("opens the default teammate's dialog on its Provider button, and moves the focus from Clear to Change once the default is cleared", async () => {
    let stored: JsonValue = new DefaultTeammate(new RequestedSettings("codex", null, null), "a1").toJson();
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => stored)
      .answer(MethodName.DefaultTeammateSet, u => stored = DefaultTeammateSetParams.fromJson(u).defaultTeammate?.toJson() ?? null));

    button(".nol-teamrun-change-default").focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(document.activeElement).toBe(document.querySelector(".nol-teamrun-provider button")));
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());
    button(".nol-teamrun-clear-default").focus();
    await userEvent.keyboard("{Enter}");

    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-change-default")));
    expect([element().querySelector(".nol-teamrun-clear-default"), stored]).toEqual([null, null]);
  });

  it("keeps the focus on Clear when clearing the default teammate fails, and shows the failure", async () => {
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", null, null), "a1").toJson())
      .fail(MethodName.DefaultTeammateSet, "The settings are read-only"));

    button(".nol-teamrun-clear-default").focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-error")).not.toBeNull());
    await settle();

    expect(document.activeElement).toBe(button(".nol-teamrun-clear-default"));
  });

  it("names the default teammate's model and effort from its provider's catalog when no listed teammate chooses either there", async () => {
    await create(t => {
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5", "GPT-5", "Fixture", ["high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" })]));
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "xhigh"), "a1").toJson());
      data.teammates = [new Teammate("erin", "Erin", null, "a1", Harness.Provider, null, null, "t", "t")];
    });

    await Wait.until(() => expect([texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")]).toEqual([["GPT-5"], ["Extra high"]]));
  });

  it("names the default teammate's model and effort after a resync when its provider's catalog couldn't be read before", async () => {
    let reachable = false;
    await create(t => {
      t.answer(MethodName.ProviderModelCatalog, () => {
        if (!reachable)
          throw new Error("offline");
        return SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "Fixture", ["high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" })]);
      });
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "xhigh"), "a1").toJson());
      data.teammates = [new Teammate("erin", "Erin", null, "a1", Harness.Provider, null, null, "t", "t")];
    });
    await Wait.until(() => expect(context.count(MethodName.ProviderModelCatalog)).toBe(1));
    await settle();
    expect([texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")]).toEqual([["gpt-5"], ["Xhigh"]]);
    reachable = true;

    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect([texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")]).toEqual([["GPT-5"], ["Extra high"]]));
  });

  it("says a default teammate saved without a provider has no provider chosen", async () => {
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", null, null)).toJson()));

    expect([texts(".nol-teamrun-default-connection"), texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")])
      .toEqual([["Codex · No provider chosen"], [Resources.providerDefaultModel], [Resources.modelDefaultEffort]]);
  });

  it("opens the default teammate's dialog when asked, with its choice, and can't save a choice whose provider is gone", async () => {
    const gone = new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "gone");
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => gone.toJson()));

    expect([texts(".nol-teamrun-default-connection"), texts(".nol-teamrun-default-model"), texts(".nol-teamrun-default-effort")])
      .toEqual([[Resources.unavailableTeammateLabel], ["gpt-5"], ["High"]]);
    store.askForDefaultTeammate();
    await settle();

    expect(store.defaultTeammateAsked()).toBe(false);
    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.defaultTeammateTitle);
    expect(button(".nol-teamrun-save", document).disabled).toBe(true);
  });

  it("names each row action in the kit's tooltip, and keeps the row's name in its accessible name", async () => {
    await parkPointerAsync();
    await create();
    const tooltipOf = async (target: HTMLElement, isRealPointer: boolean = false): Promise<string | null> => {
      if (isRealPointer)
        await userEvent.hover(target);
      else
        PointerEventsFixture.enter(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      if (isRealPointer)
        await userEvent.unhover(target);
      else
        PointerEventsFixture.leave(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(await tooltipOf(button(".nol-teamrun-edit", row("Bob")), true)).toBe(Resources.editLabel);
    expect(await tooltipOf(button(".nol-teamrun-new-chat", row("Bob")))).toBe(Resources.newConversationLabel);
    expect(await tooltipOf(button(".nol-teamrun-delete", row("Bob")))).toBe(Resources.deleteTeammateLabel);
    expect([...row("Bob").querySelectorAll("button")].map(t => t.getAttribute("aria-label"))).toEqual(["Edit Bob", "New chat with Bob", "Delete teammate Bob"]);
  });

  it("runs each row action from the keyboard", async () => {
    await create();
    button(".nol-teamrun-edit", row("Alice")).focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editTeammateLabel));
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());

    button(".nol-teamrun-delete", row("Bob")).focus();
    await userEvent.keyboard(" ");

    await Wait.until(() => expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.deleteTeammateLabel));
  });

  it("names a teammate's default model as its provider's kind does, and Default model when its provider is gone", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [new ProviderKind("codex", "Codex", true, false, "Auto").toJson()]));

    expect(texts(".nol-teamrun-model-name")).toEqual(["gpt-5", "Auto", Resources.providerDefaultModel]);
    expect(row("Bob").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe(`Bob · Codex · Work · Auto · ${Resources.modelDefaultEffort}`);
    expect(row("Offline").querySelector("nol-avatar")?.getAttribute("aria-label"))
      .toBe(`Offline · ${Resources.unavailableTeammateLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}, unavailable`);
  });

  it.each([
    ["no longer lists it", (): JsonValue => SampleData.catalog([new ProviderModel("gpt-5-mini", "gpt-5-mini", "Fixture", ["high"], true, null, true)]),
      Resources.formatUnlisted("gpt-5")],
    ["lists none, as a provider that can't list them", (): JsonValue => SampleData.catalog([]), "gpt-5"],
    ["says its list came back empty", (): JsonValue => new ProviderModelList([], true, true).toJson(), "gpt-5"],
    ["can't be reached", (): JsonValue => {
      throw new Error("offline");
    }, "gpt-5"]
  ])("marks a teammate's model as not in the catalog only when its provider %s", async (_, catalog, shown) => {
    await create(t => t.answer(MethodName.ProviderModelCatalog, catalog));
    await Wait.until(() => expect(context.count(MethodName.ProviderModelCatalog)).toBe(1));
    await settle();

    expect(texts(".nol-teamrun-model-name")).toEqual(["gpt-5", Resources.providerDefaultModel, Resources.providerDefaultModel]);
    expect(texts(".nol-teamrun-model-note")).toEqual(shown === "gpt-5" ? [] : [Resources.notInCatalogNote]);
    expect(row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe(`Alice · Codex · Work · ${shown} · High`);
  });

  it.each([
    { cause: "the runtime asks for a resync", resync: (): void => context.emit(EventName.StateResyncRequested, null) },
    { cause: "the window reconnects", resync: (): void => {
      EngineResync.request(context);
      void ChatStoreService.resync(context);
    } }
  ])("asks a teammate's provider for its models again after $cause, while the providers are still being read, and drops the note once the new list has its model", async ({ resync }) => {
    let models = [new ProviderModel("gpt-5-mini", "gpt-5-mini", "Fixture", ["high"], true, null, true)];
    await create(t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(models)));
    await Wait.until(() => expect(texts(".nol-teamrun-model-note")).toEqual([Resources.notInCatalogNote]));
    const asked = context.count(MethodName.ProviderModelCatalog);
    models = [...models, new ProviderModel("gpt-5", "gpt-5", "Fixture", ["high"], false, null, true)];
    const providers = new DeferredResponse();
    context.answer(MethodName.ProviderList, () => providers.promise);

    resync();

    await Wait.until(() => expect(texts(".nol-teamrun-model-note")).toEqual([]));
    expect(context.count(MethodName.ProviderModelCatalog)).toBeGreaterThan(asked);
    providers.resolve([SampleData.provider.toJson()]);
    await settle();
  });

  it("keeps the list read after a resync when the one asked before it answers last", async () => {
    const before = new DeferredResponse();
    const after = new DeferredResponse();
    let asked = 0;
    await create(t => t.answer(MethodName.ProviderModelCatalog, () => ++asked === 1 ? before.promise : after.promise));
    await Wait.until(() => expect(asked).toBe(1));

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(asked).toBe(2));
    after.resolve(SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["high"], true, null, true, "high", { high: "Deep" })]));
    await Wait.until(() => expect(row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Alice · Codex · Work · gpt-5 · Deep"));
    before.resolve(SampleData.catalog([new ProviderModel("gpt-5-mini", "gpt-5-mini", "Fixture", ["high"], true, null, true)]));
    await settle();

    expect([texts(".nol-teamrun-model-note"), row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")]).toEqual([[], "Alice · Codex · Work · gpt-5 · Deep"]);
  });

  it("shows a teammate saved with a level's id at that level, not as a model the catalog doesn't list", async () => {
    await create(t => {
      data.teammates = [new Teammate("alice", "Alice", null, "a1", data.alice.harness, "flash-medium", null, "t", "t")];
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("flash", "Flash", "", ["flash-low", "flash-medium"], true, null, true, "flash-low", { "flash-low": "Low", "flash-medium": "Medium" })]));
    });
    await Wait.until(() => expect(context.count(MethodName.ProviderModelCatalog)).toBe(1));
    await settle();

    expect(texts(".nol-teamrun-model-note")).toEqual([]);
    expect(row("Alice").querySelector("nol-avatar")?.getAttribute("aria-label")).toBe("Alice · Codex · Work · flash-medium · Medium");
  });

  it("shows a name with spaces whole, with the initials of its first two words on its avatar", async () => {
    await create(() => data.teammates.push(data.reviewer));

    expect(texts(".nol-teamrun-item-name")).toEqual(["Alice", "Bob", "Code Reviewer", "Offline"]);
    expect(row("Code Reviewer").querySelector("nol-avatar")?.textContent?.trim()).toBe("CR");
    expect(row("Bob").querySelector("nol-avatar")?.textContent?.trim()).toBe("B");
    expect(button(".nol-teamrun-edit", row("Code Reviewer")).getAttribute("aria-label")).toBe("Edit Code Reviewer");
  });

  it("names a provider it doesn't know by its id, and says when there are no teammates", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.claude.toJson()]));

    expect(texts(".nol-teamrun-connection")).toEqual(["codex · Work", "codex · Work", Resources.unavailableTeammateLabel]);

    data.teammates = [];
    await store.initialize();
    await settle();

    expect(texts(".nol-teamrun-teammates tbody td")).toEqual(["No teammates yet"]);
  });

  it("adds a teammate in its dialog, which closes once the teammate is saved", async () => {
    await create();

    button(".nol-teamrun-add").click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.addTeammateLabel);
    expect(document.activeElement?.classList.contains("nol-teamrun-teammate-name")).toBe(true);

    const name = document.querySelector<HTMLInputElement>(".nol-teamrun-teammate-name");
    if (Object.isNull(name))
      throw new Error("The dialog shows no name field.");
    name.value = "Carol";
    name.dispatchEvent(new Event("input"));
    await settle();
    button(".nol-teamrun-save", document).click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")).toBeNull();
    expect(texts(".nol-teamrun-item-name")).toContain("Carol");
  });

  it("edits a teammate in its dialog, and closes it from Close without saving", async () => {
    await create();

    button(".nol-teamrun-edit", row("Alice")).click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editTeammateLabel);
    expect(document.querySelector<HTMLInputElement>(".nol-teamrun-teammate-name")?.value).toBe("Alice");

    button(".nol-teamrun-cancel", document).click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")).toBeNull();
    expect(context.count(MethodName.TeammateUpdate)).toBe(0);
  });

  it("deletes a teammate only once the person confirms", async () => {
    await create();

    button(".nol-teamrun-delete", row("Bob")).click();
    await settle();

    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.deleteTeammateLabel);
    expect(document.body.textContent).toContain(Resources.formatDeleteTeammate("Bob"));
    expect(document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()).toBe("Delete teammate");
    expect(button(".nol-teamrun-confirm", document).classList).toContain("nol-button-danger");

    button(".nol-teamrun-cancel", document).click();
    await settle();

    expect(context.count(MethodName.TeammateDelete)).toBe(0);

    button(".nol-teamrun-delete", row("Bob")).click();
    await settle();
    button(".nol-teamrun-confirm", document).click();
    await settle();

    expect(TeammateIdParams.fromJson(context.parametersOf(MethodName.TeammateDelete)).teammateId).toBe("bob");
    expect(texts(".nol-teamrun-item-name")).toEqual(["Alice", "Offline"]);
  });

  it("moves the focus to the next teammate's Delete once one is deleted, to the one before for the last, and to Add once none is left", async () => {
    await create();
    const confirmDelete = async (name: string): Promise<void> => {
      const remove = button(".nol-teamrun-delete", row(name));
      remove.focus();
      remove.click();
      await settle();
      button(".nol-teamrun-confirm", document).click();
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-confirm")).toBeNull());
    };

    await confirmDelete("Bob");
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-delete", row("Offline"))));
    await confirmDelete("Offline");
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-delete", row("Alice"))));
    await confirmDelete("Alice");

    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-add")));
    expect(texts(".nol-teamrun-item-name")).toEqual([]);
  });

  it("leaves a focus the person moved while a teammate's delete runs", async () => {
    const deleting = new DeferredResponse();
    await create(t => t.answer(MethodName.TeammateDelete, () => deleting.promise));
    const remove = button(".nol-teamrun-delete", row("Bob"));
    remove.focus();
    remove.click();
    await settle();
    button(".nol-teamrun-confirm", document).click();
    await Wait.until(() => expect(context.count(MethodName.TeammateDelete)).toBe(1));
    const add = button(".nol-teamrun-add");

    add.focus();
    deleting.resolve(null);
    await Wait.until(() => expect(texts(".nol-teamrun-item-name")).not.toContain("Bob"));
    await settle();

    expect(document.activeElement).toBe(add);
  });

  describe("New chat", () => {
    const created = new Conversation("c7", "p1", "New chat", SampleData.timestamp, SampleData.timestamp);
    const choice = (): ComposerSettings | null => TestBed.inject(ComposerChoicesService).choiceOf("c7");

    it("starts a chat in the selected project with the teammate in it, answering with the teammate's settings", async () => {
      await create(t => t.answer(MethodName.ConversationCreate, u => data.start(u, created).toJson()));

      expect(button(".nol-teamrun-new-chat", row("Alice")).getAttribute("aria-label")).toBe(Resources.formatNewChatWith("Alice"));
      button(".nol-teamrun-new-chat", row("Alice")).click();
      await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));

      expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams("p1", null, "alice"));
      expect(context.count(MethodName.ConversationAddMember)).toBe(0);
      expect(store.membersOf("c7").map(t => t.teammateId)).toEqual(["alice"]);
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["c7"]);
      expect(choice()).toEqual(new ComposerSettings("codex", "gpt-5", "high", "a1", "alice"));
    });

    it("brings forward the project's empty chat it started with the teammate, or with no one and adds the teammate, and starts another for a different teammate", async () => {
      const ids = ["c7", "c8", "c9"];
      await create(t => SampleData.keepCreatedEmpty(t, u => data.start(u, new Conversation(ids[context.count(MethodName.ConversationCreate) - 1]!, "p1", "New chat",
        SampleData.timestamp, SampleData.timestamp))));
      const added = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationAddMember)).map(t => ConversationMemberParams.fromJson(t.parameters))
        .map(t => `${t.conversationId} ${t.teammateId}`);
      const startedWith = (): (string | null)[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationCreate))
        .map(t => ConversationCreateParams.fromJson(t.parameters).teammateId);
      const startAsync = async (name: string, kept: number): Promise<void> => {
        button(".nol-teamrun-new-chat", row(name)).click();
        await Wait.until(() => expect(context.keptDocuments).toHaveLength(kept));
      };

      await startAsync("Alice", 1);
      await startAsync("Alice", 2);
      await startAsync("Bob", 3);
      expect([startedWith(), added()]).toEqual([["alice", "bob"], []]);
      await ConversationActions.start(context, store, "p1");
      for (const typed of ["c7", "c8"])
        CommandTargetsService.of(context).provideComposer(typed, () => undefined, () => false);
      await startAsync("Bob", 5);

      expect(startedWith()).toEqual(["alice", "bob", null]);
      expect(added()).toEqual(["c9 bob"]);
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["c7", "c7", "c8", "c9", "c9"]);
      expect(TestBed.inject(ComposerChoicesService).choiceOf("c9")).toEqual(new ComposerSettings("codex", null, null, "a1", "bob"));
    });

    it("shows why the chat can't start with the teammate, and opens nothing and remembers nothing", async () => {
      await create(t => t.fail(MethodName.ConversationCreate, "Teammate is gone"));

      button(".nol-teamrun-new-chat", row("Alice")).click();
      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["Teammate is gone"]));
      expect(context.shownNotices()).toEqual([]);
      expect([context.count(MethodName.ConversationCreate), context.count(MethodName.ConversationAddMember)]).toEqual([1, 0]);
      expect(context.openedDocuments).toEqual([]);
      expect(context.keptDocuments).toEqual([]);
      expect(choice()).toBeNull();
    });

    it("shows why an empty chat it brings forward can't take the teammate, and opens nothing more", async () => {
      await create(t => SampleData.keepCreatedEmpty(t, u => data.start(u, created)).fail(MethodName.ConversationAddMember, "Teammate is gone"));
      await ConversationActions.start(context, store, "p1");
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["c7"]);

      button(".nol-teamrun-new-chat", row("Alice")).click();
      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["Teammate is gone"]));
      expect(context.shownNotices()).toEqual([]);
      expect([context.count(MethodName.ConversationCreate), context.count(MethodName.ConversationAddMember)]).toEqual([1, 1]);
      expect(ConversationMemberParams.fromJson(context.parametersOf(MethodName.ConversationAddMember))).toEqual(new ConversationMemberParams("c7", "alice"));
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["c7"]);
    });

    it.each([MethodName.ConversationListEmpty, MethodName.ConversationListMembers, MethodName.ConversationTouch])(
      "shows on the page why %s failed while New chat brings forward the teammate's empty chat, and posts no notice", async method => {
        await create(t => SampleData.keepCreatedEmpty(t, u => data.start(u, created)));
        button(".nol-teamrun-new-chat", row("Alice")).click();
        await Wait.until(() => expect(context.keptDocuments).toHaveLength(1));
        context.fail(method, "The runtime stopped.");

        button(".nol-teamrun-new-chat", row("Alice")).click();

        await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The runtime stopped."]));
        expect([context.shownNotices(), context.keptDocuments.length]).toEqual([[], 1]);
      });

    it("answers with a teammate whose provider is gone on the default settings, in the default mode, so the composer shows it unavailable", async () => {
      await create(t => t.answer(MethodName.ConversationCreate, u => data.start(u, created).toJson()));

      button(".nol-teamrun-new-chat", row("Offline")).click();
      await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));
      expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams("p1", null, "offline"));
      expect(choice()).toEqual(new ComposerSettings("codex", null, null, null, "offline"));

      ComposerDefaultService.of(context).remember(new ComposerSettings("claude", "opus", "max", "a2", null, null, "plan"));
      button(".nol-teamrun-new-chat", row("Offline")).click();
      await Wait.until(() => expect(choice()).toEqual(new ComposerSettings("claude", "opus", "max", "a2", "offline")));
    });

    it("answers with a teammate whose provider is gone on the default teammate's settings rather than the last message sent", async () => {
      await create(t => t.answer(MethodName.ConversationCreate, u => data.start(u, created).toJson())
        .answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("claude", "opus", "max"), "a2").toJson()));
      ComposerDefaultService.of(context).remember(new ComposerSettings("codex", "gpt-5", "high", "a1"));

      button(".nol-teamrun-new-chat", row("Offline")).click();
      await Wait.until(() => expect(choice()).toEqual(new ComposerSettings("claude", "opus", "max", "a2", "offline")));
    });

    it("opens the chat with a teammate whose provider is gone and remembers nothing while no provider is listed", async () => {
      await create(t => t.answer(MethodName.ConversationCreate, u => data.start(u, created).toJson()).answer(MethodName.ProviderKindList, () => []));

      button(".nol-teamrun-new-chat", row("Offline")).click();
      await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));
      await settle();
      expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams("p1", null, "offline"));
      expect(choice()).toBeNull();
    });

    it("starts a chat without a project with the teammate while a chat without a project is shown, asking for no folder", async () => {
      const scratch = new Conversation("c3", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c3");
      await create(t => t.answer(MethodName.ConversationList, u => Object.isNull(ConversationListParams.fromJson(u).projectId) ? [scratch.toJson()] : [])
        .answer(MethodName.ConversationCreate, u => data.start(u, new Conversation("c7", null, "New chat", SampleData.timestamp, SampleData.timestamp, false, null, null, false,
          "/data/chats/c7")).toJson()));
      await store.selectConversation("c3");
      expect([store.projects().length, store.selectedProjectId()]).toEqual([1, null]);

      button(".nol-teamrun-new-chat", row("Alice")).click();
      await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));

      expect(context.folderChoices).toBe(0);
      expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams(null, null, "alice"));
      expect(context.count(MethodName.ConversationAddMember)).toBe(0);
      expect(choice()).toEqual(new ComposerSettings("codex", "gpt-5", "high", "a1", "alice"));
    });
  });

  it("shows a failed change until the person dismisses it", async () => {
    await create(t => t.fail(MethodName.TeammateDelete, "Teammate is in use"));

    button(".nol-teamrun-delete", row("Bob")).click();
    await settle();
    button(".nol-teamrun-confirm", document).click();
    await settle();

    expect(texts(".nol-teamrun-error-text")).toEqual(["@Bob: Teammate is in use"]);
    expect(texts(".nol-teamrun-dismiss")).toEqual(["Dismiss"]);

    button(".nol-teamrun-dismiss").click();
    await settle();

    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("paints each teammate's avatar in the colour the store gives it by when it was made", async () => {
    await create();
    const fill = (name: string): string | undefined => row(name).querySelector<HTMLElement>("nol-avatar")?.style.getPropertyValue("--nol-avatar-fill");
    const kit = TestBed.createComponent(AvatarComponent);
    kit.componentRef.setInput("name", "Alice");
    const paint = (color: number | null): string => {
      kit.componentRef.setInput("color", color);
      kit.detectChanges();
      return (kit.nativeElement as HTMLElement).style.getPropertyValue("--nol-avatar-fill");
    };

    expect([fill("Alice"), fill("Bob"), store.teammateColor("alice"), store.teammateColor("bob")]).toEqual([paint(2), paint(3), 2, 3]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const part = (root: ParentNode, selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found;
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("shows a teammate's small avatar centered beside the name half a rem from it, and a row's icon buttons with their targets touching, Delete in the danger colour", async () => {
      await create();
      const name = part(row("Alice"), ".nol-teamrun-name");
      const avatar = box(part(name, "nol-avatar"));
      const text = box(part(name, ".nol-teamrun-item-name"));
      const edit = box(button(".nol-teamrun-edit", row("Alice")));
      const newChat = box(button(".nol-teamrun-new-chat", row("Alice")));
      const remove = box(button(".nol-teamrun-delete", row("Alice")));

      AppearanceFixture.expectPixels(avatar.width, AppearanceFixture.measureLook("avatar-small"));
      AppearanceFixture.expectPixels(avatar.height, AppearanceFixture.measureLook("avatar-small"));
      AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, text.top + text.height / 2);
      AppearanceFixture.expectPixels(text.left - avatar.right, space(2));
      AppearanceFixture.expectPixels(newChat.left, edit.right);
      AppearanceFixture.expectPixels(remove.left, newChat.right);
      AppearanceFixture.expectPixels(newChat.top, edit.top);
      AppearanceFixture.expectPixels(remove.top, edit.top);
      for (const target of [".nol-teamrun-edit", ".nol-teamrun-new-chat", ".nol-teamrun-delete"]) {
        expect(button(target, row("Alice")).classList).toContain("nol-icon-button");
        AppearanceFixture.expectPixels(box(button(target, row("Alice"))).width, AppearanceFixture.measureLook("icon-button-target"));
        AppearanceFixture.expectPixels(box(button(target, row("Alice"))).height, AppearanceFixture.measureLook("icon-button-target"));
      }
      const colorOf = (target: string): string => getComputedStyle(button(target, row("Alice"))).color;
      if (forcedColors === "none") {
        expect(colorOf(".nol-teamrun-delete")).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "error"));
        expect(colorOf(".nol-teamrun-edit")).not.toBe(colorOf(".nol-teamrun-delete"));
      }
      else
        expect(colorOf(".nol-teamrun-delete")).toBe(colorOf(".nol-teamrun-edit"));
    });

    it.each(["40rem", "90rem"])("keeps every column's share of the table at %s, and every row's actions whole at one right edge", async width => {
      await create();
      element().style.width = width;
      await settle();
      const table = box(part(element(), ".nol-teamrun-teammates table"));
      const shares = Object.values(Resources.teammateColumnShares);
      const total = shares.reduce((sum, t) => sum + t, 0);
      const headers = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-teammates thead th")].map(t => box(t).width);
      const ends = [...element().querySelectorAll<HTMLElement>("tbody .nol-teamrun-item")].map(t => box(t.querySelector("button:last-child")!).right);

      expect(headers).toHaveLength(shares.length);
      headers.forEach((header, index) => expect(Math.abs(header - table.width * shares[index]! / total)).toBeLessThanOrEqual(shares.length / 64));
      expect(ends.length).toBeGreaterThan(1);
      for (const end of ends)
        AppearanceFixture.expectPixels(end, table.right);
      for (const action of element().querySelectorAll<HTMLButtonElement>(".nol-configuration-table-row-actions button")) {
        const cell = box(action.closest("td")!);
        expect(box(action).left).toBeGreaterThanOrEqual(cell.left - 0.5);
        expect(box(action).right).toBeLessThanOrEqual(cell.right + 0.5);
      }
      expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
    });

    it("scrolls the table sideways inside itself below 40rem, with nothing cut off", async () => {
      await create();
      element().style.width = "25rem";
      await settle();
      const body = part(element(), ".nol-teamrun-teammates .nol-configuration-table-body");

      expect(body.scrollWidth).toBeGreaterThan(body.clientWidth);
      expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
      for (const cell of element().querySelectorAll<HTMLElement>("th, td:not(.nol-configuration-table-fill)"))
        expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
      body.scrollLeft = body.scrollWidth;
      await settle();
      expect(box(button(".nol-teamrun-delete", row("Alice"))).right).toBeLessThanOrEqual(box(body).right + 0.5);
    });

    it("puts a used-up note under the teammate's connection, at its start, in the label size and the muted text", async () => {
      await create(t => t.answer(MethodName.PlanUsageList, () => [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 100, null)],
        "2026-10-22T09:00:00.000Z", null, true).toJson()]));
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-used-up")).not.toBeNull());
      const name = part(row("Alice"), ".nol-teamrun-connection-name");
      const note = part(row("Alice"), ".nol-teamrun-used-up");

      AppearanceFixture.expectPixels(box(note).left, box(name).left);
      expect(box(note).top).toBeGreaterThanOrEqual(box(name).bottom - 0.5);
      expect(box(note).bottom).toBeLessThanOrEqual(box(row("Alice")).bottom);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(note).fontSize), AppearanceFixture.measureLook("text-label"));
      if (forcedColors === "none")
        expect(getComputedStyle(note).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted"));
    });

    it("puts a model's not-in-catalog note under its name, at its start, so the note never widens the table and a narrow pane keeps the row's buttons in view", async () => {
      await create(t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5-mini", "gpt-5-mini", "Fixture", ["high"], true, null, true)])));
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-model-note")).not.toBeNull());
      const name = part(row("Alice"), ".nol-teamrun-model-name");
      const note = part(row("Alice"), ".nol-teamrun-model-note");
      const body = part(element(), ".nol-teamrun-teammates .nol-configuration-table-body");
      const inset = element().clientWidth - body.clientWidth;
      const narrowest = async (): Promise<number> => {
        element().style.width = "1px";
        await settle();
        return body.scrollWidth + inset;
      };

      AppearanceFixture.expectPixels(box(note).left, box(name).left);
      expect(box(note).top).toBeGreaterThanOrEqual(box(name).bottom - 0.5);
      const marked = await narrowest();
      note.style.display = "none";
      const unmarked = await narrowest();
      note.style.display = String.empty;
      element().style.width = `${unmarked}px`;
      await settle();

      expect(marked).toBeLessThanOrEqual(unmarked);
      expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
      expect(box(button(".nol-teamrun-delete", row("Alice"))).right).toBeLessThanOrEqual(box(element()).right);
      expect(box(note).bottom).toBeLessThanOrEqual(box(row("Alice")).bottom);
    });

    it("keeps two initials inside the small avatar, at its size", async () => {
      await create(() => data.teammates.push(data.reviewer));
      const avatar = part(row("Code Reviewer"), "nol-avatar");
      const outer = box(avatar);
      const range = document.createRange();
      range.selectNodeContents(avatar);
      const initials = range.getBoundingClientRect();

      AppearanceFixture.expectPixels(outer.width, AppearanceFixture.measureLook("avatar-small"));
      AppearanceFixture.expectPixels(outer.height, AppearanceFixture.measureLook("avatar-small"));
      expect(initials.width).toBeGreaterThan(0);
      expect(initials.left).toBeGreaterThanOrEqual(outer.left);
      expect(initials.right).toBeLessThanOrEqual(outer.right);
      AppearanceFixture.expectPixels(initials.left - outer.left, outer.right - initials.right);
    });

    it("shows an unavailable teammate's avatar and name at half opacity, as the earlier row did, and an available one's at full", async () => {
      await create();
      const opacities = (name: string): number[] => [part(row(name), "nol-avatar"), part(row(name), ".nol-teamrun-item-name")]
        .map(t => Number(getComputedStyle(t).opacity));

      expect(opacities("Offline")).toEqual([0.5, 0.5]);
      expect(opacities("Alice")).toEqual([1, 1]);
    });

    it("shows a disabled provider's teammate at half opacity, its name and suffix on one line where the other names start", async () => {
      await create(onDisabledProvider);
      const carol = row("Carol (provider disabled)");
      const avatar = box(part(carol, "nol-avatar"));
      const name = part(carol, ".nol-teamrun-item-name");
      const alice = box(part(row("Alice"), ".nol-teamrun-item-name"));

      expect([part(carol, "nol-avatar"), name].map(t => Number(getComputedStyle(t).opacity))).toEqual([0.5, 0.5]);
      AppearanceFixture.expectPixels(box(name).left, alice.left);
      AppearanceFixture.expectPixels(box(name).height, alice.height);
      AppearanceFixture.expectPixels(box(name).left - avatar.right, space(2));
      AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, box(name).top + box(name).height / 2);
      expect(box(name).right).toBeLessThanOrEqual(box(part(carol, "td")).right);
    });

    it("scrolls from its own edges and insets the view inside by the window's document padding", async () => {
      await create();
      const view = part(element(), ".nol-teamrun-settings-view");
      const table = part(view, "nol-configuration-table");
      const inline = AppearanceFixture.measureLook("content-padding-inline");

      expect(getComputedStyle(element()).overflowY).toBe("auto");
      AppearanceFixture.expectPixels(box(view).top, box(element()).top);
      AppearanceFixture.expectPixels(box(view).left, box(element()).left);
      AppearanceFixture.expectPixels(box(table).top - box(view).top, AppearanceFixture.measureLook("document-padding-block"));
      AppearanceFixture.expectPixels(box(table).left - box(view).left, inline);
      AppearanceFixture.expectPixels(box(view).right - box(table).right, inline);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the teammates view visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the teammates view at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the teammates view by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the teammates view", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
