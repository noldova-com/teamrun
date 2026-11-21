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
  AuthStatus, ChatFolderAttachParams, ConversationMember, DefaultTeammate, EventName, Harness, Message, MessageAuthor, MessageStatus, MethodName, ObservedSettings, PlanUsage, PlanWindow,
  PlanWindowName, Provenance, Provider, ProviderKind, ProviderModel, ProviderProfile, RequestedSettings, Teammate
} from "@noldova/teamrun.protocol";
import { DefaultTheme, ThemeMode, TooltipDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ConversationMembersComponent } from "../../../../src/app/components/conversation-members/conversation-members.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ComposerDefaultService } from "../../../../src/app/services/composer-default.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PointerEventsFixture } from "../../../fixtures/pointer-events.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ConversationMembersComponent", () => {
  let context: FakeWindowPartContext;
  let data: TeammateFixture;
  let fixture: ComponentFixture<ConversationMembersComponent>;
  let store: ChatStoreService;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const avatars = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("nol-avatar")];
  const member = (name: string): HTMLButtonElement => {
    const found = element().querySelector<HTMLButtonElement>(`.nol-teamrun-member[aria-label="${name}"]`);
    if (Object.isNull(found))
      throw new Error(`No member shows ${name}.`);
    return found;
  };
  const addButton = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>(".nol-teamrun-add-member") as HTMLButtonElement;
  const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const labelOf = (row: Element): string | undefined => row.querySelector(".nol-menu-item-label")?.textContent?.trim();
  const leadOf = (row: Element): HTMLElement => row.querySelector<HTMLElement>(".nol-menu-item-lead nol-avatar") as HTMLElement;
  const menuItem = (label: string): HTMLButtonElement => {
    const found = menuItems().find(t => labelOf(t) === label);
    if (Object.isUndefined(found))
      throw new Error(`No menu item reads ${label}.`);
    return found;
  };
  const off = new Provider("a2", "codex", "Off", "D:\profiles\off", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, false);
  const onDisabledProvider = (context: FakeWindowPartContext): void => {
    context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), off.toJson()]);
    data.teammates.push(new Teammate("carol", "Carol", null, "a2", Harness.Provider, null, null, "t", "t"),
      new Teammate("dave", "Dave", null, "a2", Harness.Provider, null, null, "t", "t"));
    data.members.push(new ConversationMember(SampleData.conversation.id, "carol", "t", null, false));
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    localStorage.removeItem(Resources.composerChoicesStorageKey);
    context = SampleData.createContext();
    data = new TeammateFixture(context);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    fixture = TestBed.createComponent(ConversationMembersComponent);
    fixture.componentRef.setInput("conversationId", SampleData.conversation.id);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.selectConversation(SampleData.conversation.id);
    await settle();
  };

  let park: HTMLElement | null = null;
  const parkPointerAsync = async (): Promise<void> => {
    park = await AppearanceFixture.parkPointerAsync();
  };

  afterEach(async () => {
    park?.remove();
    park = null;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await fixture?.whenStable();
    ChatStoreService.release(context);
    ComposerDefaultService.release(context);
  });

  it("shows the default teammate's avatar, then each member's, named with its provider, model and effort, then Add", async () => {
    await create(() => data.members.push(new ConversationMember(SampleData.conversation.id, "offline", "t", null, false)));

    expect(element().getAttribute("role")).toBe("group");
    expect(element().getAttribute("aria-label")).toBe(Resources.conversationMembersLabel);
    expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "A", "O"]);
    expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}`);
    expect(member("Alice").contains(avatars()[1]!)).toBe(true);
    expect(member("Offline").contains(avatars()[2]!)).toBe(true);
    expect(addButton().getAttribute("aria-label")).toBe(Resources.addMemberLabel);
    expect(element().lastElementChild).toBe(addButton());
  });

  it("sorts the members and Add's menu by name, ignoring case with an accented name beside its letter", async () => {
    await create(() => {
      data.teammates = ["zoe", "edgar", "Émile", "bob", "Élise", "Alice", "dora"].map(t => new Teammate(t, t, null, "a1", Harness.Provider, null, null, "t", "t"));
      data.members = ["zoe", "Émile", "bob", "Alice"].map(t => new ConversationMember(SampleData.conversation.id, t, "t", null, false));
    });

    expect([...element().querySelectorAll(".nol-teamrun-member")].map(t => t.getAttribute("aria-label"))).toEqual(["Alice", "bob", "Émile", "zoe"]);
    addButton().click();
    await settle();
    expect(menuItems().map(labelOf)).toEqual(["dora", "edgar", "Élise"]);
  });

  it("shows the initials of a spaced name's first two words on its member's avatar", async () => {
    await create(() => {
      data.teammates.push(data.reviewer);
      data.members.push(new ConversationMember(SampleData.conversation.id, "reviewer", "t", null, false));
    });

    expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "A", "CR"]);
    expect(member("Code Reviewer").contains(avatars()[2]!)).toBe(true);
  });

  it("shows each avatar's name, provider, model and effort in its tooltip, and says when a member is unavailable", async () => {
    await parkPointerAsync();
    await create(() => data.members.push(new ConversationMember(SampleData.conversation.id, "offline", "t", null, false)));
    const tooltipOf = async (target: Element): Promise<string | null> => {
      PointerEventsFixture.enter(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      PointerEventsFixture.leave(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(await tooltipOf(avatars()[0]!)).toBe(`${Resources.defaultTeammateLabel} · Codex · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}`);
    expect(await tooltipOf(member("Alice"))).toBe("Alice · Codex · Work · gpt-5 · High");
    expect(await tooltipOf(member("Offline"))).toBe(
      `Offline · ${Resources.unavailableTeammateLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort} · ${Resources.unavailableTeammateLabel}`);
    expect(await tooltipOf(addButton())).toBe(Resources.addMemberLabel);
  });

  it("says in a member's tooltip that its provider is used up, and stops once Core lets it go", async () => {
    await parkPointerAsync();
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 100, null)];
    await create(t => t.answer(MethodName.PlanUsageList, () => [new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z", null, true).toJson()]));

    await Wait.until(() => expect(member("Alice").getAttribute("aria-label")).toBe("Alice"));
    PointerEventsFixture.enter(member("Alice"));
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe(`Alice · Codex · Work · gpt-5 · High · ${Resources.usedUpLabel}`));
    PointerEventsFixture.leave(member("Alice"));
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
    context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z").toJson());
    await fixture.whenStable();
    PointerEventsFixture.enter(member("Alice"));

    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe("Alice · Codex · Work · gpt-5 · High"));
    PointerEventsFixture.leave(member("Alice"));
  });

  it("names the default teammate with the chosen default's settings while the chat has no choice of its own", async () => {
    await create(t => t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a1").toJson()));

    expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · Work · gpt-5 · High`);
  });

  it("names the default teammate with the last sent choice the runtime keeps while no default teammate is set", async () => {
    await create(t => t.answer(MethodName.ComposerDefaultRead, () => ({ kind: "codex", model: "gpt-5-mini", effort: "low", providerId: "a1" })));

    await Wait.until(() => expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · Work · gpt-5-mini · Low`));
  });

  it("names the default teammate's effort and each member's as the provider's model list does", async () => {
    await parkPointerAsync();
    await create(t => {
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([
        new ProviderModel("gpt-5", "gpt-5", "Fixture", ["high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" })]));
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "xhigh"), "a1").toJson());
      data.teammates.push(new Teammate("erin", "Erin", null, "a1", Harness.Provider, "gpt-5", "xhigh", "t", "t"));
      data.members.push(new ConversationMember(SampleData.conversation.id, "erin", "t", null, false));
    });
    PointerEventsFixture.enter(member("Erin"));

    await Wait.until(() => expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · Work · gpt-5 · Extra high`));
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe("Erin · Codex · Work · gpt-5 · Extra high"));
    PointerEventsFixture.leave(member("Erin"));
  });

  it("names a thread's model and effort only in its own responder's avatar, as the composer's rows do, and the configuration's in the others, for a kind that follows its own configuration", async () => {
    await parkPointerAsync();
    const reply = (id: string, sequence: number, effort: string, teammateId: string | null): Message => new Message(id, SampleData.conversation.id, sequence,
      MessageAuthor.Provider, "m1", MessageStatus.Completed, [], new Provenance("a1", new RequestedSettings("codex", null, null),
        new ObservedSettings("codex", "gpt-other", effort, null), "s1", false), SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], teammateId,
      Object.isNull(teammateId) ? null : "Bob");
    await create(t => {
      t.answer(MethodName.ProviderKindList, () => [new ProviderKind("codex", "Codex", true, true, null, null, false, null, false, null, true, null,
        SampleData.abilities()).toJson()]);
      t.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-config", "Config", "", ["high", "low"], true, null, true, "low"),
        new ProviderModel("gpt-other", "Other", "", ["high", "low"], false, null, true, "high")]));
      t.answer(MethodName.MessagePage, () => SampleData.page([reply("r1", 1, "high", "bob")], false, false).toJson());
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", null, null), "a1").toJson());
      data.teammates.push(new Teammate("carol", "Carol", null, "a1", Harness.Provider, null, null, "t", "t"));
      data.members.push(new ConversationMember(SampleData.conversation.id, "bob", "t", null, false), new ConversationMember(SampleData.conversation.id, "carol", "t", null, false));
    });
    const line = (name: string, model: string, effort: string): string => [name, "Codex", "Work", model, effort].join(Resources.titleSeparator);
    const tooltipOf = async (target: Element): Promise<string | null> => {
      PointerEventsFixture.enter(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      PointerEventsFixture.leave(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    await Wait.until(() => expect(avatars()[0]?.getAttribute("aria-label")).toBe(line(Resources.defaultTeammateLabel, Resources.providerDefaultModel, "Low")));
    expect(await tooltipOf(member("Bob"))).toBe(line("Bob", "Other", "High"));
    expect(await tooltipOf(member("Carol"))).toBe(line("Carol", Resources.providerDefaultModel, "Low"));

    context.emit(EventName.MessageCreated, reply("r2", 2, "low", null).toJson());
    await Wait.until(() => expect(avatars()[0]?.getAttribute("aria-label")).toBe(line(Resources.defaultTeammateLabel, "Other", "Low")));
    expect(await tooltipOf(member("Bob"))).toBe(line("Bob", "Other", "High"));
    expect(await tooltipOf(member("Carol"))).toBe(line("Carol", Resources.providerDefaultModel, "Low"));
  });

  it("names the thread of its kind's usual provider in the default teammate's avatar while the default names no provider, as the composer's Default row does", async () => {
    await create(t => {
      t.answer(MethodName.ProviderKindList, () => [new ProviderKind("codex", "Codex", true, true, null, new ProviderProfile("CODEX_HOME", null, SampleData.provider.profileDir),
        false, null, false, null, true, null,
        SampleData.abilities()).toJson()]);
      t.answer(MethodName.MessagePage, () => SampleData.page([new Message("r1", SampleData.conversation.id, 1, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
        new Provenance("a1", new RequestedSettings("codex", null, null), new ObservedSettings("codex", "gpt-other", "low", null), "s1", false), SampleData.timestamp,
        SampleData.timestamp, SampleData.timestamp)], false, false).toJson());
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", null, null)).toJson());
    });

    await Wait.until(() => expect(avatars()[0]?.getAttribute("aria-label")).toBe([Resources.defaultTeammateLabel, "Codex", "gpt-other", "Low"].join(Resources.titleSeparator)));
  });

  it("names the default teammate after TeamRun when no provider is known", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => []));

    expect(avatars()[0]?.getAttribute("aria-label"))
      .toBe(`${Resources.defaultTeammateLabel} · ${Resources.teamRunLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}`);
  });

  it("names the default model as the provider does, for the default teammate and each member", async () => {
    await parkPointerAsync();
    await create(t => {
      t.answer(MethodName.ProviderKindList, () => [new ProviderKind("codex", "Codex", true, false, "Auto").toJson()]);
      data.members.push(new ConversationMember(SampleData.conversation.id, "bob", "t", null, false));
      data.members.push(new ConversationMember(SampleData.conversation.id, "offline", "t", null, false));
    });
    const tooltipOf = async (target: Element): Promise<string | null> => {
      PointerEventsFixture.enter(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      PointerEventsFixture.leave(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · Auto · ${Resources.modelDefaultEffort}`);
    expect(await tooltipOf(member("Bob"))).toBe(`Bob · Codex · Work · Auto · ${Resources.modelDefaultEffort}`);
    expect(await tooltipOf(member("Alice"))).toBe("Alice · Codex · Work · gpt-5 · High");
    expect(await tooltipOf(member("Offline"))).toBe(
      `Offline · ${Resources.unavailableTeammateLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort} · ${Resources.unavailableTeammateLabel}`);
  });

  it("names each member's provider and the default teammate's, so two providers of one kind read apart", async () => {
    await parkPointerAsync();
    const personal = new Provider("a3", "codex", "Personal", "D:/personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    await create(t => {
      t.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), personal.toJson()]);
      t.answer(MethodName.DefaultTeammateRead, () => new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a3").toJson());
      data.teammates.push(new Teammate("pam", "Pam", null, "a3", Harness.Provider, "gpt-5", "high", "t", "t"));
      data.members.push(new ConversationMember(SampleData.conversation.id, "pam", "t", null, false));
    });
    const tooltipOf = async (target: Element): Promise<string | null> => {
      PointerEventsFixture.enter(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      PointerEventsFixture.leave(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(avatars()[0]?.getAttribute("aria-label")).toBe(`${Resources.defaultTeammateLabel} · Codex · Personal · gpt-5 · High`);
    expect(await tooltipOf(member("Alice"))).toBe("Alice · Codex · Work · gpt-5 · High");
    expect(await tooltipOf(member("Pam"))).toBe("Pam · Codex · Personal · gpt-5 · High");
  });

  it("shows an unavailable teammate in Add's menu as the responder menu does, with its avatar dimmed and its name marked unavailable, and dims its member avatar", async () => {
    await create();

    addButton().click();
    await settle();
    const offered = ["Bob", Resources.formatUnavailable("Offline")].map(t => menuItem(t))
      .map(t => [getComputedStyle(t).opacity, leadOf(t).classList.contains("nol-avatar-unavailable")]);
    menuItem(Resources.formatUnavailable("Offline")).click();
    await Wait.until(() => expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "A", "O"]));

    expect(offered).toEqual([["1", false], ["1", true]]);
    expect(avatars().map(t => t.classList.contains("nol-avatar-unavailable"))).toEqual([false, false, true]);
  });

  it("greys a teammate on a disabled provider and says so after its name, on its member avatar, in its tooltip and in Add's menu", async () => {
    await create(onDisabledProvider);
    const carol = member("Carol (provider disabled)");
    await userEvent.hover(carol);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
    const tooltip = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim();
    await userEvent.unhover(carol);

    expect(tooltip).toBe(`Carol · Codex · Off · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort} · ${Resources.providerDisabledLabel}`);
    expect(avatars().map(t => [t.textContent?.trim(), t.classList.contains("nol-avatar-unavailable")])).toEqual([["D", false], ["A", false], ["C", true]]);
    expect(carol.contains(avatars()[2]!)).toBe(true);
    addButton().click();
    await settle();
    expect(menuItems().map(labelOf)).toEqual(["Bob", "Dave (provider disabled)", Resources.formatUnavailable("Offline")]);
    expect(["Bob", "Dave (provider disabled)"].map(t => menuItem(t)).map(t => [getComputedStyle(t).opacity, leadOf(t).classList.contains("nol-avatar-unavailable")]))
      .toEqual([["1", false], ["1", true]]);
  });

  it("starts each of Add's rows with its teammate's avatar, with the initials and colours its member avatar shows once added", async () => {
    await create(() => data.teammates.push(data.reviewer));

    addButton().click();
    await settle();
    const rows = menuItems();
    const offered = rows.map(t => [labelOf(t), leadOf(t).textContent?.trim(), leadOf(t).getAttribute("aria-hidden"), getComputedStyle(leadOf(t)).opacity]);
    const colours = rows.map(t => getComputedStyle(leadOf(t))).map(t => [t.backgroundColor, t.color]);
    menuItem("Code Reviewer").click();
    await Wait.until(() => expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "A", "CR"]));
    const added = getComputedStyle(avatars()[2]!);

    expect(offered).toEqual([["Bob", "B", "true", "1"], ["Code Reviewer", "CR", "true", "1"], [Resources.formatUnavailable("Offline"), "O", "true", "0.5"]]);
    expect(colours[1]).toEqual([added.backgroundColor, added.color]);
  });

  it("adds a teammate from Add's menu of the others, and removes a member from its own menu", async () => {
    await create();
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());

    addButton().click();
    await settle();
    const offered = menuItems().map(labelOf);
    menuItem("Bob").click();
    await Wait.until(() => expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "A", "B"]));
    member("Alice").click();
    await settle();
    const memberActions = menuItems().map(labelOf);
    menuItem(Resources.removeMemberLabel).click();
    await Wait.until(() => expect(avatars().map(t => t.textContent?.trim())).toEqual(["D", "B"]));

    expect(offered).toEqual(["Bob", Resources.formatUnavailable("Offline")]);
    expect(memberActions).toEqual([Resources.removeMemberLabel]);
    expect(data.members.map(t => t.teammateId)).toEqual(["bob"]);
  });

  it("keeps a member's Remove disabled while a reply works in the conversation", async () => {
    await create();

    member("Alice").click();
    await settle();
    menuItem(Resources.removeMemberLabel).click();
    await settle();

    expect(store.isWorking(SampleData.conversation.id)).toBe(true);
    expect(menuItem(Resources.removeMemberLabel).getAttribute("aria-disabled")).toBe("true");
    expect(data.members.map(t => t.teammateId)).toEqual(["alice"]);
  });

  it("offers no teammate to add when every teammate is a member already", async () => {
    await create(() => data.members.push(...["bob", "offline"].map(t => new ConversationMember(SampleData.conversation.id, t, "t", null, false))));

    addButton().click();
    await settle();

    expect(menuItems().map(t => [labelOf(t), t.getAttribute("aria-disabled"), t.querySelector("nol-avatar")])).toEqual([[Resources.noTeammatesToAdd, "true", null]]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (target: Element): DOMRect => target.getBoundingClientRect();

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sizes and places a disabled provider's member avatar as the others, and fits its Add row's name and suffix on one line inside the row", async () => {
      await create(onDisabledProvider);
      const [, alice, carol] = avatars().map(box);

      AppearanceFixture.expectPixels(carol!.width, AppearanceFixture.measureLook("avatar-small"));
      AppearanceFixture.expectPixels(carol!.top, alice!.top);
      AppearanceFixture.expectPixels(carol!.left - alice!.right, AppearanceFixture.measureLook("space-2"));
      addButton().click();
      await settle();
      const row = menuItem("Dave (provider disabled)");
      const label = row.querySelector<HTMLElement>(".nol-menu-item-label")!;
      const bob = menuItem("Bob").querySelector<HTMLElement>(".nol-menu-item-label")!;

      AppearanceFixture.expectPixels(box(label).left, box(bob).left);
      AppearanceFixture.expectPixels(box(label).height, box(bob).height);
      expect(box(label).right).toBeLessThanOrEqual(box(row).right);
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
      expect([getComputedStyle(row).opacity, getComputedStyle(leadOf(row)).opacity]).toEqual(["1", "0.5"]);
      const offline = menuItem(Resources.formatUnavailable("Offline")).querySelector<HTMLElement>(".nol-menu-item-label")!;
      AppearanceFixture.expectPixels(box(offline).height, box(bob).height);
      expect(offline.scrollWidth).toBeLessThanOrEqual(offline.clientWidth);
    });

    it("names an attached folder at its end, a rem inside it and centred, with the folder's path in its tooltip, cutting a long name inside the row, and drops it on a detach", async () => {
      const long = `/home/ada/${"a-very-long-folder-name-".repeat(8)}end`;
      await create(t => t.answer(MethodName.ChatFolderAttach, u => SampleData.conversation.withAttachedFolder(ChatFolderAttachParams.fromJson(u).folder, SampleData.timestamp).toJson())
        .answer(MethodName.ChatFolderDetach, () => SampleData.conversation.toJson()));
      const note = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-teamrun-attached-folder");
      const shown = (): HTMLElement => {
        const found = note();
        if (Object.isNull(found))
          throw new Error("No attached folder is shown.");
        return found;
      };
      const before = note();
      await store.attachFolder(SampleData.conversation.id, "/work/site");
      await settle();
      const row = box(element());
      const folder = box(shown());
      const glyph = box(shown().querySelector(".nol-teamrun-attached-folder-glyph") ?? shown());
      const name = shown().querySelector<HTMLElement>(".nol-teamrun-attached-folder-name");
      const tooltip = fixture.debugElement.query(By.css(".nol-teamrun-attached-folder")).injector.get(TooltipDirective).text();

      expect(before).toBeNull();
      expect([name?.textContent?.trim(), tooltip, shown().getAttribute("role"), shown().getAttribute("aria-label")])
        .toEqual(["site", "/work/site", "note", Resources.formatAttachedFolderNote("/work/site")]);
      AppearanceFixture.expectPixels(row.right - folder.right, AppearanceFixture.measureLook("space-4"));
      AppearanceFixture.expectPixels(folder.top + folder.height / 2, row.top + row.height / 2);
      AppearanceFixture.expectPixels(glyph.top + glyph.height / 2, row.top + row.height / 2);
      expect(folder.left - box(addButton()).right).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("space-2") - 0.5);
      await store.attachFolder(SampleData.conversation.id, long);
      await settle();
      const cut = shown().querySelector<HTMLElement>(".nol-teamrun-attached-folder-name");
      expect(box(shown()).right).toBeLessThanOrEqual(box(element()).right - AppearanceFixture.measureLook("space-4") + 0.5);
      expect([(cut?.scrollWidth ?? 0) > (cut?.clientWidth ?? 0), element().scrollWidth <= element().clientWidth]).toEqual([true, true]);
      await store.detachFolder(SampleData.conversation.id);
      await settle();
      expect(note()).toBeNull();
    });

    it("sets its avatars and Add half a rem apart, a rem inside its start, Add half a rem inside its top and bottom, all centred, with no rule under them", async () => {
      await create(() => data.members.push(new ConversationMember(SampleData.conversation.id, "bob", "t", null, false)));
      const [first, second, third] = avatars().map(box);
      const add = box(addButton());
      const row = box(element());
      const style = getComputedStyle(element());

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(first!.left - row.left, AppearanceFixture.measureLook("space-4"));
      AppearanceFixture.expectPixels(add.top - row.top, AppearanceFixture.measureLook("space-2"));
      for (const avatar of [first!, second!, third!]) {
        AppearanceFixture.expectPixels(avatar.width, AppearanceFixture.measureLook("avatar-small"));
        AppearanceFixture.expectPixels(avatar.height, AppearanceFixture.measureLook("avatar-small"));
        AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, row.top + row.height / 2);
      }
      AppearanceFixture.expectPixels(second!.left - first!.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(third!.left - second!.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(add.left - third!.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(add.width, AppearanceFixture.measureLook("icon-button"));
      AppearanceFixture.expectPixels(add.top + add.height / 2, row.top + row.height / 2);
      AppearanceFixture.expectPixels(row.bottom - add.bottom, AppearanceFixture.measureLook("space-2"));
      expect(style.borderBottomWidth).toBe("0px");
      expect(style.borderBottomStyle).toBe("none");
    });

    it("scrolls its members from its top to its bottom edge, so their scrollbar sits on the row's bottom, with the avatars still centred", async () => {
      await create(() => data.members.push(new ConversationMember(SampleData.conversation.id, "bob", "t", null, false)));
      const scroller = element().querySelector<HTMLElement>(".nol-teamrun-members")!;
      const row = box(element());
      const members = box(scroller);

      expect(getComputedStyle(scroller).overflowX).toBe("auto");
      AppearanceFixture.expectPixels(members.top, row.top);
      AppearanceFixture.expectPixels(members.bottom, row.bottom);
      for (const avatar of avatars().map(box))
        AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, row.top + row.height / 2);
    });
  });

  describe.each([
    { geometry: "the default theme's", theme: DefaultTheme.theme },
    { geometry: "the fixture theme's", theme: FixtureTheme.theme }
  ])("with $geometry geometry", ({ theme }) => {
    beforeEach(() => AppearanceFixture.apply(theme, ThemeMode.Light));

    afterEach(() => AppearanceFixture.reset());

    it("sizes each avatar in Add's menu as the members' avatars, centres it on its row, and starts its name a menu padding after it", async () => {
      await create();

      addButton().click();
      await settle();
      const rows = menuItems();

      expect(rows.map(labelOf)).toEqual(["Bob", Resources.formatUnavailable("Offline")]);
      for (const row of rows) {
        const avatar = leadOf(row).getBoundingClientRect();
        const box = row.getBoundingClientRect();
        const label = (row.querySelector(".nol-menu-item-label") as HTMLElement).getBoundingClientRect();
        AppearanceFixture.expectPixels(avatar.width, AppearanceFixture.measureLook("avatar-small"));
        AppearanceFixture.expectPixels(avatar.height, AppearanceFixture.measureLook("avatar-small"));
        AppearanceFixture.expectPixels(avatar.top + avatar.height / 2, box.top + box.height / 2);
        AppearanceFixture.expectPixels(avatar.left - box.left, AppearanceFixture.measureLook("menu-item-inset") + AppearanceFixture.measureLook("menu-item-padding"));
        AppearanceFixture.expectPixels(label.left - avatar.right, AppearanceFixture.measureLook("menu-item-padding"));
        AppearanceFixture.expectPixels(label.top + label.height / 2, box.top + box.height / 2);
      }
    });

    for (const mode of [ThemeMode.Light, ThemeMode.Dark])
      it(`keeps a quarter rem of its row above and below each avatar in Add's menu, so neighbouring avatars stand apart, in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await create(() => data.teammates.push(data.reviewer));
        const space = AppearanceFixture.measureLook("space-1");

        addButton().click();
        await settle();
        const rows = menuItems();
        const avatars = rows.map(t => leadOf(t).getBoundingClientRect());

        expect(rows.map(labelOf)).toEqual(["Bob", "Code Reviewer", Resources.formatUnavailable("Offline")]);
        for (const [index, row] of rows.entries()) {
          const box = row.getBoundingClientRect();
          expect(avatars[index]!.top - box.top).toBeGreaterThanOrEqual(space - 0.5);
          expect(box.bottom - avatars[index]!.bottom).toBeGreaterThanOrEqual(space - 0.5);
        }
        for (const [index, avatar] of avatars.slice(1).entries())
          expect(avatar.top - avatars[index]!.bottom).toBeGreaterThanOrEqual(space * 2 - 0.5);
      });
  });

  describe("under forced colours and at 200% zoom", () => {
    const withMembers = async (): Promise<void> => {
      await create(onDisabledProvider);
      await Wait.until(() => expect(avatars().length).toBeGreaterThan(2));
    };
    const openMenu = async (): Promise<HTMLElement> => {
      addButton().click();
      await settle();
      return await Wait.until(() => {
        const menu = document.querySelector<HTMLElement>("nol-menu");
        if (Object.isNull(menu))
          throw new Error("Add's menu isn't open.");
        return menu;
      });
    };

    it("keeps every member, Add and Add's menu visible under forced colours, with their states and focus rings", async () => {
      await withMembers();
      expect(await AccessibilityFixture.expectVisibleForcedAsync(element())).toBeGreaterThan(0);
      await AccessibilityFixture.expectVisibleForcedAsync(await openMenu());
    });

    it("neither cuts, crosses nor loses a member, Add or Add's menu at 200% zoom", async () => {
      await withMembers();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
      await AccessibilityFixture.zoomedAsync(async () => AccessibilityFixture.expectFitsZoomedAsync(await openMenu(), settle));
    });
  });
});
