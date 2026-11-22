/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { AbilityCell, AbilitySource, MethodName, ProviderAbility, ProviderKind } from "@noldova/teamrun.protocol";

import { AbilitiesPageComponent } from "../../../../src/app/components/abilities-page/abilities-page.component";
import { AbilitySettingsRows } from "../../../../src/app/services/ability-settings-rows";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("AbilitiesPageComponent", () => {
  const cursor = new ProviderKind("cursor", "Cursor", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({
      [ProviderAbility.Resume]: AbilityCell.works(AbilitySource.Outside),
      [ProviderAbility.Fork]: AbilityCell.cannot("its fork answers that it has no such method"),
      [ProviderAbility.Compact]: AbilityCell.cannot("it has no compact command. Ask it to summarize?"),
      [ProviderAbility.ChooseSpeed]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet; Cursor offers fast and normal"),
      [ProviderAbility.PlanMode]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet"),
      [ProviderAbility.Images]: AbilityCell.notChecked("Image blocks are read; never seen one")
    }));
  const pi = new ProviderKind("pi", "Pi", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.Fork]: AbilityCell.works(AbilitySource.AcpAddition) }));
  const untabled = new ProviderKind("old", "Old", true);
  let context: FakeWindowPartContext;
  let listed: readonly ProviderKind[] | null;
  let reads: number;
  let fixture: ComponentFixture<AbilitiesPageComponent>;

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The page has no element.");
    return native;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => Required.of(t.textContent).trim().replace(/\s+/gu, " "));
  const row = (ability: ProviderAbility): HTMLElement => {
    const found = element().querySelector<HTMLElement>(`.nol-teamrun-ability[data-ability="${ability}"]`);
    if (Object.isNull(found))
      throw new Error(`There is no row for ${ability}.`);
    return found;
  };
  const create = async (kinds: readonly ProviderKind[] | null, rows: boolean = false): Promise<void> => {
    listed = kinds;
    reads = 0;
    context = SampleData.createContext().answer(MethodName.ProviderKindList, () => {
      reads++;
      if (Object.isNull(listed))
        throw new RuntimeRequestException(FailureCode.Unavailable, "The runtime is restarting.");
      return listed.map(t => t.toJson());
    });
    if (rows)
      AbilitySettingsRows.register(context, ChatStoreService.of(context));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(AbilitiesPageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  };

  it("groups every ability of the first provider with a table under Chats, Choices, Modes and approvals, In a reply, Sub-agents and commands, MCP servers, Sign-in and install and / commands, the commands last in their own order", async () => {
    await create([untabled, cursor, pi]);

    await Wait.until(() => expect(texts(".nol-settings-group-title")).toEqual(["Chats", "Choices", "Modes and approvals", "In a reply", "Sub-agents and commands", "MCP servers", "Sign-in and install", "/ commands"]));
    expect(element().querySelectorAll(".nol-teamrun-ability")).toHaveLength(Object.values(ProviderAbility).length);
    expect(texts(".nol-teamrun-ability-group:last-of-type .nol-setting-row-title")).toEqual(["/compact", "Commands the provider lists", "Other built-in commands",
      "Custom commands, prompts and skills", "/logout"]);
    expect(new Set([...element().querySelectorAll<HTMLElement>(".nol-teamrun-ability")].map(t => t.dataset["ability"]))).toEqual(new Set(Object.values(ProviderAbility)));
    expect(texts(".nol-setting-row-title", row(ProviderAbility.RunTurn))).toEqual(["Run and stop a turn"]);
    expect(texts("nol-select.nol-teamrun-abilities-kind .nol-select-button")[0]).toContain("Cursor");
  });

  it("ends each row with its answer, gives where a working one comes from, and a reason for one that can't, isn't built or isn't checked", async () => {
    await create([cursor, pi]);
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-ability").length).toBeGreaterThan(0));

    expect([ProviderAbility.RunTurn, ProviderAbility.Resume, ProviderAbility.Fork, ProviderAbility.Compact, ProviderAbility.ChooseSpeed, ProviderAbility.PlanMode, ProviderAbility.Images]
      .map(t => [...texts(".nol-teamrun-ability-answer", row(t)), ...texts(".nol-teamrun-ability-description > span", row(t))])).toEqual([
      ["Works", "Through ACP"],
      ["Works", "Outside ACP, through the provider's own tools"],
      ["Can't", "Cursor's fork answers that it has no such method."],
      ["Can't", "Cursor has no compact command. Ask it to summarize?"],
      ["Not built yet", "Cursor offers fast and normal."],
      ["Not built yet"],
      ["Not checked yet", "Image blocks are read; never seen one."]
    ]);
    expect(row(ProviderAbility.PlanMode).querySelector(".nol-teamrun-ability-description")).toBeNull();
    expect(element().querySelector(".nol-teamrun-ability a")).toBeNull();
  });

  const choosePi = async (): Promise<void> => {
    const select = element().querySelector<HTMLElement>("nol-select.nol-teamrun-abilities-kind .nol-select-button");
    if (Object.isNull(select))
      throw new Error("The provider picker has no button.");
    await userEvent.click(select);
    const option = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === "Pi");
    if (Object.isUndefined(option))
      throw new Error("The picker lists no Pi.");
    await userEvent.click(option);
  };

  afterEach(() => {
    AbilitySettingsRows.release(context);
  });

  it("shows another provider's answers once the person chooses it", async () => {
    await create([cursor, pi]);
    await Wait.until(() => expect(texts(".nol-teamrun-ability-answer", row(ProviderAbility.Fork))).toEqual(["Can't"]));

    await choosePi();

    await Wait.until(() => expect(texts(".nol-teamrun-ability-answer", row(ProviderAbility.Fork))).toEqual(["Works"]));
    expect(texts(".nol-teamrun-ability-description > span", row(ProviderAbility.Fork))).toEqual(["Through the provider's addition to ACP"]);
  });

  it("marks each row with its search id, gives Settings search the provider the person chooses, and opens again on it", async () => {
    await create([cursor, pi], true);
    await Wait.until(() => expect(texts(".nol-teamrun-ability-answer", row(ProviderAbility.Fork))).toEqual(["Can't"]));
    const forkDescription = (): string | null | undefined => context.settingsRows.get(Resources.abilitiesPageName)?.find(t => t.id === "teamrun.providers.fork")?.description;

    expect([row(ProviderAbility.RunTurn).dataset["setting"], row(ProviderAbility.Fork).dataset["setting"], forkDescription()])
      .toEqual(["teamrun.providers.runTurn", "teamrun.providers.fork", "Chats: Can't"]);
    await choosePi();
    await Wait.until(() => expect(forkDescription()).toBe("Chats: Works"));
    fixture.destroy();
    fixture = TestBed.createComponent(AbilitiesPageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();

    await Wait.until(() => expect(texts(".nol-teamrun-ability-answer", row(ProviderAbility.Fork))).toEqual(["Works"]));
    expect(texts("nol-select.nol-teamrun-abilities-kind .nol-select-button")[0]).toContain("Pi");
  });

  it("says it hasn't read the providers while no kind with a table has come", async () => {
    await create([untabled]);

    await Wait.until(() => expect(texts("[role='status']")).toEqual(["TeamRun hasn't read its providers yet."]));
    expect(element().querySelectorAll(".nol-teamrun-ability")).toHaveLength(0);
  });

  it("says when the provider types failed to load, with Retry at the end of the provider row, and shows the abilities once a retry reads them, reading once for a second click", async () => {
    await create(null);

    await Wait.until(() => expect(texts(".nol-teamrun-kinds-failed .nol-teamrun-error-text")).toEqual([Resources.kindsUnavailableForAbilities]));
    expect(element().querySelectorAll("[role='alert']")).toHaveLength(1);
    expect(element().querySelector("[role='status']")).toBeNull();
    expect(element().querySelectorAll(".nol-teamrun-ability")).toHaveLength(0);
    const control = Required.of(element().querySelector(".nol-teamrun-abilities-provider .nol-setting-row-control")).getBoundingClientRect();
    const message = Required.of(element().querySelector(".nol-teamrun-kinds-failed .nol-teamrun-error-text")).getBoundingClientRect();
    const retry = Required.of(element().querySelector<HTMLElement>(".nol-teamrun-retry-kinds"));
    const button = retry.getBoundingClientRect();
    expect(texts(".nol-teamrun-retry-kinds")).toEqual([Resources.retryLabel]);
    expect(Math.abs(button.right - control.right)).toBeLessThanOrEqual(0.5);
    expect(message.left).toBeGreaterThanOrEqual(control.left - 0.5);
    expect(message.right).toBeLessThanOrEqual(button.left + 0.5);

    listed = [cursor, pi];
    const before = reads;
    retry.click();
    retry.click();
    await Wait.until(() => expect(element().querySelectorAll(".nol-teamrun-ability")).toHaveLength(Object.values(ProviderAbility).length));
    expect(reads).toBe(before + 1);
    expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
    expect(texts("nol-select.nol-teamrun-abilities-kind .nol-select-button")[0]).toContain("Cursor");
  });
});
