/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { CommandContribution, ContentPadding, DockSide, DocumentContribution, type IDocumentOptions, SettingsPageContribution, SettingsRow, StatusBarSide, TopBarActionContribution, TopBarActionState, TopBarSide,
  ViewContribution, WindowPartTokens } from "@noldova/desktop.window";
import { GitFolder, GitFolderProvidedException } from "@noldova/git.window";
import {
  BackgroundTask, BackgroundTaskStatus, Conversation, ConversationListParams, EventName, MessageDelivery, MessageStatus, MethodName, Organization
} from "@noldova/teamrun.protocol";
import { OwnersProvidedException, TerminalOwners, TerminalStartFolder } from "@noldova/terminal.window";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import menus from "@noldova/teamrun/menus.json";
import declaration from "@noldova/teamrun/module.json";
import settings from "@noldova/teamrun/settings.json";

import { ProvidersViewComponent } from "../../src/app/components/providers-view/providers-view.component";
import { ActivityViewComponent } from "../../src/app/components/activity-view/activity-view.component";
import { BackgroundTasksViewComponent } from "../../src/app/components/background-tasks-view/background-tasks-view.component";
import { PagesViewComponent } from "../../src/app/components/pages/pages-view/pages-view.component";
import { ChangesViewComponent } from "../../src/app/components/changes-view/changes-view.component";
import { ConversationComponent } from "../../src/app/components/conversation/conversation.component";
import { AbilitiesPageComponent } from "../../src/app/components/abilities-page/abilities-page.component";
import { AbilitySettingsRows } from "../../src/app/services/ability-settings-rows";
import { ConversationPlaceholderComponent } from "../../src/app/components/conversation-placeholder/conversation-placeholder.component";
import { ImageDocumentComponent } from "../../src/app/components/image-document/image-document.component";
import { ComputerUseGrantsViewComponent } from "../../src/app/components/computer-use-grants-view/computer-use-grants-view.component";
import { OutsideConnectionViewComponent } from "../../src/app/components/outside-connection-view/outside-connection-view.component";
import { PageDocumentComponent } from "../../src/app/components/pages/page-document/page-document.component";
import { McpServersViewComponent } from "../../src/app/components/mcp-servers-view/mcp-servers-view.component";
import { PlanViewComponent } from "../../src/app/components/plan-view/plan-view.component";
import { ProjectsViewComponent } from "../../src/app/components/projects-view/projects-view.component";
import { SubAgentsViewComponent } from "../../src/app/components/sub-agents-view/sub-agents-view.component";
import { OrganizationViewComponent } from "../../src/app/components/organization-view/organization-view.component";
import { TeammatesViewComponent } from "../../src/app/components/teammates-view/teammates-view.component";
import { BackgroundTaskStoreService } from "../../src/app/services/background-task-store.service";
import { ChatStoreService } from "../../src/app/services/chat-store.service";
import { ComposerDefaultService } from "../../src/app/services/composer-default.service";
import { GitHubReferenceSource } from "../../src/app/services/github-reference-source";
import { PlanUsageStatus } from "../../src/app/services/plan-usage-status";
import { ChatPages } from "../../src/app/services/pages/chat-pages";
import { ChatPagesResources } from "../../src/app/services/pages/chat-pages-resources";
import { PageDocuments } from "../../src/app/services/pages/page-documents";
import { TitleModelOptions } from "../../src/app/services/title-model-options";
import { OrganizationCatalog } from "../../src/app/services/organization-catalog";
import { OrganizationLayoutState } from "../../src/app/services/organization-layout-state";
import { ProjectsLayoutService } from "../../src/app/services/projects-layout.service";
import { SubAgentsBadge } from "../../src/app/services/sub-agents-badge";
import { TimeFormatService } from "../../src/app/services/time-format.service";
import { UsageFormatterService } from "../../src/app/services/usage-formatter.service";
import { TeamRunWindowPart } from "../../src/app/teamrun-window-part";
import { Resources } from "../../src/resources";
import { DeferredResponse } from "../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../fixtures/fake-window-part-context.fixture";
import { RecordingWindowPartContext } from "../fixtures/recording-window-part-context.fixture";
import { RootPaint } from "../fixtures/root-paint.fixture";
import { SampleData } from "../fixtures/sample-data.fixture";
import { Wait } from "../fixtures/wait.fixture";

describe("TeamRun's window part", () => {
  const parts: TeamRunWindowPart[] = [];

  const createPart = (): TeamRunWindowPart => {
    const part = new TeamRunWindowPart();
    parts.push(part);
    return part;
  };

  beforeEach(() => AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light));

  afterEach(async () => {
    await Promise.all(parts.splice(0).map(t => t.deactivateAsync()));
    AppearanceFixture.reset();
  });

  it("names TeamRun's module", () => {
    expect(createPart().moduleId).toBe("teamrun");
  });

  it("has no context before the window activates it", () => {
    expect(createPart().context).toBeNull();
  });

  it("keeps the context the window activates it with", async () => {
    const part = createPart();
    const context = new RecordingWindowPartContext();

    await part.activateAsync(context);

    expect(part.context).toBe(context);
    expect(context.lines).toEqual([]);
  });

  it("places Explorer on the left; Background tasks, Pages, Plans and Sub-agents on the right, in an upper and a lower group; and Activity and Changes at the bottom. Each view is shown at first and unpadded, so its list scrolls to the pane's edges, and there is no view for Teammates, Providers or MCP servers", async () => {
    const context = new RecordingWindowPartContext();

    await createPart().activateAsync(context);

    expect(context.views.map(t => [t.name, t.title, t.icon, t.defaultSide, t.defaultGroup, t.defaultOrder, t.isShownByDefault])).toEqual([
      ["teamrun.projects", "Explorer", "folder_open", DockSide.Left, 0, 10, true],
      ["teamrun.backgroundTasks", "Background tasks", "pending_actions", DockSide.Right, 0, 10, true],
      ["teamrun.pages", "Pages", "web_asset", DockSide.Right, 0, 30, true],
      ["teamrun.plan", "Plans", "checklist", DockSide.Right, 1, 10, true],
      ["teamrun.subAgents", "Sub-agents", "device_hub", DockSide.Right, 1, 20, true],
      ["teamrun.activity", "Activity", "list_alt", DockSide.Bottom, 0, 10, true],
      ["teamrun.changes", "Changes", "difference", DockSide.Bottom, 0, 20, true]
    ]);
    expect(context.views.map(t => t.padding)).toEqual(Array.from({ length: 7 }, () => ContentPadding.None));
    expect(await Promise.all(context.views.map(t => t.loadComponent()))).toEqual([ProjectsViewComponent, BackgroundTasksViewComponent, PagesViewComponent, PlanViewComponent,
      SubAgentsViewComponent, ActivityViewComponent, ChangesViewComponent]);
  });

  it("registers the commands that Settings' buttons and the View menu run, each opening its document as one tab in the middle, and the same tab again while it's open", async () => {
    const organizationOf = (id: string, name: string, order: number): Organization =>
      new Organization(id, name, null, order, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []);
    const context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("labs", "Labs", 1).toJson(), organizationOf("team", "Team", 0).toJson()]);
    await createPart().activateAsync(context);
    const shows = context.commands.slice(0, 6);

    expect(shows.map(t => [t.name, t.title, t.icon, t.defaultKey])).toEqual([
      ["teamrun.showOrganization", "Show organization", "lan", null],
      ["teamrun.showTeammates", "Manage teammates", "group", null],
      ["teamrun.showProviders", "Manage providers", "key", null],
      ["teamrun.showMcpServers", "Manage MCP servers", "hub", null],
      ["teamrun.showComputerUseGrants", "Manage computer use", "desktop_windows", null],
      ["teamrun.showOutsideSessions", "Connect outside agents", "hub", null]
    ]);
    expect(await Promise.all(shows.map(t => t.runAsync(null)))).toEqual([null, null, null, null, null, null]);
    await shows[1]?.runAsync(null);
    await shows[0]?.runAsync(null);
    expect(context.openedDocuments).toEqual([
      { name: "teamrun.teammates", instance: "teammates", title: "Teammates", options: undefined },
      { name: "teamrun.providers", instance: "providers", title: "Providers", options: undefined },
      { name: "teamrun.mcpServers", instance: "mcpServers", title: "MCP servers", options: undefined },
      { name: "teamrun.computerUseGrants", instance: "computerUseGrants", title: "Computer use", options: undefined },
      { name: "teamrun.outsideConnection", instance: "outsideConnection", title: "Outside sessions", options: undefined },
      { name: "teamrun.organization", instance: "team", title: "Team", options: undefined },
      { name: "teamrun.teammates", instance: "teammates", title: "Teammates", options: undefined },
      { name: "teamrun.organization", instance: "team", title: "Team", options: undefined }
    ]);
    expect([context.dialogs, context.keptDocuments]).toEqual([[], []]);
  });

  it("opens My organization's tab from Show organization when the list can't be read, so its view says why and offers Retry", async () => {
    const context = new FakeWindowPartContext().fail(MethodName.OrganizationList, "The runtime is gone.");
    await createPart().activateAsync(context);

    expect([await context.commands.find(t => t.name === "teamrun.showOrganization")?.runAsync(null), context.openedDocuments])
      .toEqual([null, [{ name: "teamrun.organization", instance: "my-organization", title: "Organization", options: undefined }]]);
  });

  it("leaves Show organization unavailable and opens nothing while there is no organization, and makes it available once one is created", async () => {
    const context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => []);
    await createPart().activateAsync(context);
    const show = context.commands.find(t => t.name === "teamrun.showOrganization");
    await OrganizationCatalog.of(context).reload();

    const none = [show?.isEnabled(null), await show?.runAsync(null), [...context.openedDocuments]];
    context.emit(EventName.OrganizationChanged, new Organization("team", "Team", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson());

    expect([none, show?.isEnabled(null)]).toEqual([[false, null, []], true]);
  });

  it("opens the organization the newest listing names when a resync reloads the list while Show organization waits for it", async () => {
    const first = new DeferredResponse();
    const answers = [first.promise, Promise.resolve([new Organization("team", "Team", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson()])];
    const context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answers.shift() ?? Promise.resolve([]));
    await createPart().activateAsync(context);

    const running = context.commands.find(t => t.name === "teamrun.showOrganization")?.runAsync(null);
    context.emit(EventName.StateResyncRequested, null);
    first.resolve([new Organization("labs", "Labs", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [], []).toJson()]);
    await running;

    expect(context.openedDocuments).toEqual([{ name: "teamrun.organization", instance: "team", title: "Team", options: undefined }]);
  });

  it("leaves Organization, Teammates, Providers, MCP servers, Computer use and Outside sessions out of the docks a layout reset fills, and out of a saved layout's views, declaring them as documents only", async () => {
    const context = new RecordingWindowPartContext();
    await createPart().activateAsync(context);
    const names = ["teamrun.organization", "teamrun.teammates", "teamrun.providers", "teamrun.mcpServers", "teamrun.computerUseGrants", "teamrun.outsideConnection"];

    expect([declaration.contributes.views.filter(t => names.includes(t)), context.views.filter(t => names.includes(t.name))]).toEqual([[], []]);
    expect([declaration.contributes.documents.filter(t => names.includes(t)), context.documents.filter(t => names.includes(t.name)).map(t => t.name)]).toEqual([names, names]);
  });

  it("registers every command module.json declares, the conversation commands with their default keys, shown as macOS and other systems write them", async () => {
    const context = new RecordingWindowPartContext();

    await createPart().activateAsync(context);

    expect(context.commands.map(t => t.name)).toEqual(declaration.contributes.commands);
    expect(context.commands.slice(6).map(t => [t.name, t.title, t.icon, t.defaultKey?.text])).toEqual([
      ["teamrun.newConversation", "New chat", "edit_square", "Mod+N"],
      ["teamrun.openProject", "Open folder", "folder_open", "Mod+O"],
      ["teamrun.openBrowser", "Open browser", "language", undefined],
      ["teamrun.searchConversations", "Search chats", "search", undefined],
      ["teamrun.focusComposer", "Go to the message box", "edit_note", "Mod+L"],
      ["teamrun.openChatPage", "Open the chat's Browser page", "language", undefined],
      ["teamrun.stopReply", "Stop the running reply", "stop", "Mod+Period"],
      ["teamrun.previousConversation", "Previous recent chat", "arrow_upward", "Alt+ArrowUp"],
      ["teamrun.nextConversation", "Next recent chat", "arrow_downward", "Alt+ArrowDown"],
      ["teamrun.moveRowUp", "Move row up", "arrow_upward", "Mod+Shift+ArrowUp"],
      ["teamrun.moveRowDown", "Move row down", "arrow_downward", "Mod+Shift+ArrowDown"],
      ["teamrun.chooseDefaultTeammate", "Choose default teammate", "group", undefined],
      ["teamrun.showDataFolder", "Show data folder", "folder_open", undefined],
      ["teamrun.openChat", "Open chat", "chat", undefined],
      ["teamrun.enableProvider", "Enable provider", "check_circle", undefined],
      ["teamrun.reload", "Load TeamRun's data again", "refresh", undefined],
      ["teamrun.newChatTerminal", "New chat terminal", "terminal", "Mod+Alt+Backquote"]
    ]);
    expect([...context.commands.slice(13, 17), ...context.commands.slice(22)].map(t => [t.defaultKey?.label("darwin"), t.defaultKey?.label("win32"),
      t.defaultKey?.label("linux")])).toEqual([["⌥↑", "Alt+Up", "Alt+Up"], ["⌥↓", "Alt+Down", "Alt+Down"], ["⇧⌘↑", "Ctrl+Shift+Up", "Ctrl+Shift+Up"],
      ["⇧⌘↓", "Ctrl+Shift+Down", "Ctrl+Shift+Down"], ["⌥⌘`", "Ctrl+Alt+`", "Ctrl+Alt+`"]]);
  });

  it("puts only the chat's Browser page at the top bar's end, saying why it can't open with no chat shown, with no New chat beside it and no search button, adding its Chats and Messages to the window's one search instead", async () => {
    const context = new RecordingWindowPartContext();

    await createPart().activateAsync(context);

    expect(context.topBarActions).toEqual([
      new TopBarActionContribution("teamrun.chatPage", new TopBarActionState("language", "Open a chat to open its Browser page", "teamrun.openChatPage"), TopBarSide.End)
    ]);
    expect(context.searchSources.map(t => [t.name, t.label, t.placeholderName, t.heading, t.recentHeading, t.icon])).toEqual([
      ["teamrun.chats", "Chats", "chats", "Chats", "Recent chats", "chat"],
      ["teamrun.messages", "Messages", "messages", "In messages", null, "notes"]
    ]);
  });

  it("registers the plan usage item on the status bar's right, hidden until a shown chat's provider reports its plan", async () => {
    const context = new RecordingWindowPartContext();
    const part = createPart();

    await part.activateAsync(context);

    expect(context.statusBarItems.map(t => [t.name, t.side, t.state()])).toEqual([["teamrun.planUsage", StatusBarSide.Right, UsageFormatterService.hidden]]);
    expect(PlanUsageStatus.of(context)).not.toBeNull();
    await part.deactivateAsync();
    expect(PlanUsageStatus.of(context)).toBeNull();
  });

  it("keeps the Sub-agents badge's count from activation, before any view opens, and frees it when deactivated", async () => {
    const context = new RecordingWindowPartContext();
    const part = createPart();

    await part.activateAsync(context);
    expect(SubAgentsBadge.of(context)).not.toBeNull();
    await part.deactivateAsync();
    expect(SubAgentsBadge.of(context)).toBeNull();
  });

  it("keeps one GitHub reference source for the window's replies while active, following GitHub's sign-in, and drops it when deactivated", async () => {
    const context = new FakeWindowPartContext().answer(MethodName.MessageListOpen, () => []);
    const part = createPart();

    await part.activateAsync(context);
    const active = [GitHubReferenceSource.of(context) !== null, context.events.includes("git-github.signInChanged")];
    await part.deactivateAsync();

    expect([active, [GitHubReferenceSource.of(context), context.events.includes("git-github.signInChanged")]]).toEqual([[true, true], [null, false]]);
  });

  it("writes times in Noldova Desktop's formats from activation, and in the defaults again once deactivated", async () => {
    const context = SampleData.createContext();
    context.changeSetting("desktop.timeFormat", "HH:mm");
    const times = TestBed.inject(TimeFormatService);
    const at = new Date(2026, 9, 22, 13, 5).getTime();
    const part = createPart();

    await part.activateAsync(context);
    const active = [times.time(at), context.watchedSettings.filter(t => t.startsWith("desktop."))];
    await part.deactivateAsync();

    expect([active, [times.time(at), context.watchedSettings.filter(t => t.startsWith("desktop."))]])
      .toEqual([["13:05", ["desktop.timeFormat", "desktop.dateTimeFormat"]], ["1:05 PM", []]]);
  });

  it("gives the Git view the shown chat's folder while active and frees it when deactivated", async () => {
    const context = new FakeWindowPartContext().answer(MethodName.MessageListOpen, () => []);
    const part = createPart();

    await part.activateAsync(context);
    const store = ChatStoreService.of(context);
    vi.spyOn(store, "shownConversationId").mockReturnValue("c1");
    vi.spyOn(store, "folderOf").mockImplementation(t => t === "c1" ? "/work/project" : null);
    const folder = GitFolder.folder();
    expect(() => GitFolder.provide(context, signal(null))).toThrowError(GitFolderProvidedException);
    await part.deactivateAsync();
    const release = GitFolder.provide(context, signal("/other"));

    expect([folder, GitFolder.folder()]).toEqual(["/work/project", "/other"]);
    release();
  });

  it("provides the window's terminal owners while active and frees them when deactivated", async () => {
    const context = new RecordingWindowPartContext();
    const part = createPart();

    await part.activateAsync(context);
    expect(() => TerminalOwners.provide(context, () => null)).toThrowError(OwnersProvidedException);
    await part.deactivateAsync();

    const owners = TerminalOwners.provide(context, () => null);
    expect(owners).toBeInstanceOf(TerminalOwners);
    await owners.removeAsync();
  });

  it("registers every command its menus name", async () => {
    const context = new RecordingWindowPartContext();
    await createPart().activateAsync(context);
    const registered = context.commands.map(t => t.name);

    expect(menus.groups.flatMap(t => t.items.map(u => u.command)).filter(t => !registered.includes(t))).toEqual([]);
  });

  it("declares what Enter does while a reply runs on the TeamRun page's Composer, Steer by default and kept per device", () => {
    const whileReplying = settings.settings.find(t => t.name === Resources.whileReplyingSetting);

    expect([whileReplying?.title, whileReplying?.type, whileReplying?.default, whileReplying?.locality, whileReplying?.page, whileReplying?.group]).toEqual([
      "While a reply runs, Enter", { kind: "Choice", options: [{ value: MessageDelivery.Steer, title: "Steer" }, { value: MessageDelivery.Queue, title: "Queue" },
        { value: MessageDelivery.StopAndSend, title: "Stop and send" }] }, MessageDelivery.Steer, "Device", "TeamRun", "Composer"]);
  });

  it("declares New terminals on the TeamRun page's Terminals, General by default and shared by every device the runtime serves", () => {
    const newTerminals = settings.settings.find(t => t.name === "teamrun.newTerminals");

    expect([newTerminals?.title, newTerminals?.type, newTerminals?.default, newTerminals?.locality, newTerminals?.page, newTerminals?.group]).toEqual(["New terminals",
      { kind: "Choice", options: [{ value: "General", title: "General" }, { value: Resources.chatNewTerminals, title: "This chat" }] }, "General", "Shared", "TeamRun",
      "Terminals"]);
  });

  it("declares Run opens in on the TeamRun page's Terminals, Chat by default and shared by every device the runtime serves", () => {
    const runOpensIn = settings.settings.find(t => t.name === Resources.runOpensInSetting);

    expect([runOpensIn?.title, runOpensIn?.type, runOpensIn?.default, runOpensIn?.locality, runOpensIn?.page, runOpensIn?.group]).toEqual(["Run opens in",
      { kind: "Choice", options: [{ value: "Chat", title: "Chat" }, { value: Resources.runOpensInPanel, title: "Terminals panel" }] }, "Chat", "Shared", "TeamRun",
      "Terminals"]);
  });

  it("declares the Data folder row on the TeamRun page with the earlier app's texts, a button that runs a command TeamRun registers", async () => {
    const context = new RecordingWindowPartContext();
    await createPart().activateAsync(context);
    const row = settings.settings.find(t => t.name === "teamrun.dataFolder");

    expect([row?.title, row?.description, row?.type, row?.default, row?.page, row?.group]).toEqual(["Data folder",
      "Where TeamRun keeps its database. The command-line client uses the same folder.",
      { kind: "Action", command: "teamrun.showDataFolder", label: "Show in folder" }, null, "TeamRun", "Data"]);
    expect(context.commands.map(t => t.name)).toContain("teamrun.showDataFolder");
  });

  it("declares the Default teammate row on the TeamRun page, a button that runs a command TeamRun registers", async () => {
    const context = new RecordingWindowPartContext();
    await createPart().activateAsync(context);
    const row = settings.settings.find(t => t.name === "teamrun.defaultTeammate");

    expect([row?.title, row?.description, row?.type, row?.default, row?.locality, row?.page, row?.group]).toEqual(["Default teammate",
      "The provider, model and effort a new chat starts with. Until you choose one, a new chat starts from the last message you sent.",
      { kind: "Action", command: "teamrun.chooseDefaultTeammate", label: "Choose default teammate" }, null, "Shared", "TeamRun", "Default teammate"]);
    expect(settings.settings.findIndex(t => t.name === "teamrun.defaultTeammate")).toBe(settings.settings.findIndex(t => t.name === "teamrun.manageTeammates") - 1);
    expect(context.commands.map(t => t.name)).toContain("teamrun.chooseDefaultTeammate");
  });

  it("declares the Title model on the TeamRun page's Chats, a dynamic choice defaulting to the chat's own, saying where first messages then go", () => {
    const title = settings.settings.find(t => t.name === "teamrun.titleModel");

    expect([title?.title, title?.type, title?.default, title?.locality, title?.page, title?.group])
      .toEqual(["Title model", { kind: "Choice", dynamic: true }, "", "Shared", "TeamRun", "Chats"]);
    expect(title?.description).toContain("first messages also go to its provider");
    expect(declaration.contributes.settings).toContain("teamrun.titleModel");
  });

  it("declares the teammate hand-off limit on the TeamRun page's Replies, a whole number from 0 to 100, 4 by default, counting mentions and sends to other chats, shared by every device the runtime serves", () => {
    const limit = settings.settings.find(t => t.name === "teamrun.chainHopLimit");

    expect([limit?.title, limit?.description, limit?.type, limit?.default, limit?.locality, limit?.page, limit?.group])
      .toEqual(["Teammate hand-offs", "How many times in a row a teammate may start another reply: the teammates its reply mentions, or the chat it sends a message to. "
        + "At 0, a teammate starts no one. Your own messages are never limited.", { kind: "Number", minimum: 0, maximum: 100, step: 1 }, 4, "Shared", "TeamRun", "Replies"]);
  });

  it("is tested against a window that, like the real one, refuses a view TeamRun's module.json doesn't declare", () => {
    const view = new ViewContribution("teamrun.undeclared", "Undeclared", "folder", DockSide.Left, false, () => Promise.resolve(ProjectsViewComponent));

    expect(() => new RecordingWindowPartContext().registerView(view)).toThrowError("TeamRun's module.json does not declare the view teamrun.undeclared.");
  });

  it("registers every document without the window's padding, since each scrolls itself to its edges, loading each component when the window opens one", async () => {
    const context = new RecordingWindowPartContext();

    await createPart().activateAsync(context);

    expect(context.documents.map(t => [t.name, t.padding])).toEqual([["teamrun.conversation", ContentPadding.None], ["teamrun.image", ContentPadding.None],
      ["teamrun.organization", ContentPadding.None], ["teamrun.teammates", ContentPadding.None], ["teamrun.providers", ContentPadding.None], ["teamrun.mcpServers", ContentPadding.None],
      ["teamrun.computerUseGrants", ContentPadding.None], ["teamrun.outsideConnection", ContentPadding.None], ["teamrun.page", ContentPadding.None]]);
    expect(await Promise.all(context.documents.map(t => t.loadComponent()))).toEqual([ConversationComponent, ImageDocumentComponent, OrganizationViewComponent, TeammatesViewComponent,
      ProvidersViewComponent, McpServersViewComponent, ComputerUseGrantsViewComponent, OutsideConnectionViewComponent, PageDocumentComponent]);
  });

  it("registers its placeholder without padding, which loads the text asking to choose or create a chat while none is open", async () => {
    const context = new RecordingWindowPartContext();

    await createPart().activateAsync(context);

    expect(context.placeholders.map(t => [t.name, t.padding])).toEqual([["teamrun.noChat", ContentPadding.None]]);
    await expect(context.placeholders[0]?.loadComponent()).resolves.toBe(ConversationPlaceholderComponent);
  });

  it("registers the Settings page of what each provider can do, which module.json declares, loading its component when Settings opens it, and gives search its rows", async () => {
    const context = new RecordingWindowPartContext();
    const part = createPart();

    await part.activateAsync(context);

    expect(context.settingsPages.map(t => t.name)).toEqual(["teamrun.abilities"]);
    await expect(context.settingsPages[0]?.loadComponent()).resolves.toBe(AbilitiesPageComponent);
    expect([[...context.settingsRows.keys()], AbilitySettingsRows.of(context) === null]).toEqual([["teamrun.abilities"], false]);
    await part.deactivateAsync();
    expect(AbilitySettingsRows.of(context)).toBeNull();
  });

  it("refuses a Settings page its module.json doesn't declare", () => {
    expect(() => new RecordingWindowPartContext().registerSettingsPage(new SettingsPageContribution("teamrun.undeclared", () => Promise.resolve(AbilitiesPageComponent))))
      .toThrowError("TeamRun's module.json does not declare the Settings page teamrun.undeclared.");
  });

  it("keeps a declared Settings page's rows, and refuses rows for a page its module.json doesn't declare or with a repeated row", () => {
    const context = new RecordingWindowPartContext();
    const rows = [new SettingsRow("teamrun.abilities.claude", "Claude"), new SettingsRow("teamrun.abilities.codex", "Codex")];

    context.setSettingsRows("teamrun.abilities", rows);

    expect(context.settingsRows.get("teamrun.abilities")?.map(t => t.id)).toEqual(["teamrun.abilities.claude", "teamrun.abilities.codex"]);
    expect(() => context.setSettingsRows("teamrun.undeclared", rows)).toThrowError("TeamRun's module.json does not declare the Settings page teamrun.undeclared.");
    expect(() => context.setSettingsRows("teamrun.abilities", [...rows, new SettingsRow("teamrun.abilities.codex", "Codex again")]))
      .toThrowError("The Settings page teamrun.abilities has the row teamrun.abilities.codex twice.");
  });

  it("opens a new conversation from the Projects view on a fresh profile, with no providers, providers or teammates, into its registered document, with no window error",
    async () => {
      const created = new Conversation("c9", SampleData.project.id, Resources.newConversationLabel, SampleData.timestamp, SampleData.timestamp);
      const errors: unknown[] = [];
      const context = SampleData.createContext()
        .answer(MethodName.ProviderKindList, () => [])
        .answer(MethodName.ProviderList, () => [])
        .answer(MethodName.ConversationList, () => [])
        .answer(MethodName.ConversationCreate, () => created.toJson())
        .answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson());
      const open = context.openDocument.bind(context);
      context.openDocument = (name: string, instance: string, title: string, options?: IDocumentOptions): void => {
        if (!context.documents.some(t => t.name === name))
          throw new Error(`No document named "${name}" is registered.`);
        open(name, instance, title, options);
      };
      await createPart().activateAsync(context);
      TestBed.configureTestingModule({
        providers: [
          { provide: WindowPartTokens.context, useValue: context },
          { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
          { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
        ]
      });
      const view = TestBed.createComponent((await context.views[0]?.loadComponent()) as Type<ProjectsViewComponent>);
      view.autoDetectChanges();
      await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
      await view.whenStable();

      [...(view.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(".nol-teamrun-action")]
        .find(t => t.querySelector(".nol-teamrun-label")?.textContent?.trim() === Resources.newConversationLabel)?.click();
      await Wait.until(() => expect(context.openedDocuments).toHaveLength(1));
      const opened = context.openedDocuments[0];
      expect([opened?.name, opened?.instance, opened?.title]).toEqual([Resources.conversationDocumentName, created.id, created.title]);

      const document = TestBed.createComponent((await context.documents.find(t => t.name === opened?.name)?.loadComponent()) as Type<ConversationComponent>);
      document.componentRef.setInput("instance", opened?.instance);
      document.componentRef.setInput("title", opened?.title);
      document.autoDetectChanges();
      await Wait.until(() => expect(ChatStoreService.of(context).selectedConversationId()).toBe(created.id));
      await document.whenStable();
      const composer = (document.nativeElement as HTMLElement).querySelector("textarea");
      expect(composer?.getAttribute("placeholder")).toBe(Resources.composerPlaceholder);
      expect(errors).toEqual([]);
      ChatStoreService.release(context);
    });

  it("is tested against a window that, like the real one, refuses a document TeamRun's module.json doesn't declare", () => {
    const document = new DocumentContribution("teamrun.undeclared", () => Promise.resolve(ConversationComponent), ContentPadding.None);

    expect(() => new RecordingWindowPartContext().registerDocument(document)).toThrowError("TeamRun's module.json does not declare the document teamrun.undeclared.");
  });

  it("is tested against a window that, like the real one, refuses a command TeamRun's module.json doesn't declare", () => {
    const command = new CommandContribution("teamrun.undeclared", "Undeclared", null, null, () => Promise.resolve(null));

    expect(() => new RecordingWindowPartContext().registerCommand(command)).toThrowError("TeamRun's module.json does not declare the command teamrun.undeclared.");
  });

  it("reads only the open replies again when the runtime starts again before any view loaded its store, reports its window again, and continues only if that worked", async () => {
    const part = createPart();
    const context = SampleData.createContext();
    await part.activateAsync(context);

    await expect(part.reconnectAsync()).resolves.toBe(true);
    expect(context.count(MethodName.MessageListOpen)).toBe(2);
    const reports = context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.WindowFocused)).map(t => t.parameters);
    expect(reports).toHaveLength(2);
    expect(reports[1]).toEqual(reports[0]);
    expect(context.methods.filter(t => t === Resources.computerUseBorderColorSetMethod)).toHaveLength(2);
    expect([context.methods.filter(t => t !== "git-github.readSignIn").length, context.methods.filter(t => t === "git-github.readSignIn").length]).toEqual([6, 1]);
    context.fail(MethodName.MessageListOpen, "The runtime part is away.");
    await expect(part.reconnectAsync()).resolves.toBe(false);
  });

  it("shows on a chat's tab a reply started outside the window while no view is open, until the reply ends", async () => {
    const context = SampleData.createContext();
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Running);
    await createPart().activateAsync(context);
    await Wait.until(() => expect(context.count(MethodName.MessageListOpen)).toBe(1));

    context.emit(EventName.MessageCreated, reply.toJson());
    expect(context.workingMarks).toEqual([{ name: Resources.conversationDocumentName, instance: reply.conversationId }]);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(reply, MessageStatus.Completed).toJson());

    expect(context.workingMarks).toEqual([]);
    expect(context.count(MethodName.WindowFocused)).toBe(1);
    expect([context.methods.filter(t => t !== "git-github.readSignIn").length, context.methods.filter(t => t === "git-github.readSignIn").length]).toEqual([3, 1]);
  });

  it("reads its store's state again when the runtime starts again, and continues only if that worked", async () => {
    const part = createPart();
    const context = SampleData.createContext();
    await part.activateAsync(context);
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    const catalogs = context.count(MethodName.ProjectList);

    await expect(part.reconnectAsync()).resolves.toBe(true);
    expect(context.count(MethodName.ProjectList)).toBe(catalogs + 1);
    context.fail(MethodName.ProjectList, "The runtime part is away.");
    await expect(part.reconnectAsync()).resolves.toBe(false);
    ChatStoreService.release(context);
  });

  it("shows in the Tasks panel a command that ended while the runtime was away, once the runtime starts again", async () => {
    const part = createPart();
    const task = (status: BackgroundTaskStatus, exitCode: number | null, ended: string | null): BackgroundTask =>
      new BackgroundTask("t1", SampleData.conversation.id, "r1", "codex", "make", status, exitCode, SampleData.timestamp, ended, null);
    const context = SampleData.createContext().answer(MethodName.BackgroundTaskList, () => SampleData.tasks([task(BackgroundTaskStatus.Running, null, null)]));
    await part.activateAsync(context);
    const tasks = BackgroundTaskStoreService.of(context);
    tasks.watch(SampleData.conversation.id);
    await Wait.until(() => expect(tasks.tasksOf(SampleData.conversation.id).map(t => t.status)).toEqual([BackgroundTaskStatus.Running]));
    context.answer(MethodName.BackgroundTaskList, () => SampleData.tasks([task(BackgroundTaskStatus.Completed, 0, SampleData.timestamp)]));

    await expect(part.reconnectAsync()).resolves.toBe(true);

    await Wait.until(() => expect(tasks.tasksOf(SampleData.conversation.id).map(t => t.status)).toEqual([BackgroundTaskStatus.Completed]));
    BackgroundTaskStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("reads the projects' layout, the composer's default and a watched chat's pages again when the runtime starts again", async () => {
    const part = createPart();
    const context = SampleData.createContext().answerModule(ChatPagesResources.listName, () => []);
    await part.activateAsync(context);
    ProjectsLayoutService.of(context);
    ComposerDefaultService.of(context);
    ChatPages.of(context).watch(SampleData.conversation.id);
    const reads = (): number[] => [context.count(MethodName.ProjectsLayoutRead), context.count(MethodName.ComposerDefaultRead),
      context.requests.filter(t => t.method === ChatPagesResources.listName).length];
    await Wait.until(() => expect(reads()).toEqual([1, 1, 1]));

    await part.reconnectAsync();

    await Wait.until(() => expect(reads()).toEqual([2, 2, 2]));
    ProjectsLayoutService.release(context);
    ComposerDefaultService.release(context);
    ChatPages.release(context);
    ChatStoreService.release(context);
  });

  it("reads its open page documents again when the runtime starts again, and its title model lists only once its store's state was read again", async () => {
    const part = createPart();
    const context = SampleData.createContext();
    await part.activateAsync(context);
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    let pages = 0;
    const release = PageDocuments.onResync(context, () => {
      pages += 1;
    });
    const reload = vi.spyOn(TitleModelOptions, "reload");

    await expect(part.reconnectAsync()).resolves.toBe(true);
    const reloaded = reload.mock.calls.map(t => t[0] === context);
    context.fail(MethodName.ProjectList, "The runtime part is away.");
    await expect(part.reconnectAsync()).resolves.toBe(false);

    expect([pages, reloaded, reload.mock.calls.length]).toEqual([2, [true], 1]);
    reload.mockRestore();
    release();
    ChatStoreService.release(context);
  });

  it("gives computer use the border's colour, the window's accent, when activated, again when the runtime starts again, and on each theme change until deactivated",
    async () => {
      const part = createPart();
      const context = SampleData.createContext();
      const colors = (): readonly JsonValue[] => context.requests.filter(t => t.method === Resources.computerUseBorderColorSetMethod).map(t => t.parameters);
      const accent = (mode: ThemeMode): string => DefaultTheme.theme.readColor(mode, "accent") ?? "";
      await part.activateAsync(context);
      expect(colors()).toEqual([{ color: accent(ThemeMode.Light) }]);

      await part.reconnectAsync();
      await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Dark);
      await part.deactivateAsync();
      await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Light);

      expect(colors()).toEqual([{ color: accent(ThemeMode.Light) }, { color: accent(ThemeMode.Light) }, { color: accent(ThemeMode.Dark) }]);
    });

  it("does not continue when the runtime starts again before the window activated it", async () => {
    await expect(createPart().reconnectAsync()).resolves.toBe(false);
  });

  it("lets its context go when the window deactivates it", async () => {
    const part = createPart();
    await part.activateAsync(new RecordingWindowPartContext());

    await part.deactivateAsync();

    expect(part.context).toBeNull();
  });

  it("releases the stores of its context when the window deactivates it", async () => {
    const part = createPart();
    const context = SampleData.createContext();
    await part.activateAsync(context);
    const store = ChatStoreService.of(context);
    const tasks = BackgroundTaskStoreService.of(context);
    const layout = ProjectsLayoutService.of(context);
    const organizationLayout = OrganizationLayoutState.of(context, "my-organization");
    const organizations = OrganizationCatalog.of(context);
    const choice = ComposerDefaultService.of(context);
    const pages = ChatPages.of(context);

    await part.deactivateAsync();

    expect(context.events).toEqual([]);
    expect(context.count(MethodName.WindowClosed)).toBe(1);
    expect(context.settingOptions.size).toBe(0);
    expect(ChatStoreService.of(context)).not.toBe(store);
    expect(BackgroundTaskStoreService.of(context)).not.toBe(tasks);
    expect(ProjectsLayoutService.of(context)).not.toBe(layout);
    expect(OrganizationLayoutState.of(context, "my-organization")).not.toBe(organizationLayout);
    expect(OrganizationCatalog.of(context)).not.toBe(organizations);
    expect(ComposerDefaultService.of(context)).not.toBe(choice);
    expect(ChatPages.of(context)).not.toBe(pages);
    ChatStoreService.release(context);
    BackgroundTaskStoreService.release(context);
    ProjectsLayoutService.release(context);
    OrganizationLayoutState.release(context);
    OrganizationCatalog.release(context);
    ComposerDefaultService.release(context);
    ChatPages.release(context);
  });

  it("deactivates without a context when the window never activated it", async () => {
    const part = createPart();

    await part.deactivateAsync();

    expect(part.context).toBeNull();
  });

  it("starts a terminal in the shown chat's project folder, in another project's folder once that project's chat opens, and in the home folder with no chat tab open",
    async () => {
      const other = new Conversation("c3", SampleData.otherProject.id, "Elsewhere", SampleData.timestamp, SampleData.timestamp);
      const context = SampleData.createContext()
        .answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)])
        .answer(MethodName.ConversationList, t => [(ConversationListParams.fromJson(t).projectId === SampleData.project.id ? SampleData.conversation : other).toJson()]);
      await createPart().activateAsync(context);
      const store = ChatStoreService.of(context);
      await Wait.until(() => expect(store.loaded()).toBe(true));

      expect([store.selectedProject()?.id, TerminalStartFolder.read()]).toEqual([SampleData.project.id, null]);
      await store.conversationInView(SampleData.conversation.id);
      expect(TerminalStartFolder.read()).toBe(SampleData.project.rootPath);
      await store.conversationInView(other.id);
      expect(TerminalStartFolder.read()).toBe(SampleData.otherProject.rootPath);
      store.conversationOutOfView(other.id);
      await Wait.until(() => expect(store.selectedConversationId()).toBe(SampleData.conversation.id));
      expect(TerminalStartFolder.read()).toBe(SampleData.project.rootPath);
      store.conversationOutOfView(SampleData.conversation.id);
      expect([store.selectedConversationId(), TerminalStartFolder.read()]).toEqual([SampleData.conversation.id, null]);
      await store.conversationInView(other.id);
      store.deselectConversation();
      expect(TerminalStartFolder.read()).toBe(SampleData.otherProject.rootPath);
      expect(context.lines).toEqual([]);
    });

  it("starts a terminal in the folder of its own of a shown chat without a project", async () => {
    const scratch = new Conversation("c5", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c5");
    const context = SampleData.createContext()
      .answer(MethodName.ConversationList, t => [(Object.isNull(ConversationListParams.fromJson(t).projectId) ? scratch : SampleData.conversation).toJson()]);
    await createPart().activateAsync(context);
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));

    await store.conversationInView(scratch.id);

    expect([store.selectedProjectId(), TerminalStartFolder.read()]).toEqual([null, "/data/chats/c5"]);
    expect(context.lines).toEqual([]);
  });

  it("stops giving terminals a start folder when the window deactivates it, and gives it again once activated again", async () => {
    const part = createPart();
    const context = SampleData.createContext();
    await part.activateAsync(context);
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await ChatStoreService.of(context).conversationInView(SampleData.conversation.id);
    expect(TerminalStartFolder.read()).toBe(SampleData.project.rootPath);

    await part.deactivateAsync();
    expect(TerminalStartFolder.read()).toBeNull();
    const next = SampleData.createContext();
    await part.activateAsync(next);
    await Wait.until(() => expect(ChatStoreService.of(next).loaded()).toBe(true));
    await ChatStoreService.of(next).conversationInView(SampleData.conversation.id);

    expect(TerminalStartFolder.read()).toBe(SampleData.project.rootPath);
  });

  it("activates again after a deactivation, with the new context", async () => {
    const part = createPart();
    await part.activateAsync(new RecordingWindowPartContext());
    await part.deactivateAsync();
    const context = new RecordingWindowPartContext();

    await part.activateAsync(context);

    expect(part.context).toBe(context);
  });
});
