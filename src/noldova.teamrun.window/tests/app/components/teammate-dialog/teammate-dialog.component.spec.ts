/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { page, userEvent } from "vitest/browser";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import {
  AbilityCell,
  AuthStatus,
  DefaultTeammate,
  DefaultTeammateSetParams,
  ErrorCode,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessageStatus,
  MethodName,
  ObservedSettings,
  PlanUsage,
  PlanWindow,
  PlanWindowName,
  Provenance,
  Provider,
  ProviderAbility,
  ProviderKind,
  ProviderContextWindows,
  ProviderListModelsParams,
  ProviderMode,
  ProviderModel,
  ProviderSpeed,
  RequestedSettings,
  Teammate,
  TeammateCreateParams,
  TeammateFallback,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";
import { DialogTokens, SelectComponent, SelectOption, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { TeammateDialogComponent } from "../../../../src/app/components/teammate-dialog/teammate-dialog.component";
import { ProviderChoice } from "../../../../src/app/models/provider-choice";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { DialogActionsFixture } from "../../../fixtures/dialog-actions.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammateDialogComponent", () => {
  const home = new Provider("a2", "claude", "Home", "D:\\profiles\\claude", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  let context: FakeWindowPartContext;
  let data: TeammateFixture;
  let store: ChatStoreService;
  let fixture: ComponentFixture<TeammateDialogComponent>;
  let closes: number;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const refusing = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.ChooseEffort]: AbilityCell.cannot("its models each have one fixed setting"),
      [ProviderAbility.ChooseSpeed]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet"),
      [ProviderAbility.ChooseContext]: AbilityCell.cannot("its model fixes the context size") }));
  const withRefusing = (t: FakeWindowPartContext): void => {
    t.answer(MethodName.ProviderKindList, () => [refusing.toJson(), SampleData.claude.toJson()]);
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const select = (name: string): SelectComponent => fixture.debugElement.query(By.css(`nol-select.nol-teamrun-${name}`)).componentInstance as SelectComponent;
  const optionsOf = (name: string): SelectOption[] => select(name).options().filter((t): t is SelectOption => t instanceof SelectOption);
  const titles = (name: string): string[] => optionsOf(name).map(t => t.title);
  const choose = async (name: string, value: string): Promise<void> => {
    select(name).valueChange.emit(value);
    await settle();
  };
  const field = <T extends HTMLElement>(selector: string): T => {
    const found = element().querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The teammate dialog shows no ${selector}.`);
    return found;
  };
  const type = async (selector: string, text: string): Promise<void> => {
    const input = field<HTMLInputElement | HTMLTextAreaElement>(selector);
    input.value = text;
    input.dispatchEvent(new Event("input"));
    await settle();
  };
  const save = (): HTMLButtonElement => field<HTMLButtonElement>(".nol-teamrun-save");
  const submit = async (): Promise<void> => {
    field<HTMLFormElement>("form").requestSubmit();
    await settle();
  };
  const create = async (teammate: Teammate | null, configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    data = new TeammateFixture(context);
    data.teammates = data.teammates.map(t => !Object.isNull(teammate) && t.id === teammate.id ? teammate : t);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: DialogTokens.titleId, useValue: "nol-teamrun-dialog-title" }] });
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    fixture = TestBed.createComponent(TeammateDialogComponent);
    fixture.componentRef.setInput("store", store);
    fixture.componentRef.setInput("teammate", teammate);
    closes = 0;
    fixture.componentInstance.closed.subscribe(() => closes++);
    fixture.autoDetectChanges();
    await settle();
  };
  const stored = (): Teammate => {
    const sent = context.parametersOf(MethodName.TeammateUpdate);
    const id = Object.isUndefined(sent) ? fixture.componentInstance.teammate()!.id : TeammateUpdateParams.fromJson(sent).teammateId;
    return data.teammates.find(t => t.id === id)!;
  };
  const withHome = (configure: (context: FakeWindowPartContext) => void = () => undefined): (context: FakeWindowPartContext) => void => t => {
    t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson()]);
    configure(t);
  };
  const otherCatalog = (t: FakeWindowPartContext,
    answer: () => JsonValue | Promise<JsonValue> = () => SampleData.catalog([new ProviderModel("other", "Other model", "", [], true, null, true)])): void => {
    t.answer(MethodName.ProviderModelCatalog, u => ProviderListModelsParams.fromJson(u).providerId === home.id
      ? answer()
      : SampleData.catalog(["gpt-5", "gpt-5-mini"].map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true))));
  };

  const reporting = (kind: ProviderKind, checked: boolean): ProviderKind => new ProviderKind(kind.id, kind.displayName, true, false, null, kind.profile, false, null,
    false, null, false, null, null, false, false, undefined, null, false, true, true, checked);
  const team = new Provider("a3", "codex", "Team", "D:\\profiles\\team", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  const personal = new Provider("a5", "claude", "Personal", "D:\\profiles\\personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  const withSustain = (t: FakeWindowPartContext): void => {
    t.answer(MethodName.ProviderKindList, () => [reporting(SampleData.codex, true).toJson(), reporting(SampleData.claude, false).toJson(),
      new ProviderKind("cursor", "Cursor", true).toJson(), new ProviderKind("grok", "Grok CLI", true).toJson()]);
    t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson(), team.toJson(), personal.toJson(),
      new Provider("a4", "cursor", "Work", "D:\\profiles\\cursor", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson()]);
    otherCatalog(t);
  };
  const sustained = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, [], true,
    [new TeammateFallback("a3", "gpt-5-mini"), new TeammateFallback("a2")]);
  const resting = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, [], false,
    [new TeammateFallback("a3", "gpt-5-mini")]);
  const nth = <T>(list: readonly T[], index: number): T => {
    const found = list[index];
    if (Object.isUndefined(found))
      throw new Error(`The teammate dialog shows no item ${index} where it should.`);
    return found;
  };
  const rows = (): HTMLTableRowElement[] => [...element().querySelectorAll<HTMLTableRowElement>(".nol-teamrun-fallbacks tbody tr")];
  const cells = (row: HTMLTableRowElement): string[] => {
    const lines = [...row.querySelectorAll(".nol-teamrun-fallback-line")].map(t => (t.querySelector(".nol-select-value") ?? t).textContent?.trim() ?? "");
    return [row.cells[0]?.textContent?.trim() ?? "", ...[0, 2, 3, 1].map(t => lines[t] ?? "")];
  };
  const entrySelect = (entry: number, name: string): SelectComponent =>
    nth(fixture.debugElement.queryAll(By.css(`.nol-teamrun-fallback:nth-child(${entry}) nol-select.nol-teamrun-fallback-${name}`)), 0).injector.get(SelectComponent);
  const entryButton = (entry: number, name: string): HTMLButtonElement => field<HTMLButtonElement>(`.nol-teamrun-fallback:nth-child(${entry}) .nol-teamrun-fallback-${name}`);
  const sentKeys = (method: MethodName): string[] => Object.keys(JsonReader.fromValue(context.parametersOf(method)).toJson()).sort();

  const modes = [new ProviderMode("auto", "Default", "Edits files in the workspace, and asks before anything else."),
    new ProviderMode("read-only", "Read Only", "Reads files, and asks before any change."),
    new ProviderMode("full-access", "Full Access", "Edits files and runs commands anywhere without asking.", true)];
  const refusingModes = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.ReadOnlyMode]: AbilityCell.cannot("its guide lists read-only mode as missing"),
      [ProviderAbility.UnrestrictedMode]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }));
  const withRefusedModes = (t: FakeWindowPartContext): void => {
    t.answer(MethodName.ProviderKindList, () => [refusingModes.toJson(), SampleData.claude.toJson()]);
    t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["medium", "high"], true, null, true)], true, false, null,
      false, modes.slice(0, 1), "auto"));
  };
  const modeRefusal = (): HTMLElement | null => element().querySelector<HTMLElement>("#nol-teamrun-mode-refusal");
  const withModes = (t: FakeWindowPartContext): FakeWindowPartContext => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(["gpt-5", "gpt-5-mini"]
    .map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true)), true, false, null, false, modes, "auto"));
  const modeHint = (): HTMLElement | null => element().querySelector<HTMLElement>("#nol-teamrun-mode-hint");
  const withWindows = (maximums: Readonly<Record<string, number>>, reported: boolean = true) => (t: FakeWindowPartContext): FakeWindowPartContext =>
    t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(["gpt-5", "gpt-5-mini"].map((id, index) => new ProviderModel(id, id, "Fixture",
      ["medium", "high"], index === 0, null, true, null, {}, [], null, Object.isUndefined(maximums[id]) ? null
        : new ProviderContextWindows([200_000, 400_000, 1_000_000].filter(u => u <= maximums[id]!), 100_000, maximums[id]!, reported)))));
  const windowHint = (): string | undefined => element().querySelector("#nol-teamrun-context-window-hint")?.textContent?.trim();
  const windowed = (tokens: number | null): Teammate => new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, tokens);
  const confirmTitle = (): string | undefined => document.querySelector("nol-teamrun-confirm-dialog .nol-dialog-title")?.textContent?.trim();

  afterEach(() => {
    ChatStoreService.release(context);
  });

  it("edits a teammate from its saved name, role, provider, model and effort, with the provider's models, keeping the effort when the same model is chosen again", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editTeammateLabel);
    expect(field<HTMLInputElement>(".nol-teamrun-teammate-name").value).toBe("Alice");
    expect(field<HTMLTextAreaElement>(".nol-teamrun-teammate-role").value).toBe("Review");
    expect(select("provider").value()).toBe(SampleData.provider.id);
    expect(titles("provider")).toEqual(["Codex · Work · This computer"]);
    expect(select("model").value()).toBe("gpt-5");
    expect(titles("model")).toEqual([Resources.formatDefaultModel("gpt-5"), "gpt-5", "gpt-5-mini"]);
    expect(select("effort").value()).toBe("high");
    expect(titles("effort")).toEqual(["Medium", "High"]);
    expect(save().disabled).toBe(false);
    await choose("model", "gpt-5");
    expect(select("effort").value()).toBe("high");
  });

  describe("when usage runs out", () => {
    it("shows the group after Effort and before Role, with the teammate's own choice as entry 1 and each entry's way of moving there", async () => {
      await create(sustained, withSustain);
      const group = field(".nol-teamrun-sustain");
      const settings = field("nol-teamrun-sustain-settings");

      expect(settings.previousElementSibling).toBe(field("nol-select.nol-teamrun-effort").closest(".nol-teamrun-field"));
      expect(settings.nextElementSibling).toBe(field(".nol-teamrun-teammate-role").closest(".nol-teamrun-field"));
      expect([field(".nol-teamrun-sustain-heading").textContent?.trim(), group.getAttribute("aria-labelledby")])
        .toEqual([Resources.sustainGroupLabel, "nol-teamrun-sustain-heading"]);
      expect(field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").checked).toBe(true);
      expect(rows().map(t => cells(t))).toEqual([
        ["1", "Codex · Work · This computer", "gpt-5", "High", Resources.sustainOwnChoiceWay],
        ["2", "Codex · Team · This computer", "gpt-5-mini", Resources.modelDefaultEffort, Resources.sustainSameSessionWay],
        ["3", "Claude Code · Home · This computer", Resources.formatDefaultModel("Other model"), Resources.modelDefaultEffort, Resources.sustainNewSessionWay]]);
      expect(element().querySelectorAll("tr.nol-teamrun-fallback nol-select")).toHaveLength(0);
      expect(field(".nol-teamrun-add-fallback").classList).toContain("nol-button-secondary");
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      expect(entrySelect(4, "connection").options().map(t => t instanceof SelectOption ? t.title : [t.label, t.options.map(u => [u.title, u.isDisabled])]))
        .toEqual(["Claude Code · Home · This computer", "Claude Code · Personal · This computer", "Codex · Team · This computer", "Codex · Work · This computer",
          [Resources.sustainUnreadKindsGroup, [["Cursor", true], ["Grok CLI", true]]]]);
      expect([field(".nol-teamrun-resets-soonest input").matches(":checked"), entrySelect(4, "model").options().map(t => t instanceof SelectOption ? t.title : null)])
        .toEqual([true, [Resources.formatDefaultModel("gpt-5"), "gpt-5", "gpt-5-mini"]]);
    });

    it("adds, changes, moves and removes entries, labels a move on a provider not yet checked, and saves the list with the switch and option", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      entrySelect(4, "connection").valueChange.emit(personal.id);
      await settle();
      const way = cells(nth(rows(), 3))[4];
      entryButton(4, "up").click();
      await settle();
      entryButton(2, "remove").click();
      await settle();
      const shown = rows().map(t => cells(t)[1]);
      field<HTMLInputElement>("nol-checkbox.nol-teamrun-resets-soonest input").click();
      field<HTMLElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").click();
      await settle();
      await submit();

      expect(way).toBe(Resources.sustainSameSessionUncheckedWay);
      expect(shown).toEqual(["Codex · Work · This computer", "Claude Code · Personal · This computer", "Claude Code · Home · This computer"]);
      expect(stored().fallbacks.map(t => t.providerId)).toEqual(["a5", "a2"]);
      expect([stored().sustain, stored().resetsSoonestFirst]).toEqual([false, false]);
      expect(sentKeys(MethodName.TeammateUpdate)).toEqual(["fallbacks", "resetsSoonestFirst", "sustain", "teammateId"]);
    });

    it("adds a provider and model no entry uses yet, the teammate's own included and the default model counted as its catalog's default, and turns Add off once every one is used", async () => {
      await create(sustained, withSustain);
      const add = field<HTMLButtonElement>(".nol-teamrun-add-fallback");

      add.click();
      await settle();
      const first = cells(nth(rows(), 3)).slice(0, 3);
      for (let added = 1; !add.disabled && added < 20; added++) {
        add.click();
        await settle();
      }
      await submit();

      expect(first).toEqual(["4", "Claude Code · Personal · This computer", Resources.formatDefaultModel("gpt-5")]);
      expect(add.disabled).toBe(true);
      const entries = [`${sustained.providerId} ${String(sustained.model)}`, ...stored().fallbacks.map(t => `${t.providerId} ${String(t.model)}`)];
      expect(new Set(entries).size).toBe(entries.length);
      expect(entries).toEqual(["a1 gpt-5", "a3 gpt-5-mini", "a2 null", "a5 null", "a5 gpt-5-mini", "a3 null", "a1 gpt-5-mini"]);
    });

    it("keeps the first entry's Move up and the last entry's Move down off, and names each action by its entry", async () => {
      await create(sustained, withSustain);
      const up = [...element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-fallback-up")];
      const down = [...element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-fallback-down")];

      expect([up.map(t => t.disabled), down.map(t => t.disabled)]).toEqual([[true, false], [false, true]]);
      expect(nth(up, 0).getAttribute("aria-label")).toBe(Resources.formatMoveUp(Resources.formatSustainEntry(2, "Codex · Team · This computer")));
    });

    it("keeps the focus on the moved entry's button, or on its other move once that one turns off at the end", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      const team = "Codex · Team · This computer";
      entryButton(2, "down").focus();

      entryButton(2, "down").click();
      await settle();
      const middle = document.activeElement?.getAttribute("aria-label");
      entryButton(3, "down").click();
      await settle();
      const last = document.activeElement?.getAttribute("aria-label");
      entryButton(4, "up").click();
      await settle();
      const back = document.activeElement?.getAttribute("aria-label");
      entryButton(3, "up").click();
      await settle();

      expect([middle, last, back, document.activeElement?.getAttribute("aria-label")])
        .toEqual([Resources.formatMoveDown(Resources.formatSustainEntry(3, team)), Resources.formatMoveUp(Resources.formatSustainEntry(4, team)),
          Resources.formatMoveUp(Resources.formatSustainEntry(3, team)), Resources.formatMoveDown(Resources.formatSustainEntry(2, team))]);
    });

    it("shows Sustain unavailable, with the reason, on a teammate whose provider's limits TeamRun can't read, and sends none of its settings", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const reason = field(".nol-teamrun-sustain-reason");

      expect([reason.textContent?.trim(), field(".nol-teamrun-sustain").getAttribute("aria-describedby")])
        .toEqual([Resources.formatSustainUnavailable("Codex"), reason.id]);
      expect(field("nol-switch.nol-teamrun-sustain-switch [role=switch]").getAttribute("aria-disabled")).toBe("true");
      expect(field(".nol-teamrun-sustain-label").classList).toContain("nol-teamrun-sustain-label-off");
      expect(element().querySelector(".nol-teamrun-fallbacks")).toBeNull();
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      expect(sentKeys(MethodName.TeammateUpdate)).toEqual(["name", "teammateId"]);
    });

    it("turns Sustain off when a sustained teammate moves to a provider whose limits TeamRun can't read, and sends it off with the move", async () => {
      await create(sustained, withSustain);
      await choose("provider", "a4");
      const switched = field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]");

      expect([switched.checked, switched.getAttribute("aria-disabled")]).toEqual([false, "true"]);
      await submit();
      const sent = TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate));
      expect([sent.providerId, sent.sustain]).toEqual(["a4", false]);
    });

    it("lists the providers whose limits TeamRun can't read at the foot of a new entry's provider list, greyed, and won't take one", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      const button = field(".nol-teamrun-fallback:nth-child(4) nol-select.nol-teamrun-fallback-connection .nol-select-button");
      const chosen = (): string => button.textContent?.trim() ?? "";
      const before = chosen();
      button.click();
      await settle();
      const cursor = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === "Cursor");
      if (Object.isUndefined(cursor))
        throw new Error("The new entry's provider list shows no Cursor.");
      const label = cursor.closest(".nol-select-section")?.querySelector(".nol-select-group-label")?.textContent?.trim();
      cursor.click();
      await settle();

      expect([label, cursor.getAttribute("aria-disabled"), chosen()]).toEqual([Resources.sustainUnreadKindsGroup, "true", before]);
      button.click();
      await settle();
      await submit();
      expect(TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).fallbacks?.map(t => t.providerId)).not.toContain("cursor");
    });

    it("shows a refusal of the Sustain settings under the list, not at the form's foot", async () => {
      await create(sustained, t => {
        withSustain(t);
        t.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "Entry 3 is the same as entry 2.", "fallbacks");
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      const refusal = field(".nol-teamrun-sustain-refusal");

      expect([refusal.textContent?.trim(), refusal.previousElementSibling?.matches("nol-configuration-table.nol-teamrun-fallbacks"),
        element().querySelector(".nol-teamrun-dialog-error")]).toEqual([Resources.formatTeammateError("Alicia", "Entry 3 is the same as entry 2."), true, null]);
    });

    it("shows a refusal of the Sustain settings under the switch while Sustain is off, not at the form's foot", async () => {
      await create(resting, t => {
        withSustain(t);
        t.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "That provider no longer exists.", "fallbacks");
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      const refusal = field(".nol-teamrun-sustain-refusal");

      expect([refusal.textContent?.trim(), refusal.previousElementSibling?.matches(".nol-teamrun-sustain-row"), element().querySelector(".nol-teamrun-fallbacks"),
        element().querySelector(".nol-teamrun-dialog-error")]).toEqual([Resources.formatTeammateError("Alicia", "That provider no longer exists."), true, null, null]);
    });

    it("shows a refusal of the Sustain settings at the form's foot when the teammate's provider shows no list", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice, t => t.refuse(MethodName.TeammateUpdate, ErrorCode.NotFound, "That provider no longer exists.",
        "fallbacks"));
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();

      expect([field(".nol-teamrun-dialog-error").textContent?.trim(), element().querySelector(".nol-teamrun-sustain-refusal")])
        .toEqual([Resources.formatTeammateError("Alicia", "That provider no longer exists."), null]);
    });

    it("keeps the person's Sustain choice when the provider moves to another that can sustain, and when the provider types reload", async () => {
      await create(resting, withSustain);
      field<HTMLElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").click();
      await settle();
      await choose("provider", home.id);
      const switched = (): boolean => field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").checked;
      const moved = switched();
      const asked = context.count(MethodName.ProviderKindList);
      context.emit(EventName.ProviderKindsChanged, null);
      await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBeGreaterThan(asked));
      await settle();

      expect([moved, switched()]).toEqual([true, true]);
      await submit();
      const sent = TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate));
      expect([sent.providerId, sent.sustain]).toEqual([home.id, true]);
    });

    it("toggles Sustain from a click on the switch's text, which names the switch, and leaves it alone while Sustain is unavailable", async () => {
      await create(resting, withSustain);
      const switched = (): HTMLInputElement => field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]");
      field<HTMLElement>(".nol-teamrun-sustain-label").click();
      await settle();
      const on = switched().checked;
      field<HTMLElement>(".nol-teamrun-sustain-label").click();
      await settle();

      expect([on, switched().checked, switched().getAttribute("aria-label"), field(".nol-teamrun-sustain-label").textContent?.trim()])
        .toEqual([true, false, Resources.sustainSwitchLabel, Resources.sustainSwitchLabel]);
      await choose("provider", "a4");
      field<HTMLElement>(".nol-teamrun-sustain-label").click();
      await settle();
      expect(switched().checked).toBe(false);
    });

    it("leaves Sustain alone on a click on the switch's text while the teammate saves", async () => {
      const held = new DeferredResponse();
      await create(resting, t => {
        withSustain(t);
        t.answer(MethodName.TeammateUpdate, () => held.promise);
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      field<HTMLElement>(".nol-teamrun-sustain-label").click();
      await settle();
      const during = field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").checked;
      held.resolve(resting.toJson());
      await settle();

      expect([during, TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).sustain]).toEqual([false, undefined]);
    });

    it("shows only the switch and its label while Sustain is off, and the explanation, Fallback order with Add, the table and the option once it's on", async () => {
      await create(resting, withSustain);
      const shown = (): boolean[] => [".nol-teamrun-sustain-hint", "nol-configuration-table.nol-teamrun-fallbacks", ".nol-teamrun-add-fallback",
        "nol-checkbox.nol-teamrun-resets-soonest"].map(t => element().querySelector(t) !== null);
      const off = shown();
      const label = field(".nol-teamrun-sustain-label").textContent?.trim();
      field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").click();
      await settle();

      expect([off, label, shown()]).toEqual([[false, false, false, false], Resources.sustainSwitchLabel, [true, true, true, true]]);
      expect(rows().map(t => cells(t)[1])).toEqual(["Codex · Work · This computer", "Codex · Team · This computer"]);
    });

    it("keeps the entries while Sustain is off, so turning it on again shows the same list, an entry just added included", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      const before = rows().map(t => cells(t)[1]);
      const switched = (): HTMLInputElement => field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]");
      switched().click();
      await settle();
      const hidden = element().querySelector(".nol-teamrun-fallbacks");
      switched().click();
      await settle();

      expect([before.length, hidden, rows().map(t => cells(t)[1])]).toEqual([4, null, before]);
    });

    it("saves a teammate turned off with its entries kept, and sends no change of the list", async () => {
      await create(sustained, withSustain);
      field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").click();
      await settle();
      await submit();
      const sent = TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate));

      expect([sent.sustain, sent.fallbacks]).toEqual([false, undefined]);
    });

    it("sends a new teammate's Sustain settings only where they differ from the defaults", async () => {
      await create(null, withSustain);
      await type(".nol-teamrun-teammate-name", "Dana");
      const switched = (): HTMLInputElement => field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]");
      switched().click();
      await settle();
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      switched().click();
      await settle();
      await submit();
      const sent = TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate));

      expect([sent.sustain, sent.fallbacks.map(t => t.providerId), sent.resetsSoonestFirst]).toEqual([false, ["a5"], true]);
      expect(sentKeys(MethodName.TeammateCreate).filter(t => ["sustain", "fallbacks", "resetsSoonestFirst"].includes(t))).toEqual(["fallbacks"]);
    });

    it("names an entry whose provider is gone, disabled, of a kind that keeps no sessions across its providers or names its own default, with a model and effort its provider doesn't list", async () => {
      const relay = new ProviderKind("relay", "Relay", true, false, "Relay auto", null, false, null, false, null, false, null, null, false, false, undefined, null, false,
        true, false, true);
      const pool = new ProviderKind("pool", "Pool", true, false, null, null, false, null, false, null, false, null, null, false, false, undefined, null, false, true);
      const on = (id: string, kind: string, label: string, enabled: boolean = true): Provider =>
        new Provider(id, kind, label, `D:\\profiles\\${id}`, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, enabled);
      const erin = new Teammate("erin", "Erin", null, "a1", Harness.Provider, "gpt-9", null, "t", "t", null, null, null, [], true, [new TeammateFallback("a9"),
        new TeammateFallback("a6", "unlisted-model", "ultra"), new TeammateFallback("a7"), new TeammateFallback("a8")]);
      const asked: (string | null)[] = [];
      await create(erin, t => {
        data.teammates.push(erin);
        t.answer(MethodName.ProviderKindList, () => [reporting(SampleData.codex, true).toJson(), relay.toJson(), pool.toJson()]);
        t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), on("a6", "relay", "A").toJson(), on("a7", "relay", "B", false).toJson(),
          on("a8", "pool", "C").toJson()]);
        t.answer(MethodName.ProviderModelCatalog, u => asked.push(ProviderListModelsParams.fromJson(u).providerId) > 0
          && ["a6", "a8"].includes(ProviderListModelsParams.fromJson(u).providerId ?? "")
          ? SampleData.catalog([new ProviderModel("r1", "R1", "", ["low", "high"], false, null, true)])
          : SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["medium", "high"], true, null, true)]));
      });

      expect(rows().map(t => cells(t))).toEqual([
        ["1", "Codex · Work · This computer", "gpt-9", Resources.modelDefaultEffort, Resources.sustainOwnChoiceWay],
        ["2", Resources.unavailableTeammateLabel, Resources.formatDefaultModel(null), Resources.modelDefaultEffort, Resources.sustainNewSessionWay],
        ["3", "Relay · A · This computer", Resources.formatUnlisted("unlisted-model"), Resources.formatUnlisted("Ultra"), Resources.sustainNewSessionWay],
        ["4", "Relay · B · This computer", "Relay auto", Resources.modelDefaultEffort, Resources.sustainNewSessionWay],
        ["5", "Pool · C · This computer", Resources.formatDefaultModel(null), Resources.modelDefaultEffort, Resources.sustainNewSessionWay]]);
      expect([asked.includes("a6"), asked.includes("a7")]).toEqual([true, false]);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      expect(entrySelect(6, "connection").options().every(t => t instanceof SelectOption)).toBe(true);
    });

    it("keeps a new entry when the same provider or model is chosen again, starts it over on another model, and sets or clears its effort", async () => {
      await create(sustained, withSustain);
      const add = field<HTMLButtonElement>(".nol-teamrun-add-fallback");
      add.click();
      await settle();
      entrySelect(4, "connection").valueChange.emit("a3");
      entrySelect(4, "model").valueChange.emit("gpt-5-mini");
      entrySelect(4, "effort").valueChange.emit("high");
      entrySelect(4, "connection").valueChange.emit("a3");
      entrySelect(4, "model").valueChange.emit("gpt-5-mini");
      await settle();
      const kept = cells(nth(rows(), 3));
      entrySelect(4, "model").valueChange.emit("");
      add.click();
      await settle();
      entrySelect(5, "connection").valueChange.emit("a5");
      entrySelect(5, "effort").valueChange.emit("high");
      entrySelect(5, "effort").valueChange.emit("");
      await settle();
      await submit();

      expect(kept.slice(1, 4)).toEqual(["Codex · Team · This computer", "gpt-5-mini", "High"]);
      expect(stored().fallbacks.map(t => [t.providerId, t.model, t.effort])).toEqual([["a3", "gpt-5-mini", null], ["a2", null, null], ["a3", null, null],
        ["a5", null, null]]);
    });

    it("shows the group with the teammate's own entry unavailable when its provider is gone", async () => {
      const fixtureData = new TeammateFixture(SampleData.createContext());
      await create(fixtureData.unavailable, withSustain);
      field<HTMLInputElement>("nol-switch.nol-teamrun-sustain-switch [role=switch]").click();
      await settle();

      expect(cells(nth(rows(), 0)).slice(0, 2)).toEqual(["1", Resources.unavailableTeammateLabel]);
      expect(field("nol-switch.nol-teamrun-sustain-switch [role=switch]").getAttribute("aria-disabled")).not.toBe("true");
    });

    it("shows no usage group for the default teammate", async () => {
      await create(null, withSustain);
      fixture.componentRef.setInput("choosesDefault", true);
      await settle();

      expect(element().querySelector(".nol-teamrun-sustain")).toBeNull();
    });
  });

  it("offers Claude's fast mode in the same speed select, at Standard until Fast is chosen, and saves it", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {}, [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")],
        "standard")])));

    expect([titles("speed"), select("speed").value()]).toEqual([["Standard", "Fast"], "standard"]);
    await choose("speed", "fast");
    await submit();

    expect(stored().speed).toBe("fast");
  });

  it("turns a teammate's fast mode off by choosing Standard", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", "fast"), t => t.answer(MethodName.ProviderModelCatalog,
      () => SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {},
        [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], "standard")])));

    expect(select("speed").value()).toBe("fast");
    await choose("speed", "standard");
    await submit();

    expect(stored().speed).toBe("standard");
  });

  it("offers a model's speeds as a select by the provider's names, and saves the chosen one", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {}, [new ProviderSpeed("priority", "Fast"), new ProviderSpeed("flex")], null)])));

    expect(titles("speed")).toEqual([Resources.modelDefaultSpeed, "Fast", "Flex"]);
    expect(select("speed").value()).toBe("");
    await choose("speed", "priority");
    await submit();

    expect(stored().speed).toBe("priority");
  });

  it("offers no default entry for a model that names its default speed, and shows that speed until another is chosen", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {}, [new ProviderSpeed("priority", "Fast"), new ProviderSpeed("flex")], "priority")])));

    expect([titles("speed"), select("speed").value()]).toEqual([["Fast", "Flex"], "priority"]);
  });

  it("clears a teammate's speed when the select goes back to the model's default", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", "priority"), t => t.answer(MethodName.ProviderModelCatalog,
      () => SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {}, [new ProviderSpeed("priority", "Fast")], null)])));

    expect(select("speed").value()).toBe("priority");
    await choose("speed", "");
    await submit();

    expect(stored().speed).toBeNull();
  });

  it("keeps a teammate's chosen speed when it saves the teammate unchanged, sending nothing and closing", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", "priority"));

    await submit();

    expect([context.count(MethodName.TeammateUpdate), stored().speed, closes]).toEqual([0, "priority", 1]);
  });

  it("offers a model's context windows as Default with the model's window, its presets and Custom…, at Default until one is chosen, and saves the chosen preset", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withWindows({ "gpt-5": 1_000_000 }));

    expect([titles("context-window"), select("context-window").value(), windowHint()])
      .toEqual([[Resources.formatDefaultContextWindow("1M"), "200K", "400K", "1M", Resources.customContextWindowOption], "",
        `${Resources.formatDefaultContextWindowSummary("1M")} ${Resources.contextWindowNextMessage}`]);
    await choose("context-window", "400000");
    expect(windowHint()).toBe(`The chat is summarised as it nears 400K of the model's 1M window, which stays the same. ${Resources.contextWindowNextMessage}`);
    await submit();

    expect(stored().contextWindow).toBe(400_000);
  });

  it("shows a plain Default and names no window in the hints until the model's window is reported, while the bounds stay up to 1M", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withWindows({ "gpt-5": 1_000_000 }, false));

    expect([titles("context-window"), windowHint()]).toEqual([[Resources.defaultContextWindow, "200K", "400K", "1M", Resources.customContextWindowOption],
      `The chat is summarised as it nears the model's window. ${Resources.contextWindowNextMessage}`]);
    await choose("context-window", "400000");
    expect(windowHint()).toBe(`The chat is summarised as it nears 400K; the model's window stays the same. ${Resources.contextWindowNextMessage}`);
    await choose("context-window", "custom");
    await type(".nol-teamrun-context-window-size", "1M");
    expect([save().disabled, windowHint()]).toEqual([false, `The chat is summarised as it nears 1M; the model's window stays the same. `
      + `${Resources.formatContextWindowBounds("100K", "1M")} ${Resources.contextWindowNextMessage}`]);
  });

  it("takes a custom size within the model's bounds, naming them, and keeps Save off and the size marked until it fits, taking input only from its own field", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withWindows({ "gpt-5": 400_000 }));
    await choose("context-window", "custom");
    const size = field<HTMLInputElement>(".nol-teamrun-context-window-size");

    expect([size.value, size.getAttribute("aria-invalid"), size.getAttribute("aria-describedby"), save().disabled, windowHint()])
      .toEqual(["", null, "nol-teamrun-context-window-hint", true, `${Resources.formatContextWindowBounds("100K", "400K")} ${Resources.contextWindowNextMessage}`]);
    await type(".nol-teamrun-context-window-size", "50K");
    expect([size.getAttribute("aria-invalid"), save().disabled]).toEqual(["true", true]);
    await type(".nol-teamrun-context-window-size", "401K");
    expect([size.getAttribute("aria-invalid"), save().disabled]).toEqual(["true", true]);
    await type(".nol-teamrun-context-window-size", "a lot");
    expect([size.getAttribute("aria-invalid"), save().disabled]).toEqual(["true", true]);
    await type(".nol-teamrun-context-window-size", " 150.5k ");
    expect([size.getAttribute("aria-invalid"), save().disabled, windowHint()]).toEqual([null, false,
      `The chat is summarised as it nears 150.5K of the model's 400K window, which stays the same. ${Resources.formatContextWindowBounds("100K", "400K")} `
      + Resources.contextWindowNextMessage]);
    fixture.debugElement.query(By.css(".nol-teamrun-context-window-size")).triggerEventHandler("input", { target: document.createElement("div") });
    await submit();

    expect(stored().contextWindow).toBe(150_500);
  });

  it("shows a saved size that is no preset as Custom… with its size, starts Custom… from a chosen preset, and clears the size with Default", async () => {
    await create(windowed(150_000), withWindows({ "gpt-5": 1_000_000 }));

    expect([select("context-window").value(), field<HTMLInputElement>(".nol-teamrun-context-window-size").value]).toEqual(["custom", "150K"]);
    await choose("context-window", "200000");
    expect(element().querySelector(".nol-teamrun-context-window-size")).toBeNull();
    await choose("context-window", "custom");
    expect(field<HTMLInputElement>(".nol-teamrun-context-window-size").value).toBe("200K");
    await choose("context-window", "");
    await submit();

    expect(stored().contextWindow).toBeNull();
  });

  it("keeps a teammate's saved custom size to the token when it saves the teammate unchanged", async () => {
    await create(windowed(150_123), withWindows({ "gpt-5": 1_000_000 }));

    await submit();

    expect([context.count(MethodName.TeammateUpdate), stored().contextWindow, closes]).toEqual([0, 150_123, 1]);
  });

  it.each([
    { size: "200000", kept: 200_000 },
    { size: "400000", kept: null }
  ])("keeps a chosen size of $size only when the next model offers it", async ({ size, kept }) => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withWindows({ "gpt-5": 1_000_000, "gpt-5-mini": 200_000 }));

    await choose("context-window", size);
    await choose("model", "gpt-5-mini");
    await submit();

    expect(stored().contextWindow).toBe(kept);
  });

  it("offers no context window for a model that offers none, and offers one once a model that does is chosen", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withWindows({ "gpt-5-mini": 200_000 }));
    expect(element().querySelector("nol-select.nol-teamrun-context-window")).toBeNull();
    await choose("model", "gpt-5-mini");

    expect(titles("context-window")).toEqual([Resources.formatDefaultContextWindow("200K"), "200K", Resources.customContextWindowOption]);
  });

  it("keeps a saved size on a model that offers no windows, under a plain Default and with only the next-message note", async () => {
    await create(windowed(300_000), withWindows({ "gpt-5-mini": 200_000 }));

    expect([titles("context-window"), select("context-window").value(), field<HTMLInputElement>(".nol-teamrun-context-window-size").value, windowHint()])
      .toEqual([[Resources.defaultContextWindow, Resources.customContextWindowOption], "custom", "300K", Resources.contextWindowNextMessage]);
    await submit();

    expect([context.count(MethodName.TeammateUpdate), stored().contextWindow]).toEqual([0, 300_000]);
  });

  it("shows Effort, Speed and Context window disabled at their defaults while the provider's cells say it can't, each with its reason in a note its control reads as its description", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withRefusing);
    const described = (name: string): string[] => (field(`nol-select.nol-teamrun-${name} button`).getAttribute("aria-describedby") ?? "").split(" ")
      .filter(t => t.length > 0).map(t => document.getElementById(t)?.textContent?.trim() ?? "");

    expect([select("effort").disabled(), select("speed").disabled(), select("context-window").disabled(), titles("effort"), titles("speed"), titles("context-window")])
      .toEqual([true, true, true, [Resources.modelDefaultEffort], [Resources.modelDefaultSpeed], [Resources.defaultContextWindow]]);
    expect([described("effort"), described("speed"), described("context-window")]).toEqual([["Codex can't change effort: its models each have one fixed setting."],
      ["Codex can't change speed: TeamRun doesn't support this for it yet."], ["Codex can't change the context window: its model fixes the context size."]]);
    expect([...element().querySelectorAll(".nol-teamrun-refusal")].map(t => t.textContent?.trim())).toEqual(["Codex can't change effort: its models each have one fixed setting.",
      "Codex can't change speed: TeamRun doesn't support this for it yet.", "Codex can't change the context window: its model fixes the context size."]);
  });

  it("saves a teammate without the effort, speed and custom context window it kept from before the provider's cells said it can't", async () => {
    await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", "priority", null, 150_123), withRefusing);

    await submit();

    expect([stored().effort, stored().speed, stored().contextWindow, closes]).toEqual([null, null, null, 1]);
  });

  it("offers no context window for the default teammate, even while the provider's cell says it can't", async () => {
    await create(null, withRefusing);
    fixture.componentRef.setInput("choosesDefault", true);
    await settle();

    expect(element().querySelector("nol-select.nol-teamrun-context-window")).toBeNull();
  });

  it("offers no context window for the default teammate", async () => {
    await create(null, withWindows({ "gpt-5": 1_000_000 }));
    fixture.componentRef.setInput("choosesDefault", true);
    await settle();

    expect(element().querySelector("nol-select.nol-teamrun-context-window")).toBeNull();
  });

  it("sends a new teammate's chosen size, naming the summary and the bounds without the next-message note", async () => {
    await create(null, withWindows({ "gpt-5": 1_000_000 }));
    await type(".nol-teamrun-teammate-name", "Carol");
    expect(windowHint()).toBe(Resources.formatDefaultContextWindowSummary("1M"));
    await choose("context-window", "custom");
    expect(windowHint()).toBe(Resources.formatContextWindowBounds("100K", "1M"));
    await type(".nol-teamrun-context-window-size", "1.5M");
    expect(save().disabled).toBe(true);
    await type(".nol-teamrun-context-window-size", "300K");
    await submit();

    expect(TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate)).contextWindow).toBe(300_000);
  });

  it("drops a composer's pending move for the teammate it saves, so the teammate keeps the dialog's provider", async () => {
    const held = new DeferredResponse();
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, u =>
      ProviderListModelsParams.fromJson(u).providerId === "a3" ? held.promise : SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true)])));
    const moved = store.moveTeammate("alice", new ProviderChoice("codex", "a3", "Personal", "Codex"));

    await submit();
    expect([store.teammateMoves().size, closes]).toEqual([0, 1]);
    held.resolve(SampleData.catalog([]));
    await moved;

    expect([context.count(MethodName.TeammateUpdate), stored().providerId]).toEqual([0, "a1"]);
    expect(store.teammate("alice")?.providerId).toBe("a1");
  });

  it("saves no speed for a teammate once another model is chosen", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", "priority"));

    await choose("model", "gpt-5-mini");
    await submit();

    expect(stored().speed).toBeNull();
  });

  it("keeps the default teammate's chosen speed when it saves it", async () => {
    await create(null, t => t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", null, "priority"), "a1").toJson()));
    fixture.componentRef.setInput("choosesDefault", true);
    await settle();

    await submit();

    expect(DefaultTeammateSetParams.fromJson(context.parametersOf(MethodName.DefaultTeammateSet)).defaultTeammate?.requested.speed).toBe("priority");
  });

  it("keeps a teammate's chosen mode when it saves the teammate on the same provider", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "plan"));

    await submit();

    expect(stored().mode).toBe("plan");
  });

  it("saves no mode for a teammate moved to another provider, whose modes are its own", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "plan"), withHome(t => otherCatalog(t)));

    await choose("provider", home.id);
    await submit();

    const params = stored();
    expect([params.providerId, params.mode]).toEqual([home.id, null]);
  });

  for (const [name, moves, mode] of [
    ["keeps the default teammate's chosen mode when it saves it on the same provider", false, "plan"],
    ["saves no mode for the default teammate moved to another provider", true, null]
  ] as const)
    it(name, async () => {
      const chosen = new DefaultTeammate(new RequestedSettings("codex", "gpt-5", null, null, "plan"), "a1");
      await create(null, withHome(t => {
        otherCatalog(t);
        t.answer(MethodName.DefaultTeammateRead, () => chosen.toJson());
      }));
      fixture.componentRef.setInput("choosesDefault", true);
      await settle();

      if (moves)
        await choose("provider", home.id);
      await submit();

      expect(DefaultTeammateSetParams.fromJson(context.parametersOf(MethodName.DefaultTeammateSet)).defaultTeammate?.requested.mode).toBe(mode);
    });

  it("offers the provider's permission modes by name after Effort, tags its default, and describes the chosen one under the select", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withModes);
    const modeField = field("nol-select.nol-teamrun-mode").closest(".nol-teamrun-field")!;

    expect([titles("mode"), optionsOf("mode").map(t => t.tag), select("mode").value()]).toEqual([["Default", "Read Only", "Full Access"],
      [Resources.defaultModeTag, null, null], "auto"]);
    expect(modeField.querySelector(".nol-teamrun-field-label")?.textContent?.trim()).toBe(Resources.permissionModeLabel);
    expect(modeField.previousElementSibling).toBe(field("nol-select.nol-teamrun-effort").closest(".nol-teamrun-field"));
    expect([modeHint()?.parentElement, modeHint()?.textContent?.trim(), select("mode").describedBy()]).toEqual([modeField, modes[0]!.description, "nol-teamrun-mode-hint"]);
  });

  it("lists each mode the provider's rows refuse as a disabled option after its modes, with the rows' reasons in a note the select reads after its description", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withRefusedModes);
    const reasons = "Codex can't use a read-only mode: its guide lists read-only mode as missing. Codex can't use an unrestricted mode: TeamRun doesn't support this for it yet.";

    expect([titles("mode"), optionsOf("mode").map(t => t.isDisabled), select("mode").value()]).toEqual([["Default", "Read-only", "Unrestricted"], [false, true, true], "auto"]);
    expect([modeRefusal()?.textContent?.trim(), select("mode").describedBy()]).toEqual([reasons, "nol-teamrun-mode-hint nol-teamrun-mode-refusal"]);
  });

  it("passes over the refused modes on the arrow keys and End, and keeps Default on Enter", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withRefusedModes);
    const button = element().querySelector<HTMLButtonElement>("nol-select.nol-teamrun-mode .nol-select-button");
    const list = (): HTMLElement | null => document.querySelector<HTMLElement>(".nol-select-list");
    const active = (): string | undefined => [...document.querySelectorAll<HTMLElement>(".nol-select-option")]
      .find(t => t.id === list()?.getAttribute("aria-activedescendant"))?.querySelector(".nol-select-option-title")?.textContent?.trim();
    expect(button).not.toBeNull();
    button?.focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(list()).not.toBeNull());

    const reached: (string | undefined)[] = [];
    for (const key of ["{ArrowDown}", "{ArrowDown}", "{End}"]) {
      await userEvent.keyboard(key);
      reached.push(active());
    }
    expect([reached, [...document.querySelectorAll(".nol-select-option")].map(t => t.getAttribute("aria-disabled"))])
      .toEqual([["Default", "Default", "Default"], ["false", "true", "true"]]);
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(list()).toBeNull());
    expect(select("mode").value()).toBe("auto");
  });

  it("shows no permission mode for a provider that lists none", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);

    expect(element().querySelector("nol-select.nol-teamrun-mode")).toBeNull();
  });

  it("saves a chosen restricted mode without asking, with its description under the select", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withModes);

    await choose("mode", "read-only");

    expect(confirmTitle()).toBeUndefined();
    expect([select("mode").value(), modeHint()?.textContent?.trim()]).toEqual(["read-only", modes[1]!.description]);
    await submit();
    expect(stored().mode).toBe("read-only");
  });

  it("saves no mode once the provider's default is chosen again", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "read-only"), withModes);

    expect(select("mode").value()).toBe("read-only");
    await choose("mode", "auto");
    await submit();

    expect(stored().mode).toBeNull();
  });

  it.each([
    { answer: "Close", button: ".nol-teamrun-cancel", kept: "auto", saved: null },
    { answer: "Use Full Access", button: ".nol-teamrun-confirm", kept: "full-access", saved: "full-access" }
  ])("asks before it takes an unrestricted mode, and $answer keeps $kept", async ({ button, kept, saved }) => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withModes);

    await choose("mode", "full-access");

    expect(confirmTitle()).toBe(Resources.formatUnrestrictedModeTitle("Full Access"));
    expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatUnrestrictedModeText("Codex", modes[2]!.description));
    expect(document.querySelector("nol-teamrun-confirm-dialog .nol-teamrun-confirm")?.textContent?.trim()).toBe(Resources.formatUseMode("Full Access"));
    expect(select("mode").value()).toBe("auto");
    document.querySelector<HTMLButtonElement>(`nol-teamrun-confirm-dialog ${button}`)?.click();
    await settle();

    expect([confirmTitle(), select("mode").value()]).toEqual([undefined, kept]);
    await submit();
    expect(stored().mode).toBe(saved);
  });

  it("asks nothing when the unrestricted mode a teammate runs in is chosen again", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "full-access"), withModes);

    await choose("mode", "full-access");

    expect([confirmTitle(), select("mode").value()]).toEqual([undefined, "full-access"]);
  });

  it("offers a saved mode the provider no longer lists as not in the catalog, with no description", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, "gone"), withModes);

    expect([titles("mode")[0], select("mode").value(), modeHint(), select("mode").describedBy()]).toEqual([Resources.formatUnlisted("gone"), "gone", null, null]);
  });

  it("asks a disabled provider for no models, and keeps the teammate's saved model", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice,
      t => t.answer(MethodName.ProviderList, () => [SampleData.provider.withEnabled(false).toJson()]));

    expect(context.count(MethodName.ProviderModelCatalog)).toBe(0);
    expect(select("model").value()).toBe("gpt-5");
  });

  it("sorts the provider choice by its shown kind and name, ignoring case with an accented name beside its letter, and starts on its first enabled one", async () => {
    const provider = (id: string, kind: string, label: string, enabled = true): Provider =>
      new Provider(id, kind, label, `D:\\profiles\\${id}`, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, enabled);
    await create(null, t => t.answer(MethodName.ProviderList, () => [provider("z1", "codex", "zeta"), provider("z2", "claude", "beta"), provider("z3", "codex", "Émile"),
      provider("z4", "codex", "alpha"), provider("z5", "claude", "Alpha"), provider("z6", "codex", "edgar"), provider("z7", "claude", "Aaron", false)].map(t => t.toJson())));
    const shown = (kind: string, label: string): string => Resources.formatLocalProvider(Resources.formatProviderChoice(kind, label));

    expect(titles("provider")).toEqual([shown("Claude Code", "Alpha"), shown("Claude Code", "beta"), shown("Codex", "alpha"), shown("Codex", "edgar"),
      shown("Codex", "Émile"), shown("Codex", "zeta")]);
    expect(select("provider").value()).toBe("z5");
  });

  it("sorts a provider named as its kind, shown as the kind alone, by its name among the kind's others, and a kind it doesn't know by its id, as the Providers page does", async () => {
    const provider = (id: string, label: string, kind = "claude"): Provider =>
      new Provider(id, kind, label, `D:\\profiles\\${id}`, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    await create(null, t => t.answer(MethodName.ProviderList, () => [provider("o1", "Aaron", "other"), provider("w1", "Work"), provider("d1", "Desk"), provider("c1", "Claude Code")]
      .map(t => t.toJson())));

    expect(titles("provider")).toEqual([...["Claude Code", "Desk", "Work"].map(t => Resources.formatProviderChoice("Claude Code", t)), Resources.formatProviderChoice("other", "Aaron")]
      .map(t => Resources.formatLocalProvider(t)));
    expect(select("provider").value()).toBe("c1");
  });

  it("tags a used-up provider's choice Used up and leaves the others untagged, and drops the tag when Core lets it go", async () => {
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 100, null)];
    await create(null, t => t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson()])
      .answer(MethodName.PlanUsageList, () => [new PlanUsage("claude", "a2", windows, "2026-10-22T09:00:00.000Z", null, true).toJson()]));
    await Wait.until(() => expect(optionsOf("provider").map(t => t.tag)).toEqual([Resources.usedUpLabel, null]));
    const tagged = optionsOf("provider").map(t => [t.value, t.tag]);

    context.emit(EventName.PlanUsageUpdated, new PlanUsage("claude", "a2", windows, "2026-10-22T09:00:00.000Z").toJson());
    await settle();

    expect(tagged).toEqual([["a2", Resources.usedUpLabel], ["a1", null]]);
    expect(optionsOf("provider").map(t => t.tag)).toEqual([null, null]);
  });

  it("keeps the models and loads nothing again when the person chooses the provider already chosen", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);
    const loads = context.count(MethodName.ProviderModelCatalog);

    await choose("provider", SampleData.provider.id);

    expect(context.count(MethodName.ProviderModelCatalog)).toBe(loads);
    expect(titles("model")).toEqual([Resources.formatDefaultModel("gpt-5"), "gpt-5", "gpt-5-mini"]);
    expect(select("model").disabled()).toBe(false);
    expect(save().disabled).toBe(false);
  });

  it("adds a teammate on the first provider with a valid trimmed name and its role, then closes", async () => {
    await create(null);

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.addTeammateLabel);
    expect(select("provider").value()).toBe(SampleData.provider.id);
    expect(select("model").value()).toBe("");
    expect(save().disabled).toBe(true);

    await type(".nol-teamrun-teammate-name", "invalid  name");

    expect(save().disabled).toBe(true);

    await type(".nol-teamrun-teammate-name", "Code Reviewer");

    expect(save().disabled).toBe(false);

    await type(".nol-teamrun-teammate-name", "  Carol ");
    await type(".nol-teamrun-teammate-role", "Review **carefully**");
    await choose("effort", "medium");
    await submit();

    const params = TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate));
    expect([params.name, params.role, params.providerId, params.model, params.effort]).toEqual(["Carol", "Review **carefully**", "a1", null, "medium"]);
    expect(closes).toBe(1);
  });

  it("marks the name invalid while its text breaks the rule its hint states, and not while it is empty", async () => {
    await create(null);
    const name = field<HTMLInputElement>(".nol-teamrun-teammate-name");

    expect([name.getAttribute("aria-invalid"), name.getAttribute("aria-describedby")]).toEqual([null, "nol-teamrun-teammate-name-hint"]);
    await type(".nol-teamrun-teammate-name", "invalid  name");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    await type(".nol-teamrun-teammate-name", "  ");
    expect(name.getAttribute("aria-invalid")).toBeNull();
    await type(".nol-teamrun-teammate-name", "Code Reviewer");

    expect([name.getAttribute("aria-invalid"), save().disabled]).toEqual([null, false]);
  });

  it("marks the name and points it at the message when the name is taken, and clears both as the person types", async () => {
    await create(null, t => t.refuse(MethodName.TeammateCreate, ErrorCode.Conflict, "A teammate named Carol already exists.", "Carol"));
    const name = field<HTMLInputElement>(".nol-teamrun-teammate-name");
    await type(".nol-teamrun-teammate-name", "Carol");
    await submit();

    const message = field<HTMLElement>(".nol-teamrun-dialog-error");
    expect([name.getAttribute("aria-invalid"), name.getAttribute("aria-describedby"), message.id])
      .toEqual(["true", "nol-teamrun-teammate-name-message nol-teamrun-teammate-name-hint", "nol-teamrun-teammate-name-message"]);
    expect(message.textContent?.trim()).toBe("@Carol: A teammate named Carol already exists.");
    await type(".nol-teamrun-teammate-name", "Caroline");

    expect([name.getAttribute("aria-invalid"), name.getAttribute("aria-describedby")]).toEqual([null, "nol-teamrun-teammate-name-hint"]);
  });

  it.each([
    { reason: "for another reason", refuse: (t: FakeWindowPartContext) => t.fail(MethodName.TeammateCreate, "The provider is gone."), text: "The provider is gone." },
    { reason: "over something else than the name", refuse: (t: FakeWindowPartContext) => t.refuse(MethodName.TeammateCreate, ErrorCode.Conflict, "The provider changed.", "t1"),
      text: "The provider changed." }
  ])("leaves the name unmarked when a save is refused $reason", async ({ refuse, text }) => {
    await create(null, refuse);
    const name = field<HTMLInputElement>(".nol-teamrun-teammate-name");
    await type(".nol-teamrun-teammate-name", "Carol");
    await submit();

    expect([field<HTMLElement>(".nol-teamrun-dialog-error").textContent?.trim(), name.getAttribute("aria-invalid"), name.getAttribute("aria-describedby")])
      .toEqual([`@Carol: ${text}`, null, "nol-teamrun-teammate-name-hint"]);
  });

  it("drops a taken name's mark with its message while the person saves again", async () => {
    let release: (reason: Error) => void = () => undefined;
    await create(null, t => t.refuse(MethodName.TeammateCreate, ErrorCode.Conflict, "A teammate named Carol already exists.", "Carol"));
    const name = field<HTMLInputElement>(".nol-teamrun-teammate-name");
    await type(".nol-teamrun-teammate-name", "Carol");
    await submit();
    expect(name.getAttribute("aria-invalid")).toBe("true");

    context.answer(MethodName.TeammateCreate, () => new Promise<JsonValue>((_, reject) => {
      release = reject;
    }));
    field<HTMLFormElement>("form").requestSubmit();

    await Wait.until(() => expect([name.getAttribute("aria-invalid"), name.getAttribute("aria-describedby"), document.querySelector(".nol-teamrun-dialog-error")])
      .toEqual([null, "nol-teamrun-teammate-name-hint", null]));
    release(new Error("The provider is gone."));
    await Wait.until(() => expect(field<HTMLElement>(".nol-teamrun-dialog-error").textContent?.trim()).toBe("@Carol: The provider is gone."));
  });

  it("adds a teammate whose name has marks, such as a Hindi name", async () => {
    await create(null);
    await type(".nol-teamrun-teammate-name", "राहुल शर्मा");

    expect(save().disabled).toBe(false);
    await submit();

    expect(TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate)).name).toBe("राहुल शर्मा");
  });

  it("counts each vowel sign toward the 100-character limit, as its hint says", async () => {
    await create(null);
    await type(".nol-teamrun-teammate-name", "कि".repeat(50));
    const fits = !save().disabled;
    await type(".nol-teamrun-teammate-name", `${"कि".repeat(50)}क`);

    expect([fits, save().disabled, field("#nol-teamrun-teammate-name-hint").textContent?.includes("accent or vowel sign counting as one")]).toEqual([true, true, true]);
  });

  it("renames a teammate to a name with marks, such as a Thai name", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);
    await type(".nol-teamrun-teammate-name", "สมศักดิ์ ใจดี");

    expect(save().disabled).toBe(false);
    await submit();

    expect(TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).name).toBe("สมศักดิ์ ใจดี");
  });

  it("reports the teammate it adds before it closes", async () => {
    const order: string[] = [];
    await create(null, t => t.answer(MethodName.TeammateCreate, u => new Teammate("t9", TeammateCreateParams.fromJson(u).name, null, "a1", Harness.Provider, null, null,
      SampleData.timestamp, SampleData.timestamp).toJson()));
    fixture.componentInstance.created.subscribe(t => order.push(`created ${t.id} ${t.name}`));
    fixture.componentInstance.closed.subscribe(() => order.push("closed"));
    await type(".nol-teamrun-teammate-name", "Carol");
    await submit();

    expect(order).toEqual(["created t9 Carol", "closed"]);
  });

  it("reports no teammate when the add is refused, and keeps the dialog open with the refusal", async () => {
    await create(null, t => t.fail(MethodName.TeammateCreate, "That name is taken."));
    const created: Teammate[] = [];
    fixture.componentInstance.created.subscribe(t => created.push(t));
    await type(".nol-teamrun-teammate-name", "Carol");
    await submit();

    expect([created, closes, element().querySelector("nol-field-message")?.textContent?.trim()]).toEqual([[], 0, "@Carol: That name is taken."]);
  });

  it("asks for a first teammate on the earliest enabled provider, with a name its kind suggests that the person can change, and Not now in place of Close", async () => {
    const earliest = new Provider("a3", "claude", "Lab", "D:\\profiles\\lab", AuthStatus.LoggedIn, null, null, null, null, "2026-09-01T08:00:00.000Z");
    const disabled = new Provider("a4", "codex", "Old", "D:\\profiles\\old", AuthStatus.LoggedIn, null, null, null, null, "2026-08-01T08:00:00.000Z", false);
    await create(null, t => t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), earliest.toJson(), disabled.toJson()]));
    fixture.componentRef.setInput("first", true);
    await settle();

    expect(element().querySelector(".nol-dialog-title")?.textContent).toBe(Resources.firstTeammateTitle);
    expect([select("provider").value(), field<HTMLInputElement>(".nol-teamrun-teammate-name").value]).toEqual(["a3", "Claude"]);
    expect(field(".nol-teamrun-cancel").textContent?.trim()).toBe(Resources.notNowLabel);

    await type(".nol-teamrun-teammate-name", "Reviewer");
    await submit();

    const params = TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate));
    expect([params.name, params.providerId, closes]).toEqual(["Reviewer", "a3", 1]);
  });

  it("starts a first teammate from the short step's name and provider when it brings them, rather than the suggested ones", async () => {
    const earliest = new Provider("a3", "claude", "Lab", "D:\\profiles\\lab", AuthStatus.LoggedIn, null, null, null, null, "2026-09-01T08:00:00.000Z");
    await create(null, t => t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), earliest.toJson()]));
    fixture.componentRef.setInput("first", true);
    fixture.componentRef.setInput("draftName", "Coder");
    fixture.componentRef.setInput("draftProviderId", SampleData.provider.id);
    await settle();

    expect([select("provider").value(), field<HTMLInputElement>(".nol-teamrun-teammate-name").value]).toEqual([SampleData.provider.id, "Coder"]);
    await submit();

    const params = TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate));
    expect([params.name, params.providerId, closes]).toEqual(["Coder", SampleData.provider.id, 1]);
  });

  it.each([
    { signedIn: true, chosen: "a2" },
    { signedIn: false, chosen: "a1" }
  ])("asks for a first teammate on the earliest signed-in provider before an earlier signed-out one, or on the earliest when none is signed in ($chosen)", async ({ signedIn, chosen }) => {
    const signedOut = new Provider("a1", "claude", "Lab", "D:\\profiles\\lab", AuthStatus.LoggedOut, null, null, null, null, "2026-08-01T08:00:00.000Z");
    const later = new Provider("a2", "codex", "Work", "D:\\profiles\\work", signedIn ? AuthStatus.LoggedIn : AuthStatus.LoggedOut, null, null, null, null,
      "2026-09-01T08:00:00.000Z");
    await create(null, t => t.answer(MethodName.ProviderList, () => [later.toJson(), signedOut.toJson()]));
    fixture.componentRef.setInput("first", true);
    await settle();

    expect(select("provider").value()).toBe(chosen);
  });

  it.each([
    { providers: [new Provider("z1", "lab", "Lab home", "D:/profiles/lab", AuthStatus.LoggedIn, null, null, null, null, "2026-09-01T08:00:00.000Z")], name: "Lab home" },
    { providers: new Array<Provider>(), name: "" }
  ])("suggests a first teammate's name from its provider's own name when TeamRun has none for its kind, and no name without a provider ($name)", async ({ providers, name }) => {
    await create(null, t => t.answer(MethodName.ProviderList, () => providers.map(u => u.toJson())));
    fixture.componentRef.setInput("first", true);
    await settle();

    expect(field<HTMLInputElement>(".nol-teamrun-teammate-name").value).toBe(name);
  });

  it("saves a blank role as none, and a chosen model with no effort level, as the model's default until the person picks one", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);

    await type(".nol-teamrun-teammate-role", "   ");
    await choose("model", "gpt-5-mini");

    expect(select("effort").value()).toBe(Resources.modelDefaultEffort);
    expect(titles("effort")).toEqual(["Medium", "High"]);

    await submit();

    const params = stored();
    expect([params.id, params.role, params.model, params.effort]).toEqual(["alice", null, "gpt-5-mini", null]);
    expect(data.teammates.find(t => t.id === "alice")?.model).toBe("gpt-5-mini");
  });

  it("moves to another provider, clearing a model and effort its catalog lacks", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, withHome(t => otherCatalog(t)));

    expect(titles("provider")).toEqual(["Claude Code · Home · This computer", "Codex · Work · This computer"]);

    await choose("provider", home.id);

    expect(titles("model")).toEqual([Resources.formatDefaultModel("Other model"), "Other model"]);
    expect(select("model").value()).toBe("");
    expect(select("effort").value()).toBe(Resources.modelDefaultEffort);
    expect(select("effort").disabled()).toBe(true);

    await submit();

    const params = stored();
    expect([params.providerId, params.model, params.effort]).toEqual([home.id, null, null]);
  });

  it("keeps a model the new provider's catalog offers, and its effort when the model still has it", async () => {
    const alice = new TeammateFixture(SampleData.createContext()).alice;
    await create(alice, withHome(t => otherCatalog(t, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["high"], true, null, true)]))));

    await choose("provider", home.id);

    expect(select("model").value()).toBe("gpt-5");
    expect(select("effort").value()).toBe("high");
  });

  it("shows the catalog of the provider chosen last when an earlier provider's models arrive late", async () => {
    const late = new DeferredResponse();
    await create(new TeammateFixture(SampleData.createContext()).alice, withHome(t => otherCatalog(t, () => late.promise)));

    select("provider").valueChange.emit(home.id);
    await fixture.whenStable();
    await choose("provider", SampleData.provider.id);
    late.resolve(SampleData.catalog([new ProviderModel("other", "Other model", "", [], true, null, true)]));
    await settle();

    expect(titles("model")).toEqual([Resources.formatDefaultModel("gpt-5"), "gpt-5", "gpt-5-mini"]);
    expect(select("model").disabled()).toBe(false);
  });

  it("saves the provider's default model when the person chooses it", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);

    await choose("model", "");
    await submit();

    expect(select("model").value()).toBe("");
    expect(stored().model).toBeNull();
  });

  it("chooses no effort for a model picked before any catalog loaded", async () => {
    await create(new TeammateFixture(SampleData.createContext()).unavailable);

    await choose("model", "gpt-5");

    expect(select("model").value()).toBe("gpt-5");
    expect(select("effort").value()).toBe(Resources.modelDefaultEffort);
  });

  it("shows a teammate saved with a level's id as its model at that level, and saves it so", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "flash-medium", null, "t", "t"), t => t.answer(MethodName.ProviderModelCatalog,
      () => SampleData.catalog([new ProviderModel("flash", "Flash", "", ["flash-low", "flash-medium"], true, null, true, "flash-low", { "flash-low": "Low", "flash-medium": "Medium" })])));

    expect([select("model").value(), select("effort").value()]).toEqual(["flash", "flash-medium"]);
    await submit();

    const sent = stored();
    expect([sent.model, sent.effort]).toEqual(["flash", "flash-medium"]);
  });

  it("offers one default, named after the model it resolves to, and not the provider's own default row that stands for a listed model, choosing it for one saved as that row", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "default", null, "t", "t"), t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
      new ProviderModel("default", "Opus 5.5", "", [], true, "claude-opus-5-5", true), new ProviderModel("opus", "Opus 5.5", "", [], false, "claude-opus-5-5", true),
      new ProviderModel("sonnet", "Sonnet 5.5", "", [], false, "claude-sonnet-5-5", true)])));

    expect([titles("model"), select("model").value()]).toEqual([[Resources.formatDefaultModel("Opus 5.5"), "Opus 5.5", "Sonnet 5.5"], String.empty]);
  });

  it("offers a saved model or effort the catalog no longer lists", async () => {
    await create(new Teammate("alice", "Alice", null, "a1", Harness.Provider, "old-model", "max", "t", "t"));

    expect(titles("model")).toEqual([Resources.formatDefaultModel("gpt-5"), Resources.formatUnlisted("old-model"), "gpt-5", "gpt-5-mini"]);
    expect(titles("effort")).toEqual([Resources.formatUnlisted("max")]);
  });

  it("offers a saved provider that is gone as unavailable, with no models to choose", async () => {
    await create(new TeammateFixture(SampleData.createContext()).unavailable);

    expect(titles("provider")).toEqual([Resources.unavailableTeammateLabel, "Codex · Work · This computer"]);
    expect(select("provider").value()).toBe("missing");
    expect(select("model").disabled()).toBe(true);
    expect(element().textContent).not.toContain(Resources.noProvidersForTeammate);
  });

  it("refreshes the models, and keeps the earlier ones with a notice when the refresh fails", async () => {
    let calls = 0;
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, () => {
      calls++;
      if (calls > 1)
        throw new Error("offline");
      return SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true)]);
    }));

    field<HTMLButtonElement>(".nol-teamrun-refresh").click();
    await settle();

    expect(calls).toBe(2);
    expect(element().querySelector("[role='status']")?.textContent?.trim()).toBe(Resources.modelCatalogUnavailable);
    expect(titles("model")).toEqual([Resources.formatDefaultModel("gpt-5"), "gpt-5"]);
    expect(select("model").value()).toBe("gpt-5");
  });

  it("turns the model and Effort off with a reason for a provider that lists no models, with no built-in effort levels", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true);
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      otherCatalog(t, () => SampleData.catalog([]));
    }));
    const status = (): string | undefined => element().querySelector("[role='status']")?.textContent?.trim();

    expect(select("provider").value()).toBe(home.id);
    expect(status()).toBe(Resources.formatModelsNotListed("Claude Code"));
    expect(select("model").disabled()).toBe(true);
    expect(titles("effort")).toEqual([]);
    expect([select("effort").value(), select("effort").disabled()]).toEqual([Resources.modelDefaultEffort, true]);

    await choose("provider", SampleData.provider.id);
    expect(status()).toBeUndefined();
    expect(select("model").disabled()).toBe(false);
  });

  it("turns Effort off with a reason under it when the chosen model offers no effort levels, as Antigravity's models don't", async () => {
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    const google = new Provider("a3", "antigravity", "Google", "D:\\profiles\\antigravity", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    await create(null, t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), google.toJson()]);
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), antigravity.toJson()]);
      t.answer(MethodName.ProviderModelCatalog, u => ProviderListModelsParams.fromJson(u).providerId === google.id
        ? SampleData.catalog([new ProviderModel("gemini-pro-high", "Gemini Pro (High)", "", [], false, null, true),
          new ProviderModel("gemini-pro-low", "Gemini Pro (Low)", "", [], false, null, true)])
        : SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["medium", "high"], true, null, true)]));
    });
    const note = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-teamrun-effort-note");
    const effortField = (): HTMLElement => (fixture.debugElement.query(By.css("nol-select.nol-teamrun-effort")).nativeElement as HTMLElement).closest<HTMLElement>(".nol-teamrun-field")!;

    expect(select("provider").value()).toBe(google.id);
    expect(note()?.textContent?.trim()).toBe(Resources.noEffortLevels);
    await choose("model", "gemini-pro-low");

    expect(titles("model")).toEqual([Resources.providerDefaultModel, "Gemini Pro (High)", "Gemini Pro (Low)"]);
    expect(select("effort").disabled()).toBe(true);
    expect(titles("effort")).toEqual([]);
    expect(select("effort").value()).toBe(Resources.modelDefaultEffort);
    expect(note()?.textContent?.trim()).toBe(Resources.noEffortLevels);
    expect(note()?.getAttribute("role")).toBe("status");
    expect(effortField().nextElementSibling).toBe(note());
    expect(note()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(effortField().getBoundingClientRect().bottom - 0.5);
    expect(Math.abs(note()!.getBoundingClientRect().left - effortField().getBoundingClientRect().left)).toBeLessThan(0.5);

    await choose("provider", SampleData.provider.id);
    expect(select("effort").disabled()).toBe(false);
    expect(note()).toBeNull();
  });

  it("says an Antigravity provider's models aren't listed yet right after the Refresh button before its first reply, and lists them at the next load", async () => {
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    const google = new Provider("a3", "antigravity", "Google", "D:\\profiles\\antigravity", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    let calls = 0;
    await create(null, t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), google.toJson()]);
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), antigravity.toJson()]);
      t.answer(MethodName.ProviderModelCatalog, u => ProviderListModelsParams.fromJson(u).providerId !== google.id
        ? SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["medium", "high"], true, null, true)])
        : ++calls === 1 ? SampleData.catalog([], true, false, null, true) : SampleData.catalog([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)]));
    });
    const status = (): HTMLElement | null => element().querySelector<HTMLElement>("[role='status']");
    const awaiting = Resources.formatModelsAwaitFirstReply("Antigravity");

    expect(select("provider").value()).toBe(google.id);
    expect(status()?.textContent?.trim()).toBe(awaiting);
    expect(element().querySelectorAll("[role='status']")).toHaveLength(1);
    expect(field("nol-select.nol-teamrun-model").parentElement!.nextElementSibling).toBe(status());
    expect(status()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(field("nol-select.nol-teamrun-model").getBoundingClientRect().bottom - 0.5);
    expect(Math.abs(status()!.getBoundingClientRect().left - field("nol-select.nol-teamrun-model").getBoundingClientRect().left)).toBeLessThan(0.5);
    expect(select("model").disabled()).toBe(true);
    expect(titles("model")).toEqual([Resources.providerDefaultModel]);

    await choose("provider", SampleData.provider.id);
    await choose("provider", google.id);

    expect(calls).toBe(2);
    expect(element().textContent).not.toContain(awaiting);
    expect(select("model").disabled()).toBe(false);
    expect(titles("model")).toEqual([Resources.formatDefaultModel("Gemini Pro"), "Gemini Pro"]);
  });

  it("lists an Antigravity provider's models in the open dialog once a reply on that provider ends, and not after another provider's reply", async () => {
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    const google = new Provider("a3", "antigravity", "Google", "D:\\profiles\\antigravity", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    let calls = 0;
    await create(null, t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), google.toJson()]);
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), antigravity.toJson()]);
      t.answer(MethodName.ProviderModelCatalog, u => ProviderListModelsParams.fromJson(u).providerId !== google.id
        ? SampleData.catalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["medium", "high"], true, null, true)])
        : ++calls === 1 ? SampleData.catalog([], true, false, null, true) : SampleData.catalog([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)]));
    });
    const end = (id: string, providerId: string): void => {
      const reply = new Message(id, "c1", 3, MessageAuthor.Provider, "m1", MessageStatus.Running, [], new Provenance(providerId,
        new RequestedSettings("antigravity", null, null), new ObservedSettings("antigravity", null, null, "1.3.0"), "s1", false),
      SampleData.timestamp, SampleData.timestamp, null);
      context.emit(EventName.MessageCreated, reply.toJson());
      context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());
    };
    const awaiting = Resources.formatModelsAwaitFirstReply("Antigravity");
    expect(select("provider").value()).toBe(google.id);
    expect(element().textContent).toContain(awaiting);

    end("m3", SampleData.provider.id);
    await settle();
    expect(calls).toBe(1);
    expect(element().textContent).toContain(awaiting);
    end("m4", google.id);
    await settle();

    expect(calls).toBe(2);
    expect(element().textContent).not.toContain(awaiting);
    expect(select("model").disabled()).toBe(false);
    expect(titles("model")).toEqual([Resources.formatDefaultModel("Gemini Pro"), "Gemini Pro"]);
  });

  it("says a provider's plan includes only its default model right under the Model field, and keeps the model select open", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, "Auto");
    let calls = 0;
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      otherCatalog(t, () => ++calls === 1 ? SampleData.catalog([], true, false, "Copilot Free") : SampleData.catalog([new ProviderModel("other", "Other model", "", ["low"], true, null, true)]));
    }));
    const status = (): HTMLElement | null => element().querySelector<HTMLElement>("[role='status']");

    expect(select("provider").value()).toBe(home.id);
    const refresh = field<HTMLButtonElement>(".nol-teamrun-refresh");
    expect(status()?.textContent?.trim()).toBe(Resources.formatPlanIncludesOnly("Copilot Free", "Auto"));
    expect(element().querySelectorAll("[role='status']")).toHaveLength(1);
    expect(field("nol-select.nol-teamrun-model").parentElement!.nextElementSibling).toBe(status());
    expect(status()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(field("nol-select.nol-teamrun-model").getBoundingClientRect().bottom - 0.5);
    expect(Math.abs(status()!.getBoundingClientRect().left - field("nol-select.nol-teamrun-model").getBoundingClientRect().left)).toBeLessThan(0.5);
    expect(select("model").disabled()).toBe(false);
    expect(titles("model")).toEqual(["Auto"]);
    refresh.click();
    await settle();

    expect(calls).toBe(2);
    expect(status()).toBeNull();
    expect(titles("model")).toEqual(["Auto", "Other model"]);
  });

  it("adds to Copilot's Free-plan note and its empty-list note that a plan change needs a fresh sign-in with copilot login for the provider's own folder", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const github = new Provider("a4", "copilot", "GitHub", "D:/profiles/copilot", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    let calls = 0;
    await create(null, t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), github.toJson()])
        .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderModelCatalog, u => ProviderListModelsParams.fromJson(u).providerId !== github.id
          ? SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low"], true, null, true)])
          : ++calls === 1 ? SampleData.catalog([], true, false, "Copilot Free") : SampleData.catalog([], true, true));
    });
    const status = (): string | undefined => element().querySelector("[role='status']")?.textContent?.trim();
    const hint = Resources.formatCopilotPlanChange(github.profileDir);

    await choose("provider", github.id);
    expect(status()).toBe(`${Resources.formatPlanIncludesOnly("Copilot Free", "Auto")} ${hint}`);
    field<HTMLButtonElement>(".nol-teamrun-refresh").click();
    await settle();

    expect(calls).toBe(2);
    expect(status()).toBe(`${Resources.formatModelsCameBackEmpty("GitHub Copilot")} ${hint}`);
    expect(hint).toContain("copilot login in a terminal with COPILOT_HOME set to D:/profiles/copilot, then");
    expect(element().querySelectorAll("[role='status']")).toHaveLength(1);
  });

  it("says a provider's model list came back empty right after the Refresh button, and lists again on Refresh", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true);
    let calls = 0;
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      otherCatalog(t, () => ++calls === 1 ? SampleData.catalog([], true, true) : SampleData.catalog([new ProviderModel("other", "Other model", "", ["low"], true, null, true)]));
    }));
    const status = (): HTMLElement | null => element().querySelector<HTMLElement>("[role='status']");

    expect(select("provider").value()).toBe(home.id);
    const refresh = field<HTMLButtonElement>(".nol-teamrun-refresh");
    expect(status()?.textContent?.trim()).toBe(Resources.formatModelsCameBackEmpty("Claude Code"));
    expect(field("nol-select.nol-teamrun-model").parentElement!.nextElementSibling).toBe(status());
    expect(status()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(field("nol-select.nol-teamrun-model").getBoundingClientRect().bottom - 0.5);
    expect(select("model").disabled()).toBe(true);
    refresh.click();
    await settle();

    expect(calls).toBe(2);
    expect(status()).toBeNull();
    expect(titles("model")).toEqual([Resources.formatDefaultModel("Other model"), "Other model"]);
  });

  it("names the default model as the provider's kind does", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, "Auto");
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      otherCatalog(t, () => SampleData.catalog([]));
    }));
    expect(titles("model")).toEqual(["Auto"]);

    await choose("provider", SampleData.provider.id);

    expect(titles("model")[0]).toBe(Resources.formatDefaultModel("gpt-5"));
  });

  it("takes no model to another provider when a second provider switch comes before the first provider's models", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, "Auto");
    const spare = new Provider("a3", "claude", "Spare", "D:/profiles/spare", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const late = new DeferredResponse();
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson(), spare.toJson()]);
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      t.answer(MethodName.ProviderModelCatalog, u => {
        const providerId = ProviderListModelsParams.fromJson(u).providerId;
        return providerId === home.id ? late.promise : SampleData.catalog(providerId === spare.id ? [] : [new ProviderModel("gpt-5-mini", "gpt-5-mini", "", [], true, null, true)]);
      });
    }));
    await choose("provider", SampleData.provider.id);
    await type(".nol-teamrun-teammate-name", "Tess");
    await choose("model", "gpt-5-mini");

    select("provider").valueChange.emit(home.id);
    await fixture.whenStable();
    await choose("provider", spare.id);
    late.resolve(SampleData.catalog([]));
    await settle();

    expect(select("model").value()).toBe("");
    await submit();
    expect(data.teammates.at(-1)?.model).toBeNull();
  });

  it("takes no model to another provider whose list fails, and keeps one on another provider of the same provider", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, "Auto");
    const work = new Provider("a3", "codex", "Work", "D:/profiles/work", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    await create(null, withHome(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), home.toJson(), work.toJson()]);
      t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]);
      t.answer(MethodName.ProviderModelCatalog, u => [home.id, work.id].includes(ProviderListModelsParams.fromJson(u).providerId ?? "")
        ? Promise.reject(new Error("Offline"))
        : SampleData.catalog([new ProviderModel("gpt-5-mini", "gpt-5-mini", "", ["medium"], true, null, true)]));
    }));
    await choose("provider", SampleData.provider.id);
    await type(".nol-teamrun-teammate-name", "Tess");
    await choose("model", "gpt-5-mini");
    await choose("effort", "medium");

    await choose("provider", work.id);
    expect([select("model").value(), select("effort").value()]).toEqual(["gpt-5-mini", "medium"]);
    await choose("provider", home.id);

    expect([select("model").value(), select("effort").value()]).toEqual(["", Resources.modelDefaultEffort]);
    await submit();
    expect([data.teammates.at(-1)?.model, data.teammates.at(-1)?.effort]).toEqual([null, null]);
  });

  it("offers a model's own levels by the provider's names, starting at its default, which it tags as recommended, and on Copilot's Auto every listed model's levels, keeping a saved one", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
    const github = new Provider("a4", "copilot", "GitHub", "D:/profiles/copilot", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const erin = new Teammate("erin", "Erin", null, github.id, Harness.Provider, null, "medium", "t", "t");
    await create(erin, t => {
      data.teammates.push(erin);
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), github.toJson()])
        .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
          new ProviderModel("gpt-5", "GPT-5", "", ["low", "medium", "high"], false, null, true, "high", { high: "Deep" }),
          new ProviderModel("claude-sonnet", "Claude Sonnet", "", ["high"], false, null, true)], true, false, null, false, [], null, true));
    });

    expect(select("effort").value()).toBe("medium");
    expect([titles("effort"), optionsOf("effort").map(t => t.tag)]).toEqual([["Low", "Medium", "High"], [null, null, null]]);
    await choose("model", "gpt-5");
    expect(select("effort").value()).toBe("high");
    expect(titles("effort")).toEqual(["Low", "Medium", "Deep"]);
    expect(optionsOf("effort").map(t => t.tag)).toEqual([null, null, Resources.recommendedEffortTag]);
    await choose("effort", "low");
    await choose("model", "claude-sonnet");
    expect([select("effort").value(), titles("effort"), optionsOf("effort").map(t => t.tag)]).toEqual([Resources.modelDefaultEffort, ["High"], [null]]);
    await submit();
    expect(stored().effort).toBeNull();
  });

  it("starts a teammate with no effort at the one the provider's configuration sets, unlisted when the model doesn't list it, tags the model's default, and saves none", async () => {
    const erin = new Teammate("erin", "Erin", null, SampleData.provider.id, Harness.Provider, null, null, "t", "t");
    await create(erin, t => {
      data.teammates.push(erin);
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true, "high", { xhigh: "Extra high" }, [], null, null, null, "xhigh"),
        new ProviderModel("gpt-5-mini", "GPT-5 Mini", "", ["low", "medium"], false, null, true, "medium", {}, [], null, null, null, "low")]));
    });

    expect([select("effort").value(), titles("effort"), optionsOf("effort").map(t => t.tag)])
      .toEqual(["xhigh", [Resources.formatUnlisted("Extra high"), "Low", "High"], [null, null, Resources.recommendedEffortTag]]);
    await choose("model", "gpt-5-mini");
    expect([select("effort").value(), titles("effort"), optionsOf("effort").map(t => t.tag)]).toEqual(["low", ["Low", "Medium"], [null, Resources.recommendedEffortTag]]);
    await submit();
    expect(stored().effort).toBeNull();
  });

  it("moves a teammate with no model from Codex's ultra effort to Copilot, whose catalog lists no models, with no effort level", async () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
    const github = new Provider("a4", "copilot", "GitHub", "D:/profiles/copilot", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const dana = new Teammate("dana", "Dana", null, SampleData.provider.id, Harness.Provider, null, "ultra", "t", "t");
    await create(dana, t => {
      data.teammates.push(dana);
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), github.toJson()])
        .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), copilot.toJson()])
        .answer(MethodName.ProviderModelCatalog, u => SampleData.catalog(ProviderListModelsParams.fromJson(u).providerId === github.id ? []
          : [new ProviderModel("gpt-5", "GPT-5", "", ["low", "ultra"], true, null, true)]));
    });
    expect(select("effort").value()).toBe("ultra");

    await choose("provider", github.id);

    expect(select("effort").value()).toBe(Resources.modelDefaultEffort);
    expect(titles("effort")).toEqual([]);
    await submit();

    const params = stored();
    expect([params.providerId, params.model, params.effort]).toEqual([github.id, null, null]);
  });

  it("offers no disabled provider for a new teammate, starting it on the first enabled one", async () => {
    await create(null, t => t.answer(MethodName.ProviderList, () => [SampleData.provider.withEnabled(false).toJson(), home.toJson()]));

    expect(optionsOf("provider").map(t => t.value)).toEqual([home.id]);
    expect(select("provider").value()).toBe(home.id);
    expect(element().textContent).not.toContain(Resources.noProvidersForTeammate);
  });

  it("keeps an edited teammate's disabled provider, marked disabled, among the enabled ones", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice,
      t => t.answer(MethodName.ProviderList, () => [SampleData.provider.withEnabled(false).toJson(), home.withEnabled(false).toJson()]));

    expect(titles("provider")).toEqual(["Codex · Work · This computer (disabled)"]);
    expect(select("provider").value()).toBe(SampleData.provider.id);
    expect(save().disabled).toBe(false);
  });

  it("asks for a provider first when every provider is disabled, and can't save", async () => {
    await create(null, t => t.answer(MethodName.ProviderList, () => [SampleData.provider.withEnabled(false).toJson()]));
    await type(".nol-teamrun-teammate-name", "Carol");

    expect(element().textContent).toContain("Add a provider first, in Providers.");
    expect(select("provider").disabled()).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it("asks for a provider first when there is none, and can't save", async () => {
    await create(null, t => t.answer(MethodName.ProviderList, () => []));
    await type(".nol-teamrun-teammate-name", "Carol");

    expect(element().textContent).toContain(Resources.noProvidersForTeammate);
    expect(select("provider").disabled()).toBe(true);
    expect(save().disabled).toBe(true);

    await submit();

    expect(context.count(MethodName.TeammateCreate)).toBe(0);
  });

  it("keeps the edits open on a refusal and shows it, naming the teammate, in the dialog only", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.fail(MethodName.TeammateUpdate, "A conversation has a reply in progress"));
    await type(".nol-teamrun-teammate-name", "Alicia");
    await submit();

    expect(element().querySelector("nol-field-message")?.textContent?.trim()).toBe("@Alicia: A conversation has a reply in progress");
    expect(context.noticeText()).toBeNull();
    expect(field<HTMLInputElement>(".nol-teamrun-teammate-name").value).toBe("Alicia");
    expect(closes).toBe(0);
  });

  it("closes from Close or Escape, but not while it saves", async () => {
    const saved = new DeferredResponse();
    await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.TeammateUpdate, () => saved.promise));
    const dialog = fixture.debugElement.query(By.css("nol-dialog"));

    field<HTMLButtonElement>(".nol-teamrun-cancel").click();
    dialog.triggerEventHandler("dismissed");

    expect(closes).toBe(2);

    await type(".nol-teamrun-teammate-name", "Alicia");
    field<HTMLFormElement>("form").requestSubmit();
    await fixture.whenStable();
    dialog.triggerEventHandler("dismissed");

    expect(save().disabled).toBe(true);
    expect(field<HTMLButtonElement>(".nol-teamrun-cancel").disabled).toBe(true);
    expect(closes).toBe(2);

    saved.resolve(data.alice.toJson());
    await settle();

    expect(closes).toBe(3);
  });

  it("takes input only from its own fields", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);

    fixture.debugElement.query(By.css(".nol-teamrun-teammate-name")).triggerEventHandler("input", { target: document.createElement("div") });
    fixture.debugElement.query(By.css(".nol-teamrun-teammate-role")).triggerEventHandler("input", { target: document.createElement("div") });
    await submit();

    const params = stored();
    expect([params.name, params.role]).toEqual(["Alice", "Review"]);
  });

  it("sends only the fields the person changed, so a model another writer saved while the dialog was open stays", async () => {
    await create(new TeammateFixture(SampleData.createContext()).alice);
    data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, t.providerId, t.harness, "gpt-5-mini", null, t.createdAt, t.updatedAt) : t);

    await type(".nol-teamrun-teammate-role", "Lead");
    await submit();

    expect([context.parametersOf(MethodName.TeammateUpdate), stored().role, stored().model, stored().effort])
      .toEqual([{ teammateId: "alice", role: "Lead" }, "Lead", "gpt-5-mini", null]);
  });

  describe("Hand off to", () => {
    const rows = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("tr.nol-teamrun-usage-hand-off")];
    const rowSelect = (index: number): SelectComponent => {
      const found = fixture.debugElement.queryAll(By.css("nol-select.nol-teamrun-usage-hand-off-teammate")).at(index);
      if (Object.isUndefined(found))
        throw new Error(`Hand off to shows no row ${index + 1}.`);
      return found.componentInstance as SelectComponent;
    };
    const values = (): string[] => rows().map((_, index) => rowSelect(index).value());
    const click = async (selector: string, index: number = 0): Promise<void> => {
      const found = [...element().querySelectorAll<HTMLButtonElement>(selector)].at(index);
      if (Object.isUndefined(found))
        throw new Error(`Hand off to shows no ${selector} ${index + 1}.`);
      found.click();
      await settle();
    };
    const withLimits = (t: FakeWindowPartContext): void => {
      t.answer(MethodName.ProviderKindList, () => [reporting(SampleData.codex, true).toJson(), reporting(SampleData.claude, true).toJson()]);
    };
    const withReviewer = (t: FakeWindowPartContext): void => {
      withLimits(t);
      data.teammates.push(data.reviewer);
    };

    it("shows Off for an empty list, adds the next teammate but never the one it edits, moves, changes and removes rows, and saves the list in order", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice, withReviewer);

      expect(element().querySelector(".nol-teamrun-no-usage-hand-offs")?.textContent?.trim()).toBe(Resources.usageHandOffsOff);
      await click(".nol-teamrun-add-usage-hand-off");
      await click(".nol-teamrun-add-usage-hand-off");
      expect(rows().map(t => t.querySelector(".nol-teamrun-usage-hand-off-provider")?.textContent?.trim()))
        .toEqual(["Codex · Work · This computer", "Codex · Work · This computer"]);
      expect(rows().map(t => t.querySelector(".nol-teamrun-usage-hand-off-model")?.textContent?.trim()))
        .toEqual([Resources.providerDefaultModel, Resources.providerDefaultModel]);
      expect(rows().map(t => t.querySelector(".nol-teamrun-usage-hand-off-effort")?.textContent?.trim()))
        .toEqual([Resources.modelDefaultEffort, Resources.modelDefaultEffort]);
      expect(rowSelect(0).options().map(t => t instanceof SelectOption ? t.title : null)).toEqual(["Bob", "Offline"]);
      expect(values()).toEqual(["bob", "reviewer"]);
      await click(".nol-teamrun-usage-hand-off-down");
      expect(values()).toEqual(["reviewer", "bob"]);
      expect(rows().map(t => t.querySelector("td")?.textContent?.trim())).toEqual(["1", "2"]);
      rowSelect(1).valueChange.emit("offline");
      await settle();
      expect(values()).toEqual(["reviewer", "offline"]);
      await click(".nol-teamrun-usage-hand-off-up", 1);
      expect(values()).toEqual(["offline", "reviewer"]);
      await click(".nol-teamrun-usage-hand-off-remove", 1);
      expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-usage-hand-off-up")?.disabled).toBe(true);
      expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-usage-hand-off-down")?.disabled).toBe(true);
      expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-usage-hand-off-remove")?.getAttribute("aria-label")).toBe(Resources.formatRemove("Offline"));
      await submit();

      expect(TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).usageHandOffs).toEqual(["offline"]);
      expect(stored().usageHandOffs).toEqual(["offline"]);
    });

    it("lists an edited teammate's saved hand-offs in order as text, leaves out one that no longer exists, and saves no change when the list stays the same", async () => {
      const alice = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["reviewer", "gone", "bob"]);
      await create(alice, withReviewer);

      expect(rows().map(t => t.querySelector(".nol-teamrun-usage-hand-off-name")?.textContent?.trim())).toEqual(["Code Reviewer", "Bob"]);
      expect(element().querySelector("nol-select.nol-teamrun-usage-hand-off-teammate")).toBeNull();
      await type(".nol-teamrun-teammate-role", "Review again");
      await submit();

      expect(TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).usageHandOffs).toBeUndefined();
    });

    it("turns Add off once every other teammate is listed, and creates a new teammate with its list", async () => {
      await create(null, withLimits);
      await click(".nol-teamrun-add-usage-hand-off");
      await click(".nol-teamrun-add-usage-hand-off");
      await click(".nol-teamrun-add-usage-hand-off");

      expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-add-usage-hand-off")?.disabled).toBe(true);
      await type(".nol-teamrun-teammate-name", "Carol");
      await submit();

      expect(TeammateCreateParams.fromJson(context.parametersOf(MethodName.TeammateCreate)).usageHandOffs).toEqual(["alice", "bob", "offline"]);
    });

    it("draws no hand-off list for the default teammate", async () => {
      await create(null, withLimits);
      fixture.componentRef.setInput("choosesDefault", true);
      await settle();

      expect(element().querySelector("nol-teamrun-usage-hand-offs")).toBeNull();
    });

    it("dims Hand off to with Add off and no list on a teammate whose provider's limits TeamRun can't read, above Sustain's reason, and saves no hand-off", async () => {
      await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]));
      const handOffs = field(".nol-teamrun-usage-hand-offs-off");
      const heading = field(".nol-teamrun-usage-hand-offs-heading");
      const add = field<HTMLButtonElement>(".nol-teamrun-add-usage-hand-off");
      const reason = field(".nol-teamrun-sustain-reason");

      expect([heading.getAttribute("role"), heading.getAttribute("aria-level"), heading.textContent?.trim(), getComputedStyle(handOffs).opacity,
        handOffs.querySelector("table"), add.disabled, add.getAttribute("aria-describedby"), handOffs.closest("nol-teamrun-usage-hand-offs")?.nextElementSibling === reason])
        .toEqual(["heading", String(Resources.usageHandOffsHeadingLevel), Resources.usageHandOffsTitle, "1", null, true, reason.id, true]);
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();

      expect(TeammateUpdateParams.fromJson(context.parametersOf(MethodName.TeammateUpdate)).usageHandOffs).toEqual([]);
    });

    it("shows a refusal of the hand-offs under Hand off to's table, not under Fallback order or at the form's foot", async () => {
      await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]), t => {
        withLimits(t);
        t.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "TeamRun can't read Codex's usage limits yet.", "usageHandOffs");
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      const refusal = field(".nol-teamrun-usage-hand-offs-refusal");

      expect([refusal.textContent?.trim(), refusal.previousElementSibling?.matches("nol-configuration-table.nol-teamrun-usage-hand-offs"),
        element().querySelector(".nol-teamrun-sustain-refusal"), element().querySelector(".nol-teamrun-dialog-error")])
        .toEqual([Resources.formatTeammateError("Alicia", "TeamRun can't read Codex's usage limits yet."), true, null, null]);
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const wide = async (check: () => Promise<void>): Promise<void> => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      await page.viewport(1280, viewport.height);
      try {
        await check();
      }
      finally {
        await page.viewport(viewport.width, viewport.height);
      }
    };
    const formPart = (position: number): DOMRect => box(field(`form > :nth-child(${position})`));
    const labelOf = (position: number): DOMRect => box(field(`form > :nth-child(${position}) .nol-teamrun-field-label`));

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("splits the fallback table like the design: the model column 7.5rem wide with its lines wrapping, the position column narrow and the provider column the rest", async () => {
      await wide(async () => {
        await create(sustained, withSustain);
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const table = box(field(".nol-teamrun-fallbacks table")).width;
        const column = (position: number): number => box(field(`.nol-teamrun-fallbacks thead th:nth-child(${position})`)).width;

        expect([Math.round(column(3)), column(1) <= 1.5 * rem, Math.round(column(1) + column(2) + column(3) + column(4))])
          .toEqual([Math.round(7.5 * rem), true, Math.round(table)]);
      });
    });

    it("draws the dialog at the theme's medium width on a wide window, its form filling it inside the kit's body padding", async () => {
      await wide(async () => {
        await create(new TeammateFixture(SampleData.createContext()).alice);
        const dialog = field("nol-dialog");
        const body = field(".nol-dialog-body");
        const border = Number.parseFloat(getComputedStyle(dialog).borderInlineStartWidth);
        const form = box(field("form"));
        const inset = getComputedStyle(body);

        expect([box(dialog).width, box(body).left - box(dialog).left, form.left - box(body).left, box(body).right - form.right].map(t => Math.round(t)))
          .toEqual([AppearanceFixture.measureLook("dialog-medium-width"), border, Number.parseFloat(inset.paddingInlineStart), Number.parseFloat(inset.paddingInlineEnd) + body.offsetWidth - body.clientWidth]
            .map(t => Math.round(t)));
      });
    });

    it("spaces the form's fields by the spacing scale, and a field's label, control and hint a quarter rem apart", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const [nameField, providerField, modelField, effortField, sustainField, roleField] = [formPart(1), formPart(2), formPart(3), formPart(4), formPart(5),
        formPart(6)];
      const name = box(field(".nol-teamrun-teammate-name"));
      const nameHint = box(field("#nol-teamrun-teammate-name-hint"));

      AppearanceFixture.expectPixels(providerField.top - nameField.bottom, space(3));
      AppearanceFixture.expectPixels(modelField.top - providerField.bottom, space(3));
      AppearanceFixture.expectPixels(effortField.top - modelField.bottom, space(3));
      AppearanceFixture.expectPixels(sustainField.top - effortField.bottom, space(3));
      AppearanceFixture.expectPixels(roleField.top - sustainField.bottom, space(3));
      AppearanceFixture.expectPixels(name.top - labelOf(1).bottom, space(1));
      AppearanceFixture.expectPixels(nameHint.top - name.bottom, space(1));
      AppearanceFixture.expectPixels(box(field("nol-select.nol-teamrun-provider")).top - labelOf(2).bottom, space(1));
      AppearanceFixture.expectPixels(box(field("nol-select.nol-teamrun-model")).top - labelOf(3).bottom, space(1));
      AppearanceFixture.expectPixels(box(field("nol-select.nol-teamrun-effort")).top - labelOf(4).bottom, space(1));
      AppearanceFixture.expectPixels(box(field(".nol-teamrun-teammate-role")).top - labelOf(6).bottom, space(1));
    });

    it("runs Hand off to's table to the form's edges, a saved row's teammate as text in its column, its provider and the effort a line under, and Remove on the end edge", async () => {
      const alice = new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]);
      await create(alice, t => t.answer(MethodName.ProviderKindList, () => [reporting(SampleData.codex, true).toJson()]));
      const form = box(field<HTMLFormElement>("form"));
      const table = box(field(".nol-teamrun-usage-hand-offs table"));
      const [teammateHead, modelHead] = [box(field(".nol-teamrun-usage-hand-offs th:nth-child(2)")), box(field(".nol-teamrun-usage-hand-offs th:nth-child(3)"))];
      const teammate = box(field(".nol-teamrun-usage-hand-off-name"));
      const provider = box(field(".nol-teamrun-usage-hand-off-provider"));
      const [name, under] = [getComputedStyle(field(".nol-teamrun-usage-hand-off-name")), getComputedStyle(field(".nol-teamrun-usage-hand-off-provider"))];
      const muted = element().appendChild(document.createElement("span"));
      muted.style.color = "var(--nol-text-muted)";
      const [model, effort] = [box(field(".nol-teamrun-usage-hand-off-model")), box(field(".nol-teamrun-usage-hand-off-effort"))];
      const remove = box(field(".nol-teamrun-usage-hand-off-remove"));
      const add = box(field(".nol-teamrun-add-usage-hand-off"));

      AppearanceFixture.expectPixels(table.left, form.left);
      AppearanceFixture.expectPixels(table.right, form.right);
      AppearanceFixture.expectPixels(teammate.left, teammateHead.left + space(2));
      expect(teammate.right).toBeLessThanOrEqual(modelHead.left + 0.5);
      AppearanceFixture.expectPixels(provider.left, teammate.left);
      AppearanceFixture.expectPixels(provider.top, teammate.bottom);
      expect([name.fontSize, under.color]).toEqual([under.fontSize, getComputedStyle(muted).color]);
      muted.remove();
      AppearanceFixture.expectPixels(effort.left, model.left);
      AppearanceFixture.expectPixels(effort.top, model.bottom);
      AppearanceFixture.expectPixels(remove.right, form.right);
      AppearanceFixture.expectPixels(add.right, form.right);
      AppearanceFixture.expectPixels(add.height, box(field(".nol-teamrun-save")).height);
      expect(field(".nol-teamrun-add-usage-hand-off").classList).toContain("nol-button-secondary");
    });

    it("runs a dimmed Hand off to's Add to the form's end edge, half a rem above Sustain's reason, on a teammate whose provider's limits TeamRun can't read", async () => {
      await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]));
      const [form, handOffs] = [box(field<HTMLFormElement>("form")), box(field(".nol-teamrun-usage-hand-offs-off"))];
      const [add, reason] = [box(field(".nol-teamrun-add-usage-hand-off")), box(field(".nol-teamrun-sustain-reason"))];

      AppearanceFixture.expectPixels(handOffs.left, form.left);
      AppearanceFixture.expectPixels(add.right, form.right);
      AppearanceFixture.expectPixels(add.height, box(field(".nol-teamrun-save")).height);
      AppearanceFixture.expectPixels(handOffs.height, add.height);
      AppearanceFixture.expectPixels(reason.top - add.bottom, space(2));
      AppearanceFixture.expectPixels(reason.left, form.left);
    });

    it("draws a refusal of the hand-offs under Hand off to's table as Sustain's sits under Fallback order, from the form's start edge", async () => {
      await create(sustained, t => {
        withSustain(t);
        t.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "Entry 3 is the same as entry 2.", "fallbacks");
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      const fallbacksGap = box(field(".nol-teamrun-sustain-refusal")).top - box(field("nol-configuration-table.nol-teamrun-fallbacks")).bottom;
      context.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "TeamRun can't read Codex's usage limits yet.", "usageHandOffs");
      await submit();
      const [form, table, refusal] = [box(field<HTMLFormElement>("form")), box(field("nol-configuration-table.nol-teamrun-usage-hand-offs")),
        box(field(".nol-teamrun-usage-hand-offs-refusal"))];

      AppearanceFixture.expectPixels(refusal.top - table.bottom, fallbacksGap);
      AppearanceFixture.expectPixels(refusal.left, form.left);
      expect(element().querySelector(".nol-teamrun-sustain-refusal")).toBeNull();
    });

    it("draws an unavailable Sustain's label muted at full opacity and dims only its switch", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const shown = (target: Element | null): number => target === null ? 1 : Number.parseFloat(getComputedStyle(target).opacity) * shown(target.parentElement);
      const label = field(".nol-teamrun-sustain-label");
      const probe = element().appendChild(document.createElement("span"));
      probe.style.color = forcedColors === "active" ? "GrayText" : "var(--nol-text-muted)";

      expect([shown(label), getComputedStyle(label).color]).toEqual([1, getComputedStyle(probe).color]);
      expect(shown(field("nol-switch.nol-teamrun-sustain-switch [role=switch]"))).toBeLessThan(1);
      probe.remove();
    });

    it("dims a Hand off to's heading and Add once each, not through their row, on a teammate whose provider's limits TeamRun can't read", async () => {
      await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]));
      const shown = (target: Element | null): number => target === null ? 1 : Number.parseFloat(getComputedStyle(target).opacity) * shown(target.parentElement);
      const [heading, add] = [field(".nol-teamrun-usage-hand-offs-heading"), field(".nol-teamrun-add-usage-hand-off")];
      const dimmed = forcedColors === "active" ? 1 : 0.5;

      expect([shown(heading), shown(add.querySelector(":scope > .nol-button-face, :scope > .nol-icon-button-face") ?? add), forcedColors !== "active" || getComputedStyle(heading).color === getComputedStyle(add).color]).toEqual([dimmed, dimmed, true]);
    });

    it("splits Hand off to's table like Sustain's: the model column 7.5rem wide with its lines wrapping, the position column narrow and the teammate column the rest", async () => {
      await wide(async () => {
        await create(new Teammate("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", "t", "t", null, null, null, ["bob"]),
          t => t.answer(MethodName.ProviderKindList, () => [reporting(SampleData.codex, true).toJson()]));
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const table = box(field(".nol-teamrun-usage-hand-offs table")).width;
        const column = (position: number): number => box(field(`.nol-teamrun-usage-hand-offs thead th:nth-child(${position})`)).width;

        expect([Math.round(column(3)), column(1) <= 1.5 * rem, Math.round(column(1) + column(2) + column(3) + column(4))])
          .toEqual([Math.round(7.5 * rem), true, Math.round(table)]);
      });
    });

    it("marks a configured level the model doesn't list as the chosen option, in the kit's chosen-option colours, at the listed options' text start and height", async () => {
      const erin = new Teammate("erin", "Erin", null, SampleData.provider.id, Harness.Provider, null, null, "t", "t");
      await create(erin, t => {
        data.teammates.push(erin);
        t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
          new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true, "high", { xhigh: "Extra high" }, [], null, null, null, "xhigh")]));
      });
      field<HTMLButtonElement>("nol-select.nol-teamrun-effort .nol-select-button").click();
      await Wait.until(() => expect(document.querySelectorAll(".nol-select-list .nol-select-option")).toHaveLength(3));
      const option = (value: string): HTMLElement => {
        const found = document.querySelector<HTMLElement>(`.nol-select-list .nol-select-option[data-value="${value}"]`);
        if (Object.isNull(found))
          throw new Error(`The effort list shows no ${value} option.`);
        return found;
      };
      const [unlisted, listed] = [option("xhigh"), option("low")];
      const title = (shown: HTMLElement): DOMRect => box(shown.querySelector(".nol-select-option-title") ?? shown);
      const [text, band] = [getComputedStyle(unlisted).color, getComputedStyle(unlisted, "::before").backgroundColor];
      const tokenColor = (property: "color" | "background-color", token: string): string => {
        const probe = document.body.appendChild(document.createElement("div"));
        probe.style.setProperty(property, `var(--nol-${token})`);
        const color = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return color;
      };

      expect([unlisted.textContent?.trim(), unlisted.getAttribute("aria-selected"), listed.getAttribute("aria-selected")])
        .toEqual([Resources.formatUnlisted("Extra high"), "true", "false"]);
      if (forcedColors === "active")
        expect(AppearanceFixture.contrast(text, band), `the text ${text} on the band ${band}`).toBeGreaterThanOrEqual(4.5);
      else
        expect([text, band]).toEqual([tokenColor("color", "list-active-text"), tokenColor("background-color", "list-active")]);
      AppearanceFixture.expectPixels(title(unlisted).left, title(listed).left);
      AppearanceFixture.expectPixels(box(unlisted).height, box(listed).height);
    });

    it("runs a disabled field to the form's edges, with its reason in a note a quarter rem below it, starting at its edge", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice, withRefusing);
      const form = box(field<HTMLFormElement>("form"));
      const speed = box(field("nol-select.nol-teamrun-speed"));
      const note = box(field("#nol-teamrun-speed-refusal"));

      AppearanceFixture.expectPixels(speed.left, form.left);
      AppearanceFixture.expectPixels(speed.right, form.right);
      AppearanceFixture.expectPixels(speed.height, box(field("nol-select.nol-teamrun-model")).height);
      AppearanceFixture.expectPixels(note.top - speed.bottom, space(1));
      AppearanceFixture.expectPixels(note.left, speed.left);
      expect(note.right).toBeLessThanOrEqual(form.right + 0.5);
    });

    it("runs each control to the form's edges, and ends the Model label's line with the refresh text button, its text on the field's end edge", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const form = box(field<HTMLFormElement>("form"));
      const refresh = field(".nol-teamrun-refresh");

      for (const selector of [".nol-teamrun-teammate-name", "nol-select.nol-teamrun-provider", "nol-select.nol-teamrun-model", "nol-select.nol-teamrun-effort",
        ".nol-teamrun-teammate-role"]) {
        AppearanceFixture.expectPixels(box(field(selector)).left, form.left);
        AppearanceFixture.expectPixels(box(field(selector)).right, form.right);
      }
      const label = document.createRange();
      label.selectNodeContents(refresh.querySelector(":scope > .nol-button-face") ?? refresh);

      const text = label.getBoundingClientRect();
      const model = labelOf(3);
      const modelText = document.createRange();
      modelText.selectNodeContents(field("form > :nth-child(3) .nol-teamrun-field-label"));
      const caption = modelText.getBoundingClientRect();

      AppearanceFixture.expectPixels(text.right, form.right);
      expect(box(refresh).left).toBeGreaterThanOrEqual(model.right + space(2) - 0.5);
      AppearanceFixture.expectPixels(text.top + text.height / 2, caption.top + caption.height / 2);
      AppearanceFixture.expectPixels(model.left, form.left);
      expect(refresh.classList).toContain("nol-button-text");
    });

    it("labels each field in the form's own text and weight, in the muted color of its hints", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const form = getComputedStyle(field("form"));
      const hint = getComputedStyle(field("#nol-teamrun-teammate-name-hint"));
      const labels = [...element().querySelectorAll(".nol-teamrun-field-label")].map(t => getComputedStyle(t));

      expect(labels).toHaveLength(6);
      expect(labels.map(t => [t.fontSize, t.fontWeight, t.color])).toEqual(labels.map(() => [form.fontSize, form.fontWeight, hint.color]));
    });

    it.each([
      { provider: "Claude", speeds: [new ProviderSpeed("standard", "Standard"), new ProviderSpeed("fast", "Fast")], standard: "standard" },
      { provider: "Codex", speeds: [new ProviderSpeed("priority", "Fast"), new ProviderSpeed("flex")], standard: null }
    ])("draws $provider's speed as a field like effort's, its label space-1 above a select that runs to the form's edges", async ({ speeds, standard }) => {
      await create(new TeammateFixture(SampleData.createContext()).alice, t => t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5", "gpt-5", "", ["high"], true, null, true, null, {}, speeds, standard)])));
      const form = box(field<HTMLFormElement>("form"));
      const speed = box(field("nol-select.nol-teamrun-speed"));

      AppearanceFixture.expectPixels(formPart(5).top - formPart(4).bottom, space(3));
      AppearanceFixture.expectPixels(formPart(6).top - formPart(5).bottom, space(3));
      AppearanceFixture.expectPixels(speed.top - labelOf(5).bottom, space(1));
      AppearanceFixture.expectPixels(labelOf(5).left, form.left);
      AppearanceFixture.expectPixels(speed.left, form.left);
      AppearanceFixture.expectPixels(speed.right, form.right);
      AppearanceFixture.expectPixels(speed.height, box(field("nol-select.nol-teamrun-effort")).height);
    });

    it("draws the permission mode as a field like effort's, its label space-1 above a select that runs to the form's edges, and its description space-1 under it", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice, withModes);
      const form = box(field<HTMLFormElement>("form"));
      const mode = box(field("nol-select.nol-teamrun-mode"));
      const hint = box(modeHint()!);
      const modeField = field("nol-select.nol-teamrun-mode").closest(".nol-teamrun-field")!;
      const label = box(modeField.querySelector(".nol-teamrun-field-label")!);

      expect([modeField.previousElementSibling?.contains(field("nol-select.nol-teamrun-effort")), modeField.nextElementSibling === field("nol-teamrun-sustain-settings")])
        .toEqual([true, true]);
      AppearanceFixture.expectPixels(box(modeField).top - box(modeField.previousElementSibling!).bottom, space(3));
      AppearanceFixture.expectPixels(box(modeField.nextElementSibling!).top - box(modeField).bottom, space(3));
      AppearanceFixture.expectPixels(mode.top - label.bottom, space(1));
      AppearanceFixture.expectPixels(hint.top - mode.bottom, space(1));
      AppearanceFixture.expectPixels(box(modeField).bottom, hint.bottom);
      AppearanceFixture.expectPixels(label.left, form.left);
      AppearanceFixture.expectPixels(hint.left, form.left);
      AppearanceFixture.expectPixels(mode.left, form.left);
      AppearanceFixture.expectPixels(mode.right, form.right);
      AppearanceFixture.expectPixels(mode.height, box(field("nol-select.nol-teamrun-effort")).height);
      expect(getComputedStyle(modeHint()!).color).toBe(getComputedStyle(field("#nol-teamrun-teammate-name-hint")).color);
    });

    it("draws the refused modes' note like the mode's description, space-1 under it, on the form's edges and in its color", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice, withRefusedModes);
      const form = box(field<HTMLFormElement>("form"));
      const hint = field("#nol-teamrun-mode-hint");
      const note = field("#nol-teamrun-mode-refusal");
      const modeField = field("nol-select.nol-teamrun-mode").closest(".nol-teamrun-field");

      expect(note.parentElement).toBe(modeField);
      AppearanceFixture.expectPixels(box(note).top - box(hint).bottom, space(1));
      AppearanceFixture.expectPixels(box(note).left, form.left);
      AppearanceFixture.expectPixels(box(note).left, box(hint).left);
      AppearanceFixture.expectPixels(box(note).bottom, box(note.parentElement ?? note).bottom);
      expect(getComputedStyle(note).color).toBe(getComputedStyle(hint).color);
    });

    it("draws the context window as a field like effort's, its custom size and hint each space-1 under the one before, on the form's edges", async () => {
      await create(windowed(150_000), withWindows({ "gpt-5": 1_000_000 }));
      const form = box(field<HTMLFormElement>("form"));
      const chooser = field("nol-select.nol-teamrun-context-window");
      const windowField = chooser.closest(".nol-teamrun-field")!;
      const label = box(windowField.querySelector(".nol-teamrun-field-label")!);
      const choice = box(chooser);
      const size = box(field(".nol-teamrun-context-window-size"));
      const hint = box(field("#nol-teamrun-context-window-hint"));

      expect([windowField.previousElementSibling?.contains(field("nol-select.nol-teamrun-effort")),
        windowField.nextElementSibling === field("nol-teamrun-sustain-settings")]).toEqual([true, true]);
      AppearanceFixture.expectPixels(box(windowField).top - box(windowField.previousElementSibling!).bottom, space(3));
      AppearanceFixture.expectPixels(box(windowField.nextElementSibling!).top - box(windowField).bottom, space(3));
      AppearanceFixture.expectPixels(choice.top - label.bottom, space(1));
      AppearanceFixture.expectPixels(size.top - choice.bottom, space(1));
      AppearanceFixture.expectPixels(hint.top - size.bottom, space(1));
      AppearanceFixture.expectPixels(box(windowField).bottom, hint.bottom);
      for (const part of [label, choice, size, hint]) {
        AppearanceFixture.expectPixels(part.left, form.left);
      }
      for (const part of [choice, size]) {
        AppearanceFixture.expectPixels(part.right, form.right);
      }
      AppearanceFixture.expectPixels(choice.height, box(field("nol-select.nol-teamrun-effort")).height);
      AppearanceFixture.expectPixels(size.height, box(field(".nol-teamrun-teammate-name")).height);
      expect(getComputedStyle(field("#nol-teamrun-context-window-hint")).color).toBe(getComputedStyle(field("#nol-teamrun-teammate-name-hint")).color);
    });

    it("puts the note that there is no provider on its own row, space-3 below the provider field", async () => {
      await create(null, t => t.answer(MethodName.ProviderList, () => []));
      const note = field(".nol-teamrun-no-providers");

      expect(note.parentElement).toBe(field("form"));
      AppearanceFixture.expectPixels(box(note).top - formPart(2).bottom, space(3));
      AppearanceFixture.expectPixels(formPart(4).top - box(note).bottom, space(3));
    });

    it("draws the role as the kit's text field on four lines, with the name field's border, corners, padding, colors, text and focus look", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const nameField = field<HTMLInputElement>(".nol-teamrun-teammate-name");
      const roleField = field<HTMLTextAreaElement>(".nol-teamrun-teammate-role");
      const name = getComputedStyle(nameField);
      const role = getComputedStyle(roleField);
      const looks = (style: CSSStyleDeclaration): string[] => [style.borderTopWidth, style.borderTopStyle, style.borderTopColor, style.borderTopLeftRadius,
        style.paddingLeft, style.paddingRight, style.backgroundColor, style.color, style.fontSize, style.lineHeight];
      const focusLook = (target: HTMLElement): string[] => {
        target.focus();
        const style = getComputedStyle(target);

        return [style.borderTopColor, style.outlineStyle, style.outlineColor, style.outlineWidth];
      };
      const padding = Number.parseFloat(name.paddingLeft);
      const border = Number.parseFloat(name.borderTopWidth);

      expect([roleField.tagName, roleField.classList.contains("nol-text-field"), roleField.rows]).toEqual(["TEXTAREA", true, Resources.teammateRoleRows]);
      expect(looks(role)).toEqual(looks(name));
      AppearanceFixture.expectPixels(Number.parseFloat(role.paddingTop), padding);
      AppearanceFixture.expectPixels(Number.parseFloat(role.paddingBottom), padding);
      AppearanceFixture.expectPixels(box(roleField).height, Resources.teammateRoleRows * Number.parseFloat(name.lineHeight) + 2 * (padding + border));
      expect(focusLook(roleField)).toEqual(focusLook(nameField));
    });

    it("spaces the usage group's switch, table and option half a rem apart, at the form's edges, a new entry's selects filling their cell a quarter rem apart", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      const group = box(field(".nol-teamrun-sustain"));
      const form = box(field("form"));
      const parts = [".nol-teamrun-sustain-heading", ".nol-teamrun-sustain-row", ".nol-teamrun-sustain-hint", "nol-configuration-table.nol-teamrun-fallbacks",
        "nol-checkbox.nol-teamrun-resets-soonest"].map(t => box(field(t)));
      const table = box(field(".nol-teamrun-fallbacks table"));
      const cell = field(".nol-teamrun-fallback:nth-child(4) td:nth-child(2)");
      const padding = getComputedStyle(cell);
      const select = box(field(".nol-teamrun-fallback:nth-child(4) nol-select.nol-teamrun-fallback-connection"));
      const [model, effort] = [box(field(".nol-teamrun-fallback:nth-child(4) nol-select.nol-teamrun-fallback-model")),
        box(field(".nol-teamrun-fallback:nth-child(4) nol-select.nol-teamrun-fallback-effort"))];
      const way = box(field(".nol-teamrun-fallback:nth-child(4) .nol-teamrun-fallback-way"));

      parts.slice(1).forEach((part, index) => AppearanceFixture.expectPixels(part.top - nth(parts, index).bottom, space(2)));
      const [switched, label] = [box(field("nol-switch.nol-teamrun-sustain-switch")), box(field(".nol-teamrun-sustain-label"))];
      AppearanceFixture.expectPixels(switched.left - group.left, 0);
      AppearanceFixture.expectPixels(label.left - switched.right, space(2));
      AppearanceFixture.expectPixels(group.left - form.left, 0);
      AppearanceFixture.expectPixels(form.right - group.right, 0);
      AppearanceFixture.expectPixels(table.left - group.left, 0);
      AppearanceFixture.expectPixels(group.right - table.right, 0);
      AppearanceFixture.expectPixels(nth(parts, 4).left - group.left, 0);
      AppearanceFixture.expectPixels(select.left - box(cell).left, parseFloat(padding.paddingInlineStart));
      AppearanceFixture.expectPixels(box(cell).right - select.right, parseFloat(padding.paddingInlineEnd));
      AppearanceFixture.expectPixels(way.top - select.bottom, space(1));
      AppearanceFixture.expectPixels(way.left - select.left, 0);
      AppearanceFixture.expectPixels(effort.top - model.bottom, space(1));
      AppearanceFixture.expectPixels(effort.left - model.left, 0);
      AppearanceFixture.expectPixels(effort.width, model.width);
      expect([...element().querySelectorAll<HTMLElement>(".nol-teamrun-fallback-own .nol-teamrun-action-slot")].map(t => getComputedStyle(t).visibility))
        .toEqual(["hidden", "hidden", "hidden"]);
    });

    it("shows the usage group of a teammate whose limits aren't read as its heading over a disabled switch and its label, then Hand off to's heading and the reason, half a rem apart", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      const group = box(field(".nol-teamrun-sustain"));
      const at = (selector: string): DOMRect => box(field(selector));
      const switched = at("nol-switch.nol-teamrun-sustain-switch");

      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-row").top - at(".nol-teamrun-sustain-heading").bottom, space(2));
      AppearanceFixture.expectPixels(at(".nol-teamrun-usage-hand-offs-off").top - at(".nol-teamrun-sustain-row").bottom, space(2));
      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-reason").top - at(".nol-teamrun-usage-hand-offs-off").bottom, space(2));
      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-heading").left - group.left, 0);
      AppearanceFixture.expectPixels(switched.left - group.left, 0);
      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-label").left - switched.right, space(2));
      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-reason").left - group.left, 0);
      expect(element().querySelector(".nol-teamrun-fallbacks")).toBeNull();
    });

    it("draws the usage group of a teammate with Sustain off as its heading over the switch and its label, then Hand off to, half a rem apart", async () => {
      await create(resting, withSustain);
      const group = box(field(".nol-teamrun-sustain"));
      const at = (selector: string): DOMRect => box(field(selector));
      const switched = at("nol-switch.nol-teamrun-sustain-switch");

      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-row").top - at(".nol-teamrun-sustain-heading").bottom, space(2));
      AppearanceFixture.expectPixels(at("nol-teamrun-usage-hand-offs").top - at(".nol-teamrun-sustain-row").bottom, space(2));
      AppearanceFixture.expectPixels(group.bottom - at("nol-teamrun-usage-hand-offs").bottom, 0);
      AppearanceFixture.expectPixels(switched.left - group.left, 0);
      AppearanceFixture.expectPixels(at(".nol-teamrun-sustain-label").left - switched.right, space(2));
      expect(element().querySelector(".nol-teamrun-fallbacks")).toBeNull();
    });

    it("draws a refusal of the Sustain settings with Sustain off half a rem and its own margin under the switch and over Hand off to, from the group's start edge", async () => {
      await create(resting, t => {
        withSustain(t);
        t.refuse(MethodName.TeammateUpdate, ErrorCode.InvalidParams, "That provider no longer exists.", "fallbacks");
      });
      await type(".nol-teamrun-teammate-name", "Alicia");
      await submit();
      const group = box(field(".nol-teamrun-sustain"));
      const at = (selector: string): DOMRect => box(field(selector));
      const refusal = at(".nol-teamrun-sustain-refusal");
      const margins = getComputedStyle(field(".nol-teamrun-sustain-refusal"));

      AppearanceFixture.expectPixels(refusal.top - at(".nol-teamrun-sustain-row").bottom, space(2) + parseFloat(margins.marginTop));
      AppearanceFixture.expectPixels(at("nol-teamrun-usage-hand-offs").top - refusal.bottom, space(2) + parseFloat(margins.marginBottom));
      AppearanceFixture.expectPixels(refusal.left - group.left, 0);
    });

    it("puts Close as a text button before Save, half a rem apart, with Save at the end of the actions", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);

      DialogActionsFixture.expectCloseThenPrimary(element(), ".nol-teamrun-save");
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the teammate dialog visible under forced colours", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(AccessibilityFixture.popups(element())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the teammate dialog at 200% zoom", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });

    it("keeps the Sustain group of a sustained teammate visible under forced colours, with an entry just added", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      expect(element().querySelectorAll(".nol-teamrun-fallback nol-select")).toHaveLength(3);
    });

    it("neither cuts, crosses nor loses a control of a sustained teammate's Sustain group at 200% zoom, with an entry just added", async () => {
      await create(sustained, withSustain);
      field<HTMLButtonElement>(".nol-teamrun-add-fallback").click();
      await settle();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the teammate dialog by keyboard, with a visible ring", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the teammate dialog", async () => {
      await create(new TeammateFixture(SampleData.createContext()).alice);
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
