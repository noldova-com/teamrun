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
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import {
  AbilityCell,
  AuthStatus,
  EventName,
  Harness,
  MethodName,
  OwnMcpServer,
  OwnMcpServerState,
  Provider,
  ProviderAbility,
  ProviderIdParams,
  ProviderKind,
  ProviderMcpServerList,
  ProviderUpdateParams,
  SharedMcpHeader,
  SharedMcpProviderSetParams,
  SharedMcpServer,
  SharedMcpServerDefinition,
  SharedMcpServerIdParams,
  SharedMcpServerListing,
  SharedMcpSetting,
  SharedMcpSignIn,
  SharedMcpSignInStarted,
  SharedMcpTeammateSetParams,
  SharedMcpTeammateSetting,
  SharedMcpTransport,
  SharedMcpUnavailability,
  SharedMcpVariable,
  SharedMcpVariableSource,
  Teammate
} from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, LinkGesture, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { McpServersViewComponent } from "../../../../src/app/components/mcp-servers-view/mcp-servers-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("McpServersViewComponent", () => {
  const claudeCell = "it keeps them in its settings";
  const copilotCell = "they stay off until TeamRun has confirmed them";
  const claudeReason = "Claude Code can't switch on its own MCP servers here: it keeps them in its settings.";
  const copilotReason = "GitHub Copilot can't switch on its own MCP servers here: they stay off until TeamRun has confirmed them.";
  const codexNote = "This switch also covers the apps connected to your Codex account, such as mail and files.";
  const copilot = new ProviderKind("copilot", "GitHub Copilot", true);
  const unlisted = AbilityCell.cannot("it offers no list of them");
  const heldCopilot = new ProviderKind("copilot", "GitHub Copilot", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.OwnServersSwitch]: AbilityCell.cannot(copilotCell), [ProviderAbility.OwnServersList]: unlisted }));
  const claude = new ProviderKind("claude", "Claude Code", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.OwnServersSwitch]: AbilityCell.cannot(claudeCell), [ProviderAbility.OwnServersList]: unlisted }));
  const listingCursor = new ProviderKind("cursor", "Cursor", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.OwnServersSwitch]: AbilityCell.cannot("it always reads your own servers' file") }));
  const desk = new Provider("a6", "cursor", "Desk", "D:\\profiles\\cursor", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  const coveringCodex = new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, codexNote, null, false, false, undefined,
    "the apps on your Codex account");
  const personal = new Provider("a3", "copilot", "Personal", "D:\\profiles\\copilot", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, true, true);
  const office = new Provider("a4", "claude", "Office", "D:\\profiles\\claude", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  const retired = new Provider("a5", "gemini", "Old", "D:\\profiles\\gemini", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<McpServersViewComponent>;
  let store: ChatStoreService;
  let providers: Provider[];
  let servers: Map<string, readonly OwnMcpServer[] | null>;
  let kinds: readonly ProviderKind[] | null;
  let shared: SharedMcpServerListing[];
  let teammates: Teammate[];

  const own = (...names: string[]): OwnMcpServer[] => names.map(t => new OwnMcpServer(t, OwnMcpServerState.Configured));
  const listOf = (id: string): JsonValue => {
    const named = servers.get(id);
    return new ProviderMcpServerList(id, Object.isUndefined(named) ? [] : named).toJson();
  };
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string, root: ParentNode = element()): string[] => [...root.querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const part = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T => {
    const found = root.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const ownRow = (name: string): HTMLElement => {
    const found = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-own-mcp-row")].find(t => t.querySelector(".nol-teamrun-own-mcp-name")?.textContent?.trim() === name);
    if (Object.isUndefined(found))
      throw new Error(`No own servers row shows ${name}.`);
    return found;
  };
  const toggle = (root: ParentNode): HTMLInputElement => part<HTMLInputElement>(root, "nol-switch input[role='switch']");
  const ownSwitch = (name: string): HTMLInputElement => toggle(ownRow(name));
  const isDisabled = (input: HTMLInputElement): boolean => input.getAttribute("aria-disabled") === "true";
  const describedBy = (target: Element): string[] => (target.getAttribute("aria-describedby") ?? "").split(" ").filter(t => t.length > 0)
    .map(t => document.getElementById(t)?.textContent?.trim() ?? "");
  const listed = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderOwnMcpServerList))
    .map(t => ProviderIdParams.fromJson(t.parameters).providerId);
  const updated = (): JsonValue | undefined => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderUpdate)).at(-1)?.parameters;
  const sent = (method: MethodName): JsonValue[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(method)).map(t => t.parameters);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const change = (serverId: string, update: (server: SharedMcpServer) => SharedMcpServer): JsonValue => {
    const listing = shared.find(t => t.server.id === serverId);
    if (Object.isUndefined(listing))
      throw new Error(`No shared server ${serverId}.`);
    const changed = new SharedMcpServerListing(update(listing.server), listing.unavailable, listing.variables);
    shared = shared.map(t => t === listing ? changed : t);
    return changed.server.toJson();
  };

  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, isLoaded: boolean = true, isRead: boolean = true): Promise<void> => {
    context = SampleData.createContext()
      .answer(MethodName.ProviderKindList, () => {
        if (Object.isNull(kinds))
          throw new Error("The runtime is restarting.");
        return kinds.map(t => t.toJson());
      })
      .answer(MethodName.ProviderList, () => providers.map(t => t.toJson()))
      .answer(MethodName.ProviderOwnMcpServerList, t => listOf(ProviderIdParams.fromJson(t).providerId))
      .answer(MethodName.ProviderUpdate, t => {
        const params = ProviderUpdateParams.fromJson(t);
        providers = providers.map(u => u.id === params.providerId ? u.withOwnMcpServers(params.ownMcpServers === true) : u);
        return providers.find(u => u.id === params.providerId)?.toJson() ?? null;
      })
      .answer(MethodName.TeammateList, () => teammates.map(t => t.toJson()))
      .answer(MethodName.SharedMcpServerList, () => shared.map(t => t.toJson()))
      .answer(MethodName.SharedMcpServerDelete, t => {
        shared = shared.filter(u => u.server.id !== SharedMcpServerIdParams.fromJson(t).serverId);
        return null;
      })
      .answer(MethodName.SharedMcpProviderSet, t => {
        const params = SharedMcpProviderSetParams.fromJson(t);
        return change(params.serverId, u => new SharedMcpServer(u.id, u.definition, params.on ? [...u.providerIds, params.providerId]
          : u.providerIds.filter(v => v !== params.providerId), u.teammates, u.createdAt, u.updatedAt));
      })
      .answer(MethodName.SharedMcpTeammateSet, t => {
        const params = SharedMcpTeammateSetParams.fromJson(t);
        return change(params.serverId, u => new SharedMcpServer(u.id, u.definition, u.providerIds, [...u.teammates.filter(v => v.teammateId !== params.teammateId),
          ...params.setting === SharedMcpSetting.AsProvider ? [] : [new SharedMcpTeammateSetting(params.teammateId, params.setting)]], u.createdAt, u.updatedAt));
      });
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(McpServersViewComponent);
    store = ChatStoreService.of(context);
    fixture.autoDetectChanges();
    await settle();
    expect(store.loaded()).toBe(isLoaded);
    if (isRead)
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-own-mcp-summary[role='status']")).toBeNull());
  };

  beforeEach(() => {
    shared = [];
    teammates = [];
    providers = [SampleData.provider, personal, office];
    servers = new Map([["a1", [new OwnMcpServer("node_repl", OwnMcpServerState.Enabled), new OwnMcpServer("docs", OwnMcpServerState.Disabled)]], ["a3", own("github")]]);
    kinds = [SampleData.codex, copilot, claude];
  });

  describe("own servers", () => {
    it("gives each provider that can use its own servers a row, by its kind's name and then its label, with up to three servers by name and its switch", async () => {
      await create();

      expect(texts(".nol-teamrun-own-mcp-row:not(.nol-teamrun-own-mcp-held) .nol-teamrun-own-mcp-name")).toEqual(["Codex · Work", "GitHub Copilot · Personal"]);
      expect(texts(".nol-teamrun-mcp-server", ownRow("Codex · Work"))).toEqual(["node_repl", "docs"]);
      expect(texts(".nol-teamrun-mcp-server", ownRow("GitHub Copilot · Personal"))).toEqual(["github"]);
      expect([ownSwitch("Codex · Work").checked, ownSwitch("GitHub Copilot · Personal").checked]).toEqual([false, true]);
      expect([isDisabled(ownSwitch("Codex · Work")), isDisabled(ownSwitch("GitHub Copilot · Personal"))]).toEqual([false, false]);
      expect(ownSwitch("Codex · Work").getAttribute("aria-label")).toBe("Use Codex · Work's own servers");
      expect(texts(".nol-teamrun-mcp-heading")).toEqual([Resources.sharedMcpServersTitle, Resources.ownMcpServersTitle]);
      expect(texts(".nol-teamrun-mcp-hint")).toEqual([Resources.sharedMcpServersHint, Resources.ownMcpServersHint]);
      expect(texts(".nol-teamrun-mcp-title")).toEqual([Resources.mcpServersTitle]);
      expect(texts(".nol-teamrun-notice")).toEqual([Resources.namesNotice]);
    });

    it("counts more than three servers rather than naming them, and says when a provider's configuration names none", async () => {
      servers.set("a1", own("a", "b", "c", "d"));
      servers.set("a3", []);
      await create();

      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("Codex · Work"))).toEqual(["4 servers"]);
      expect(ownRow("Codex · Work").querySelector(".nol-teamrun-mcp-server")).toBeNull();
      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("GitHub Copilot · Personal"))).toEqual([Resources.noOwnMcpServers]);
    });

    it("puts two providers of one kind in order of their labels, ignoring case, in their kind's place", async () => {
      providers = [SampleData.provider, personal, new Provider("a6", "codex", "home", "D:\\profiles\\codex-home", AuthStatus.LoggedIn, null, null, null, null,
        SampleData.timestamp)];

      await create();

      expect(texts(".nol-teamrun-own-mcp-name")).toEqual(["Codex · home", "Codex · Work", "GitHub Copilot · Personal"]);
    });

    it("says what a kind's switch covers beyond its servers in a few words on its row, with the full sentence in its tooltip and no second line", async () => {
      kinds = [coveringCodex, copilot, claude];
      await create();
      const summary = part(ownRow("Codex · Work"), ".nol-teamrun-own-mcp-summary");

      expect(summary.textContent?.trim()).toBe("2 servers and the apps on your Codex account");
      expect(describedBy(summary)).toEqual([codexNote]);
      expect(ownRow("Codex · Work").querySelectorAll(".nol-teamrun-own-mcp-servers .nol-teamrun-mcp-sub")).toHaveLength(1);
      expect(ownRow("Codex · Work").querySelector(".nol-teamrun-mcp-server")).toBeNull();
      expect(ownRow("GitHub Copilot · Personal").querySelector(".nol-teamrun-own-mcp-summary")).toBeNull();
      expect(element().textContent).not.toContain(codexNote);
    });

    it("counts a single server in the singular before the few words", async () => {
      kinds = [coveringCodex, copilot, claude];
      servers.set("a1", own("docs"));
      await create();

      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("Codex · Work"))).toEqual(["1 server and the apps on your Codex account"]);
    });

    it("shows a kind's full note on its row where it has no few words, and joins the note after a provider with no servers or no list", async () => {
      kinds = [new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, "Covers apps."), copilot, claude];
      servers.set("a1", []);
      servers.set("a3", null);
      await create();

      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("Codex · Work"))).toEqual(["None set up; Covers apps."]);
      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("GitHub Copilot · Personal"))).toEqual(["Can't list them; uses its own while on"]);
      expect(part(ownRow("GitHub Copilot · Personal"), ".nol-teamrun-own-mcp-summary").hasAttribute("aria-describedby")).toBe(false);
    });

    it("gathers the providers TeamRun holds off on one row, by name, with each kind's reason behind Why", async () => {
      await create(t => t.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), heldCopilot.toJson(), claude.toJson()]));
      const held = part(element(), ".nol-teamrun-own-mcp-held");
      const why = part<HTMLButtonElement>(held, ".nol-teamrun-own-mcp-why");

      expect(texts(".nol-teamrun-own-mcp-name", held)).toEqual(["Claude Code · Office, GitHub Copilot · Personal"]);
      expect(held.textContent).toContain(Resources.ownMcpServersHeld);
      expect(held.querySelector("nol-switch")).toBeNull();
      expect([why.textContent?.trim(), why.getAttribute("aria-expanded"), why.getAttribute("aria-controls")])
        .toEqual([Resources.whyLabel, "false", null]);
      expect(held.querySelector(".nol-teamrun-mcp-reason")).toBeNull();
      why.click();
      await settle();

      expect(texts(".nol-teamrun-mcp-reason", held)).toEqual([claudeReason, copilotReason]);
      expect(part(held, ".nol-teamrun-mcp-reasons").id).toBe(Resources.ownMcpHeldReasonsId);
      expect([why.textContent?.trim(), why.getAttribute("aria-expanded"), why.getAttribute("aria-controls")])
        .toEqual([Resources.hideReasonsLabel, "true", Resources.ownMcpHeldReasonsId]);
      expect(texts(".nol-teamrun-own-mcp-row:not(.nol-teamrun-own-mcp-held) .nol-teamrun-own-mcp-name")).toEqual(["Codex · Work"]);
      why.click();
      await settle();
      expect([held.querySelector(".nol-teamrun-mcp-reason"), why.getAttribute("aria-controls")]).toEqual([null, null]);
    });

    it("names a held provider's own servers on a row of its own, with no switch, when its kind can list them, and keeps it among the held", async () => {
      providers = [SampleData.provider, personal, office, desk];
      servers.set("a6", own("docs", "linear"));
      kinds = [SampleData.codex, copilot, claude, listingCursor];
      await create();
      const listedRow = ownRow("Cursor · Desk");

      expect(texts(".nol-teamrun-own-mcp-listed .nol-teamrun-own-mcp-name")).toEqual(["Cursor · Desk"]);
      expect(texts(".nol-teamrun-mcp-server", listedRow)).toEqual(["docs", "linear"]);
      expect(listedRow.querySelector("nol-switch")).toBeNull();
      expect(texts(".nol-teamrun-own-mcp-name", part(element(), ".nol-teamrun-own-mcp-held"))).toEqual(["Claude Code · Office, Cursor · Desk"]);
      expect(listed()).toContain("a6");
    });

    it("says on a held provider's listed row when its configuration names none, as for a provider that can use them", async () => {
      providers = [SampleData.provider, desk];
      servers.set("a6", []);
      kinds = [SampleData.codex, listingCursor];
      await create();

      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("Cursor · Desk"))).toEqual([Resources.noOwnMcpServers]);
      expect(texts(".nol-teamrun-own-mcp-listed .nol-teamrun-own-mcp-name")).toEqual(["Cursor · Desk"]);
    });

    it("shows no held row when every shown provider can use its own servers", async () => {
      providers = [SampleData.provider, personal];
      await create();

      expect(element().querySelector(".nol-teamrun-own-mcp-held")).toBeNull();
    });

    it("leaves out a provider whose kind TeamRun no longer has, and lists each provider once however often the providers change", async () => {
      providers.push(retired);
      await create();
      context.emit(EventName.ProviderUpdated, SampleData.provider.withCheck(AuthStatus.LoggedOut, null, "1.0", SampleData.timestamp, null).toJson());
      await settle();

      expect(element().textContent).not.toContain("Old");
      expect(listed()).toEqual(["a4", "a1", "a3"]);
    });

    it("says it is reading a provider's configuration until the list comes, as a status", async () => {
      const list = new DeferredResponse();
      await create(t => t.answer(MethodName.ProviderOwnMcpServerList, u => {
        const id = ProviderIdParams.fromJson(u).providerId;
        return id === "a1" ? list.promise : listOf(id);
      }), true, false);
      await Wait.until(() => expect(ownRow("GitHub Copilot · Personal").querySelector(".nol-teamrun-mcp-server")).not.toBeNull());
      const reading = part(ownRow("Codex · Work"), ".nol-teamrun-own-mcp-summary");

      expect([reading.textContent?.trim(), reading.getAttribute("role")]).toEqual([Resources.readingOwnMcpServers, "status"]);
      list.resolve(new ProviderMcpServerList("a1", own("docs")).toJson());
      await Wait.until(() => expect(texts(".nol-teamrun-mcp-server", ownRow("Codex · Work"))).toEqual(["docs"]));
    });

    it("says on the row why a provider's configuration couldn't be read, by its text where the failure isn't an error, and leaves the error line alone", async () => {
      kinds = [coveringCodex, copilot, claude];
      await create(t => t.answer(MethodName.ProviderOwnMcpServerList, u => ProviderIdParams.fromJson(u).providerId === "a1"
        ? Promise.reject(new Error("codex was not found")) : Promise.reject("offline")), true, false);
      const unread = part(ownRow("Codex · Work"), ".nol-teamrun-own-mcp-summary");

      await Wait.until(() => expect([unread.textContent?.trim(), unread.getAttribute("role")])
        .toEqual([Resources.formatOwnMcpServersUnread("codex was not found"), "status"]));
      expect(unread.classList.contains("nol-teamrun-mcp-unread")).toBe(true);
      expect(unread.hasAttribute("aria-describedby")).toBe(false);
      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("GitHub Copilot · Personal"))).toEqual([Resources.formatOwnMcpServersUnread("offline")]);
      expect(context.noticeText()).toBeNull();
      expect(element().querySelector(".nol-teamrun-error")).toBeNull();
    });

    it("switches a provider's own servers on and off, with every switch off while it saves", async () => {
      const saved = new DeferredResponse();
      await create();
      context.answer(MethodName.ProviderUpdate, () => saved.promise);

      ownSwitch("Codex · Work").click();
      await settle();

      expect(updated()).toEqual({ providerId: "a1", label: "Work", profileDir: "D:\\profiles\\codex", ownMcpServers: true });
      expect([isDisabled(ownSwitch("Codex · Work")), isDisabled(ownSwitch("GitHub Copilot · Personal"))]).toEqual([true, true]);

      saved.resolve(SampleData.provider.withOwnMcpServers(true).toJson());
      await settle();

      expect([ownSwitch("Codex · Work").checked, isDisabled(ownSwitch("Codex · Work"))]).toEqual([true, false]);

      context.answer(MethodName.ProviderUpdate, t => personal.withOwnMcpServers(ProviderUpdateParams.fromJson(t).ownMcpServers === true).toJson());
      ownSwitch("GitHub Copilot · Personal").click();
      await settle();

      expect(updated()).toEqual({ providerId: "a3", label: "Personal", profileDir: "D:\\profiles\\copilot", ownMcpServers: false });
      expect(ownSwitch("GitHub Copilot · Personal").checked).toBe(false);
      expect(listed()).toEqual(["a4", "a1", "a3"]);
    });

    it("keeps a refused switch as it was and shows why in the view's error line, not as a notification, until it's dismissed", async () => {
      await create(t => t.fail(MethodName.ProviderUpdate, "Codex can't do that."));

      ownSwitch("Codex · Work").click();
      await settle();

      expect(ownSwitch("Codex · Work").checked).toBe(false);
      expect(texts(".nol-teamrun-error-text")).toEqual(["Codex can't do that."]);
      expect(context.noticeText()).toBeNull();
      part(element(), ".nol-teamrun-dismiss").click();
      await settle();
      expect(element().querySelector(".nol-teamrun-error")).toBeNull();
    });

    it("lists a provider's servers again from its new folder, and keeps them when the old folder's list comes late", async () => {
      const late = new DeferredResponse();
      await create();
      context.answer(MethodName.ProviderOwnMcpServerList, () => late.promise);
      context.emit(EventName.ProviderUpdated, new Provider("a1", "codex", "Work", "D:\\profiles\\codex-2", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null,
        SampleData.timestamp).toJson());
      await settle();

      expect(listed()).toEqual(["a4", "a1", "a3", "a1"]);
      expect(texts(".nol-teamrun-own-mcp-summary", ownRow("Codex · Work"))).toEqual([Resources.readingOwnMcpServers]);

      context.answer(MethodName.ProviderOwnMcpServerList, () => new ProviderMcpServerList("a1", own("notes")).toJson());
      context.emit(EventName.ProviderUpdated, new Provider("a1", "codex", "Work", "D:\\profiles\\codex-3", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null,
        SampleData.timestamp).toJson());
      await Wait.until(() => expect(texts(".nol-teamrun-mcp-server", ownRow("Codex · Work"))).toEqual(["notes"]));
      late.resolve(new ProviderMcpServerList("a1", own("stale")).toJson());
      await settle();

      expect(texts(".nol-teamrun-mcp-server", ownRow("Codex · Work"))).toEqual(["notes"]);
    });

    it("says there are no providers yet and where to add one", async () => {
      providers = [];
      await create();

      expect(texts(".nol-teamrun-mcp-no-providers")).toEqual(["No providers yet. Add one in Providers."]);
      expect(element().querySelector(".nol-teamrun-own-mcp-name")).toBeNull();
    });

    it("says when the provider types failed to load, with Retry and the app's notice that they did, and shows the rows, without either, once they load", async () => {
      kinds = null;
      await create(undefined, false);
      context.emit(EventName.StateInvalidated, null);
      await settle();

      expect(texts(".nol-teamrun-kinds-failed .nol-teamrun-error-text")).toEqual([Resources.kindsUnavailableForMcpServers]);
      expect(element().querySelectorAll("[role=alert]")).toHaveLength(1);
      expect(context.shownNotices(Resources.loadFailedNotice)).toHaveLength(1);
      expect(element().querySelector(".nol-teamrun-own-mcp-name")).toBeNull();
      expect(element().querySelector(".nol-teamrun-mcp-no-providers")).toBeNull();
      expect(listed()).toEqual([]);

      kinds = [SampleData.codex, copilot, claude];
      part(element(), ".nol-teamrun-retry-kinds").click();
      part(element(), ".nol-teamrun-retry-kinds").click();
      await settle();
      await Wait.until(() => expect(texts(".nol-teamrun-own-mcp-name")).toEqual(["Codex · Work", "GitHub Copilot · Personal", "Claude Code · Office"]));

      expect(element().querySelector(".nol-teamrun-kinds-failed")).toBeNull();
      expect(context.shownNotices()).toEqual([]);
      expect(listed()).toEqual(["a4", "a1", "a3"]);
    });
  });

  describe("shared servers", () => {
    const docs = new SharedMcpServer("s1", new SharedMcpServerDefinition("docs", SharedMcpTransport.Stdio, "npx", ["docs-mcp", "--stdio"], ["DOCS_KEY"], null, [], null),
      ["a1"], [new SharedMcpTeammateSetting("bob", SharedMcpSetting.Off)], SampleData.timestamp, SampleData.timestamp);
    const tracker = new SharedMcpServer("s2", new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp",
      [new SharedMcpHeader("X-Team", "TRACKER_TEAM")], null), ["a3"], [new SharedMcpTeammateSetting("alice", SharedMcpSetting.On)], SampleData.timestamp,
    SampleData.timestamp);
    const wiki = new SharedMcpServer("s3", new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example/mcp", [], null, true),
      [], [], SampleData.timestamp, SampleData.timestamp);
    const unsupported = "TeamRun doesn't pass shared MCP servers to Claude Code yet.";
    const signInReference = "teamrun.mcpSignIn0123456789abcdef0123456789abcdef";
    const row = (name: string): HTMLButtonElement => {
      const found = [...element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-shared-mcp-row")].find(t => t.querySelector(".nol-teamrun-item-name")?.textContent === name);
      if (Object.isUndefined(found))
        throw new Error(`No shared server row shows ${name}.`);
      return found;
    };
    const details = (): HTMLElement => part(element(), ".nol-teamrun-mcp-details");
    const providerSwitches = (): [string, boolean, boolean][] => [...details().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-provider")].map(t => {
      const input = toggle(t);
      return [texts(".nol-teamrun-mcp-line-name", t).join(), input.checked, isDisabled(input)];
    });
    const providerSwitch = (provider: string): HTMLInputElement => {
      const found = [...details().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-provider")]
        .find(t => t.querySelector(".nol-teamrun-mcp-line-name")?.textContent?.trim() === provider);
      if (Object.isUndefined(found))
        throw new Error(`The details have no switch for ${provider}.`);
      return toggle(found);
    };
    const exceptions = (): [string, string][] => [...details().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-exception")]
      .map(t => [texts(".nol-teamrun-shared-mcp-teammate-name", t).join(), texts(".nol-choice-pill-selected", t).join()]);
    const pill = (teammate: string, choice: string): HTMLButtonElement => {
      const exception = [...details().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-exception")]
        .find(t => t.querySelector(".nol-teamrun-shared-mcp-teammate-name")?.textContent === teammate);
      const found = [...exception?.querySelectorAll<HTMLButtonElement>(".nol-choice-pill") ?? []].find(t => t.textContent?.trim() === choice);
      if (Object.isUndefined(found))
        throw new Error(`${teammate}'s exception has no ${choice}.`);
      return found;
    };
    const inDialog = <T extends HTMLElement>(selector: string): T => {
      const found = document.querySelector<T>(`nol-dialog ${selector}`);
      if (Object.isNull(found))
        throw new Error(`No dialog shows ${selector}.`);
      return found;
    };
    const listedShared = (): Promise<void> => Wait.until(() => expect(element().querySelector(".nol-teamrun-shared-mcp-row")).not.toBeNull());
    const choose = async (name: string): Promise<void> => {
      row(name).click();
      await Wait.until(() => expect(details().getAttribute("aria-label")).toBe(name));
    };

    beforeEach(() => {
      teammates = [new Teammate("alice", "Alice", null, "a1", Harness.Provider, null, null, "t", "t"),
        new Teammate("bob", "Bob", null, "a3", Harness.Provider, null, null, "t", "t")];
      shared = [new SharedMcpServerListing(docs, []), new SharedMcpServerListing(tracker, [new SharedMcpUnavailability("a4", unsupported, "not passed yet")])];
    });

    afterEach(() => document.querySelector<HTMLButtonElement>(".nol-teamrun-cancel")?.click());

    it("lists each server with its command or HTTP, the providers it is on for, how many more can take it, and the first one chosen", async () => {
      await create();
      await listedShared();

      expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker"]);
      expect(texts(".nol-teamrun-shared-mcp-state")).toEqual(["npx docs-mcp --stdio", "HTTP"]);
      expect(texts(".nol-teamrun-shared-mcp-on nol-chip:not(.nol-teamrun-shared-mcp-can)", row("docs"))).toEqual(["Codex · Work"]);
      expect(texts(".nol-teamrun-shared-mcp-can", row("docs"))).toEqual(["+ 2 can"]);
      expect(texts(".nol-teamrun-shared-mcp-on nol-chip:not(.nol-teamrun-shared-mcp-can)", row("tracker"))).toEqual(["GitHub Copilot · Personal"]);
      expect(texts(".nol-teamrun-shared-mcp-can", row("tracker"))).toEqual(["+ 1 can"]);
      expect([row("docs").getAttribute("aria-current"), row("tracker").getAttribute("aria-current")]).toEqual(["true", "false"]);
      expect([row("docs").getAttribute("aria-label"), row("docs").getAttribute("aria-controls")]).toEqual(["docs, npx docs-mcp --stdio", Resources.sharedMcpDetailsId]);
      expect([details().id, details().getAttribute("role"), details().getAttribute("aria-label")]).toEqual([Resources.sharedMcpDetailsId, "region", "docs"]);
      expect(texts(".nol-teamrun-shared-mcp-command", details())).toEqual(["npx docs-mcp --stdio"]);
      expect(row("docs").classList.contains("nol-teamrun-mcp-row-chosen")).toBe(true);
    });

    it("marks a server ready, or says which variables aren't set or how its sign-in stands, on its row", async () => {
      shared = [new SharedMcpServerListing(docs, [], [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)]),
        new SharedMcpServerListing(tracker, [], [new SharedMcpVariable("TRACKER_TEAM", SharedMcpVariableSource.Environment, true)]),
        new SharedMcpServerListing(wiki, [])];
      await create();
      await listedShared();
      const dot = (name: string): string[] => [...part(row(name), ".nol-teamrun-status-dot").classList].filter(t => t.startsWith("nol-teamrun-status-dot-"));

      expect(texts(".nol-teamrun-shared-mcp-state")).toEqual(["npx docs-mcp --stdio · DOCS_KEY not set", "HTTP", "HTTP · not signed in"]);
      expect([dot("docs"), dot("tracker"), dot("wiki")]).toEqual([["nol-teamrun-status-dot-warning"], ["nol-teamrun-status-dot-connected"],
        ["nol-teamrun-status-dot-warning"]]);
    });

    it("shows a chosen server's details beside the list, keeping a choice across reads and folding its reasons again for another server", async () => {
      await create();
      await listedShared();

      await choose("tracker");
      part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-show").click();
      await settle();

      expect([row("docs").getAttribute("aria-current"), row("tracker").getAttribute("aria-current")]).toEqual(["false", "true"]);
      expect(texts(".nol-teamrun-shared-mcp-command", details())).toEqual(["https://tracker.example/mcp"]);
      context.emit(EventName.StateInvalidated, null);
      await settle();
      expect(details().getAttribute("aria-label")).toBe("tracker");
      expect(details().querySelector(".nol-teamrun-shared-mcp-reason")).not.toBeNull();
      await choose("tracker");
      expect(details().querySelector(".nol-teamrun-shared-mcp-reason")).not.toBeNull();

      await choose("docs");
      await choose("tracker");
      expect(details().querySelector(".nol-teamrun-shared-mcp-reason")).toBeNull();
    });

    it("gives a switch to each provider that can take the server, on where it is on, and folds those that can't into one line by their short reasons", async () => {
      providers = [...providers, new Provider("a6", "claude", "Home", "D:\\profiles\\claude-home", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp)];
      shared = [new SharedMcpServerListing(docs, [new SharedMcpUnavailability("a4", unsupported, "not passed yet"),
        new SharedMcpUnavailability("a3", "GitHub Copilot refuses a stdio MCP server TeamRun passes it, and takes only HTTP ones.", "takes HTTP servers only"),
        new SharedMcpUnavailability("a6", unsupported, "not passed yet")])];
      await create();
      await listedShared();
      const show = part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-show");

      expect(providerSwitches()).toEqual([["Codex · Work", true, false]]);
      expect(providerSwitch("Codex · Work").getAttribute("aria-label")).toBe("docs for Codex · Work");
      expect(texts(".nol-teamrun-shared-mcp-refused .nol-teamrun-mcp-line-name", details())).toEqual(["3 can't take it yet"]);
      expect(texts(".nol-teamrun-shared-mcp-reason-group", details())).toEqual(["Claude Code · Home, Claude Code · Office: not passed yet",
        "GitHub Copilot · Personal: takes HTTP servers only"]);
      expect([show.textContent?.trim(), show.getAttribute("aria-expanded"), show.getAttribute("aria-controls")])
        .toEqual([Resources.showReasonsLabel, "false", Resources.sharedMcpRefusedId]);
      expect(part(details(), ".nol-teamrun-mcp-reason-groups").id).toBe(Resources.sharedMcpRefusedId);

      show.click();
      await settle();

      expect(texts(".nol-teamrun-shared-mcp-reason", details())).toEqual([unsupported, unsupported,
        "GitHub Copilot refuses a stdio MCP server TeamRun passes it, and takes only HTTP ones."]);
      expect(part(details(), ".nol-teamrun-mcp-reasons").id).toBe(Resources.sharedMcpRefusedId);
      expect([show.textContent?.trim(), show.getAttribute("aria-expanded")]).toEqual([Resources.hideReasonsLabel, "true"]);
      expect(details().querySelector(".nol-teamrun-shared-mcp-reason-group")).toBeNull();
    });

    it("folds a reason with no short form by its full sentence, and shows no fold when every provider can take the server", async () => {
      shared = [new SharedMcpServerListing(docs, [new SharedMcpUnavailability("a4", unsupported)]), new SharedMcpServerListing(tracker, [])];
      await create();
      await listedShared();

      expect(texts(".nol-teamrun-shared-mcp-reason-group", details())).toEqual([`Claude Code · Office: ${unsupported}`]);
      await choose("tracker");
      expect(details().querySelector(".nol-teamrun-shared-mcp-refused")).toBeNull();
      expect(providerSwitches().map(t => t[0])).toEqual(["Claude Code · Office", "Codex · Work", "GitHub Copilot · Personal"]);
    });

    it("says the teammates follow their provider, who gets the server, and each exception with its choice", async () => {
      await create();
      await listedShared();

      expect(texts(".nol-teamrun-shared-mcp-teammates .nol-teamrun-mcp-group-heading", details())).toEqual([Resources.sharedMcpTeammatesHeading]);
      expect(details().textContent).toContain(Resources.sharedMcpTeammatesFollow);
      expect(texts(".nol-teamrun-shared-mcp-reach nol-chip", details())).toEqual(["Alice"]);
      expect(exceptions()).toEqual([["Bob", "Off"]]);
      expect([...details().querySelectorAll(".nol-teamrun-shared-mcp-exception .nol-choice-pill")].map(t => t.textContent?.trim())).toEqual(["On", "Off"]);
      expect(part(details(), ".nol-teamrun-shared-mcp-remove-exception").getAttribute("aria-label")).toBe("Remove Bob's exception");

      await choose("tracker");
      expect(texts(".nol-teamrun-shared-mcp-reach nol-chip", details())).toEqual(["Alice", "Bob"]);
      expect(exceptions()).toEqual([["Alice", "On"]]);
    });

    it("says none gets the server and there are no exceptions", async () => {
      shared = [new SharedMcpServerListing(new SharedMcpServer("s1", docs.definition, [], [], SampleData.timestamp, SampleData.timestamp), [])];
      await create();
      await listedShared();

      expect(texts(".nol-teamrun-shared-mcp-reach .nol-teamrun-mcp-sub", details())).toEqual([Resources.sharedMcpNoneLabel]);
      expect(texts(".nol-teamrun-shared-mcp-exceptions .nol-teamrun-mcp-sub", details())).toEqual([Resources.sharedMcpNoneLabel]);
      expect(details().querySelector(".nol-teamrun-shared-mcp-exception-list")).toBeNull();
    });

    it("says there are no teammates yet, with no reach or exceptions", async () => {
      teammates = [];
      await create();
      await listedShared();

      expect(details().textContent).toContain(Resources.noTeammatesForSharedMcp);
      expect(details().querySelector(".nol-teamrun-shared-mcp-reach")).toBeNull();
      expect(details().querySelector(".nol-teamrun-shared-mcp-add-exception")).toBeNull();
    });

    it("adds an exception from the menu of followers, Off for one that gets the server and On for one that doesn't, and removes it again", async () => {
      shared = [new SharedMcpServerListing(new SharedMcpServer("s1", docs.definition, ["a1"], [], SampleData.timestamp, SampleData.timestamp), [])];
      await create();
      await listedShared();
      const add = async (teammate: string): Promise<void> => {
        part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-add-exception").click();
        await Wait.until(() => expect(document.querySelector(".nol-teamrun-shared-mcp-exception-choice")).not.toBeNull());
        const choice = [...document.querySelectorAll<HTMLButtonElement>(".nol-teamrun-shared-mcp-exception-choice")].find(t => t.textContent?.trim() === teammate);
        if (Object.isUndefined(choice))
          throw new Error(`The menu offers no ${teammate}.`);
        choice.click();
      };

      await add("Alice");
      await Wait.until(() => expect(exceptions()).toEqual([["Alice", "Off"]]));
      await add("Bob");
      await Wait.until(() => expect(exceptions()).toEqual([["Alice", "Off"], ["Bob", "On"]]));

      expect(details().querySelector(".nol-teamrun-shared-mcp-add-exception")).toBeNull();
      pill("Bob", "Off").click();
      await Wait.until(() => expect(exceptions()).toEqual([["Alice", "Off"], ["Bob", "Off"]]));
      part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-remove-exception").click();
      await Wait.until(() => expect(exceptions()).toEqual([["Bob", "Off"]]));
      expect(texts(".nol-teamrun-shared-mcp-reach nol-chip", details())).toEqual(["Alice"]);

      expect(sent(MethodName.SharedMcpTeammateSet)).toEqual([new SharedMcpTeammateSetParams("s1", "alice", SharedMcpSetting.Off).toJson(),
        new SharedMcpTeammateSetParams("s1", "bob", SharedMcpSetting.On).toJson(), new SharedMcpTeammateSetParams("s1", "bob", SharedMcpSetting.Off).toJson(),
        new SharedMcpTeammateSetParams("s1", "alice", SharedMcpSetting.AsProvider).toJson()]);
    });

    it("switches a server on and off for a provider through the runtime part, showing what it saved on the switch and the row", async () => {
      await create();
      await listedShared();
      await choose("tracker");

      providerSwitch("Codex · Work").click();
      await Wait.until(() => expect(providerSwitches().map(t => t[1])).toEqual([true, true]));
      providerSwitch("GitHub Copilot · Personal").click();
      await Wait.until(() => expect(providerSwitches().map(t => t[1])).toEqual([true, false]));

      expect(texts(".nol-teamrun-shared-mcp-on nol-chip:not(.nol-teamrun-shared-mcp-can)", row("tracker"))).toEqual(["Codex · Work"]);
      expect(sent(MethodName.SharedMcpProviderSet)).toEqual([new SharedMcpProviderSetParams("s2", "a1", true).toJson(),
        new SharedMcpProviderSetParams("s2", "a3", false).toJson()]);
    });

    it("keeps a refused switch and a refused choice as they were and shows why in the view's error line until it's dismissed", async () => {
      await create(t => t.answer(MethodName.SharedMcpProviderSet, () => {
        throw new Error("The provider was deleted.");
      }).answer(MethodName.SharedMcpTeammateSet, () => {
        throw new Error("The teammate was deleted.");
      }));
      await listedShared();

      providerSwitch("Claude Code · Office").click();
      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The provider was deleted."]));
      expect(providerSwitch("Claude Code · Office").checked).toBe(false);
      pill("Bob", "On").click();
      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The teammate was deleted."]));
      await settle();
      expect(exceptions()).toEqual([["Bob", "Off"]]);

      part(element(), ".nol-teamrun-dismiss").click();
      await settle();
      expect(element().querySelector(".nol-teamrun-error")).toBeNull();
    });

    it("says it is reading the servers, then that none is added yet, with no details", async () => {
      const read = new DeferredResponse();
      shared = [];
      await create(t => t.answer(MethodName.SharedMcpServerList, () => read.promise));

      expect(texts(".nol-teamrun-shared-mcp-reading")).toEqual([Resources.readingSharedMcpServers]);
      expect(part(element(), ".nol-teamrun-shared-mcp-reading").getAttribute("role")).toBe("status");
      read.resolve([]);
      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-none")).toEqual([Resources.noSharedMcpServers]));
      expect(element().querySelector(".nol-teamrun-shared-mcp-reading")).toBeNull();
      expect(element().querySelector(".nol-teamrun-mcp-details")).toBeNull();
    });

    it("says in the list why the servers couldn't be read, by its text where the failure isn't an error, and reads them again from Retry", async () => {
      let failure: unknown = new Error("The runtime is restarting.");
      await create(t => t.answer(MethodName.SharedMcpServerList, () => {
        if (!Object.isNull(failure))
          return Promise.reject(failure);
        return shared.map(u => u.toJson());
      }));

      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-list .nol-teamrun-mcp-unread"))
        .toEqual([Resources.formatSharedMcpServersUnread("The runtime is restarting.")]));
      expect(element().querySelector(".nol-teamrun-error")).toBeNull();
      failure = "offline";
      part<HTMLButtonElement>(element(), ".nol-teamrun-retry-shared").click();
      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-list .nol-teamrun-mcp-unread")).toEqual([Resources.formatSharedMcpServersUnread("offline")]));
      failure = null;
      part<HTMLButtonElement>(element(), ".nol-teamrun-retry-shared").click();

      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker"]));
      expect(element().querySelector(".nol-teamrun-shared-mcp-list .nol-teamrun-mcp-unread")).toBeNull();
    });

    it("keeps the rows and says in the view's error line when the servers can't be read again after a change", async () => {
      await create();
      await listedShared();
      context.answer(MethodName.SharedMcpServerList, () => {
        throw new Error("The runtime is restarting.");
      });

      pill("Bob", "On").click();

      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual([Resources.formatSharedMcpServersUnread("The runtime is restarting.")]));
      expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker"]);
    });

    it("adds a server through its dialog and lists it, off for every provider", async () => {
      await create(t => t.answer(MethodName.SharedMcpServerCreate, u => {
        const server = new SharedMcpServer("s4", SharedMcpServerDefinition.fromJson(u), [], [], SampleData.timestamp, SampleData.timestamp);
        shared = [...shared, new SharedMcpServerListing(server, [])];
        return server.toJson();
      }));

      part(element(), ".nol-teamrun-add-shared-mcp").click();
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe(Resources.addSharedMcpServerTitle));
      for (const [name, text] of [["name", "notes"], ["command", "notes-mcp"]] as const) {
        const input = inDialog<HTMLInputElement>(`.nol-teamrun-shared-mcp-${name}`);
        input.value = text;
        input.dispatchEvent(new Event("input"));
      }
      await settle();
      inDialog<HTMLButtonElement>(".nol-teamrun-save").click();

      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker", "notes"]));
      expect(document.querySelector(".nol-dialog-title")).toBeNull();
      await choose("notes");
      expect(providerSwitches().map(t => t[1])).toEqual([false, false, false]);
      expect(row("notes").querySelector(".nol-teamrun-shared-mcp-on nol-chip:not(.nol-teamrun-shared-mcp-can)")).toBeNull();
    });

    it("offers GitHub's own server once signed in to GitHub until one is listed, and adds it off for every provider without a dialog", async () => {
      await create(t => t.answerModule("git-github.readSignIn", () => ({ state: "SignedOut" })).answer(MethodName.SharedMcpServerCreate, u => {
        const server = new SharedMcpServer("s5", SharedMcpServerDefinition.fromJson(u), [], [], SampleData.timestamp, SampleData.timestamp);
        shared = [...shared, new SharedMcpServerListing(server, [])];
        return server.toJson();
      }));
      await listedShared();
      const signedOut = element().querySelector(".nol-teamrun-add-github-mcp");
      context.emitModule("git-github.signInChanged", { state: "SignedIn" });
      await settle();
      const offer = part<HTMLButtonElement>(element(), ".nol-teamrun-add-github-mcp");
      expect([signedOut, offer.textContent?.trim()]).toEqual([null, Resources.addGitHubMcpServerLabel]);

      offer.click();

      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker", "github"]));
      expect(JSON.stringify(sent(MethodName.SharedMcpServerCreate))).toBe(JSON.stringify([SharedMcpServerDefinition.gitHub.toJson()]));
      expect(document.querySelector(".nol-dialog-title")).toBeNull();
      expect(element().querySelector(".nol-teamrun-add-github-mcp")).toBeNull();
      await choose("github");
      expect(providerSwitches().map(t => t[1])).toEqual([false, false, false]);
    });

    for (const [name, url, isOffered] of [["github", "https://example.com/mcp/", false], ["copilot", "https://api.githubcopilot.com/mcp/x/repos", false],
      ["lookalike", "https://api.githubcopilot.com.example.com/mcp/", true]] as const)
      it(`${isOffered ? "still offers" : "doesn't offer"} GitHub's server while ${name} at ${url} is listed`, async () => {
        shared = [new SharedMcpServerListing(new SharedMcpServer("s5", new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], url, [], "GITHUB_TOKEN"),
          [], [], SampleData.timestamp, SampleData.timestamp), [])];
        let isRead = false;
        await create(t => t.answerModule("git-github.readSignIn", () => {
          isRead = true;
          return { state: "SignedIn" };
        }));
        await listedShared();
        await Wait.until(() => expect(isRead).toBe(true));
        await settle();

        expect(texts(".nol-teamrun-add-github-mcp")).toEqual(isOffered ? [Resources.addGitHubMcpServerLabel] : []);
      });

    it("says why GitHub's server wasn't added and keeps offering it", async () => {
      await create(t => t.answerModule("git-github.readSignIn", () => ({ state: "SignedIn" })).fail(MethodName.SharedMcpServerCreate, "The database is locked."));
      await listedShared();
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-add-github-mcp")).not.toBeNull());
      const lists = sent(MethodName.SharedMcpServerList).length;

      part<HTMLButtonElement>(element(), ".nol-teamrun-add-github-mcp").click();

      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The database is locked."]));
      expect([sent(MethodName.SharedMcpServerList).length, texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")]).toEqual([lists, ["docs", "tracker"]]);
      expect(element().querySelector(".nol-teamrun-add-github-mcp")).not.toBeNull();
    });

    it("shows GitHub's server amber while signed out of GitHub or while the GitHub module doesn't answer, and green once signed in", async () => {
      shared = [new SharedMcpServerListing(new SharedMcpServer("s5", SharedMcpServerDefinition.gitHub, [], [], SampleData.timestamp, SampleData.timestamp), [])];
      const dot = (): string[] => [...part(row("github"), ".nol-teamrun-status-dot").classList].filter(t => t.startsWith("nol-teamrun-status-dot-"));
      await create();
      await listedShared();
      const unanswered = dot();
      context.emitModule("git-github.signInChanged", { state: "SignedIn" });
      await settle();
      const signedIn = dot();
      context.emitModule("git-github.signInChanged", { state: "SignedOut" });
      await settle();

      expect([unanswered, signedIn, dot()]).toEqual([["nol-teamrun-status-dot-warning"], ["nol-teamrun-status-dot-connected"], ["nol-teamrun-status-dot-warning"]]);
      expect(element().querySelector(".nol-teamrun-add-github-mcp")).toBeNull();
    });

    const savedThroughDialog = async (): Promise<void> => {
      part(details(), ".nol-teamrun-edit").click();
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe(Resources.editSharedMcpServerTitle));
      const secret = inDialog<HTMLInputElement>(".nol-teamrun-shared-mcp-secret");
      secret.value = "fixture-value";
      secret.dispatchEvent(new Event("input"));
      await settle();
      inDialog<HTMLButtonElement>(".nol-teamrun-save").click();
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-shared-mcp-secrets-saved")).not.toBeNull());
    };

    it("reports the secrets a dialog saved in a line and through the announcer, and takes it away on Dismiss, on a save without one and on a delete", async () => {
      shared = [new SharedMcpServerListing(docs, [], [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)])];
      await create(t => t.answer(MethodName.SharedMcpServerUpdate, () => docs.toJson()).answer(MethodName.SharedMcpSecretSet, () => docs.toJson()));
      await listedShared();
      const note = (): Element | null => element().querySelector(".nol-teamrun-shared-mcp-secrets-saved-text");
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");

      await savedThroughDialog();

      expect(note()?.textContent?.trim()).toBe(Resources.formatSharedMcpSecretsSaved("docs", ["DOCS_KEY"]));
      expect(element().querySelector(".nol-teamrun-shared-mcp-secrets-saved")?.getAttribute("role")).toBeNull();
      expect(announce.mock.calls.at(-1)).toEqual([Resources.formatSharedMcpSecretsSaved("docs", ["DOCS_KEY"]), AnnouncementPoliteness.Polite]);
      expect(document.body.innerHTML).not.toContain("fixture-value");
      part<HTMLButtonElement>(element(), ".nol-teamrun-shared-mcp-secrets-saved .nol-teamrun-dismiss").click();
      await Wait.until(() => expect(note()).toBeNull());

      await savedThroughDialog();
      part(details(), ".nol-teamrun-edit").click();
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe(Resources.editSharedMcpServerTitle));
      inDialog<HTMLButtonElement>(".nol-teamrun-cancel").click();
      await Wait.until(() => expect(note()).toBeNull());

      await savedThroughDialog();
      part(details(), ".nol-teamrun-delete").click();
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-confirm")).not.toBeNull());
      inDialog<HTMLButtonElement>(".nol-teamrun-confirm").click();
      await Wait.until(() => expect(note()).toBeNull());
    });

    it("edits the chosen server in its dialog with its fields filled in and where each variable takes its value from", async () => {
      shared = [new SharedMcpServerListing(docs, [], [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Saved, true)]),
        new SharedMcpServerListing(tracker, [])];
      await create();
      await listedShared();
      await choose("tracker");

      expect([part(details(), ".nol-teamrun-edit").getAttribute("aria-label"), part(details(), ".nol-teamrun-delete").getAttribute("aria-label")])
        .toEqual(["Edit tracker", "Delete server tracker"]);
      expect(texts(".nol-teamrun-mcp-actions button", details())).toEqual([Resources.editLabel, Resources.deleteLabel]);
      part(details(), ".nol-teamrun-edit").click();
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe(Resources.editSharedMcpServerTitle));
      expect([inDialog<HTMLInputElement>(".nol-teamrun-shared-mcp-name").value, inDialog<HTMLInputElement>(".nol-teamrun-shared-mcp-url").value])
        .toEqual(["tracker", "https://tracker.example/mcp"]);
      inDialog<HTMLButtonElement>(".nol-teamrun-cancel").click();
      await Wait.until(() => expect(document.querySelector(".nol-dialog-title")).toBeNull());

      await choose("docs");
      part(details(), ".nol-teamrun-edit").click();
      await Wait.until(() => expect(inDialog(".nol-teamrun-shared-mcp-saved").textContent?.trim()).toBe(Resources.sharedMcpSecretSavedLabel));
      expect(document.querySelector("nol-dialog .nol-teamrun-shared-mcp-secret")).toBeNull();
      expect(sent(MethodName.SharedMcpServerUpdate)).toEqual([]);
      expect(context.secretStore.values.size).toBe(0);
    });

    it("deletes a server once it's confirmed, keeps it when the confirmation is closed, and chooses the next one", async () => {
      await create();
      await listedShared();

      part(details(), ".nol-teamrun-delete").click();
      await Wait.until(() => expect(inDialog(".nol-teamrun-confirm").textContent?.trim()).toBe(Resources.deleteSharedMcpServerLabel));
      expect(document.querySelector("nol-dialog")?.textContent).toContain(Resources.formatDeleteSharedMcpServer("docs"));
      inDialog<HTMLButtonElement>(".nol-teamrun-cancel").click();
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-confirm")).toBeNull());
      expect(sent(MethodName.SharedMcpServerDelete)).toEqual([]);

      part(details(), ".nol-teamrun-delete").click();
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-confirm")).not.toBeNull());
      inDialog<HTMLButtonElement>(".nol-teamrun-confirm").click();

      await Wait.until(() => expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["tracker"]));
      expect(sent(MethodName.SharedMcpServerDelete)).toEqual([new SharedMcpServerIdParams("s1").toJson()]);
      expect(details().getAttribute("aria-label")).toBe("tracker");
    });

    it("keeps a server whose delete the runtime part refuses, and shows why in the view's error line", async () => {
      await create(t => t.answer(MethodName.SharedMcpServerDelete, () => {
        throw new Error("The database is busy.");
      }));
      await listedShared();

      part(details(), ".nol-teamrun-delete").click();
      await Wait.until(() => expect(document.querySelector(".nol-teamrun-confirm")).not.toBeNull());
      inDialog<HTMLButtonElement>(".nol-teamrun-confirm").click();

      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The database is busy."]));
      expect(texts(".nol-teamrun-shared-mcp-row .nol-teamrun-item-name")).toEqual(["docs", "tracker"]);
      expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.SharedMcpServerList))).toHaveLength(1);
    });

    it("shows a server that signs in with its sign-in's state, starts the sign-in in the browser, shows it waiting, and reads the servers again when it changes", async () => {
      const signedIn = (needsSignIn: string | null): SharedMcpServerListing => new SharedMcpServerListing(new SharedMcpServer(wiki.id, wiki.definition, [], [],
        wiki.createdAt, wiki.updatedAt, [], new SharedMcpSignIn(signInReference, null, needsSignIn, SampleData.timestamp)), []);
      shared = [new SharedMcpServerListing(wiki, [])];
      await create(t => t
        .answer(MethodName.SharedMcpSignInStart, () => new SharedMcpSignInStarted("https://auth.example/authorize?state=1").toJson())
        .answer(MethodName.SharedMcpSignOut, () => {
          shared = [new SharedMcpServerListing(wiki, [])];
          return wiki.toJson();
        }));
      await listedShared();
      const action = (): HTMLButtonElement => part(details(), ".nol-teamrun-shared-mcp-sign-in button");
      const state = (): string[] => texts(".nol-teamrun-shared-mcp-sign-in-state", details());

      const unsigned = [state(), action().textContent?.trim(), action().getAttribute("aria-label")];
      action().click();
      await Wait.until(() => expect(context.links).toEqual(["https://auth.example/authorize?state=1"]));
      shared = [new SharedMcpServerListing(wiki, [], [], true)];
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(state()).toEqual([Resources.sharedMcpSigningIn]));
      const waiting = [action().textContent?.trim(), texts(".nol-teamrun-shared-mcp-state", row("wiki"))];
      shared = [signedIn(null)];
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(state()).toEqual([Resources.sharedMcpSignedIn]));
      const signedInAction = [action().textContent?.trim(), action().getAttribute("aria-label"), texts(".nol-teamrun-shared-mcp-state", row("wiki"))];
      action().click();
      await Wait.until(() => expect(state()).toEqual([Resources.sharedMcpNotSignedIn]));
      shared = [signedIn("The server refused the refresh.")];
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(state()).toEqual([Resources.formatSharedMcpSignInNeeded("The server refused the refresh.")]));

      expect(unsigned).toEqual([[Resources.sharedMcpNotSignedIn], "Sign in", "Sign in to wiki"]);
      expect(sent(MethodName.SharedMcpSignInStart)).toEqual([new SharedMcpServerIdParams(wiki.id).toJson()]);
      expect(waiting).toEqual(["Sign in", ["HTTP · waiting for the browser"]]);
      expect(signedInAction).toEqual(["Sign out", "Sign out of wiki", ["HTTP · signed in"]]);
      expect(sent(MethodName.SharedMcpSignOut)).toEqual([new SharedMcpServerIdParams(wiki.id).toJson()]);
      expect(texts(".nol-teamrun-shared-mcp-state", row("wiki"))).toEqual(["HTTP · needs a new sign-in"]);
    });

    it("starts a sign-in in the browser with how the person opened it, a click, Ctrl+click or a middle click, and not with the right button", async () => {
      shared = [new SharedMcpServerListing(wiki, [])];
      await create(t => t.answer(MethodName.SharedMcpSignInStart, () => new SharedMcpSignInStarted("https://auth.example/authorize?state=1").toJson()));
      await listedShared();
      const action = part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-sign-in button");

      action.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));
      await Wait.until(() => expect([context.links.length, action.disabled]).toEqual([1, false]));
      action.dispatchEvent(new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true }));
      await Wait.until(() => expect([context.links.length, action.disabled]).toEqual([2, false]));
      action.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
      action.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
      await Wait.until(() => expect([context.links.length, action.disabled]).toEqual([3, false]));

      expect([context.links, context.linkGestures, sent(MethodName.SharedMcpSignInStart).length])
        .toEqual([Array(3).fill("https://auth.example/authorize?state=1"), [LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle], 3]);
    });

    it("starts a sign-in in the system's browser while the in-app browser places links in the app", async () => {
      shared = [new SharedMcpServerListing(wiki, [])];
      await create(t => t.answer(MethodName.SharedMcpSignInStart, () => new SharedMcpSignInStarted("https://auth.example/authorize?state=1").toJson()));
      const browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
      context.registerInAppBrowser(browser);
      await listedShared();
      const action = part<HTMLButtonElement>(details(), ".nol-teamrun-shared-mcp-sign-in button");

      action.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true }));
      await Wait.until(() => expect([context.links.length, action.disabled]).toEqual([1, false]));

      expect(context.linkPlaces.map(t => t ?? browser.placeFor())).toEqual([LinkPlace.System]);
    });

    it("shows no sign-in for a server that doesn't sign in", async () => {
      await create();
      await listedShared();

      expect(details().querySelector(".nol-teamrun-shared-mcp-sign-in")).toBeNull();
    });

    it("shows why a sign-in couldn't start in the view's error line, opening nothing", async () => {
      shared = [new SharedMcpServerListing(wiki, [])];
      await create(t => t.answer(MethodName.SharedMcpSignInStart, () => {
        throw new Error("The server offers no sign-in.");
      }));
      await listedShared();

      part(details(), ".nol-teamrun-shared-mcp-sign-in button").click();

      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The server offers no sign-in."]));
      expect(context.links).toEqual([]);
    });

    it("shows why a sign-out was refused in the view's error line, keeping the sign-in without reading the servers again", async () => {
      shared = [new SharedMcpServerListing(new SharedMcpServer("s3", wiki.definition, [], [], SampleData.timestamp, SampleData.timestamp, [],
        new SharedMcpSignIn(signInReference, null, null, SampleData.timestamp)), [])];
      await create(t => t.answer(MethodName.SharedMcpSignOut, () => {
        throw new Error("The database is busy.");
      }));
      await listedShared();

      part(details(), ".nol-teamrun-shared-mcp-sign-in button").click();

      await Wait.until(() => expect(texts(".nol-teamrun-error-text")).toEqual(["The database is busy."]));
      expect(texts(".nol-teamrun-shared-mcp-sign-in-state", details())).toEqual([Resources.sharedMcpSignedIn]);
      expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.SharedMcpServerList))).toHaveLength(1);
    });

    describe.each([
      { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
      { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
      { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
    ])("in $look", ({ mode, forcedColors }) => {
      const rect = (target: Element): DOMRect => target.getBoundingClientRect();
      const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
      const rem = (value: number): number => value * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const inner = (target: Element): { left: number; right: number; top: number } => {
        const box = rect(target);
        const style = getComputedStyle(target);
        return { left: box.left + Number.parseFloat(style.borderLeftWidth), right: box.right - Number.parseFloat(style.borderRightWidth),
          top: box.top + Number.parseFloat(style.borderTopWidth) };
      };
      const shown = async (): Promise<void> => {
        shared = [new SharedMcpServerListing(docs, [new SharedMcpUnavailability("a4", unsupported, "not passed yet")]),
          new SharedMcpServerListing(tracker, [], [new SharedMcpVariable("TRACKER_TEAM", SharedMcpVariableSource.Environment, false)]),
          new SharedMcpServerListing(new SharedMcpServer("s3", wiki.definition, [], [], SampleData.timestamp, SampleData.timestamp, [],
            new SharedMcpSignIn(signInReference, null, null, SampleData.timestamp)), [])];
        await create();
        await listedShared();
        element().style.width = "64rem";
        await settle();
        await choose("wiki");
      };

      beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

      beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

      afterEach(() => AppearanceFixture.reset());

      afterAll(() => EmulatedMediaFixture.resetAsync());

      it("puts GitHub's offer a space-2 before Add server, centred on it, with Add server still ending with the list", async () => {
        await shown();
        context.emitModule("git-github.signInChanged", { state: "SignedIn" });
        await settle();
        const offer = rect(part(element(), ".nol-teamrun-add-github-mcp"));
        const add = rect(part(element(), ".nol-teamrun-add-shared-mcp"));

        AppearanceFixture.expectPixels(add.left - offer.right, space(2));
        AppearanceFixture.expectPixels(offer.top + offer.height / 2, add.top + add.height / 2);
        AppearanceFixture.expectPixels(add.right, rect(part(element(), ".nol-teamrun-shared-mcp-list")).right);
      });

      it("tops the details panel at the first list's top, not its heading, in its own column a space-4 after the lists, which end together", async () => {
        await shown();
        const sharedList = rect(part(element(), ".nol-teamrun-shared-mcp-list"));
        const ownList = rect(part(element(), ".nol-teamrun-own-mcp-list"));
        const panel = rect(details());
        const heading = rect(part(element(), ".nol-teamrun-shared-mcp-head"));

        AppearanceFixture.expectPixels(panel.top, sharedList.top);
        expect(panel.top).toBeGreaterThan(heading.bottom);
        AppearanceFixture.expectPixels(panel.left - sharedList.right, space(4));
        AppearanceFixture.expectPixels(panel.width, rem(21));
        AppearanceFixture.expectPixels(ownList.left, sharedList.left);
        AppearanceFixture.expectPixels(ownList.right, sharedList.right);
        AppearanceFixture.expectPixels(sharedList.top - heading.bottom, space(2));
        AppearanceFixture.expectPixels(rect(part(element(), ".nol-teamrun-add-shared-mcp")).right, sharedList.right);
      });

      it("keeps the own heading a space-2 and a space-4 under the first list beside a details panel taller than both lists", async () => {
        await shown();
        details().style.minHeight = "60rem";
        await settle();
        const sharedList = rect(part(element(), ".nol-teamrun-shared-mcp-list"));
        const ownHead = rect(part(element(), ".nol-teamrun-own-mcp-head"));
        const ownList = rect(part(element(), ".nol-teamrun-own-mcp-list"));

        expect(rect(details()).bottom).toBeGreaterThan(ownList.bottom + space(4));
        AppearanceFixture.expectPixels(ownHead.top - sharedList.bottom, space(2) + space(4));
        AppearanceFixture.expectPixels(ownList.top - ownHead.bottom, space(2));
      });

      it("starts every shared row's dot, name, chips and chevron in one column each, centred on the row, and ends the chevron inside it", async () => {
        await shown();
        const rows = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-shared-mcp-row")];
        const starts = (selector: string): number[] => rows.map(t => rect(part(t, selector)).left);

        for (const selector of [".nol-teamrun-status-dot", ".nol-teamrun-item-name", ".nol-teamrun-shared-mcp-on", ".nol-teamrun-mcp-chevron"])
          expect(new Set(starts(selector).map(t => Math.round(t))).size).toBe(1);
        for (const shared of rows) {
          const box = rect(shared);
          const dot = rect(part(shared, ".nol-teamrun-status-dot"));
          AppearanceFixture.expectPixels(dot.left - box.left, space(3));
          AppearanceFixture.expectPixels(box.right - rect(part(shared, ".nol-teamrun-mcp-chevron")).right, space(3));
          expect(Math.abs(dot.top + dot.height / 2 - (box.top + box.height / 2))).toBeLessThanOrEqual(1);
          expect(box.height).toBeGreaterThanOrEqual(rem(3.25) - 0.5);
        }
      });

      it("ends every own row's switch at one edge, a space-3 inside the list, and starts every own row's name and servers in one column each", async () => {
        await shown();
        const list = inner(part(element(), ".nol-teamrun-own-mcp-list"));
        const rows = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-own-mcp-row")];

        expect(rows.length).toBe(3);
        for (const own of rows.filter(t => !t.classList.contains("nol-teamrun-own-mcp-held")))
          AppearanceFixture.expectPixels(list.right - rect(part(own, "nol-switch")).right, space(3));
        for (const own of rows)
          AppearanceFixture.expectPixels(rect(part(own, ".nol-teamrun-own-mcp-name")).left - list.left, space(3));
        expect(new Set(rows.map(t => Math.round(rect(part(t, ".nol-teamrun-own-mcp-servers")).left))).size).toBe(1);
      });

      it("starts a held provider's listed row's name and servers in the own rows' columns, a space-3 inside the list, with no switch", async () => {
        providers = [SampleData.provider, personal, office, desk];
        servers.set("a6", own("docs", "linear"));
        kinds = [SampleData.codex, copilot, claude, listingCursor];
        await shown();
        const list = inner(part(element(), ".nol-teamrun-own-mcp-list"));
        const rows = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-own-mcp-row:not(.nol-teamrun-own-mcp-held)")];
        const listedRow = part(element(), ".nol-teamrun-own-mcp-listed");

        expect(rows.length).toBe(3);
        AppearanceFixture.expectPixels(rect(part(listedRow, ".nol-teamrun-own-mcp-name")).left - list.left, space(3));
        expect(new Set(rows.map(t => Math.round(rect(part(t, ".nol-teamrun-own-mcp-servers")).left))).size).toBe(1);
        expect(rect(part(listedRow, ".nol-teamrun-own-mcp-servers")).right).toBeLessThanOrEqual(list.right);
        expect(listedRow.querySelector("nol-switch")).toBeNull();
      });

      it("insets the details a space-4 inside the panel and ends each provider's switch at the panel's inner edge", async () => {
        await shown();
        const panel = inner(details());
        const head = rect(part(details(), ".nol-teamrun-mcp-details-head"));

        AppearanceFixture.expectPixels(head.top - panel.top, space(4));
        AppearanceFixture.expectPixels(head.left - panel.left, space(4));
        for (const line of details().querySelectorAll(".nol-teamrun-shared-mcp-provider"))
          AppearanceFixture.expectPixels(panel.right - rect(part(line, "nol-switch")).right, space(4));
        const state = rect(part(details(), ".nol-teamrun-shared-mcp-sign-in-state"));
        const action = rect(part(details(), ".nol-teamrun-shared-mcp-sign-in button"));
        expect(Math.abs(action.top + action.height / 2 - (state.top + state.height / 2))).toBeLessThanOrEqual(1);
        expect(action.right).toBeLessThanOrEqual(panel.right - space(4) + 0.5);
      });

      it("stacks the details under the first list in a narrow view, edge to edge with the lists, and spills nothing", async () => {
        shared = [new SharedMcpServerListing(new SharedMcpServer("s1", new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [],
          `https://tracker.example/${"segment/".repeat(12)}mcp`, [], null), ["a1", "a3"], [], SampleData.timestamp, SampleData.timestamp), [])];
        await create();
        await listedShared();
        element().style.width = "40rem";
        await settle();
        const sharedList = rect(part(element(), ".nol-teamrun-shared-mcp-list"));
        const panel = rect(details());
        const content = inner(details());

        AppearanceFixture.expectPixels(panel.top - sharedList.bottom, space(2));
        AppearanceFixture.expectPixels(panel.left, sharedList.left);
        AppearanceFixture.expectPixels(panel.right, sharedList.right);
        expect(rect(part(element(), ".nol-teamrun-own-mcp-head")).top).toBeGreaterThan(panel.bottom);
        const command = part(details(), ".nol-teamrun-shared-mcp-command");
        expect(rect(command).right).toBeLessThanOrEqual(content.right);
        for (const shared of element().querySelectorAll<HTMLElement>(".nol-teamrun-mcp-row"))
          expect(shared.scrollWidth).toBeLessThanOrEqual(shared.clientWidth);
        expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
      });

      it("sets the line about saved secrets edge to edge with the layout, and Dismiss at its end", async () => {
        shared = [new SharedMcpServerListing(docs, [], [new SharedMcpVariable("DOCS_KEY", SharedMcpVariableSource.Environment, false)])];
        await create(t => t.answer(MethodName.SharedMcpServerUpdate, () => docs.toJson()).answer(MethodName.SharedMcpSecretSet, () => docs.toJson()));
        await listedShared();
        await savedThroughDialog();
        await settle();
        const line = part(element(), ".nol-teamrun-shared-mcp-secrets-saved");
        const layout = rect(part(element(), ".nol-teamrun-mcp-layout"));

        AppearanceFixture.expectPixels(rect(line).left, layout.left);
        AppearanceFixture.expectPixels(rect(line).right, layout.right);
        AppearanceFixture.expectPixels(rect(part(line, ".nol-teamrun-dismiss")).right, layout.right);
        expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth);
      });
    });
  });

  describe("in each look", () => {
    describe.each([
      { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
      { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
      { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
    ])("in $look", ({ mode, forcedColors }) => {
      const rect = (target: Element): DOMRect => target.getBoundingClientRect();

      beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

      beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

      afterEach(() => AppearanceFixture.reset());

      afterAll(() => EmulatedMediaFixture.resetAsync());

      it("scrolls from its own edges and insets the view inside by the window's document padding", async () => {
        await create();
        const view = part(element(), ".nol-teamrun-settings-view");
        const title = part(view, ".nol-teamrun-mcp-title");
        const layout = part(view, ".nol-teamrun-mcp-layout");
        const block = AppearanceFixture.measureLook("document-padding-block");
        const inline = AppearanceFixture.measureLook("content-padding-inline");

        expect(getComputedStyle(element()).overflowY).toBe("auto");
        AppearanceFixture.expectPixels(rect(view).top, rect(element()).top);
        AppearanceFixture.expectPixels(rect(title).top - rect(view).top, block);
        AppearanceFixture.expectPixels(rect(title).left - rect(view).left, inline);
        AppearanceFixture.expectPixels(rect(view).right - rect(layout).right, inline);
        AppearanceFixture.expectPixels(rect(view).bottom - rect(part(view, ".nol-teamrun-notice")).bottom, block);
      });

      it("ends a long held line and a long reason inside the own list rather than spilling past it", async () => {
        const long = "x".repeat(200);
        kinds = [SampleData.codex, new ProviderKind("copilot", "GitHub Copilot", true, false, null, null, false, null, false, null, false, null,
          SampleData.abilities({ [ProviderAbility.OwnServersSwitch]: AbilityCell.cannot(long) })), claude];
        await create();
        part<HTMLButtonElement>(element(), ".nol-teamrun-own-mcp-why").click();
        await settle();
        const list = rect(part(element(), ".nol-teamrun-own-mcp-list"));

        for (const reason of element().querySelectorAll(".nol-teamrun-mcp-reason"))
          expect(rect(reason).right).toBeLessThanOrEqual(list.right);
        expect(element().scrollWidth).toBeLessThanOrEqual(element().clientWidth);
      });
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    beforeEach(() => {
      teammates = [new Teammate("alice", "Alice", null, "a1", Harness.Provider, null, null, "t", "t")];
      shared = [new SharedMcpServerListing(new SharedMcpServer("s1", new SharedMcpServerDefinition("docs", SharedMcpTransport.Stdio, "npx", [], [], null, [], null),
        ["a1"], [new SharedMcpTeammateSetting("alice", SharedMcpSetting.Off)], SampleData.timestamp, SampleData.timestamp),
      [new SharedMcpUnavailability("a4", "TeamRun doesn't pass shared MCP servers to Claude Code yet.", "not passed yet")])];
    });

    it("keeps every control, state and focus ring in the MCP servers view visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the MCP servers view at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    beforeEach(() => {
      teammates = [new Teammate("alice", "Alice", null, "a1", Harness.Provider, null, null, "t", "t")];
      shared = [new SharedMcpServerListing(new SharedMcpServer("s1", new SharedMcpServerDefinition("docs", SharedMcpTransport.Stdio, "npx", [], [], null, [], null),
        ["a1"], [new SharedMcpTeammateSetting("alice", SharedMcpSetting.Off)], SampleData.timestamp, SampleData.timestamp),
      [new SharedMcpUnavailability("a4", "TeamRun doesn't pass shared MCP servers to Claude Code yet.", "not passed yet")])];
    });

    it("reaches every control in the MCP servers view by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the MCP servers view", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
