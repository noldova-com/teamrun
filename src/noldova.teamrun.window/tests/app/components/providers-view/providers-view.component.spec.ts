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
  AbilityCell,
  AcpAgentEntry,
  AcpAgentListing,
  AuthStatus,
  Conversation,
  ConversationCreateParams,
  DiscoveredProfile,
  EventName,
  FirstLaunch,
  Harness,
  MethodName,
  PlanUsage,
  PlanUsageParams,
  PlanWindow,
  PlanWindowName,
  Provider,
  ProviderAbility,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  ProviderIdentity,
  ProviderSignIns,
  ProviderUpdateParams,
  ProviderKind,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderKindParams,
  ProviderProfile,
  ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  ProviderSignInCommand,
  ProviderTool,
  Resources as ProtocolResources,
  SignInLinkPayload,
  Teammate
} from "@noldova/teamrun.protocol";
import { EmbeddedTerminal, TerminalEnd } from "@noldova/terminal.window";
import { AnnouncementPoliteness, Announcer, ClipboardWriter, DefaultTheme, LinkGesture, type SelectComponent, SelectOption, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, type ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { type Locator, page, userEvent } from "vitest/browser";

import { ProviderTerminalComponent } from "../../../../src/app/components/provider-terminal/provider-terminal.component";
import { ProvidersViewComponent } from "../../../../src/app/components/providers-view/providers-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeEmbeddedTerminals } from "../../../fixtures/fake-embedded-terminals.fixture";
import { FakeTerminalLauncher } from "../../../fixtures/fake-terminal-launcher.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ProvidersViewComponent", () => {
  const home = new Provider("a2", "grok", "Home", "D:\\profiles\\grok", AuthStatus.Error, new ProviderIdentity("person@example.com"),
    null, SampleData.timestamp, "grok was not found", SampleData.timestamp);
  const grok = new ProviderKind("grok", "Grok CLI", true, true);
  const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
  const spaceProvider = new Provider("a4", "antigravity", "Space", "D:\\profiles\\antigravity", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);
  const retired = new Provider("a5", "gemini", "Old", "D:\\profiles\\gemini", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login"));
  const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, null, new ProviderProfile("COPILOT_HOME", "copilot login", null, "copilot"));
  const desk = new Provider("a6", "claude", "Desk", "D:\\profiles\\claude", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp);
  const pilot = new Provider("a7", "copilot", "Pilot", "D:\\profiles\\copilot", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);
  const octo = new Provider("a8", "copilot", "Octo", "D:\\profiles\\octo", AuthStatus.LoggedIn, new ProviderIdentity(undefined, undefined, undefined, "user", "octo"),
    null, SampleData.timestamp, null, SampleData.timestamp);
  const withTerminalKinds = (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    providers.push(desk, pilot);
    return create(t => configure(t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson(), copilot.toJson(), grok.toJson()])));
  };
  const leavingGrok = new ProviderKind("grok", "Grok CLI", true, true, null, null, true);
  const leavingAntigravity = new ProviderKind("antigravity", "Antigravity", true, true, null, null, true);
  const ownLogout = (kind: ProviderKind): ProviderKind => new ProviderKind(kind.id, kind.displayName, true, kind.supportsSignIn, null, kind.profile, false,
    "/logout");
  const signedIn = (id: string, kind: string, label: string): Provider => new Provider(id, kind, label, `D:\\profiles\\${kind}-${id}`, AuthStatus.LoggedIn, null, "1.0",
    SampleData.timestamp, null, SampleData.timestamp);
  const withSignOut = (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    providers.push(signedIn("a8", "grok", "Lounge"), signedIn("a9", "copilot", "Wing"), signedIn("a10", "antigravity", "Orbit"));
    return create(t => configure(t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), leavingGrok.toJson(), ownLogout(copilot).toJson(),
      leavingAntigravity.toJson()]).answer(MethodName.ProviderSignOut, u => {
      const id = ProviderIdParams.fromJson(u).providerId;
      providers = providers.map(v => v.id === id ? v.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null) : v);
      return providers.find(v => v.id === id)?.toJson() ?? null;
    })));
  };
  const subscribed = (id: string, kind: string, label: string, identity: ProviderIdentity): Provider =>
    new Provider(id, kind, label, `/profiles/${id}`, AuthStatus.LoggedIn, identity, "1.0", SampleData.timestamp, null, SampleData.timestamp);
  const withSubscriptions = (): Promise<void> => {
    providers.push(octo, subscribed("b1", "claude", "Max", new ProviderIdentity("dev@example.com", "max", "Acme")),
      subscribed("b2", "codex", "Business", new ProviderIdentity("dev@example.com", "self_serve_business_usage_based")),
      subscribed("b3", "grok", "Heavy", new ProviderIdentity("person@example.com", "SuperGrok Heavy", "Lab")),
      subscribed("b4", "grok", "Team", new ProviderIdentity(undefined, undefined, "Acme")),
      subscribed("b5", "codex", "Teams", new ProviderIdentity("dev@example.com", "team", "Acme")),
      subscribed("b6", "codex", "School", new ProviderIdentity("dev@example.com", "edu_plus")),
      subscribed("b7", "grok", "Coded", new ProviderIdentity("person@example.com", "basic")),
      subscribed("b8", "claude", "Blank", new ProviderIdentity("dev@example.com", " ", "")),
      subscribed("b9", "codex", "Unnamed", new ProviderIdentity("dev@example.com", "", "Acme")));
    return withTerminalKinds();
  };
  const teammate = (id: string, name: string, providerId: string): Teammate => new Teammate(id, name, null, providerId, Harness.Provider, null, null, "t", "t");
  const installation = (state: ProviderKindInstallState, reason: string | null = null, received: number = 0, total: number = 0): ProviderKindInstallation =>
    new ProviderKindInstallation("antigravity", state, reason, received, total);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ProvidersViewComponent>;
  let store: ChatStoreService;
  let providers: Provider[];
  let terminals: FakeTerminalLauncher;
  let embedded: FakeEmbeddedTerminals;
  let opened: HTMLElement | null = null;
  const plan = (percent: number, readAt: string = "2026-10-22T09:00:00.000Z"): PlanUsage =>
    new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.Weekly, 20, null), new PlanWindow(PlanWindowName.FiveHour, percent, null)], readAt);
  const withPlan = (percent: number): Promise<void> => create(t => t.answer(MethodName.PlanUsageRead, () => plan(percent).toJson()));

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const row = (label: string): HTMLElement => {
    const found = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-item")].find(t => t.querySelector(".nol-teamrun-item-name")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row shows ${label}.`);
    return found;
  };
  const statusOf = (label: string): string | null => row(label).querySelector(".nol-teamrun-status-dot")?.getAttribute("aria-label") ?? null;
  const accountOf = (label: string): string => row(label).querySelector(".nol-teamrun-account")?.textContent?.trim() ?? "";
  const installLines = (): string[] => texts(".nol-teamrun-your-providers .nol-teamrun-install-line .nol-teamrun-install-text");
  const headOf = (kind: string): HTMLElement => {
    const found = element().querySelector<HTMLElement>(`.nol-teamrun-your-providers .nol-teamrun-group-head[data-kind="${kind}"]`);
    if (Object.isNull(found))
      throw new Error(`No heading shows ${kind}.`);
    return found;
  };
  const headNote = (kind: string): string[] => texts(".nol-teamrun-group-note", headOf(kind));
  const headActions = (kind: string): string[] => texts(".nol-teamrun-group-actions button", headOf(kind));
  const kindOf = (label: string): string | null => row(label).closest(".nol-teamrun-provider-list")?.getAttribute("aria-label") ?? null;
  const headings = (section: string): string[] => [...element().querySelectorAll(`${section} .nol-teamrun-group-heading`)]
    .map(t => `${t.querySelector(".nol-teamrun-group-name")?.textContent ?? ""} ${t.querySelector(".nol-teamrun-group-count")?.textContent ?? ""}`);
  const lab = new DiscoveredProfile("codex", "D:\\profiles\\codex-lab", "codex-lab", false, AuthStatus.LoggedIn, new ProviderIdentity("lab@example.com", "plus"));
  const spare = new DiscoveredProfile("grok", "D:\\profiles\\grok-spare", "grok-spare", false, AuthStatus.LoggedOut);
  const foundRow = (profile: DiscoveredProfile): HTMLElement => {
    const found = element().querySelector<HTMLElement>(`.nol-teamrun-found-item[data-profile="${CSS.escape(profile.profileDir)}"]`);
    if (Object.isNull(found))
      throw new Error(`No found row shows ${profile.profileDir}.`);
    return found;
  };
  const button = (selector: string, root: ParentNode = element()): HTMLButtonElement => {
    const found = root.querySelector<HTMLButtonElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const type = (selector: string, text: string): void => {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (Object.isNull(input))
      throw new Error(`Nothing matches ${selector}.`);
    input.value = text;
    input.dispatchEvent(new Event("input"));
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const menu = (): HTMLElement | null => document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu");
  const close = async (): Promise<void> => {
    if (!Object.isNull(menu()) && !Object.isNull(opened) && opened.isConnected)
      button(".nol-teamrun-row-menu", opened).click();
    opened = null;
    await Wait.until(() => expect(menu()).toBeNull());
  };
  const open = async (root: HTMLElement): Promise<HTMLElement> => {
    await close();
    button(".nol-teamrun-row-menu", root).click();
    opened = root;
    await Wait.until(() => expect(menu()).not.toBeNull());
    return menu()!;
  };
  const actions = async (root: HTMLElement): Promise<string[]> => {
    const labels = texts("button[nol-menu-item] .nol-menu-item-label", await open(root));
    await close();
    return labels;
  };
  const item = async (selector: string, root: HTMLElement): Promise<HTMLButtonElement> => button(selector, await open(root));
  const offers = async (selector: string, root: HTMLElement): Promise<boolean> => {
    const found = (await open(root)).querySelector(selector) !== null;
    await close();
    return found;
  };
  const isOff = (target: Element): boolean => target.getAttribute("aria-disabled") === "true";
  const offOf = async (selectors: readonly string[], root: HTMLElement): Promise<boolean[]> => {
    const shown = await open(root);
    const off = selectors.map(t => isOff(button(t, shown)));
    await close();
    return off;
  };
  const choose = async (selector: string, root: HTMLElement): Promise<void> => {
    (await item(selector, root)).click();
    opened = null;
    await settle();
  };
  const startSignIn = async (root: HTMLElement): Promise<void> => {
    button(".nol-teamrun-step-sign-in", root).click();
    await settle();
  };
  const cancelSignIn = async (root: HTMLElement): Promise<void> => {
    button(".nol-teamrun-step-cancel", root).click();
    await settle();
  };
  const offersSignIn = async (root: HTMLElement): Promise<boolean> => root.querySelector(".nol-teamrun-step-sign-in") !== null || await offers(".nol-teamrun-sign-in", root);
  const signInOff = (root: HTMLElement): boolean => button(".nol-teamrun-step-sign-in", root).disabled;
  const createWithInstall = (state: ProviderKindInstallation, configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    providers.push(spaceProvider);
    return create(t => configure(t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => [state.toJson()])));
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, isLoaded: boolean = true): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson(), grok.toJson()])
      .answer(MethodName.ProviderList, () => providers.map(t => t.toJson()))
      .answer(MethodName.ProviderToolList, () => [])
      .answer(MethodName.ProviderCreate, t => {
        const params = ProviderCreateParams.fromJson(t);
        const provider = new Provider(`new-${params.label}`, params.kind, params.label, params.profileDir ?? `D:\\data\\profiles\\${params.kind}\\${params.label}`,
          AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);
        providers.push(provider);
        return provider.toJson();
      })
      .answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        providers = providers.map(u => u.id === id ? u.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null) : u);
        return providers.find(u => u.id === id)?.toJson() ?? null;
      })
      .answer(MethodName.ProviderUpdate, t => {
        const params = ProviderUpdateParams.fromJson(t);
        providers = providers.map(u => u.id === params.providerId
          ? new Provider(u.id, u.kind, params.label, params.profileDir, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp) : u);
        return providers.find(u => u.id === params.providerId)?.toJson() ?? null;
      })
      .answer(MethodName.ProviderSetEnabled, t => {
        const params = ProviderEnabledParams.fromJson(t);
        providers = providers.map(u => u.id === params.providerId ? u.withEnabled(params.enabled) : u);
        return providers.find(u => u.id === params.providerId)?.toJson() ?? null;
      })
      .answer(MethodName.ProviderDelete, t => {
        providers = providers.filter(u => u.id !== ProviderIdParams.fromJson(t).providerId);
        return null;
      });
    configure(context);
    terminals = new FakeTerminalLauncher();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ChatStoreService.terminals, useValue: terminals },
      { provide: ProviderTerminalComponent.opener, useValue: embedded }] });
    fixture = TestBed.createComponent(ProvidersViewComponent);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await settle();
    expect(store.loaded()).toBe(isLoaded);
  };
  let listedKinds: readonly ProviderKind[] | null = null;
  const createWithoutProviders = (): Promise<void> => create(t => t.answer(MethodName.ProviderKindList, () => {
    if (Object.isNull(listedKinds))
      throw new Error("The runtime is restarting.");
    return listedKinds.map(u => u.toJson());
  }), false);

  const announcements = (): [string, AnnouncementPoliteness][] => vi.mocked(Announcer.prototype.announce).mock.calls.map(t => [t[0], t[1]]);
  const announced = (): string[] => announcements().map(t => t[0]);
  const spoken = (text: string): Promise<void> => Wait.until(() => expect(document.querySelector(".cdk-live-announcer-element")?.textContent).toBe(text));
  const liveNote = (text: string): Locator => page.getByText(text, { exact: true });

  beforeEach(() => {
    providers = [SampleData.provider, home];
    embedded = new FakeEmbeddedTerminals();
    listedKinds = null;
    opened = null;
    vi.spyOn(Announcer.prototype, "announce");
  });

  afterEach(async () => {
    await close();
    document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click();
    ChatStoreService.release(context);
    vi.restoreAllMocks();
  });

  it("lists every provider under its kind's heading in Your providers, with no kind beside its name, above Found on this computer and Add provider, in the " +
    "window's own store", async () => {
    await create();

    expect(fixture.debugElement.injector.get(ChatStoreService)).toBe(store);
    expect(texts(".nol-configuration-table-heading")).toEqual(["Providers", "Your providers", "Found on this computer"]);
    expect(texts(".nol-configuration-table-explanation")).toEqual(["TeamRun runs each provider's own tool, signed in to your subscription."]);
    expect(texts(".nol-teamrun-add")).toEqual(["Add provider"]);
    expect(element().querySelector("[role='table']")).toBeNull();
    expect(element().querySelector(".nol-teamrun-your-providers .nol-teamrun-provider-groups")?.getAttribute("aria-label")).toBe("Your providers");
    expect(headings(".nol-teamrun-your-providers")).toEqual(["Codex 1", "Grok CLI 1"]);
    expect(texts(".nol-teamrun-your-providers .nol-teamrun-item-name")).toEqual(["Work", "Home"]);
    expect([kindOf("Home"), kindOf("Work")]).toEqual(["Grok CLI", "Codex"]);
    expect(texts(".nol-teamrun-item-title", row("Work"))).toEqual(["Work"]);
    expect(texts(".nol-teamrun-account", row("Work"))).toEqual(["Account not reported"]);
    expect(row("Work").querySelector(".nol-teamrun-plan-tag")).toBeNull();
    expect(row("Work").querySelector(".nol-teamrun-status-dot")?.getAttribute("aria-label")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
    expect(row("Work").querySelector(".nol-teamrun-status-dot")?.classList).toContain("nol-teamrun-status-dot-connected");
    expect(row("Home").querySelector(".nol-teamrun-status-dot")?.getAttribute("aria-label")).toBe(Resources.providerStatusLabels[AuthStatus.Error]);
    expect(texts(".nol-teamrun-settings-view > .nol-teamrun-notice")).toEqual([Resources.namesNotice]);
    expect(element().querySelectorAll("details, .nol-teamrun-path, .nol-teamrun-kind-block")).toHaveLength(0);
  });

  it("heads a kind TeamRun doesn't list with its id, after the kinds it lists, in their ids' order", async () => {
    providers.push(retired, signedIn("c1", "codex", "codex"), signedIn("c2", "zeta", "Last"));
    await create();

    expect(headings(".nol-teamrun-your-providers")).toEqual(["Codex 2", "Grok CLI 1", "gemini 1", "zeta 1"]);
    expect(texts(".nol-teamrun-item-name")).toEqual(["codex", "Work", "Home", "Old", "Last"]);
    expect([kindOf("codex"), kindOf("Last"), kindOf("Old")]).toEqual(["Codex", "zeta", "gemini"]);
  });

  it("groups the providers by kind, most used kinds first in a fixed order, then the other kinds TeamRun lists in its order, each kind's providers in the " +
    "order they were added, and those added at once by name", async () => {
    const provider = (id: string, kind: string, label: string, minute: number): Provider => new Provider(id, kind, label, `D:\\profiles\\${id}`, AuthStatus.Unknown,
      null, null, null, null, new Date(Date.parse(SampleData.timestamp) + minute * 60_000).toISOString());
    providers = [provider("z1", "grok", "zeta", 1), provider("z2", "droid", "Émile", 2), provider("z3", "codex", "edgar", 3), provider("z4", "grok", "Beta", 4),
      provider("z5", "codex", "alpha", 5), provider("z6", "claude", "Work", 6), provider("z7", "pi", "Pi", 7), provider("z8", "copilot", "Octo", 8),
      provider("z9", "codex", "Late", 9), provider("z10", "codex", "eve", 9)];
    const listed = [new ProviderKind("pi", "Pi", true, false), new ProviderKind("droid", "Droid", true, false), grok, copilot, SampleData.claude, SampleData.codex];
    await create(t => t.answer(MethodName.ProviderKindList, () => listed.map(u => u.toJson())));

    expect(headings(".nol-teamrun-your-providers")).toEqual(["Codex 4", "Claude Code 1", "GitHub Copilot 1", "Grok CLI 2", "Pi 1", "Droid 1"]);
    expect(texts(".nol-teamrun-item-name")).toEqual(["edgar", "alpha", "eve", "Late", "Work", "Octo", "zeta", "Beta", "Pi", "Émile"]);
  });

  it("shows a provider's email, else its user name, Account not reported for a signed-in one that reports neither, and the status for one signed out or unchecked",
    async () => {
      providers.push(octo);
      await withTerminalKinds();

      expect([texts(".nol-teamrun-account", row("Octo")), texts(".nol-teamrun-account", row("Work"))]).toEqual([["octo"], ["Account not reported"]]);
      expect([row("Octo"), row("Work")].map(t => t.querySelector(".nol-teamrun-account-note"))).toEqual([null, null]);
      expect(texts(".nol-teamrun-account-note", row("Desk"))).toEqual([Resources.providerStatusLabels[AuthStatus.LoggedOut]]);
      expect(row("Desk").querySelector(".nol-teamrun-account-failed")).not.toBeNull();
      expect(texts(".nol-teamrun-account-note", row("Pilot"))).toEqual([Resources.providerStatusLabels[AuthStatus.Unknown]]);
      expect(row("Pilot").querySelector(".nol-teamrun-account-failed")).toBeNull();
      expect(announced()).toEqual([]);
    });

  it("shows a failed check's error in the account's place, with the account, the organization and the profile folder in its tooltip", async () => {
    providers = [SampleData.provider, new Provider("a2", "grok", "Home", "D:\\profiles\\grok", AuthStatus.Error, new ProviderIdentity("person@example.com", undefined, "Lab"),
      null, SampleData.timestamp, "grok was not found", SampleData.timestamp)];
    await create();
    const account = button(".nol-teamrun-account", row("Home"));

    expect(account.textContent?.trim()).toBe("grok was not found");
    expect(account.classList).toContain("nol-teamrun-account-failed");
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe(["grok was not found", "person@example.com", "Lab", "Profile folder: D:\\profiles\\grok"].join(Resources.titleSeparator)));
    await userEvent.unhover(account);
  });

  it("shows the plan as a tag by the provider's own name for it, a code it doesn't name as words, and no tag where none is reported or it is blank, and puts the " +
    "organization in the account's tooltip", async () => {
    await withSubscriptions();
    const tagOf = (name: string): string => texts(".nol-teamrun-plan-tag", row(name)).join();

    expect(["Max", "Business", "Teams", "School", "Coded", "Heavy", "Team", "Unnamed", "Blank", "Octo", "Work"].map(t => tagOf(t)))
      .toEqual(["Max", "Business", "Business", "Edu Plus", "Basic", "SuperGrok Heavy", "", "", "", "", ""]);
    expect(row("Max").querySelector(".nol-teamrun-plan-tag")?.tagName).toBe("NOL-CHIP");
    const account = button(".nol-teamrun-account", row("Max"));
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe(["dev@example.com", "Acme", "Profile folder: /profiles/b1"].join(Resources.titleSeparator)));
    await userEvent.unhover(account);
  });

  it("shows the plan a provider's plan read names, such as Copilot's tier, with no reply first, the account's own plan ahead of it unless blank, and no tag where " +
    "neither names one", async () => {
      providers = [octo, subscribed("b1", "claude", "Max", new ProviderIdentity("dev@example.com", "max")), subscribed("b2", "copilot", "Blank",
        new ProviderIdentity("blank@example.com", " ")), SampleData.provider];
      await create(t => t.answer(MethodName.PlanUsageRead, parameters => {
        const read = PlanUsageParams.fromJson(parameters);
        return new PlanUsage(read.kind, read.providerId, [], "2026-10-22T09:00:00.000Z", read.kind === "codex" ? null : "pro").toJson();
      }));

      expect(["Octo", "Max", "Blank", "Work"].map(t => texts(".nol-teamrun-plan-tag", row(t)).join())).toEqual(["Pro", "Max", "Pro", ""]);
      expect(context.count(MethodName.PlanUsageRead)).toBe(4);
    });

  it("reads each signed-in provider's plan once and shows its windows as meters of what's left with their short label, nothing before a read, and that the " +
    "provider reports no limits for no window", async () => {
    await withPlan(42);
    const meters = (name: string): string[] => [...row(name).querySelectorAll<HTMLElement>(".nol-teamrun-meter")].map(t => t.style.getPropertyValue("--nol-teamrun-meter-percent"));

    expect(texts(".nol-teamrun-meter-text", row("Work"))).toEqual(["58% left", "80% left"]);
    expect(texts(".nol-teamrun-limit-label", row("Work"))).toEqual(["5h", "Week"]);
    expect(meters("Work")).toEqual(["58", "80"]);
    expect([...row("Work").querySelectorAll(".nol-teamrun-meter, .nol-teamrun-meter-text")].map(t => t.getAttribute("aria-hidden"))).toEqual(["true", null, "true", null]);
    expect(texts(".nol-teamrun-meter-text, .nol-teamrun-no-limits", row("Home"))).toEqual([]);
    expect(meters("Home")).toEqual([]);
    expect(context.count(MethodName.PlanUsageRead)).toBe(1);
    expect(context.parametersOf(MethodName.PlanUsageRead)).toEqual(new PlanUsageParams("codex", "a1").toJson());
    context.emit(EventName.ProviderUpdated, SampleData.provider.toJson());
    await settle();
    expect(context.count(MethodName.PlanUsageRead)).toBe(1);
    context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "a1", [], "2026-10-22T10:00:00.000Z").toJson());
    await settle();
    expect(texts(".nol-teamrun-meter-text", row("Work"))).toEqual([]);
    expect(texts(".nol-teamrun-no-limits", row("Work"))).toEqual(["Codex reports no limits"]);
    expect(meters("Work")).toEqual([]);
  });

  it("names each shown window's full figure and reset in its tooltip, and the windows it doesn't show in the account's", async () => {
    await create(t => t.answer(MethodName.PlanUsageRead, () => new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 42, null),
      new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, 12.5), new PlanWindow(PlanWindowName.WeeklyOpus, 5, null)],
    "2026-10-22T09:00:00.000Z").toJson()));
    const tooltipOf = async (target: Element): Promise<string | null> => {
      await userEvent.hover(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).not.toBeNull());
      const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
      await userEvent.unhover(target);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
      return shown;
    };

    expect(await tooltipOf(row("Work").querySelectorAll(".nol-teamrun-limit")[0]!)).toBe("5-hour: 42% used, no reset time reported");
    expect(await tooltipOf(row("Work").querySelectorAll(".nol-teamrun-limit")[1]!)).toBe("Weekly Opus: 5% used, no reset time reported");
    expect([texts(".nol-teamrun-limit-label", row("Work")), texts(".nol-teamrun-meter-text", row("Work"))]).toEqual([["5h", "Opus week"], ["58% left", "95% left"]]);
    expect(await tooltipOf(button(".nol-teamrun-account", row("Work"))))
      .toBe(["Account not reported", "Credits: 12.5 left", `Profile folder: ${SampleData.provider.profileDir}`].join(Resources.titleSeparator));
  });

  it("marks a window's meter and figure as a warning from 75% and critical from 90%, in place of a separate line, and only that window's", async () => {
    await withPlan(74);
    const levelsOf = (selector: string): string[] => [...row("Work").querySelectorAll(selector)]
      .map(t => t.classList.contains("nol-teamrun-meter-critical") ? "critical" : t.classList.contains("nol-teamrun-meter-warning") ? "warning" : "normal");
    const shown: [string[], string[]][] = [];
    for (const [percent, hour] of [[74, 10], [75, 11], [89, 12], [90, 13], [74, 14]] as const) {
      context.emit(EventName.PlanUsageUpdated, plan(percent, `2026-10-22T${hour}:00:00.000Z`).toJson());
      await settle();
      shown.push([levelsOf(".nol-teamrun-meter"), levelsOf(".nol-teamrun-meter-text")]);
    }

    expect(shown).toEqual([[["normal", "normal"], ["normal", "normal"]], [["warning", "normal"], ["warning", "normal"]], [["warning", "normal"], ["warning", "normal"]],
      [["critical", "normal"], ["critical", "normal"]], [["normal", "normal"], ["normal", "normal"]]]);
    expect(element().textContent).not.toContain(Resources.nearPlanLimitLabel);
  });

  it("tags a provider signed into the same account as an earlier one of its kind, by email or user name and whatever their case, and no other", async () => {
    providers = [subscribed("d1", "claude", "Agent 1", new ProviderIdentity("agent-1@example.com", "max")),
      subscribed("d2", "claude", "Agent 2", new ProviderIdentity("agent-2@example.com", "max")),
      subscribed("d3", "claude", "Personal", new ProviderIdentity("Agent-1@Example.com", "max")),
      subscribed("d4", "codex", "Agent 1", new ProviderIdentity("agent-1@example.com")),
      subscribed("d5", "grok", "Lab", new ProviderIdentity(undefined, undefined, undefined, undefined, "octo")),
      subscribed("d6", "grok", "Lab 2", new ProviderIdentity(undefined, undefined, undefined, undefined, "octo")),
      subscribed("d7", "grok", "Lab 3", new ProviderIdentity())];
    await create();

    expect(texts(".nol-teamrun-same-account")).toEqual(["Same sign-in as Agent 1", "Same sign-in as Lab"]);
    expect(texts(".nol-teamrun-same-account", row("Personal"))).toEqual(["Same sign-in as Agent 1"]);
    expect(texts(".nol-teamrun-same-account", row("Lab 2"))).toEqual(["Same sign-in as Lab"]);
    expect(row("Personal").querySelector(".nol-teamrun-same-account")?.tagName).toBe("NOL-CHIP");
  });

  it("shows a provider whose last check failed with the failed dot and Connection error, unless its status already asks for a sign-in", async () => {
    providers = [SampleData.provider.withCheck(AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, "The check timed out."),
      new Provider("a3", "codex", "Fresh", "/profiles/fresh", AuthStatus.Unknown, null, null, SampleData.timestamp, "codex was not found", SampleData.timestamp),
      desk.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, "Not logged in.")];
    await create();
    const failed = (label: string): boolean => row(label).querySelector(".nol-teamrun-status-dot")?.classList.contains("nol-teamrun-status-dot-failed") ?? false;

    expect([statusOf("Work"), accountOf("Work"), failed("Work")]).toEqual([Resources.providerStatusLabels[AuthStatus.Error], "The check timed out.", true]);
    expect([statusOf("Fresh"), accountOf("Fresh"), failed("Fresh")]).toEqual([Resources.providerStatusLabels[AuthStatus.Error], "codex was not found", true]);
    expect([statusOf("Desk"), accountOf("Desk"), failed("Desk")]).toEqual([Resources.providerStatusLabels[AuthStatus.LoggedOut], "Not logged in.", false]);
  });

  it("announces through the page's live region, there before anything starts, when a kind starts installing and a provider starts signing in, and not each percent",
    async () => {
      const signIn = new DeferredResponse();
      await createWithInstall(installation(ProviderKindInstallState.Installing, null, 0, 1000), t => t.answer(MethodName.ProviderSignIn, () => signIn.promise));
      const region = document.querySelector(".cdk-live-announcer-element");

      expect([region?.getAttribute("aria-live"), announced()]).toEqual(["polite", ["Antigravity: Installing…"]]);
      context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.Installing, null, 420, 1000).toJson());
      await settle();
      await startSignIn(row("Home"));

      expect(announced()).toEqual(["Antigravity: Installing…", "Home: Signing in…"]);
      expect(announcements().map(t => t[1])).toEqual([AnnouncementPoliteness.Polite, AnnouncementPoliteness.Polite]);
      expect(document.querySelector(".cdk-live-announcer-element")).toBe(region);
      await Wait.until(() => expect(region?.textContent).toContain("Home: Signing in…"));
      signIn.resolve(home.withCheck(AuthStatus.LoggedIn, null, "0.64.0", SampleData.timestamp, null).toJson());
      await settle();
      expect(announced()).toHaveLength(2);
    });

  it("announces each of two same-named providers that start signing in together, once each", async () => {
    providers.push(new Provider("a3", "grok", "Home", "/profiles/grok-2", AuthStatus.Error, null, null, SampleData.timestamp, "grok was not found", SampleData.timestamp));
    const signIn = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderSignIn, () => signIn.promise));
    const homes = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(".nol-teamrun-item")]
      .filter(t => t.querySelector(".nol-teamrun-item-name")?.textContent === "Home");

    expect(homes()).toHaveLength(2);
    await startSignIn(homes()[0]!);
    await startSignIn(homes()[1]!);
    await settle();

    expect(homes().map(t => t.querySelector(".nol-teamrun-account")?.textContent?.trim())).toEqual([Resources.signingInBrowserNote, Resources.signingInBrowserNote]);
    expect(announced()).toEqual(["Home: Signing in…", "Home: Signing in…"]);
  });

  it("announces a provider's sign-in again when it starts again after the first one ends", async () => {
    const [first, second] = [new DeferredResponse(), new DeferredResponse()];
    let started = 0;
    await create(t => t.answer(MethodName.ProviderSignIn, () => (started++ === 0 ? first : second).promise));

    await startSignIn(row("Home"));
    await settle();
    first.resolve(home.toJson());
    await settle();
    expect(statusOf("Home")).not.toBe(Resources.signingInLabel);
    await startSignIn(row("Home"));
    await settle();

    expect([started, accountOf("Home")]).toEqual([2, Resources.signingInBrowserNote]);
    expect(announced()).toEqual(["Home: Signing in…", "Home: Signing in…"]);
  });

  it("names the ⋯ button for its provider and lists by name, in order, only the actions that apply, Disable and Remove after a separator", async () => {
    await create();
    const menuButton = button(".nol-teamrun-row-menu", row("Work"));

    expect(menuButton.getAttribute("aria-label")).toBe("More actions for Work");
    expect(menuButton.querySelector(".nol-icon-button-glyph")?.textContent).toBe(Resources.providerMenuIcon);
    expect(await actions(row("Work"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    expect(await actions(row("Home"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    const shown = await open(row("Work"));

    expect(shown.getAttribute("aria-label")).toBe("More actions for Work");
    expect([...shown.querySelectorAll("button[nol-menu-item], nol-menu-separator")].map(t => t.tagName === "NOL-MENU-SEPARATOR" ? "|" : [...t.classList].find(name => name.startsWith("nol-teamrun-"))))
      .toEqual(["nol-teamrun-edit", "nol-teamrun-check", "nol-teamrun-show-folder", "|", "nol-teamrun-disable", "nol-teamrun-remove"]);
  });

  it("opens a provider's menu from the keyboard and runs an action from it", async () => {
    await create();
    button(".nol-teamrun-row-menu", row("Home")).focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(menu()).not.toBeNull());
    opened = row("Home");

    await Wait.until(() => expect(menu()?.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{End}");
    expect(document.activeElement?.classList).toContain("nol-teamrun-remove");
    await userEvent.keyboard("{Enter}");
    opened = null;

    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-keep", row("Home"))));
    expect(document.querySelector(".nol-dialog-title")).toBeNull();
  });

  it("shows the profile folder in the system's file manager from the menu, and says on the page why the base refused it", async () => {
    await create();

    await choose(".nol-teamrun-show-folder", row("Home"));
    expect(context.shownInFolder).toEqual([home.profileDir]);
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();

    context.showInFolderFailure = "A file was not shown in its folder: no file can be read at the path.";
    await choose(".nol-teamrun-show-folder", row("Work"));
    expect(context.shownInFolder).toEqual([home.profileDir, SampleData.provider.profileDir]);
    await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["TeamRun couldn't show the profile folder. A file was not shown in its folder: no file can be read at the path."]));

    vi.spyOn(context, "showInFolderAsync").mockRejectedValue("The window was closed.");
    await choose(".nol-teamrun-show-folder", row("Home"));
    await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["TeamRun couldn't show the profile folder. The window was closed."]));
  });

  it("offers Show profile folder where the window has no clipboard", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ClipboardWriter, useValue: null }] });
    await create();

    expect(await actions(row("Work"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
  });

  it("says when there are no providers, pointing to the ones found and to Add provider, and when the search finds none, with no list", async () => {
    providers = [];
    await create();

    expect(texts(".nol-teamrun-your-providers .nol-teamrun-list-empty")).toEqual(["None yet. Add one found below, or choose Add provider."]);
    expect(texts(".nol-teamrun-found-providers .nol-teamrun-list-empty")).toEqual(["No signed-in tools found. Add provider installs one and signs it in."]);
    expect(element().querySelector(".nol-teamrun-provider-list")).toBeNull();
    expect(texts(".nol-teamrun-settings-view > .nol-teamrun-notice")).toEqual([Resources.namesNotice]);
  });

  it("checks a provider's sign-in and shows its new status, with the menu's actions off meanwhile", async () => {
    const checked = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderCheck, () => checked.promise));

    await choose(".nol-teamrun-check", row("Work"));

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderCheck)).providerId).toBe("a1");
    expect(await offOf([".nol-teamrun-edit", ".nol-teamrun-check", ".nol-teamrun-disable", ".nol-teamrun-remove"], row("Work"))).toEqual([true, true, true, true]);
    expect([signInOff(row("Home")), ...await offOf([".nol-teamrun-check"], row("Home"))]).toEqual([true, true]);

    checked.resolve(SampleData.provider.withCheck(AuthStatus.Expired, null, "1.0", SampleData.timestamp, null).toJson());
    await settle();

    expect(row("Work").querySelector(".nol-teamrun-status-dot")?.getAttribute("aria-label")).toBe(Resources.providerStatusLabels[AuthStatus.Expired]);
    expect(await offOf([".nol-teamrun-check"], row("Work"))).toEqual([false]);
  });

  it("searches this computer when it opens, saying what it looks for meanwhile, and lists what it finds that isn't added yet, by name, with each one's kind, " +
    "folder, account and state", async () => {
    const discovered = new DeferredResponse();
    const used = new DiscoveredProfile("codex", `${SampleData.provider.profileDir}\\`, "codex", true, AuthStatus.LoggedIn);
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => discovered.promise));

    expect(texts(".nol-teamrun-searching")).toEqual(["Searching…"]);
    expect(element().querySelector(".nol-teamrun-searching nol-spinner")?.getAttribute("role")).toBe("status");
    expect(texts(".nol-teamrun-found-providers .nol-teamrun-list-empty")).toEqual(["Looking for Codex, Claude Code and Grok CLI…"]);
    expect(button(".nol-teamrun-search-again").disabled).toBe(true);
    discovered.resolve(new ProviderProfileDiscovery([spare, used, lab]).toJson());
    await settle();

    expect(element().querySelector(".nol-teamrun-searching")).toBeNull();
    expect(texts(".nol-teamrun-searched")).toEqual(["Searched just now"]);
    expect(context.requests.filter(t => t.method === "teamrun.providerProfileDiscover").map(t => ProviderProfileDiscoverParams.fromJson(t.parameters).kinds))
      .toEqual([["codex"], ["claude"], ["grok"]]);
    expect(context.count(MethodName.ProviderToolList)).toBe(1);
    expect(element().querySelector(".nol-teamrun-found-providers .nol-teamrun-provider-groups")?.getAttribute("aria-label")).toBe("Found on this computer");
    expect(headings(".nol-teamrun-found-providers")).toEqual(["Codex 1", "Grok CLI 1"]);
    expect(texts(".nol-teamrun-found-item .nol-teamrun-item-name")).toEqual(["codex-lab", "grok-spare"]);
    expect([foundRow(lab), foundRow(spare)].map(t => t.closest(".nol-teamrun-provider-list")?.getAttribute("aria-label"))).toEqual(["Codex", "Grok CLI"]);
    expect(texts(".nol-teamrun-item-title", foundRow(lab))).toEqual(["codex-lab"]);
    expect(texts(".nol-teamrun-found-folder", foundRow(lab))).toEqual([lab.profileDir]);
    expect(texts(".nol-teamrun-found-account", foundRow(lab))).toEqual(["lab@example.com"]);
    expect(texts(".nol-teamrun-found-state", foundRow(lab))).toEqual([`${Resources.providerStatusLabels[AuthStatus.LoggedIn]}${Resources.titleSeparator}Plus`]);
    expect(texts(".nol-teamrun-found-state", foundRow(spare))).toEqual([Resources.providerStatusLabels[AuthStatus.LoggedOut]]);
    expect(texts(".nol-teamrun-your-providers .nol-teamrun-item-name")).toEqual(["Work", "Home"]);
  });

  it("says a found sign-in's account isn't reported, and that an unknown one checks when added, while a signed-out one keeps its state", async () => {
    const quiet = new DiscoveredProfile("codex", "D:\\profiles\\codex-quiet", "codex-quiet", false, AuthStatus.Unknown);
    const bare = new DiscoveredProfile("codex", "D:\\profiles\\codex-bare", "codex-bare", false, AuthStatus.LoggedIn);
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([quiet, bare, spare]).toJson()));
    await settle();

    expect([quiet, bare, spare].map(t => [texts(".nol-teamrun-found-account", foundRow(t)), texts(".nol-teamrun-found-state", foundRow(t))])).toEqual([
      [[ProtocolResources.accountNotReported], [Resources.checksWhenAdded]],
      [[ProtocolResources.accountNotReported], [Resources.providerStatusLabels[AuthStatus.LoggedIn]]],
      [[Resources.providerStatusLabels[AuthStatus.LoggedOut]], [Resources.providerStatusLabels[AuthStatus.LoggedOut]]]
    ]);
    expect(foundRow(quiet).querySelector(".nol-teamrun-status-dot")?.getAttribute("aria-label")).toBe(Resources.providerStatusLabels[AuthStatus.Unknown]);
  });

  it("says None yet beside found providers when none is added, and searches again from its refresh, saying when it last searched", async () => {
    providers = [];
    const clock = new FakeClock(Date.parse("2026-10-22T09:00:00.000Z"));
    TestBed.configureTestingModule({ providers: [{ provide: ClockService, useValue: clock }] });
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));

    expect(texts(".nol-teamrun-your-providers .nol-teamrun-list-empty")).toEqual(["None yet."]);
    clock.advance(Resources.minuteMilliseconds * 5);
    await settle();
    expect(texts(".nol-teamrun-searched")).toEqual(["Searched 5 min ago"]);
    button(".nol-teamrun-search-again").click();
    await settle();

    expect(texts(".nol-teamrun-searched")).toEqual(["Searched just now"]);
    expect([context.count(MethodName.ProviderProfileDiscover), context.count(MethodName.ProviderToolList)]).toEqual([6, 2]);
  });

  it("fills in each kind's found providers as its search ends, while the others still search", async () => {
    const codex = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderProfileDiscover, u => (ProviderProfileDiscoverParams.fromJson(u).kinds ?? []).includes("codex")
      ? codex.promise
      : new ProviderProfileDiscovery([lab, spare]).toJson()));

    expect(texts(".nol-teamrun-found-item .nol-teamrun-item-name")).toEqual(["grok-spare"]);
    expect(texts(".nol-teamrun-searching")).toEqual(["Searching…"]);
    codex.resolve(new ProviderProfileDiscovery([lab]).toJson());
    await settle();

    expect(texts(".nol-teamrun-found-item .nol-teamrun-item-name")).toEqual(["codex-lab", "grok-spare"]);
    expect(element().querySelector(".nol-teamrun-searching")).toBeNull();
  });

  it("searches only once the provider kinds load, for each kind they list, and says it hasn't searched, with no spinner, while they fail to load", async () => {
    await createWithoutProviders();

    expect(context.count(MethodName.ProviderProfileDiscover)).toBe(0);
    expect(element().querySelector(".nol-teamrun-searching")).toBeNull();
    expect([texts(".nol-teamrun-searched"), texts(".nol-teamrun-found-providers .nol-teamrun-list-empty")])
      .toEqual([[Resources.notSearchedLabel], [Resources.notSearchedText]]);
    expect(button(".nol-teamrun-search-again").disabled).toBe(true);
    listedKinds = [SampleData.codex, grok];
    button(".nol-teamrun-retry-kinds").click();
    await settle();

    expect(context.requests.filter(t => t.method === "teamrun.providerProfileDiscover").map(t => ProviderProfileDiscoverParams.fromJson(t.parameters).kinds))
      .toEqual([["codex"], ["grok"]]);
    expect(element().querySelector(".nol-teamrun-searching")).toBeNull();
  });

  it("shows a failed search in the view's error line and finds nothing", async () => {
    await create(t => t.fail(MethodName.ProviderProfileDiscover, "The search could not read the profiles folder."));

    expect(texts(".nol-teamrun-error-text")).toEqual(["The search could not read the profiles folder."]);
    expect(texts(".nol-teamrun-found-providers .nol-teamrun-list-empty")).toEqual(["No signed-in tools found. Add provider installs one and signs it in."]);
  });

  it("adds a found provider from its Add, off while it adds, moves it to Your providers and the focus to the next Add, then to the added one's menu", async () => {
    const created = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab, spare]).toJson()));
    const add = (profile: DiscoveredProfile): HTMLButtonElement => button(".nol-teamrun-add-found", foundRow(profile));

    expect([add(lab).textContent?.trim(), add(lab).getAttribute("aria-label")]).toEqual(["Add", Resources.formatAddFound("codex-lab", "lab@example.com")]);
    expect(add(lab).classList).toContain("nol-button-outlined");
    context.answer(MethodName.ProviderCreate, () => created.promise);
    add(lab).click();
    await settle();
    expect(add(lab).disabled).toBe(true);
    const params = ProviderCreateParams.fromJson(context.parametersOf(MethodName.ProviderCreate));
    expect([params.kind, params.label, params.profileDir]).toEqual(["codex", "codex-lab", lab.profileDir]);
    const added = new Provider("n1", "codex", "codex-lab", lab.profileDir, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    providers.push(added);
    created.resolve(added.toJson());
    await settle();

    expect(texts(".nol-teamrun-found-item .nol-teamrun-item-name")).toEqual(["grok-spare"]);
    expect(texts(".nol-teamrun-your-providers .nol-teamrun-item-name")).toEqual(["codex-lab", "Work", "Home"]);
    await Wait.until(() => expect(document.activeElement).toBe(add(spare)));
    context.answer(MethodName.ProviderCreate, () => {
      const provider = new Provider("n2", "grok", "grok-spare", spare.profileDir, AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp);
      providers.push(provider);
      return provider.toJson();
    });
    add(spare).click();
    await settle();

    expect(element().querySelector(".nol-teamrun-found-item")).toBeNull();
    expect(texts(".nol-teamrun-found-providers .nol-teamrun-list-empty")).toEqual(["No signed-in tools found. Add provider installs one and signs it in."]);
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("grok-spare"))));
  });

  it("keeps a found provider whose add fails, with the failure in the view's error line and the focus back on its Add", async () => {
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()).fail(MethodName.ProviderCreate, "The folder is in use."));

    button(".nol-teamrun-add-found", foundRow(lab)).click();
    await settle();

    expect(texts(".nol-teamrun-error-text")).toEqual(["The folder is in use."]);
    expect(texts(".nol-teamrun-found-item .nol-teamrun-item-name")).toEqual(["codex-lab"]);
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-add-found", foundRow(lab))));
  });

  it("leaves the focus where it is when the found provider it adds is gone from a new search by the time the add fails", async () => {
    const refusal = new DeferredResponse();
    let profiles = [lab];
    await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery(profiles).toJson())
      .answer(MethodName.ProviderCreate, async () => {
        await refusal.promise;
        throw new Error("The folder is in use.");
      }));
    const search = button(".nol-teamrun-search-again");

    button(".nol-teamrun-add-found", foundRow(lab)).click();
    profiles = [];
    search.click();
    await settle();
    search.focus();
    refusal.resolve(null);
    await settle();

    expect([texts(".nol-teamrun-error-text"), element().querySelector(".nol-teamrun-found-item")]).toEqual([["The folder is in use."], null]);
    expect(document.activeElement).toBe(search);
  });

  it("says when it last checked the providers, the oldest check, and checks every enabled provider again from its refresh, in the list's order", async () => {
    providers = [SampleData.provider, home, desk.withEnabled(false)];
    const clock = new FakeClock(Date.parse(SampleData.timestamp) + Resources.minuteMilliseconds * 90);
    TestBed.configureTestingModule({ providers: [{ provide: ClockService, useValue: clock }] });
    await create();

    expect(texts(".nol-teamrun-checked")).toEqual(["Checked 1 h ago"]);
    expect(button(".nol-teamrun-check-all").getAttribute("aria-label")).toBe("Check every provider again");
    clock.advance(Resources.minuteMilliseconds * 60 * 24);
    await settle();
    expect(texts(".nol-teamrun-checked")).toEqual(["Checked 1 d ago"]);
    button(".nol-teamrun-check-all").click();
    await settle();

    expect(context.requests.filter(t => t.method === "teamrun.providerCheck").map(t => ProviderIdParams.fromJson(t.parameters).providerId)).toEqual(["a2", "a1"]);
    expect(button(".nol-teamrun-check-all").disabled).toBe(false);
  });

  it("checks the enabled providers three at a time from its refresh, each row showing its result as its check ends, while a hung check holds only its own row",
    async () => {
      const ids = ["c1", "c2", "c3", "c4", "c5"];
      providers = ids.map(t => new Provider(t, "grok", `Desk ${t}`, `D:\\profiles\\grok-${t}`, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));
      const checks = new Map(ids.map(t => [t, new DeferredResponse()] as const));
      await create(t => t.answer(MethodName.ProviderCheck, u => checks.get(ProviderIdParams.fromJson(u).providerId)?.promise ?? null));
      const asked = (): string[] => context.requests.filter(t => t.method === "teamrun.providerCheck").map(t => ProviderIdParams.fromJson(t.parameters).providerId);
      const answer = async (id: string): Promise<void> => {
        checks.get(id)?.resolve(providers.find(t => t.id === id)?.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null).toJson() ?? null);
        await settle();
      };
      const unknown = Resources.providerStatusLabels[AuthStatus.Unknown];
      const signedOut = Resources.providerStatusLabels[AuthStatus.LoggedOut];

      button(".nol-teamrun-check-all").click();
      await settle();
      expect(asked()).toEqual(["c1", "c2", "c3"]);
      await answer("c2");
      expect([asked(), statusOf("Desk c2"), statusOf("Desk c1"), texts(".nol-teamrun-checking")]).toEqual([["c1", "c2", "c3", "c4"], signedOut, unknown,
        [Resources.checkingLabel]]);
      for (const id of ["c3", "c4", "c5"])
        await answer(id);

      expect([asked(), ids.map(t => statusOf(`Desk ${t}`)), texts(".nol-teamrun-checking"), element().querySelector(".nol-teamrun-checked")])
        .toEqual([ids, [unknown, signedOut, signedOut, signedOut, signedOut], [Resources.checkingLabel], null]);
      await answer("c1");
      expect([statusOf("Desk c1"), element().querySelector(".nol-teamrun-checking"), texts(".nol-teamrun-checked").length]).toEqual([signedOut, null, 1]);
    });

  it("offers Check every provider again only while a provider can be checked and nothing else runs, with a spinner in the time's place while it checks", async () => {
    const checked = new DeferredResponse();
    providers = [home];
    await create(t => t.answer(MethodName.ProviderCheck, () => checked.promise));
    const time = texts(".nol-teamrun-checked");

    button(".nol-teamrun-check-all").click();
    await settle();
    expect(button(".nol-teamrun-check-all").disabled).toBe(true);
    expect([texts(".nol-teamrun-checking"), element().querySelector(".nol-teamrun-checked")]).toEqual([[Resources.checkingLabel], null]);
    expect(element().querySelector(".nol-teamrun-checking nol-spinner")?.getAttribute("role")).toBe("status");
    checked.resolve(home.toJson());
    await settle();
    expect(button(".nol-teamrun-check-all").disabled).toBe(false);
    expect([element().querySelector(".nol-teamrun-checking"), texts(".nol-teamrun-checked")]).toEqual([null, time]);
    expect(time).toHaveLength(1);
    await choose(".nol-teamrun-disable", row("Home"));

    expect([button(".nol-teamrun-check-all").disabled, element().querySelector(".nol-teamrun-checked")]).toEqual([true, null]);
  });

  describe("adding a provider in place", () => {
    const unzip = "Installing Antigravity needs unzip, which this computer does not have.";
    const claudeKind = new ProviderKind("claude", "Claude Code", true, false);
    const installsOf = (claude: ProviderKindInstallState): ProviderKindInstallation[] => [new ProviderKindInstallation("claude", claude),
      new ProviderKindInstallation("antigravity", ProviderKindInstallState.Unavailable, unzip, 0, 0, null, null, true, "unzip")];
    const withKinds = (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => create(t => configure(t
      .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claudeKind.toJson(), grok.toJson(), antigravity.toJson()])
      .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(), new ProviderTool("grok", false, null, "curl -fsSL https://x.ai/cli/install.sh | sh").toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => installsOf(ProviderKindInstallState.NotInstalled).map(u => u.toJson()))));
    const openPanel = async (): Promise<void> => {
      button(".nol-teamrun-add").click();
      await settle();
    };
    const card = (kind: string): HTMLButtonElement => button(`.nol-teamrun-kind-card[data-kind="${kind}"]`);
    const nameField = (): HTMLInputElement => {
      const found = element().querySelector<HTMLInputElement>(".nol-teamrun-add-name");
      if (Object.isNull(found))
        throw new Error("The panel shows no name field.");
      return found;
    };
    const created = (): (string | null)[][] => context.requests.filter(t => t.method === "teamrun.providerCreate").map(t => ProviderCreateParams.fromJson(t.parameters))
      .map(t => [t.kind, t.label, t.profileDir]);

    it("opens a panel in the form with a card per type and its install state, a type that can't install naming the program it needs, the name filled in and shown with its type, and adds in a new folder or " +
      "an existing one", async () => {
      await withKinds();
      context.chosenFolder = "D:\\profiles\\third";

      await openPanel();

      expect([element().querySelector(".nol-teamrun-add"), document.querySelector(".nol-dialog-title")]).toEqual([null, null]);
      expect(texts(".nol-teamrun-add-title")).toEqual(["Add provider"]);
      expect(texts(".nol-teamrun-kind-card-name")).toEqual(["Codex", "Claude Code", "Grok CLI", "Antigravity", "ACP agent"]);
      expect(texts(".nol-teamrun-kind-card-note")).toEqual(["Installed · 0.166.0", "Not installed · TeamRun installs it", "Not installed · you install it",
        "Needs unzip first", "From the ACP registry"]);
      expect([...element().querySelectorAll(".nol-teamrun-kind-card")].map(t => t.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false", "false"]);
      expect(document.activeElement).toBe(card("codex"));
      expect([nameField().value, texts(".nol-teamrun-shown-as")[0], texts(".nol-teamrun-add-save")[0]]).toEqual(["Personal", "Shown as \"Personal · Codex\"", "Add"]);
      expect(texts(".nol-teamrun-add-folder-text")).toEqual(["Folder: TeamRun makes one for this provider."]);

      card("grok").click();
      await settle();

      expect([nameField().value, texts(".nol-teamrun-shown-as")[0], texts(".nol-teamrun-add-save")[0]])
        .toEqual(["Personal", "Shown as \"Personal · Grok CLI\"", "Add and sign in"]);

      card("codex").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await settle();

      expect(created()).toEqual([["codex", "Personal", null]]);
      expect(element().querySelector(".nol-teamrun-add-panel")).toBeNull();
      expect(document.activeElement).toBe(button(".nol-teamrun-add"));

      await openPanel();
      expect(nameField().value).toBe("Lab");
      type(".nol-teamrun-add-name", "Third");
      button(".nol-teamrun-use-folder").click();
      await settle();

      expect([texts(".nol-teamrun-add-folder-text")[0], texts(".nol-teamrun-add-save")[0], texts(".nol-teamrun-shown-as")[0]])
        .toEqual(["Folder: D:\\profiles\\third", "Add", "Shown as \"Third · Codex\""]);

      button(".nol-teamrun-add-save").click();
      await settle();

      expect(context.folderChoices).toBe(1);
      expect(created()).toEqual([["codex", "Personal", null], ["codex", "Third", "D:\\profiles\\third"]]);
      expect(texts(".nol-teamrun-item-name")).toEqual(["Personal", "Third", "Work", "Home"]);
    });

    it("installs a type TeamRun installs in the panel, with its phase, progress and Cancel and no line atop the list, keeping its type, name and folder, then " +
      "adds it", async () => {
      const install = (received: number, cancellable: boolean = true, total: number = 100_000_000): ProviderKindInstallation =>
        new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, received, total, null, null, cancellable);
      await withKinds(t => t.answer(MethodName.ProviderKindInstall, () => install(0, true, 0).toJson()));
      await openPanel();
      card("claude").click();
      await settle();

      button(".nol-teamrun-add-save").click();
      await settle();

      expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstall)).kind).toBe("claude");
      expect(texts(".nol-teamrun-add-progress-text")).toEqual(["Installing Claude Code: starting"]);
      expect([card("codex").disabled, nameField().disabled, button(".nol-teamrun-use-folder").disabled]).toEqual([true, true, true]);
      card("codex").click();
      await settle();

      expect([card("claude").getAttribute("aria-pressed"), nameField().value]).toEqual(["true", "Personal"]);
      context.emit(EventName.ProviderKindInstallationChanged, install(0).toJson());
      await settle();

      expect(texts(".nol-teamrun-add-progress-text")).toEqual(["Installing Claude Code: downloading 0 of 96 MB"]);
      context.emit(EventName.ProviderKindInstallationChanged, install(43_000_000).toJson());
      await settle();

      expect(texts(".nol-teamrun-add-progress-text")).toEqual(["Installing Claude Code: downloading 41 of 96 MB"]);
      expect(button(".nol-teamrun-add-bar").getAttribute("aria-valuenow")).toBe("0.43");
      expect(texts(".nol-teamrun-kind-card-note", card("claude"))).toEqual(["Installing…"]);
      expect([installLines(), created()]).toEqual([[], []]);
      expect(button(".nol-teamrun-add-save").disabled).toBe(true);
      context.emit(EventName.ProviderKindInstallationChanged, install(100_000_000, false).toJson());
      await settle();

      expect([texts(".nol-teamrun-add-progress-text"), element().querySelector(".nol-teamrun-add-cancel-install")]).toEqual([["Installing Claude Code: setting up"], null]);
      expect(button(".nol-teamrun-add-bar").getAttribute("aria-valuenow")).toBeNull();
      context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("claude", ProviderKindInstallState.Installed, null, 0, 0, "2.1.0").toJson());
      await settle();

      expect(created()).toEqual([["claude", "Personal", null]]);
      expect(element().querySelector(".nol-teamrun-add-panel")).toBeNull();
    });

    it("stops an install from the panel's Cancel without adding, and shows a failed install's reason in the panel", async () => {
      await withKinds(t => t.answer(MethodName.ProviderKindInstall, () =>
        new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 0, 1000).toJson()).answer(MethodName.ProviderKindInstallCancel, () => null));
      await openPanel();
      card("claude").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await settle();

      button(".nol-teamrun-add-cancel-install").click();
      await settle();
      context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("claude", ProviderKindInstallState.NotInstalled).toJson());
      await settle();

      expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstallCancel)).kind).toBe("claude");
      expect([created(), texts(".nol-teamrun-add-error"), element().querySelector(".nol-teamrun-add-progress")]).toEqual([[], [], null]);

      button(".nol-teamrun-add-save").click();
      await settle();
      context.emit(EventName.ProviderKindInstallationChanged,
        new ProviderKindInstallation("claude", ProviderKindInstallState.NotInstalled, "The download stopped: the connection closed.").toJson());
      await settle();

      expect([created(), texts(".nol-teamrun-add-error")]).toEqual([[], ["The download stopped: the connection closed."]]);
      expect(element().querySelector(".nol-teamrun-add-panel")).not.toBeNull();
    });

    it("says why a type can't be installed and what to do, with Try again, and keeps Add off until it can", async () => {
      await withKinds(t => t.answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed).toJson()));
      await openPanel();

      card("antigravity").click();
      await settle();

      expect(texts(".nol-teamrun-add-step[role=alert] .nol-teamrun-add-step-text")).toEqual([`${unzip} Once it has, choose Try again.`]);
      expect(button(".nol-teamrun-add-save").disabled).toBe(true);

      button(".nol-teamrun-add-try-again").click();
      await settle();

      expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstall)).kind).toBe("antigravity");
      expect(created()).toEqual([["antigravity", "Personal", null]]);
    });

    it("says what to run for a type TeamRun doesn't install itself, opens no terminal until Add, and looks for it again on Try again", async () => {
      let installed = false;
      await withKinds(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(),
        new ProviderTool("grok", installed, installed ? "1.2.0" : null, "curl -fsSL https://x.ai/cli/install.sh | sh").toJson()]));
      await openPanel();

      card("grok").click();
      await settle();

      expect(texts(".nol-teamrun-add-step .nol-teamrun-add-step-text")).toEqual(["TeamRun doesn't install Grok CLI itself. Add runs its install command in a " +
        "terminal below and adds the provider once it finds Grok CLI; if you install it another way, choose Try again: curl -fsSL https://x.ai/cli/install.sh | sh"]);
      button(".nol-teamrun-add-look-again").click();
      await settle();

      expect([texts(".nol-teamrun-kind-card-note", card("grok")), element().querySelectorAll(".nol-teamrun-add-step").length]).toEqual([["Not installed · you install it"], 1]);
      installed = true;
      button(".nol-teamrun-add-look-again").click();
      await settle();

      expect([texts(".nol-teamrun-kind-card-note", card("grok")), element().querySelector(".nol-teamrun-add-step")]).toEqual([["Installed · 1.2.0"], null]);
      expect(terminals.launches).toHaveLength(0);
    });

    it("runs a type's install command from Add in a terminal below the panel and in no Terminals tab, titled with its type, hides the terminal from its ×, " +
      "shows it again from Show terminal, and adds the provider once the tool is found", async () => {
      let installed = false;
      await withKinds(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(),
        new ProviderTool("grok", installed, installed ? "1.2.0" : null, "curl -fsSL https://x.ai/cli/install.sh | sh").toJson()]));
      await openPanel();
      card("grok").click();
      await settle();

      button(".nol-teamrun-add-save").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      expect([terminals.launches[0]?.request.command, terminals.launches[0]?.request.title, terminals.launches[0]?.request.opensTab])
        .toEqual(["curl -fsSL https://x.ai/cli/install.sh | sh", "Install Grok CLI", false]);
      expect(element().querySelector(".nol-teamrun-add-show-terminal")).toBeNull();
      expect(texts(".nol-teamrun-add-terminal .nol-teamrun-terminal-title")).toEqual(["Terminal · Install Grok CLI"]);
      expect(texts(".nol-teamrun-add-terminal .nol-teamrun-fake-terminal")).toEqual(["terminal-1"]);
      expect([button(".nol-teamrun-add-save").disabled, button(".nol-teamrun-add-save").textContent?.trim(), created()]).toEqual([true, "Add and sign in", []]);
      expect(element().querySelector(".nol-teamrun-add-busy")?.getAttribute("role")).toBe("status");
      expect([card("codex").disabled, nameField().disabled]).toEqual([true, true]);
      expect(element().querySelector(".nol-teamrun-add-panel .nol-teamrun-add-terminal")).toBeNull();
      button(".nol-teamrun-add-terminal .nol-teamrun-close-terminal").click();
      await settle();

      expect([element().querySelector(".nol-teamrun-add-terminal"), embedded.disposed]).toEqual([null, ["terminal-1"]]);
      button(".nol-teamrun-add-show-terminal").click();
      await settle();

      expect([texts(".nol-teamrun-add-terminal .nol-teamrun-fake-terminal"), element().querySelector(".nol-teamrun-add-show-terminal")]).toEqual([["terminal-1"], null]);
      installed = true;
      terminals.endCommand(0, 0);
      await Wait.until(() => expect(created()).toEqual([["grok", "Personal", null]]));
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-add-panel")).toBeNull());
    });

    it("keeps a running install's terminal under the rows once Add closes, hides it from its ×, and reopens Add on that type with its terminal below the panel " +
      "again", async () => {
      await withKinds();
      await openPanel();
      card("grok").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      expect(element().querySelector(".nol-teamrun-install-terminal")).toBeNull();
      button(".nol-teamrun-add-cancel").click();
      await settle();

      expect(element().querySelector(".nol-teamrun-add-panel")).toBeNull();
      expect([texts(".nol-teamrun-install-terminal .nol-teamrun-terminal-title"), texts(".nol-teamrun-install-terminal .nol-teamrun-fake-terminal")])
        .toEqual([["Terminal · Install Grok CLI"], ["terminal-1"]]);
      const top = element().querySelector(".nol-teamrun-install-terminal")?.getBoundingClientRect().top ?? 0;
      expect(top).toBeGreaterThanOrEqual(element().querySelector(".nol-teamrun-your-providers .nol-teamrun-provider-list")?.getBoundingClientRect().bottom ?? Infinity);
      button(".nol-teamrun-install-terminal .nol-teamrun-close-terminal").click();
      await settle();

      expect([element().querySelector(".nol-teamrun-install-terminal"), embedded.disposed]).toEqual([null, ["terminal-1", "terminal-1"]]);
      await openPanel();

      expect([card("grok").getAttribute("aria-pressed"), element().querySelector(".nol-teamrun-install-terminal")]).toEqual(["true", null]);
      expect(texts(".nol-teamrun-add-terminal .nol-teamrun-fake-terminal")).toEqual(["terminal-1"]);
      terminals.end(0);
      await settle();

      expect([element().querySelector(".nol-teamrun-add-terminal"), element().querySelector(".nol-teamrun-install-terminal")]).toEqual([null, null]);
    });

    it("offers Add again, with nothing added, when a type's install terminal closes before its tool is found", async () => {
      await withKinds();
      await openPanel();
      card("grok").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      terminals.end(0, new TerminalEnd("Close", null));
      await Wait.until(() => expect(button(".nol-teamrun-add-save").disabled).toBe(false));

      expect([created(), element().querySelector(".nol-teamrun-add-terminal"), texts(".nol-teamrun-kind-card-note", card("grok")), texts(".nol-teamrun-add-error")])
        .toEqual([[], null, ["Not installed · you install it"], []]);
    });

    it("says in the panel that a type's install command ended without installing it, keeps its terminal, and offers Add again with nothing added", async () => {
      await withKinds();
      await openPanel();
      card("grok").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      terminals.endCommand(0, 1);
      await Wait.until(() => expect(button(".nol-teamrun-add-save").disabled).toBe(false));

      expect([created(), texts(".nol-teamrun-add-error"), texts(".nol-teamrun-add-terminal .nol-teamrun-fake-terminal")])
        .toEqual([[], ["The install command ended without installing Grok CLI. Choose Add to run it again."], ["terminal-1"]]);
    });

    it("closes the panel on Cancel or Escape with nothing added and the focus back on Add provider, and opens the ACP registry from its card", async () => {
      await withKinds();
      await openPanel();
      type(".nol-teamrun-add-name", "Spare");

      button(".nol-teamrun-add-cancel").click();
      await settle();

      expect([element().querySelector(".nol-teamrun-add-panel"), created()]).toEqual([null, []]);
      expect(document.activeElement).toBe(button(".nol-teamrun-add"));

      await openPanel();
      expect(nameField().value).toBe("Personal");
      nameField().focus();
      await userEvent.keyboard("{Escape}");
      await settle();

      expect(element().querySelector(".nol-teamrun-add-panel")).toBeNull();
      expect(document.activeElement).toBe(button(".nol-teamrun-add"));

      await openPanel();
      card(Resources.acpRowKind).click();
      await Wait.until(() => expect(document.querySelector("nol-teamrun-acp-agents-dialog")).not.toBeNull());
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector("nol-teamrun-acp-agents-dialog")).toBeNull());
      expect(card("codex").getAttribute("aria-pressed")).toBe("true");
    });

    it("chooses an ACP agent added from the registry once its dialog closes, keeping the chosen type while the list of types grows", async () => {
      const droid = new ProviderKind("droid", "Droid", true, false);
      const kinds: ProviderKind[] = [SampleData.codex, claudeKind, grok, antigravity];
      await withKinds(t => t.answer(MethodName.ProviderKindList, () => kinds.map(u => u.toJson()))
        .answer(MethodName.AcpAgentList, () => new AcpAgentListing([new AcpAgentEntry(droid.id, droid.displayName, "1.1.0", "Works through your tasks", null, null, false,
          false)], [], null, SampleData.timestamp).toJson())
        .answer(MethodName.AcpAgentIcon, () => null)
        .answer(MethodName.AcpAgentAdd, () => {
          kinds.push(droid);
          return null;
        })
        .answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installing, null, 0, 100).toJson()));
      await openPanel();
      card("grok").click();
      await settle();

      card(Resources.acpRowKind).click();
      const agent = (): Element | null => document.querySelector(`.nol-teamrun-acp-agent[data-agent="${droid.id}"]`);
      await Wait.until(() => expect(agent()).not.toBeNull());
      button(".nol-teamrun-acp-add", agent() ?? document).click();
      await Wait.until(() => expect(element().querySelector(`.nol-teamrun-kind-card[data-kind="${droid.id}"]`)).not.toBeNull());

      expect([card("grok").getAttribute("aria-pressed"), card(droid.id).getAttribute("aria-pressed")]).toEqual(["true", "false"]);
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(card(droid.id).getAttribute("aria-pressed")).toBe("true"));
      expect([card("grok").getAttribute("aria-pressed"), nameField().value]).toEqual(["false", "Personal"]);
    });

    it("chooses an ACP agent added from the registry once its dialog closes while the icons the dialog reads again are still out", async () => {
      const droid = new ProviderKind("droid", "Droid", true, false);
      const kinds: ProviderKind[] = [SampleData.codex, claudeKind, grok, antigravity];
      const icons = new DeferredResponse();
      let added = false;
      await withKinds(t => t.answer(MethodName.ProviderKindList, () => kinds.map(u => u.toJson()))
        .answer(MethodName.AcpAgentList, () => new AcpAgentListing([new AcpAgentEntry(droid.id, droid.displayName, "1.1.0", "Works through your tasks", null, null, false,
          added)], [], null, SampleData.timestamp).toJson())
        .answer(MethodName.AcpAgentIcon, () => added ? icons.promise : null)
        .answer(MethodName.AcpAgentAdd, () => {
          kinds.push(droid);
          added = true;
          return null;
        })
        .answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation(droid.id, ProviderKindInstallState.Installing, null, 0, 100).toJson()));
      await openPanel();

      card(Resources.acpRowKind).click();
      const agent = (): Element | null => document.querySelector(`.nol-teamrun-acp-agent[data-agent="${droid.id}"]`);
      await Wait.until(() => expect(agent()).not.toBeNull());
      button(".nol-teamrun-acp-add", agent() ?? document).click();
      await Wait.until(() => expect(context.count(MethodName.AcpAgentIcon)).toBe(2));
      await userEvent.keyboard("{Escape}");

      await Wait.until(() => expect(card(droid.id).getAttribute("aria-pressed")).toBe("true"));
      expect(card("codex").getAttribute("aria-pressed")).toBe("false");
      icons.resolve(null);
    });

    it("adds nothing from Enter while the name is empty, keeps the folder when its choice is cancelled, stays open on Escape while it adds, and keeps the " +
      "panel with the failure under its fields when the add fails", async () => {
      const adding = new DeferredResponse();
      await withKinds(t => t.answer(MethodName.ProviderCreate, async () => {
        await adding.promise;
        throw new Error("The folder is in use.");
      }));
      await openPanel();
      button(".nol-teamrun-use-folder").click();
      await settle();

      expect([context.folderChoices, texts(".nol-teamrun-add-folder-text")]).toEqual([1, ["Folder: TeamRun makes one for this provider."]]);
      type(".nol-teamrun-add-name", " ");
      nameField().focus();
      await userEvent.keyboard("{Enter}");
      await settle();

      expect([created(), texts(".nol-teamrun-shown-as"), button(".nol-teamrun-add-save").disabled]).toEqual([[], [""], true]);

      type(".nol-teamrun-add-name", "Third");
      nameField().focus();
      await userEvent.keyboard("{Enter}");
      await settle();
      expect(button(".nol-teamrun-add-cancel").disabled).toBe(true);
      element().querySelector(".nol-teamrun-add-panel")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await settle();

      expect([created(), element().querySelector(".nol-teamrun-add-panel") !== null]).toEqual([[["codex", "Third", null]], true]);
      adding.resolve(null);
      await Wait.until(() => expect(texts(".nol-teamrun-add-error")).toEqual(["The folder is in use."]));
      expect([element().querySelector(".nol-teamrun-add-panel") !== null, button(".nol-teamrun-add-save").disabled]).toEqual([true, false]);
    });

    it("shows a refused install's reason in the panel, and an install that ends unable to install here as its step, with nothing added", async () => {
      await withKinds(t => t.fail(MethodName.ProviderKindInstall, "The installer can't be reached."));
      await openPanel();
      card("antigravity").click();
      await settle();

      button(".nol-teamrun-add-try-again").click();
      await settle();

      expect([created(), texts(".nol-teamrun-add-error")]).toEqual([[], ["The installer can't be reached."]]);
      context.answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 0, 1000).toJson());
      card("claude").click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await settle();
      context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("claude", ProviderKindInstallState.Unavailable, unzip).toJson());
      await settle();

      expect([created(), texts(".nol-teamrun-add-error"), texts(".nol-teamrun-add-step[role=alert] .nol-teamrun-add-step-text")])
        .toEqual([[], [], [`${unzip} Once it has, choose Try again.`]]);
    });

    it("calls a type whose tool isn't found and has no install command Not installed, with no step, an installed one without a version Installed, and says an " +
      "unavailable one without a reason or a missing program can't be installed on this computer", async () => {
      await withKinds(t => t.answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(), new ProviderTool("grok", false).toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("claude", ProviderKindInstallState.Installed),
          new ProviderKindInstallation("antigravity", ProviderKindInstallState.Unavailable)].map(u => u.toJson())));
      await openPanel();

      expect(texts(".nol-teamrun-kind-card-note")).toEqual(["Installed · 0.166.0", "Installed", "Not installed", "Can't install here", "From the ACP registry"]);
      card("grok").click();
      await settle();

      expect(element().querySelector(".nol-teamrun-add-step")).toBeNull();
      card("antigravity").click();
      await settle();

      expect(texts(".nol-teamrun-add-step .nol-teamrun-add-step-text")).toEqual(["TeamRun can't install it on this computer. Choose Try again to check again."]);
    });

    it("disables the card of a type that takes one provider once there is one, its note giving why, chooses the next card, and takes no click on it", async () => {
      const single = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, "Codex keeps one sign-in on this computer, so TeamRun takes one Codex provider.");
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      onTestFinished(() => AppearanceFixture.reset());
      await withKinds(t => t.answer(MethodName.ProviderKindList, () => [single.toJson(), claudeKind.toJson(), grok.toJson(), antigravity.toJson()]));
      await openPanel();

      expect([card("codex").disabled, texts(".nol-teamrun-kind-card-note", card("codex")), card("codex").classList.contains("nol-teamrun-kind-taken")])
        .toEqual([true, ["Codex keeps one sign-in on this computer, so TeamRun takes one Codex provider."], true]);
      expect([...element().querySelectorAll(".nol-teamrun-kind-card")].map(t => t.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false", "false"]);
      const [taken, next] = [card("codex").getBoundingClientRect(), card("claude").getBoundingClientRect()];
      expect([Math.round(taken.top - next.top), Math.round(taken.height - next.height), Math.round(taken.width - next.width)]).toEqual([0, 0, 0]);
      expect([getComputedStyle(card("codex")).cursor, getComputedStyle(card("claude")).cursor]).toEqual(["default", "pointer"]);
      const colorOf = (kind: string, part: string): string => getComputedStyle(card(kind).getElementsByClassName(`nol-teamrun-kind-card-${part}`)[0] ?? card(kind)).color;
      expect([colorOf("codex", "name") === colorOf("codex", "note"), colorOf("codex", "name") === colorOf("claude", "name")]).toEqual([true, false]);

      card("codex").click();
      await settle();
      expect([card("claude").getAttribute("aria-pressed"), button(".nol-teamrun-add-save").disabled]).toEqual(["true", false]);
    });

    it("offers only the ACP agent card, chosen, with no name shown with a type and Add off, while the runtime lists no type", async () => {
      await withKinds(t => t.answer(MethodName.ProviderKindList, () => []));
      await openPanel();

      expect([texts(".nol-teamrun-kind-card-name"), texts(".nol-teamrun-shown-as"), button(".nol-teamrun-add-save").disabled]).toEqual([["ACP agent"], [""], true]);
      expect(card(Resources.acpRowKind).getAttribute("aria-pressed")).toBe("true");
    });

    it("moves off a card once its type becomes taken while open, and onto the ACP agent card once every type is taken, adding nothing there", async () => {
      const single = new ProviderKind("codex", "Codex", true, false, null, SampleData.codex.profile, false, null, false, "Codex keeps one sign-in on this computer.");
      const alone = new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, "Claude Code keeps one sign-in here.");
      providers = [];
      await withKinds(t => t.answer(MethodName.ProviderKindList, () => [single.toJson(), alone.toJson()]));
      await openPanel();
      const pressed = (): (string | null)[] => [...element().querySelectorAll(".nol-teamrun-kind-card")].map(t => t.getAttribute("aria-pressed"));
      expect(pressed()).toEqual(["true", "false", "false"]);

      context.emit(EventName.ProviderUpdated, SampleData.provider.toJson());
      await settle();
      expect([pressed(), card("codex").disabled]).toEqual([["false", "true", "false"], true]);

      context.emit(EventName.ProviderUpdated, new Provider("a3", "claude", "Home", "D:\\profiles\\claude", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null,
        SampleData.timestamp).toJson());
      await settle();
      expect([pressed(), card("claude").disabled, texts(".nol-teamrun-shown-as"), button(".nol-teamrun-add-save").disabled])
        .toEqual([["false", "false", "true"], true, [""], true]);
      nameField().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await settle();
      expect(created()).toEqual([]);
    });
  });

  it("edits a provider in its dialog from its menu, starting from its name and folder", async () => {
    await create();
    context.chosenFolder = "D:\\profiles\\office";

    await choose(".nol-teamrun-edit", row("Home"));

    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe(Resources.editProviderLabel);
    expect(document.activeElement?.classList.contains("nol-teamrun-provider-name")).toBe(true);
    expect(document.querySelector<HTMLInputElement>(".nol-teamrun-provider-name")?.value).toBe("Home");
    expect(document.querySelector<HTMLInputElement>(".nol-teamrun-profile-folder")?.value).toBe(home.profileDir);

    type(".nol-teamrun-provider-name", "Office");
    button(".nol-teamrun-choose-folder", document).click();
    await settle();
    button(".nol-teamrun-save", document).click();
    await settle();

    const params = ProviderUpdateParams.fromJson(context.parametersOf(MethodName.ProviderUpdate));
    expect([params.providerId, params.label, params.profileDir]).toEqual(["a2", "Office", "D:\\profiles\\office"]);
    expect(document.querySelector(".nol-dialog-title")).toBeNull();
    expect(texts(".nol-teamrun-item-name")).toEqual(["Work", "Office"]);
    expect(statusOf("Office")).toBe(Resources.providerStatusLabels[AuthStatus.Unknown]);
  });

  it("asks Remove in the provider's row, naming the teammates that use it, keeps it on Keep with the focus back on its menu, and removes it on Remove with the " +
    "focus on the next row's menu", async () => {
    await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()).answer(MethodName.TeammateList, () =>
      [teammate("tester", "Tester", "a2"), teammate("writer", "Writer", "a1"), teammate("reviewer", "Reviewer", "a2")].map(u => u.toJson())));
    const account = accountOf("Home");

    await choose(".nol-teamrun-remove", row("Home"));

    expect(document.querySelector(".nol-dialog-title")).toBeNull();
    expect(row("Home").classList).toContain("nol-teamrun-asking");
    expect(texts(".nol-teamrun-question", row("Home"))).toEqual([
      "Remove it? Its folder and sign-in stay on this computer. @Reviewer and @Tester use it and will stop answering until you give them another provider."]);
    expect(row("Home").querySelector(".nol-teamrun-account, .nol-teamrun-row-menu")).toBeNull();
    expect(texts(".nol-teamrun-plan-cell, .nol-teamrun-limits-cell", row("Home"))).toEqual(["", ""]);
    expect(texts(".nol-teamrun-menu-cell button", row("Home"))).toEqual(["Keep", "Remove"]);
    expect([row("Home").querySelector("nol-teamrun-provider-step"), row("Work").querySelector("nol-teamrun-provider-step") !== null]).toEqual([null, true]);
    expect([button(".nol-teamrun-keep", row("Home")).getAttribute("aria-label"), button(".nol-teamrun-confirm-remove", row("Home")).getAttribute("aria-label")])
      .toEqual(["Keep Home", "Remove Home"]);
    expect(document.getElementById(button(".nol-teamrun-confirm-remove", row("Home")).getAttribute("aria-describedby") ?? "")?.textContent?.trim())
      .toBe(texts(".nol-teamrun-question", row("Home"))[0]);
    expect(document.activeElement).toBe(button(".nol-teamrun-keep", row("Home")));
    expect([row("Work").classList.contains("nol-teamrun-asking"), accountOf("Work") !== "", texts(".nol-teamrun-meter-text", row("Work")).length])
      .toEqual([false, true, 2]);

    button(".nol-teamrun-keep", row("Home")).click();
    await settle();

    expect(context.count(MethodName.ProviderDelete)).toBe(0);
    expect([row("Home").classList.contains("nol-teamrun-asking"), accountOf("Home")]).toEqual([false, account]);
    expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("Home")));

    await choose(".nol-teamrun-remove", row("Home"));
    button(".nol-teamrun-confirm-remove", row("Home")).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderDelete)).providerId).toBe("a2");
    expect(texts(".nol-teamrun-item-name")).toEqual(["Work"]);
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("Work"))));
  });

  it("puts the focus on the previous row's menu after removing the last row, and on Add provider after removing the only one", async () => {
    await create();
    await choose(".nol-teamrun-remove", row("Work"));
    button(".nol-teamrun-confirm-remove", row("Work")).click();
    await settle();

    expect(texts(".nol-teamrun-item-name")).toEqual(["Home"]);
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("Home"))));

    await choose(".nol-teamrun-remove", row("Home"));
    button(".nol-teamrun-confirm-remove", row("Home")).click();
    await settle();

    expect(element().querySelector(".nol-teamrun-item[data-provider]")).toBeNull();
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-add")));
  });

  it("leaves a focus the person moved while a provider's removal runs", async () => {
    const removing = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderDelete, () => removing.promise));
    await choose(".nol-teamrun-remove", row("Home"));
    button(".nol-teamrun-confirm-remove", row("Home")).click();
    await Wait.until(() => expect(context.count(MethodName.ProviderDelete)).toBe(1));
    const add = button(".nol-teamrun-add");

    add.focus();
    removing.resolve(null);
    await Wait.until(() => expect(texts(".nol-teamrun-item-name")).toEqual(["Work"]));
    await settle();

    expect(document.activeElement).toBe(add);
  });

  it("keeps the provider when the person presses Escape on the row's question, with the focus back on its menu", async () => {
    await create();
    await choose(".nol-teamrun-remove", row("Home"));
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-keep", row("Home"))));

    await userEvent.keyboard("{Escape}");
    await settle();

    expect([context.count(MethodName.ProviderDelete), row("Home").classList.contains("nol-teamrun-asking")]).toEqual([0, false]);
    expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("Home")));
  });

  it("asks one row at a time, and shows the error in the view when removing fails, with the focus back on the row's menu", async () => {
    await create(t => t.fail(MethodName.ProviderDelete, "the database is locked"));
    await choose(".nol-teamrun-remove", row("Home"));
    await choose(".nol-teamrun-remove", row("Work"));

    expect([row("Home").classList.contains("nol-teamrun-asking"), row("Work").classList.contains("nol-teamrun-asking")]).toEqual([false, true]);

    button(".nol-teamrun-confirm-remove", row("Work")).click();
    await settle();

    expect(texts(".nol-teamrun-error-text")).toEqual(["the database is locked"]);
    expect(texts(".nol-teamrun-item-name")).toEqual(["Work", "Home"]);
    expect(row("Work").classList).not.toContain("nol-teamrun-asking");
    await Wait.until(() => expect(document.activeElement).toBe(button(".nol-teamrun-row-menu", row("Work"))));
  });

  it("disables a provider, showing it disabled with why, no usage, and only Edit, Enable and Remove, and enables it again as it was", async () => {
    await withPlan(42);

    await choose(".nol-teamrun-disable", row("Work"));

    expect(ProviderEnabledParams.fromJson(context.parametersOf(MethodName.ProviderSetEnabled))).toEqual(new ProviderEnabledParams("a1", false));
    expect([statusOf("Work"), accountOf("Work")]).toEqual([Resources.disabledProviderLabel, Resources.disabledProviderLabel]);
    expect(texts(".nol-teamrun-meter-text, .nol-teamrun-no-limits", row("Work"))).toEqual([]);
    expect(await actions(row("Work"))).toEqual(["Edit…", "Show profile folder", "Enable", "Remove…"]);
    expect(row("Work").querySelector(".nol-teamrun-item-name")?.classList).toContain("nol-teamrun-unavailable");
    expect(row("Home").querySelector(".nol-teamrun-item-name")?.classList).not.toContain("nol-teamrun-unavailable");
    const account = button(".nol-teamrun-account", row("Work"));
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toContain("TeamRun doesn't check its sign-in or read its usage, and its teammates can't reply until you enable it."));
    await userEvent.unhover(account);

    await choose(".nol-teamrun-enable", row("Work"));

    expect(context.requests.filter(t => t.method === "teamrun.providerSetEnabled").map(t => ProviderEnabledParams.fromJson(t.parameters).enabled)).toEqual([false, true]);
    expect(statusOf("Work")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
    expect(texts(".nol-teamrun-meter-text", row("Work"))).toEqual(["58% left", "80% left"]);
    expect(await actions(row("Work"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    expect(context.count(MethodName.PlanUsageRead)).toBe(1);
  });

  it("reads no usage for a disabled provider and offers it no Install or Sign in", async () => {
    providers = [SampleData.provider.withEnabled(false), home.withEnabled(false)];
    await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()));

    expect(context.count(MethodName.PlanUsageRead)).toBe(0);
    expect(await actions(row("Home"))).toEqual(["Edit…", "Show profile folder", "Enable", "Remove…"]);
    expect(statusOf("Home")).toBe(Resources.disabledProviderLabel);
    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Home"));
    expect(element().querySelectorAll(".nol-teamrun-install, .nol-teamrun-update")).toHaveLength(0);
  });

  it("shows a provider whose provider TeamRun no longer has as unavailable, with why, and offers only Show profile folder and Remove", async () => {
    providers.push(retired);
    await create();

    expect(kindOf("Old")).toBe("gemini");
    expect([statusOf("Old"), accountOf("Old")]).toEqual([Resources.unsupportedProviderLabel, Resources.unsupportedProviderLabel]);
    expect(await actions(row("Old"))).toEqual(["Show profile folder", "Remove…"]);
    expect(await actions(row("Work"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    const account = button(".nol-teamrun-account", row("Old"));
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toContain("TeamRun no longer supports this kind of provider. Remove this provider."));
    await userEvent.unhover(account);

    await choose(".nol-teamrun-remove", row("Old"));
    expect(texts(".nol-teamrun-question", row("Old"))).toEqual([Resources.removeQuestion]);
    button(".nol-teamrun-confirm-remove", row("Old")).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderDelete)).providerId).toBe("a5");
    expect(texts(".nol-teamrun-item-name")).toEqual(["Work", "Home"]);
  });

  it("puts a line between Show profile folder and Remove for a provider TeamRun no longer has", async () => {
    providers.push(retired);
    await create();
    const shown = await open(row("Old"));

    expect([...shown.querySelectorAll("button[nol-menu-item], nol-menu-separator")].map(t => t.tagName)).toEqual(["BUTTON", "NOL-MENU-SEPARATOR", "BUTTON"]);
  });

  it("offers Sign in only where the provider can start one, and shows the provider signing in, its Edit and Remove off, until it ends", async () => {
    const signIn = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignIn, () => signIn.promise));

    expect(await offersSignIn(row("Work"))).toBe(false);
    await startSignIn(row("Home"));

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignIn)).providerId).toBe("a2");
    expect([statusOf("Home"), accountOf("Home")]).toEqual([Resources.signingInLabel, Resources.signingInBrowserNote]);
    expect([await actions(row("Home")), texts("nol-teamrun-provider-step button", row("Home"))]).toEqual([["Edit…", "Show profile folder", "Disable", "Remove…"], ["Cancel"]]);
    expect(await offOf([".nol-teamrun-edit", ".nol-teamrun-remove"], row("Home"))).toEqual([true, true]);
    expect(await offOf([".nol-teamrun-edit"], row("Work"))).toEqual([false]);
    const note = liveNote(Resources.signingInBrowserNote);
    await spoken(Resources.formatLiveStatus("Home", Resources.signingInLabel));
    await userEvent.hover(note);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toContain(Resources.signingInHint));
    await userEvent.unhover(note);

    signIn.resolve(home.withCheck(AuthStatus.LoggedIn, null, "0.64.0", SampleData.timestamp, null).toJson());
    await settle();

    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Home"));
    expect(statusOf("Home")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
    expect(await offersSignIn(row("Home"))).toBe(false);
  });

  it("signs Claude Code and Copilot in from a terminal, shows the provider signing in there with Cancel, and checks it once the terminal ends", async () => {
    await withTerminalKinds();

    expect([await actions(row("Desk")), texts("nol-teamrun-provider-step button", row("Desk"))]).toEqual([["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"], ["Sign in"]]);
    expect(await offers(".nol-teamrun-sign-in", row("Pilot"))).toBe(true);
    await startSignIn(row("Desk"));
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    expect(terminals.launches[0]?.request.environment).toEqual({ CLAUDE_CONFIG_DIR: "D:\\profiles\\claude" });
    expect([statusOf("Desk"), accountOf("Desk")]).toEqual([Resources.signingInLabel, Resources.signingInTerminalNote]);
    expect([await actions(row("Desk")), texts("nol-teamrun-provider-step button", row("Desk"))]).toEqual([["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"], ["Show terminal", "Cancel"]]);
    expect(await offOf([".nol-teamrun-edit", ".nol-teamrun-check", ".nol-teamrun-disable", ".nol-teamrun-remove"], row("Desk"))).toEqual([true, false, false, false]);
    expect(context.count(MethodName.ProviderSignIn)).toBe(0);
    expect(await offOf([".nol-teamrun-sign-in"], row("Pilot"))).toEqual([false]);
    const note = liveNote(Resources.signingInTerminalNote);
    await spoken(Resources.formatLiveStatus("Desk", Resources.signingInLabel));
    await userEvent.hover(note);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toContain(Resources.terminalSigningInHint));
    await userEvent.unhover(note);

    terminals.end(0, new TerminalEnd("Close", null));
    await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderCheck)).providerId).toBe("a6");
    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Desk"));
    expect(statusOf("Desk")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedOut]);
    expect([signInOff(row("Desk")), ...await offOf([".nol-teamrun-edit", ".nol-teamrun-remove"], row("Desk"))]).toEqual([false, false, false]);
    await choose(".nol-teamrun-sign-in", row("Pilot"));
    await Wait.until(() => expect(terminals.launches).toHaveLength(2));

    expect([terminals.launches[1]?.request.title, terminals.launches[1]?.request.opensTab]).toEqual(["Sign in Pilot", false]);
  });

  it("tells the person to type /login in Pi while Pi's sign-in terminal is open", async () => {
    const pi = new ProviderKind("pi", "Pi", true, false, null, new ProviderProfile("PI_CODING_AGENT_DIR", "pi"), false, null, false, null, false, null,
      SampleData.abilities());
    providers.push(new Provider("a12", "pi", "Agent", "D:\\profiles\\pi", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), pi.toJson()]));

    await startSignIn(row("Agent"));
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();
    const note = liveNote(Resources.signingInTerminalNote);
    await userEvent.hover(note);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toContain(Resources.terminalSigningInHints.get("pi")));
    await userEvent.unhover(note);
    terminals.end(0, new TerminalEnd("Close", null));
    await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));

    expect(terminals.launches[0]?.request.command).toBe("pi");
  });

  it("shows the check's failure in the account's place once the login command ends, with Sign in back while its terminal and its card stay open, and closes them once signed in",
    async () => {
      let status = AuthStatus.LoggedOut;
      await withTerminalKinds(t => t.answer(MethodName.ProviderCheck, () => {
        providers = providers.map(u => u.id === "a6" ? u.withCheck(status, null, "1.0", SampleData.timestamp, status === AuthStatus.LoggedIn ? null : "Not logged in.") : u);
        return providers.find(u => u.id === "a6")!.toJson();
      }));
      await startSignIn(row("Desk"));
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 1);
      await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));
      await settle();

      expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Desk"));
      expect([statusOf("Desk"), accountOf("Desk")]).toEqual([Resources.providerStatusLabels[AuthStatus.LoggedOut], "Not logged in."]);
      expect(row("Desk").querySelector(".nol-teamrun-account-failed")).not.toBeNull();
      expect([await actions(row("Desk")), texts("nol-teamrun-provider-step button", row("Desk"))]).toEqual([["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"], ["Sign in again"]]);
      expect(button(".nol-teamrun-step-sign-in", row("Desk")).getAttribute("aria-label")).toBe(Resources.formatKindAction(Resources.signInAgainLabel, "Desk"));
      expect([terminals.closes, texts(".nol-teamrun-sign-in-terminal .nol-teamrun-fake-terminal")]).toEqual([[], ["terminal-1"]]);

      status = AuthStatus.LoggedIn;
      await startSignIn(row("Desk"));
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      terminals.endCommand(1, 0);
      await Wait.until(() => expect(terminals.closes).toEqual([0, 1]));
      await settle();

      expect(statusOf("Desk")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
      expect(row("Desk").querySelector(".nol-teamrun-account-failed")).toBeNull();
      expect([context.count(MethodName.ProviderCheck), element().querySelector(".nol-teamrun-sign-in-terminal"), store.openSignInTerminals().size]).toEqual([2, null, 0]);
    });

  it("stops a terminal sign-in from its row's Cancel by closing its terminal, checks nothing, and brings Sign in and the menu's actions back", async () => {
    await withTerminalKinds();
    await startSignIn(row("Desk"));
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    await cancelSignIn(row("Desk"));

    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Desk"));
    expect(row("Desk").querySelector(".nol-teamrun-step-cancel")).toBeNull();
    expect([signInOff(row("Desk")), ...await offOf([".nol-teamrun-edit", ".nol-teamrun-remove"], row("Desk"))]).toEqual([false, false, false]);
    expect(terminals.closes).toEqual([0]);
    expect(context.count(MethodName.ProviderCheck)).toBe(0);
  });

  it("removes a provider while its terminal sign-in runs, once the person chooses Remove in its row, closes its terminal, and checks nothing after", async () => {
    await withTerminalKinds();
    await startSignIn(row("Desk"));
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    await choose(".nol-teamrun-remove", row("Desk"));
    button(".nol-teamrun-confirm-remove", row("Desk")).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderDelete)).providerId).toBe("a6");
    expect(texts(".nol-teamrun-item-name")).not.toContain("Desk");
    expect(store.terminalSignIns().size).toBe(0);
    expect(terminals.closes).toEqual([0]);
    expect(context.count(MethodName.ProviderCheck)).toBe(0);
  });

  it("adds Claude Code in a new folder and opens its sign-in terminal there, in a Terminals tab unless the form shows it", async () => {
    await withTerminalKinds();

    expect(await store.addProvider("claude", "Studio", null)).toBe(true);
    expect(await store.addProvider("claude", "Loft", null, () => undefined, false)).toBe(true);
    await Wait.until(() => expect(terminals.launches).toHaveLength(2));
    await settle();

    expect(terminals.launches.map(({ request }) => [request.folder, request.title, request.opensTab])).toEqual([
      ["D:\\data\\profiles\\claude\\Studio", "Sign in Studio", true], ["D:\\data\\profiles\\claude\\Loft", "Sign in Loft", false]]);
    expect([statusOf("Studio"), accountOf("Studio")]).toEqual([Resources.signingInLabel, Resources.signingInTerminalNote]);
  });

  it("shows a sign-in another window or the page before a reload started, with Cancel, until it ends", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignInList, () => new ProviderSignIns(["a2"]).toJson())
      .answer(MethodName.ProviderSignInCancel, () => null));

    expect([statusOf("Home"), accountOf("Home")]).toEqual([Resources.signingInLabel, Resources.signingInBrowserNote]);
    expect(await offersSignIn(row("Home"))).toBe(false);
    expect(await offOf([".nol-teamrun-edit"], row("Home"))).toEqual([true]);
    await cancelSignIn(row("Home"));

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignInCancel)).providerId).toBe("a2");
    context.emit(EventName.ProviderSignInsChanged, new ProviderSignIns([]).toJson());
    await settle();

    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Home"));
    expect([signInOff(row("Home")), ...await offOf([".nol-teamrun-edit"], row("Home"))]).toEqual([false, false]);
  });

  it("puts the one action a provider's state needs beside its menu: Sign in where it needs one, Sign in again after a failure, and none otherwise", async () => {
    await withTerminalKinds();
    const steps = (label: string): string[] => texts("nol-teamrun-provider-step button", row(label));

    expect([steps("Desk"), steps("Home"), steps("Work"), steps("Pilot")]).toEqual([["Sign in"], ["Sign in again"], [], []]);
    expect(button("nol-teamrun-provider-step button", row("Desk")).getAttribute("aria-label")).toBe("Sign in Desk");
    expect([...button("nol-teamrun-provider-step button", row("Desk")).classList].filter(t => /^nol-button-(outlined|secondary|text)$/u.test(t))).toEqual([]);
    const step = button("nol-teamrun-provider-step button", row("Desk")).getBoundingClientRect();
    const menu = button(".nol-teamrun-row-menu", row("Desk")).getBoundingClientRect();

    AppearanceFixture.expectPixels(menu.left - step.right, AppearanceFixture.measureLook("space-2"));
    AppearanceFixture.expectPixels(step.top + step.height / 2, menu.top + menu.height / 2);
  });

  it("says where a browser sign-in finishes, offers Copy link and Open sign-in page beside it once it has a page, and cancels it from the row", async () => {
    const signIn = new DeferredResponse();
    const url = "https://auth.example.com/oauth/authorize?state=1";
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignIn, () => signIn.promise).answer(MethodName.ProviderSignInCancel, () => null));
    const clipboard = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;

    button("nol-teamrun-provider-step button", row("Home")).click();
    await settle();
    expect([accountOf("Home"), texts("nol-teamrun-provider-step button", row("Home"))]).toEqual([Resources.signingInBrowserNote, ["Cancel"]]);
    context.emit(EventName.SignInLink, new SignInLinkPayload("a2", url).toJson());
    await settle();

    expect(texts(".nol-teamrun-step-note", row("Home"))).toEqual(["Didn't open?"]);
    expect(texts("nol-teamrun-provider-step button", row("Home"))).toEqual(["Copy link", "Open sign-in page", "Cancel"]);
    button(".nol-teamrun-step-copy-link", row("Home")).click();
    await settle();
    expect(clipboard.texts).toEqual([url]);
    button(".nol-teamrun-step-open-sign-in", row("Home")).click();
    await settle();
    expect(context.links).toEqual([url, url]);
    clipboard.answer = () => Promise.resolve(false);
    button(".nol-teamrun-step-copy-link", row("Home")).click();
    await settle();
    expect(texts(".nol-teamrun-error-text")).toEqual([Resources.signInLinkNotCopied]);
    expect(button(".nol-teamrun-step-cancel", row("Home")).getAttribute("aria-label")).toBe("Cancel sign-in Home");
    button(".nol-teamrun-step-cancel", row("Home")).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignInCancel)).providerId).toBe("a2");
  });

  it("opens a browser sign-in's page again with how the person opened it, a click, Ctrl+click or a middle click, and not with the right button", async () => {
    const url = "https://auth.example.com/oauth/authorize?state=1";
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignIn, () => new DeferredResponse().promise));
    button("nol-teamrun-provider-step button", row("Home")).click();
    await settle();
    context.emit(EventName.SignInLink, new SignInLinkPayload("a2", url).toJson());
    await settle();
    const open = button(".nol-teamrun-step-open-sign-in", row("Home"));

    open.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));
    open.dispatchEvent(new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true }));
    open.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    open.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    await settle();

    expect([context.links, context.linkGestures]).toEqual([Array(4).fill(url), [LinkGesture.Plain, LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle]]);
  });

  it("offers no Copy link beside a browser sign-in where the window has no clipboard", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ClipboardWriter, useValue: null }] });
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignIn, () => new DeferredResponse().promise));

    button("nol-teamrun-provider-step button", row("Home")).click();
    context.emit(EventName.SignInLink, new SignInLinkPayload("a2", "https://auth.example.com/").toJson());
    await settle();

    expect(texts("nol-teamrun-provider-step button", row("Home"))).toEqual(["Open sign-in page", "Cancel"]);
    expect([button(".nol-teamrun-step-open-sign-in", row("Home")).classList.contains("nol-button-outlined"), texts(".nol-teamrun-account-command", row("Home"))])
      .toEqual([true, []]);
  });

  it("shows a terminal sign-in's command only once its terminal's command is known, the adapter's own when it gives one", async () => {
    const command = new DeferredResponse();
    await withTerminalKinds(t => t.answer(MethodName.ProviderSignInCommand, () => command.promise));

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(accountOf("Desk")).toBe(Resources.signingInTerminalNote));
    expect([terminals.launches.length, texts(".nol-teamrun-account-command", row("Desk"))]).toEqual([0, []]);
    command.resolve(new ProviderSignInCommand("claude login --own", {}).toJson());

    await Wait.until(() => expect(texts(".nol-teamrun-account-command", row("Desk"))).toEqual(["claude login --own"]));
    expect(terminals.launches.map(({ request }) => request.command)).toEqual(["claude login --own"]);
  });

  it("says a terminal sign-in finishes in the terminal, and stops it from the row's Cancel", async () => {
    await withTerminalKinds();

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();
    expect([accountOf("Desk"), texts("nol-teamrun-provider-step button", row("Desk"))]).toEqual([Resources.signingInTerminalNote, ["Show terminal", "Cancel"]]);
    expect(texts(".nol-teamrun-account-command", row("Desk"))).toEqual(["claude auth login"]);
    expect([".nol-teamrun-step-show-terminal", ".nol-teamrun-step-cancel"].map(t => button(t, row("Desk")).classList.contains("nol-button-outlined")))
      .toEqual([true, false]);
    expect(button(".nol-teamrun-step-cancel", row("Desk")).classList).toContain("nol-button-text");
    button(".nol-teamrun-step-cancel", row("Desk")).click();
    await settle();

    expect(terminals.closes).toEqual([0]);
    expect([store.terminalSignIns().size, store.unfinishedSignIns().size]).toEqual([0, 0]);
  });

  it("says on the row when a terminal sign-in's terminal closed before its command ended, offers Sign in again, and forgets it once a new sign-in starts", async () => {
    await withTerminalKinds();

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    terminals.end(0, new TerminalEnd("Close", null));
    await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));
    await settle();

    expect([accountOf("Desk"), texts("nol-teamrun-provider-step button", row("Desk"))])
      .toEqual(["Sign-in didn't finish: the terminal closed before claude auth login ended.", ["Sign in again"]]);
    expect(row("Desk").querySelector(".nol-teamrun-status-dot")?.className).toBe(Resources.failedStatusDot);
    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(2));
    await settle();

    expect([store.unfinishedSignIns().size, accountOf("Desk")]).toEqual([0, Resources.signingInTerminalNote]);
  });

  it("shows a terminal sign-in's terminal under the rows in 16 rows and in no Terminals tab, titled with its provider, closes it from its ×, and shows and " +
    "focuses it again from the row", async () => {
    await withTerminalKinds();

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    expect([terminals.launches[0]?.request.opensTab, terminals.launches[0]?.request.minimumRows]).toEqual([false, null]);
    expect(embedded.opens.map(t => [t.sessionId, t.maximumRows])).toEqual([["terminal-1", 16]]);
    expect(texts(".nol-teamrun-sign-in-terminal .nol-teamrun-terminal-title")).toEqual(["Terminal · Sign in Desk · Claude Code"]);
    expect(texts(".nol-teamrun-sign-in-terminal .nol-teamrun-fake-terminal")).toEqual(["terminal-1"]);
    expect(texts("nol-teamrun-provider-step button", row("Desk"))).toEqual(["Show terminal", "Cancel"]);
    const top = element().querySelector(".nol-teamrun-sign-in-terminal")?.getBoundingClientRect().top ?? 0;
    expect(top).toBeGreaterThanOrEqual(element().querySelector(".nol-teamrun-your-providers .nol-teamrun-provider-list")?.getBoundingClientRect().bottom ?? Infinity);
    expect(button(".nol-teamrun-close-terminal").getAttribute("aria-label")).toBe("Close Sign in Desk · Claude Code");
    button(".nol-teamrun-close-terminal").click();
    await settle();

    expect([element().querySelector(".nol-teamrun-sign-in-terminal"), embedded.disposed]).toEqual([null, ["terminal-1"]]);
    expect(store.terminalSignIns().has("a6")).toBe(true);
    button(".nol-teamrun-step-show-terminal", row("Desk")).click();
    await settle();

    expect(texts(".nol-teamrun-sign-in-terminal .nol-teamrun-fake-terminal")).toEqual(["terminal-1"]);
    await Wait.until(() => expect(embedded.focused).toEqual(["terminal-1"]));
    terminals.end(0, new TerminalEnd("Close", null));
    await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));
    await settle();

    expect([element().querySelector(".nol-teamrun-sign-in-terminal"), store.terminalSessions().size]).toEqual([null, 0]);
  });

  it("says in the terminal's place that it can't show while Terminal is off in the window", async () => {
    embedded.refuse(new Error("Terminal isn't active in this window."));
    await withTerminalKinds();

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    expect(texts(".nol-teamrun-terminal-unavailable")).toEqual([Resources.terminalUnavailable]);
    expect(element().querySelector<HTMLElement>(".nol-teamrun-terminal-screen")?.hidden).toBe(true);
    button(".nol-teamrun-step-show-terminal", row("Desk")).click();
    await settle();
    expect(embedded.focused).toEqual([]);
  });

  it("opens a terminal in the page with Terminal's EmbeddedTerminal unless told otherwise", () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(ProviderTerminalComponent.opener)).toBe(EmbeddedTerminal);
  });

  it("keeps no terminal session for a sign-in whose terminal never opens", async () => {
    await withTerminalKinds();
    terminals.refuse(new Error("Terminal refused the launch."));

    button("nol-teamrun-provider-step button", row("Desk")).click();
    await settle();

    expect([store.terminalSessions().size, element().querySelector(".nol-teamrun-sign-in-terminal")]).toEqual([0, null]);
  });

  it("names on a used-up provider's row which limit it used up, in the warning line above its account, and keeps its plan and limits", async () => {
    await create(t => t.answer(MethodName.PlanUsageRead, () => new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 30, null),
      new PlanWindow(PlanWindowName.Weekly, 100, null)], "2026-10-22T09:00:00.000Z", "plus", true, null).toJson()));

    expect([texts(".nol-teamrun-account-warning", row("Work")), accountOf("Work")]).toEqual([["Weekly limit used up"], "Account not reported"]);
    expect([row("Work").querySelector(".nol-teamrun-account-failed"), row("Work").querySelector(`.${Resources.warningStatusDot.split(" ").join(".")}`)?.tagName])
      .toEqual([null, "SPAN"]);
    expect(texts(".nol-teamrun-limit-label", row("Work"))).toHaveLength(2);
    expect(texts(".nol-teamrun-plan-tag", row("Work"))).toEqual(["Plus"]);
  });

  it("cancels a sign-in from its row, and shows one that fails in the view's error line", async () => {
    const signIn = new DeferredResponse();
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
      .answer(MethodName.ProviderSignIn, () => signIn.promise)
      .answer(MethodName.ProviderSignInCancel, () => {
        signIn.resolve(home.toJson());
        return null;
      }));

    await startSignIn(row("Home"));
    await cancelSignIn(row("Home"));

    expect(context.count(MethodName.ProviderSignInCancel)).toBe(1);
    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignInCancel)).providerId).toBe("a2");
    expect(row("Home").querySelector(".nol-teamrun-step-cancel")).toBeNull();
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();

    context.fail(MethodName.ProviderSignIn, "The browser did not open.");
    await startSignIn(row("Home"));

    expect(texts(".nol-teamrun-error-text")).toEqual(["The browser did not open."]);
    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Home"));
  });

  it("shows a kind's install on its heading with its percent and Cancel, leaves its providers' rows as they were, and offers Sign in once it's installed",
    async () => {
    await createWithInstall(installation(ProviderKindInstallState.NotInstalled), t => t.answer(MethodName.ProviderKindInstallCancel, () => null));

    expect([statusOf("Space"), accountOf("Space")]).toEqual([Resources.notInstalledLabel, Resources.notInstalledLabel]);
    expect(element().querySelectorAll(".nol-teamrun-install, .nol-teamrun-update, .nol-teamrun-cancel-install, .nol-teamrun-install-line")).toHaveLength(0);
    expect(await offersSignIn(row("Space"))).toBe(false);
    expect(signInOff(row("Home"))).toBe(false);
    context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.Installing).toJson());
    await settle();
    expect([headNote("antigravity"), installLines()]).toEqual([["Installing… 0%"], []]);
    context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.Installing, null, 420, 1000).toJson());
    await settle();

    expect(headNote("antigravity")).toEqual(["Installing… 42%"]);
    expect(accountOf("Space")).toBe(Resources.providerStatusLabels[AuthStatus.Unknown]);
    expect(await offersSignIn(row("Space"))).toBe(false);
    const cancel = button(".nol-teamrun-cancel-install", headOf("antigravity"));
    expect([cancel.textContent?.trim(), cancel.getAttribute("aria-label")]).toEqual(["Cancel", "Cancel Antigravity"]);
    cancel.click();
    await settle();
    expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstallCancel)).kind).toBe("antigravity");
    context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.Installed).toJson());
    await settle();

    expect([headNote("antigravity"), headActions("antigravity"), statusOf("Space")]).toEqual([[], [], Resources.providerStatusLabels[AuthStatus.Unknown]]);
    expect(await offOf([".nol-teamrun-sign-in"], row("Space"))).toEqual([false]);
  });

  it("shows a type's update on its heading while its providers keep their accounts, plans and limits, with no Cancel once it is setting up", async () => {
    providers = [subscribed("b1", "claude", "Max", new ProviderIdentity("dev@example.com", "max")),
      subscribed("d2", "claude", "Personal", new ProviderIdentity("agent-1@example.com", "max"))];
    await create(t => t.answer(MethodName.PlanUsageRead, parameters => new PlanUsage("claude", PlanUsageParams.fromJson(parameters).providerId,
      [new PlanWindow(PlanWindowName.FiveHour, 42, null)], "2026-10-22T09:00:00.000Z").toJson()));
    context.emit(EventName.ProviderKindInstallationChanged,
      new ProviderKindInstallation("claude", ProviderKindInstallState.Installing, null, 1000, 1000, "2.1.0", null, false).toJson());
    await settle();

    expect([headNote("claude"), headActions("claude"), installLines()]).toEqual([["Updating… setting up"], [], []]);
    expect([accountOf("Max"), accountOf("Personal")]).toEqual(["dev@example.com", "agent-1@example.com"]);
    expect([texts(".nol-teamrun-plan-tag", row("Max")), texts(".nol-teamrun-meter-text", row("Personal"))]).toEqual([["Max"], ["58% left"]]);
    expect(announced()).toEqual(["Claude Code: Updating…"]);
  });

  it("shows a provider that runs a chosen server as checked, not Not installed, and says in its details which server it runs", async () => {
    providers.push(new Provider("a9", "antigravity", "Chosen", "D:\\profiles\\chosen", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp, true, false,
      "D:\\agy\\agy_acp_server.exe"), new Provider("a10", "antigravity", "Out", "D:\\profiles\\out", AuthStatus.LoggedOut, null, null, null, null,
      SampleData.timestamp, true, false, "D:\\agy\\agy_acp_server.exe"));
    await createWithInstall(installation(ProviderKindInstallState.NotInstalled));
    const account = button(".nol-teamrun-account", row("Chosen"));

    expect([statusOf("Space"), statusOf("Chosen")]).toEqual([Resources.notInstalledLabel, Resources.providerStatusLabels[AuthStatus.Unknown]]);
    expect([await offersSignIn(row("Space")), await offersSignIn(row("Chosen")), row("Out").querySelector(".nol-teamrun-step-sign-in") !== null])
      .toEqual([false, true, true]);
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe([Resources.providerStatusLabels[AuthStatus.Unknown], "Profile folder: D:\\profiles\\chosen", "Runs D:\\agy\\agy_acp_server.exe"]
        .join(Resources.titleSeparator)));
    await userEvent.unhover(account);
  });

  it("names the compatible server on PATH that a kind counts as installed in its providers' details, and says why another doesn't count", async () => {
    await createWithInstall(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.3.1", null, true, null,
      "/usr/local/bin/agy_acp_server.par"));
    const account = button(".nol-teamrun-account", row("Space"));

    expect(statusOf("Space")).toBe(Resources.providerStatusLabels[AuthStatus.Unknown]);
    expect(element().querySelector(".nol-teamrun-install")).toBeNull();
    expect(await offOf([".nol-teamrun-sign-in"], row("Space"))).toEqual([false]);
    await userEvent.hover(account);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe([Resources.providerStatusLabels[AuthStatus.Unknown], "Profile folder: D:\\profiles\\antigravity", "Runs /usr/local/bin/agy_acp_server.par"]
        .join(Resources.titleSeparator)));
    await userEvent.unhover(account);
    context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.NotInstalled, "The server on PATH is 1.4.0.").toJson());
    await settle();

    expect([statusOf("Space"), accountOf("Space")]).toEqual([Resources.notInstalledLabel, "The server on PATH is 1.4.0."]);
  });

  it("says why a kind can't be installed here, and why its last install failed, in the account's place", async () => {
    await createWithInstall(installation(ProviderKindInstallState.Unavailable, "Installing Antigravity needs unzip, which this computer does not have."));

    expect([statusOf("Space"), accountOf("Space")]).toEqual([Resources.notInstalledLabel, "Installing Antigravity needs unzip, which this computer does not have."]);
    expect(row("Space").querySelector(".nol-teamrun-account-failed")).not.toBeNull();
    expect(element().querySelector(".nol-teamrun-install")).toBeNull();
    expect(await offersSignIn(row("Space"))).toBe(false);
    context.emit(EventName.ProviderKindInstallationChanged, installation(ProviderKindInstallState.NotInstalled, "The download failed its check.").toJson());
    await settle();

    expect([statusOf("Space"), accountOf("Space")]).toEqual([Resources.notInstalledLabel, "The download failed its check."]);
  });

  it("heads a kind TeamRun installed with its update and Update to <n>, updates it from there, and says a kind it found on the computer updates on its own",
    async () => {
      providers.push(signedIn("c3", "codex", "Overnight builds"), spaceProvider);
      const updating = new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installing, null, 0, 0, "1.20.0", null);
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [
          new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", "1.21.0").toJson(),
          new ProviderKindInstallation("codex", ProviderKindInstallState.Installed, null, 0, 0, "0.166.0", null, true, null, "/opt/homebrew/bin/codex").toJson(),
          new ProviderKindInstallation("grok", ProviderKindInstallState.Installed, null, 0, 0, "1.0.4", null).toJson()])
        .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(), new ProviderTool("grok", true, "1.0.4").toJson()])
        .answer(MethodName.ProviderKindInstall, () => updating.toJson()));
      const update = button(".nol-teamrun-update", headOf("antigravity"));

      expect([headNote("antigravity"), headActions("antigravity"), update.getAttribute("aria-label")])
        .toEqual([["version 1.21.0 is available"], ["Update to 1.21.0"], "Update to 1.21.0 Antigravity"]);
      expect([headNote("codex"), headActions("codex"), headNote("grok"), headActions("grok")]).toEqual([["updates on its own"], [], [], []]);
      context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("grok", ProviderKindInstallState.Installed, null, 0, 0, "1.0.4", null, true,
        null, "D:\\tools\\grok\\grok.exe").toJson());
      await settle();
      expect([headNote("grok"), headActions("grok")]).toEqual([["updates on its own"], []]);
      update.click();
      await settle();

      expect(ProviderKindParams.fromJson(context.parametersOf(MethodName.ProviderKindInstall)).kind).toBe("antigravity");
      expect([headNote("antigravity"), headActions("antigravity"), installLines()]).toEqual([["Updating… 0%"], ["Cancel"], []]);
      context.emit(EventName.ProviderKindInstallationChanged,
        new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, "The download failed its check.", 0, 0, "1.20.0", "1.21.0").toJson());
      await settle();
      expect([headNote("antigravity"), accountOf("Space")]).toEqual([["version 1.21.0 is available"], "The download failed its check."]);
    });

  it("says under Your providers where and when TeamRun looks for newer tools, and looks from Check for updates, off and busy while it looks, showing what it finds",
    async () => {
      const checked = new DeferredResponse();
      providers.push(spaceProvider);
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [
          new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", null).toJson()])
        .answer(MethodName.ProviderKindInstallationCheck, () => checked.promise));
      const check = button(".nol-teamrun-your-providers .nol-teamrun-update-checks .nol-teamrun-check-updates");

      expect([texts(".nol-teamrun-your-providers .nol-teamrun-update-checks-note"), check.textContent?.trim(), check.disabled, headNote("antigravity")])
        .toEqual([[Resources.toolUpdateChecksNote], Resources.checkUpdatesLabel, false, []]);
      expect(element().querySelector(".nol-teamrun-update-checks")?.getAttribute("role")).toBe("note");
      check.click();
      await settle();
      expect([context.count(MethodName.ProviderKindInstallationCheck), check.disabled, check.getAttribute("aria-busy")]).toEqual([1, true, "true"]);
      checked.resolve([new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", "1.21.0").toJson()]);
      await settle();

      expect([check.disabled, check.getAttribute("aria-busy"), headNote("antigravity")]).toEqual([false, null, ["version 1.21.0 is available"]]);
    });

  it("shows a failed Check for updates in the view's error line and keeps what it listed", async () => {
    providers.push(spaceProvider);
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => [
        new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", "1.21.0").toJson()])
      .fail(MethodName.ProviderKindInstallationCheck, "The release channel didn't answer."));

    button(".nol-teamrun-check-updates").click();
    await settle();

    expect([texts(".nol-teamrun-error-text"), headNote("antigravity"), button(".nol-teamrun-check-updates").disabled])
      .toEqual([["The release channel didn't answer."], ["version 1.21.0 is available"], false]);
  });

  it("shows the install of a kind with no provider once, on a line atop Your providers, with its percent and Cancel", async () => {
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
      .answer(MethodName.ProviderKindInstallationList, () => [installation(ProviderKindInstallState.Installing, null, 420, 1000).toJson()]));

    expect(installLines()).toEqual(["Installing Antigravity… 42%"]);
    expect(texts(".nol-teamrun-install-line .nol-teamrun-cancel-install")).toEqual(["Cancel"]);
    expect(element().querySelector(".nol-teamrun-group-head[data-kind=\"antigravity\"]")).toBeNull();
  });

  it("offers Sign in on a signed-out provider in its row, on an unknown one in its menu, and on a signed-in one nowhere", async () => {
    providers.push(signedIn("a8", "grok", "Lounge"),
      new Provider("a9", "grok", "Gate", "D:\\profiles\\grok-a9", AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null, SampleData.timestamp),
      new Provider("a10", "grok", "Fresh", "D:\\profiles\\grok-a10", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()]));

    const offered = [await offersSignIn(row("Lounge")), await offersSignIn(row("Gate")),
      await offersSignIn(row("Fresh"))];

    expect(offered).toEqual([false, true, true]);
    expect([await offers(".nol-teamrun-sign-in", row("Gate")), await offers(".nol-teamrun-sign-in", row("Fresh"))]).toEqual([false, true]);
    expect(await actions(row("Lounge"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    expect([await actions(row("Gate")), texts("nol-teamrun-provider-step button", row("Gate"))]).toEqual([["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"], ["Sign in"]]);
  });

  it("keeps Sign in on a signed-in provider whose kind knows its sign-in only once a prompt runs, as an added ACP agent's does", async () => {
    const devin = new ProviderKind("devin", "Devin", true, true, null, null, false, null, false, null, false, null, null, false, true);
    providers.push(signedIn("a8", "devin", "Agent"), signedIn("a9", "grok", "Lounge"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), devin.toJson()]));

    expect([await offers(".nol-teamrun-sign-in", row("Agent")), await offersSignIn(row("Lounge"))]).toEqual([true, false]);
    expect(await offOf([".nol-teamrun-sign-in"], row("Agent"))).toEqual([false]);
  });

  it("shows Sign out disabled, with the reason on hover, on a signed-in provider whose cell says it can't sign out, and none while it's signed out", async () => {
    const pi = new ProviderKind("pi", "Pi", true, true, null, null, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.SignOut]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }));
    providers.push(signedIn("a8", "pi", "Desk"), new Provider("a9", "pi", "Spare", "D:\\profiles\\pi-a9", AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null,
      SampleData.timestamp));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), pi.toJson()]));
    const signOut = await item(".nol-teamrun-sign-out", row("Desk"));

    expect(isOff(signOut)).toBe(true);
    await userEvent.hover(signOut);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe("Pi can't sign out here: TeamRun doesn't support this for it yet."));
    signOut.click();
    await settle();
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
    await userEvent.unhover(signOut);
    await close();
    expect(await offers(".nol-teamrun-sign-out", row("Spare"))).toBe(false);
  });

  it("says why Sign out is disabled when the keyboard reaches it in a provider's menu", async () => {
    const pi = new ProviderKind("pi", "Pi", true, true, null, null, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.SignOut]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }));
    providers.push(signedIn("a8", "pi", "Desk"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), pi.toJson()]));
    button(".nol-teamrun-row-menu", row("Desk")).focus();
    await userEvent.keyboard("{Enter}");
    await Wait.until(() => expect(menu()?.contains(document.activeElement)).toBe(true));
    opened = row("Desk");
    for (let step = 0; step < 12 && document.activeElement?.classList.contains("nol-teamrun-sign-out") !== true; step++)
      await userEvent.keyboard("{ArrowDown}");

    expect(document.activeElement?.classList).toContain("nol-teamrun-sign-out");
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim())
      .toBe("Pi can't sign out here: TeamRun doesn't support this for it yet."));
    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
    expect(menu()).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    opened = null;
    await Wait.until(() => expect(menu()).toBeNull());
  });

  it("shows no disabled Sign out while a signed-in provider that can't sign out here signs in again", async () => {
    const signIn = new DeferredResponse();
    const devin = new ProviderKind("devin", "Devin", true, true, null, null, false, null, false, null, false, null,
      SampleData.abilities({ [ProviderAbility.SignOut]: AbilityCell.notBuilt("TeamRun doesn't support this for it yet") }), false, true);
    const agent = signedIn("a8", "devin", "Agent");
    providers.push(agent);
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), devin.toJson()])
      .answer(MethodName.ProviderSignIn, () => signIn.promise));

    expect(await offers(".nol-teamrun-sign-out", row("Agent"))).toBe(true);
    await choose(".nol-teamrun-sign-in", row("Agent"));

    expect([await actions(row("Agent")), texts("nol-teamrun-provider-step button", row("Agent"))]).toEqual([["Edit…", "Show profile folder", "Disable", "Remove…"], ["Cancel"]]);
    signIn.resolve(agent.withCheck(AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null).toJson());
    await settle();
  });

  it("offers Sign out only on a signed-in provider whose provider signs out, signs it out once the person confirms, with the actions off meanwhile, and shows it " +
    "signed out", async () => {
    const signedOut = new DeferredResponse();
    await withSignOut(t => t.answer(MethodName.ProviderSignOut, () => signedOut.promise));

    expect([await offers(".nol-teamrun-sign-out", row("Work")), await offers(".nol-teamrun-sign-out", row("Home"))]).toEqual([false, false]);
    expect(await actions(row("Lounge"))).toEqual(["Sign out", "Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
    await choose(".nol-teamrun-sign-out", row("Lounge"));

    expect(document.querySelector(".nol-dialog-title")?.textContent).toBe("Sign out");
    expect(document.body.textContent).toContain("Sign out of “Lounge”? Grok CLI forgets its sign-in in this connection's profile folder, so a reply it's running now " +
      "may fail, and teammates using this connection can't reply until it signs in again.");
    expect(document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()).toBe("Sign out");

    button(".nol-teamrun-cancel", document).click();
    await settle();

    expect(context.count(MethodName.ProviderSignOut)).toBe(0);

    await choose(".nol-teamrun-sign-out", row("Lounge"));
    button(".nol-teamrun-confirm", document).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignOut)).providerId).toBe("a8");
    expect(await offOf([".nol-teamrun-sign-out", ".nol-teamrun-edit", ".nol-teamrun-check", ".nol-teamrun-disable", ".nol-teamrun-remove"],
      row("Lounge"))).toEqual([true, true, true, true, true]);

    signedOut.resolve(providers.find(t => t.id === "a8")!.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null).toJson());
    await settle();

    expect(statusOf("Lounge")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedOut]);
    expect(await offers(".nol-teamrun-sign-out", row("Lounge"))).toBe(false);
    expect(signInOff(row("Lounge"))).toBe(false);
    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
  });

  it("keeps a provider signed in, with Sign out, and shows why in the view's error line when its sign-out fails", async () => {
    await withSignOut();
    context.fail(MethodName.ProviderSignOut, "\"Lounge\" is still signed in after signing out: its tool keeps another sign-in, such as an API key.");

    await choose(".nol-teamrun-sign-out", row("Lounge"));
    button(".nol-teamrun-confirm", document).click();
    await settle();

    expect(texts(".nol-teamrun-error-text")).toEqual(["\"Lounge\" is still signed in after signing out: its tool keeps another sign-in, such as an API key."]);
    expect(statusOf("Lounge")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
    expect(await offOf([".nol-teamrun-sign-out"], row("Lounge"))).toEqual([false]);
  });

  it("opens Copilot's own session in TeamRun's terminal with the connection's profile to sign out, names the shared keychain, and shows it signing out there",
    async () => {
      await withSignOut(t => t.answer(MethodName.ProviderCheck, u => {
        const id = ProviderIdParams.fromJson(u).providerId;
        providers = providers.map(v => v.id === id ? v.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null) : v);
        return providers.find(v => v.id === id)!.toJson();
      }));

      await choose(".nol-teamrun-sign-out", row("Wing"));

      expect([document.querySelector(".nol-dialog-title")?.textContent, document.querySelector("nol-dialog p")?.textContent,
        document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()]).toEqual(["Sign out", "GitHub Copilot signs “Wing” out only in its own session. TeamRun " +
        "opens it in a terminal with this connection's profile folder, D:\\profiles\\copilot-a9, where you type /logout, then leave it. GitHub Copilot may keep its " +
        "sign-in in this computer's keychain, which other connections can share, so they may sign out too, and a reply running now may fail.", "Open terminal"]);
      button(".nol-teamrun-confirm", document).click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      expect([terminals.launches[0]?.request.command, terminals.launches[0]?.request.environment]).toEqual(["copilot", { COPILOT_HOME: "D:\\profiles\\copilot-a9" }]);
      expect([accountOf("Wing")]).toEqual([Resources.signingOutLabel]);
      expect(await actions(row("Wing"))).toEqual(["Stop sign-out", "Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
      expect(await offOf([".nol-teamrun-edit"], row("Wing"))).toEqual([true]);
      expect(context.count(MethodName.ProviderSignOut)).toBe(0);
      const note = liveNote(Resources.signingOutLabel);
      await spoken(Resources.formatLiveStatus("Wing", Resources.signingOutLabel));
      await userEvent.hover(note);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toContain(Resources.terminalSigningOutHint));
      await userEvent.unhover(note);

      terminals.endCommand(0, 0);
      await Wait.until(() => expect(terminals.closes).toEqual([0]));
      await settle();

      expect(statusOf("Wing")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedOut]);
      expect([await offers(".nol-teamrun-sign-out", row("Wing")), await offers(".nol-teamrun-stop-sign-out", row("Wing"))]).toEqual([false, false]);
      expect(signInOff(row("Wing"))).toBe(false);
      expect(context.count(MethodName.ProviderSignOut)).toBe(0);
    });

  it("runs a kind's own sign-out command in TeamRun's terminal, says the sign-out ends with it, and then shows what the check finds", async () => {
    providers.push(signedIn("a9", "copilot", "Wing"));
    const byCommand = new ProviderKind("copilot", "GitHub Copilot", true, false, null, copilot.profile, false, "copilot logout", true);
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), byCommand.toJson()])
      .answer(MethodName.ProviderCheck, u => providers.find(v => v.id === ProviderIdParams.fromJson(u).providerId)!.toJson()));

    await choose(".nol-teamrun-sign-out", row("Wing"));

    expect(document.querySelector("nol-dialog p")?.textContent)
      .toBe(Resources.formatSignOutByCommand("Wing", "GitHub Copilot", "copilot logout", "D:\\profiles\\copilot-a9"));
    button(".nol-teamrun-confirm", document).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    expect([terminals.launches[0]?.request.command, terminals.launches[0]?.request.notice, accountOf("Wing")])
      .toEqual(["copilot logout", Resources.terminalSignOutCommandNotice, Resources.signingOutLabel]);
    const note = liveNote(Resources.signingOutLabel);
    await spoken(Resources.formatLiveStatus("Wing", Resources.signingOutLabel));
    await userEvent.hover(note);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toContain(Resources.terminalSigningOutCommandHint));
    await userEvent.unhover(note);

    terminals.endCommand(0, 0);
    await Wait.until(() => expect(terminals.closes).toEqual([0]));
    await settle();

    expect(statusOf("Wing")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedIn]);
    expect(await offOf([".nol-teamrun-sign-out"], row("Wing"))).toEqual([false]);
  });

  it("signs Antigravity out through TeamRun, with no terminal, and shows it signed out", async () => {
    await withSignOut();
    await choose(".nol-teamrun-sign-out", row("Orbit"));

    expect(document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()).toBe(Resources.signOutLabel);
    button(".nol-teamrun-confirm", document).click();
    await settle();

    expect(ProviderIdParams.fromJson(context.parametersOf(MethodName.ProviderSignOut)).providerId).toBe("a10");
    expect(terminals.launches).toHaveLength(0);
    expect(statusOf("Orbit")).toBe(Resources.providerStatusLabels[AuthStatus.LoggedOut]);
  });

  it("warns before signing Cursor out on a Mac that its sign-in is the keychain's, shared with the person's own Cursor CLI", async () => {
    const cursor = new ProviderKind("cursor", "Cursor", true, false, null, new ProviderProfile("CURSOR_DATA_DIR", null, "/profiles/cursor"), true, null, false,
      "Cursor keeps its sign-in in this Mac's keychain, which every Cursor profile shares, so TeamRun takes one Cursor provider per Mac.");
    providers.push(signedIn("a11", "cursor", "Studio"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), cursor.toJson()]));
    await choose(".nol-teamrun-sign-out", row("Studio"));

    expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe("Sign out of “Studio”? Cursor keeps its sign-in in this computer's " +
      "keychain, shared with your own Cursor CLI, so this signs your Cursor CLI out too, and signing in again replaces its sign-in. A reply it's running " +
      "now may fail, and teammates using this connection can't reply until it signs in again.");
    expect(document.querySelector(".nol-teamrun-confirm")?.textContent?.trim()).toBe(Resources.signOutLabel);
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("warns before signing out an added ACP agent, which keeps one sign-in in the person's home, that it signs their own copy out too", async () => {
    const droid = new ProviderKind("droid", "Droid", true, true, null, null, true, null, false,
      "Droid runs in your home folder with the one sign-in it keeps there, so TeamRun takes one Droid provider.");
    providers.push(signedIn("a14", "droid", "Factory"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), droid.toJson()]));
    await choose(".nol-teamrun-sign-out", row("Factory"));

    expect(document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim()).toBe(Resources.formatSignOutPersonal("Factory", "Droid"));
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("reads Claude Code's person folder again before warning about a sign-out, so the folder the environment names after the listing gets the warning, " +
    "trailing separator and all", async () => {
    let usual = "D:\\profiles\\claude-a15";
    const claude = (): ProviderKind => new ProviderKind("claude", "Claude Code", true, false, null,
      new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", usual, null, {}, {}, [usual]), true);
    providers.push(signedIn("a15", "claude", "Usual"), signedIn("a16", "claude", "Added"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude().toJson()]));
    usual = "D:\\profiles\\claude-a16\\";
    const message = async (label: string): Promise<string | undefined> => {
      await choose(".nol-teamrun-sign-out", row(label));
      await Wait.until(() => expect(document.querySelector("nol-teamrun-confirm-dialog p")).not.toBeNull());
      const text = document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim();
      button(".nol-teamrun-cancel", document).click();
      await settle();
      return text;
    };

    expect(await message("Usual")).toBe(Resources.formatSignOut("Usual", "Claude Code"));
    expect(await message("Added")).toBe(Resources.formatSignOutPersonal("Added", "Claude Code"));
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("reports a sign-out whose read of the provider types fails, opening no dialog and signing nothing out", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login",
      "D:\\profiles\\claude-a15", null, {}, {}, ["D:\\profiles\\claude-a15"]), true);
    providers.push(signedIn("a15", "claude", "Usual"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]));
    context.fail(MethodName.ProviderKindList, "The runtime is restarting.");

    await choose(".nol-teamrun-sign-out", row("Usual"));
    await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual([Resources.signOutKindsNotRead, Resources.kindsUnavailableForProviders]));

    expect(document.querySelector("nol-teamrun-confirm-dialog")).toBeNull();
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("warns before signing Claude Code out in its usual folder that it signs the person's own Claude Code out too, and not for one with its own folder", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", "D:\\profiles\\claude-a15",
      null, {}, {}, ["D:\\profiles\\claude-a15"]), true);
    providers.push(signedIn("a15", "claude", "Usual"), signedIn("a16", "claude", "Added"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson()]));
    const message = async (label: string): Promise<string | undefined> => {
      await choose(".nol-teamrun-sign-out", row(label));
      const text = document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim();
      button(".nol-teamrun-cancel", document).click();
      await settle();
      return text;
    };

    expect(await message("Usual")).toBe(Resources.formatSignOutPersonal("Usual", "Claude Code"));
    expect(await message("Added")).toBe(Resources.formatSignOut("Added", "Claude Code"));
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("warns before signing Grok out in the person's own Grok home that it signs their Grok CLI out too, and not for a Grok with its own folder", async () => {
    const grok = new ProviderKind("grok", "Grok", true, true, null, new ProviderProfile("GROK_HOME", null, "D:\\person\\.grok", null, {}, {},
      ["D:\\person\\.grok", "D:\\profiles\\grok-a12"]), true);
    providers.push(signedIn("a12", "grok", "Own"), signedIn("a13", "grok", "Added"));
    await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()]));
    const message = async (label: string): Promise<string | undefined> => {
      await choose(".nol-teamrun-sign-out", row(label));
      const text = document.querySelector("nol-teamrun-confirm-dialog p")?.textContent?.trim();
      button(".nol-teamrun-cancel", document).click();
      await settle();
      return text;
    };

    expect(await message("Own")).toBe("Sign out of “Own”? It runs in your own Grok home with its sign-in, shared with your own Grok CLI, so this signs " +
      "your Grok CLI out too, and signing in again replaces its sign-in. A reply it's running now may fail, and teammates using this connection can't " +
      "reply until it signs in again.");
    expect(await message("Added")).toBe(Resources.formatSignOut("Added", "Grok"));
    expect(context.count(MethodName.ProviderSignOut)).toBe(0);
  });

  it("stops a terminal sign-out from its menu, closing the terminal without a check and bringing Sign out back", async () => {
    await withSignOut();
    await choose(".nol-teamrun-sign-out", row("Wing"));
    button(".nol-teamrun-confirm", document).click();
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    await choose(".nol-teamrun-stop-sign-out", row("Wing"));
    await Wait.until(() => expect(terminals.closes).toEqual([0]));
    await settle();

    expect(await offOf([".nol-teamrun-sign-out"], row("Wing"))).toEqual([false]);
    expect([Resources.signingInLabel, Resources.signingOutLabel]).not.toContain(statusOf("Wing"));
    expect(context.count(MethodName.ProviderCheck)).toBe(0);
  });

  it("hides Sign out while its provider signs in, in TeamRun or in a terminal, and brings it back once the sign-in ends", async () => {
    const signedIn = new DeferredResponse();
    await withSignOut(t => t.answer(MethodName.ProviderSignIn, () => signedIn.promise));

    const signingIn = store.signInProvider("a8");
    const terminalSignIn = store.signInProvider("a9");
    await Wait.until(() => expect(terminals.launches).toHaveLength(1));
    await settle();

    expect([store.signingIn().has("a8"), store.terminalSignIns().has("a9")]).toEqual([true, true]);
    expect([await offers(".nol-teamrun-sign-out", row("Lounge")), await offers(".nol-teamrun-sign-out", row("Wing"))]).toEqual([false, false]);

    signedIn.resolve(providers.find(t => t.id === "a8")!.toJson());
    await store.stopTerminalSignIn("a9");
    await Promise.all([signingIn, terminalSignIn]);
    await settle();

    expect([await offOf([".nol-teamrun-sign-out"], row("Lounge")), await offOf([".nol-teamrun-sign-out"], row("Wing"))]).toEqual([[false], [false]]);
  });

  it("shows a kind's update on its heading, then why it failed in its providers' account place until a later state clears it", async () => {
    const updatable = (state: ProviderKindInstallState, reason: string | null = null, received: number = 0, total: number = 0,
      next: string | null = "1.4.0"): ProviderKindInstallation => new ProviderKindInstallation("antigravity", state, reason, received, total, "1.3.0", next);
    await createWithInstall(updatable(ProviderKindInstallState.Installed));

    expect([headNote("antigravity"), headActions("antigravity")]).toEqual([["version 1.4.0 is available"], ["Update to 1.4.0"]]);
    context.emit(EventName.ProviderKindInstallationChanged, updatable(ProviderKindInstallState.Installing, null, 420, 1000, null).toJson());
    await settle();

    expect([headNote("antigravity"), installLines(), accountOf("Space")]).toEqual([["Updating… 42%"], [], Resources.providerStatusLabels[AuthStatus.Unknown]]);
    context.emit(EventName.ProviderKindInstallationChanged, updatable(ProviderKindInstallState.Installed, "The download failed its check.").toJson());
    await settle();

    expect([headNote("antigravity"), statusOf("Space"), accountOf("Space")])
      .toEqual([["version 1.4.0 is available"], Resources.providerStatusLabels[AuthStatus.Unknown], "The download failed its check."]);
    expect(row("Space").querySelector(".nol-teamrun-account-failed")).not.toBeNull();
    context.emit(EventName.ProviderKindInstallationChanged, updatable(ProviderKindInstallState.Installed, null, 0, 0, null).toJson());
    await settle();

    expect(row("Space").querySelector(".nol-teamrun-account-failed")).toBeNull();
  });

  it("lists the installations again when it opens, so an update found since shows in Add provider", async () => {
    let listed = 0;
    const later = new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.3.0", "1.4.0");
    await createWithInstall(installation(ProviderKindInstallState.Installed), t => t.answer(MethodName.ProviderKindInstallationList, () =>
      [(listed++ === 0 ? new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.3.0", null) : later).toJson()]));

    await Wait.until(() => expect(store.installations().get("antigravity")?.toJson()).toEqual(later.toJson()));
  });

  it("calls no provider unavailable while no provider list has loaded, names their kinds by id, says so with Retry, and loads them on Retry", async () => {
    providers.push(retired);
    await createWithoutProviders();
    context.emit(EventName.StateInvalidated, null);
    await settle();

    expect(texts(".nol-teamrun-item-name")).toEqual(["Work", "Home", "Old"]);
    expect([kindOf("Home"), kindOf("Old"), kindOf("Work")]).toEqual(["grok", "gemini", "codex"]);
    expect(statusOf("Old")).not.toBe(Resources.unsupportedProviderLabel);
    expect(texts(".nol-teamrun-kinds-failed .nol-teamrun-error-text")).toEqual([Resources.kindsUnavailableForProviders]);
    expect(await actions(row("Work"))).toEqual(["Show profile folder", "Remove…"]);

    listedKinds = [SampleData.codex, SampleData.claude, grok];
    button(".nol-teamrun-retry-kinds").click();
    await settle();

    expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
    expect([kindOf("Home"), kindOf("Old"), kindOf("Work")]).toEqual(["Grok CLI", "gemini", "Codex"]);
    expect(statusOf("Old")).toBe(Resources.unsupportedProviderLabel);
    expect(await actions(row("Work"))).toEqual(["Edit…", "Check again", "Show profile folder", "Disable", "Remove…"]);
  });

  it("asks for the providers once when a resync comes while Retry loads them, and keeps the list that loads", async () => {
    await createWithoutProviders();
    await settle();
    const kinds = new DeferredResponse();
    context.answer(MethodName.ProviderKindList, () => kinds.promise);
    const asked = context.count(MethodName.ProviderKindList);

    button(".nol-teamrun-retry-kinds").click();
    await settle();
    context.emit(EventName.StateResyncRequested, null);
    await settle();
    kinds.resolve([SampleData.codex.toJson(), SampleData.claude.toJson(), grok.toJson()]);
    await settle();

    expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);
    expect(store.kindsFailed()).toBe(false);
    expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
    expect(kindOf("Home")).toBe("Grok CLI");
  });

  it("shows one alert for providers that failed to load, with the app's notice that they did, and neither once Retry loads them", async () => {
    await createWithoutProviders();
    await settle();

    expect(element().querySelectorAll("[role=alert]")).toHaveLength(1);
    expect(texts(".nol-teamrun-error-text")).toEqual([Resources.kindsUnavailableForProviders]);
    expect(context.shownNotices(Resources.loadFailedNotice).map(t => t.key)).toEqual([Resources.formatNoticeKey(store.windowId, Resources.kindsLoad)]);

    listedKinds = [SampleData.codex, SampleData.claude, grok];
    button(".nol-teamrun-retry-kinds").click();
    await settle();

    expect(element().querySelectorAll("[role=alert]")).toHaveLength(0);
    expect(context.shownNotices()).toEqual([]);
  });

  it("dismisses the notice that the providers failed to load once a resync loads them", async () => {
    await createWithoutProviders();
    await settle();
    expect(context.shownNotices(Resources.loadFailedNotice)).toHaveLength(1);
    listedKinds = [SampleData.codex, SampleData.claude, grok];

    context.emit(EventName.StateResyncRequested, null);
    await settle();

    expect(context.shownNotices()).toEqual([]);
  });

  it("marks Retry busy while it loads the providers, and asks for them once however often it is pressed", async () => {
    await createWithoutProviders();
    await settle();
    const kinds = new DeferredResponse();
    context.answer(MethodName.ProviderKindList, () => kinds.promise);
    const asked = context.count(MethodName.ProviderKindList);

    button(".nol-teamrun-retry-kinds").click();
    await settle();
    expect(button(".nol-teamrun-retry-kinds").getAttribute("aria-disabled")).toBe("true");
    button(".nol-teamrun-retry-kinds").click();
    await settle();

    expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);
    kinds.resolve([SampleData.codex.toJson(), SampleData.claude.toJson(), grok.toJson()]);
    await settle();
    expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
    expect(context.count(MethodName.ProviderKindList)).toBe(asked + 1);
  });

  it("loads the providers again on a resync after they failed to load", async () => {
    providers.push(retired);
    await createWithoutProviders();
    listedKinds = [SampleData.codex, SampleData.claude, grok];

    context.emit(EventName.StateResyncRequested, null);
    await settle();

    expect(context.count(MethodName.ProviderKindList)).toBe(2);
    expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
    expect(kindOf("Home")).toBe("Grok CLI");
    expect(statusOf("Old")).toBe(Resources.unsupportedProviderLabel);
  });

  it("shows a failed change on the page, not as a notice, until the person dismisses it", async () => {
    await create(t => t.fail(MethodName.ProviderCheck, "codex was not found"));

    await choose(".nol-teamrun-check", row("Work"));

    expect(texts(".nol-teamrun-error-text")).toEqual(["codex was not found"]);
    expect(texts(".nol-teamrun-dismiss")).toEqual(["Dismiss"]);
    expect(context.shownNotices()).toEqual([]);

    button(".nol-teamrun-dismiss").click();
    await settle();

    expect(element().querySelector(".nol-teamrun-error")).toBeNull();
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
    const style = (target: Element): CSSStyleDeclaration => getComputedStyle(target);
    const lookOf = (css: string, property: keyof CSSStyleDeclaration): string => {
      const probe = element().appendChild(document.createElement("span"));
      probe.style.cssText = `display: block; ${css}`;
      const value = String(getComputedStyle(probe)[property]);
      probe.remove();
      return value;
    };
    const content = (target: HTMLElement): { left: number; right: number } =>
      ({ left: box(target).left + Number.parseFloat(style(target).borderLeftWidth) + Number.parseFloat(style(target).paddingLeft),
        right: box(target).right - Number.parseFloat(style(target).borderRightWidth) - Number.parseFloat(style(target).paddingRight) });
    const textBox = (target: Node): DOMRect => {
      const range = document.createRange();
      range.selectNodeContents(target);
      return range.getBoundingClientRect();
    };
    const lines = (target: Node): number => {
      const range = document.createRange();
      range.selectNodeContents(target);
      return new Set([...range.getClientRects()].map(t => Math.round(t.top))).size;
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("insets the view by the window's document padding, spaces the error line, its dismiss button and the form apart, and puts the names notice under the form in muted " +
      "text", async () => {
      await create(t => t.fail(MethodName.ProviderCheck, "codex was not found"));
      const view = part(element(), ".nol-teamrun-settings-view");
      const table = part(view, "nol-configuration-table");
      const notice = part(view, ".nol-teamrun-notice");
      const grid = part(table, ".nol-teamrun-providers-parts");

      AppearanceFixture.expectPixels(box(table).top - box(view).top, AppearanceFixture.measureLook("document-padding-block"));
      AppearanceFixture.expectPixels(box(table).left - box(view).left, AppearanceFixture.measureLook("content-padding-inline"));
      AppearanceFixture.expectPixels(box(view).right - box(table).right, AppearanceFixture.measureLook("content-padding-inline"));
      AppearanceFixture.expectPixels(box(notice).top - box(table).bottom, space(3));
      AppearanceFixture.expectPixels(box(notice).left, box(part(table, ".nol-configuration-table-heading")).left);
      AppearanceFixture.expectPixels(box(notice).left, box(grid).left);
      AppearanceFixture.expectPixels(box(notice).right, box(table).right);
      AppearanceFixture.expectPixels(box(grid).right, box(table).right);
      expect(style(notice).fontSize).toBe(style(part(row("Work"), ".nol-teamrun-item-name")).fontSize);
      expect(style(notice).color).toBe(lookOf("color: var(--nol-text-muted)", "color"));

      await choose(".nol-teamrun-check", row("Work"));
      const error = part(view, ".nol-teamrun-error");

      AppearanceFixture.expectPixels(box(error).top - box(view).top, AppearanceFixture.measureLook("document-padding-block"));
      AppearanceFixture.expectPixels(box(table).top - box(error).bottom, space(3));
      AppearanceFixture.expectPixels(box(part(error, ".nol-teamrun-dismiss")).left - box(part(error, ".nol-teamrun-error-text")).right, space(1));
      AppearanceFixture.expectPixels(box(view).right - box(part(error, ".nol-teamrun-dismiss")).right, AppearanceFixture.measureLook("content-padding-inline"));
      expect(button(".nol-teamrun-dismiss").classList).toContain("nol-button-text");
      AppearanceFixture.expectPixels(box(button(".nol-teamrun-dismiss")).height, AppearanceFixture.measureLook("button-height"));
    });

    it("keeps Skip for now and Continue in a footer along the bottom of a short view, under the providers it scrolls, aligned with the welcome line", async () => {
      await create();
      store.welcome();
      element().style.height = "20rem";
      await settle();
      const body = part(element(), ".nol-teamrun-providers-body");
      const footer = part(element(), ".nol-teamrun-welcome-actions");
      const [skip, next] = [button(".nol-teamrun-skip"), button(".nol-teamrun-continue")];
      const border = Number.parseFloat(style(footer).borderTopWidth);

      expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
      expect([style(footer).borderTopStyle, border > 0]).toEqual(["solid", true]);
      for (const scrolled of [body.scrollHeight, 0]) {
        body.scrollTop = scrolled;
        await settle();

        expect(body.scrollTop > 0).toBe(scrolled > 0);
        AppearanceFixture.expectPixels(box(footer).bottom, box(element()).bottom);
        AppearanceFixture.expectPixels(box(footer).top, box(body).bottom);
        AppearanceFixture.expectPixels(box(footer).left, box(element()).left);
        AppearanceFixture.expectPixels(box(footer).right, box(element()).right);
        AppearanceFixture.expectPixels(box(skip).top - box(footer).top - border, space(3));
        AppearanceFixture.expectPixels(box(footer).bottom - box(next).bottom, space(3));
        AppearanceFixture.expectPixels(box(next).height, AppearanceFixture.measureLook("button-height"));
        AppearanceFixture.expectPixels(box(next).left - box(skip).right, space(2));
        expect(Math.abs(box(skip).top - box(next).top)).toBeLessThanOrEqual(0.5);
      }
      body.scrollTop = 0;
      await settle();
      AppearanceFixture.expectPixels(box(next).right, box(part(element(), ".nol-teamrun-welcome")).right);
    });

    it("puts the line that the providers failed to load above the table, with Retry at its end as a text button", async () => {
      await createWithoutProviders();
      context.emit(EventName.StateInvalidated, null);
      await settle();
      const view = part(element(), ".nol-teamrun-settings-view");
      const failed = part(view, ".nol-teamrun-kinds-failed");
      const retry = part(failed, ".nol-teamrun-retry-kinds");

      AppearanceFixture.expectPixels(box(part(view, "nol-configuration-table")).top - box(failed).bottom, space(3));
      AppearanceFixture.expectPixels(box(failed).left - box(view).left, AppearanceFixture.measureLook("content-padding-inline"));
      AppearanceFixture.expectPixels(box(retry).left - box(part(failed, ".nol-teamrun-error-text")).right, space(1));
      AppearanceFixture.expectPixels(box(view).right - box(retry).right, AppearanceFixture.measureLook("content-padding-inline"));
      expect(retry.classList).toContain("nol-button-text");
      AppearanceFixture.expectPixels(box(retry).height, AppearanceFixture.measureLook("button-height"));
    });

    it("frames each list in a card with the menu border and the card's corners and a line in that border between its rows but none after the last, and spaces the " +
      "parts and Add provider apart", async () => {
      providers.push(signedIn("c1", "codex", "Second"));
      await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      const yours = part(element(), ".nol-teamrun-your-providers");
      const found = part(element(), ".nol-teamrun-found-providers");
      const list = part(yours, ".nol-teamrun-provider-list");
      const items = [...list.querySelectorAll<HTMLElement>(".nol-teamrun-item")];
      const border = lookOf("border-top: var(--nol-border-width) solid var(--nol-menu-border)", "borderTopWidth");
      const borderColor = lookOf("border-top: var(--nol-border-width) solid var(--nol-menu-border)", "borderTopColor");
      const radius = lookOf("border-radius: var(--nol-radius-medium)", "borderTopLeftRadius");
      const width = Number.parseFloat(border);

      expect(width).toBeGreaterThan(0);
      for (const target of [list, part(found, ".nol-teamrun-provider-list")]) {
        expect([style(target).borderTopWidth, style(target).borderBottomWidth, style(target).borderLeftWidth, style(target).borderRightWidth])
          .toEqual([border, border, border, border]);
        expect([style(target).borderTopColor, style(target).borderBottomColor]).toEqual([borderColor, borderColor]);
        expect([style(target).borderTopLeftRadius, style(target).borderBottomRightRadius]).toEqual([radius, radius]);
      }
      expect(items.map(t => style(t).borderTopWidth)).toEqual(["0px", border]);
      expect(style(items[1] ?? list).borderTopColor).toBe(borderColor);
      expect(items.map(t => style(t).borderBottomWidth)).toEqual(["0px", "0px"]);
      AppearanceFixture.expectPixels(box(items[0] ?? list).top, box(list).top + width);
      AppearanceFixture.expectPixels(box(items[1] ?? list).bottom, box(list).bottom - width);
      AppearanceFixture.expectPixels(box(found).top - box(yours).bottom, space(6));
      AppearanceFixture.expectPixels(box(button(".nol-teamrun-add")).top - box(found).bottom, space(6));
      AppearanceFixture.expectPixels(box(button(".nol-teamrun-add")).left, box(list).left);
      expect([...button(".nol-teamrun-add").classList].filter(t => t.startsWith("nol-button-"))).toEqual([]);
    });

    it("heads each kind's group with its name in small text and its count muted, flush with the section title's and the card's left edge, half a rem above its " +
      "card and a rem under the card before it, with no rule between the groups", async () => {
      providers.push(signedIn("c3", "codex", "Overnight builds"));
      await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab, spare]).toJson()));

      for (const section of [".nol-teamrun-your-providers", ".nol-teamrun-found-providers"]) {
        const shown = part(element(), section);
        const groups = part(shown, ".nol-teamrun-provider-groups");
        const heads = [...groups.querySelectorAll<HTMLElement>(".nol-teamrun-group-head")];
        const lists = [...groups.querySelectorAll<HTMLElement>(".nol-teamrun-provider-list")];
        expect([heads.length, lists.length, [...groups.children].map(t => t.tagName), heads.map(t => t.firstElementChild?.tagName)])
          .toEqual([2, 2, ["DIV", "UL", "DIV", "UL"], ["H5", "H5"]]);
        for (const [index, head] of heads.entries()) {
          const list = lists[index] ?? head;
          const name = part(head, ".nol-teamrun-group-name");
          const count = part(head, ".nol-teamrun-group-count");
          AppearanceFixture.expectPixels(box(head).left, box(part(shown, ".nol-configuration-table-heading")).left);
          AppearanceFixture.expectPixels(box(name).left, box(list).left);
          AppearanceFixture.expectPixels(box(head).left, box(list).left);
          AppearanceFixture.expectPixels(box(count).left - box(name).right, space(2));
          AppearanceFixture.expectPixels(box(list).top - box(head).bottom, space(2));
          AppearanceFixture.expectPixels(Number.parseFloat(style(name).fontSize), AppearanceFixture.measureLook("text-small"));
          expect([style(name).color, style(count).color]).toEqual([lookOf("color: var(--nol-text)", "color"), lookOf("color: var(--nol-text-muted)", "color")]);
          expect([style(head).borderTopWidth, style(head).borderBottomWidth]).toEqual(["0px", "0px"]);
          if (index > 0)
            AppearanceFixture.expectPixels(box(head).top - box(lists[index - 1] ?? head).bottom, space(4));
        }
      }
    });

    it("puts a kind's update notice half a rem after its count in muted text and Update to <n> at its card's right edge, centred on the heading, with the card " +
      "still half a rem under it", async () => {
      await createWithInstall(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", "1.21.0"));
      const head = headOf("antigravity");
      const list = part(element(), ".nol-teamrun-your-providers .nol-teamrun-provider-list[data-kind=\"antigravity\"]");
      const name = part(head, ".nol-teamrun-group-name");
      const count = part(head, ".nol-teamrun-group-count");
      const note = part(head, ".nol-teamrun-group-note");
      const update = part(head, ".nol-teamrun-update");
      const center = (target: Element): number => box(target).top + box(target).height / 2;

      AppearanceFixture.expectPixels(box(name).left, box(list).left);
      AppearanceFixture.expectPixels(box(note).left - box(count).right, space(2));
      AppearanceFixture.expectPixels(box(update).right, box(list).right);
      AppearanceFixture.expectPixels(box(list).top - box(head).bottom, space(2));
      expect(Math.abs(center(update) - center(part(head, ".nol-teamrun-group-heading")))).toBeLessThanOrEqual(1);
      expect([Math.abs(box(note).bottom - box(count).bottom) <= 1, style(note).color, Number.parseFloat(style(note).fontSize)])
        .toEqual([true, lookOf("color: var(--nol-text-muted)", "color"), Number.parseFloat(style(name).fontSize)]);
      expect(update.classList).toContain("nol-button-outlined");
    });

    it("puts what TeamRun says about how it runs a kind on a muted line of its own between the kind's heading and its card, from the card's left edge, half a " +
      "rem from each", async () => {
      const said = "TeamRun's chats show in the app's recent chats until TeamRun downloads its app server.";
      await createWithInstall(new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", null, true, null, null, said));
      const head = headOf("antigravity");
      const list = part(element(), ".nol-teamrun-your-providers .nol-teamrun-provider-list[data-kind=\"antigravity\"]");
      const name = part(head, ".nol-teamrun-group-name");
      const notice = part(element(), ".nol-teamrun-your-providers .nol-teamrun-group-notice[data-kind=\"antigravity\"]");

      expect([notice.textContent?.trim(), element().querySelectorAll(".nol-teamrun-group-notice").length, head.querySelector(".nol-teamrun-group-note")])
        .toEqual([said, 1, null]);
      AppearanceFixture.expectPixels(textBox(notice).left, box(list).left);
      AppearanceFixture.expectPixels(box(notice).right, box(list).right);
      AppearanceFixture.expectPixels(box(notice).top - box(head).bottom, space(2));
      AppearanceFixture.expectPixels(box(list).top - box(notice).bottom, space(2));
      expect([style(notice).color, style(notice).fontSize]).toEqual([lookOf("color: var(--nol-text-muted)", "color"), style(name).fontSize]);
    });

    it("keeps a heading with Update to <n> or Installing and Cancel at a plain heading's height, so its card sits as far under its text", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      providers.push(signedIn("c3", "codex", "Overnight builds"), spaceProvider);
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [
          new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed, null, 0, 0, "1.20.0", "1.21.0").toJson(),
          new ProviderKindInstallation("codex", ProviderKindInstallState.Installing, null, 420, 1000, "0.165.0", null).toJson()]));
      const offset = (kind: string): number => box(part(element(), `.nol-teamrun-your-providers .nol-teamrun-provider-list[data-kind="${kind}"]`)).top
        - box(part(headOf(kind), ".nol-teamrun-group-heading")).bottom;

      expect([part(headOf("antigravity"), ".nol-teamrun-update").textContent?.trim(), part(headOf("codex"), ".nol-teamrun-cancel-install").textContent?.trim(),
        headOf("grok").querySelector("button")]).toEqual(["Update to 1.21.0", "Cancel", null]);
      for (const kind of ["antigravity", "codex"]) {
        AppearanceFixture.expectPixels(offset(kind), offset("grok"));
        AppearanceFixture.expectPixels(box(headOf(kind)).height, box(headOf("grok")).height);
      }
    });

    it("draws each group's card on the side panels' darker fill, with a border at least as distinct from the page as the design's line, and in the system's " +
      "colour under forced colours", async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab, spare]).toJson()));
      const page = lookOf("background-color: var(--nol-panel)", "backgroundColor");
      const lists = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-provider-list")];

      expect(lists.length).toBeGreaterThan(1);
      for (const list of lists) {
        const sides = [style(list).borderTopColor, style(list).borderRightColor, style(list).borderBottomColor, style(list).borderLeftColor];
        expect([style(list).borderTopStyle, style(list).backgroundColor, new Set(sides).size])
          .toEqual(["solid", lookOf("background-color: var(--nol-window)", "backgroundColor"), 1]);
        if (forcedColors === "none")
          expect(style(list).backgroundColor).not.toBe(page);
        AppearanceFixture.expectPixels(Number.parseFloat(style(list).borderTopWidth), Number.parseFloat(lookOf("border-top: var(--nol-border-width) solid", "borderTopWidth")));
        if (forcedColors === "none")
          expect(AppearanceFixture.contrast(style(list).borderTopColor, page), `the card's border ${style(list).borderTopColor} on the page ${page}`)
            .toBeGreaterThanOrEqual(mode === ThemeMode.Dark ? 1.39 : 1.28);
        else
          expect(style(list).borderTopColor).toBe(lookOf("border-top: 1px solid CanvasText", "borderTopColor"));
      }
    });

    it("insets each row a rem inside its card, lines the plan, limits and menu up across the rows and the kinds' groups, and keeps each provider's name on one " +
      "line and its account on the line under it", async () => {
      const address = "someone-with-a-very-long-address-that-runs-well-past-the-account-column-of-a-wide-pane@example-organization-with-a-long-name.com";
      providers.push(signedIn("c3", "codex", "Overnight builds"), subscribed("c4", "grok", "Lab", new ProviderIdentity(address, "basic")));
      await withPlan(42);
      element().style.width = "60rem";
      await settle();
      const items = [...part(element(), ".nol-teamrun-your-providers").querySelectorAll<HTMLElement>(".nol-teamrun-item")];
      const startOf = (item: HTMLElement, selector: string): number => content(part(item, selector)).left;

      expect([items.length, new Set(items.map(t => t.closest(".nol-teamrun-provider-list"))).size]).toEqual([4, 2]);
      for (const item of items) {
        const list = item.closest(".nol-teamrun-provider-list") ?? item;
        const width = Number.parseFloat(style(list).borderTopWidth);
        const name = part(item, ".nol-teamrun-item-name");
        const account = part(item, ".nol-teamrun-account");
        AppearanceFixture.expectPixels(box(part(item, ".nol-teamrun-status-dot")).left, box(list).left + width + space(3));
        AppearanceFixture.expectPixels(box(part(item, ".nol-teamrun-row-menu")).right, box(list).right - width - space(3));
        AppearanceFixture.expectPixels(Number.parseFloat(style(item).paddingTop), 0.5625 * Number.parseFloat(style(document.documentElement).fontSize));
        for (const selector of [".nol-teamrun-plan-cell", ".nol-teamrun-limits-cell", ".nol-teamrun-menu-cell"])
          AppearanceFixture.expectPixels(startOf(item, selector), startOf(items[0] ?? item, selector));
        AppearanceFixture.expectPixels(box(name).left - box(part(item, ".nol-teamrun-status-dot")).right, space(2));
        AppearanceFixture.expectPixels(box(account).left, box(name).left);
        expect(box(account).top).toBeGreaterThanOrEqual(box(name).bottom - 0.5);
        expect([lines(name), lines(account)]).toEqual([1, 1]);
      }
      expect(style(part(row("Lab"), ".nol-teamrun-item-name")).color).toBe(lookOf("color: var(--nol-text-strong)", "color"));
      const long = part(row("Lab"), ".nol-teamrun-account");
      expect([style(long).textOverflow, long.scrollWidth > long.clientWidth]).toEqual(["ellipsis", true]);
      expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
    });

    it("puts the tool update note in muted text on the list's left edge a step under the rows, and Check for updates outlined at its right edge a step after " +
      "the note, centred on it", async () => {
      await create();
      const checks = part(element(), ".nol-teamrun-your-providers .nol-teamrun-update-checks");
      const list = part(element(), ".nol-teamrun-your-providers .nol-teamrun-provider-groups");
      const note = part(checks, ".nol-teamrun-update-checks-note");
      const check = part(checks, ".nol-teamrun-check-updates");
      const center = (target: Element): number => box(target).top + box(target).height / 2;

      AppearanceFixture.expectPixels(box(note).left, box(list).left);
      AppearanceFixture.expectPixels(box(check).right, box(list).right);
      AppearanceFixture.expectPixels(box(check).left - box(note).right, space(3));
      AppearanceFixture.expectPixels(box(checks).top - box(list).bottom, space(3));
      expect(Math.abs(center(note) - center(check))).toBeLessThanOrEqual(1);
      expect([style(note).color, check.classList.contains("nol-button-outlined")]).toEqual([lookOf("color: var(--nol-text-muted)", "color"), true]);
    });

    it("puts a kind's install line on the list's edges, its spinner half a rem before its text and Cancel at the end, centred, a step and a half above the list",
      async () => {
        providers.push(signedIn("c3", "codex", "Overnight builds"));
        await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
          .answer(MethodName.ProviderKindInstallationList, () => [installation(ProviderKindInstallState.Installing, null, 420, 1000).toJson()]));
        const line = part(element(), ".nol-teamrun-install-line");
        const list = part(element(), ".nol-teamrun-your-providers .nol-teamrun-provider-groups");
        const spinner = part(line, "nol-spinner");
        const text = part(line, ".nol-teamrun-install-text");
        const cancel = part(line, ".nol-teamrun-cancel-install");
        const center = (target: Element): number => box(target).top + box(target).height / 2;

        AppearanceFixture.expectPixels(box(spinner).left, box(list).left);
        AppearanceFixture.expectPixels(box(text).left - box(spinner).right, space(2));
        AppearanceFixture.expectPixels(box(cancel).right, box(list).right);
        AppearanceFixture.expectPixels(box(list).top - box(line).bottom, space(3));
        expect([Math.abs(center(spinner) - center(text)), Math.abs(center(cancel) - center(text))].every(t => t <= 1)).toBe(true);
        expect(cancel.classList).toContain("nol-button-text");
      });

    it("draws a sign-in's terminal on the list's edges a space under the rows, as a small muted heading with its × over a separate rounded block in the dark terminal look in every mode, a long title cut before the ×",
      async () => {
        const label = "Review desk for the weekly pass over every open pull request in the TeamRun, Terminal and Noldova Desktop repositories";
        providers.push(new Provider("a20", "claude", label, "D:\\profiles\\claude-review", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp));
        await withTerminalKinds();
        element().style.width = "48rem";
        button("nol-teamrun-provider-step button", row(label)).click();
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        await settle();

        const shown = part(element(), ".nol-teamrun-your-providers");
        const card = part(shown, ".nol-teamrun-sign-in-terminal");
        const list = box(part(shown, ".nol-teamrun-provider-groups"));
        const head = part(card, ".nol-teamrun-terminal-head");
        const title = part(head, ".nol-teamrun-terminal-title");
        const close = box(part(head, ".nol-teamrun-close-terminal"));
        const screen = part(card, ".nol-teamrun-terminal-screen");
        AppearanceFixture.expectPixels(box(card).left, list.left);
        AppearanceFixture.expectPixels(box(card).right, list.right);
        AppearanceFixture.expectPixels(box(card).top - list.bottom, space(3));
        expect([style(card).borderTopWidth, style(head).borderBottomWidth, style(screen).borderTopLeftRadius])
          .toEqual(["0px", "0px", lookOf("border-radius: var(--nol-radius-medium)", "borderTopLeftRadius")]);
        AppearanceFixture.expectPixels(box(screen).top - box(head).bottom, space(1));
        AppearanceFixture.expectPixels(box(screen).left, box(card).left);
        AppearanceFixture.expectPixels(box(screen).right, box(card).right);
        AppearanceFixture.expectPixels(box(card).right - close.right, 0);
        AppearanceFixture.expectPixels(box(title).left - box(card).left, 0);
        expect(style(title).fontSize).toBe(lookOf("font-size: var(--nol-text-small)", "fontSize"));
        if (forcedColors === "none")
          expect([style(title).color, style(screen).backgroundColor])
            .toEqual([lookOf("color: var(--nol-text-muted)", "color"), lookOf("color: var(--nol-terminal-dark-background)", "color")]);
        expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
        expect([style(title).textOverflow, title.scrollWidth > title.clientWidth]).toEqual(["ellipsis", true]);
        AppearanceFixture.expectPixels(close.left - box(title).right, space(2));
        terminals.end(0, new TerminalEnd("Close", null));
        await settle();
      });

    it("hides the meters in a narrow pane, keeping each window's label and what's left, and each provider's name and kind, whole on one line, with a row's step under it",
      async () => {
        await create(t => t.answer(MethodName.PlanUsageRead, () => new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 100, "2026-10-22T13:20:00.000Z"),
          new PlanWindow(PlanWindowName.Weekly, 20, "2026-10-27T10:00:00.000Z")], "2026-10-22T09:00:00.000Z").toJson()));
        const meters = (): string[] => [...row("Work").querySelectorAll<HTMLElement>(".nol-teamrun-meter")].map(t => style(t).display);
        const inset = box(element()).width - box(part(element(), ".nol-teamrun-provider-list")).width;

        element().style.width = `calc(44rem + ${inset}px)`;
        await settle();
        await Wait.until(() => expect(meters()).toEqual(["block", "block"]));

        element().style.width = `calc(32rem + ${inset}px)`;
        await settle();

        expect(meters()).toEqual(["none", "none"]);
        for (const name of element().querySelectorAll<HTMLElement>(".nol-teamrun-item-name, .nol-teamrun-group-heading, .nol-teamrun-limit-label, .nol-teamrun-meter-text")) {
          expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
          expect(lines(name)).toBe(1);
        }
        expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
        const step = box(part(row("Home"), ".nol-teamrun-step-sign-in"));
        const menu = box(part(row("Home"), ".nol-teamrun-row-menu"));
        AppearanceFixture.expectPixels(step.top - box(part(row("Home"), ".nol-teamrun-name-cell")).bottom, space(2));
        AppearanceFixture.expectPixels(step.right, menu.right);
        expect(menu.right).toBeLessThanOrEqual(box(row("Home")).right);
      });

    it("keeps the Limits column's longest figures, a reset within a day in the 12-hour format, on one line from a wide pane to a narrow one", async () => {
      TestBed.configureTestingModule({ providers: [{ provide: ClockService, useValue: new FakeClock(new Date(2026, 11, 22, 22, 0).getTime()) }] });
      await create(t => {
        t.answer(MethodName.PlanUsageRead, () => new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 100, new Date(2026, 11, 23, 12, 0).toISOString()),
          new PlanWindow(PlanWindowName.Weekly, 100, new Date(2026, 11, 29, 10, 0).toISOString())], "2026-10-22T09:00:00.000Z").toJson());
        TimeFormatService.register(t);
        t.changeSetting("desktop.timeFormat", "h:mm a");
        t.changeSetting("desktop.dateTimeFormat", "MMM d, yyyy, h:mm a");
      });
      try {
        const inset = box(element()).width - box(part(element(), ".nol-teamrun-provider-list")).width;
        await Wait.until(() => expect(texts(".nol-teamrun-meter-text", row("Work"))).toEqual(["0% left · Dec 23, 12:00 PM", "0% left · Dec 29"]));

        for (const width of [60, 44, 32]) {
          element().style.width = `calc(${width}rem + ${inset}px)`;
          await settle();

          for (const text of row("Work").querySelectorAll<HTMLElement>(".nol-teamrun-meter-text")) {
            expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
            expect(lines(text)).toBe(1);
          }
          const cell = part(row("Work"), ".nol-teamrun-limits-cell");
          expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
          expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
        }
      }
      finally {
        TimeFormatService.release(context);
      }
    });

    it("lines up the limits' labels, meters and figures for two windows and one, and the note that a provider reports no limits, from a wide pane to a narrow " +
      "one", async () => {
      providers.push(signedIn("c3", "codex", "One"), signedIn("c5", "codex", "None"));
      await withPlan(42);
      context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "c3", [new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 30, null)],
        "2026-10-22T09:30:00.000Z").toJson());
      context.emit(EventName.PlanUsageUpdated, new PlanUsage("codex", "c5", [], "2026-10-22T09:30:00.000Z").toJson());
      await settle();
      const inset = box(element()).width - box(part(element(), ".nol-teamrun-provider-list")).width;
      const entries = (label: string): HTMLElement[] => [...row(label).querySelectorAll<HTMLElement>(".nol-teamrun-limit")];
      const label = (entry: HTMLElement): HTMLElement => part(entry, ".nol-teamrun-limit-label");
      const figure = (entry: HTMLElement): HTMLElement => part(entry, ".nol-teamrun-meter-text");

      for (const [width, bars] of [[60, true], [32, false]] as const) {
        element().style.width = `calc(${width}rem + ${inset}px)`;
        await settle();
        const [first, second] = entries("Work");
        const [only] = entries("One");
        if (Object.isUndefined(first) || Object.isUndefined(second) || Object.isUndefined(only))
          throw new Error("A provider shows too few limits.");

        expect([entries("Work").length, entries("One").length, entries("None").length]).toEqual([2, 1, 0]);
        expect(texts(".nol-teamrun-no-limits", row("None"))).toEqual(["Codex reports no limits"]);
        expect([...element().querySelectorAll<HTMLElement>(".nol-teamrun-limits-cell .nol-teamrun-meter")].map(t => style(t).display !== "none")).toEqual([bars, bars, bars]);
        AppearanceFixture.expectPixels(box(label(only)).left, box(label(first)).left);
        AppearanceFixture.expectPixels(box(label(second)).left, box(label(first)).left);
        AppearanceFixture.expectPixels(box(part(row("None"), ".nol-teamrun-no-limits")).left, box(label(first)).left);
        AppearanceFixture.expectPixels(box(figure(only)).left, box(figure(first)).left);
        AppearanceFixture.expectPixels(box(second).top - box(first).bottom, space(1));
        if (bars) {
          const meter = part(first, ".nol-teamrun-meter");
          AppearanceFixture.expectPixels(box(part(only, ".nol-teamrun-meter")).left, box(meter).left);
          AppearanceFixture.expectPixels(box(figure(first)).left - box(meter).right, space(2));
        }
        for (const target of element().querySelectorAll<HTMLElement>(".nol-teamrun-item-name, .nol-teamrun-limit-label, .nol-teamrun-meter-text, .nol-teamrun-no-limits")) {
          expect(target.scrollWidth).toBeLessThanOrEqual(target.clientWidth);
          expect(lines(target)).toBe(1);
        }
        expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
      }
    });

    it.each([
      { note: "a failed check's error", label: "Work", text: "The check timed out.", live: false, tags: [] as string[], setup: async (): Promise<void> => {
        providers = [SampleData.provider.withCheck(AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, "The check timed out."), home];
        await create();
      } },
      { note: "why its kind isn't installed", label: "Space", text: "Installing Antigravity needs unzip, which this computer does not have.", live: false, tags: [],
        setup: (): Promise<void> => createWithInstall(installation(ProviderKindInstallState.Unavailable, "Installing Antigravity needs unzip, which this computer does not have.")) },
      { note: "its sign-in", label: "Home", text: Resources.signingInBrowserNote, live: true, tags: [], setup: async (): Promise<void> => {
        await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()]).answer(MethodName.ProviderSignIn, () => new DeferredResponse().promise));
        await startSignIn(row("Home"));
      } },
      { note: "the same sign-in as another", label: "Personal", text: "Agent-1@Example.com", live: false, tags: ["Same sign-in as Agent 1"], setup: async (): Promise<void> => {
        providers = [subscribed("d1", "claude", "Agent 1", new ProviderIdentity("agent-1@example.com", "max")),
          subscribed("d3", "claude", "Personal", new ProviderIdentity("Agent-1@Example.com", "max"))];
        await create();
      } }
    ])("keeps $note on the line under the provider's name, on the name's start edge, in a narrow pane", async ({ label, text, live, tags, setup }) => {
      await setup();
      const inset = box(element()).width - box(part(element(), ".nol-teamrun-provider-list")).width;
      element().style.width = `calc(32rem + ${inset}px)`;
      await settle();
      const item = row(label);
      const account = part(item, ".nol-teamrun-account");
      const name = part(item, ".nol-teamrun-item-name");

      expect([account.textContent?.trim(), texts(".nol-teamrun-same-account", item), announced().length > 0]).toEqual([text, tags, live]);
      expect(box(account).top).toBeGreaterThanOrEqual(box(name).bottom - 0.5);
      AppearanceFixture.expectPixels(box(account).left, box(name).left);
      expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
    });

    it("puts each part's heading on its list's start edge, and its time and refresh button at the list's end edge, centred on the heading, the time muted",
      async () => {
        await create(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
        const center = (target: Element): number => box(target).top + box(target).height / 2;

        for (const selector of [".nol-teamrun-your-providers", ".nol-teamrun-found-providers"]) {
          const shown = part(element(), selector);
          const heading = part(shown, ".nol-configuration-table-heading");
          const list = part(shown, ".nol-teamrun-provider-list");
          const refresh = part(shown, "button[nol-icon-button]");
          const time = part(shown, ".nol-teamrun-part-time");
          AppearanceFixture.expectPixels(box(heading).left, box(list).left);
          AppearanceFixture.expectPixels(box(refresh).right, box(list).right);
          expect(box(time).right).toBeLessThanOrEqual(box(refresh).left);
          expect(Math.abs(center(refresh) - center(heading))).toBeLessThanOrEqual(1);
          expect(Math.abs(center(time) - center(heading))).toBeLessThanOrEqual(1);
          expect(style(time).color).toBe(lookOf("color: var(--nol-text-muted)", "color"));
        }
      });

    it("spins the check's spinner as large as the search's and as far before its refresh, centred on its heading", async () => {
      const [checked, searched] = [new DeferredResponse(), new DeferredResponse()];
      await create(t => t.answer(MethodName.ProviderCheck, () => checked.promise).answer(MethodName.ProviderProfileDiscover, () => searched.promise));
      const placeOf = (selector: string, spinner: string): { width: number; height: number; gap: number; offset: number } => {
        const shown = part(element(), selector);
        const heading = box(part(shown, ".nol-configuration-table-heading"));
        const spun = box(part(shown, `${spinner} nol-spinner`));
        return { width: spun.width, height: spun.height, gap: box(part(shown, "button[nol-icon-button]")).left - spun.right,
          offset: spun.top + spun.height / 2 - (heading.top + heading.height / 2) };
      };

      const search = placeOf(".nol-teamrun-found-providers", ".nol-teamrun-searching");
      searched.resolve(new ProviderProfileDiscovery([]).toJson());
      await settle();
      button(".nol-teamrun-check-all").click();
      await settle();
      const check = placeOf(".nol-teamrun-your-providers", ".nol-teamrun-checking");
      checked.resolve(SampleData.provider.toJson());
      await settle();

      expect(search.width).toBeGreaterThan(0);
      AppearanceFixture.expectPixels(check.width, search.width);
      AppearanceFixture.expectPixels(check.height, search.height);
      AppearanceFixture.expectPixels(check.gap, search.gap);
      AppearanceFixture.expectPixels(check.offset, search.offset);
    });

    it("draws each window as a short bordered meter filled to what's left in the OK colour beside its figure, the meter and figure amber from 75% used and red from 90%",
      async () => {
        await withPlan(80);
        const [five, weekly] = [...row("Work").querySelectorAll<HTMLElement>(".nol-teamrun-meter")];
        const [fiveText, weeklyText] = [...row("Work").querySelectorAll<HTMLElement>(".nol-teamrun-meter-text")];
        const bar = (meter: HTMLElement): HTMLElement => part(meter, ".nol-teamrun-meter-bar");
        const progress = lookOf("border-top: 1px solid currentColor; color: var(--nol-status-ok)", "borderTopColor");
        const amber = lookOf("color: var(--nol-avatar-amber-text)", "color");

        for (const meter of [five!, weekly!]) {
          AppearanceFixture.expectPixels(box(meter).width, AppearanceFixture.toPixels(4.5));
          AppearanceFixture.expectPixels(box(meter).height, AppearanceFixture.toPixels(0.3125));
          expect([style(meter).borderTopWidth, style(meter).borderTopStyle, style(meter).borderTopLeftRadius])
            .toEqual(["1px", "solid", lookOf("border-radius: var(--nol-radius-hover)", "borderTopLeftRadius")]);
          AppearanceFixture.expectPixels(box(bar(meter)).left, box(meter).left + 1);
          expect(style(bar(meter)).borderTopColor).not.toBe(style(meter).backgroundColor);
        }
        AppearanceFixture.expectPixels(box(bar(five!)).width, (AppearanceFixture.toPixels(4.5) - 2) * 0.2);
        AppearanceFixture.expectPixels(box(bar(weekly!)).width, (AppearanceFixture.toPixels(4.5) - 2) * 0.8);
        AppearanceFixture.expectPixels(box(fiveText!).left - box(five!).right, space(2));
        expect(Math.abs(box(five!).top + box(five!).height / 2 - (box(fiveText!).top + box(fiveText!).height / 2))).toBeLessThanOrEqual(1);
        expect(style(bar(weekly!)).borderTopColor).toBe(progress);
        const plain = style(part(row("Work"), ".nol-teamrun-plan-cell")).color;
        expect(style(weeklyText!).color).toBe(plain);
        const coloursOf = async (percent: number, hour: number): Promise<readonly [string, string]> => {
          context.emit(EventName.PlanUsageUpdated, plan(percent, `2026-10-22T${hour}:00:00.000Z`).toJson());
          await settle();
          const [shownBar, shownText] = [part(row("Work"), ".nol-teamrun-meter-bar"), part(row("Work"), ".nol-teamrun-meter-text")];
          return [style(shownBar).borderTopColor, style(shownText).color];
        };
        const colours = [await coloursOf(74, 10), await coloursOf(75, 11), await coloursOf(89, 12), await coloursOf(90, 13)];
        if (forcedColors === "none") {
          const red = lookOf("color: var(--nol-error)", "color");
          expect(colours).toEqual([[progress, plain], [amber, amber], [amber, amber], [red, red]]);
          expect(new Set([progress, amber, red]).size).toBe(3);
          expect(new Set([plain, amber, red]).size).toBe(3);
        } else {
          expect(colours).toEqual(colours.map(() => [progress, plain]));
          expect(style(five!).borderTopStyle).toBe("solid");
        }
      });

    it("draws a signing-in row's dot in the accent colour, pulsing every 1.4s unless motion is reduced, and its login command a half rem after its note",
      async () => {
        await withTerminalKinds();
        element().style.width = "60rem";
        button("nol-teamrun-provider-step button", row("Desk")).click();
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        await settle();
        const dot = part(row("Desk"), ".nol-teamrun-status-dot");
        const note = part(row("Desk"), ".nol-teamrun-account");
        const command = part(row("Desk"), ".nol-teamrun-account-command");

        expect([style(dot).animationName, style(dot).animationDuration, style(dot).animationIterationCount])
          .toEqual([expect.stringMatching(/(^|_)nol-teamrun-status-pulse$/u), "1.4s", "infinite"]);
        AppearanceFixture.expectPixels(box(command).left - box(note).right, space(2));
        expect(Math.abs(box(command).bottom - box(note).bottom)).toBeLessThanOrEqual(1);
        expect(style(command).fontSize).toBe(style(note).fontSize);
        if (forcedColors === "none")
          expect([style(dot).borderTopColor, style(command).color])
            .toEqual([lookOf("color: var(--nol-accent)", "color"), lookOf("color: var(--nol-text-muted)", "color")]);
        await EmulatedMediaFixture.emulateEachAsync({ "forced-colors": forcedColors, "prefers-reduced-motion": "reduce" });
        onTestFinished(async () => {
          await EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors);
        });
        expect(style(dot).animationName).toBe("none");
      });

    it("titles Add provider's panel and labels its name field in small, strong text in the text colour", async () => {
      await create();
      button(".nol-teamrun-add").click();
      await settle();
      const panel = part(element(), ".nol-teamrun-add-panel");

      for (const target of [part(panel, ".nol-teamrun-add-title"), part(panel, ".nol-teamrun-field-label")]) {
        expect([style(target).fontSize, style(target).fontWeight])
          .toEqual([lookOf("font-size: var(--nol-text-small)", "fontSize"), lookOf("font-weight: var(--nol-weight-strong)", "fontWeight")]);
        if (forcedColors === "none")
          expect(style(target).color).toBe(lookOf("color: var(--nol-text)", "color"));
      }
    });

    it("puts a half-rem dot in the status's colour before the provider's name, centred on its line", async () => {
      providers.push(retired, new Provider("a6", "codex", "Office", "D:\\profiles\\office", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp),
        new Provider("a7", "codex", "Fresh", "D:\\profiles\\fresh", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp));
      await create();
      const tones: [string, string][] = [["Work", "status-ok"], ["Office", "status-failed"], ["Home", "status-failed"], ["Fresh", "text-muted"], ["Old", "text-muted"]];

      for (const [name, tone] of tones) {
        const dot = part(row(name), ".nol-teamrun-status-dot");
        const label = part(row(name), ".nol-teamrun-item-name");
        AppearanceFixture.expectPixels(box(dot).width, AppearanceFixture.toPixels(0.5));
        AppearanceFixture.expectPixels(box(dot).height, AppearanceFixture.toPixels(0.5));
        AppearanceFixture.expectPixels(box(label).left - box(dot).right, space(2));
        expect(Math.abs(box(dot).top + box(dot).height / 2 - (textBox(label).top + textBox(label).height / 2))).toBeLessThanOrEqual(AppearanceFixture.toPixels(0.125));
        if (forcedColors === "none")
          expect(style(dot).borderTopColor).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, tone));
        else
          expect(style(dot).borderTopColor).toBe(style(label).color);
      }
    });

    it("colours a failed note in the error colour and a quiet one muted, greys a disabled provider's name, and puts the Same sign-in tag in amber a half rem " +
      "after the account, centred on its line", async () => {
      providers = [SampleData.provider.withEnabled(false), home, subscribed("d1", "claude", "Agent 1", new ProviderIdentity("agent-1@example.com")),
        subscribed("d2", "claude", "Personal", new ProviderIdentity("agent-1@example.com"))];
      await withTerminalKinds();
      const same = part(row("Personal"), ".nol-teamrun-same-account");

      expect(style(part(row("Home"), ".nol-teamrun-account")).color).toBe(lookOf("color: var(--nol-error)", "color"));
      expect(style(part(row("Pilot"), ".nol-teamrun-account")).color).toBe(lookOf("color: var(--nol-text-muted)", "color"));
      expect(style(part(row("Work"), ".nol-teamrun-item-name")).opacity).toBe("0.5");
      expect(style(part(row("Home"), ".nol-teamrun-item-name")).opacity).toBe("1");
      AppearanceFixture.expectPixels(box(same).left - box(part(row("Personal"), ".nol-teamrun-account")).right, space(2));
      const account = part(row("Personal"), ".nol-teamrun-account");
      expect(Math.abs(box(same).top + box(same).height / 2 - (box(account).top + box(account).height / 2))).toBeLessThanOrEqual(1);
      if (forcedColors === "none") {
        const amber = lookOf("color: var(--nol-avatar-amber-text)", "color");
        expect([style(same).color, style(same).borderTopColor]).toEqual([amber, amber]);
        expect(style(part(row("Home"), ".nol-teamrun-account")).color).not.toBe(style(part(row("Pilot"), ".nol-teamrun-account")).color);
      }
    });

    it("says an expired sign-in and a used-up limit in the warning colour under the name, keeping the account, and a failed one's reason whole in the error " +
      "colour with Sign in again, each row tinted to match, a signed-out row untinted, and the step beside the note before the menu", async () => {
      const reason = "The sign-in check stopped: claude auth status answered that this computer's saved sign-in was revoked from another device, so TeamRun can't use it " +
        "until you sign in again here, and every chat with this provider waits until then.";
      providers = [new Provider("e1", "claude", "Lapsed", "D:\\profiles\\claude-e1", AuthStatus.Expired, new ProviderIdentity("agent-1@example.com"), null,
        SampleData.timestamp, null, SampleData.timestamp), new Provider("e2", "claude", "Broken", "D:\\profiles\\claude-e2", AuthStatus.Error, null, null, SampleData.timestamp,
        reason, SampleData.timestamp), new Provider("e3", "claude", "Cut", "D:\\profiles\\claude-e3", AuthStatus.Error, new ProviderIdentity("agent-3@example.com"),
        null, SampleData.timestamp, null, SampleData.timestamp), SampleData.provider];
      await withTerminalKinds(t => t.answer(MethodName.PlanUsageRead, parameters => {
        const read = PlanUsageParams.fromJson(parameters);
        return new PlanUsage(read.kind, read.providerId, read.providerId === SampleData.provider.id ? [new PlanWindow(PlanWindowName.Weekly, 100, null)] : [],
          "2026-10-22T09:00:00.000Z", null, true, null).toJson();
      }));

      const cut = part(row("Cut"), ".nol-teamrun-account");
      expect([cut.textContent?.trim(), cut.classList.contains("nol-teamrun-account-failed"), part(row("Cut"), "nol-teamrun-provider-step button").textContent?.trim()])
        .toEqual([Resources.providerStatusLabels[AuthStatus.Error], true, Resources.signInAgainLabel]);
      const cases: readonly (readonly [string, string, string, string])[] = [
        ["Lapsed", ".nol-teamrun-account-warning", Resources.providerStatusLabels[AuthStatus.Expired], Resources.signInLabel],
        ["Broken", ".nol-teamrun-account", reason, Resources.signInAgainLabel]];
      for (const [label, selector, said, again] of cases) {
        const shown = row(label);
        const note = part(shown, selector);
        const step = part(shown, "nol-teamrun-provider-step button");
        const menu = part(shown, ".nol-teamrun-row-menu");
        expect([note.textContent?.trim(), step.textContent?.trim()]).toEqual([said, again]);
        expect(note.scrollWidth).toBeLessThanOrEqual(note.clientWidth);
        expect(box(note).top).toBeGreaterThanOrEqual(box(part(shown, ".nol-teamrun-item-name")).bottom - 0.5);
        expect(box(note).right).toBeLessThanOrEqual(box(part(shown, ".nol-teamrun-name-cell")).right + 0.5);
        expect(box(step).left).toBeGreaterThanOrEqual(textBox(note).right);
        expect([box(step).top >= box(shown).top, box(step).bottom <= box(shown).bottom]).toEqual([true, true]);
        AppearanceFixture.expectPixels(box(menu).left - box(step).right, space(2));
        AppearanceFixture.expectPixels(box(menu).right, content(shown).right);
      }
      const lapsed = row("Lapsed");
      const account = part(lapsed, ".nol-teamrun-account");
      expect([account.textContent?.trim(), account.classList.contains("nol-teamrun-account-note"), account.classList.contains("nol-teamrun-account-failed")])
        .toEqual(["agent-1@example.com", false, false]);
      expect(box(account).top).toBeGreaterThanOrEqual(box(part(lapsed, ".nol-teamrun-account-warning")).bottom - 0.5);
      expect([part(row("Broken"), ".nol-teamrun-account").classList.contains("nol-teamrun-account-failed"),
        row("Broken").querySelector(".nol-teamrun-account-warning")]).toEqual([true, null]);
      expect(lines(part(row("Broken"), ".nol-teamrun-account"))).toBeGreaterThan(1);
      expect(lines(part(lapsed, ".nol-teamrun-account-warning"))).toBe(1);
      const warning = lookOf("color: var(--nol-warning)", "color");
      expect([style(part(lapsed, ".nol-teamrun-account-warning")).color, style(part(lapsed, ".nol-teamrun-status-dot")).color]).toEqual([warning, warning]);
      const spent = row("Work");
      expect([style(part(spent, ".nol-teamrun-account-warning")).color, style(part(spent, ".nol-teamrun-status-dot")).color, accountOf("Work"),
        spent.querySelector(".nol-teamrun-account-failed")]).toEqual([warning, warning, "Account not reported", null]);
      expect([part(spent, ".nol-teamrun-account-warning").textContent?.trim(), lines(part(spent, ".nol-teamrun-account-warning"))]).toEqual(["Weekly limit used up", 1]);
      expect(box(part(spent, ".nol-teamrun-account")).top).toBeGreaterThanOrEqual(box(part(spent, ".nol-teamrun-account-warning")).bottom - 0.5);
      expect([lapsed, spent, row("Broken"), row("Cut"), row("Desk"), row("Pilot")].map(t => [t.classList.contains("nol-teamrun-item-failed"),
        t.classList.contains("nol-teamrun-item-warning")])).toEqual([[false, true], [false, true], [true, false], [true, false], [false, false], [false, false]]);
      expect(part(row("Desk"), ".nol-teamrun-account").classList.contains("nol-teamrun-account-failed")).toBe(true);
      if (forcedColors === "none") {
        expect(style(part(row("Broken"), ".nol-teamrun-account")).color).toBe(lookOf("color: var(--nol-error)", "color"));
        const warned = lookOf("background-color: color-mix(in srgb, var(--nol-warning) 10%, transparent)", "backgroundColor");
        expect([style(lapsed).backgroundColor, style(spent).backgroundColor, style(row("Broken")).backgroundColor, style(row("Desk")).backgroundColor]).toEqual([
          warned, warned, lookOf("background-color: color-mix(in srgb, var(--nol-error) 10%, transparent)", "backgroundColor"),
          lookOf("background-color: transparent", "backgroundColor")]);
        expect(warning).not.toBe(lookOf("color: var(--nol-error)", "color"));
      }
    });

    it("lists the menu's actions under the ⋯ button at its end edge, Remove in the error colour", async () => {
      await create();
      const trigger = button(".nol-teamrun-row-menu", row("Work"));
      const shown = await open(row("Work"));
      const remove = part(shown, ".nol-teamrun-remove .nol-menu-item-label");
      const edit = part(shown, ".nol-teamrun-edit .nol-menu-item-label");

      expect(box(shown).top).toBeGreaterThanOrEqual(box(trigger).bottom - 0.5);
      AppearanceFixture.expectPixels(box(shown).right, box(trigger).right);
      AppearanceFixture.expectPixels(box(trigger).width, AppearanceFixture.measureLook("icon-button-target"));
      expect(style(remove).color).toBe(lookOf("color: var(--nol-error)", "color"));
      if (forcedColors === "none")
        expect(style(edit).color).not.toBe(style(remove).color);
    });

    it("keeps a step's Try again whole at the step's end edge when the step's text wraps", async () => {
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson(), antigravity.toJson()])
        .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(),
          new ProviderTool("grok", false, null, "curl -fsSL https://x.ai/cli/install.sh | sh").toJson()])
        .answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("antigravity", ProviderKindInstallState.Unavailable, "Unzip is missing.").toJson()]));
      button(".nol-teamrun-add").click();
      await settle();
      button('.nol-teamrun-kind-card[data-kind="antigravity"]').click();
      await settle();
      const whole = box(button(".nol-teamrun-add-try-again")).width;

      button('.nol-teamrun-kind-card[data-kind="grok"]').click();
      await settle();
      const step = part(element(), ".nol-teamrun-add-step");
      const again = box(button(".nol-teamrun-add-look-again"));

      expect(lines(part(step, ".nol-teamrun-add-step-text"))).toBeGreaterThan(1);
      AppearanceFixture.expectPixels(again.width, whole);
      AppearanceFixture.expectPixels(again.right, box(step).right);
    });

    it("draws a type's install terminal as a card on the panel's edges a space under it, and the busy Add keeping its label with its spinner a half rem " +
      "before it, centred on it", async () => {
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), grok.toJson()])
        .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.166.0").toJson(),
          new ProviderTool("grok", false, null, "curl -fsSL https://x.ai/cli/install.sh | sh").toJson()]));
      button(".nol-teamrun-add").click();
      await settle();
      button('.nol-teamrun-kind-card[data-kind="grok"]').click();
      await settle();
      button(".nol-teamrun-add-save").click();
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await settle();

      const panel = box(part(element(), ".nol-teamrun-add-panel"));
      const terminal = box(part(element(), ".nol-teamrun-add-terminal"));
      const save = part(element(), ".nol-teamrun-add-save");
      const spinner = box(part(element(), ".nol-teamrun-add-busy"));
      AppearanceFixture.expectPixels(terminal.left, panel.left);
      AppearanceFixture.expectPixels(terminal.right, panel.right);
      AppearanceFixture.expectPixels(terminal.top - panel.bottom, space(3));
      expect([save.textContent?.trim(), save.getAttribute("aria-busy")]).toEqual(["Add and sign in", null]);
      AppearanceFixture.expectPixels(box(save).left - spinner.right, space(2));
      AppearanceFixture.expectPixels(spinner.top + spinner.height / 2, box(save).top + box(save).height / 2);
      terminals.end(0, new TerminalEnd("Close", null));
      await settle();
    });

    it("draws Add provider's panel where its button was, edged in the accent colour, its type cards a half rem apart with the chosen one edged in the " +
      "accent, the name's Shown as beside its field, and Cancel and Add at its end edge", async () => {
      await create();
      const add = box(button(".nol-teamrun-add"));
      button(".nol-teamrun-add").click();
      await settle();
      const panel = part(element(), ".nol-teamrun-add-panel");
      const first = part(panel, ".nol-teamrun-kind-card:nth-child(1)");
      const second = part(panel, ".nol-teamrun-kind-card:nth-child(2)");
      const field = part(panel, ".nol-teamrun-add-name");
      const shownAs = part(panel, ".nol-teamrun-shown-as");
      const cancel = part(panel, ".nol-teamrun-add-cancel");
      const save = part(panel, ".nol-teamrun-add-save");

      AppearanceFixture.expectPixels(box(panel).top, add.top);
      AppearanceFixture.expectPixels(box(panel).left, add.left);
      AppearanceFixture.expectPixels(box(panel).right, box(part(element(), ".nol-teamrun-your-providers .nol-teamrun-provider-list")).right);
      AppearanceFixture.expectPixels(box(first).left, content(panel).left);
      AppearanceFixture.expectPixels(box(second).left - box(first).right, space(2));
      AppearanceFixture.expectPixels(box(field).left, content(panel).left);
      AppearanceFixture.expectPixels(box(shownAs).left - box(field).right, space(2));
      expect(box(shownAs).right).toBeLessThanOrEqual(content(panel).right + 0.5);
      AppearanceFixture.expectPixels(box(save).right, content(panel).right);
      AppearanceFixture.expectPixels(box(save).left - box(cancel).right, space(2));
      expect(Math.abs(box(save).top - box(cancel).top)).toBeLessThanOrEqual(0.5);
      expect(style(shownAs).color).toBe(lookOf("color: var(--nol-text-muted)", "color"));
      if (forcedColors === "none") {
        const accent = lookOf("color: var(--nol-accent)", "color");
        expect([style(panel).borderTopColor, style(first).borderTopColor]).toEqual([accent, accent]);
        expect(style(second).borderTopColor).toBe(lookOf("color: var(--nol-card-border)", "color"));
      }
      else
        expect(style(first).borderTopColor).not.toBe(style(second).borderTopColor);
    });

    it("asks Remove in a row tinted with the error colour, the question in muted text wrapping under the name, and Keep and Remove at the row's end edge a " +
      "half rem apart, centred on each other", async () => {
      await create(t => t.answer(MethodName.TeammateList, () => [teammate("reviewer", "Reviewer", "a2"), teammate("tester", "Tester", "a2")].map(u => u.toJson())));
      await choose(".nol-teamrun-remove", row("Home"));
      const asked = row("Home");
      const name = part(asked, ".nol-teamrun-item-name");
      const question = part(asked, ".nol-teamrun-question");
      const keep = part(asked, ".nol-teamrun-keep");
      const remove = part(asked, ".nol-teamrun-confirm-remove");

      AppearanceFixture.expectPixels(textBox(question).left, textBox(name).left);
      expect(box(question).top).toBeGreaterThanOrEqual(box(name).bottom - 0.5);
      expect(box(question).right).toBeLessThanOrEqual(box(part(asked, ".nol-teamrun-name-cell")).right + 0.5);
      expect(question.scrollWidth).toBeLessThanOrEqual(question.clientWidth);
      element().style.width = "32rem";
      await settle();
      expect(lines(question)).toBeGreaterThan(1);
      expect(box(question).right).toBeLessThanOrEqual(box(keep).left + 0.5);
      expect(question.scrollWidth).toBeLessThanOrEqual(question.clientWidth);
      AppearanceFixture.expectPixels(box(remove).left - box(keep).right, space(2));
      AppearanceFixture.expectPixels(box(remove).right, content(asked).right);
      expect(Math.abs(box(keep).top + box(keep).height / 2 - (box(remove).top + box(remove).height / 2))).toBeLessThanOrEqual(0.5);
      AppearanceFixture.expectPixels(box(asked).left, box(row("Work")).left);
      AppearanceFixture.expectPixels(box(asked).right, box(row("Work")).right);
      expect(style(question).color).toBe(lookOf("color: var(--nol-text-muted)", "color"));
      if (forcedColors === "none") {
        expect(style(asked).backgroundColor).toBe(lookOf("background-color: color-mix(in srgb, var(--nol-error) 10%, transparent)", "backgroundColor"));
        expect(style(asked).backgroundColor).not.toBe(style(row("Work")).backgroundColor);
        expect(style(remove).backgroundColor).not.toBe(style(keep).backgroundColor);
      }
    });
  });

  describe("on a first launch", () => {
    const welcome = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-teamrun-welcome");
    const step = (): HTMLElement | null => element().querySelector<HTMLElement>("nol-teamrun-first-teammate");
    const part = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = element()): T => {
      const found = root.querySelector<T>(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing shows ${selector}.`);
      return found;
    };
    const nameField = (): HTMLInputElement => part<HTMLInputElement>(".nol-teamrun-teammate-name");
    const answeredBy = (): SelectComponent => fixture.debugElement.query(By.css("nol-teamrun-first-teammate nol-select.nol-teamrun-provider")).componentInstance as SelectComponent;
    const welcomed = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
      await create(t => {
        t.answer(MethodName.FirstLaunchFinish, () => new FirstLaunch(SampleData.timestamp).toJson())
          .answer(MethodName.TeammateCreate, u => new Teammate("t1", (u as { readonly name: string }).name, null, (u as { readonly providerId: string }).providerId,
            Harness.Provider, null, null, SampleData.timestamp, SampleData.timestamp).toJson());
        SampleData.keepCreatedEmpty(t, () => new Conversation("c7", null, "New chat", SampleData.timestamp, SampleData.timestamp));
        configure(t);
      });
      store.welcome();
      await settle();
    };
    const continued = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
      await welcomed(configure);
      button(".nol-teamrun-continue").click();
      await Wait.until(() => expect(step()).not.toBeNull());
      await settle();
    };

    it("shows the welcome line above the form, with Skip for now and Continue at its bottom end, and Continue on while a provider is signed in", async () => {
      await welcomed();
      const banner = part(".nol-teamrun-welcome");
      const table = part(".nol-teamrun-your-providers");
      const actions = part(".nol-teamrun-welcome-actions");
      const found = part(".nol-teamrun-found-providers");

      expect([texts(".nol-teamrun-welcome-title"), texts(".nol-teamrun-welcome-text"), banner.getAttribute("role"), texts(".nol-teamrun-welcome-actions button"),
        button(".nol-teamrun-continue").disabled, button(".nol-teamrun-skip").disabled])
        .toEqual([[Resources.welcomeTitle], [Resources.welcomeLine], "note", [Resources.skipForNowLabel, Resources.continueLabel], false, false]);
      expect(banner.getBoundingClientRect().bottom).toBeLessThanOrEqual(table.getBoundingClientRect().top + 0.5);
      expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(found.getBoundingClientRect().bottom - 0.5);
      expect(Math.abs(button(".nol-teamrun-continue").getBoundingClientRect().right - banner.getBoundingClientRect().right)).toBeLessThanOrEqual(0.5);
      expect(button(".nol-teamrun-skip").getBoundingClientRect().right).toBeLessThanOrEqual(button(".nol-teamrun-continue").getBoundingClientRect().left);
      expect([context.count(MethodName.ProviderProfileDiscover), context.count(MethodName.FirstLaunchFinish)]).toEqual([store.kinds().length, 0]);
    });

    it("keeps Continue off until a provider is signed in", async () => {
      providers = [home];
      await welcomed();

      expect([button(".nol-teamrun-continue").disabled, button(".nol-teamrun-skip").disabled]).toEqual([true, false]);
    });

    it("records the first launch from Skip for now and leaves the form open without the welcome", async () => {
      await welcomed();

      button(".nol-teamrun-skip").click();
      await Wait.until(() => expect(welcome()).toBeNull());

      expect([context.count(MethodName.FirstLaunchFinish), element().querySelector(".nol-teamrun-welcome-actions"), step(),
        element().querySelector(".nol-teamrun-your-providers") !== null, store.welcoming()]).toEqual([1, null, null, true, false]);
    });

    it("keeps the welcome and says why when the first launch can't be recorded", async () => {
      await welcomed(t => t.fail(MethodName.FirstLaunchFinish, "Setup refused"));

      button(".nol-teamrun-continue").click();
      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual([expect.stringContaining("Setup refused")]));

      expect([welcome() !== null, step(), button(".nol-teamrun-continue").disabled]).toEqual([true, null, false]);
    });

    it.each([
      { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
      { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
      { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
    ])("in $look, titles the first teammate step and labels its fields in small, strong text in the text colour", async ({ mode, forcedColors }) => {
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      await EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors);
      onTestFinished(async () => {
        AppearanceFixture.reset();
        await EmulatedMediaFixture.resetAsync();
      });
      await continued();
      const panel = part("nol-teamrun-first-teammate");
      const look = (css: string, property: "fontSize" | "fontWeight" | "color"): string => {
        const probe = panel.appendChild(document.createElement("span"));
        probe.style.cssText = css;
        const value = getComputedStyle(probe)[property];
        probe.remove();
        return value;
      };
      const targets = [part(".nol-teamrun-first-teammate-title", panel), ...panel.querySelectorAll<HTMLElement>(".nol-teamrun-field-label")];

      expect(targets.length).toBe(3);
      for (const target of targets) {
        expect([getComputedStyle(target).fontSize, getComputedStyle(target).fontWeight])
          .toEqual([look("font-size: var(--nol-text-small)", "fontSize"), look("font-weight: var(--nol-weight-strong)", "fontWeight")]);
        if (forcedColors === "none")
          expect(getComputedStyle(target).color).toBe(look("color: var(--nol-text)", "color"));
      }
    });

    it("records the first launch from Continue and shows the first teammate step in the form's place, named after its provider's kind and answered by it", async () => {
      await continued();
      const panel = part("nol-teamrun-first-teammate");

      expect([context.count(MethodName.FirstLaunchFinish), welcome(), element().querySelector(".nol-teamrun-your-providers"), element().querySelector(".nol-teamrun-welcome-actions")])
        .toEqual([1, null, null, null]);
      expect([texts(".nol-teamrun-first-teammate-title", panel), texts(".nol-teamrun-first-teammate-text", panel), nameField().value,
        texts(".nol-teamrun-first-teammate-mention", panel), answeredBy().value(), answeredBy().options().map(t => t instanceof SelectOption ? t.title : null)])
        .toEqual([[Resources.firstTeammateStepTitle], [Resources.firstTeammateStepText], "Codex", ["@Codex"], SampleData.provider.id, ["Work · Codex", "Home · Grok CLI"]]);
      expect(part(".nol-teamrun-first-teammate-defaults", panel).textContent?.replace(/\s+/gu, " ").trim()).toBe(`${Resources.firstTeammateDefaults} ${Resources.chooseNowLabel}`);
      expect(texts(".nol-teamrun-first-teammate-actions button", panel)).toEqual([Resources.notNowLabel, Resources.startChattingLabel]);
      expect(button(".nol-teamrun-start-chatting").disabled).toBe(false);
    });

    it("names the step after a provider's own name and lists its kind as the runtime gave it when TeamRun doesn't know its kind", async () => {
      providers = [new Provider("z1", "lab", "Lab home", "D:/profiles/lab", AuthStatus.LoggedIn, null, null, null, null, "2026-01-01T08:00:00.000Z"), SampleData.provider];
      await continued();

      expect([nameField().value, answeredBy().value(), answeredBy().options().map(t => t instanceof SelectOption ? t.title : null)])
        .toEqual(["Lab home", "z1", ["Work · Codex", "Lab home · lab"]]);
    });

    it("answers with the earliest provider when the signed-in one signs out while Continue records the first launch", async () => {
      const lab = new Provider("a5", "claude", "Lab", "D:/profiles/lab", AuthStatus.LoggedOut, null, null, null, null, "2026-01-01T08:00:00.000Z");
      providers = [SampleData.provider, lab];
      await continued(t => t.answer(MethodName.FirstLaunchFinish, () => {
        t.emit(EventName.ProviderUpdated, SampleData.provider.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null).toJson());
        return new FirstLaunch(SampleData.timestamp).toJson();
      }));

      expect([nameField().value, answeredBy().value()]).toEqual(["Claude", "a5"]);
    });

    it("leaves the step without a name or a provider, with Start chatting off, when the only provider goes while Continue records the first launch", async () => {
      providers = [SampleData.provider];
      await continued(t => t.answer(MethodName.FirstLaunchFinish, () => {
        t.emit(EventName.ProviderUpdated, SampleData.provider.withEnabled(false).toJson());
        return new FirstLaunch(SampleData.timestamp).toJson();
      }));

      expect([nameField().value, answeredBy().options().length, button(".nol-teamrun-start-chatting").disabled]).toEqual(["", 0, true]);
    });

    it("follows the name with its @mention at the field's end, inside it", async () => {
      await continued();
      type(".nol-teamrun-teammate-name", "Coder");
      await settle();
      const field = nameField().getBoundingClientRect();
      const mention = part(".nol-teamrun-first-teammate-mention").getBoundingClientRect();

      expect(texts(".nol-teamrun-first-teammate-mention")).toEqual(["@Coder"]);
      expect([mention.left >= field.left, mention.right <= field.right + 0.5, mention.top >= field.top - 0.5, mention.bottom <= field.bottom + 0.5]).toEqual([true, true, true, true]);
      expect(getComputedStyle(part(".nol-teamrun-first-teammate-mention")).color).toBe(getComputedStyle(part(".nol-teamrun-first-teammate-defaults")).color);
    });

    it.each([["in a narrow tab", false], ["at 200% zoom", true]])("keeps a long name off its @mention, cut with an ellipsis, %s", async (_, zoomed) => {
      await continued();
      part(".nol-teamrun-first-teammate").style.width = zoomed ? "" : "20rem";
      type(".nol-teamrun-teammate-name", "Senior Backend Reviewer for the Payments, Billing, Invoicing, Refunds and Subscription Services Team");
      await settle();
      const measure = async (): Promise<boolean[]> => {
        await settle();
        const input = nameField();
        const style = getComputedStyle(input);
        const field = input.getBoundingClientRect();
        const textEnd = field.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
        const mention = part(".nol-teamrun-first-teammate-mention");
        const box = mention.getBoundingClientRect();
        return [box.left >= textEnd - 0.5, box.left >= field.left, box.right <= field.right + 0.5, getComputedStyle(mention).textOverflow === "ellipsis",
          mention.scrollWidth > mention.clientWidth];
      };

      const found = zoomed ? await AccessibilityFixture.zoomedAsync(measure) : await measure();

      expect(found).toEqual([true, true, true, true, true]);
    });

    it("makes the teammate with its name and provider alone from Start chatting, opens a new chat with it, and leaves the form without the welcome", async () => {
      await continued();
      type(".nol-teamrun-teammate-name", "Coder");
      await settle();

      button(".nol-teamrun-start-chatting").click();
      await Wait.until(() => expect(context.count(MethodName.ConversationCreate)).toBe(1));

      expect(context.parametersOf(MethodName.TeammateCreate)).toMatchObject({ name: "Coder", role: null, providerId: SampleData.provider.id, model: null, effort: null, mode: null });
      expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate))).toEqual(new ConversationCreateParams(null, null, "t1"));
      await Wait.until(() => expect(context.keptDocuments.map(t => t.instance)).toEqual(["c7"]));
      await Wait.until(() => expect(step()).toBeNull());
      expect([welcome(), element().querySelector(".nol-teamrun-your-providers") !== null]).toEqual([null, true]);
    });

    it("offers each enabled provider by its name and kind under Answered by, and makes the teammate on the one the person chooses", async () => {
      providers.push(signedIn("b1", "grok", "Lounge"), signedIn("b2", "grok", "Grok CLI"), signedIn("b3", "codex", "Off").withEnabled(false));
      await continued();

      expect(answeredBy().options().map(t => t instanceof SelectOption ? t.title : null)).toEqual(["Work · Codex", "Grok CLI", "Home · Grok CLI", "Lounge · Grok CLI"]);
      answeredBy().valueChange.emit("b1");
      await settle();
      expect(answeredBy().value()).toBe("b1");
      button(".nol-teamrun-start-chatting").click();
      await Wait.until(() => expect(context.count(MethodName.TeammateCreate)).toBe(1));

      expect(context.parametersOf(MethodName.TeammateCreate)).toMatchObject({ providerId: "b1" });
    });

    it("keeps Start chatting off while the name can't be a teammate's", async () => {
      await continued();

      type(".nol-teamrun-teammate-name", " ");
      await settle();
      expect([button(".nol-teamrun-start-chatting").disabled, nameField().getAttribute("aria-invalid")]).toEqual([true, null]);
      type(".nol-teamrun-teammate-name", "@@@");
      await settle();
      expect([button(".nol-teamrun-start-chatting").disabled, nameField().getAttribute("aria-invalid")]).toEqual([true, "true"]);
    });

    it("says why the teammate couldn't be made in the step, under its fields, and opens no chat", async () => {
      await continued(t => t.fail(MethodName.TeammateCreate, "Name taken"));

      button(".nol-teamrun-start-chatting").click();
      await Wait.until(() => expect(texts("nol-teamrun-first-teammate .nol-teamrun-dialog-error")).toEqual([expect.stringContaining("Name taken")]));

      expect([step() !== null, context.count(MethodName.ConversationCreate), nameField().getAttribute("aria-describedby"), nameField().getAttribute("aria-invalid")])
        .toEqual([true, 0, "nol-teamrun-first-teammate-message", null]);
    });

    it("makes nothing from Not now and goes back to the form without the welcome", async () => {
      await continued();

      button(".nol-teamrun-not-now").click();
      await Wait.until(() => expect(step()).toBeNull());

      expect([context.count(MethodName.TeammateCreate), context.count(MethodName.ConversationCreate), welcome(),
        element().querySelector(".nol-teamrun-your-providers") !== null]).toEqual([0, 0, null, true]);
    });

    it("opens the eight-field teammate dialog from Choose now with the step's name and provider, whose save starts the chat and ends the step", async () => {
      await continued();
      type(".nol-teamrun-teammate-name", "Coder");
      await settle();

      button(".nol-teamrun-choose-now").click();
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container .nol-teamrun-teammate-name")).not.toBeNull());
      const dialog = part(".cdk-overlay-container nol-dialog", document);

      expect([dialog.querySelector(".nol-dialog-title")?.textContent, dialog.querySelector<HTMLInputElement>(".nol-teamrun-teammate-name")?.value])
        .toEqual([Resources.firstTeammateTitle, "Coder"]);
      await Wait.until(() => expect(dialog.querySelector<HTMLButtonElement>(".nol-teamrun-save")?.disabled).toBe(false));
      part<HTMLButtonElement>(".nol-teamrun-save", dialog).click();
      await Wait.until(() => expect(context.count(MethodName.ConversationCreate)).toBe(1));

      expect(context.parametersOf(MethodName.TeammateCreate)).toMatchObject({ name: "Coder", providerId: SampleData.provider.id });
      await Wait.until(() => expect([step(), document.querySelector(".cdk-overlay-container .nol-teamrun-teammate-name")]).toEqual([null, null]));
    });

    it("shows no welcome line, Skip or Continue when the tab is opened later", async () => {
      await create();

      expect([welcome(), element().querySelector(".nol-teamrun-welcome-actions"), step()]).toEqual([null, null, null]);
    });

    it("names and reaches by keyboard every control of the welcome and of the first teammate step", async () => {
      await welcomed(t => t.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      expect([AccessibilityFixture.expectNamed(element()) > 0, await AccessibilityFixture.expectKeyboardAsync(element()) > 0]).toEqual([true, true]);
      button(".nol-teamrun-continue").click();
      await Wait.until(() => expect(step()).not.toBeNull());
      await settle();
      expect([AccessibilityFixture.expectNamed(element()) > 0, await AccessibilityFixture.expectKeyboardAsync(element()) > 0]).toEqual([true, true]);
    });

    it("keeps the welcome and the first teammate step visible under forced colours and whole at 200% zoom", async () => {
      await welcomed();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
      button(".nol-teamrun-continue").click();
      await Wait.until(() => expect(step()).not.toBeNull());
      await settle();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the providers view visible under forced colours", async () => {
      await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()).answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the providers view at 200% zoom", async () => {
      await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()).answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the providers view by keyboard, with a visible ring", async () => {
      await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()).answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the providers view", async () => {
      await create(t => t.answer(MethodName.PlanUsageRead, () => plan(42).toJson()).answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([lab]).toJson()));
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
