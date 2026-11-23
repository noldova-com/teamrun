/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type ComponentRef, EnvironmentInjector, Injector, computed, createComponent, effect, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { CommandRun, FailureCode, NotificationAction, QualifiedName } from "@noldova/desktop.protocol";
import { LinkPlace, RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import {
  AcpAgentEntry,
  AcpAgentIdParams,
  AcpAgentListing,
  AcpLocalCommandAddParams,
  Approval,
  ApprovalKind,
  ApprovalQuestion,
  ApprovalStatus,
  AttachmentContent,
  AttachmentInput,
  AttachmentReadParams,
  AuthStatus,
  ChatIdParams,
  ChatFindHit,
  ChatFindResult,
  ChatMemberModeParams,
  ChatMemberSettings,
  ChatMemberSettingsParams,
  ChatPlanFirstParams,
  ComputerUseGrant,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMember,
  ConversationPosition,
  ConversationRenameParams,
  ConversationResponder,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  DefaultTeammate,
  DefaultTeammateSetParams,
  ConversationSearchHit,
  ContextUsage,
  DetailEventPayload,
  DetailKind,
  DiscoveredProfile,
  ErrorCode,
  EventName,
  FirstLaunch,
  Harness,
  LinkedPaths,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessageSearchHit,
  MessageSearchResult,
  MessagePage,
  MessagePageParams,
  MessageDelivery,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  MethodName,
  OrganizationChat,
  OwnMcpServer,
  OwnMcpServerState,
  PlanUsage,
  PlanUsageParams,
  PlanWindow,
  PlanWindowName,
  Project,
  ProjectFolderChange,
  ProjectOpenParams,
  Provenance,
  Provider,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  ProviderSignInCommand,
  ProviderMcpServerList,
  ProviderModel,
  ProviderSignIns,
  ProviderUpdateParams,
  ProviderKind,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderIdentity,
  ProviderProfile,
  ProviderProfileDiscovery,
  ProviderTool,
  QuestionOption,
  ReadingPositionSaveParams,
  ReplySummary,
  ReplyUsage,
  RequestedSettings,
  SignInLinkPayload,
  Teammate,
  TeammateCreateParams,
  TeammateUpdateParams,
  TeammateUsage,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams,
  WaitingMessagesPayload,
  WindowIdParams,
  WrittenImageReadParams
} from "@noldova/teamrun.protocol";
import { LaunchArgumentRefusedException, LaunchedTerminal, TerminalEnd, TerminalLauncher, TerminalShellKind } from "@noldova/terminal.window";
import { LinkGesture } from "@noldova/ui.components.angular";

import { ChatAction } from "../../../src/app/enums/chat-action";
import { SendKey } from "../../../src/app/enums/send-key";
import { TerminalStep } from "../../../src/app/enums/terminal-step";
import { FileGrantException } from "../../../src/app/exceptions/file-grant.exception";
import { ListNotArrayException } from "../../../src/app/exceptions/list-not-array.exception";
import { ModelCatalogUnavailableException } from "../../../src/app/exceptions/model-catalog-unavailable.exception";
import { AcpLocalVariable } from "../../../src/app/models/acp-local-variable";
import { ComposerSettings } from "../../../src/app/models/composer-settings";
import { MessageControlState } from "../../../src/app/models/message-control-state";
import { MessageFocus } from "../../../src/app/models/message-focus";
import { ProviderChoice } from "../../../src/app/models/provider-choice";
import { ReadingPosition } from "../../../src/app/models/reading-position";
import { TeammateModelSettings } from "../../../src/app/models/teammate-model-settings";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { Resources } from "../../../src/resources";
import { CodedError } from "../../fixtures/coded-error.fixture";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { DocumentMark } from "../../fixtures/document-mark.fixture";
import { FailureCase } from "../../fixtures/failure-case.fixture";
import { FakeTerminalLauncher } from "../../fixtures/fake-terminal-launcher.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { FreshReadCase } from "../../fixtures/fresh-read-case.fixture";
import { KindReadRace } from "../../fixtures/kind-read-race.fixture";
import { RefusedError } from "../../fixtures/refused-error.fixture";
import { Required } from "../../fixtures/required.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../fixtures/teammate.fixture";
import { Wait } from "../../fixtures/wait.fixture";

@Component({ selector: "nol-teamrun-store-view", template: "", providers: [ChatStoreService.provider] })
class StoreViewComponent {
  public readonly store: ChatStoreService = inject(ChatStoreService);
}

describe("ChatStoreService", () => {
  const settings = new ComposerSettings("codex", null, null, null);
  const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const third = new Project("p3", "third", "D:\\third", SampleData.timestamp);
  const thirdChat = new Conversation("c3", "p3", "Third", SampleData.timestamp, SampleData.timestamp);
  const numbered = Array.from({ length: 5 }, (_, i) => new Message(`m${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
    [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
  let context: FakeWindowPartContext;
  let store: ChatStoreService;

  const pageOf = (messages: readonly Message[], parameters: unknown): MessagePage => {
    const params = MessagePageParams.fromJson(parameters);
    const before = params.beforeSequence;
    const after = params.afterSequence;
    const listed = messages.filter(t => t.conversationId === params.conversationId);
    const slice = !Object.isNull(before) ? listed.filter(t => t.sequence < before).slice(-params.limit)
      : !Object.isNull(after) ? listed.filter(t => t.sequence > after).slice(0, 2) : listed.slice(-2);
    const first = slice[0];
    const last = slice.at(-1);
    return new MessagePage(slice, !Object.isUndefined(first) && listed.some(t => t.sequence < first.sequence),
      !Object.isUndefined(last) && listed.some(t => t.sequence > last.sequence), listed.length);
  };
  const messages = (): readonly Message[] => store.history()?.held ?? [];
  const ids = (): string[] => messages().map(t => t.id);
  const heldOf = (conversationId: string): readonly Message[] => store.historyOf(conversationId)?.held ?? [];
  const unhandled = (): unknown[] => {
    const failures: unknown[] = [];
    const record = (event: PromiseRejectionEvent): void => {
      failures.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", record);
    onTestFinished(() => window.removeEventListener("unhandledrejection", record));
    return failures;
  };
  const marks = (...instances: string[]): DocumentMark[] => instances.map(t => new DocumentMark(Resources.conversationDocumentName, t));
  const gone = (...conversationIds: string[]): void => void context.answer(MethodName.ConversationListMembers, t => {
    const conversationId = ConversationIdParams.fromJson(t).conversationId;
    if (conversationIds.includes(conversationId))
      throw new RefusedError(`Conversation ${conversationId} was not found.`, ErrorCode.NotFound, conversationId);
    return [];
  });

  beforeEach(() => {
    context = SampleData.createContext();
    store = new ChatStoreService(context);
  });

  afterEach(() => store.dispose());

  it("keeps one loaded store for each window part context, reached through its provider, until the context is released", async () => {
    const other = SampleData.createContext();
    const shared = ChatStoreService.of(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });

    expect(ChatStoreService.of(context)).toBe(shared);
    expect(TestBed.inject(ChatStoreService)).toBe(shared);
    expect(ChatStoreService.of(other)).not.toBe(shared);
    await Wait.until(() => expect(shared.loaded()).toBe(true));
    expect(context.count(MethodName.ProviderKindList)).toBe(1);

    ChatStoreService.release(context);
    ChatStoreService.release(context);
    ChatStoreService.release(other);
    expect(context.events).toEqual([]);
    expect(other.events).toEqual([]);
    expect(ChatStoreService.of(context)).not.toBe(shared);
    ChatStoreService.release(context);
  });

  it("answers a resync of a context with no store as done, since it holds nothing to read again", async () => {
    await expect(ChatStoreService.resync(context)).resolves.toBe(true);

    expect(context.methods).toEqual([]);
  });

  it("loads its providers when a reactive read asks for it first, as a command's isEnabled does", async () => {
    const enabled = computed(() => ChatStoreService.of(context).kinds().length > 0);

    expect(enabled()).toBe(false);
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    expect(enabled()).toBe(true);
    expect(context.count(MethodName.ProviderKindList)).toBe(1);
    ChatStoreService.release(context);
  });

  it("gives the views of one tab one store through the tab's own injector, as Noldova Desktop builds it, and another tab its own", async () => {
    const other = SampleData.createContext();
    const environmentInjector = TestBed.inject(EnvironmentInjector);
    const open = (tab: FakeWindowPartContext): ComponentRef<StoreViewComponent> => createComponent(StoreViewComponent, {
      environmentInjector,
      elementInjector: Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: tab }], parent: TestBed.inject(Injector) })
    });
    const views = [open(context), open(context), open(other)];

    expect(views[1]?.instance.store).toBe(views[0]?.instance.store);
    expect(views[0]?.instance.store).toBe(ChatStoreService.of(context));
    expect(views[2]?.instance.store).toBe(ChatStoreService.of(other));
    expect(views[2]?.instance.store).not.toBe(views[0]?.instance.store);
    await Wait.until(() => expect(views[0]?.instance.store.loaded()).toBe(true));
    expect(context.count(MethodName.ProviderKindList)).toBe(1);

    for (const view of views)
      view.destroy();
    ChatStoreService.release(context);
    ChatStoreService.release(other);
  });

  it("listens to each of the runtime part's events by its qualified name and stops when disposed", async () => {
    await store.initialize();
    await store.initialize();
    expect([...context.events].sort()).toEqual([
      "teamrun.approvalCreated", "teamrun.approvalUpdated", "teamrun.backgroundTaskOutput", "teamrun.backgroundTaskUpdated", "teamrun.backgroundTasksCleared",
      "teamrun.composerDefaultUpdated", "teamrun.conversationDeleted", "teamrun.conversationRewound", "teamrun.detailAppended", "teamrun.detailUpdated", "teamrun.messageCreated", "teamrun.messageSendAbandoned",
      "teamrun.messageSending", "teamrun.messageUpdated",
      "teamrun.organizationChanged", "teamrun.organizationLayoutUpdated", "teamrun.organizationRemoved", "teamrun.panelRequested", "teamrun.planUsageUpdated", "teamrun.projectFolderChanged", "teamrun.projectsLayoutUpdated", "teamrun.providerKindInstallationChanged", "teamrun.providerKindsChanged",
      "teamrun.providerSignInsChanged", "teamrun.providerUpdated", "teamrun.replyCheckpointEnded", "teamrun.replyCheckpointStarted", "teamrun.replyThinking", "teamrun.signInLink",
      "teamrun.stateInvalidated", "teamrun.stateResyncRequested", "teamrun.waitingMessagesChanged", "teamrun.windowReloadRequested"
    ]);
    expect(context.watchedSettings).toEqual(["teamrun.sendKey", "teamrun.whileReplying"]);

    store.dispose();
    store.dispose();
    expect(context.events).toEqual([]);
    expect(context.watchedSettings).toEqual([]);
  });

  it("calls the runtime part's methods by their qualified names", async () => {
    await store.initialize();
    await Wait.until(() => expect(context.methods).toEqual(["teamrun.readingPositionList", "teamrun.providerKindList", "teamrun.providerList", "teamrun.providerSignInList", "teamrun.teammateList",
      "teamrun.defaultTeammateRead", "teamrun.projectList", "teamrun.conversationList", "teamrun.conversationList", "teamrun.messageListOpen", "teamrun.approvalListPending",
      "teamrun.providerKindInstallationList", "teamrun.planUsageList", "teamrun.teammateUsageList"]));
  });

  it("turns a chat's Plan first on and off, keeping the chat the runtime part sends back", async () => {
    context.answer(MethodName.ConversationSetPlanFirst, t => SampleData.conversation.withPlanFirst(ChatPlanFirstParams.fromJson(t).planFirst).toJson());
    await store.initialize();
    const states: unknown[] = [];

    for (const planFirst of [true, false])
      states.push([await store.setPlanFirst("c1", planFirst), store.conversation("c1")?.planFirst]);

    expect([states, context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationSetPlanFirst))
      .map(t => ChatPlanFirstParams.fromJson(t.parameters)).map(t => [t.chatId, t.planFirst])]).toEqual([[[true, true], [true, false]], [["c1", true], ["c1", false]]]);
  });

  it("loads and refreshes teammates and selected membership, with teammate-scoped mutation errors", async () => {
    const data = new TeammateFixture(context);
    await store.initialize();
    expect(store.teammates()).toHaveLength(3);
    expect(context.count(MethodName.ConversationListMembers)).toBe(0);
    await store.selectConversation("c1");
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["alice"]);
    expect(store.isTeammateUnavailable("offline")).toBe(true);
    expect(store.isTeammateUnavailable("alice")).toBe(false);
    expect(["offline", "alice"].map(t => store.listedName(Required.of(store.teammate(t))))).toEqual([Resources.formatUnavailable("Offline"), "Alice"]);
    await store.addMember("c1", "bob");
    expect(store.membersOf("c1")).toHaveLength(2);
    await store.removeMember("c1", "bob");
    expect(store.membersOf("c1")).toHaveLength(1);
    expect(await store.setMemberMode("c1", "alice", "plan")).toBe(true);
    expect([JSON.stringify(context.parametersOf(MethodName.ConversationSetMemberMode)), store.membersOf("c1").map(t => [t.teammateId, t.mode])])
      .toEqual([JSON.stringify(new ChatMemberModeParams("c1", "alice", "plan").toJson()), [["alice", "plan"]]]);
    expect(await store.setMemberSettings("c1", "alice", new ChatMemberSettings(null, "high"))).toBe(true);
    expect([JSON.stringify(context.parametersOf(MethodName.ConversationSetMemberSettings)), store.membersOf("c1").map(t => [t.teammateId, t.mode, t.settings?.effort])])
      .toEqual([JSON.stringify(new ChatMemberSettingsParams("c1", "alice", new ChatMemberSettings(null, "high")).toJson()), [["alice", "plan", "high"]]]);
    const alice = data.alice;
    await store.saveTeammate(new TeammateUpdateParams(alice.id, "Renamed", null, alice.providerId, alice.harness, null, null));
    expect(store.teammate("alice")?.name).toBe("Renamed");
    expect(await store.saveTeammate(new TeammateCreateParams("Carol", null, "a1", Harness.Provider, null, null))).toBe(true);
    expect(store.teammate("created")?.name).toBe("Carol");
    context.fail(MethodName.TeammateDelete, "Reply in progress");
    expect(await store.deleteTeammate(data.alice)).toBe(false);
    expect(context.noticeText()).toBe("@Alice: Reply in progress");
    expect(store.teammate("alice")).not.toBeNull();
    data.members = [new ConversationMember("c1", "bob", "t", null, false)];
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["bob"]));
    context.answer(MethodName.TeammateDelete, () => null);
    expect(await store.deleteTeammate(data.bob)).toBe(true);
    expect(store.teammate("bob")).toBeNull();
    expect(store.membersOf("c1")).toEqual([]);
    const listed = context.count(MethodName.ConversationListMembers);
    expect(await store.addMember("c9", "alice")).toBe(true);
    expect(context.count(MethodName.ConversationListMembers)).toBe(listed);
  });

  describe("a teammate's saves", () => {
    const personal = new ProviderChoice("codex", "a3", "Personal", "Codex");
    const releases: (() => void)[] = [];
    const updates = (): unknown[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.TeammateUpdate)).map(t => t.parameters);
    const dialogSave = (name: string, effort: string): TeammateUpdateParams => TeammateUpdateParams.of("alice", { name, effort }, "a1");
    let data: TeammateFixture;
    let holds: number;

    beforeEach(async () => {
      data = new TeammateFixture(context);
      holds = 0;
      releases.length = 0;
      context.answer(MethodName.TeammateUpdate, t => {
        const params = TeammateUpdateParams.fromJson(t);
        const stored = Required.of(data.teammates.find(u => u.id === params.teammateId));
        if (!Object.isUndefined(params.expectedProviderId) && params.expectedProviderId !== stored.providerId)
          throw new Error("Moved to another provider");
        const teammate = params.applyTo(stored, "t");
        data.teammates = data.teammates.map(u => u.id === teammate.id ? teammate : u);
        if (holds === 0)
          return teammate.toJson();
        holds -= 1;
        return new Promise<JsonValue>(resolve => releases.push(() => resolve(teammate.toJson())));
      });
      await store.initialize();
    });

    it("drops a pending move when the teammate dialog saves, so the dialog's provider stays", async () => {
      const catalog = new DeferredResponse();
      context.answer(MethodName.ProviderModelCatalog, () => catalog.promise);

      const moved = store.moveTeammate("alice", personal);
      expect(store.teammateMoves().get("alice")).toBe(personal);
      expect(await store.updateTeammate("alice", dialogSave("Renamed", "low"))).toBe(true);
      expect(store.teammateMoves().has("alice")).toBe(false);
      catalog.resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true)]));
      await moved;

      expect(updates()).toEqual([{ teammateId: "alice", name: "Renamed", effort: "low", expectedProviderId: "a1" }]);
      expect([store.teammate("alice")?.providerId, store.teammateMoves().size]).toEqual(["a1", 0]);
    });

    it("saves the teammate dialog's change after a composer save in flight, so the dialog's values stay", async () => {
      holds = 1;
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      await Wait.until(() => expect(releases).toHaveLength(1));
      const dialog = store.updateTeammate("alice", dialogSave("Renamed", "low"));
      Required.of(releases[0])();

      expect([await picked, await dialog]).toEqual([true, true]);
      expect(updates()).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }, { teammateId: "alice", name: "Renamed", effort: "low", expectedProviderId: "a1" }]);
      expect([store.teammate("alice")?.name, store.teammate("alice")?.effort]).toEqual(["Renamed", "low"]);
    });

    it("saves a composer change after the teammate dialog's save in flight, on the dialog's values", async () => {
      holds = 1;
      const dialog = store.updateTeammate("alice", dialogSave("Renamed", "low"));
      await Wait.until(() => expect(releases).toHaveLength(1));
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      Required.of(releases[0])();

      expect([await dialog, await picked]).toEqual([true, true]);
      expect(updates()).toEqual([{ teammateId: "alice", name: "Renamed", effort: "low", expectedProviderId: "a1" }, { teammateId: "alice", effort: "medium", expectedProviderId: "a1" }]);
      expect([store.teammate("alice")?.name, store.teammate("alice")?.effort]).toEqual(["Renamed", "medium"]);
    });

    it("sends the teammate dialog's save for a teammate it no longer holds and reports the refusal, while a composer change skips it", async () => {
      const report = vi.fn();
      context.fail(MethodName.TeammateUpdate, "Not found");

      expect(await store.editTeammate("gone", "a1", t => new TeammateModelSettings(t.model, "low", t.speed))).toBe(false);
      expect(context.count(MethodName.TeammateUpdate)).toBe(0);
      expect(await store.updateTeammate("gone", new TeammateUpdateParams("gone", "Gone", null, "a1", Harness.Provider, null, null), report)).toBe(false);
      expect([context.count(MethodName.TeammateUpdate), report.mock.calls]).toEqual([1, [[Resources.formatTeammateError("Gone", "Not found"), null, false, false]]]);
    });

    it("reads the teammate from Core at each save's turn, so a reload holding an older list doesn't undo a save", async () => {
      const projects = new DeferredResponse();
      const listed = context.count(MethodName.ProjectList);
      context.answer(MethodName.ProjectList, () => projects.promise);
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(listed + 1));

      expect(await store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed))).toBe(true);
      projects.resolve([SampleData.listed(SampleData.project)]);
      await Wait.until(() => expect(store.teammate("alice")?.effort).toBe("high"));
      expect(await store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, t.effort, "fast"))).toBe(true);

      expect(updates()).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }, { teammateId: "alice", speed: "fast", expectedProviderId: "a1" }]);
      expect(store.teammate("alice")?.effort).toBe("medium");
    });

    it("saves nothing and says so, naming the teammate, when Core's list can't be read at a save's turn, and clears a pending move", async () => {
      context.fail(MethodName.TeammateList, "Busy");

      expect(await store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "low", t.speed))).toBe(false);
      expect(context.noticeText()).toBe(Resources.formatTeammateError("Alice", "Busy"));
      await store.moveTeammate("alice", personal);
      expect([updates(), store.teammateMoves().size, store.teammate("alice")?.effort]).toEqual([[], 0, "high"]);

      const report = vi.fn();
      expect(await store.updateTeammate("alice", dialogSave("Renamed", "low"), report)).toBe(false);
      expect(await store.updateTeammate("gone", new TeammateUpdateParams("gone", "Gone", null, "a1", Harness.Provider, null, null), report)).toBe(false);
      expect([updates(), report.mock.calls]).toEqual([[], [[Resources.formatTeammateError("Alice", "Busy"), null, false, false], [Resources.formatTeammateError("gone", "Busy"), null, false, false]]]);
    });

    it("sends only the fields a save changes, so a change another window saved to another field stays, and skips a save that changes nothing", async () => {
      data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, t.providerId, t.harness, t.model, "low", t.createdAt, t.updatedAt) : t);

      expect(await store.updateTeammate("alice", TeammateUpdateParams.changing(Required.of(store.teammate("alice")), { name: "Renamed", effort: "high" }))).toBe(true);

      expect(updates()).toEqual([{ teammateId: "alice", name: "Renamed" }]);
      expect([store.teammate("alice")?.name, store.teammate("alice")?.effort]).toEqual(["Renamed", "low"]);
      expect(await store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, t.effort, t.speed))).toBe(false);
      expect(updates()).toHaveLength(1);
    });

    it("sends a composer pick read on the provider the composer showed, so Core refuses it once the teammate has moved to another", async () => {
      data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, "a3", t.harness, t.model, t.effort, t.createdAt, t.updatedAt) : t);

      expect(await store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed))).toBe(false);

      expect(updates()).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }]);
      expect(context.noticeText()).toBe(Resources.formatTeammateError("Alice", "Moved to another provider"));
      expect(data.teammates.find(t => t.id === "alice")?.effort).toBe("high");
    });

    it("refuses a pick made during the window's move once another writer has moved the teammate to the same provider first", async () => {
      const catalog = new DeferredResponse();
      const listed = new DeferredResponse();
      context.answer(MethodName.ProviderModelCatalog, () => catalog.promise).answer(MethodName.TeammateList, () => listed.promise);
      const reads = context.count(MethodName.TeammateList);

      const moved = store.moveTeammate("alice", personal);
      catalog.resolve(SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true)]));
      await Wait.until(() => expect(context.count(MethodName.TeammateList)).toBe(reads + 1));
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, "a3", t.harness, "gpt-5", "high", t.createdAt, t.updatedAt) : t);
      listed.resolve(data.teammates.map(t => t.toJson()));

      expect(await picked).toBe(false);
      await moved;
      expect(updates()).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }]);
      expect(data.teammates.find(t => t.id === "alice")?.effort).toBe("high");
    });

    it("refuses a pick made during a repeated move to a provider once another writer has moved the teammate there first, though an earlier move there saved", async () => {
      const work = new ProviderChoice("codex", "a1", "Work", "Codex");
      const models = SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true)]);
      context.answer(MethodName.ProviderModelCatalog, () => models);
      await store.moveTeammate("alice", personal);
      await store.moveTeammate("alice", work);
      expect(data.teammates.find(t => t.id === "alice")?.providerId).toBe("a1");
      const listed = new DeferredResponse();
      context.answer(MethodName.TeammateList, () => listed.promise);
      const reads = context.count(MethodName.TeammateList);
      const saved = updates().length;

      const moved = store.moveTeammate("alice", personal);
      await Wait.until(() => expect(context.count(MethodName.TeammateList)).toBe(reads + 1));
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, "a3", t.harness, "gpt-5", "high", t.createdAt, t.updatedAt) : t);
      listed.resolve(data.teammates.map(t => t.toJson()));

      expect(await picked).toBe(false);
      await moved;
      expect(updates().slice(saved)).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }]);
      expect(data.teammates.find(t => t.id === "alice")?.effort).toBe("high");
    });

    it("refuses a pick made during one teammate's move once another writer has moved it there first, though another teammate's move to the same provider saved", async () => {
      const listed = new DeferredResponse();
      let holding = true;
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["low", "high"], true, null, true)]))
        .answer(MethodName.TeammateList, () => holding ? listed.promise : data.teammates.map(t => t.toJson()));
      const reads = context.count(MethodName.TeammateList);

      const moved = store.moveTeammate("alice", personal);
      await Wait.until(() => expect(context.count(MethodName.TeammateList)).toBe(reads + 1));
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      holding = false;
      await store.moveTeammate("bob", personal);
      expect(data.teammates.find(t => t.id === "bob")?.providerId).toBe("a3");
      const saved = updates().length;
      data.teammates = data.teammates.map(t => t.id === "alice" ? new Teammate(t.id, t.name, t.role, "a3", t.harness, "gpt-5", "high", t.createdAt, t.updatedAt) : t);
      listed.resolve(data.teammates.map(t => t.toJson()));

      expect(await picked).toBe(false);
      await moved;
      expect(updates().slice(saved)).toEqual([{ teammateId: "alice", effort: "medium", expectedProviderId: "a1" }]);
      expect(data.teammates.find(t => t.id === "alice")?.effort).toBe("high");
    });

    it("lands a pick made while the window's own move saves on the provider it moved to", async () => {
      context.answer(MethodName.ProviderModelCatalog, () => SampleData.catalog([new ProviderModel("gpt-5", "GPT-5", "", ["medium", "high"], true, null, true)]));
      holds = 1;

      const moved = store.moveTeammate("alice", personal);
      await Wait.until(() => expect(releases).toHaveLength(1));
      const picked = store.editTeammate("alice", "a1", t => new TeammateModelSettings(t.model, "medium", t.speed));
      Required.of(releases[0])();

      expect(await picked).toBe(true);
      await moved;
      expect(updates()[1]).toEqual({ teammateId: "alice", effort: "medium", expectedProviderId: "a3" });
      expect([store.teammate("alice")?.providerId, store.teammate("alice")?.effort]).toEqual(["a3", "medium"]);
    });

    it("names a teammate whose save leaves out its name by the stored name, or by its id when the store doesn't hold it", async () => {
      const report = vi.fn();
      context.fail(MethodName.TeammateUpdate, "Not found");

      expect(await store.saveTeammate(TeammateUpdateParams.of("alice", { effort: "low" }, "a1"), report)).toBe(false);
      expect(await store.saveTeammate(TeammateUpdateParams.of("gone", { effort: "low" }, "a1"), report)).toBe(false);

      expect(report.mock.calls).toEqual([[Resources.formatTeammateError("Alice", "Not found"), null, false, false], [Resources.formatTeammateError("gone", "Not found"), null, false, false]]);
    });

    it("reports Core's stale-provider refusal of an update that leaves out the name with no taken name, though the refusal names the teammate's id", async () => {
      const report = vi.fn();
      context.refuse(MethodName.TeammateUpdate, ErrorCode.Conflict, "Moved to another provider", "gone");

      expect(await store.saveTeammate(TeammateUpdateParams.of("gone", { effort: "low" }, "a1"), report)).toBe(false);

      expect(report.mock.calls).toEqual([[Resources.formatTeammateError("gone", "Moved to another provider"), null, false, false]]);
    });

    it("forgets a pending move when it's disposed", async () => {
      context.answer(MethodName.ProviderModelCatalog, () => new DeferredResponse().promise);

      void store.moveTeammate("alice", personal);
      expect(store.teammateMoves().size).toBe(1);
      store.dispose();
      expect(store.teammateMoves().size).toBe(0);
    });
  });

  it("lists providers by label and teammates by name, ignoring case with an accented name beside its letter, and keeps them sorted as they change", async () => {
    const data = new TeammateFixture(context);
    const teammate = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
    const provider = (id: string, label: string, enabled = true): Provider =>
      new Provider(id, "codex", label, `D:\\profiles\\${id}`, AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp, enabled);
    data.teammates = [teammate("t1", "zoe"), teammate("t2", "Émile"), teammate("t3", "bob"), teammate("t4", "Alice"), teammate("t5", "edgar")];
    context.answer(MethodName.ProviderList, () => [provider("p1", "work"), provider("p2", "Émile", false), provider("p3", "Home"), provider("p4", "alpha")].map(t => t.toJson()));
    await store.initialize();

    expect(store.teammates().map(t => t.name)).toEqual(["Alice", "bob", "edgar", "Émile", "zoe"]);
    expect(store.providers().map(t => t.label)).toEqual(["alpha", "Émile", "Home", "work"]);
    expect(store.enabledProviders().map(t => t.label)).toEqual(["alpha", "Home", "work"]);

    await store.saveTeammate(new TeammateUpdateParams("t1", "Dora", null, "a1", Harness.Provider, null, null));
    expect(await store.saveTeammate(new TeammateCreateParams("carl", null, "a1", Harness.Provider, null, null))).toBe(true);
    context.emit(EventName.ProviderUpdated, provider("p4", "zulu").toJson());
    expect(store.teammates().map(t => t.name)).toEqual(["Alice", "bob", "carl", "Dora", "edgar", "Émile"]);
    await Wait.until(() => expect(store.providers().map(t => t.label)).toEqual(["Émile", "Home", "work", "zulu"]));
  });

  it("reloads the selected conversation's members after a send whose mentions can add teammates", async () => {
    const data = new TeammateFixture(context);
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const before = context.count(MethodName.ConversationListMembers);
    expect(await store.send("No mention", settings, "c1")).toBe(true);
    expect(context.count(MethodName.ConversationListMembers)).toBe(before);
    data.members.push(new ConversationMember("c1", "bob", "t", null, false));
    expect(await store.send("@Bob, have a look", settings, "c1", [], ["bob"])).toBe(true);
    expect(context.count(MethodName.ConversationListMembers)).toBe(before + 1);
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["alice", "bob"]);
    context.fail(MethodName.ConversationListMembers, "Disconnected");
    expect(await store.send("@Alice, and you", settings, "c1", [], ["alice"])).toBe(true);
    expect(context.noticeText()).toBe("Disconnected");
  });

  it("tells the reply watchers once when a working reply ends, and stops telling one that unwatched", async () => {
    const first = SampleData.withStatus(SampleData.reply, MessageStatus.Pending);
    context.answer(MethodName.MessageListOpen, () => [first.toJson()]);
    await store.initialize();
    const ended: string[] = [];
    const kept: string[] = [];
    const unwatch = store.onReplyEnded(t => ended.push(t.id));
    store.onReplyEnded(t => kept.push(t.id));

    context.emit(EventName.MessageUpdated, SampleData.withStatus(first, MessageStatus.Running).toJson());
    expect(ended).toEqual([]);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(first, MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(first, MessageStatus.Completed).toJson());
    expect(ended).toEqual([first.id]);
    unwatch();
    const second = new Message("m3", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id, MessageStatus.Running, [], first.provenance,
      SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageCreated, second.toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(second, MessageStatus.Failed).toJson());
    expect(ended).toEqual([first.id]);
    expect(kept).toEqual([first.id, second.id]);
  });

  it("tells the reply watchers of a working reply that ended while its end was missed, once a resync no longer lists it, and of none still working, gone or unread", async () => {
    const reply = (id: string, status: MessageStatus): Message => new Message(id, "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id, status, [],
      SampleData.reply.provenance, SampleData.timestamp, SampleData.timestamp, status === MessageStatus.Running ? null : SampleData.timestamp);
    context.answer(MethodName.MessageListOpen, () => ["ended", "gone", "running", "unread"].map(t => reply(t, MessageStatus.Running).toJson()))
      .answer(MethodName.MessageSummary, t => {
        const messageId = MessageIdParams.fromJson(t).messageId;
        if (messageId === "unread")
          throw new RuntimeRequestException(FailureCode.Internal, "Summary failed");
        return messageId === "gone" ? null
          : ReplySummary.fromMessage(reply(messageId, messageId === "ended" ? MessageStatus.Completed : MessageStatus.Running)).toJson();
      });
    await store.initialize();
    const ended: string[] = [];
    store.onReplyEnded(t => ended.push(`${t.id}:${t.status}`));
    const asked = context.count(MethodName.MessageSummary);
    expect(store.workingReplies().map(t => t.id)).toEqual(["ended", "gone", "running", "unread"]);

    context.answer(MethodName.MessageListOpen, () => []);
    await expect(store.resync()).resolves.toBe(true);

    await Wait.until(() => expect(context.count(MethodName.MessageSummary)).toBe(asked + 4));
    await Wait.until(() => expect(ended).toEqual([`ended:${MessageStatus.Completed}`]));
    expect(store.workingReplies()).toEqual([]);
  });

  it("tells the reply watchers once of a reply that starts while a resync reads the open replies, and asks no summary of it", async () => {
    const live = new Message("live", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id, MessageStatus.Running, [], SampleData.reply.provenance,
      SampleData.timestamp, SampleData.timestamp, null);
    await store.initialize();
    const ended: string[] = [];
    store.onReplyEnded(t => ended.push(t.id));
    const asked = context.count(MethodName.MessageSummary);
    const read = context.count(MethodName.MessageListOpen);
    const listed = new DeferredResponse();
    context.answer(MethodName.MessageListOpen, () => listed.promise)
      .answer(MethodName.MessageSummary, () => ReplySummary.fromMessage(SampleData.withStatus(live, MessageStatus.Completed)).toJson());

    const resynced = store.resync();
    await Wait.until(() => expect(context.count(MethodName.MessageListOpen)).toBe(read + 1));
    context.emit(EventName.MessageCreated, live.toJson());
    listed.resolve([]);
    await expect(resynced).resolves.toBe(true);
    const working = store.workingReplies().map(t => t.id);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(live, MessageStatus.Completed).toJson());

    expect([working, ended, context.count(MethodName.MessageSummary) - asked]).toEqual([["live"], ["live"], 0]);
    expect(store.workingReplies()).toEqual([]);
  });

  it("keeps a conversation busy across queued replies and follows their terminal updates", async () => {
    const first = SampleData.withStatus(SampleData.reply, MessageStatus.Pending);
    const queued = new Message("second", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id,
      MessageStatus.Pending, [], first.provenance, SampleData.timestamp, null, null, [], "bob", "Bob");
    context.answer(MethodName.MessageListOpen, () => [first.toJson(), queued.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.runningReply()?.id).toBe(first.id);
    expect(store.workingReplies().map(t => t.id)).toEqual([first.id, queued.id]);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(first, MessageStatus.Completed).toJson());
    expect(store.isWorking("c1")).toBe(true);
    expect(store.runningReply()?.id).toBe(queued.id);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(queued, MessageStatus.Running).toJson());
    expect(store.runningReply()?.status).toBe(MessageStatus.Running);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(queued, MessageStatus.Cancelled).toJson());
    expect(store.isWorking("c1")).toBe(false);
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    expect(await store.send("@Bob unavailable", settings, "c1", [], ["bob"])).toBe(true);
    expect(store.runningReply()).toBeNull();
    expect(context.parametersOf(MethodName.MessageSend)).toMatchObject({ requested: null, providerId: null, mentionedTeammateIds: ["bob"] });
  });

  it("marks a chat's tab working while any reply in it runs, waits or asks for approval, once for the chat, until its last one ends", async () => {
    const asking = new Message("asking", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id, MessageStatus.AwaitingApproval, [], SampleData.reply.provenance,
      SampleData.timestamp, SampleData.timestamp, null);
    const elsewhere = new Message("elsewhere", "c2", 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], SampleData.reply.provenance, SampleData.timestamp, null, null);
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    expect(context.workingMarks).toEqual(marks("c1"));

    context.emit(EventName.MessageUpdated, asking.toJson());
    context.emit(EventName.MessageCreated, elsewhere.toJson());
    expect(context.workingMarks).toEqual(marks("c1", "c2"));
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    expect(context.workingMarks).toEqual(marks("c1", "c2"));
    context.emit(EventName.MessageUpdated, SampleData.withStatus(asking, MessageStatus.Failed).toJson());
    expect(context.workingMarks).toEqual(marks("c2"));
    context.emit(EventName.MessageUpdated, SampleData.withStatus(elsewhere, MessageStatus.Running).toJson());
    expect(context.workingMarks).toEqual(marks("c2"));
    context.emit(EventName.MessageUpdated, SampleData.withStatus(elsewhere, MessageStatus.Cancelled).toJson());
    expect(context.workingMarks).toEqual([]);
  });

  it("marks again the chats a reload finds working, clears the ones it finds idle, and clears every mark when it's disposed", async () => {
    const elsewhere = new Message("elsewhere", "c2", 0, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.reply.provenance, SampleData.timestamp, SampleData.timestamp, null);
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    expect(context.workingMarks).toEqual(marks("c1"));

    context.answer(MethodName.MessageListOpen, () => [elsewhere.toJson()]);
    await store.initialize();
    expect(context.workingMarks).toEqual(marks("c2"));
    store.dispose();

    expect(context.workingMarks).toEqual([]);
  });

  describe("watching a window with no view", () => {
    const elsewhere = new Message("elsewhere", "c2", 0, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.reply.provenance, SampleData.timestamp,
      SampleData.timestamp, null);

    afterEach(() => ChatStoreService.release(context));

    it("reads only the open replies and follows only their events, marking each chat a reply runs in until it ends, as one store however often it's watched", async () => {
      context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);

      const watched = ChatStoreService.watch(context);
      await Wait.until(() => expect(context.workingMarks).toEqual(marks("c1")));
      expect(context.methods).toEqual([FakeWindowPartContext.qualify(MethodName.MessageListOpen)]);
      expect(context.events).toEqual([EventName.MessageCreated, EventName.MessageUpdated, EventName.StateInvalidated, EventName.StateResyncRequested]
        .map(t => FakeWindowPartContext.qualify(t)));

      context.emit(EventName.MessageCreated, SampleData.withStatus(elsewhere, MessageStatus.Pending).toJson());
      expect(context.workingMarks).toEqual(marks("c1", "c2"));
      context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
      expect(context.workingMarks).toEqual(marks("c2"));
      expect(ChatStoreService.watch(context)).toBe(watched);
      expect(context.count(MethodName.MessageListOpen)).toBe(1);

      ChatStoreService.release(context);
      expect(context.workingMarks).toEqual([]);
      expect(context.events).toEqual([]);
    });

    it("keeps a reply's event that comes while it reads the open replies over what the read finds", async () => {
      const listed = new DeferredResponse();
      context.answer(MethodName.MessageListOpen, () => listed.promise);
      ChatStoreService.watch(context);

      context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
      listed.resolve([SampleData.reply.toJson(), elsewhere.toJson()]);

      await Wait.until(() => expect(context.workingMarks).toEqual(marks("c2")));
    });

    it("tells the reply watchers once of a reply that ends while it reads the open replies again, though the read still lists it", async () => {
      const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running);
      context.answer(MethodName.MessageListOpen, () => [running.toJson()]);
      const store = ChatStoreService.watch(context);
      await Wait.until(() => expect(context.workingMarks).toEqual(marks("c1")));
      const ended: string[] = [];
      store.onReplyEnded(t => ended.push(t.id));
      const listed = new DeferredResponse();
      context.answer(MethodName.MessageListOpen, () => listed.promise);

      const reading = ChatStoreService.resync(context);
      context.emit(EventName.MessageUpdated, SampleData.withStatus(running, MessageStatus.Completed).toJson());
      listed.resolve([running.toJson()]);

      await expect(reading).resolves.toBe(true);
      expect([ended, context.workingMarks, context.count(MethodName.MessageSummary)]).toEqual([[running.id], [], 0]);
    });

    it("reads the open replies again when the runtime's state is invalidated or asks for a resync, or the window resyncs, answering whether that worked", async () => {
      context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
      ChatStoreService.watch(context);
      await Wait.until(() => expect(context.workingMarks).toEqual(marks("c1")));

      context.answer(MethodName.MessageListOpen, () => [elsewhere.toJson()]);
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(context.workingMarks).toEqual(marks("c2")));
      context.answer(MethodName.MessageListOpen, () => []);
      context.emit(EventName.StateResyncRequested, null);
      await Wait.until(() => expect(context.workingMarks).toEqual([]));
      context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
      await expect(ChatStoreService.resync(context)).resolves.toBe(true);
      expect(context.workingMarks).toEqual(marks("c1"));
      context.fail(MethodName.MessageListOpen, "The runtime part is away.");
      await expect(ChatStoreService.resync(context)).resolves.toBe(false);

      expect(context.workingMarks).toEqual(marks("c1"));
      expect(context.count(MethodName.ProjectList)).toBe(0);
    });

    it("lets a read that ends after a newer one change nothing", async () => {
      const older = new DeferredResponse();
      const newer = new DeferredResponse();
      ChatStoreService.watch(context);
      context.answer(MethodName.MessageListOpen, () => older.promise);
      const late = ChatStoreService.resync(context);
      context.answer(MethodName.MessageListOpen, () => newer.promise);
      const early = ChatStoreService.resync(context);

      newer.resolve([elsewhere.toJson()]);
      await expect(early).resolves.toBe(true);
      expect(context.workingMarks).toEqual(marks("c2"));
      older.resolve([SampleData.reply.toJson()]);
      await expect(late).resolves.toBe(true);

      expect(context.workingMarks).toEqual(marks("c2"));
    });

    it("loads in full once a view mounts, ignoring its watch's read that ends after, and drops each subscription once when released", async () => {
      const listed = new DeferredResponse();
      const unsubscribed: number[] = [];
      let subscribed = 0;
      const onEvent = context.onEvent.bind(context);
      context.onEvent = (event: string, listener: (payload: JsonValue) => void): (() => void) => {
        const id = subscribed++;
        const unsubscribe = onEvent(event, listener);
        return () => {
          unsubscribed.push(id);
          unsubscribe();
        };
      };
      ChatStoreService.watch(context);
      context.answer(MethodName.MessageListOpen, () => listed.promise);
      const late = ChatStoreService.resync(context);
      context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);

      const mounted = ChatStoreService.of(context);
      await Wait.until(() => expect(mounted.loaded()).toBe(true));
      listed.resolve([]);
      await expect(late).resolves.toBe(true);

      expect(context.workingMarks).toEqual(marks("c1"));
      expect(context.count(MethodName.ProviderKindList)).toBe(1);
      expect(ChatStoreService.of(context)).toBe(mounted);
      ChatStoreService.release(context);
      expect(context.events).toEqual([]);
      expect([...unsubscribed].sort((a, b) => a - b)).toEqual(Array.from({ length: subscribed }, (_, i) => i));
    });
  });

  it("keeps the responder the runtime holds when a starting choice finds the chat already answered", async () => {
    await store.initialize();
    const alice = new ConversationResponder("alice");
    context.answer(MethodName.ConversationResponderSet, () => SampleData.conversation.withResponder(alice).toJson());
    const responder = new ConversationResponder(null, new RequestedSettings("claude", "sonnet", null), "a1");

    await store.setResponder("c1", responder, false, true);

    expect(store.conversation("c1")?.responder?.teammateId).toBe("alice");
    expect(JSON.stringify(context.parametersOf(MethodName.ConversationResponderSet))).toBe(JSON.stringify(new ConversationResponderParams("c1", responder, false, true).toJson()));
    expect(context.noticeText()).toBeNull();
  });

  it("takes the responder the runtime holds for every write the person didn't choose, so one queued behind a held starting write doesn't keep its own", async () => {
    await store.initialize();
    const start = new DeferredResponse();
    const alice = new ConversationResponder("alice");
    let call = 0;
    context.answer(MethodName.ConversationResponderSet, () => call++ === 0 ? start.promise : SampleData.conversation.withResponder(alice).toJson());
    const fallback = (model: string): ConversationResponder => new ConversationResponder(null, new RequestedSettings("claude", model, null), "a1");

    const first = store.setResponder("c1", fallback("sonnet"), false, true);
    const second = store.setResponder("c1", fallback("opus"));
    await Wait.until(() => expect(context.count(MethodName.ConversationResponderSet)).toBe(1));
    expect(store.conversation("c1")?.responder?.requested?.model).toBe("opus");
    start.resolve(SampleData.conversation.withResponder(alice).toJson());
    await Promise.all([first, second]);

    expect(store.conversation("c1")?.responder?.teammateId).toBe("alice");
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationResponderSet))
      .map(t => ConversationResponderParams.fromJson(t.parameters).start)).toEqual([true, false]);
  });

  it("shows a chat's new chosen responder at once, while the runtime keeps it, and leaves an unknown chat alone", async () => {
    await store.initialize();
    const kept = new DeferredResponse();
    context.answer(MethodName.ConversationResponderSet, () => kept.promise);
    const responder = new ConversationResponder(null, new RequestedSettings("claude", "sonnet", null), "a1");

    const setting = store.setResponder("c1", responder);
    expect(JSON.stringify(store.conversation("c1")?.responder?.toJson())).toBe(JSON.stringify(responder.toJson()));
    expect(store.isBusy()).toBe(false);
    kept.resolve(SampleData.conversation.withResponder(responder).toJson());
    await setting;
    expect(context.noticeText()).toBeNull();
    expect(JSON.stringify(context.parametersOf(MethodName.ConversationResponderSet))).toBe(JSON.stringify(new ConversationResponderParams("c1", responder).toJson()));
    await store.setResponder("gone", responder);
    expect(context.count(MethodName.ConversationResponderSet)).toBe(1);
  });

  it("sends a chat's chosen responders one after another, and after a refusal shows the last one the runtime kept", async () => {
    await store.initialize();
    const answers = [new DeferredResponse(), new DeferredResponse(), new DeferredResponse(), new DeferredResponse()];
    const refused = [true, false, false, true];
    let call = 0;
    context.answer(MethodName.ConversationResponderSet, t => {
      const index = call++;
      return Required.of(answers[index]).promise.then(() => {
        if (refused[index])
          throw new Error("Refused");
        return SampleData.conversation.withResponder(ConversationResponderParams.fromJson(t).responder).toJson();
      });
    });
    const alice = new ConversationResponder("alice");
    const bob = new ConversationResponder("bob");
    const carol = new ConversationResponder("carol");
    const dave = new ConversationResponder("dave");
    const shown = (): string | null | undefined => store.conversation("c1")?.responder?.teammateId;

    const first = store.setResponder("c1", alice);
    const second = store.setResponder("c1", bob);
    expect(shown()).toBe("bob");
    await Wait.until(() => expect(context.count(MethodName.ConversationResponderSet)).toBe(1));
    await Promise.resolve();
    expect(context.count(MethodName.ConversationResponderSet)).toBe(1);
    Required.of(answers[0]).resolve(null);
    await Wait.until(() => expect(context.count(MethodName.ConversationResponderSet)).toBe(2));
    expect([shown(), context.noticeText()]).toEqual(["bob", "Refused"]);
    Required.of(answers[1]).resolve(null);
    await Promise.all([first, second]);
    expect(shown()).toBe("bob");

    const third = store.setResponder("c1", carol);
    const fourth = store.setResponder("c1", dave);
    Required.of(answers[2]).resolve(null);
    await Wait.until(() => expect(context.count(MethodName.ConversationResponderSet)).toBe(4));
    expect(shown()).toBe("dave");
    Required.of(answers[3]).resolve(null);
    await Promise.all([third, fourth]);
    expect(shown()).toBe("carol");
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationResponderSet))
      .map(t => ConversationResponderParams.fromJson(t.parameters).responder?.teammateId)).toEqual(["alice", "bob", "carol", "dave"]);
  });

  it("shows the last chat shown whose tab is still open, and none once no chat tab is open, while the selection stays", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.conversationInView("c1");
    await store.conversationInView("c2");
    const states = [store.shownConversationId()];

    store.conversationOutOfView("c2");
    states.push(store.shownConversationId());
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c1"));
    store.conversationOutOfView("c1");
    states.push(store.shownConversationId(), store.selectedConversationId());

    expect(states).toEqual(["c2", "c1", null, "c1"]);
  });

  it("finds a teammate's Organization chats by the organization and the teammate, so one teammate keeps a chat in each organization", async () => {
    const chatIn = (id: string, organizationId: string): Conversation => new Conversation(id, null, "Organization · Alice", SampleData.timestamp, SampleData.timestamp,
      false, null, null, false, null, false, [], false, false, null, new OrganizationChat(organizationId, "alice"));
    context.answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId)
      ? [chatIn("mine", "my-organization").toJson(), chatIn("studio", "studio").toJson()] : [SampleData.conversation.toJson()]);
    await store.initialize();

    expect([store.organizationChatOf("my-organization", "alice")?.id, store.organizationChatOf("studio", "alice")?.id, store.organizationChatOf("studio", "bob")])
      .toEqual(["mine", "studio", null]);
    expect([store.organizationChats("studio").map(t => t.id), store.organizationChats("other").map(t => t.id)]).toEqual([["studio"], []]);
    expect([store.organizationChatsByTeammate("my-organization").get("alice")?.id, store.organizationChatsByTeammate("studio").get("alice")?.id,
      store.organizationChatsByTeammate("studio").size]).toEqual(["mine", "studio", 1]);
  });

  it("hands out each message that arrives in a chat on screen once, and none that arrive elsewhere, updated, or after the chat leaves the screen", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.conversationInView("c1");
    const arrived = (id: string, conversationId: string, sequence: number): Message => new Message(id, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, id)], null, SampleData.timestamp, null, SampleData.timestamp);

    context.emit(EventName.MessageCreated, arrived("shown", "c1", 5).toJson());
    context.emit(EventName.MessageCreated, arrived("elsewhere", "c2", 0).toJson());
    context.emit(EventName.MessageUpdated, arrived("updated", "c1", 6).toJson());
    context.emit(EventName.MessageCreated, arrived("left", "c1", 7).toJson());
    const taken = [store.takeArrived("shown"), store.takeArrived("shown"), store.takeArrived("elsewhere"), store.takeArrived("updated")];
    store.conversationOutOfView("c1");
    taken.push(store.takeArrived("left"));

    expect(taken).toEqual([true, false, false, false, false]);
  });

  it("tells its watchers each time the chat on screen changes, and only then, until they stop watching", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const shown: (string | null)[] = [];
    const unwatch = store.onShownConversationChanged(t => shown.push(t));

    await store.conversationInView("c1");
    await store.conversationInView("c2");
    store.conversationOutOfView("c2");
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c1"));
    store.conversationOutOfView("c1");
    unwatch();
    await store.conversationInView("c2");

    expect(shown).toEqual(["c1", "c2", "c1", null]);
  });

  it("tells its watchers from inside an effect without making the effect follow the chat on screen", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const shown: (string | null)[] = [];
    store.onShownConversationChanged(t => shown.push(t));
    let runs = 0;
    TestBed.runInInjectionContext(() => effect(() => {
      runs += 1;
      if (runs === 1)
        store.deselectConversation();
    }));
    TestBed.tick();

    await store.conversationInView("c2");
    TestBed.tick();

    expect([runs, shown]).toEqual([1, ["c2"]]);
  });

  it("keeps the history during local and peer catalog changes", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    const history = store.history();
    const pages = context.count(MethodName.MessagePage);
    const renamed = new Conversation("c1", "p1", "Renamed", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [renamed.toJson()]);
    context.answer(MethodName.ConversationRename, () => {
      context.emit(EventName.StateInvalidated, null);
      return renamed.toJson();
    });
    await store.renameConversation("c1", "Renamed");
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    const peer = new Conversation("peer", "p1", "Created elsewhere", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [renamed.toJson(), peer.toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(store.hasConversation("peer")).toBe(true);
    expect(store.selectedConversation()?.title).toBe("Renamed");
    expect(store.history()).toBe(history);
    expect(context.count(MethodName.MessagePage)).toBe(pages);
  });

  it("resyncs missed message events once after coalesced reconnect notifications, and only for a selected conversation, counting each resync", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    const providers = new DeferredResponse();
    context.answer(MethodName.ProviderList, () => providers.promise);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false).toJson());
    const pages = context.count(MethodName.MessagePage);
    const resyncs = store.resyncs();
    context.emit(EventName.StateInvalidated, null);
    context.emit(EventName.StateResyncRequested, null);
    context.emit(EventName.StateResyncRequested, null);
    providers.resolve([SampleData.provider.toJson()]);
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(store.resyncs()).toBe(resyncs + 1);
    expect(messages()[0]?.status).toBe(MessageStatus.Completed);
    expect(store.runningReply()).toBeNull();
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);

    store.deselectConversation();
    const catalogs = context.count(MethodName.ProjectList);
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(catalogs + 1));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);
    expect(store.resyncs()).toBe(resyncs + 2);
  });

  it("lists the installations, which reads the providers' latest versions, when the window loads and on a reconnect, not on each catalog change", async () => {
    await store.initialize();
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    const listed = context.count(MethodName.ProviderKindInstallationList);
    expect(listed).toBeGreaterThan(0);
    const catalogs = context.count(MethodName.ProjectList);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(catalogs + 1));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(context.count(MethodName.ProviderKindInstallationList)).toBe(listed);

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(catalogs + 2));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(context.count(MethodName.ProviderKindInstallationList)).toBe(listed + 1);
  });

  it("shows the selected conversation only while it is in view, and selects the last other one in view when it leaves", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const selected: (string | null)[] = [];
    const shown: (string | null)[] = [];
    const record = (): void => {
      selected.push(store.selectedConversationId());
      shown.push(store.shownConversationId());
    };

    await store.conversationInView("c1");
    await store.conversationInView("c2");
    record();
    store.conversationOutOfView("c2");
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c1"));
    record();
    store.conversationOutOfView("c1");
    record();
    await store.conversationInView("c1");
    record();
    store.conversationOutOfView("c2");
    record();

    expect([selected, shown]).toEqual([["c2", "c1", "c1", "c1", "c1"], ["c2", "c1", null, "c1", "c1"]]);
  });

  it("marks only the chat being opened while its tab replaces the one shown, and selects no other chat in view meanwhile", async () => {
    const loose = new Conversation("c3", null, "Loose", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), loose.toJson()]);
    await store.initialize();
    await store.conversationInView("c1");
    await store.conversationInView("c2");
    const marks = [store.markedConversationId()];

    store.conversationOpening("c3");
    marks.push(store.markedConversationId());
    store.conversationOutOfView("c2");
    marks.push(store.markedConversationId());
    const opened = store.conversationInView("c3");
    marks.push(store.markedConversationId());
    await opened;
    marks.push(store.markedConversationId());

    expect(marks).toEqual(["c2", "c3", "c3", "c3", "c3"]);
    expect([store.selectedConversationId(), store.selectedProjectId()]).toEqual(["c3", null]);
  });

  it("marks only the chat being opened in a new tab while the chat selected stays in view, until its messages load", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.conversationInView("c1");
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c2"
      ? delayed.promise : SampleData.page([SampleData.userMessage], false, false).toJson());

    store.conversationOpening("c2");
    const opened = store.conversationInView("c2");
    await Wait.until(() => expect(context.requests.some(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)
      && MessagePageParams.fromJson(t.parameters).conversationId === "c2")).toBe(true));
    const loading = [store.selectedConversationId(), store.markedConversationId()];
    delayed.resolve(SampleData.page([], false, false).toJson());
    await opened;

    expect([loading, [store.selectedConversationId(), store.markedConversationId()]]).toEqual([["c1", "c2"], ["c2", "c2"]]);
  });

  it("selects a chat opened while its tab is already in view in another group, and the chat left in view once the selected one closes", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.conversationInView("c1");
    await store.conversationInView("c2");

    store.conversationOpening("c1");
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c1"));
    const opened = [store.selectedConversationId(), store.markedConversationId()];
    store.conversationOutOfView("c1");
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c2"));

    expect([opened, [store.selectedConversationId(), store.markedConversationId()]]).toEqual([["c1", "c1"], ["c2", "c2"]]);
  });

  it("marks the chat shown again once a chat being opened closes, follows a project opened meanwhile, and opening the chat shown changes nothing", async () => {
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p2" ? [] : [SampleData.conversation.toJson(), second.toJson()])
      .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    await store.initialize();
    await store.conversationInView("c1");
    const marks: (string | null)[] = [];

    store.conversationOpening("c1");
    marks.push(store.markedConversationId());
    store.conversationOpening("c2");
    marks.push(store.markedConversationId());
    store.conversationOutOfView("c2");
    marks.push(store.markedConversationId());
    store.conversationOpening("c2");
    await store.openProject(SampleData.otherProject.rootPath);
    marks.push(store.markedConversationId());

    expect(marks).toEqual(["c1", "c2", "c1", null]);
  });

  it("keeps the latest selection when earlier page requests finish late", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c2"
      ? delayed.promise : SampleData.page([SampleData.userMessage], false, false).toJson());
    const earlier = store.selectConversation("c2");
    await store.selectConversation("c1");
    delayed.resolve(SampleData.page([], false, false).toJson());
    await earlier;
    expect(store.selectedConversationId()).toBe("c1");
    expect(ids()).toEqual(["m1"]);

    store.rememberPosition("c2", new ReadingPosition("x", 5, 0));
    const around = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c2"
      ? around.promise : SampleData.page([SampleData.userMessage], false, false).toJson());
    const remembered = store.selectConversation("c2");
    await store.selectConversation("c1");
    around.resolve(SampleData.page([], false, false).toJson());
    await remembered;
    expect(store.selectedConversationId()).toBe("c1");
    expect(ids()).toEqual(["m1"]);

    const abandoned = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => abandoned.promise);
    const selecting = store.selectConversation("c2");
    store.deselectConversation();
    abandoned.resolve(SampleData.page([], false, false).toJson());
    await selecting;
    expect(store.selectedConversationId()).toBeNull();
  });

  it("keeps the latest selection when an earlier selection's approvals or members answer late", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const approvals = new DeferredResponse();
    context.answer(MethodName.ApprovalList, t => ConversationIdParams.fromJson(t).conversationId === "c2"
      ? approvals.promise : []);
    const approvalsAsked = context.count(MethodName.ApprovalList);
    const byApprovals = store.selectConversation("c2");
    await Wait.until(() => expect(context.count(MethodName.ApprovalList)).toBe(approvalsAsked + 1));
    await store.selectConversation("c1");
    approvals.resolve([SampleData.approval.toJson()]);
    await byApprovals;
    expect(store.selectedConversationId()).toBe("c1");
    expect(store.pendingApprovals()).toEqual([]);

    const members = new DeferredResponse();
    context.answer(MethodName.ApprovalList, () => []);
    context.answer(MethodName.ConversationListMembers, t => ConversationIdParams.fromJson(t).conversationId === "c2"
      ? members.promise : []);
    const membersAsked = context.count(MethodName.ConversationListMembers);
    const byMembers = store.selectConversation("c2");
    await Wait.until(() => expect(context.count(MethodName.ConversationListMembers)).toBe(membersAsked + 1));
    await store.selectConversation("c1");
    members.resolve([new ConversationMember("c2", "alice", "t", null, false).toJson()]);
    await byMembers;
    expect(store.selectedConversationId()).toBe("c1");
    expect(store.membersOf("c2")).toEqual([]);
  });

  it("selects nothing when the conversation it opens leaves the catalog while it loads", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    const page = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c2" ? page.promise : SampleData.page([], false, false).toJson());
    const pages = context.count(MethodName.MessagePage);
    const selecting = store.selectConversation("c2");
    await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pages + 1));

    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson()]);
    gone("c2");
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.conversation("c2")).toBeNull());
    page.resolve(SampleData.page([], false, false).toJson());
    await selecting;

    expect(store.selectedConversationId()).toBeNull();
    expect(store.conversation("c1")?.id).toBe("c1");
  });

  it("selects nothing when the conversation it opens is in a project a resync no longer lists", async () => {
    const elsewhere = new Conversation("c4", SampleData.otherProject.id, "Elsewhere", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)])
      .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [elsewhere.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    const page = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c4" ? page.promise : SampleData.page([], false, false).toJson());
    const pages = context.count(MethodName.MessagePage);
    const selecting = store.selectConversation("c4");
    await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pages + 1));

    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.conversation("c4")).toBeNull());
    page.resolve(SampleData.page([], false, false).toJson());
    await selecting;

    expect(store.selectedConversationId()).toBeNull();
    expect(store.conversation("c1")?.id).toBe("c1");
    expect(store.isDeleted("c4")).toBe(false);
  });

  it("has no history while no conversation is selected", () => {
    expect(store.selectedConversationId()).toBeNull();
    expect(store.history()).toBeNull();
  });

  it("keeps a window for each shown conversation that follows its own events, approvals and reads while another is selected", async () => {
    const other = (id: string, sequence: number): Message => new Message(id, "c2", sequence, MessageAuthor.User, null, MessageStatus.Completed, [], null,
      SampleData.timestamp, null, SampleData.timestamp);
    const ofC1 = (id: string, sequence: number): Message => new Message(id, "c1", sequence, MessageAuthor.User, null, MessageStatus.Completed, [], null,
      SampleData.timestamp, null, SampleData.timestamp);
    const shown = (): string[] => heldOf("c1").map(t => t.id);
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    context.answer(MethodName.MessagePage, t => pageOf([...numbered, other("n0", 0), other("n1", 1)], t).toJson());
    context.answer(MethodName.ApprovalList, t => ConversationIdParams.fromJson(t).conversationId === "c1" ? [SampleData.approval.toJson()] : []);
    await store.initialize();
    await store.selectConversation("c2");
    expect(store.approvalsOf("m2")).toEqual([]);

    const release = store.showConversation("c1");
    await Wait.until(() => expect(store.isHistoryLoaded("c1")).toBe(true));
    expect(shown()).toEqual(["m3", "m4"]);
    expect(store.approvalsOf("m2").map(t => t.id)).toEqual(["ap1"]);
    context.emit(EventName.MessageCreated, ofC1("m5", 5).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m4", SampleData.detail(1, DetailKind.Text, "more")).toJson());
    await store.historyOf("c1")?.readAsync(1, 3);

    expect(shown()).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(heldOf("c1")[3]?.details.map(t => t.text)).toEqual(["t4", "more"]);
    expect(store.messageIndexOf("c1").map(t => t.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(store.selectedConversationId()).toBe("c2");
    expect(ids()).toEqual(["n0", "n1"]);
    expect(store.history()?.length()).toBe(2);
    const beside = store.showConversation("c2");
    beside();
    beside();
    expect(store.isHistoryLoaded("c2")).toBe(true);

    const pages = context.count(MethodName.MessagePage);
    await store.selectConversation("c1");
    expect(context.count(MethodName.MessagePage)).toBe(pages);
    expect(ids()).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    await store.selectConversation("c2");
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);
    expect(store.isHistoryLoaded("c1")).toBe(true);

    release();
    release();
    context.emit(EventName.MessageCreated, ofC1("m6", 6).toJson());
    expect(store.isHistoryLoaded("c1")).toBe(false);
    expect(heldOf("c1")).toEqual([]);
    expect(ids()).toEqual(["n0", "n1"]);
  });

  it("reads a conversation once for its history and its selection together, and drops a page whose window closed before it answered", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const first = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => first.promise);
    const pages = context.count(MethodName.MessagePage);
    const release = store.showConversation("c1");
    const selecting = store.selectConversation("c1");
    await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pages + 1));
    release();
    first.resolve(SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson());
    await selecting;
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);
    expect(store.selectedConversationId()).toBe("c1");
    expect(ids()).toEqual(["m1", "m2"]);

    const late = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => late.promise);
    const closing = store.showConversation("c2");
    await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pages + 2));
    closing();
    const kept = new Message("n0", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.MessagePage, () => SampleData.page([kept], false, false).toJson());
    const reopened = store.showConversation("c2");
    await Wait.until(() => expect(store.isHistoryLoaded("c2")).toBe(true));
    late.resolve(SampleData.page([SampleData.userMessage], false, false).toJson());
    await Wait.until(() => expect(store.isBusy()).toBe(false));

    expect(heldOf("c2").map(t => t.id)).toEqual(["n0"]);
    expect(context.noticeText()).toBeNull();
    reopened();
  });

  it("reads every shown conversation's window again on a resync, and leaves a window of an unknown conversation unread", async () => {
    const asked: string[] = [];
    const kept = new Message("n0", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    const release = store.showConversation("c2");
    const unknown = store.showConversation("gone");
    await Wait.until(() => expect(store.isHistoryLoaded("c2")).toBe(true));
    context.answer(MethodName.MessagePage, t => {
      const id = MessagePageParams.fromJson(t).conversationId;
      asked.push(id);
      return (id === "c1" ? SampleData.page([SampleData.userMessage, SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false)
        : SampleData.page([kept], false, false)).toJson();
    });

    await expect(store.resync()).resolves.toBe(true);

    expect(asked.toSorted()).toEqual(["c1", "c2"]);
    expect(messages()[1]?.status).toBe(MessageStatus.Completed);
    expect(heldOf("c2").map(t => t.id)).toEqual(["n0"]);
    expect(store.isHistoryLoaded("gone")).toBe(false);
    release();
    unknown();
  });

  it("keeps the newest member list when an earlier list answers late", async () => {
    const data = new TeammateFixture(context);
    await store.initialize();
    await store.selectConversation("c1");
    const late = new DeferredResponse();
    context.answer(MethodName.ConversationListMembers, () => late.promise);
    const adding = store.addMember("c1", "bob");
    context.answer(MethodName.ConversationListMembers, () => [new ConversationMember("c1", "bob", "t", null, false).toJson()]);
    await store.removeMember("c1", "alice");
    late.resolve([new ConversationMember("c1", "alice", "t", null, false).toJson()]);
    expect(await adding).toBe(true);
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["bob"]);
    expect(data.members.map(t => t.teammateId)).toEqual(["bob"]);
  });

  it("keeps an event that arrives while the catalog loads over the catalog's older answers", async () => {
    await store.initialize();
    const approvals = new DeferredResponse();
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    context.answer(MethodName.ApprovalListPending, () => approvals.promise);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ApprovalListPending)).toBe(2));
    const loggedOut = new Provider("a1", "codex", "Work", "D:\\p", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp);
    context.emit(EventName.ProviderUpdated, loggedOut.toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("yes", SampleData.timestamp).toJson());
    approvals.resolve([SampleData.approval.toJson()]);
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(store.providers()[0]?.authStatus).toBe(AuthStatus.LoggedOut);
    expect(store.isWorking("c1")).toBe(false);
    expect(store.pendingApprovals()).toEqual([]);
  });

  it("applies events that arrive before the selected conversation's first page answers", async () => {
    await store.initialize();
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => delayed.promise);
    const selecting = store.selectConversation("c1");
    const later = new Message("m3", "c1", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "latest")).toJson());
    context.emit(EventName.MessageCreated, later.toJson());
    delayed.resolve(SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson());
    await selecting;
    expect(ids()).toEqual(["m1", "m2", "m3"]);
    expect(messages()[1]?.status).toBe(MessageStatus.Completed);
    expect(messages()[1]?.details.map(t => t.text)).toEqual(["latest"]);
    expect(store.runningReply()).toBeNull();
  });

  it("replays stream events over a page snapshot and over the send response", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => delayed.promise);
    store.deselectConversation();
    const loading = store.selectConversation("c1");
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    context.emit(EventName.DetailUpdated, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "latest")).toJson());
    delayed.resolve(SampleData.page([SampleData.reply], false, false).toJson());
    await loading;
    expect(messages()[0]?.status).toBe(MessageStatus.Completed);
    expect(messages()[0]?.details[0]?.text).toBe("latest");
    expect(store.runningReply()).toBeNull();

    context.answer(MethodName.MessageSend, () => {
      context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
      return new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson();
    });
    expect(await store.send("hi", settings)).toBe(true);
    expect(store.runningReply()).toBeNull();
    expect(messages().find(t => t.id === "m2")?.status).toBe(MessageStatus.Completed);
  });

  it("reads the rows the list shows and adds them to the message index", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.history()?.length()).toBe(5);
    expect(ids()).toEqual(["m3", "m4"]);

    expect((await store.history()?.readAsync(0, 3))?.map(t => t.id)).toEqual(["m0", "m1", "m2"]);

    expect(context.requests.at(-1)?.parameters).toEqual(new MessagePageParams("c1", 3, null, 3).toJson());
    expect(ids()).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(store.messageIndex().map(t => t.id)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });

  it("removes what a rewind from elsewhere took while the history was reading", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => delayed.promise);
    const reading = store.history()?.readAsync(1, 3);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 2).toJson());
    delayed.resolve(new MessagePage(numbered.slice(1, 3), true, true, 5).toJson());
    await reading;
    expect(ids()).toEqual(["m1"]);
    expect(store.history()?.length()).toBe(2);
    expect(store.messageIndex().map(t => t.id)).toEqual(["m1"]);
  });

  it("keeps each steered message for the reply it went into, from a page or an event, until a rewind from it or the chat's deletion", async () => {
    const steered = (id: string, sequence: number): Message => new Message(id, "c1", sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, `Steer ${id}`, { steeredInto: "r1" }, SampleData.timestamp)], null, SampleData.timestamp, null, SampleData.timestamp);
    const reply = new Message("r1", "c1", 1, MessageAuthor.Provider, "m0", MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Done.")],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    const asked = new Message("m0", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Go.")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.MessagePage, () => SampleData.page([asked, reply, steered("s2", 2)], false, false).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const steers = (): string[] => store.steersOf("r1").map(t => t.id);
    expect(steers()).toEqual(["s2"]);
    expect([store.steersOf("m0"), store.steersOf("s2")]).toEqual([[], []]);

    context.emit(EventName.MessageCreated, steered("s3", 3).toJson());
    context.emit(EventName.MessageUpdated, steered("s2", 2).toJson());
    expect(steers()).toEqual(["s2", "s3"]);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c2", 0).toJson());
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 3).toJson());
    expect(steers()).toEqual(["s2"]);
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    expect(steers()).toEqual([]);
  });

  it("leaves a message a rewind removed out of the message index when a new one took its row before the read answered", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => delayed.promise);
    const reading = store.history()?.readAsync(1, 3);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 2).toJson());
    const replacement = new Message("m2b", "c1", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp);
    context.emit(EventName.MessageCreated, replacement.toJson());
    delayed.resolve(new MessagePage(numbered.slice(1, 3), true, true, 5).toJson());
    expect((await reading)?.map(t => t.id)).toEqual(["m1", "m2b"]);
    expect(store.messageIndex().map(t => t.id)).toEqual(["m1"]);
  });

  it("keeps the message index when a rewind from elsewhere took every row the history was reading", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    await store.history()?.readAsync(0, 1);
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, () => delayed.promise);
    const reading = store.history()?.readAsync(1, 3);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 1).toJson());
    delayed.resolve(new MessagePage(numbered.slice(1, 3), true, true, 5).toJson());
    await reading;
    expect(store.messageIndex().map(t => t.id)).toEqual(["m0"]);
  });

  it("leaves a read that answers after its window closed out of the message index", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const history = store.history();
    const delayed = new DeferredResponse();
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c1"
      ? delayed.promise : SampleData.page([], false, false).toJson());
    const reading = history?.readAsync(1, 3);
    await store.selectConversation("c2");
    delayed.resolve(new MessagePage(numbered.slice(1, 3), true, true, 5).toJson());
    await reading;
    expect(store.selectedConversationId()).toBe("c2");
    expect(store.history()?.length()).toBe(0);

    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.selectConversation("c1");
    expect(store.messageIndex().map(t => t.id)).toEqual(["m3", "m4"]);
  });

  it("leaves a read that fails to the list, which offers it again, and records no error", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    context.fail(MethodName.MessagePage, "The runtime part is away.");

    await expect(store.history()?.readAsync(0, 3)).rejects.toThrow("The runtime part is away.");

    expect(context.noticeText()).toBeNull();
    expect(ids()).toEqual(["m3", "m4"]);
  });

  it("ignores a catalog that answers after the store is disposed", async () => {
    const projects = new DeferredResponse();
    context.answer(MethodName.ProjectList, () => projects.promise);
    const initializing = store.initialize();
    store.dispose();
    projects.resolve([SampleData.listed(SampleData.project)]);
    await initializing;
    expect(store.projects()).toEqual([]);
    expect(store.loaded()).toBe(false);
    context.emit(EventName.StateInvalidated, null);
    expect(context.count(MethodName.ProjectList)).toBe(1);
  });

  it("reads which projects' folders are missing from the list, follows each change Core finds, and keeps the mark of a folder opened while it's still missing", async () => {
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject, true)]);
    context.answer(MethodName.ProjectOpen, () => SampleData.project.toJson());
    await store.initialize();
    const marks = (): boolean[] => store.projects().map(t => store.isFolderMissing(t.id));

    expect(marks()).toEqual([false, true]);
    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange("p1", true).toJson());
    expect(marks()).toEqual([true, true]);
    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange("p1", false).toJson());
    expect(marks()).toEqual([false, true]);

    const projects = new DeferredResponse();
    context.answer(MethodName.ProjectList, () => projects.promise);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(2));
    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange("p1", true).toJson());
    projects.resolve([SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)]);
    await Wait.until(() => expect(marks()).toEqual([true, false]));

    await store.openProject("D:\\repo");
    expect(marks()).toEqual([true, false]);
    context.emit(EventName.ProjectFolderChanged, new ProjectFolderChange("p1", false).toJson());
    expect(marks()).toEqual([false, false]);
  });

  it("refreshes peer metadata and restores work and approvals outside the selected page", async () => {
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage], false, false).toJson());
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    context.answer(MethodName.ApprovalListPending, () => [SampleData.approval.toJson()]);
    context.answer(MethodName.ApprovalList, () => []);
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.runningReply()?.id).toBe("m2");
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1"]);
    const renamed = new Conversation("c1", "p1", "Renamed elsewhere", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [renamed.toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.selectedConversation()?.title).toBe("Renamed elsewhere"));
  });

  it("deselects a conversation and forgets its positions once the catalog no longer lists it", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    await store.selectConversation("c2");
    store.rememberPosition("c1", new ReadingPosition("m1", 0, 10));
    context.answer(MethodName.ConversationList, () => []);
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.otherProject)]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.selectedConversationId()).toBeNull());
    expect(store.selectedProjectId()).toBeNull();
    expect(store.selectedProject()).toBeNull();
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]);
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    await store.selectConversation("c1");
    expect(store.pendingPosition()).toBeNull();
  });

  it("keeps a remembered position across a catalog reload that still lists its conversation", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c2");
    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
    const catalogs = context.count(MethodName.ProjectList);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectList)).toBe(catalogs + 1));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    await store.selectConversation("c1");
    expect(store.pendingPosition()?.messageId).toBe("m1");
  });

  it("reads the newest page for a conversation left following its end, rather than the page around the message it was at", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c2");
    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40, true));

    await store.selectConversation("c1");

    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)).map(t => MessagePageParams.fromJson(t.parameters))
      .filter(t => t.conversationId === "c1")).toEqual([new MessagePageParams("c1", null, null, Resources.messagePageSize)]);
    expect(store.history()?.length()).toBe(5);
    expect(store.pendingPosition()).toBeNull();
  });

  describe("showing a chat's latest messages", () => {
    const arrived = new Message("m5", "c1", 5, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "t5")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    const newest = (): MessagePage => new MessagePage(numbered, false, false, numbered.length);
    const openAtFirst = async (): Promise<void> => {
      context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
      context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
      await store.initialize();
      store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
      await store.selectConversation("c1");
    };

    it("gives the chat a new history from its newest page in place of the page it opened at, with what came while it read, and drops the place it opened at", async () => {
      await openAtFirst();
      const opened = store.historyOf("c1");
      const page = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => page.promise);
      expect([ids(), store.pendingPosition()?.messageId, opened?.holdsNewest()]).toEqual([["m0", "m1", "m2", "m3"], "m1", false]);

      const showing = store.showLatest("c1");
      context.emit(EventName.MessageCreated, arrived.toJson());
      page.resolve(newest().toJson());

      expect(await showing).toBe(true);
      expect(store.historyOf("c1")).not.toBe(opened);
      expect([ids(), store.history()?.length(), store.history()?.holdsNewest(), store.pendingPosition()]).toEqual([["m0", "m1", "m2", "m3", "m4", "m5"], 6, true, null]);
      expect(MessagePageParams.fromJson(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)).at(-1)?.parameters))
        .toEqual(new MessagePageParams("c1", null, null, Resources.messagePageSize));
    });

    it("waits for a reload under way, as a resync's, before it reads the newest page, so the reload still reads the chat's approvals", async () => {
      context.answer(MethodName.ApprovalList, () => [SampleData.approval.toJson()]);
      await openAtFirst();
      expect(store.pendingApprovals().map(t => t.id)).toEqual([SampleData.approval.id]);
      const approvals = new DeferredResponse();
      context.answer(MethodName.ApprovalList, () => approvals.promise);
      const approvalsAsked = context.count(MethodName.ApprovalList);
      const resyncing = store.resync();
      await Wait.until(() => expect(context.count(MethodName.ApprovalList)).toBe(approvalsAsked + 1));
      const pagesAsked = context.count(MethodName.MessagePage);

      const showing = store.showLatest("c1");
      await Promise.resolve();
      expect(context.count(MethodName.MessagePage)).toBe(pagesAsked);
      approvals.resolve([SampleData.approval.withDecision("yes", SampleData.timestamp).toJson()]);

      await expect(resyncing).resolves.toBe(true);
      expect(await showing).toBe(true);
      expect(store.pendingApprovals()).toEqual([]);
      expect(MessagePageParams.fromJson(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)).at(-1)?.parameters))
        .toEqual(new MessagePageParams("c1", null, null, Resources.messagePageSize));
    });

    it("reads no newest page once a reload under way leaves the chat holding it", async () => {
      await openAtFirst();
      const pagesAsked = context.count(MethodName.MessagePage);
      const page = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => page.promise);
      const resyncing = store.resync();
      await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pagesAsked + 1));

      const showing = store.showLatest("c1");
      context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
      page.resolve(new MessagePage(numbered, false, false, numbered.length).toJson());

      await expect(resyncing).resolves.toBe(true);
      expect(await showing).toBe(false);
      expect(store.history()?.holdsNewest()).toBe(true);
    });

    it("reads no newest page for a chat left while a reload under way ran", async () => {
      await openAtFirst();
      const pagesAsked = context.count(MethodName.MessagePage);
      const page = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => page.promise);
      const resyncing = store.resync();
      await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(pagesAsked + 1));
      const asked = context.requests.length;

      const showing = store.showLatest("c1");
      context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
      await store.selectConversation("c2");
      page.resolve(newest().toJson());

      expect(await showing).toBe(false);
      await resyncing;
      expect(context.requests.slice(asked).filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage))
        .map(t => MessagePageParams.fromJson(t.parameters)).filter(t => t.conversationId === "c1" && Object.isNull(t.beforeSequence) && Object.isNull(t.afterSequence))).toEqual([]);
      expect(store.historyOf("c1")).toBeNull();
    });

    it("shows nothing and reads nothing for a chat it holds no window for, or whose window hasn't loaded", async () => {
      context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
      await store.initialize();
      const page = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => page.promise);
      const selecting = store.selectConversation("c1");
      await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(1));

      expect(await store.showLatest("c2")).toBe(false);
      expect(await store.showLatest("c1")).toBe(false);
      expect(context.count(MethodName.MessagePage)).toBe(1);
      page.resolve(newest().toJson());
      await selecting;
    });

    it("drops a newest page that came after a later call or after the chat's window went, keeping the history it had", async () => {
      await openAtFirst();
      const stale = new DeferredResponse();
      const fresh = new DeferredResponse();
      const pages = [stale, fresh];
      context.answer(MethodName.MessagePage, () => pages.shift()?.promise ?? Promise.resolve(newest().toJson()));

      const replaced = store.showLatest("c1");
      const latest = store.showLatest("c1");
      fresh.resolve(newest().toJson());
      expect(await latest).toBe(true);
      const shown = store.historyOf("c1");
      stale.resolve(new MessagePage(numbered.slice(0, 2), false, true, numbered.length).toJson());
      expect(await replaced).toBe(false);
      expect(store.historyOf("c1")).toBe(shown);

      const late = new DeferredResponse();
      context.answer(MethodName.MessagePage, () => late.promise);
      const leaving = store.showLatest("c1");
      context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
      await store.selectConversation("c2");
      late.resolve(newest().toJson());
      expect(await leaving).toBe(false);
      expect(store.historyOf("c1")).toBeNull();
    });

    it("posts a newest page that failed as a failed chat action and keeps the history it had", async () => {
      await openAtFirst();
      const opened = store.historyOf("c1");
      context.fail(MethodName.MessagePage, "The runtime stopped.");

      expect(await store.showLatest("c1")).toBe(false);
      expect(store.historyOf("c1")).toBe(opened);
      expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title, t.text]))
        .toEqual([[Resources.formatNoticeKey(ChatAction.ShowLatest, "c1"), Resources.chatActionTitles[ChatAction.ShowLatest], "The runtime stopped."]]);
    });
  });

  it("reads the working replies, approvals and selected messages again on a resync, and answers whether it worked", async () => {
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    context.emit(EventName.ReplyThinking, new MessageIdParams("m2").toJson());
    context.emit(EventName.ReplyCheckpointStarted, new MessageIdParams("m2").toJson());
    expect(store.pendingApprovals()).toHaveLength(1);
    context.answer(MethodName.MessageListOpen, () => []);
    context.answer(MethodName.ApprovalList, () => []);
    context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, SampleData.withStatus(SampleData.reply, MessageStatus.Completed)],
      false, false).toJson());

    const resyncs = store.resyncs();

    await expect(store.resync()).resolves.toBe(true);

    expect(store.resyncs()).toBe(resyncs + 1);
    expect(store.isWorking("c1")).toBe(false);
    expect([...store.thinkingReplies()]).toEqual([]);
    expect([...store.savingCheckpointReplies()]).toEqual([]);
    expect(store.pendingApprovals()).toEqual([]);
    expect(messages()[1]?.status).toBe(MessageStatus.Completed);
    context.fail(MethodName.ProviderList, "The runtime part is away.");
    await expect(store.resync()).resolves.toBe(false);
    expect(context.noticeText()).toContain("The runtime part is away.");
    expect(store.resyncs()).toBe(resyncs + 1);
  });

  it("marks a running reply as thinking until its next detail or its end, and ignores replies that are not running", async () => {
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    const thinking = (messageId: string): void => context.emit(EventName.ReplyThinking, new MessageIdParams(messageId).toJson());

    thinking("unknown");
    thinking("m2");
    expect([...store.thinkingReplies()]).toEqual(["m2"]);
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Reasoning, "Planning")).toJson());
    expect([...store.thinkingReplies()]).toEqual([]);
    thinking("m2");
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    expect([...store.thinkingReplies()]).toEqual([]);
    thinking("m2");
    expect([...store.thinkingReplies()]).toEqual([]);
  });

  it("marks a running reply as saving a checkpoint until the checkpoint ends, a detail comes, a resync or the reply ends, and ignores replies that are not running", async () => {
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    const emit = (name: EventName, messageId: string): void => context.emit(name, new MessageIdParams(messageId).toJson());
    const saving = (): string[] => [...store.savingCheckpointReplies()];
    const seen: string[][] = [];

    emit(EventName.ReplyCheckpointStarted, "unknown");
    emit(EventName.ReplyCheckpointStarted, "m2");
    seen.push(saving());
    emit(EventName.ReplyCheckpointEnded, "unknown");
    seen.push(saving());
    emit(EventName.ReplyCheckpointEnded, "m2");
    seen.push(saving());
    for (const name of [EventName.DetailAppended, EventName.DetailUpdated]) {
      emit(EventName.ReplyCheckpointStarted, "m2");
      context.emit(name, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "Hello")).toJson());
      seen.push(saving());
    }
    emit(EventName.ReplyCheckpointStarted, "m2");
    await expect(store.resync()).resolves.toBe(true);
    seen.push([String(store.isWorking("c1")), ...saving()]);
    emit(EventName.ReplyCheckpointStarted, "m2");
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson());
    seen.push(saving());
    emit(EventName.ReplyCheckpointStarted, "m2");
    seen.push(saving());

    expect(seen).toEqual([["m2"], ["m2"], [], [], [], ["true"], [], []]);
  });

  it("keeps a running reply saving its checkpoint through a catalog read that isn't a resync, and drops it once a read finds the reply ended", async () => {
    let open = [SampleData.reply];
    context.answer(MethodName.MessageListOpen, () => open.map(t => t.toJson()));
    await store.initialize();
    const saving = (): string[] => [...store.savingCheckpointReplies()];
    const read = async (): Promise<void> => {
      const reads = context.count(MethodName.PlanUsageList);
      context.emit(EventName.StateInvalidated, null);
      await Wait.until(() => expect(context.count(MethodName.PlanUsageList)).toBe(reads + 1));
    };
    context.emit(EventName.ReplyCheckpointStarted, new MessageIdParams("m2").toJson());

    await read();
    const kept = saving();
    open = [];
    await read();

    expect([kept, saving()]).toEqual([["m2"], []]);
  });

  it("keeps a checkpoint that starts while a first load or a resync reads, and applies the reply's latest checkpoint event after the read", async () => {
    let held: DeferredResponse | null = null;
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    context.answer(MethodName.ApprovalListPending, () => Object.isNull(held) ? [] : held.promise);
    const emit = (name: EventName): void => context.emit(name, new MessageIdParams("m2").toJson());
    const saving = (): string[] => [...store.savingCheckpointReplies()];
    const hold = async (read: () => Promise<unknown>, ...names: readonly EventName[]): Promise<string[]> => {
      held = new DeferredResponse();
      const asked = context.count(MethodName.ApprovalListPending);
      const reading = read();
      await Wait.until(() => expect(context.count(MethodName.ApprovalListPending)).toBe(asked + 1));
      for (const name of names)
        emit(name);
      held.resolve([]);
      await reading;
      held = null;
      return saving();
    };

    const loaded = await hold(() => store.initialize(), EventName.ReplyCheckpointStarted);
    const resynced = await hold(() => store.resync(), EventName.ReplyCheckpointStarted);
    const ended = await hold(() => store.resync(), EventName.ReplyCheckpointStarted, EventName.ReplyCheckpointEnded);

    expect([loaded, resynced, ended]).toEqual([["m2"], ["m2"], []]);
  });

  it("applies a reply's checkpoint after a read's other events, so an update that lands after the start keeps it and a detail after the start ends it", async () => {
    let held: DeferredResponse | null = null;
    let open: readonly Message[] = [];
    context.answer(MethodName.MessageListOpen, () => open.map(t => t.toJson()));
    context.answer(MethodName.ApprovalListPending, () => Object.isNull(held) ? [] : held.promise);
    const started = (): void => context.emit(EventName.ReplyCheckpointStarted, new MessageIdParams("m2").toJson());
    const hold = async (read: () => Promise<unknown>, during: () => void): Promise<string[]> => {
      held = new DeferredResponse();
      const asked = context.count(MethodName.ApprovalListPending);
      const reading = read();
      await Wait.until(() => expect(context.count(MethodName.ApprovalListPending)).toBe(asked + 1));
      during();
      held.resolve([]);
      await reading;
      held = null;
      return [...store.savingCheckpointReplies()];
    };

    const updated = await hold(() => store.initialize(), () => {
      context.emit(EventName.MessageCreated, SampleData.reply.toJson());
      started();
      context.emit(EventName.MessageUpdated, SampleData.reply.toJson());
    });
    open = [SampleData.reply];
    const detailed = await hold(() => store.resync(), () => {
      started();
      context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "Hello")).toJson());
    });

    expect([updated, detailed]).toEqual([["m2"], []]);
  });

  it("loads the catalog and selects a project without opening a conversation", async () => {
    context.answer(MethodName.ApprovalListPending, () => [SampleData.approval.toJson()]);
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    expect(store.loaded()).toBe(false);
    await store.initialize();
    expect(store.loaded()).toBe(true);

    expect(store.kinds().map(t => t.id)).toEqual(["codex", "claude"]);
    expect(store.providers().map(t => t.id)).toEqual(["a1"]);
    expect(store.selectedProject()?.id).toBe("p1");
    expect(store.selectedConversationId()).toBeNull();
    expect(messages()).toEqual([]);
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1"]);
    expect(store.runningReply()).toBeNull();
    expect(store.isWorking("c1")).toBe(true);
    expect(context.count(MethodName.MessagePage)).toBe(0);
    expect(store.isBusy()).toBe(false);
    expect(context.noticeText()).toBeNull();
  });

  it("refuses a list of shared MCP servers that isn't one", async () => {
    context.answer(MethodName.SharedMcpServerList, () => "garbled");

    await expect(store.listSharedMcpServers()).rejects.toThrow(Resources.formatListNotArray("string"));
    await expect(store.listSharedMcpServers()).rejects.toBeInstanceOf(ListNotArrayException);
    await expect(store.listSharedMcpServers()).rejects.toMatchObject({ kind: "string" });
  });

  it("refuses a listing that is not an array", async () => {
    context.answer(MethodName.ProjectList, () => ({ projects: [] }));
    await store.initialize();
    expect(context.noticeText()).not.toBeNull();
    expect(store.loaded()).toBe(false);
  });

  it("keeps the members and modes of the chat an opened project sets aside while the project's first chat is selected, and loads them again on a change", async () => {
    const third = new Conversation("c3", "p2", "Third", SampleData.timestamp, SampleData.timestamp);
    const member = (conversationId: string, teammateId: string, mode: string | null): ConversationMember =>
      new ConversationMember(conversationId, teammateId, "t", null, false, mode);
    const members = new Map<string, readonly ConversationMember[]>([["c1", [member("c1", "alice", "plan")]], ["c3", [member("c3", "bob", null)]]]);
    context.answer(MethodName.ConversationListMembers, t => (members.get(ConversationIdParams.fromJson(t).conversationId) ?? []).map(u => u.toJson()))
      .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p2" ? [third.toJson()] : [SampleData.conversation.toJson()])
      .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson())
      .answer(MethodName.ConversationSetMemberMode, () => null);
    const modes = (conversationId: string): string[] => store.membersOf(conversationId).map(t => `${t.teammateId}: ${t.mode ?? "none"}`);
    await store.initialize();
    await store.selectConversation("c1");
    await store.conversationInView("c1");

    await store.openProject(SampleData.otherProject.rootPath);
    await Wait.until(() => expect(store.selectedConversationId()).toBe("c3"));
    const opened = [modes("c1"), modes("c3")];
    members.set("c1", [member("c1", "alice", "auto")]);
    await store.setMemberMode("c1", "alice", "auto");
    const changed = [modes("c1"), modes("c3")];
    members.set("c1", [member("c1", "alice", null), member("c1", "bob", null)]);
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)]);
    context.emit(EventName.StateInvalidated, null);

    expect([store.shownConversationId(), store.markedConversationId()]).toEqual(["c1", null]);
    expect([opened, changed]).toEqual([[["alice: plan"], ["bob: none"]], [["alice: auto"], ["bob: none"]]]);
    await Wait.until(() => expect(modes("c1")).toEqual(["alice: none", "bob: none"]));
    expect(modes("c3")).toEqual(["bob: none"]);
  });

  it("opens, selects, and forgets projects", async () => {
    context.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    context.answer(MethodName.ProjectForget, () => null);
    await store.initialize();

    await store.openProject("D:\\other");
    expect(store.projects().map(t => t.id)).toEqual(["p1", "p2"]);
    expect(store.selectedProjectId()).toBe("p2");
    expect(context.parametersOf(MethodName.ProjectOpen)).toEqual({ rootPath: "D:\\other" });

    await store.selectProject("p1");
    expect(store.selectedConversationId()).toBe("c1");

    await store.forgetProject("p2");
    expect(store.selectedProjectId()).toBe("p1");
    await store.forgetProject("p1");
    expect(store.projects()).toEqual([]);
    expect(store.selectedProjectId()).toBeNull();
    expect(store.conversations()).toEqual([]);
    expect(messages()).toEqual([]);
    expect(context.count(MethodName.ProjectForget)).toBe(2);
  });

  it("selects the folder opened last when two Open folders overlap and Core answers them out of order, keeping the chat shown set aside", async () => {
    const repo = new DeferredResponse();
    const other = new DeferredResponse();
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(third)]);
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p3" ? [thirdChat.toJson()] : []);
    context.answer(MethodName.ProjectOpen, t => ProjectOpenParams.fromJson(t).rootPath === "D:\\repo" ? repo.promise : other.promise);
    await store.initialize();
    await store.conversationInView("c3");

    const first = store.openProject("D:\\repo");
    const last = store.openProject("D:\\other");
    await Wait.until(() => expect(context.count(MethodName.ProjectOpen)).toBe(2));
    other.resolve(SampleData.otherProject.toJson());
    await last;
    repo.resolve(SampleData.project.toJson());

    expect((await first)?.id).toBe("p1");
    expect(store.selectedProjectId()).toBe("p2");
    expect(store.selectedConversationId()).toBeNull();
    expect(store.screenConversationId()).toBe("c3");
  });

  it("leaves the project the person selects while an Open folder is pending selected when the open answers", async () => {
    const reply = new DeferredResponse();
    context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)]);
    context.answer(MethodName.ProjectOpen, () => reply.promise);
    await store.initialize();

    const opening = store.openProject("D:\\third");
    await Wait.until(() => expect(context.count(MethodName.ProjectOpen)).toBe(1));
    await store.selectProject("p2");
    reply.resolve(third.toJson());

    expect((await opening)?.id).toBe("p3");
    expect(store.projects().map(t => t.id)).toContain("p3");
    expect(store.selectedProjectId()).toBe("p2");
  });

  it("leaves the chat the person opens while an Open folder is pending selected when the open answers", async () => {
    const reply = new DeferredResponse();
    context.answer(MethodName.ProjectOpen, () => reply.promise);
    await store.initialize();
    store.deselectConversation();

    const opening = store.openProject("D:\\third");
    await Wait.until(() => expect(context.count(MethodName.ProjectOpen)).toBe(1));
    await store.selectConversation("c1");
    reply.resolve(third.toJson());

    expect((await opening)?.id).toBe("p3");
    expect(store.selectedProjectId()).toBe("p1");
    expect(store.selectedConversationId()).toBe("c1");
  });

  it("leaves the chat the person starts while an Open folder is pending selected when the open answers", async () => {
    const reply = new DeferredResponse();
    context.answer(MethodName.ProjectOpen, () => reply.promise);
    context.answer(MethodName.ConversationCreate, () => second.toJson());
    await store.initialize();

    const opening = store.openProject("D:\\third");
    await Wait.until(() => expect(context.count(MethodName.ProjectOpen)).toBe(1));
    expect((await store.createConversation("Second", "p1"))?.id).toBe("c2");
    reply.resolve(third.toJson());

    expect((await opening)?.id).toBe("p3");
    expect(store.selectedProjectId()).toBe("p1");
    expect(store.selectedConversationId()).toBe("c2");
  });

  it("selects the folder opened first when the Open folder after it fails", async () => {
    const other = new DeferredResponse();
    context.answer(MethodName.ProjectOpen, t => {
      if (ProjectOpenParams.fromJson(t).rootPath === "D:\\other")
        return other.promise;
      throw new Error("The folder can't be opened.");
    });
    await store.initialize();

    const first = store.openProject("D:\\other");
    expect(await store.openProject("D:\\repo")).toBeNull();
    other.resolve(SampleData.otherProject.toJson());

    expect((await first)?.id).toBe("p2");
    expect(store.selectedProjectId()).toBe("p2");
    expect(context.noticeText()).not.toBeNull();
  });

  it("creates, renames, moves and deletes conversations, closing a deleted conversation's tab", async () => {
    context.answer(MethodName.ConversationCreate, () => second.toJson());
    context.answer(MethodName.ConversationRename, t =>
      new Conversation("c2", "p1", ConversationRenameParams.fromJson(t).title, SampleData.timestamp, SampleData.timestamp).toJson());
    context.answer(MethodName.ConversationDelete, () => null);
    await store.initialize();

    expect((await store.createConversation("Second"))?.id).toBe("c2");
    expect(store.selectedConversationId()).toBe("c2");
    expect(store.conversations().map(t => t.id)).toEqual(["c1", "c2"]);

    await store.renameConversation("c2", "Renamed");
    expect(store.selectedConversation()?.title).toBe("Renamed");

    context.answer(MethodName.ConversationMove, () => new Conversation("c2", "p2", "Renamed", SampleData.timestamp, SampleData.timestamp).toJson());
    expect(await store.moveConversation("c2", "p2")).toBe(true);
    expect(store.conversationsOf("p1").map(t => t.id)).toEqual(["c1"]);
    expect(store.conversationsOf("p2").map(t => t.id)).toEqual(["c2"]);
    expect(store.conversation("c2")?.projectId).toBe("p2");
    expect(store.selectedProjectId()).toBe("p2");

    await store.deleteConversation("c1");
    expect(store.selectedConversationId()).toBe("c2");
    await store.deleteConversation("c2");
    expect(store.selectedProjectId()).toBe("p2");
    expect(store.conversationsOf("p2")).toEqual([]);
    expect(store.selectedConversationId()).toBeNull();
    expect(store.conversation("c2")).toBeNull();
    expect(context.forgottenDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c1" }, { name: Resources.conversationDocumentName, instance: "c2" }]);
  });

  it("keeps a conversation's tab open when its delete fails", async () => {
    context.fail(MethodName.ConversationDelete, "The conversation is busy.");
    await store.initialize();

    await store.deleteConversation("c1");

    expect(store.conversation("c1")?.id).toBe("c1");
    expect(context.forgottenDocuments).toEqual([]);
  });

  it("keeps a chat's linked folders until the chat is rewound, released or deleted, and asks again for a path that wasn't a folder", async () => {
    const path = "D:\\repo\\out";
    let isFolder = false;
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    context.answer(MethodName.LinkedFolderList, t => new LinkedPaths(LinkedPaths.fromJson(t).paths.filter(() => isFolder)).toJson());
    const reads = (): number => context.requests.filter(t => t.method === "teamrun.linkedFolderList").length;
    await store.initialize();
    const release = store.showConversation("c1");
    await Wait.until(() => expect(store.isHistoryLoaded("c1")).toBe(true));

    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([false, 1]);
    isFolder = true;
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([true, 2]);
    isFolder = false;
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([true, 2]);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 2).toJson());
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([false, 3]);
    isFolder = true;
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([true, 4]);
    isFolder = false;
    release();
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([false, 5]);
    isFolder = true;
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([true, 6]);
    isFolder = false;
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    expect([await store.isLinkedFolderAsync(SampleData.reply, path), reads()]).toEqual([false, 7]);
  });

  it("drops a chat another window or the CLI deleted, forgetting its tab and telling the deletion watchers", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const deleted: string[] = [];
    store.onConversationDeleted(t => deleted.push(t));

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());

    expect(store.conversation("c1")).toBeNull();
    expect(store.conversations()).toEqual([]);
    expect(store.selectedConversationId()).toBeNull();
    expect(context.forgottenDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c1" }]);
    expect(deleted).toEqual(["c1"]);
    expect(context.count(MethodName.ConversationDelete)).toBe(0);
  });

  it("asks Core about each chat a resync no longer lists, keeps one Core still has, and drops one it doesn't, telling the watchers before it forgets the tab", async () => {
    const kept = new Conversation("c2", "p1", "Created meanwhile", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), kept.toJson()]);
    gone("c1");
    await store.initialize();
    await store.selectConversation("c1");
    const deleted: string[] = [];
    const forgottenThen: number[] = [];
    store.onConversationDeleted(t => {
      deleted.push(t);
      forgottenThen.push(context.forgottenDocuments.length);
    });
    context.answer(MethodName.ConversationList, () => []);

    context.emit(EventName.StateInvalidated, null);

    await Wait.until(() => expect(context.forgottenDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c1" }]));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect([deleted, forgottenThen]).toEqual([["c1"], [0]]);
    expect(store.isDeleted("c1")).toBe(true);
    expect(store.selectedConversationId()).toBeNull();
    expect(store.conversation("c2")?.title).toBe("Created meanwhile");
    expect(store.isDeleted("c2")).toBe(false);
  });

  it("keeps a chat this window creates while a resync's list is under way, listed the whole time Core is asked about it", async () => {
    await store.initialize();
    const listing = new DeferredResponse();
    const lists = context.count(MethodName.ConversationList);
    const listed: boolean[] = [];
    context.answer(MethodName.ConversationList, () => listing.promise).answer(MethodName.ConversationCreate, () => second.toJson())
      .answer(MethodName.ConversationListMembers, () => {
        listed.push(!Object.isNull(store.conversation("c2")));
        return [];
      });
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ConversationList)).toBe(lists + 2));

    const creating = store.createConversation("Second");
    await Wait.until(() => expect(store.conversation("c2")).not.toBeNull());
    listing.resolve([SampleData.conversation.toJson()]);
    await creating;
    await Wait.until(() => expect(store.isBusy()).toBe(false));

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every(t => t)).toBe(true);
    expect(store.conversations().map(t => t.id)).toEqual(["c1", "c2"]);
    expect(store.isDeleted("c2")).toBe(false);
    expect(store.selectedConversationId()).toBe("c2");
  });

  it("keeps a chat a resync no longer lists when Core can't say whether it still has it, and shows why", async () => {
    await store.initialize();
    context.answer(MethodName.ConversationList, () => []).fail(MethodName.ConversationListMembers, "The runtime stopped.");

    context.emit(EventName.StateInvalidated, null);

    await Wait.until(() => expect(context.noticeText()).toBe("The runtime stopped."));
    expect(store.isDeleted("c1")).toBe(false);
    expect(context.forgottenDocuments).toEqual([]);
  });

  it("finishes a resync whose check of a chat it no longer lists fails, replaying a deletion made while it read, and shows why", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const listing = new DeferredResponse();
    const lists = context.count(MethodName.ConversationList);
    context.answer(MethodName.ConversationList, () => listing.promise).fail(MethodName.ConversationListMembers, "The runtime stopped.");
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ConversationList)).toBe(lists + 2));

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
    listing.resolve([second.toJson()]);

    await Wait.until(() => expect(context.noticeText()).toBe("The runtime stopped."));
    expect(store.conversation("c2")).toBeNull();
    expect(store.conversation("c1")?.id).toBe("c1");
    expect(store.isDeleted("c1")).toBe(false);
  });

  it("asks Core about a chat it doesn't list, and drops one Core no longer has", async () => {
    context.answer(MethodName.ConversationListMembers, t => {
      const conversationId = ConversationIdParams.fromJson(t).conversationId;
      if (conversationId === "gone")
        throw new RefusedError("Conversation gone was not found.", ErrorCode.NotFound, "gone");
      if (conversationId === "down")
        throw new Error("The runtime stopped.");
      return [];
    });
    await store.initialize();
    const deleted: string[] = [];
    store.onConversationDeleted(t => deleted.push(t));

    const answers = [await store.confirmConversation("c1"), await store.confirmConversation("elsewhere"), await store.confirmConversation("gone"),
      await store.confirmConversation("gone"), await store.confirmConversation("down")];

    expect(answers).toEqual([true, true, false, false, true]);
    expect(context.count(MethodName.ConversationListMembers)).toBe(3);
    expect(deleted).toEqual(["gone"]);
    expect(context.forgottenDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "gone" }]);
    expect(context.noticeText()).toBe("The runtime stopped.");
  });

  it("asks Core once about a chat it doesn't list while several ask at once, and again once that answer is in", async () => {
    context.answer(MethodName.ConversationListMembers, t => {
      if (ConversationIdParams.fromJson(t).conversationId === "gone")
        throw new RefusedError("Conversation gone was not found.", ErrorCode.NotFound, "gone");
      return [];
    });
    await store.initialize();
    const deleted: string[] = [];
    store.onConversationDeleted(t => deleted.push(t));

    const answers = await Promise.all([store.confirmConversation("gone"), store.confirmConversation("gone"), store.confirmConversation("elsewhere"),
      store.confirmConversation("elsewhere")]);
    const asked = context.count(MethodName.ConversationListMembers);
    const later = await store.confirmConversation("elsewhere");

    expect(answers).toEqual([false, false, true, true]);
    expect(asked).toBe(2);
    expect(deleted).toEqual(["gone"]);
    expect(later).toBe(true);
    expect(context.count(MethodName.ConversationListMembers)).toBe(3);
  });

  it("asks Core once about a chat several confirm at once when the question fails, keeps it for both, and asks again later", async () => {
    context.answer(MethodName.ConversationListMembers, () => {
      throw new Error("The runtime stopped.");
    });
    await store.initialize();

    const answers = await Promise.all([store.confirmConversation("down"), store.confirmConversation("down")]);
    const asked = context.count(MethodName.ConversationListMembers);
    const error = context.noticeText();
    await store.confirmConversation("down");

    expect(answers).toEqual([true, true]);
    expect(asked).toBe(1);
    expect(error).toBe("The runtime stopped.");
    expect(store.isDeleted("down")).toBe(false);
    expect(context.count(MethodName.ConversationListMembers)).toBe(2);
  });

  it("leaves a chat deleted since out of the chats and messages the search finds, and out of their totals, keeping whether Core capped the count", async () => {
    context.answer(MethodName.ChatFind, () => new ChatFindResult([new ChatFindHit("c1", "p1", "Chat", [], SampleData.timestamp),
      new ChatFindHit("c2", "p1", "Gone", [], SampleData.timestamp)], 5).toJson())
      .answer(MethodName.MessageSearch, () => new MessageSearchResult([new MessageSearchHit("c2", "p1", "Gone", "m1", 0, MessageAuthor.User, null, null, null, null, "the chat", SampleData.timestamp),
        new MessageSearchHit("c1", "p1", "Chat", "m2", 0, MessageAuthor.User, null, null, null, null, "a chat", SampleData.timestamp)], 9, true).toJson());
    await store.initialize();

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
    const chats = await store.findChats("chat");
    const messages = await store.searchMessages("chat");

    expect([chats.total, ...chats.hits.map(t => t.chatId), messages.total, messages.capped, ...messages.hits.map(t => t.messageId)]).toEqual([4, "c1", 8, true, "m2"]);
  });

  it("keeps a deletion that arrives while the catalog loads over the catalog's older list", async () => {
    await store.initialize();
    const listed = new DeferredResponse();
    context.answer(MethodName.ConversationList, () => listed.promise);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ConversationList)).toBe(4));

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    listed.resolve([SampleData.conversation.toJson()]);

    await Wait.until(() => expect(store.isBusy()).toBe(false));
    expect(store.conversation("c1")).toBeNull();
  });

  it("ignores a send without a conversation", async () => {
    expect(await store.send("hi", settings)).toBe(false);

    expect(context.requests).toEqual([]);
  });

  it("gives a chat without a project its own folder, a project's chat its project's folder and an unknown chat none, and counts a chat's files", async () => {
    const scratch = new Conversation("c5", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c5");
    context.answer(MethodName.ConversationList, t => [(Object.isNull(ConversationListParams.fromJson(t).projectId) ? scratch : SampleData.conversation).toJson()])
      .answer(MethodName.ConversationFolderCount, () => 4);
    await store.initialize();

    expect([store.folderOf("c5"), store.folderOf("c1"), store.folderOf("missing")]).toEqual(["/data/chats/c5", SampleData.project.rootPath, null]);
    expect(await store.countFolderFilesAsync("c5", ChatAction.DeleteChat)).toBe(4);
    expect(ConversationIdParams.fromJson(context.parametersOf(MethodName.ConversationFolderCount) ?? null).conversationId).toBe("c5");
  });

  it("starts a chat without a project and lists it apart from each project's chats, also after a resync", async () => {
    const scratch = new Conversation("c3", null, "Scratch", SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c3");
    let stored: readonly Conversation[] = [];
    context.answer(MethodName.ConversationCreate, () => {
      stored = [scratch];
      return scratch.toJson();
    }).answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? stored.map(u => u.toJson()) : [SampleData.conversation.toJson()])
      .answer(MethodName.ConversationListEmpty, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? [scratch.toJson()] : []);
    await store.initialize();
    const listed = context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationList)).map(t => ConversationListParams.fromJson(t.parameters).projectId);

    const created = await store.createConversation(null, null, "t1");
    const empty = await store.listEmptyConversations(null);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(context.count(MethodName.ConversationList)).toBe(4));
    await Wait.until(() => expect(store.isBusy()).toBe(false));

    expect(listed).toEqual(["p1", null]);
    expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate) ?? null)).toEqual(new ConversationCreateParams(null, null, "t1"));
    expect(created?.folder).toBe("/data/chats/c3");
    expect(empty).toEqual(["c3"]);
    expect(store.selectedProjectId()).toBeNull();
    expect(store.selectedConversationId()).toBe("c3");
    expect(store.conversationsOf(null).map(t => t.id)).toEqual(["c3"]);
    expect(store.conversationsOf("p1").map(t => t.id)).toEqual(["c1"]);
    expect(store.conversations().map(t => t.id)).toEqual(["c3"]);
  });

  it("leaves naming a new conversation to the core and shows the title it gives", async () => {
    const untitled = new Conversation("c1", "p1", "New chat", SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [untitled.toJson()]);
    context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson());
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    await store.initialize();
    await store.selectConversation("c1");

    expect(await store.send("Fix the login page", settings)).toBe(true);
    expect(context.count(MethodName.ConversationRename)).toBe(0);
    context.answer(MethodName.ConversationList, () => [untitled.withTitle("Fix the login page", SampleData.timestamp).toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.selectedConversation()?.title).toBe("Fix the login page"));
  });

  it("sends right after focus moves to another tab and leaves the shown page alone", async () => {
    const untitled = (id: string): Conversation => new Conversation(id, "p1", "New chat", SampleData.timestamp, SampleData.timestamp);
    const opening = new DeferredResponse();
    const message = (id: string, conversationId: string, sequence: number): Message =>
      new Message(id, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.ConversationList, () => [untitled("c1").toJson(), untitled("c2").toJson()]);
    context.answer(MethodName.MessagePage, t => MessagePageParams.fromJson(t).conversationId === "c1" ? opening.promise
      : SampleData.page([message("m8", "c2", 0)], false, true).toJson());
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    context.answer(MethodName.ConversationRename, t => {
      const params = ConversationRenameParams.fromJson(t);
      return new Conversation(params.conversationId, "p1", params.title, SampleData.timestamp, SampleData.timestamp).toJson();
    });
    await store.initialize();
    await store.selectConversation("c2");
    const pages = context.count(MethodName.MessagePage);

    const focusing = store.selectConversation("c1");
    expect(await store.send("Hello", settings, "c1")).toBe(true);
    expect(store.selectedConversationId()).toBe("c2");
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);
    expect(store.conversation("c2")?.title).toBe("New chat");
    opening.resolve(SampleData.page([SampleData.userMessage], false, false).toJson());
    await focusing;
    expect(store.selectedConversationId()).toBe("c1");

    context.answer(MethodName.ConversationList, () => [untitled("c1").toJson(), untitled("c2").toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.conversation("c1")?.title).toBe("New chat"));
    context.answer(MethodName.MessageSend, () => new MessageSendResult(message("m3", "c1", 2), []).toJson());
    expect(await store.send("Again", settings, "c1")).toBe(true);
    expect(context.count(MethodName.ConversationRename)).toBe(0);

    await store.selectConversation("c2");
    context.answer(MethodName.MessageSend, () => new MessageSendResult(message("m9", "c2", 1), []).toJson());
    const shown = context.count(MethodName.MessagePage);
    expect(await store.send("There", settings, "c2")).toBe(true);
    expect(context.count(MethodName.MessagePage)).toBe(shown);
    expect(ids()).toEqual(["m8", "m9"]);
  });

  it("knows which conversations have a reply running", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.isWorking("c1")).toBe(true);
    expect(store.isWorking("c2")).toBe(false);

    const elsewhere = new Message("m9", "c2", 1, MessageAuthor.Provider, "m8", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    context.emit(EventName.MessageCreated, elsewhere.toJson());
    expect(store.isWorking("c2")).toBe(true);
    context.emit(EventName.MessageUpdated, elsewhere.withStatus(MessageStatus.Completed, SampleData.timestamp).toJson());
    expect(store.isWorking("c2")).toBe(false);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    expect(store.isWorking("c1")).toBe(false);
  });

  it("leaves a project or conversation already shown alone and points at a message", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const pages = context.count(MethodName.MessagePage);

    await store.selectConversation("c1");
    await store.selectProject("p1");
    await store.selectConversation("missing");
    expect(context.count(MethodName.MessagePage)).toBe(pages);
    expect(store.selectedConversationId()).toBe("c1");

    const focus = new MessageFocus("c1", "m2", 1);
    store.focusMessage(focus);
    expect(store.focus()).toBe(focus);
    store.focusMessage(null);
    expect(store.focus()).toBeNull();
  });

  it("steps through the most recently updated conversations", async () => {
    const newer = new Conversation("c2", "p1", "Second", SampleData.timestamp, "2026-09-11T08:00:00.000Z");
    context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p1"
      ? [SampleData.conversation.toJson(), newer.toJson()] : []);
    await store.initialize();
    expect(store.recentConversations().map(t => t.id)).toEqual(["c2", "c1"]);
    expect(store.newestConversationsOf("p1").map(t => t.id)).toEqual(["c2", "c1"]);
    expect(store.newestConversationsOf(null)).toEqual([]);
    expect(store.newestConversationsOf("p9")).toEqual([]);

    await store.stepConversation(1);
    expect(store.selectedConversationId()).toBe("c2");
    await store.stepConversation(1);
    expect(store.selectedConversationId()).toBe("c1");
    await store.stepConversation(1);
    expect(store.selectedConversationId()).toBe("c1");
    await store.stepConversation(-5);
    expect(store.selectedConversationId()).toBe("c2");
  });

  it("rewinds the selected conversation, with the approvals of removed messages it doesn't hold, and applies rewinds from elsewhere", async () => {
    const marked = new Conversation("c1", "p1", "Chat", SampleData.timestamp, SampleData.timestamp, true);
    context.answer(MethodName.ConversationRewind, t =>
      new ConversationRewindResult(marked, [ConversationRewindParams.fromJson(t).messageId, "m2"], 2).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    expect(ids()).toEqual(["m1", "m2"]);

    const result = await store.rewind(SampleData.userMessage, true);
    expect(store.messageIndex()).toHaveLength(0);
    expect(result?.restoredFiles).toBe(2);
    expect(messages()).toEqual([]);
    expect(store.pendingApprovals()).toEqual([]);
    expect(store.selectedConversation()?.sessionReset).toBe(true);
    expect(context.parametersOf(MethodName.ConversationRewind)).toEqual({ chatId: "c1", messageId: "m1", restoreFiles: true });

    context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson());
    context.answer(MethodName.ApprovalList, () => []);
    store.deselectConversation();
    await store.selectConversation("c1");
    expect(messages()).toHaveLength(0);
    context.emit(EventName.MessageCreated, SampleData.userMessage.toJson());
    context.emit(EventName.MessageCreated, SampleData.reply.toJson());
    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    expect(messages()).toHaveLength(2);
    expect(await store.rewind(new Message("unknown", "c1", 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp), false)).not.toBeNull();
    expect(ids()).toEqual(["m1"]);
    expect(store.pendingApprovals()).toEqual([]);
    context.emit(EventName.MessageCreated, SampleData.userMessage.toJson());
    context.emit(EventName.MessageCreated, SampleData.reply.toJson());
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("other", 0).toJson());
    expect(messages()).toHaveLength(2);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 1).toJson());
    expect(ids()).toEqual(["m1"]);
    expect(store.pendingApprovals()).toEqual([]);

    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    expect(store.pendingApprovals()).toHaveLength(1);
    await store.rewind(SampleData.userMessage, false);
    expect(ids()).toEqual([]);
    expect(store.pendingApprovals()).toEqual([]);
  });

  it("empties the shown rows of a chat whose index was forgotten once a rewind from elsewhere comes", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const shown = store.messageIndex().map(t => t.id);
    store.forgetPosition("c1");
    const forgotten = store.messageIndex().map(t => t.id);

    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 0).toJson());

    expect([shown, forgotten, store.messageIndex()]).toEqual([["m1", "m2"], ["m1", "m2"], []]);
  });

  it("offers the person's rewound message back, its text and files, once asked to after a rewind, and nothing for a failure, a reply or a rewind from elsewhere", async () => {
    const file = new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/c1/notes.txt");
    const asked = new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, "first"), SampleData.detail(1, DetailKind.Note, "aside"), SampleData.detail(2, DetailKind.Text, "second")], null,
      SampleData.timestamp, null, SampleData.timestamp, [file]);
    context.answer(MethodName.MessagePage, () => SampleData.page([asked, SampleData.reply], false, false).toJson());
    context.fail(MethodName.ConversationRewind, "A reply in this conversation is in progress.");
    await store.initialize();
    await store.selectConversation("c1");

    expect(await store.rewind(asked, false)).toBeNull();
    expect(store.rewoundDraft()).toBeNull();

    const rewound: string[] = [];
    context.answer(MethodName.ConversationRewind, t => {
      const params = ConversationRewindParams.fromJson(t);
      rewound.push(params.conversationId);
      return new ConversationRewindResult(SampleData.conversation, [params.messageId], null).toJson();
    });
    await store.rewind(SampleData.reply, false);
    store.offerRewoundDraft(SampleData.reply);
    expect(store.rewoundDraft()).toBeNull();

    await store.rewind(asked, false);
    const offered = store.rewoundDraft();
    store.offerRewoundDraft(asked);
    const offer = store.rewoundDraft();
    expect([offered, offer?.conversationId, offer?.text, offer?.attachments]).toEqual([null, "c1", "first\n\nsecond", [file]]);

    store.clearRewoundDraft();
    context.emit(EventName.MessageCreated, asked.toJson());
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 0).toJson());
    expect(store.rewoundDraft()).toBeNull();

    const other = new Message("m9", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "there")], null,
      SampleData.timestamp, null, SampleData.timestamp);
    await store.rewind(other, false);
    store.offerRewoundDraft(other);
    expect([store.rewoundDraft()?.conversationId, store.rewoundDraft()?.text]).toEqual(["c2", "there"]);
    expect(rewound.at(-1)).toBe("c2");
  });

  it("asks nothing to stop a reply while its chat's stop is under way, and tells that the reply is being stopped", async () => {
    const stop = new DeferredResponse();
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()])
      .answer(MethodName.ConversationCancel, () => stop.promise);
    await store.initialize();

    const stopping = store.stop("c1");
    const cancelling = store.isCancelling(SampleData.reply.id);
    const cancelled = await store.cancel(SampleData.reply.id);
    stop.resolve([SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson()]);
    await stopping;

    expect([cancelling, cancelled, store.isCancelling(SampleData.reply.id)]).toEqual([true, false, false]);
    expect(context.count(MethodName.MessageCancel)).toBe(0);
  });

  it("asks once to stop a reply whose stop is under way, tells which stop is, and asks again once it ends", async () => {
    const cancel = new DeferredResponse();
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()])
      .answer(MethodName.MessageCancel, () => cancel.promise);
    await store.initialize();

    const first = store.cancel(SampleData.reply.id);
    const cancelling = store.isCancelling(SampleData.reply.id);
    const second = await store.cancel(SampleData.reply.id);
    cancel.resolve(SampleData.reply.toJson());
    const stopped = await first;

    expect([cancelling, second, stopped, store.isCancelling(SampleData.reply.id)]).toEqual([true, false, true, false]);
    expect(context.count(MethodName.MessageCancel)).toBe(1);
    context.answer(MethodName.MessageCancel, () => SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson());
    expect(await store.cancel(SampleData.reply.id)).toBe(true);
    expect(context.count(MethodName.MessageCancel)).toBe(2);
  });

  it("asks once to stop a chat whose stop is under way, takes every reply it answers with, and asks again once it ends", async () => {
    const stop = new DeferredResponse();
    const queued = new Message("m3", "c1", 2, MessageAuthor.Provider, "m1", MessageStatus.Pending, [], SampleData.provenance, SampleData.timestamp, null, null);
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson(), queued.toJson()])
      .answer(MethodName.ConversationCancel, () => stop.promise);
    await store.initialize();

    const first = store.stop("c1");
    const stopping = store.isStopping("c1");
    const second = await store.stop("c1");
    stop.resolve([SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson(), SampleData.withStatus(queued, MessageStatus.Cancelled).toJson()]);
    const stopped = await first;

    expect([stopping, second, stopped, store.isStopping("c1")]).toEqual([true, false, true, false]);
    expect(context.count(MethodName.ConversationCancel)).toBe(1);
    expect(context.parametersOf(MethodName.ConversationCancel)).toEqual({ chatId: "c1" });
    expect(store.runningReplyOf("c1")).toBeNull();
    context.answer(MethodName.ConversationCancel, () => []);
    expect(await store.stop("c1")).toBe(true);
    expect(context.count(MethodName.ConversationCancel)).toBe(2);
  });

  it("sends, cancels, and decides", async () => {
    context.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson());
    context.answer(MethodName.MessageCancel, () => SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson());
    context.answer(MethodName.ApprovalDecide, () => new Approval("ap1", "m2", SampleData.approval.kind, "exec", "run tests", null, SampleData.approval.options,
      ApprovalStatus.Approved, "yes", SampleData.timestamp, SampleData.timestamp).toJson());
    context.answer(MethodName.MessagePage, () => SampleData.page([], false, false).toJson());
    context.answer(MethodName.ApprovalList, () => []);
    await store.initialize();
    await store.selectConversation("c1");

    await store.send("hello", new ComposerSettings("codex", "gpt-5", "high", "a1"));
    expect(ids()).toEqual(["m1", "m2"]);
    expect(store.runningReply()?.id).toBe("m2");
    expect(context.parametersOf(MethodName.MessageSend)).toMatchObject({ requested: { model: "gpt-5" }, providerId: "a1" });

    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    expect(store.pendingApprovals()).toHaveLength(1);
    expect(await store.decide("ap1", "yes")).toBe(true);
    expect(store.pendingApprovals()).toHaveLength(0);
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Approved]);
    expect(context.parametersOf(MethodName.ApprovalDecide)).toEqual({ approvalId: "ap1", optionId: "yes" });

    await store.cancel("m2");
    expect(store.runningReply()).toBeNull();
    expect(messages()[1]?.status).toBe(MessageStatus.Cancelled);
  });

  it("says a conversation waits for an approval only while one of its replies awaits one", async () => {
    const waiting = SampleData.withStatus(SampleData.reply, MessageStatus.AwaitingApproval);
    context.answer(MethodName.MessageListOpen, () => [waiting.toJson()]);
    await store.initialize();

    expect([store.isAwaitingApproval("c1"), store.isWorking("c1"), store.isAwaitingApproval("c2")]).toEqual([true, true, false]);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(waiting, MessageStatus.Running).toJson());
    expect([store.isAwaitingApproval("c1"), store.isWorking("c1")]).toEqual([false, true]);
    context.emit(EventName.MessageUpdated, SampleData.withStatus(waiting, MessageStatus.Completed).toJson());
    expect([store.isAwaitingApproval("c1"), store.isWorking("c1")]).toEqual([false, false]);
  });

  it("says a conversation waits for an answer, then an approval, while a reply that ended still asks in it", async () => {
    context.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    const questions = [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false)];
    const asking = new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", { subAgent: "Explore" }, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null, questions);

    context.emit(EventName.ApprovalCreated, asking.toJson());
    const answer = [store.isWorking("c1"), store.isAwaitingApproval("c1"), store.isAwaitingAnswer("c1")];
    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    const approval = [store.isAwaitingApproval("c1"), store.isAwaitingAnswer("c1")];
    for (const decided of [asking, SampleData.approval])
      context.emit(EventName.ApprovalUpdated, decided.withCancellation(SampleData.timestamp).toJson());

    expect(answer).toEqual([false, true, true]);
    expect(approval).toEqual([true, false]);
    expect([store.isAwaitingApproval("c1"), store.isAwaitingAnswer("c1"), store.pendingApprovals().length]).toEqual([false, false, 0]);
  });

  it("lets a reply summary's failure other than the runtime's or the answer's propagate", async () => {
    const failures = unhandled();
    const broken = new Error("broken");
    context.answer(MethodName.ApprovalListPending, () => [new Approval("ap1", "m1", ApprovalKind.Command, "Bash", "Run", null, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson()])
      .answer(MethodName.MessageSummary, () => {
        throw broken;
      });
    await store.initialize();

    await Wait.until(() => expect(failures).toEqual([broken]));
  });

  it("marks the chat of a reply it never saw running, as after a reload, from that reply's summary, asked once per reply, and none for a reply gone or a failed summary", async () => {
    const card = (id: string, messageId: string): Approval => new Approval(id, messageId, ApprovalKind.Command, "Bash", "Run", null, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null);
    const ended = (id: string, conversationId: string): Message => new Message(id, conversationId, 0, MessageAuthor.Provider, null, MessageStatus.Completed, [],
      SampleData.reply.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
    context.answer(MethodName.ApprovalListPending, () => [card("ap9", "m9").toJson(), card("ap8", "gone").toJson(), card("ap7", "broken").toJson()])
      .answer(MethodName.MessageSummary, t => {
        const messageId = MessageIdParams.fromJson(t).messageId;
        if (messageId === "broken")
          throw new RuntimeRequestException(FailureCode.Internal, "Summary failed");
        return messageId === "gone" ? null : ReplySummary.fromMessage(ended(messageId, messageId === "m9" ? "c2" : "c3")).toJson();
      });
    await store.initialize();

    await Wait.until(() => expect(store.isAwaitingApproval("c2")).toBe(true));
    context.emit(EventName.ApprovalCreated, card("ap6", "m8").toJson());
    context.emit(EventName.ApprovalCreated, card("ap5", "m8").toJson());
    await Wait.until(() => expect(store.isAwaitingApproval("c3")).toBe(true));
    context.emit(EventName.ApprovalCreated, card("ap4", "m9").toJson());
    const asked = context.count(MethodName.MessageSummary);
    context.emit(EventName.ApprovalCreated, card("ap3", "broken").toJson());
    await Wait.until(() => expect(context.count(MethodName.MessageSummary)).toBe(5));

    expect(asked).toBe(4);
    expect([store.isAwaitingApproval("c1"), store.isAwaitingAnswer("c2"), store.pendingApprovals().length]).toEqual([false, false, 7]);
    context.emit(EventName.ApprovalUpdated, card("ap9", "m9").withCancellation(SampleData.timestamp).toJson());
    expect(store.isAwaitingApproval("c2")).toBe(true);
    context.emit(EventName.ApprovalUpdated, card("ap4", "m9").withCancellation(SampleData.timestamp).toJson());
    expect(store.isAwaitingApproval("c2")).toBe(false);
  });

  it("keeps a reply's decided approvals over older pending copies and across a reload", async () => {
    const later = new Approval("ap2", "m2", ApprovalKind.Tool, "tool", "read a file", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null);
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Pending]);
    expect(store.approvalsOf("m1")).toEqual([]);

    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", SampleData.timestamp).toJson());
    context.emit(EventName.ApprovalCreated, SampleData.approval.toJson());
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Denied]);
    expect(store.pendingApprovals()).toEqual([]);
    expect(store.pendingApprovalsOf("m2")).toEqual([]);

    context.answer(MethodName.ApprovalListPending, () => [SampleData.approval.toJson(), later.toJson()]);
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.approvalsOf("m2").map(t => [t.id, t.status])).toEqual([["ap1", ApprovalStatus.Denied], ["ap2", ApprovalStatus.Pending]]));
    expect(store.pendingApprovalsOf("m2").map(t => t.id)).toEqual(["ap2"]);

    context.fail(MethodName.ApprovalDecide, "Approval failed");
    expect(await store.decide("ap2", "yes")).toBe(false);
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Denied, ApprovalStatus.Pending]);
  });

  it("lists a reply's approvals in the order they were asked, whichever listing brought them first", async () => {
    const later = new Approval("ap2", "m2", ApprovalKind.Tool, "tool", "read a file", null, SampleData.approval.options, ApprovalStatus.Pending, null,
      SampleData.timestamp, null);
    context.answer(MethodName.ApprovalListPending, () => [later.toJson()]);
    context.answer(MethodName.ApprovalList, () => [SampleData.approval.withDecision("yes", SampleData.timestamp).toJson(), later.toJson()]);
    await store.initialize();
    expect(store.approvalsOf("m2").map(t => t.id)).toEqual(["ap2"]);

    await store.selectConversation("c1");

    expect(store.approvalsOf("m2").map(t => [t.id, t.status])).toEqual([["ap1", ApprovalStatus.Approved], ["ap2", ApprovalStatus.Pending]]);
  });

  it("counts a person's decision that another window's beat as settled, with no error", async () => {
    context.refuse(MethodName.ApprovalDecide, ErrorCode.Conflict, "Approval ap1 is not pending.", "ap1");
    await store.initialize();
    await store.selectConversation("c1");

    expect(await store.decide("ap1", "yes")).toBe(true);

    expect(context.noticeText()).toBeNull();
    expect(store.answerOf("ap1")).toBeNull();
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Pending]);
    context.emit(EventName.ApprovalUpdated, SampleData.approval.withDecision("no", SampleData.timestamp).toJson());
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Denied]);
  });

  it("withdraws an approval at once when its reply is no longer open to decide it, with no error, and keeps it withdrawn", async () => {
    context.refuse(MethodName.ApprovalDecide, ErrorCode.Conflict, "Message m2 is not open.", "m2");
    await store.initialize();
    await store.selectConversation("c1");

    expect(await store.decide("ap1", "yes")).toBe(true);

    expect(context.noticeText()).toBeNull();
    expect(store.answerOf("ap1")).toBeNull();
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Cancelled]);
    expect(store.pendingApprovals()).toEqual([]);
    context.emit(EventName.ApprovalUpdated, SampleData.approval.toJson());
    expect(store.approvalsOf("m2").map(t => t.status)).toEqual([ApprovalStatus.Cancelled]);
  });

  it("keeps the card of a person's decision refused with a Conflict that names nothing, with no error", async () => {
    context.answer(MethodName.ApprovalDecide, () => {
      throw new CodedError("Message m2 is not open.", ErrorCode.Conflict);
    });
    await store.initialize();
    await store.selectConversation("c1");

    expect(await store.decide("ap1", "yes")).toBe(true);

    expect(context.noticeText()).toBeNull();
    expect(store.answerOf("ap1")).toBeNull();
    expect(store.pendingApprovalsOf("m2").map(t => t.id)).toEqual(["ap1"]);
  });

  it("keeps message windows scoped and tracks approvals across conversations", async () => {
    await store.initialize();
    await store.selectConversation("c1");

    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    context.emit(EventName.MessageCreated, SampleData.withStatus(SampleData.reply, MessageStatus.Failed).toJson());
    context.emit(EventName.MessageCreated, new Message("m9", "c9", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "done")).toJson());
    context.emit(EventName.DetailUpdated, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "done!")).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(2, DetailKind.Text, "later")).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(1, DetailKind.Text, "between")).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("missing", SampleData.detail(0, DetailKind.Text, "lost")).toJson());
    context.emit(EventName.ApprovalUpdated, new Approval("ap9", "missing", SampleData.approval.kind, "exec", "s", null, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson());
    context.emit(EventName.ProviderUpdated, new Provider("a1", "codex", "Work", "D:\\p", AuthStatus.LoggedOut, null, null, null, null,
      SampleData.timestamp).toJson());

    expect(ids()).toEqual(["m1", "m2"]);
    expect(messages()[1]?.status).toBe(MessageStatus.Failed);
    expect(messages()[1]?.details.map(t => t.text)).toEqual(["done!", "between", "later"]);
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1", "ap9"]);
    expect(store.providers()[0]?.authStatus).toBe(AuthStatus.LoggedOut);
    expect(store.isTeammateUnavailable("anyone")).toBe(true);
    expect(store.runningReply()).toBeNull();
  });

  it("asks the runtime to sign in a provider it hasn't listed yet, without asking for its terminal command", async () => {
    context.answer(MethodName.ProviderSignIn, () => new Provider("new", "codex", "New", "D:\\p", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson());
    await store.initialize();

    await store.signInProvider("new");

    expect(context.count(MethodName.ProviderSignInCommand)).toBe(0);
    expect(context.count(MethodName.ProviderSignIn)).toBe(1);
  });

  it("titles a failed action on a provider with its label, so two of one kind differ, an add with the label given it, an install with its kind's name, and one it doesn't list with the action's own title", async () => {
    context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()])
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson(),
        new Provider("a2", "codex", "Personal", "D:\\profiles\\personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson()])
      .answer(MethodName.ProviderSignInCommand, () => null)
      .fail(MethodName.ProviderSignIn, "Refused.").fail(MethodName.ProviderSignOut, "Refused.").fail(MethodName.ProviderCheck, "Refused.")
      .fail(MethodName.ProviderCreate, "Refused.").fail(MethodName.ProviderKindInstall, "Refused.");
    await store.initialize();

    await store.signInProvider("a1");
    await store.signInProvider("a2");
    await store.signOutProvider("a2");
    await store.checkProvider("a1");
    await store.addProvider("codex", "Second", null);
    await store.installKind("codex");
    await store.installKind("missing");
    await store.signInProvider("gone");

    expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title])).toEqual([
      [Resources.formatNoticeKey(ChatAction.SignIn, "a1"), "Couldn't sign in to Work"],
      [Resources.formatNoticeKey(ChatAction.SignIn, "a2"), "Couldn't sign in to Personal"],
      [Resources.formatNoticeKey(ChatAction.SignOut, "a2"), "Couldn't sign out of Personal"],
      [Resources.formatNoticeKey(ChatAction.CheckProvider, "a1"), "Couldn't check Work's sign-in"],
      [Resources.formatNoticeKey(ChatAction.AddProvider, "codex"), "Couldn't add Second"],
      [Resources.formatNoticeKey(ChatAction.InstallKind, "codex"), "Couldn't install Codex"],
      [Resources.formatNoticeKey(ChatAction.InstallKind, "missing"), Resources.chatActionTitles[ChatAction.InstallKind]],
      [Resources.formatNoticeKey(ChatAction.SignIn, "gone"), Resources.chatActionTitles[ChatAction.SignIn]]
    ]);
  });

  it("shows the sign-ins running when it loads and as they change, whichever window started them, and starts none over one", async () => {
    context.answer(MethodName.ProviderSignInList, () => new ProviderSignIns(["a1"]).toJson());
    await store.initialize();

    expect([...store.signingIn()]).toEqual(["a1"]);
    await store.signInProvider("a1");
    expect(context.count(MethodName.ProviderSignIn)).toBe(0);
    context.emit(EventName.ProviderSignInsChanged, new ProviderSignIns(["a2"]).toJson());
    expect([...store.signingIn()]).toEqual(["a2"]);
    context.emit(EventName.ProviderSignInsChanged, new ProviderSignIns([]).toJson());
    expect(store.signingIn().size).toBe(0);
  });

  it("keeps a sign-in change that arrives while it reads the running sign-ins, and shows an unreadable list in the error line", async () => {
    const listed = new DeferredResponse();
    context.answer(MethodName.ProviderSignInList, () => listed.promise);
    const loading = store.initialize();
    await Wait.until(() => expect(context.count(MethodName.ProviderSignInList)).toBe(1));

    context.emit(EventName.ProviderSignInsChanged, new ProviderSignIns([]).toJson());
    listed.resolve(new ProviderSignIns(["a1"]).toJson());
    await loading;

    expect(store.signingIn().size).toBe(0);
    context.answer(MethodName.ProviderSignInList, () => ({ providerIds: [7] }));
    expect(await store.resync()).toBe(false);
    expect(context.noticeText()).not.toBeNull();
  });

  it("finds the provider added in a kind's usual folder, in any case on Windows and without its end's separator", async () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", null, "C:\\Users\\Person\\.claude"));
    const provider = (id: string, kind: string, profileDir: string): Provider =>
      new Provider(id, kind, "Work", profileDir, AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);
    context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), claude.toJson(), new ProviderKind("grok", "Grok CLI", true).toJson()]);
    context.answer(MethodName.ProviderList, () => [provider("c0", "codex", "C:\\Users\\Person\\.claude"), provider("c1", "claude", "C:\\Users\\Person\\.claude-work"),
      provider("c2", "claude", "c:\\users\\person\\.claude\\"), provider("c3", "claude", "C:\\Users\\Person\\.claude"), provider("g1", "grok", "D:\\grok")]
      .map(t => t.toJson()));
    await store.initialize();

    expect(["claude", "codex", "grok", "gone", null].map(t => store.usualProviderOf(t))).toEqual(["c2", null, null, null, null]);
  });

  it("signs a provider in once at a time, and offers sign-in only for a provider that can start one", async () => {
    const signIn = new DeferredResponse();
    context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), new ProviderKind("grok", "Grok CLI", true, true).toJson()]);
    context.answer(MethodName.ProviderSignIn, () => signIn.promise);
    await store.initialize();
    const grok = new Provider("a2", "grok", "Home", "D:\\h", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp);

    const first = store.signInProvider("a1");
    const second = store.signInProvider("a1");
    await second;

    expect(store.signingIn().has("a1")).toBe(true);
    await Wait.until(() => expect(context.count(MethodName.ProviderSignIn)).toBe(1));
    signIn.resolve(SampleData.provider.toJson());
    await first;
    expect(store.signingIn().size).toBe(0);
    expect([store.canSignIn(SampleData.provider), store.canSignIn(grok)]).toEqual([false, true]);
    expect(store.canSignIn(new Provider("a3", "other", "Other", "D:\\o", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp))).toBe(false);
  });

  it("offers sign-out only for an enabled, signed-in provider that TeamRun signs out or opens the tool's own session for, and names the command only there", async () => {
    context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), new ProviderKind("grok", "Grok CLI", true, true, null, null, true).toJson(),
      new ProviderKind("copilot", "GitHub Copilot", true, false, null, new ProviderProfile("COPILOT_HOME", "copilot login", null, "copilot"), false,
        "/logout").toJson(),
      new ProviderKind("antigravity", "Antigravity", true, true, null, new ProviderProfile("GEMINI_HOME"), false, "/logout").toJson(),
      new ProviderKind("bare", "Bare", true, false, null, null, false, "/logout").toJson()]);
    await store.initialize();
    const of = (id: string, kind: string, status: AuthStatus = AuthStatus.LoggedIn): Provider =>
      new Provider(id, kind, id, `D:\\${id}`, status, null, null, null, null, SampleData.timestamp);
    const listed = [SampleData.provider, of("g1", "grok"), of("g2", "grok", AuthStatus.LoggedOut), of("g3", "grok").withEnabled(false), of("c1", "copilot"), of("o1", "other"),
      of("n1", "antigravity"), of("b1", "bare")];

    expect(listed.map(t => store.canSignOut(t))).toEqual([false, true, false, false, true, false, false, false]);
    expect(listed.map(t => store.signOutCommandOf(t))).toEqual([null, null, null, null, "/logout", null, null, null]);
  });

  it("adds a provider and starts its sign-in only when its folder is new, TeamRun signs its kind in and the kind is installed", async () => {
    const signIn = new DeferredResponse();
    const grok = new ProviderKind("grok", "Grok CLI", true, true);
    const antigravity = new ProviderKind("antigravity", "Antigravity", true, true);
    const codex = new ProviderKind("codex", "Codex", true, true);
    context.answer(MethodName.ProviderKindList, () => [codex.toJson(), SampleData.claude.toJson(), grok.toJson(), antigravity.toJson()]);
    context.answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled).toJson()]);
    context.answer(MethodName.ProviderCreate, t => {
      const params = ProviderCreateParams.fromJson(t);
      return new Provider(`${params.kind}-1`, params.kind, params.label, `D:\\profiles\\${params.kind}\\${params.label}`, AuthStatus.Unknown, null, null, null, null,
        SampleData.timestamp).toJson();
    });
    context.answer(MethodName.ProviderSignIn, () => signIn.promise);
    await store.initialize();

    expect(await store.addProvider("grok", "Home", null)).toBe(true);
    expect(context.parametersOf(MethodName.ProviderCreate)).toEqual({ kind: "grok", label: "Home", profileDir: null });
    expect([...store.signingIn()]).toEqual(["grok-1"]);
    await Wait.until(() => expect(context.parametersOf(MethodName.ProviderSignIn)).toEqual({ providerId: "grok-1" }));
    expect(await store.addProvider("claude", "Home", null)).toBe(true);
    expect(await store.addProvider("antigravity", "Home", null)).toBe(true);
    expect(await store.addProvider("codex", "Home", "D:\\c")).toBe(true);

    expect(store.providers().map(t => t.id)).toEqual(["grok-1", "claude-1", "antigravity-1", "codex-1", "a1"]);
    expect(context.count(MethodName.ProviderSignIn)).toBe(1);
    signIn.resolve(new Provider("grok-1", "grok", "Home", "D:\\profiles\\grok\\Home", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson());
    await Wait.until(() => expect(store.signingIn().size).toBe(0));
    expect(store.providers()[0]?.authStatus).toBe(AuthStatus.LoggedIn);
  });

  it("checks a provider added from a folder that already exists, so a folder already signed in shows so, and says why when the check fails", async () => {
    context.answer(MethodName.ProviderCreate, t => {
      const params = ProviderCreateParams.fromJson(t);
      return new Provider(`${params.label}-1`, params.kind, params.label, params.profileDir ?? "D:\\profiles\\codex", AuthStatus.Unknown, null, null, null, null,
        SampleData.timestamp).toJson();
    });
    context.answer(MethodName.ProviderCheck, () => new Provider("Home-1", "codex", "Home", "D:\\home", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson());
    await store.initialize();
    const reported: string[] = [];

    expect(await store.addProvider("codex", "Home", "D:\\home", t => reported.push(t))).toBe(true);
    await Wait.until(() => expect(store.providers().find(t => t.id === "Home-1")?.authStatus).toBe(AuthStatus.LoggedIn));
    expect(context.parametersOf(MethodName.ProviderCheck)).toEqual({ providerId: "Home-1" });
    context.fail(MethodName.ProviderCheck, "The folder can't be read.");
    expect(await store.addProvider("codex", "Lab", "D:\\lab", t => reported.push(t))).toBe(true);
    await Wait.until(() => expect(reported).toEqual([expect.stringContaining("The folder can't be read.")]));
    expect([store.providers().find(t => t.id === "Lab-1")?.authStatus, context.count(MethodName.ProviderSignIn)]).toEqual([AuthStatus.Unknown, 0]);
  });

  describe("the first launch", () => {
    it("reads whether the first launch was finished, records it, and opens a provider's page in the external browser", async () => {
      let finishedAt: string | null = null;
      context.answer(MethodName.FirstLaunchRead, () => new FirstLaunch(finishedAt).toJson());
      context.answer(MethodName.FirstLaunchFinish, () => {
        finishedAt ??= SampleData.timestamp;
        return new FirstLaunch(finishedAt).toJson();
      });
      await store.initialize();

      expect((await store.readFirstLaunch())?.isFinished).toBe(false);
      store.welcome();
      expect(store.welcoming()).toBe(true);
      expect(await store.finishFirstLaunch()).toBe(true);
      expect(store.welcoming()).toBe(false);
      expect((await store.readFirstLaunch())?.finishedAt).toBe(SampleData.timestamp);
      await store.openPage("https://example.com/droid", LinkGesture.Modified);

      expect([context.links, context.linkGestures]).toEqual([["https://example.com/droid"], [LinkGesture.Modified]]);
      expect(context.noticeText()).toBeNull();
    });

    it("creates a first teammate and returns it, or returns none and names the teammate in the error line", async () => {
      const params = new TeammateCreateParams("Claude", null, SampleData.provider.id, Harness.Provider, null, null);
      context.answer(MethodName.TeammateCreate, () => new Teammate("t9", "Claude", null, SampleData.provider.id, Harness.Provider, null, null, SampleData.timestamp,
        SampleData.timestamp).toJson());
      await store.initialize();

      const created = await store.createTeammate(params);
      expect([created?.id, store.teammates().some(t => t.id === "t9")]).toEqual(["t9", true]);

      context.fail(MethodName.TeammateCreate, "That name is taken.");
      expect(await store.createTeammate(params)).toBeNull();
      expect(context.noticeText()).toBe("@Claude: That name is taken.");
    });

    it("reads no first launch when the runtime fails, and says so in the error line", async () => {
      context.fail(MethodName.FirstLaunchRead, "The database is busy.");
      context.fail(MethodName.FirstLaunchFinish, "The database is busy.");
      await store.initialize();

      expect(await store.readFirstLaunch()).toBeNull();
      store.welcome();
      expect(await store.finishFirstLaunch()).toBe(false);
      expect(store.welcoming()).toBe(true);
      expect(context.noticeText()).toBe("The database is busy.");
    });
  });

  describe("the profile folders found", () => {
    it("asks for the given kinds' folders that no provider uses yet, and answers them as found", async () => {
      const found = new DiscoveredProfile("codex", "D:\\profiles\\codex-home", "codex-home", false, AuthStatus.LoggedIn, new ProviderIdentity("home@example.com"));
      context.answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([found]).toJson());
      await store.initialize();

      const reported: string[] = [];

      expect(await store.discoverProfiles(t => reported.push(t), ["codex"])).toEqual([found]);
      expect([context.parametersOf(MethodName.ProviderProfileDiscover), reported]).toEqual([{ kinds: ["codex"] }, []]);
    });

    it("answers no folders and reports the reason when the search fails", async () => {
      context.fail(MethodName.ProviderProfileDiscover, "The profiles can't be read.");
      await store.initialize();
      const reported: string[] = [];

      expect(await store.discoverProfiles(t => reported.push(t), ["codex"])).toBeNull();
      expect(reported).toEqual(["The profiles can't be read."]);
    });
  });

  describe("the command-line tools", () => {
    const install = "curl -fsSL https://claude.ai/install.sh | bash";
    let terminals: FakeTerminalLauncher;
    let found: boolean;

    beforeEach(() => {
      store.dispose();
      terminals = new FakeTerminalLauncher();
      store = new ChatStoreService(context, terminals);
      found = false;
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("claude", "Claude Code", true, false, null, null).toJson()]);
      context.answer(MethodName.ProviderToolList, () => [new ProviderTool("claude", found, found ? "2.1.211" : null, install, "https://claude.com/pricing").toJson(),
        new ProviderTool("grok", false).toJson()]);
    });

    it("lists each kind's tool as the runtime finds it, afresh at each refresh", async () => {
      await store.initialize();

      expect(await store.refreshTools()).toBe(true);
      expect([...store.tools().values()].map(t => `${t.kind} ${t.found} ${t.version}`)).toEqual(["claude false null", "grok false null"]);
      found = true;
      await store.refreshTools();
      expect(store.tools().get("claude")?.version).toBe("2.1.211");
      expect(context.count(MethodName.ProviderToolList)).toBe(2);
    });

    it("ignores tools that answer after the store is disposed", async () => {
      await store.initialize();
      const tools = new DeferredResponse();
      context.answer(MethodName.ProviderToolList, () => tools.promise);

      const refreshing = store.refreshTools();
      store.dispose();
      tools.resolve([new ProviderTool("claude", true, "2.1.211").toJson()]);

      expect(await refreshing).toBe(true);
      expect(store.tools().size).toBe(0);
    });

    it("runs a tool's install in PowerShell or Command Prompt on Windows", async () => {
      const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
      onTestFinished(() => platform.mockRestore());
      await store.initialize();
      await store.refreshTools();

      const installing = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0);
      await installing;

      expect(terminals.launches.map(t => [t.request.command, t.request.shellKinds])).toEqual([[install, [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt]]]);
    });

    it("installs a tool by running the provider's install command in a terminal, once at a time, and looks again when it closes", async () => {
      await store.initialize();
      await store.refreshTools();

      const installing = store.installTool("claude");
      await store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.notice, t.request.title, t.request.command,
        t.request.minimumRows])).toEqual([[null, {},
        Resources.terminalInstallNotice, "Install Claude Code", install, 16]]);
      expect([...store.toolInstalls()]).toEqual(["claude"]);
      expect(context.count(MethodName.ProviderToolList)).toBe(1);

      found = true;
      terminals.end(0, new TerminalEnd("Exit", 0));
      await installing;

      expect(store.toolInstalls().size).toBe(0);
      expect(context.count(MethodName.ProviderToolList)).toBe(2);
      expect(store.tools().get("claude")?.found).toBe(true);
      expect(context.noticeText()).toBeNull();
    });

    it("installs a tool with no tab, as the Providers form does, asking the terminal for no rows", async () => {
      await store.initialize();
      await store.refreshTools();

      const installing = store.installTool("claude", undefined, false);
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(terminals.launches.map(t => [t.request.command, t.request.opensTab, t.request.minimumRows])).toEqual([[install, false, null]]);

      found = true;
      terminals.end(0, new TerminalEnd("Exit", 0));
      await installing;
      expect(store.tools().get("claude")?.found).toBe(true);
    });

    it("looks for the tool once its install command ends, and closes the terminal when it finds it", async () => {
      await store.initialize();
      await store.refreshTools();

      const installed = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      found = true;
      terminals.endCommand(0, 0);
      await installed;

      expect([context.count(MethodName.ProviderToolList), store.tools().get("claude")?.found, terminals.closes, store.toolInstalls().size, context.shownNotices()])
        .toEqual([2, true, [0], 0, []]);
    });

    it("leaves the install terminal open with the row's result when its command ends without the tool, and looks again when it closes", async () => {
      await store.initialize();
      await store.refreshTools();

      const missing = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 1);
      await Wait.until(() => expect(context.count(MethodName.ProviderToolList)).toBe(2));

      expect([store.toolInstalls().size, terminals.closes, store.tools().get("claude")?.found]).toEqual([0, [], false]);
      found = true;
      terminals.end(0);
      await missing;

      expect([context.count(MethodName.ProviderToolList), store.tools().get("claude")?.found, terminals.closes]).toEqual([3, true, []]);
    });

    it("closes a failed install's open terminal without a look when Install runs again, and opens one new terminal", async () => {
      await store.initialize();
      await store.refreshTools();

      const first = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 1);
      await Wait.until(() => expect(store.toolInstalls().size).toBe(0));
      const second = store.installTool("claude");
      await first;
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));

      expect([terminals.closes, [...store.toolInstalls()], context.count(MethodName.ProviderToolList)]).toEqual([[0], ["claude"], 2]);
      found = true;
      terminals.endCommand(1, 0);
      await second;

      expect([terminals.closes, context.count(MethodName.ProviderToolList), store.tools().get("claude")?.found, store.toolInstalls().size, context.noticeText()])
        .toEqual([[0, 1], 3, true, 0, null]);
    });

    it("looks for the tool only when the terminal closes when its shell can't tell the command's end, or once the store is let go", async () => {
      await store.initialize();
      await store.refreshTools();

      const untold = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, null);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      expect([context.count(MethodName.ProviderToolList), [...store.toolInstalls()]]).toEqual([1, ["claude"]]);
      terminals.end(0);
      await untold;
      expect(context.count(MethodName.ProviderToolList)).toBe(2);

      const disposed = store.installTool("claude");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      store.dispose();
      terminals.endCommand(1, 0);
      terminals.end(1);
      await disposed;

      expect([context.count(MethodName.ProviderToolList), terminals.closes]).toEqual([2, []]);
    });

    it("opens no terminal for a tool without an install command, and shows a refused terminal in the error line", async () => {
      const refusal = new LaunchArgumentRefusedException("context", "The terminal isn't open.");
      await store.initialize();
      await store.refreshTools();

      await store.installTool("grok");
      expect(terminals.launches).toHaveLength(0);

      terminals.refuse(refusal);
      await store.installTool("claude");

      expect([context.shownNotices(Resources.chatActionFailedNotice).at(-1)?.title, context.noticeText()])
        .toEqual(["Couldn't install Claude Code's tool", refusal.message]);
      expect(store.toolInstalls().size).toBe(0);
      expect(context.count(MethodName.ProviderToolList)).toBe(1);
    });
  });

  describe("from a terminal", () => {
    const claude = new ProviderKind("claude", "Claude Code", true, false, null, new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login"));
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, null, new ProviderProfile("COPILOT_HOME", "copilot login"));
    const codex = new ProviderKind("codex", "Codex", true, false, null, new ProviderProfile("CODEX_HOME"));
    const provider = (id: string, kind: string, profileDir: string, status: AuthStatus = AuthStatus.Unknown): Provider =>
      new Provider(id, kind, "Work", profileDir, status, null, null, null, null, SampleData.timestamp);
    let terminals: FakeTerminalLauncher;

    beforeEach(() => {
      store.dispose();
      terminals = new FakeTerminalLauncher();
      store = new ChatStoreService(context, terminals);
      context.answer(MethodName.ProviderKindList, () => [codex.toJson(), claude.toJson(), copilot.toJson()]);
      context.answer(MethodName.ProviderList, () => [SampleData.provider.toJson(), provider("c1", "claude", "D:\\profiles\\claude\\Work").toJson(),
        provider("p1", "copilot", "/home/person/profiles/copilot/Work").toJson()]);
      context.answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        return provider(id, id === "c1" ? "claude" : "copilot", id === "c1" ? "D:\\profiles\\claude\\Work" : "/home/person/profiles/copilot/Work", AuthStatus.LoggedIn)
          .toJson();
      });
    });

    it("waits on a terminal until its command ends, the terminal ends or the wait is stopped", () => {
      expect(Object.values(TerminalStep)).toEqual(["CommandEnded", "Ended", "Stopped"]);
    });

    it("asks for PowerShell or Command Prompt for an added agent's own sign-in command on Windows", async () => {
      const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
      onTestFinished(() => platform.mockRestore());
      const droid = (status: AuthStatus): Provider => provider("d1", "droid", "D:\\profiles\\droid\\Work", status);
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("droid", "Droid", true, true).toJson()]);
      context.answer(MethodName.ProviderList, () => [droid(AuthStatus.Unknown).toJson()]);
      context.answer(MethodName.ProviderCheck, () => droid(AuthStatus.LoggedIn).toJson());
      context.answer(MethodName.ProviderSignInCommand, () => new ProviderSignInCommand("droid login", {}).toJson());
      await store.initialize();

      const signingIn = store.signInProvider("d1", undefined, false);
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0, new TerminalEnd("Exit", 0));
      await signingIn;

      expect(terminals.launches.map(t => [t.request.command, t.request.shellKinds])).toEqual([["droid login", [TerminalShellKind.PowerShell,
        TerminalShellKind.CommandPrompt]]]);
    });

    it("signs an added agent in from the terminal command its adapter gives, and through the adapter when it gives none or can't say", async () => {
      const folder = "D:\\profiles\\droid\\Work";
      const droid = (status: AuthStatus): Provider => provider("d1", "droid", folder, status);
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("droid", "Droid", true, true).toJson()]);
      context.answer(MethodName.ProviderList, () => [droid(AuthStatus.Unknown).toJson()]);
      context.answer(MethodName.ProviderCheck, () => droid(AuthStatus.LoggedIn).toJson());
      context.answer(MethodName.ProviderSignIn, () => droid(AuthStatus.LoggedIn).toJson());
      context.answer(MethodName.ProviderSignInCommand, () => new ProviderSignInCommand("droid login", { PATH: "D:\\agents\\droid" }).toJson());
      await store.initialize();

      const first = store.signInProvider("d1", undefined, false);
      expect(store.signingIn().has("d1")).toBe(true);
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(context.parametersOf(MethodName.ProviderSignInCommand)).toEqual({ providerId: "d1" });
      expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.notice, t.request.title, t.request.command,
        t.request.opensTab, t.request.minimumRows])).toEqual([[folder, { PATH: "D:\\agents\\droid" }, Resources.terminalSignInNotice, "Sign in Work",
        "droid login", false, null]]);
      expect([...store.terminalSignIns()]).toEqual(["d1"]);
      expect([...store.signInCommands()]).toEqual([["d1", "droid login"]]);
      expect(store.signingIn().size).toBe(0);
      expect(context.count(MethodName.ProviderSignIn)).toBe(0);
      terminals.end(0, new TerminalEnd("Exit", 0));
      await first;
      expect(context.count(MethodName.ProviderCheck)).toBe(1);

      context.answer(MethodName.ProviderSignInCommand, () => null);
      await store.signInProvider("d1");
      expect(context.count(MethodName.ProviderSignIn)).toBe(1);

      context.disconnect(MethodName.ProviderSignInCommand, "The runtime is older.");
      await store.signInProvider("d1");
      expect(context.count(MethodName.ProviderSignIn)).toBe(2);
      expect(terminals.launches).toHaveLength(1);
    });

    it("keeps a terminal sign-in's command only from its launch until its terminal ends, so the next sign-in shows none until its own command is known", async () => {
      const first = new DeferredResponse();
      const second = new DeferredResponse();
      const answers = [first, second];
      context.answer(MethodName.ProviderSignInCommand, () => answers.shift()?.promise ?? null);
      await store.initialize();

      const firstSignIn = store.signInProvider("c1");
      await Wait.until(() => expect([...store.terminalSignIns()]).toEqual(["c1"]));
      const beforeFirst = [...store.signInCommands()];
      first.resolve(new ProviderSignInCommand("claude login --first", {}).toJson());
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      const duringFirst = [...store.signInCommands()];
      terminals.end(0, new TerminalEnd("Exit", 0));
      await firstSignIn;
      const afterFirst = [...store.signInCommands()];

      const secondSignIn = store.signInProvider("c1");
      await Wait.until(() => expect([...store.terminalSignIns()]).toEqual(["c1"]));
      const beforeSecond = [...store.signInCommands()];
      second.resolve(new ProviderSignInCommand("claude login --second", {}).toJson());
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      const duringSecond = [...store.signInCommands()];
      terminals.end(1, new TerminalEnd("Exit", 0));
      await secondSignIn;

      expect([beforeFirst, duringFirst, afterFirst, beforeSecond, duringSecond, [...store.signInCommands()]])
        .toEqual([[], [["c1", "claude login --first"]], [], [], [["c1", "claude login --second"]], []]);
    });

    it("asks for PowerShell or Command Prompt for a terminal sign-in on Windows, so a WSL Default shell doesn't run it, and for any shell elsewhere",
      async () => {
        const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
        onTestFinished(() => platform.mockRestore());
        await store.initialize();

        const windows = store.signInProvider("c1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        platform.mockReturnValue("Linux x86_64");
        const linux = store.signInProvider("p1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(2));
        terminals.end(0);
        terminals.end(1);
        await Promise.all([windows, linux]);

        expect(terminals.launches.map(t => [t.request.command, t.request.shellKinds])).toEqual([
          ["claude auth login", [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt]], ["copilot login", []]]);
      });

    it("signs Claude Code and Copilot in from a terminal at the provider's folder, with its variable set and its login command run, once at a time", async () => {
      await store.initialize();

      const first = store.signInProvider("c1");
      await store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(terminals.launches[0]?.context).toBe(context);
      expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.notice, t.request.title, t.request.command,
        t.request.minimumRows])).toEqual([[
        "D:\\profiles\\claude\\Work", { CLAUDE_CONFIG_DIR: "D:\\profiles\\claude\\Work" },
        Resources.terminalSignInNotice, "Sign in Work", "claude auth login", 16]]);
      expect([...store.terminalSignIns()]).toEqual(["c1"]);
      expect(store.signingIn().size).toBe(0);
      expect([context.count(MethodName.ProviderSignIn), context.count(MethodName.ProviderCheck)]).toEqual([0, 0]);

      terminals.end(0, new TerminalEnd("Exit", 0));
      await first;

      expect(store.terminalSignIns().size).toBe(0);
      expect(context.count(MethodName.ProviderCheck)).toBe(1);
      expect(context.parametersOf(MethodName.ProviderCheck)).toEqual({ providerId: "c1" });
      expect(store.providers().find(t => t.id === "c1")?.authStatus).toBe(AuthStatus.LoggedIn);

      const second = store.signInProvider("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      terminals.end(1);
      await second;

      expect([terminals.launches[1]?.request.folder, terminals.launches[1]?.request.environment, terminals.launches[1]?.request.command]).toEqual([
        "/home/person/profiles/copilot/Work", { COPILOT_HOME: "/home/person/profiles/copilot/Work" }, "copilot login"]);
      expect(context.count(MethodName.ProviderCheck)).toBe(2);
      expect(store.providers().map(t => store.canSignIn(t))).toEqual([false, true, true]);
      expect(context.noticeText()).toBeNull();
    });

    it("runs a terminal sign-in through the copy of the CLI the provider's turns run, as the runtime names it, and the kind's own command when it names none", async () => {
      const copy = "C:\\Users\\person\\AppData\\Roaming\\TeamRun\\providers\\claude;C:\\Windows";
      context.answer(MethodName.ProviderSignInCommand, t => ProviderIdParams.fromJson(t).providerId === "c1"
        ? new ProviderSignInCommand("claude auth login", { Path: copy }).toJson() : null);
      await store.initialize();

      const order = ["c1", "p1"];
      for (const id of order) {
        const index = order.indexOf(id);
        const signIn = store.signInProvider(id);
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index);
        await signIn;
      }

      expect(terminals.launches.map(t => [t.request.environment, t.request.command, t.request.opensTab, t.request.minimumRows])).toEqual([
        [{ CLAUDE_CONFIG_DIR: "D:\\profiles\\claude\\Work", Path: copy }, "claude auth login", true, 16],
        [{ COPILOT_HOME: "/home/person/profiles/copilot/Work" }, "copilot login", true, 16]]);
      expect(context.count(MethodName.ProviderSignInCommand)).toBe(2);
      expect(context.noticeText()).toBeNull();
    });

    it("runs the kind's own sign-in command, with no notice, when the runtime can't name the copy, as an older runtime can't", async () => {
      context.disconnect(MethodName.ProviderSignInCommand, "The runtime is older.");
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0);
      await signIn;

      expect([terminals.launches[0]?.request.environment, terminals.launches[0]?.request.command]).toEqual([
        { CLAUDE_CONFIG_DIR: "D:\\profiles\\claude\\Work" }, "claude auth login"]);
      expect(context.noticeText()).toBeNull();
    });

    it("reports a sign-in command read's failure other than the runtime's or the answer's, opening no terminal", async () => {
      const broken = new Error("broken");
      context.answer(MethodName.ProviderSignInCommand, () => {
        throw broken;
      });
      await store.initialize();
      const reported: string[] = [];

      await store.signInProvider("c1", t => reported.push(t));

      expect([reported, terminals.launches]).toEqual([["broken"], []]);
    });

    it("sets a kind's other sign-in variables to their folders inside the provider's folder, with the folder's own separator, and its sign-in values", async () => {
      const opencode = new ProviderKind("opencode", "OpenCode", true, false, null,
        new ProviderProfile("XDG_DATA_HOME", "opencode auth login", null, null, { XDG_CONFIG_HOME: "config", XDG_STATE_HOME: "home/.local/state" },
          { OPENCODE_CONFIG: "", OPENCODE_DISABLE_PROJECT_CONFIG: "1" }));
      context.answer(MethodName.ProviderKindList, () => [opencode.toJson()]);
      const folders = new Map([["o1", "D:\\profiles\\opencode\\Work\\"], ["o2", "/home/person/profiles/opencode/Work"]]);
      context.answer(MethodName.ProviderList, () => [...folders.keys()].map(id => provider(id, "opencode", Required.of(folders.get(id))).toJson()));
      context.answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        return provider(id, "opencode", Required.of(folders.get(id)), AuthStatus.LoggedIn).toJson();
      });
      await store.initialize();

      const order = ["o1", "o2"];
      for (const id of order) {
        const index = order.indexOf(id);
        const signIn = store.signInProvider(id);
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index);
        await signIn;
      }

      expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.command])).toEqual([
        ["D:\\profiles\\opencode\\Work\\", { XDG_DATA_HOME: "D:\\profiles\\opencode\\Work\\", XDG_CONFIG_HOME: "D:\\profiles\\opencode\\Work\\config",
          XDG_STATE_HOME: "D:\\profiles\\opencode\\Work\\home\\.local\\state", OPENCODE_CONFIG: "", OPENCODE_DISABLE_PROJECT_CONFIG: "1" }, "opencode auth login"],
        ["/home/person/profiles/opencode/Work", { XDG_DATA_HOME: "/home/person/profiles/opencode/Work", XDG_CONFIG_HOME: "/home/person/profiles/opencode/Work/config",
          XDG_STATE_HOME: "/home/person/profiles/opencode/Work/home/.local/state", OPENCODE_CONFIG: "", OPENCODE_DISABLE_PROJECT_CONFIG: "1" }, "opencode auth login"]]);
    });

    it("reads Claude Code's person folder again when signing in, so a folder the environment names after the listing signs in without the variable, " +
      "trailing separator and all", async () => {
      let usual = "/person/.claude";
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("claude", "Claude Code", true, false, null,
        new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", usual, null, {}, {}, [usual])).toJson()]);
      const folders = new Map([["c1", "/person/.claude"], ["c2", "/person/claude-work"]]);
      context.answer(MethodName.ProviderList, () => [...folders.keys()].map(id => provider(id, "claude", Required.of(folders.get(id))).toJson()));
      context.answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        return provider(id, "claude", folders.get(id) ?? String.empty, AuthStatus.LoggedIn).toJson();
      });
      await store.initialize();
      usual = "/person/claude-work/";

      const order = ["c1", "c2"];
      for (const id of order) {
        const index = order.indexOf(id);
        const signIn = store.signInProvider(id);
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index);
        await signIn;
      }

      expect(terminals.launches.map(t => t.request.environment)).toEqual([{ CLAUDE_CONFIG_DIR: "/person/.claude" }, {}]);
    });

    it("reports a sign-in whose read of the provider types fails, opening no terminal", async () => {
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("claude", "Claude Code", true, false, null,
        new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", "/person/.claude", null, {}, {}, ["/person/.claude"])).toJson()]);
      context.answer(MethodName.ProviderList, () => [provider("c1", "claude", "/person/.claude").toJson()]);
      await store.initialize();
      context.disconnect(MethodName.ProviderKindList, "The runtime is restarting.");
      const reported: string[] = [];

      await store.signInProvider("c1", t => reported.push(t));

      expect(reported).toEqual([Resources.signInKindsNotRead]);
      expect(terminals.launches).toHaveLength(0);
    });

    it("lets a sign-in's read of the provider types fail other than by the runtime or the answer, opening no terminal", async () => {
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("claude", "Claude Code", true, false, null,
        new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", "/person/.claude", null, {}, {}, ["/person/.claude"])).toJson()]);
      context.answer(MethodName.ProviderList, () => [provider("c1", "claude", "/person/.claude").toJson()]);
      await store.initialize();
      const broken = new Error("broken");
      context.answer(MethodName.ProviderKindList, () => {
        throw broken;
      });

      await expect(store.signInProvider("c1", () => undefined)).rejects.toBe(broken);

      expect(terminals.launches).toHaveLength(0);
    });

    it("lets an added agent's sign-in command read fail other than by the runtime or the answer, signing nothing in", async () => {
      context.answer(MethodName.ProviderKindList, () => [new ProviderKind("droid", "Droid", true, true).toJson()]);
      context.answer(MethodName.ProviderList, () => [provider("d1", "droid", "D:\\profiles\\droid\\Work", AuthStatus.Unknown).toJson()]);
      const broken = new Error("broken");
      context.answer(MethodName.ProviderSignInCommand, () => {
        throw broken;
      });
      await store.initialize();

      await expect(store.signInProvider("d1", () => undefined, false)).rejects.toBe(broken);

      expect([terminals.launches, context.count(MethodName.ProviderSignIn), store.signingIn().size]).toEqual([[], 0, 0]);
    });

    it("signs Claude Code in its usual folder in with the person's own environment, and one with its own folder with its folder named", async () => {
      const usual = new ProviderKind("claude", "Claude Code", true, false, null,
        new ProviderProfile("CLAUDE_CONFIG_DIR", "claude auth login", "/person/.claude", null, {}, {}, ["/person/.claude"]));
      context.answer(MethodName.ProviderKindList, () => [usual.toJson()]);
      const folders = new Map([["c1", "/person/.claude"], ["c2", "/person/profiles/claude/Work"]]);
      context.answer(MethodName.ProviderList, () => [...folders.keys()].map(id => provider(id, "claude", Required.of(folders.get(id))).toJson()));
      context.answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        return provider(id, "claude", folders.get(id) ?? String.empty, AuthStatus.LoggedIn).toJson();
      });
      await store.initialize();

      const order = ["c1", "c2"];
      for (const id of order) {
        const index = order.indexOf(id);
        const signIn = store.signInProvider(id);
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index);
        await signIn;
      }

      expect(terminals.launches.map(t => [t.request.environment, t.request.command])).toEqual([[{}, "claude auth login"],
        [{ CLAUDE_CONFIG_DIR: "/person/profiles/claude/Work" }, "claude auth login"]]);
    });

    it("leaves the kind's variable to the person's own environment for a provider in one of the person's folders, so the sign-in lands where its turns look", async () => {
      const opencode = new ProviderKind("opencode", "OpenCode", true, false, null,
        new ProviderProfile("XDG_DATA_HOME", "opencode auth login", "/home/person/.local/share", null, {}, {}, ["/home/person/.local/share", "/data/profiles/opencode/default"]));
      context.answer(MethodName.ProviderKindList, () => [opencode.toJson()]);
      const folders = new Map([["o1", "/data/profiles/opencode/default"], ["o2", "/home/person/.local/share"], ["o3", "/home/person/work"]]);
      context.answer(MethodName.ProviderList, () => [...folders.keys()].map(id => provider(id, "opencode", Required.of(folders.get(id))).toJson()));
      context.answer(MethodName.ProviderCheck, t => {
        const id = ProviderIdParams.fromJson(t).providerId;
        return provider(id, "opencode", Required.of(folders.get(id)), AuthStatus.LoggedIn).toJson();
      });
      await store.initialize();

      const order = ["o1", "o2", "o3"];
      for (const id of order) {
        const index = order.indexOf(id);
        const signIn = store.signInProvider(id);
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index);
        await signIn;
      }

      expect(terminals.launches.map(t => t.request.environment)).toEqual([{}, {}, { XDG_DATA_HOME: "/home/person/work" }]);
    });

    it("signs Pi in by running plain pi with the kind's own notice, for the person to type /login there", async () => {
      const pi = new ProviderKind("pi", "Pi", true, false, null, new ProviderProfile("PI_CODING_AGENT_DIR", "pi"), false, null, false, null, false, null,
        SampleData.abilities());
      context.answer(MethodName.ProviderKindList, () => [pi.toJson()]);
      context.answer(MethodName.ProviderList, () => [provider("x1", "pi", "/home/person/.pi/agent").toJson()]);
      context.answer(MethodName.ProviderCheck, () => provider("x1", "pi", "/home/person/.pi/agent", AuthStatus.LoggedIn).toJson());
      await store.initialize();

      const signIn = store.signInProvider("x1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0);
      await signIn;

      expect(terminals.launches.map(t => [t.request.environment, t.request.notice, t.request.command])).toEqual([
        [{ PI_CODING_AGENT_DIR: "/home/person/.pi/agent" }, Resources.terminalSignInNotices.get("pi"), "pi"]]);
      expect(context.count(MethodName.ProviderCheck)).toBe(1);
    });

    it("checks the sign-in however the terminal ends, even detached", async () => {
      await store.initialize();

      const order = [new TerminalEnd("Close", null), new TerminalEnd("Exit", 1), new TerminalEnd("Detach", null)];
      for (const end of order) {
        const index = order.indexOf(end);
        const signIn = store.signInProvider("c1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(index + 1));
        terminals.end(index, end);
        await signIn;
      }

      expect(context.count(MethodName.ProviderCheck)).toBe(3);
    });

    it("shows a refused terminal in the error line and checks nothing", async () => {
      const refusal = new LaunchArgumentRefusedException("context", "The terminal isn't open.");
      terminals.refuse(refusal);
      await store.initialize();

      await store.signInProvider("c1");

      expect(context.noticeText()).toBe(refusal.message);
      expect(store.terminalSignIns().size).toBe(0);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
      expect(terminals.launches).toHaveLength(1);
    });

    it("leaves a provider it doesn't list to the runtime's sign-in, which refuses it, and opens no terminal", async () => {
      context.fail(MethodName.ProviderSignIn, "The provider gone was not found.");
      await store.initialize();

      await store.signInProvider("gone");

      expect(context.parametersOf(MethodName.ProviderSignIn)).toEqual({ providerId: "gone" });
      expect(context.noticeText()).toBe("The provider gone was not found.");
      expect(terminals.launches).toHaveLength(0);
    });

    it("checks once when the terminal ends, and not on a second end", async () => {
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.end(0, new TerminalEnd("Close", null));
      await signIn;
      terminals.end(0, new TerminalEnd("Close", null));
      await Promise.resolve();

      expect(context.count(MethodName.ProviderCheck)).toBe(1);
      expect(store.terminalSignIns().size).toBe(0);
      expect(store.canSignIn(Required.of(store.providers().find(t => t.id === "c1")))).toBe(true);
    });

    it("checks the sign-in at once when its login command ends, and closes the terminal once it finds the provider signed in", async () => {
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 0);
      await signIn;

      expect([context.count(MethodName.ProviderCheck), terminals.closes, store.terminalSignIns().size]).toEqual([1, [0], 0]);
      expect(store.providers().find(t => t.id === "c1")?.authStatus).toBe(AuthStatus.LoggedIn);
      expect(context.shownNotices()).toEqual([]);
    });

    it("leaves the terminal open and shows the failure when the check after the command finds no sign-in, and checks again when it closes", async () => {
      let checks = 0;
      context.answer(MethodName.ProviderCheck, () => {
        checks++;
        return new Provider("c1", "claude", "Work", "D:\\profiles\\claude\\Work", checks === 1 ? AuthStatus.LoggedOut : AuthStatus.LoggedIn, null, null, null,
          checks === 1 ? "Not logged in." : null, SampleData.timestamp).toJson();
      });
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 1);
      await Wait.until(() => expect(store.terminalSignIns().size).toBe(0));

      const failed = store.providers().find(t => t.id === "c1");
      expect([failed?.authStatus, failed?.lastError, terminals.closes, context.count(MethodName.ProviderCheck)]).toEqual([AuthStatus.LoggedOut, "Not logged in.", [], 1]);
      terminals.end(0);
      await signIn;

      expect([store.providers().find(t => t.id === "c1")?.authStatus, terminals.closes, context.count(MethodName.ProviderCheck)]).toEqual([AuthStatus.LoggedIn, [], 2]);
    });

    it("waits for the terminal when its shell can't tell the command's end, and leaves it open when the check fails", async () => {
      await store.initialize();

      const untold = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, null);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      expect([context.count(MethodName.ProviderCheck), [...store.terminalSignIns()]]).toEqual([0, ["c1"]]);
      terminals.end(0);
      await untold;
      expect(context.count(MethodName.ProviderCheck)).toBe(1);

      context.fail(MethodName.ProviderCheck, "The check failed.");
      const failing = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      terminals.endCommand(1, 0);
      await Wait.until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => t.text)).toEqual(["The check failed."]));

      expect([terminals.closes, store.terminalSignIns().size]).toEqual([[], 0]);
      terminals.end(1);
      await failing;
      expect(context.count(MethodName.ProviderCheck)).toBe(3);
    });

    it("closes a failed sign-in's open terminal without a check when it signs in again or the provider is removed", async () => {
      context.answer(MethodName.ProviderCheck, () => provider("c1", "claude", "D:\\profiles\\claude\\Work", AuthStatus.LoggedOut).toJson());
      context.answer(MethodName.ProviderDelete, () => null);
      await store.initialize();

      const first = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 1);
      await Wait.until(() => expect(store.terminalSignIns().size).toBe(0));
      const second = store.signInProvider("c1");
      await first;
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));

      expect([terminals.closes, [...store.terminalSignIns()], context.count(MethodName.ProviderCheck)]).toEqual([[0], ["c1"], 1]);
      terminals.endCommand(1, 1);
      await Wait.until(() => expect(store.terminalSignIns().size).toBe(0));
      await store.removeProvider("c1");
      await second;

      expect([terminals.closes, context.count(MethodName.ProviderCheck), context.shownNotices()]).toEqual([[0, 1], 2, []]);
    });

    it("checks no provider that is no longer listed when its terminal ends", async () => {
      context.answer(MethodName.ProviderDelete, () => null);
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await store.removeProvider("c1");
      terminals.end(0);
      await signIn;

      expect(store.providers().some(t => t.id === "c1")).toBe(false);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
      expect(context.noticeText()).toBeNull();
    });

    it("stops a terminal sign-in when asked by closing its terminal, before or after its tab opens, checks nothing, and can sign in again", async () => {
      await store.initialize();

      const first = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await store.stopTerminalSignIn("c1");
      await first;

      expect(store.terminalSignIns().size).toBe(0);
      expect(terminals.closes).toEqual([0]);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);

      const opening = new DeferredResponse();
      let closes = 0;
      store.dispose();
      store = new ChatStoreService(context, {
        openAsync: async () => {
          await opening.promise;
          return new LaunchedTerminal("late", new Promise<TerminalEnd>(() => undefined), async () => {
            closes++;
          });
        }
      });
      await store.initialize();
      const second = store.signInProvider("c1");
      const stopping = store.stopTerminalSignIn("c1");
      await second;

      expect([store.terminalSignIns().size, closes]).toEqual([0, 0]);
      opening.resolve(null);
      await stopping;
      expect(closes).toBe(1);

      const refusal = new DeferredResponse();
      store.dispose();
      store = new ChatStoreService(context, { openAsync: () => refusal.promise.then(() => Promise.reject(new Error("The terminal closed."))) });
      await store.initialize();
      const third = store.signInProvider("c1");
      const refused = store.stopTerminalSignIn("c1");
      await third;
      refusal.resolve(null);
      await refused;

      expect(store.terminalSignIns().size).toBe(0);
      expect(context.noticeText()).toBeNull();
      await store.stopTerminalSignIn("c1");
      expect(store.terminalSignIns().size).toBe(0);
    });

    it("keeps a new sign-in's wait when the stopped terminal ends after it starts, and checks only once the new terminal ends", async () => {
      const closing = new DeferredResponse();
      terminals.holdCloses(closing.promise);
      await store.initialize();

      const first = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      const stopping = store.stopTerminalSignIn("c1");
      await first;
      const second = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      closing.resolve(null);
      await stopping;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      expect(terminals.closes).toEqual([0]);
      expect([...store.terminalSignIns()]).toEqual(["c1"]);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
      terminals.end(1);
      await second;
      expect(context.count(MethodName.ProviderCheck)).toBe(1);
      expect(store.terminalSignIns().size).toBe(0);
    });

    it("posts a refused close as a notice, and still ends the wait and removes the provider", async () => {
      context.answer(MethodName.ProviderDelete, () => null);
      terminals.refuseClose(new Error("The terminal couldn't close."));
      await store.initialize();

      const stopped = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await store.stopTerminalSignIn("c1");
      await stopped;

      expect([context.noticeText(), store.terminalSignIns().size]).toEqual(["The terminal couldn't close.", 0]);
      const removed = store.signInProvider("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      await store.removeProvider("p1");
      await removed;

      expect(terminals.closes).toEqual([0, 1]);
      expect([context.noticeText(), store.terminalSignIns().size, store.providers().some(t => t.id === "p1")]).toEqual(["The terminal couldn't close.", 0, false]);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
    });

    it("closes a provider's sign-in terminal when it removes the provider, and checks nothing after", async () => {
      context.answer(MethodName.ProviderDelete, () => null);
      await store.initialize();
      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      await store.removeProvider("c1");
      await signIn;

      expect(terminals.closes).toEqual([0]);
      expect(store.terminalSignIns().size).toBe(0);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
    });

    it("closes a provider's sign-in terminal when it disables the provider, checks nothing after, and keeps it on while enabling", async () => {
      context.answer(MethodName.ProviderSetEnabled, t => {
        const params = ProviderEnabledParams.fromJson(t);
        return provider(params.providerId, "claude", "D:\\profiles\\claude\\Work").withEnabled(params.enabled).toJson();
      });
      await store.initialize();
      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      await store.setProviderEnabled("c1", true);
      expect([...store.terminalSignIns()]).toEqual(["c1"]);
      await store.setProviderEnabled("c1", false);
      await signIn;

      expect(terminals.closes).toEqual([0]);
      expect(store.terminalSignIns().size).toBe(0);
      expect(store.providers().find(t => t.id === "c1")?.enabled).toBe(false);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);
    });

    it("closes only the stopped, disabled or removed provider's sign-in terminal, and checks the other provider's when it ends", async () => {
      context.answer(MethodName.ProviderDelete, () => null);
      context.answer(MethodName.ProviderSetEnabled, t => {
        const params = ProviderEnabledParams.fromJson(t);
        return provider(params.providerId, "claude", "D:\\profiles\\claude\\Work").withEnabled(params.enabled).toJson();
      });
      await store.initialize();

      const copilotSignIn = store.signInProvider("p1");
      const stopped = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      await store.stopTerminalSignIn("c1");
      await stopped;

      expect([terminals.closes, [...store.terminalSignIns()]]).toEqual([[1], ["p1"]]);

      const disabled = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(3));
      await store.setProviderEnabled("c1", false);
      await disabled;

      expect([terminals.closes, [...store.terminalSignIns()]]).toEqual([[1, 2], ["p1"]]);

      await store.setProviderEnabled("c1", true);
      const claudeSignIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(4));
      await store.removeProvider("p1");
      await copilotSignIn;

      expect([terminals.closes, [...store.terminalSignIns()]]).toEqual([[1, 2, 0], ["c1"]]);
      expect(context.count(MethodName.ProviderCheck)).toBe(0);

      terminals.end(3);
      await claudeSignIn;

      expect(context.parametersOf(MethodName.ProviderCheck)).toEqual({ providerId: "c1" });
      expect([context.count(MethodName.ProviderCheck), store.terminalSignIns().size, context.shownNotices()]).toEqual([1, 0, []]);
    });

    it("checks nothing when a terminal ends while its provider's disable or removal is on its way, and shows no error", async () => {
      const disabling = new DeferredResponse();
      const removing = new DeferredResponse();
      context.answer(MethodName.ProviderSetEnabled, () => disabling.promise);
      context.answer(MethodName.ProviderDelete, () => removing.promise);
      await store.initialize();

      const claudeSignIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      const disabled = store.setProviderEnabled("c1", false);
      terminals.end(0);
      await claudeSignIn;
      disabling.resolve(provider("c1", "claude", "D:\\profiles\\claude\\Work").withEnabled(false).toJson());
      await disabled;
      const copilotSignIn = store.signInProvider("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      const removed = store.removeProvider("p1");
      terminals.end(1);
      await copilotSignIn;
      removing.resolve(null);
      await removed;

      expect(context.count(MethodName.ProviderCheck)).toBe(0);
      expect(context.noticeText()).toBeNull();
      expect(store.providers().map(t => [t.id, t.enabled])).toEqual([[SampleData.provider.id, true], ["c1", false]]);
      expect(store.terminalSignIns().size).toBe(0);
    });

    it("checks no sign-in once the window has let the store go", async () => {
      await store.initialize();

      const signIn = store.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      store.dispose();
      terminals.end(0);
      await signIn;

      expect(context.count(MethodName.ProviderCheck)).toBe(0);
    });

    it("adds Claude Code in a new folder and opens its terminal, but not for an existing folder", async () => {
      context.answer(MethodName.ProviderCreate, t => {
        const params = ProviderCreateParams.fromJson(t);
        return provider(`${params.kind}-1`, params.kind, params.profileDir ?? `D:\\data\\profiles\\${params.kind}\\Work`).toJson();
      });
      await store.initialize();

      expect(await store.addProvider("copilot", "Work", "D:\\copilot")).toBe(true);
      expect(await store.addProvider("claude", "Work", null)).toBe(true);
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(terminals.launches[0]?.request.environment).toEqual({ CLAUDE_CONFIG_DIR: "D:\\data\\profiles\\claude\\Work" });
      expect([...store.terminalSignIns()]).toEqual(["claude-1"]);
      expect(context.count(MethodName.ProviderSignIn)).toBe(0);
      terminals.end(0);
      await Wait.until(() => expect(context.count(MethodName.ProviderCheck)).toBe(1));
    });

    it("takes the window's terminals through its provider, the terminal module's launcher unless the window gives another", async () => {
      TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ChatStoreService.terminals, useValue: terminals },
        ChatStoreService.provider] });
      const shared = TestBed.inject(ChatStoreService);
      await Wait.until(() => expect(shared.loaded()).toBe(true));

      void shared.signInProvider("c1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      ChatStoreService.release(context);
      TestBed.resetTestingModule();

      expect(TestBed.inject(ChatStoreService.terminals)).toBe(TerminalLauncher);
    });
  });

  describe("signing out in a terminal", () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, null, new ProviderProfile("COPILOT_HOME", "copilot login", null, "copilot"),
      false, "/logout");
    const grok = new ProviderKind("grok", "Grok CLI", true, true, null, null, true);
    const folder = "/home/person/profiles/copilot/Work";
    const pilot = (status: AuthStatus): Provider => new Provider("p1", "copilot", "Work", folder, status, null, null, null, null, SampleData.timestamp);
    let checked: AuthStatus;
    let terminals: FakeTerminalLauncher;

    beforeEach(() => {
      store.dispose();
      terminals = new FakeTerminalLauncher();
      store = new ChatStoreService(context, terminals);
      checked = AuthStatus.LoggedIn;
      context.answer(MethodName.ProviderKindList, () => [copilot.toJson(), grok.toJson()]);
      context.answer(MethodName.ProviderList, () => [pilot(AuthStatus.LoggedIn).toJson(),
        new Provider("g1", "grok", "Lounge", "D:\\profiles\\grok", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp).toJson()]);
      context.answer(MethodName.ProviderCheck, () => pilot(checked).toJson());
    });

    it("opens Copilot's own session at the provider's folder with its variable set, once at a time, and closes it once the tool ends signed out", async () => {
      await store.initialize();

      const signingOut = store.signOutInTerminal("p1");
      let followed = false;
      const again = store.signOutInTerminal("p1").then(() => {
        followed = true;
      });
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));

      expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.notice, t.request.title, t.request.command])).toEqual([[folder,
        { COPILOT_HOME: folder }, Resources.terminalSignOutNotice, "Sign out Work", "copilot"]]);
      expect([[...store.terminalSignOuts()], store.terminalSignIns().size, context.count(MethodName.ProviderCheck)]).toEqual([["p1"], 0, 0]);

      expect(followed).toBe(false);
      checked = AuthStatus.LoggedOut;
      terminals.endCommand(0, 0);
      await signingOut;
      await again;

      expect([context.count(MethodName.ProviderCheck), terminals.closes, store.terminalSignOuts().size]).toEqual([1, [0], 0]);
      expect(store.providers().find(t => t.id === "p1")?.authStatus).toBe(AuthStatus.LoggedOut);
      expect([context.count(MethodName.ProviderSignOut), context.shownNotices()]).toEqual([0, []]);
    });

    it("asks for PowerShell or Command Prompt for a sign-out's terminal on Windows", async () => {
      const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
      onTestFinished(() => platform.mockRestore());
      await store.initialize();

      const signingOut = store.signOutInTerminal("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      checked = AuthStatus.LoggedOut;
      terminals.endCommand(0, 0);
      await signingOut;

      expect(terminals.launches.map(t => [t.request.command, t.request.shellKinds])).toEqual([["copilot", [TerminalShellKind.PowerShell,
        TerminalShellKind.CommandPrompt]]]);
    });

    it("opens a new terminal in place of one whose tool ended still signed in when the provider is signed out again", async () => {
      await store.initialize();

      const first = store.signOutInTerminal("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      terminals.endCommand(0, 0);
      await Wait.until(() => expect(store.terminalSignOuts().size).toBe(0));
      const second = store.signOutInTerminal("p1");
      await first;
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      checked = AuthStatus.LoggedOut;
      terminals.endCommand(1, 0);
      await second;

      expect([terminals.closes, store.terminalSignOuts().size]).toEqual([[0, 1], 0]);
      expect(store.providers().find(t => t.id === "p1")?.authStatus).toBe(AuthStatus.LoggedOut);
    });

    it("leaves the terminal open when the tool ends still signed in, checks again when it closes, and opens none for a provider TeamRun signs out or doesn't list",
      async () => {
        await store.initialize();

        const signingOut = store.signOutInTerminal("p1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        terminals.endCommand(0, 0);
        await Wait.until(() => expect(store.terminalSignOuts().size).toBe(0));

        expect([context.count(MethodName.ProviderCheck), terminals.closes]).toEqual([1, []]);
        checked = AuthStatus.LoggedOut;
        terminals.end(0);
        await signingOut;
        await store.signOutInTerminal("g1");
        await store.signOutInTerminal("gone");

        expect([context.count(MethodName.ProviderCheck), terminals.launches.length, terminals.closes]).toEqual([2, 1, []]);
        expect(store.providers().find(t => t.id === "p1")?.authStatus).toBe(AuthStatus.LoggedOut);
      });

    it("runs a kind's own sign-out command, closing it and checking again once it ends without an error, whatever the check finds, leaving it open on an error, " +
      "and can't tell when the terminal closes without an exit code",
      async () => {
        const opencode = new ProviderKind("opencode", "OpenCode", true, false, null,
          new ProviderProfile("XDG_DATA_HOME", "opencode auth login", null, null, { XDG_CONFIG_HOME: "config" }, { OPENCODE_CONFIG: "" }), false,
          "opencode auth logout", true);
        const work = "/home/person/profiles/opencode/Work";
        const free = new Provider("o1", "opencode", "Work", work, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
        context.answer(MethodName.ProviderKindList, () => [opencode.toJson()]);
        context.answer(MethodName.ProviderList, () => [free.toJson()]);
        context.answer(MethodName.ProviderCheck, () => free.toJson());
        await store.initialize();

        const failing = store.signOutInTerminal("o1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(1));
        terminals.endCommand(0, 1);
        await Wait.until(() => expect(store.terminalSignOuts().size).toBe(0));

        expect([context.count(MethodName.ProviderCheck), terminals.closes]).toEqual([0, []]);
        terminals.end(0);
        const failed = await failing;
        const signingOut = store.signOutInTerminal("o1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(2));
        terminals.endCommand(1, 0);
        const signedOut = await signingOut;
        const closing = store.signOutInTerminal("o1");
        await Wait.until(() => expect(terminals.launches).toHaveLength(3));
        terminals.end(2);
        const untold = await closing;

        const launch = [work, { XDG_DATA_HOME: work, XDG_CONFIG_HOME: `${work}/config`, OPENCODE_CONFIG: "" }, Resources.terminalSignOutCommandNotice,
          "opencode auth logout"];
        expect(terminals.launches.map(t => [t.request.folder, t.request.environment, t.request.notice, t.request.command])).toEqual([launch, launch, launch]);
        expect([failed, signedOut, untold, terminals.closes, context.count(MethodName.ProviderCheck), store.terminalSignOuts().size])
          .toEqual([false, true, null, [1], 3, 0]);
        expect(store.providers().find(t => t.id === "o1")?.authStatus).toBe(AuthStatus.LoggedIn);
      });

    it("closes a sign-out's terminal without a check when it's stopped or its provider is disabled or removed", async () => {
      context.answer(MethodName.ProviderDelete, () => null);
      context.answer(MethodName.ProviderSetEnabled, t => pilot(AuthStatus.LoggedIn).withEnabled(ProviderEnabledParams.fromJson(t).enabled).toJson());
      await store.initialize();

      const stopped = store.signOutInTerminal("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(1));
      await store.stopTerminalSignOut("p1");
      await stopped;
      const disabled = store.signOutInTerminal("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(2));
      await store.setProviderEnabled("p1", false);
      await disabled;
      await store.setProviderEnabled("p1", true);
      const removed = store.signOutInTerminal("p1");
      await Wait.until(() => expect(terminals.launches).toHaveLength(3));
      await store.removeProvider("p1");
      await removed;

      expect([terminals.closes, store.terminalSignOuts().size, context.count(MethodName.ProviderCheck), context.shownNotices()]).toEqual([[0, 1, 2], 0, 0, []]);
    });
  });

  it("opens a sign-in's page only in the window signing it in, again on request, and shows a refused one in the error line", async () => {
    const signIn = new DeferredResponse();
    const url = "https://auth.example.com/oauth/authorize?state=1";
    context.answer(MethodName.ProviderSignIn, () => signIn.promise);
    await store.initialize();

    context.emit(EventName.SignInLink, new SignInLinkPayload("a1", url).toJson());
    const signing = store.signInProvider("a1");
    context.emit(EventName.SignInLink, new SignInLinkPayload("a1", url).toJson());

    expect(context.links).toEqual([url]);
    expect(store.signInLinks().get("a1")).toBe(url);
    await store.openSignInLink("a1");
    await store.openSignInLink("a9");
    expect(context.links).toEqual([url, url]);
    context.linkFailure = "The link was refused.";
    await store.openSignInLink("a1");
    expect(context.noticeText()).toBe("The link was refused.");

    signIn.resolve(SampleData.provider.toJson());
    await signing;
    expect(store.signInLinks().size).toBe(0);
  });

  it("opens a sign-in's page in the system's browser, the one it opens itself and the one opened again, while the in-app browser takes every other link", async () => {
    const signIn = new DeferredResponse();
    const url = "https://auth.example.com/oauth/authorize?state=1";
    context.answer(MethodName.ProviderSignIn, () => signIn.promise);
    const browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
    context.registerInAppBrowser(browser);
    await store.initialize();
    const placed = (): LinkPlace[] => context.linkPlaces.map(t => t ?? browser.placeFor());

    const signing = store.signInProvider("a1");
    context.emit(EventName.SignInLink, new SignInLinkPayload("a1", url).toJson());
    await store.openSignInLink("a1", LinkGesture.Modified);
    await store.openPage("https://example.com/droid", LinkGesture.Plain);

    expect([context.links, placed()]).toEqual([[url, url, "https://example.com/droid"], [LinkPlace.System, LinkPlace.System, LinkPlace.InApp]]);
    signIn.resolve(SampleData.provider.toJson());
    await signing;
  });

  it("reads each provider's installation with the catalog, follows its changes, and counts a provider TeamRun doesn't install as installed", async () => {
    context.answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled).toJson()]);
    await store.initialize();

    expect(store.installations().get("antigravity")?.state).toBe(ProviderKindInstallState.NotInstalled);
    expect([store.isInstalled("antigravity"), store.isInstalled("codex")]).toEqual([false, true]);
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installing, null, 420, 1000).toJson());
    expect(store.installations().get("antigravity")?.received).toBe(420);
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installed).toJson());
    expect(store.isInstalled("antigravity")).toBe(true);
  });

  it("lets an installations read's failure other than the runtime's or the answer's propagate", async () => {
    await store.initialize();
    const broken = new Error("broken");
    context.answer(MethodName.ProviderKindInstallationList, () => {
      throw broken;
    });

    await expect(store.refreshInstallations()).rejects.toBe(broken);
  });

  it("lists the installations again on request and keeps the ones it has when that fails", async () => {
    let listed = 0;
    context.answer(MethodName.ProviderKindInstallationList, () =>
      [new ProviderKindInstallation("antigravity", listed++ === 0 ? ProviderKindInstallState.NotInstalled : ProviderKindInstallState.Installed).toJson()]);
    await store.initialize();
    await store.refreshInstallations();

    expect(store.installations().get("antigravity")?.state).toBe(ProviderKindInstallState.Installed);
    context.disconnect(MethodName.ProviderKindInstallationList, "The service stopped.");
    await store.refreshInstallations();
    expect(store.installations().get("antigravity")?.state).toBe(ProviderKindInstallState.Installed);
  });

  it("installs a provider once while it installs, cancels it, and shows a failed install in the error line", async () => {
    const install = new DeferredResponse();
    context.answer(MethodName.ProviderKindInstallationList, () => [new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled).toJson()]);
    context.answer(MethodName.ProviderKindInstall, () => install.promise);
    context.answer(MethodName.ProviderKindInstallCancel, () => {
      install.resolve(new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled).toJson());
      return null;
    });
    await store.initialize();

    const installing = store.installKind("antigravity");
    context.emit(EventName.ProviderKindInstallationChanged, new ProviderKindInstallation("antigravity", ProviderKindInstallState.Installing).toJson());
    await store.installKind("antigravity");
    expect(context.count(MethodName.ProviderKindInstall)).toBe(1);
    expect(context.parametersOf(MethodName.ProviderKindInstall)).toEqual({ kind: "antigravity" });
    await store.cancelInstall("antigravity");
    await installing;

    expect(context.parametersOf(MethodName.ProviderKindInstallCancel)).toEqual({ kind: "antigravity" });
    expect(store.installations().get("antigravity")?.state).toBe(ProviderKindInstallState.NotInstalled);
    expect(context.noticeText()).toBeNull();
    context.fail(MethodName.ProviderKindInstall, "Installing Antigravity needs unzip, which this computer does not have.");
    await store.installKind("antigravity");
    expect(context.noticeText()).toBe("Installing Antigravity needs unzip, which this computer does not have.");
    context.fail(MethodName.ProviderKindInstallCancel, "The runtime part stopped.");
    await store.cancelInstall("antigravity");
    expect(context.noticeText()).toBe("The runtime part stopped.");
  });

  it("disables and enables a provider, greys its teammates with the provider disabled after their names, and keeps it out of the pickers", async () => {
    new TeammateFixture(context);
    context.answer(MethodName.ProviderSetEnabled, t => SampleData.provider.withEnabled(ProviderEnabledParams.fromJson(t).enabled).toJson());
    await store.initialize();
    const alice = Required.of(store.teammate("alice"));
    expect(store.isTeammateProviderDisabled("alice")).toBe(false);
    expect(store.listedName(alice)).toBe("Alice");

    await store.setProviderEnabled("a1", false);

    expect(context.parametersOf(MethodName.ProviderSetEnabled)).toEqual({ providerId: "a1", enabled: false });
    expect(store.providers().map(t => [t.id, t.enabled])).toEqual([["a1", false]]);
    expect(store.enabledProviders()).toEqual([]);
    expect(store.isTeammateUnavailable("alice")).toBe(true);
    expect(store.isTeammateProviderDisabled("alice")).toBe(true);
    expect(store.isTeammateProviderDisabled("offline")).toBe(false);
    expect(store.listedName(alice)).toBe("Alice (provider disabled)");
    expect(store.disabledMarkedName(alice)).toBe("Alice (provider disabled)");
    expect([store.listedName(Required.of(store.teammate("offline"))), store.disabledMarkedName(Required.of(store.teammate("offline")))]).toEqual([Resources.formatUnavailable("Offline"), "Offline"]);

    await store.setProviderEnabled("a1", true);

    expect(store.isTeammateUnavailable("alice")).toBe(false);
    expect(store.listedName(alice)).toBe("Alice");
    expect(store.enabledProviders().map(t => t.id)).toEqual(["a1"]);
    context.fail(MethodName.ProviderSetEnabled, "The runtime part stopped.");
    await store.setProviderEnabled("a1", false);
    expect(context.noticeText()).toBe("The runtime part stopped.");
    expect(store.enabledProviders().map(t => t.id)).toEqual(["a1"]);
  });

  it("manages providers and lists models", async () => {
    context.answer(MethodName.ProviderCreate, () => new Provider("a2", "claude", "Home", "D:\\h", AuthStatus.Unknown, null, null, null, null,
      SampleData.timestamp).toJson());
    context.answer(MethodName.ProviderCheck, () => new Provider("a2", "claude", "Home", "D:\\h", AuthStatus.LoggedIn, null, "2.0",
      SampleData.timestamp, null, SampleData.timestamp).toJson());
    context.answer(MethodName.ProviderUpdate, () => new Provider("a2", "claude", "Office", "D:\\o", AuthStatus.Unknown, null, null, null, null,
      SampleData.timestamp).toJson());
    context.answer(MethodName.ProviderDelete, () => null);
    await store.initialize();

    expect(await store.addProvider("claude", "Home", "D:\\h")).toBe(true);
    expect(store.providers().map(t => t.id)).toEqual(["a2", "a1"]);
    await store.checkProvider("a2");
    expect(store.providers()[0]?.authStatus).toBe(AuthStatus.LoggedIn);
    expect(await store.updateProvider("a2", "Office", "D:\\o")).toBe(true);
    expect(context.parametersOf(MethodName.ProviderUpdate)).toEqual({ providerId: "a2", label: "Office", profileDir: "D:\\o" });
    expect(await store.updateProvider("a2", "Office", "D:\\o", "D:\\agy\\agy_acp_server.exe")).toBe(true);
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderUpdate)).at(-1)?.parameters)
      .toEqual({ providerId: "a2", label: "Office", profileDir: "D:\\o", binaryPath: "D:\\agy\\agy_acp_server.exe" });
    expect(store.providers().map(t => [t.id, t.label, t.authStatus])).toEqual([["a2", "Office", AuthStatus.Unknown], ["a1", "Work", AuthStatus.LoggedIn]]);
    const office = Required.of(store.providers().find(t => t.id === "a2"));
    context.answer(MethodName.ProviderUpdate, t => office.withOwnMcpServers(Required.of(ProviderUpdateParams.fromJson(t).ownMcpServers)).toJson());
    expect(await store.switchOwnMcpServers(office, true, () => undefined)).toBe(true);
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderUpdate)).at(-1)?.parameters)
      .toEqual({ providerId: "a2", label: "Office", profileDir: "D:\\o", ownMcpServers: true });
    expect(store.providers().map(t => [t.id, t.ownMcpServers])).toEqual([["a2", true], ["a1", false]]);
    context.answer(MethodName.ProviderOwnMcpServerList, t => new ProviderMcpServerList(ProviderIdParams.fromJson(t).providerId, [new OwnMcpServer("node_repl", OwnMcpServerState.Enabled),
      new OwnMcpServer("docs", OwnMcpServerState.Disabled)]).toJson());
    expect((await store.listOwnMcpServers("a2"))?.map(t => t.toJson())).toEqual([{ name: "node_repl", state: "Enabled" }, { name: "docs", state: "Disabled" }]);
    context.answer(MethodName.ProviderOwnMcpServerList, t => new ProviderMcpServerList(ProviderIdParams.fromJson(t).providerId, null).toJson());
    expect(await store.listOwnMcpServers("a2")).toBeNull();
    expect(context.parametersOf(MethodName.ProviderOwnMcpServerList)).toEqual({ providerId: "a2" });
    await store.removeProvider("a2");
    expect(store.providers().map(t => t.id)).toEqual(["a1"]);

    const list = await store.listModels("codex", null);
    expect(list.models.map(t => t.id)).toEqual(["gpt-5", "gpt-5-mini"]);
    expect(list.signedIn).toBe(true);
    expect(context.parametersOf(MethodName.ProviderModelCatalog)).toEqual({ kind: "codex", providerId: null, refresh: false });
    await store.modelCatalogs.load("codex", "a1", true);
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ProviderModelCatalog)).at(-1)?.parameters)
      .toEqual({ kind: "codex", providerId: "a1", refresh: true });
    context.answer(MethodName.ProviderModelCatalog, () => [1]);
    await expect(store.listModels("codex", null)).rejects.toThrow();
    context.answer(MethodName.ProviderModelCatalog, () => null);
    await expect(store.listModels("codex", null)).rejects.toThrow("Models could not be refreshed. Previously loaded choices are kept.");
    context.answer(MethodName.ProviderModelCatalog, () => "models");
    await expect(store.listModels("codex", null)).rejects.toBeInstanceOf(ModelCatalogUnavailableException);
    await expect(store.listModels("codex", "p1")).rejects.toMatchObject({ kind: "codex", providerId: "p1" });
  });

  it("reads the send key from its setting, follows its changes, and sends on Enter for a value it doesn't know", async () => {
    expect(store.sendKey()).toBe(SendKey.Enter);
    context.changeSetting(Resources.sendKeySetting, SendKey.ModEnter);
    await store.initialize();
    expect(store.sendKey()).toBe(SendKey.ModEnter);

    context.changeSetting(Resources.sendKeySetting, "Unknown");
    expect(store.sendKey()).toBe(SendKey.Enter);
    context.changeSetting(Resources.sendKeySetting, SendKey.ModEnter);
    expect(store.sendKey()).toBe(SendKey.ModEnter);
  });

  it("reads what Enter does while a reply runs from its setting, follows its changes, and steers for a value it doesn't know", async () => {
    expect(store.whileReplying()).toBe(MessageDelivery.Steer);
    context.changeSetting(Resources.whileReplyingSetting, MessageDelivery.Queue);
    await store.initialize();
    expect(store.whileReplying()).toBe(MessageDelivery.Queue);

    context.changeSetting(Resources.whileReplyingSetting, "Unknown");
    expect(store.whileReplying()).toBe(MessageDelivery.Steer);
    context.changeSetting(Resources.whileReplyingSetting, MessageDelivery.StopAndSend);
    expect(store.whileReplying()).toBe(MessageDelivery.StopAndSend);
  });

  describe("a chat's waiting messages", () => {
    const waiting = (id: string, text: string, delivery: MessageDelivery = MessageDelivery.Queue): WaitingMessage =>
      new WaitingMessage(id, delivery, new MessageSendParams("c1", text, settings.toRequested(), settings.providerId), SampleData.timestamp);
    const listed = (...messages: readonly WaitingMessage[]): JsonValue => new WaitingMessagesPayload("c1", messages).toJson();
    const lastOf = (method: MethodName): JsonValue | undefined => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(method)).at(-1)?.parameters;

    it("lists them when the chat opens, follows their changes, and lists them again on a resync", async () => {
      context.answer(MethodName.WaitingMessageList, t => ChatIdParams.fromJson(t).chatId === "c1" ? listed(waiting("w1", "First")) : new WaitingMessagesPayload("c2", []).toJson());
      await store.initialize();
      expect(store.waitingOf("c1")).toEqual([]);
      expect(store.waitingOf(null)).toEqual([]);
      await store.selectConversation("c1");
      expect(store.waitingOf("c1").map(t => t.message.text)).toEqual(["First"]);

      context.emit(EventName.WaitingMessagesChanged, listed(waiting("w1", "First"), waiting("w2", "Second", MessageDelivery.Steer)));
      expect(store.waitingOf("c1").map(t => `${t.message.text}:${t.delivery}`)).toEqual(["First:Queue", "Second:Steer"]);
      context.emit(EventName.WaitingMessagesChanged, new WaitingMessagesPayload("c2", [new WaitingMessage("w9", MessageDelivery.Queue,
        new MessageSendParams("c2", "Elsewhere", SampleData.provenance.requested, "a1"), SampleData.timestamp)]).toJson());
      expect(store.waitingOf("c2").map(t => t.message.text)).toEqual(["Elsewhere"]);
      expect(store.waitingOf("c1")).toHaveLength(2);

      await Wait.until(() => expect(store.isBusy()).toBe(false));
      context.answer(MethodName.WaitingMessageList, () => listed());
      const lists = context.count(MethodName.WaitingMessageList);
      context.emit(EventName.StateResyncRequested, null);
      await Wait.until(() => expect(store.waitingOf("c1")).toEqual([]));
      expect(context.count(MethodName.WaitingMessageList)).toBe(lists + 1);
    });

    it("keeps the list a change gives while the chat's read is pending over the older list the read answers", async () => {
      const read = new DeferredResponse();
      await store.initialize();
      const lists = context.count(MethodName.WaitingMessageList);
      context.answer(MethodName.WaitingMessageList, () => read.promise);
      const opening = store.selectConversation("c1");
      await Wait.until(() => expect(context.count(MethodName.WaitingMessageList)).toBe(lists + 1));

      context.emit(EventName.WaitingMessagesChanged, listed());
      read.resolve(listed(waiting("w1", "First")));
      await opening;

      expect(store.waitingOf("c1")).toEqual([]);
    });

    it("adds one with the send it would make and how it goes, says why when it can't, and clears that once one is added", async () => {
      context.answer(MethodName.WaitingMessageAdd, t => waiting("w1", WaitingMessageAddParams.fromJson(t).message.text).toJson());
      await store.initialize();
      await store.selectConversation("c1");

      expect(await store.addWaiting("Look again", settings, "c1", MessageDelivery.Steer)).toBe(true);
      const added = WaitingMessageAddParams.fromJson(context.parametersOf(MethodName.WaitingMessageAdd));
      expect([added.delivery, added.message.chatId, added.message.text, added.message.providerId]).toEqual([MessageDelivery.Steer, "c1", "Look again", settings.providerId]);
      expect(await store.addWaiting("@Bob too", settings, "c1", MessageDelivery.Queue, [], ["bob"])).toBe(true);
      expect(lastOf(MethodName.WaitingMessageAdd)).toMatchObject({ delivery: MessageDelivery.Queue, message: { requested: null, providerId: null, mentionedTeammateIds: ["bob"] } });

      context.fail(MethodName.WaitingMessageAdd, "The chat is gone.");
      expect(await store.addWaiting("Lost", settings, "c1", MessageDelivery.Queue)).toBe(false);
      expect(context.noticeText()).toContain("The chat is gone.");
      expect(context.shownNotices(Resources.messageNotSentNotice).map(t => t.key)).toEqual(["c1"]);

      context.answer(MethodName.WaitingMessageAdd, t => waiting("w2", WaitingMessageAddParams.fromJson(t).message.text).toJson());
      expect(await store.addWaiting("Found", settings, "c1", MessageDelivery.Queue)).toBe(true);
      expect(context.shownNotices(Resources.messageNotSentNotice)).toEqual([]);
    });

    it("edits, removes and sends one now, keeping its send's settings, and names the action that failed", async () => {
      const kept = new WaitingMessage("w1", MessageDelivery.Queue,
        new MessageSendParams("c1", "First", settings.toRequested(), settings.providerId, [], ["alice"], "alice"), SampleData.timestamp);
      context.answer(MethodName.WaitingMessageEdit, () => null).answer(MethodName.WaitingMessageRemove, () => null).answer(MethodName.WaitingMessageSendNow, () => null);
      await store.initialize();
      await store.selectConversation("c1");

      expect(await store.editWaiting(kept, "Changed", [], ["bob"])).toBe(true);
      const edited = WaitingMessageEditParams.fromJson(context.parametersOf(MethodName.WaitingMessageEdit));
      expect([edited.id, edited.message.text, edited.message.providerId, edited.message.responderTeammateId, ...edited.message.mentionedTeammateIds])
        .toEqual(["w1", "Changed", settings.providerId, "alice", "bob"]);
      expect(await store.removeWaiting(kept)).toBe(true);
      expect(WaitingMessageIdParams.fromJson(context.parametersOf(MethodName.WaitingMessageRemove)).id).toBe("w1");
      expect(await store.sendWaitingNow(kept)).toBe(true);
      expect(WaitingMessageIdParams.fromJson(context.parametersOf(MethodName.WaitingMessageSendNow)).id).toBe("w1");

      const failed = async (method: MethodName, act: () => Promise<boolean>): Promise<string> => {
        context.fail(method, "It already went.");
        const done = await act();
        return `${done}|${context.shownNotices(Resources.chatActionFailedNotice).at(-1)?.title}|${context.noticeText()}`;
      };
      expect([
        await failed(MethodName.WaitingMessageEdit, () => store.editWaiting(kept, "Again", [], [])),
        await failed(MethodName.WaitingMessageRemove, () => store.removeWaiting(kept)),
        await failed(MethodName.WaitingMessageSendNow, () => store.sendWaitingNow(kept))
      ]).toEqual([ChatAction.EditWaiting, ChatAction.RemoveWaiting, ChatAction.SendWaitingNow].map(t => `false|${Resources.chatActionTitles[t]}|It already went.`));
    });
  });

  it("takes a cancel refused because the reply already ended as done, and records any other failure", async () => {
    await store.initialize();
    context.refuse(MethodName.MessageCancel, ErrorCode.Conflict, "Message m2 is not open.", "m2");
    await expect(store.cancel("m2")).resolves.toBe(true);
    expect(context.noticeText()).toBeNull();

    context.refuse(MethodName.MessageCancel, ErrorCode.NotFound, "Message m2 was not found.");
    await expect(store.cancel("m2")).resolves.toBe(false);
    expect(context.noticeText()).toBe("Message m2 was not found.");
    context.answer(MethodName.MessageCancel, () => Promise.reject("offline"));
    await expect(store.cancel("m2")).resolves.toBe(false);
    expect(context.noticeText()).toBe("offline");
  });

  it("loads model catalogs through the runtime part", async () => {
    expect((await store.modelCatalogs.load("codex", null)).models.map(t => t.id)).toEqual(["gpt-5", "gpt-5-mini"]);
  });

  it("lets a discard's failure other than the runtime's propagate", async () => {
    const broken = new Error("broken");
    context.answer(MethodName.AttachmentDiscard, () => {
      throw broken;
    });

    await expect(store.discardAttachment(new MessageAttachment("lost.txt", "text/plain", 0, "D:/lost.txt"))).rejects.toBe(broken);
  });

  it("reads GitHub as signed out when the runtime can't say or its answer has no state, and lets any other failure propagate", async () => {
    context.answerModule(Resources.gitHubReadSignInMethod, () => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "No GitHub.")));
    expect(await store.readGitHubSignedIn()).toBe(false);
    const answers: JsonValue[] = [null, { [Resources.gitHubStateField]: "" }, { [Resources.gitHubStateField]: null }, { [Resources.gitHubStateField]: 3 }];
    const signedIn: boolean[] = [];
    for (const answer of answers) {
      context.answerModule(Resources.gitHubReadSignInMethod, () => answer);
      signedIn.push(await store.readGitHubSignedIn());
    }
    expect(signedIn).toEqual([false, false, false, false]);
    const broken = new Error("broken");
    context.answerModule(Resources.gitHubReadSignInMethod, () => {
      throw broken;
    });

    await expect(store.readGitHubSignedIn()).rejects.toBe(broken);
  });

  it("reports a saved shared MCP secret's removal failure other than the runtime's in place of the refusal", async () => {
    context.fail(MethodName.SharedMcpSecretSet, "The server doesn't name KEY.");
    const broken = new Error("broken");
    vi.spyOn(context.secrets, "removeAsync").mockRejectedValue(broken);
    const reported: string[] = [];

    expect(await store.saveSharedMcpSecret("docs", "KEY", "one", t => reported.push(t))).toBe(false);

    expect(reported).toEqual(["broken"]);
  });

  it("prepares and discards attachments through the runtime part", async () => {
    const prepared = await store.prepareAttachment(new AttachmentInput("notes.txt", "text/plain", "AA==", null));
    expect(prepared.path).toBe("D:/data/attachments/drafts/notes.txt");
    await store.discardAttachment(prepared);
    expect(context.parametersOf(MethodName.AttachmentDiscard)).toEqual(prepared.toJson());
    context.disconnect(MethodName.AttachmentDiscard, "gone");
    await expect(store.discardAttachment(new MessageAttachment("lost.txt", "text/plain", 0, "D:/lost.txt"))).resolves.toBeUndefined();
    expect(context.noticeText()).toBeNull();
  });

  it("grants a file the person chose through the window part, and discards the grant of a file whose preparation fails", async () => {
    const file = new File(["a"], "report.pdf", { type: "application/pdf" });

    const grant = await store.grantFile(file);
    context.fail(MethodName.AttachmentPrepare, "prepare failed");
    await expect(store.prepareAttachment(new AttachmentInput("notes.txt", "text/plain", "AA==", null))).rejects.toThrow("prepare failed");
    await expect(store.prepareAttachment(new AttachmentInput("report.pdf", "application/pdf", null, null, grant))).rejects.toThrow("prepare failed");
    context.refusesGrants = true;

    await expect(store.grantFile(file)).rejects.toThrow(Resources.attachmentReadFailed);
    await expect(store.grantFile(file)).rejects.toBeInstanceOf(FileGrantException);
    await expect(store.grantFile(file)).rejects.toMatchObject({ fileName: file.name });
    expect(grant).toBe("grant-1");
    expect(context.grantedFiles).toEqual([file]);
    expect(context.discardedGrants).toEqual(["grant-1"]);
  });

  it("reads a conversation's attachment back through the runtime part", async () => {
    const path = "D:/data/attachments/drafts/c1/picture.png";
    context.answer(MethodName.AttachmentRead, () => new AttachmentContent("picture.png", "image/png", 5, "aW1hZ2U=").toJson());

    const content = await store.readAttachment("c1", path);

    expect(content.data).toBe("aW1hZ2U=");
    expect(content.mediaType).toBe("image/png");
    expect(context.parametersOf(MethodName.AttachmentRead)).toEqual(new AttachmentReadParams("c1", path).toJson());
  });

  it("shares a conversation's attachment through the runtime part, gives its address, and discards the grant once it is released", async () => {
    const path = "D:/data/attachments/drafts/c1/picture.png";
    const grant = "0123456789abcdef0123456789abcdef";
    context.answer(MethodName.AttachmentShare, () => ({ grant }));

    const share = await store.shareAttachment("c1", path);

    expect([share.address, context.discardedGrants]).toEqual([`desktop-file://${grant}/`, []]);
    expect(context.parametersOf(MethodName.AttachmentShare)).toEqual(new AttachmentReadParams("c1", path).toJson());
    share.release();
    share.release();
    expect(context.discardedGrants).toEqual([grant]);
  });

  it("rejects with the runtime part's refusal of a share", async () => {
    context.refuse(MethodName.AttachmentShare, ErrorCode.NotFound, "The attachment's file is gone or changed since it was saved.");

    await expect(store.shareAttachment("c1", "D:/data/attachments/drafts/c1/gone.png")).rejects.toThrow("The attachment's file is gone or changed since it was saved.");
    expect(context.discardedGrants).toEqual([]);
  });

  it("shares an image a reply wrote in its project with the page by a grant, discards it once, and rejects with a refusal", async () => {
    const grant = "b".repeat(32);
    context.answer(MethodName.WrittenImageShare, () => ({ grant }));

    const share = await store.shareWrittenImage("c1", "m4", "D:/work/app/chart.png");

    expect(share.address).toBe(`desktop-file://${grant}/`);
    expect(context.parametersOf(MethodName.WrittenImageShare)).toEqual(new WrittenImageReadParams("c1", "m4", "D:/work/app/chart.png").toJson());
    share.release();
    share.release();
    expect(context.discardedGrants).toEqual([grant]);
    context.refuse(MethodName.WrittenImageShare, ErrorCode.NotFound, "Only a PNG, JPEG, GIF or WebP image is shared by address, so this one is read instead.");
    await expect(store.shareWrittenImage("c1", "m4", "D:/work/app/diagram.svg")).rejects.toThrow("Only a PNG, JPEG, GIF or WebP image is shared by address");
  });

  it("reads an image a reply wrote in its project through the runtime part", async () => {
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 5, "aW1hZ2U=").toJson());

    const content = await store.readWrittenImage("c1", "m4", "D:/work/app/chart.png");

    expect([content.name, content.mediaType, content.data]).toEqual(["chart.png", "image/png", "aW1hZ2U="]);
    expect(context.parametersOf(MethodName.WrittenImageRead)).toEqual(new WrittenImageReadParams("c1", "m4", "D:/work/app/chart.png").toJson());
  });

  it("holds the whole conversation as its history, grows it with each new message, and points at a search hit's message", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");

    expect(store.history()?.length()).toBe(5);
    expect(ids()).toEqual(["m3", "m4"]);
    store.rememberPosition("c1", new ReadingPosition("m1", 1, 0));
    const late = new Message("m9", "c1", 9, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.emit(EventName.MessageCreated, late.toJson());
    expect(store.history()?.length()).toBe(10);
    expect(ids().at(-1)).toBe("m9");

    const pages = context.count(MethodName.MessagePage);
    await store.showMessage(new ConversationSearchHit("c1", "p1", "Chat", "m1", "t1", SampleData.timestamp, 1));
    expect(store.focus()).toEqual(new MessageFocus("c1", "m1", 1));
    await store.showMessage(new ConversationSearchHit("c1", "p1", "Chat", null, "Chat", SampleData.timestamp));
    await store.showMessage(new ConversationSearchHit("c1", "p1", "Chat", "m2", "t2", SampleData.timestamp));
    await store.showMessage(new ConversationSearchHit("c9", "p1", "Gone", "m5", "t5", SampleData.timestamp, 0));
    expect(store.focus()).toEqual(new MessageFocus("c1", "m1", 1));
    expect(context.count(MethodName.MessagePage)).toBe(pages);
  });

  it("adds what it sends after the last row, reading nothing", async () => {
    const sent = new Message("m5", "c1", 5, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    context.answer(MethodName.MessageSend, () => new MessageSendResult(sent, []).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const pages = context.count(MethodName.MessagePage);

    expect(await store.send("hello", new ComposerSettings("codex", "gpt-5", "high", "a1"))).toBe(true);

    expect(store.history()?.length()).toBe(6);
    expect(ids().at(-1)).toBe("m5");
    expect(context.count(MethodName.MessagePage)).toBe(pages);
  });

  it("keeps message controls only while they hold changes", async () => {
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    await store.history()?.readAsync(0, 3);

    const controls = new MessageControlState();
    controls.wrappingFor(0).add(1);
    store.rememberMessageControls("m1", controls);
    expect(store.messageIndex().find(t => t.id === "m1")?.controls).toBe(controls);
    store.rememberMessageControls("m1", new MessageControlState());
    expect(store.messageIndex().find(t => t.id === "m1")?.controls).toBeNull();
    store.rememberMessageControls("unknown", controls);

    store.forgetPosition("c1");
    store.rememberMessageControls("m1", controls);
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 10).toJson());
    expect(store.messageIndex()).toEqual([]);
    context.emit(EventName.MessageCreated, new Message("late", "c1", 5, MessageAuthor.User, null, MessageStatus.Completed, [], null,
      SampleData.timestamp, null, SampleData.timestamp).toJson());
    expect(ids()).toEqual(["m0", "m1", "m2", "m3", "m4", "late"]);
    expect(store.messageIndex()).toEqual([]);
    store.deselectConversation();
    store.rememberMessageControls("m1", controls);
    expect(store.messageIndex()).toEqual([]);
  });

  it("does not load the whole history when selecting a conversation", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    expect(context.count(MethodName.MessageList)).toBe(0);
    context.emit(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(8, DetailKind.Text, "done")).toJson());
    expect(messages()[1]?.details.some(t => t.text === "done")).toBe(true);
  });

  describe("reading positions across a restart", () => {
    let stored: Map<string, ConversationPosition>;
    const saves = (on: FakeWindowPartContext = context): ReadingPositionSaveParams[] => on.requests
      .filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ReadingPositionSave)).map(t => ReadingPositionSaveParams.fromJson(t.parameters));
    const keep = (on: FakeWindowPartContext): FakeWindowPartContext => on
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()])
      .answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson())
      .answer(MethodName.ReadingPositionList, () => [...stored.values()].map(t => t.toJson()))
      .answer(MethodName.ReadingPositionSave, t => {
        const params = ReadingPositionSaveParams.fromJson(t);
        for (const position of params.positions)
          stored.set(position.conversationId, position);
        for (const id of params.cleared)
          stored.delete(id);
        for (const position of params.dropped)
          if (stored.get(position.conversationId)?.messageId === position.messageId)
            stored.delete(position.conversationId);
        return null;
      });
    const restart = async (): Promise<void> => {
      store.dispose();
      store = new ChatStoreService(context);
      await store.initialize();
    };

    beforeEach(() => {
      stored = new Map();
      keep(context);
    });

    it("stores a chat left scrolled up, writes only what changed, and opens it there after a restart, while a chat at its end opens at its end", async () => {
      await store.initialize();
      store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
      store.rememberPosition("c2", new ReadingPosition("m4", 4, 0, true));
      await store.savePositions();
      await store.savePositions();

      expect(saves().map(t => JSON.stringify(t.toJson()))).toEqual([JSON.stringify(new ReadingPositionSaveParams([new ConversationPosition("c1", "m1", 1, 40)]).toJson())]);
      await restart();
      await store.selectConversation("c1");
      expect([store.pendingPosition()?.messageId, store.pendingPosition()?.distance, store.pendingPosition()?.isFollowing]).toEqual(["m1", 40, false]);
      expect(ids()).toContain("m1");
      await store.selectConversation("c2");
      expect(store.pendingPosition()).toBeNull();
    });

    it("clears the stored position of a chat brought back to its end, and drops one whose message is gone, which opens at its end", async () => {
      stored.set("c1", new ConversationPosition("c1", "m9", 9, 10));
      stored.set("c2", new ConversationPosition("c2", "x1", 0, 0));
      await store.initialize();
      await store.selectConversation("c1");
      expect(store.pendingPosition()).toBeNull();
      expect(ids().at(-1)).toBe("m4");
      store.rememberPosition("c2", new ReadingPosition("x2", 1, 0, true));

      await store.savePositions();
      expect(saves().map(t => [t.positions.length, t.cleared, t.dropped.map(u => `${u.conversationId}:${u.messageId}`)])).toEqual([[0, ["c2"], ["c1:m9"]]]);
      expect([...stored.keys()]).toEqual([]);
      await restart();
      await store.selectConversation("c1");
      expect(store.pendingPosition()).toBeNull();
    });

    it("writes the changed positions in the window's save step, as a close or a quit runs it", async () => {
      await store.initialize();
      store.rememberPosition("c1", new ReadingPosition("m2", 2, 8));

      for (const save of context.saves)
        await save();
      expect(stored.get("c1")?.messageId).toBe("m2");
      expect(saves()).toHaveLength(1);
    });

    it("keeps a position whose save failed for the next save, and starts with none when the list can't be read", async () => {
      await store.initialize();
      context.disconnect(MethodName.ReadingPositionSave, "offline");
      store.rememberPosition("c1", new ReadingPosition("m2", 2, 8));
      await store.savePositions();
      keep(context);
      await store.savePositions();
      expect(stored.get("c1")?.messageId).toBe("m2");

      context.disconnect(MethodName.ReadingPositionList, "offline");
      await restart();
      await store.selectConversation("c1");
      expect(store.pendingPosition()).toBeNull();
    });

    it("lets a position save's failure other than the runtime's propagate, keeping the position for the next save", async () => {
      await store.initialize();
      const broken = new Error("broken");
      context.answer(MethodName.ReadingPositionSave, () => {
        throw broken;
      });
      store.rememberPosition("c1", new ReadingPosition("m2", 2, 8));

      await expect(store.savePositions()).rejects.toBe(broken);

      keep(context);
      await store.savePositions();
      expect(stored.get("c1")?.messageId).toBe("m2");
    });

    it("shows the load's failure when the positions' list fails other than by the runtime or the answer", async () => {
      const broken = new Error("broken");
      context.answer(MethodName.ReadingPositionList, () => {
        throw broken;
      });

      await store.initialize();

      expect(context.shownNotices(Resources.loadFailedNotice).map(t => [t.title, t.text])).toEqual([[Resources.kindsNotLoaded, "broken"]]);
    });

    it("keeps a gone message's drop whose save failed for the next save, alongside a drop the window made meanwhile", async () => {
      stored.set("c1", new ConversationPosition("c1", "x8", 8, 0));
      stored.set("c2", new ConversationPosition("c2", "x9", 9, 0));
      let release: () => void = () => undefined;
      context.answer(MethodName.ReadingPositionSave, () => new Promise((_, reject) => {
        release = () => reject(new RuntimeRequestException(FailureCode.Disconnected, "offline"));
      }));
      await store.initialize();
      await store.selectConversation("c2");
      const failing = store.savePositions();
      await Wait.until(() => expect(saves()).toHaveLength(1));
      await store.selectConversation("c1");
      release();
      await failing;
      keep(context);
      await store.savePositions();

      expect(saves().map(t => t.dropped.map(u => `${u.conversationId}:${u.messageId}`).sort())).toEqual([["c2:x9"], ["c1:x8", "c2:x9"]]);
      expect(stored.size).toBe(0);
    });

    it("puts back after a failed write only the chats the window didn't forget or drop meanwhile, so no delete follows a rewind or a gone message", async () => {
      let release: () => void = () => undefined;
      context.answer(MethodName.ReadingPositionSave, () => new Promise((_, reject) => {
        release = () => reject(new RuntimeRequestException(FailureCode.Disconnected, "offline"));
      }));
      await store.initialize();
      store.rememberPosition("c1", new ReadingPosition("m3", 3, 5));
      store.rememberPosition("c2", new ReadingPosition("x9", 9, 0));
      const failing = store.savePositions();
      await Wait.until(() => expect(saves()).toHaveLength(1));
      context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 2).toJson());
      await store.selectConversation("c2");
      release();
      await failing;
      keep(context);
      await store.savePositions();

      expect(saves().map(t => [t.positions.map(u => u.conversationId), t.cleared, t.dropped.map(u => `${u.conversationId}:${u.messageId}`)]))
        .toEqual([[["c1", "c2"], [], []], [[], [], ["c2:x9"]]]);
    });

    it("lets the save step wait for a write already under way, and write again what that write couldn't", async () => {
      let release: (failed: boolean) => void = () => undefined;
      context.answer(MethodName.ReadingPositionSave, () => new Promise((resolve, reject) => {
        release = failed => failed ? reject(new RuntimeRequestException(FailureCode.Disconnected, "offline")) : resolve(null);
      }));
      await store.initialize();
      store.rememberPosition("c1", new ReadingPosition("m2", 2, 8));
      const timer = store.savePositions();
      let settled = false;
      const step = Promise.all([...context.saves].map(t => t())).then(() => {
        settled = true;
      });

      await Wait.until(() => expect(saves()).toHaveLength(1));
      await Promise.resolve();
      expect(settled).toBe(false);
      keep(context);
      release(true);
      await Promise.all([timer, step]);
      expect([settled, saves().length, stored.get("c1")?.messageId]).toEqual([true, 2, "m2"]);
    });

    it("keeps a newer position another window stored when this window sees a rewind or a gone message through an older row", async () => {
      stored.set("c1", new ConversationPosition("c1", "m3", 3, 0));
      stored.set("c2", new ConversationPosition("c2", "x9", 9, 0));
      const other = keep(SampleData.createContext());
      const otherStore = new ChatStoreService(other);
      await store.initialize();
      await otherStore.initialize();
      stored.delete("c1");
      for (const each of [context, other])
        each.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 2).toJson());
      store.rememberPosition("c1", new ReadingPosition("m1", 1, 5));
      store.rememberPosition("c2", new ReadingPosition("m2", 2, 0));
      await store.savePositions();
      await otherStore.selectConversation("c2");
      await otherStore.savePositions();
      otherStore.dispose();

      expect(saves(other).map(t => [t.cleared, t.dropped.map(u => `${u.conversationId}:${u.messageId}`)])).toEqual([[[], ["c2:x9"]]]);
      expect([...stored.values()].map(t => `${t.conversationId}:${t.messageId}`).sort()).toEqual(["c1:m1", "c2:m2"]);
    });

    it("keeps a place the window took before the stored ones arrived", async () => {
      stored.set("c1", new ConversationPosition("c1", "m1", 1, 0));
      store.rememberPosition("c1", new ReadingPosition("m2", 2, 12));
      await store.initialize();
      await store.selectConversation("c1");

      expect([store.pendingPosition()?.messageId, store.pendingPosition()?.distance]).toEqual(["m2", 12]);
    });

    it("lets the last window to write a chat's position win, each window writing only the chats it changed", async () => {
      const other = keep(SampleData.createContext());
      const otherStore = new ChatStoreService(other);
      await store.initialize();
      await otherStore.initialize();
      store.rememberPosition("c1", new ReadingPosition("m1", 1, 0));
      otherStore.rememberPosition("c2", new ReadingPosition("m3", 3, 0));
      await store.savePositions();
      otherStore.rememberPosition("c1", new ReadingPosition("m3", 3, 5));
      await otherStore.savePositions();
      otherStore.dispose();

      expect(saves().map(t => t.positions.map(u => u.conversationId))).toEqual([["c1"]]);
      expect(saves(other).map(t => t.positions.map(u => u.conversationId).sort())).toEqual([["c1", "c2"]]);
      await restart();
      await store.selectConversation("c1");
      expect([store.pendingPosition()?.messageId, store.pendingPosition()?.distance]).toEqual(["m3", 5]);
    });
  });

  it("remembers where the reader was in a conversation and brings the window back around it", async () => {
    context.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    context.answer(MethodName.MessagePage, t => pageOf(numbered, t).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    expect(ids()).toEqual(["m3", "m4"]);

    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(ids()).toEqual(["m0", "m1", "m2", "m3"]);
    expect(store.history()?.length()).toBe(5);
    expect(store.pendingPosition()?.messageId).toBe("m1");
    expect(store.pendingPosition()?.distance).toBe(40);
    store.consumePosition();
    expect(store.pendingPosition()).toBeNull();

    store.rememberPosition("c1", null);
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(ids()).toEqual(["m3", "m4"]);
    expect(store.pendingPosition()).toBeNull();
    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
    store.forgetPosition("c1");
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.pendingPosition()).toBeNull();

    store.rememberPosition("c1", new ReadingPosition("m3", 3, 0));
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.pendingPosition()?.messageId).toBe("m3");
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 3).toJson());
    expect(store.pendingPosition()).toBeNull();
    store.rememberPosition("c2", new ReadingPosition("x", 5, 0));
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c2", 1).toJson());
    const pages = context.count(MethodName.MessagePage);
    await store.selectConversation("c2");
    expect(context.count(MethodName.MessagePage)).toBe(pages + 1);
  });

  it("reads the default teammate with the catalog, keeps what each set answers, and reads it again when the catalog changes", async () => {
    const work = new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a1");
    let stored: DefaultTeammate | null = work;
    context.answer(MethodName.DefaultTeammateRead, () => stored?.toJson() ?? null);
    context.answer(MethodName.DefaultTeammateSet, t => DefaultTeammateSetParams.fromJson(t).defaultTeammate?.toJson() ?? null);
    await store.initialize();
    expect(store.defaultTeammate()?.toJson()).toEqual(work.toJson());

    expect(await store.setDefaultTeammate(null)).toBe(true);
    expect(store.defaultTeammate()).toBeNull();
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DefaultTeammateSet)).map(t => t.parameters))
      .toEqual([{ defaultTeammate: null }]);
    stored = new DefaultTeammate(new RequestedSettings("claude", null, null));
    context.emit(EventName.StateInvalidated, null);
    await Wait.until(() => expect(store.defaultTeammate()?.requested.kind).toBe("claude"));
  });

  it("clears the default teammate when its provider is removed, and keeps it while another provider goes", async () => {
    const home = new DefaultTeammate(new RequestedSettings("codex", "gpt-5", "high"), "a2");
    context.answer(MethodName.DefaultTeammateRead, () => home.toJson());
    context.answer(MethodName.ProviderDelete, () => null);
    await store.initialize();

    await store.removeProvider("a1");
    expect(store.defaultTeammate()?.toJson()).toEqual(home.toJson());
    await store.removeProvider("a2");
    expect(store.defaultTeammate()).toBeNull();
    await store.removeProvider("a3");
    expect(store.defaultTeammate()).toBeNull();
  });

  describe("added agents", () => {
    let reported: string[];
    const report = (message: string): void => {
      reported.push(message);
    };

    beforeEach(() => {
      reported = [];
    });

    it("reads their list, and reports one it can't read", async () => {
      context.answer(MethodName.AcpAgentList, () => new AcpAgentListing([new AcpAgentEntry("droid", "Droid", "1.1.0", "", null, null, false, false)], [], null, SampleData.timestamp).toJson());
      await store.initialize();

      expect((await store.listAcpAgents(report))?.agents.map(t => t.id)).toEqual(["droid"]);
      expect(reported).toEqual([]);

      context.fail(MethodName.AcpAgentList, "The list can't be read.");
      expect(await store.listAcpAgents(report)).toBeNull();
      expect(reported).toEqual(["The list can't be read."]);
    });

    it("has an icon only when the answer is text, and none when the read fails", async () => {
      await store.initialize();

      context.answer(MethodName.AcpAgentIcon, () => "data:image/png;base64,AA==");
      expect(await store.readAcpAgentIcon("droid")).toBe("data:image/png;base64,AA==");
      expect(AcpAgentIdParams.fromJson(context.parametersOf(MethodName.AcpAgentIcon)).id).toBe("droid");
      context.answer(MethodName.AcpAgentIcon, () => null);
      expect(await store.readAcpAgentIcon("droid")).toBeNull();
      context.disconnect(MethodName.AcpAgentIcon, "No icon.");
      expect(await store.readAcpAgentIcon("droid")).toBeNull();
    });

    it("lets an icon read's failure other than the runtime's or the answer's propagate", async () => {
      await store.initialize();
      const broken = new Error("broken");
      context.answer(MethodName.AcpAgentIcon, () => {
        throw broken;
      });

      await expect(store.readAcpAgentIcon("droid")).rejects.toBe(broken);
    });

    it("adds an agent, reads the kinds again and starts its install", async () => {
      context.answer(MethodName.AcpAgentAdd, () => null);
      context.answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("droid", ProviderKindInstallState.Installed).toJson());
      await store.initialize();
      const kinds = context.count(MethodName.ProviderKindList);

      expect(await store.addAcpAgent("droid", report)).toBe(true);

      expect(AcpAgentIdParams.fromJson(context.parametersOf(MethodName.AcpAgentAdd)).id).toBe("droid");
      expect(context.count(MethodName.ProviderKindList)).toBe(kinds + 1);
      await Wait.until(() => expect(context.parametersOf(MethodName.ProviderKindInstall)).toEqual({ kind: "droid" }));
      expect(reported).toEqual([]);
    });

    it("starts no install for a refused add, and reports an install that fails after an add", async () => {
      context.fail(MethodName.AcpAgentAdd, "Droid can't be added.");
      context.fail(MethodName.ProviderKindInstall, "The download failed.");
      await store.initialize();

      expect(await store.addAcpAgent("droid", report)).toBe(false);
      expect(reported).toEqual(["Droid can't be added."]);
      expect(context.count(MethodName.ProviderKindInstall)).toBe(0);

      context.answer(MethodName.AcpAgentAdd, () => null);
      expect(await store.addAcpAgent("droid", report)).toBe(true);
      await Wait.until(() => expect(reported).toEqual(["Droid can't be added.", "The download failed."]));
    });

    it("saves a local command's values before it sends the command, sending their references only", async () => {
      context.answer(MethodName.AcpLocalCommandAdd, () => {
        expect(context.secretStore.values.size).toBe(2);
        return null;
      });
      await store.initialize();
      const kinds = context.count(MethodName.ProviderKindList);

      expect(await store.addLocalAcpCommand("Tool", "tool", ["--acp"], [new AcpLocalVariable("KEY", "one"), new AcpLocalVariable("OTHER", "two")], report)).toBe(true);

      const sent = AcpLocalCommandAddParams.fromJson(context.parametersOf(MethodName.AcpLocalCommandAdd));
      expect([sent.name, sent.command, sent.arguments]).toEqual(["Tool", "tool", ["--acp"]]);
      expect(sent.secrets.map(t => [t.variable, context.secretStore.values.get(t.reference)])).toEqual([["KEY", "one"], ["OTHER", "two"]]);
      expect(sent.secrets.every(t => t.reference.startsWith(Resources.sharedMcpSecretReferencePrefix))).toBe(true);
      expect(new Set(sent.secrets.map(t => t.reference)).size).toBe(2);
      expect(context.count(MethodName.ProviderKindList)).toBe(kinds + 1);
      expect(reported).toEqual([]);
    });

    it("forgets the values it saved when the command is refused, and still reports the refusal when one can't be forgotten", async () => {
      context.fail(MethodName.AcpLocalCommandAdd, "The command can't be added.");
      await store.initialize();

      expect(await store.addLocalAcpCommand("Tool", "tool", [], [new AcpLocalVariable("KEY", "one")], report)).toBe(false);
      expect(reported).toEqual(["The command can't be added."]);
      expect(context.secretStore.values.size).toBe(0);

      context.secretStore.removalRefusal = "The store is locked.";
      expect(await store.addLocalAcpCommand("Tool", "tool", [], [new AcpLocalVariable("KEY", "one")], report)).toBe(false);
      expect(reported).toEqual(["The command can't be added.", "The command can't be added."]);
    });

    it("reports a saved value's removal failure other than the runtime's in place of the refusal", async () => {
      context.fail(MethodName.AcpLocalCommandAdd, "The command can't be added.");
      await store.initialize();
      const broken = new Error("broken");
      vi.spyOn(context.secrets, "removeAsync").mockRejectedValue(broken);

      expect(await store.addLocalAcpCommand("Tool", "tool", [], [new AcpLocalVariable("KEY", "one")], report)).toBe(false);

      expect(reported).toEqual(["broken"]);
    });

    it("forgets the values already saved when a later one can't be saved, and sends nothing", async () => {
      await store.initialize();
      const save = context.secrets.saveAsync.bind(context.secrets);
      vi.spyOn(context.secrets, "saveAsync").mockImplementationOnce(save).mockRejectedValueOnce(new Error("The store is full."));

      expect(await store.addLocalAcpCommand("Tool", "tool", [], [new AcpLocalVariable("KEY", "one"), new AcpLocalVariable("OTHER", "two")], report)).toBe(false);

      expect(reported).toEqual(["The store is full."]);
      expect(context.secretStore.values.size).toBe(0);
      expect(context.secretStore.removed).toHaveLength(1);
      expect(context.count(MethodName.AcpLocalCommandAdd)).toBe(0);
    });

    it("removes an agent and reads the kinds again, and reports a refusal", async () => {
      context.answer(MethodName.AcpAgentRemove, () => null);
      await store.initialize();
      const kinds = context.count(MethodName.ProviderKindList);

      expect(await store.removeAcpAgent("droid", report)).toBe(true);
      expect(AcpAgentIdParams.fromJson(context.parametersOf(MethodName.AcpAgentRemove)).id).toBe("droid");
      expect(context.count(MethodName.ProviderKindList)).toBe(kinds + 1);

      context.fail(MethodName.AcpAgentRemove, "A provider still uses Droid.");
      expect(await store.removeAcpAgent("droid", report)).toBe(false);
      expect(reported).toEqual(["A provider still uses Droid."]);
    });

    it("reads the kinds and their installs again when the runtime says the kinds changed", async () => {
      await store.initialize();
      const kinds = context.count(MethodName.ProviderKindList);
      const installs = context.count(MethodName.ProviderKindInstallationList);

      context.emit(EventName.ProviderKindsChanged, null);

      await Wait.until(() => expect([context.count(MethodName.ProviderKindList), context.count(MethodName.ProviderKindInstallationList)]).toEqual([kinds + 1, installs + 1]));
    });

    it("lets a kinds read's failure other than the runtime's or the answer's propagate when the kinds change", async () => {
      const failures = unhandled();
      await store.initialize();
      const broken = new Error("broken");
      context.answer(MethodName.ProviderKindList, () => {
        throw broken;
      });

      context.emit(EventName.ProviderKindsChanged, null);

      await Wait.until(() => expect(failures).toEqual([broken]));
    });

    it("keeps the kinds it has and still reads the installs when reading the kinds again fails", async () => {
      await store.initialize();
      const kinds = store.kinds();
      const installs = context.count(MethodName.ProviderKindInstallationList);
      context.disconnect(MethodName.ProviderKindList, "The list failed.");

      context.emit(EventName.ProviderKindsChanged, null);

      await Wait.until(() => expect([store.kindsFailed(), context.count(MethodName.ProviderKindInstallationList)]).toEqual([true, installs + 1]));
      expect(store.kinds()).toBe(kinds);
    });

    const addDuringRead = async (): Promise<KindReadRace> => {
      await store.initialize();
      const reads = context.count(MethodName.ProviderKindList);
      const earlier = new DeferredResponse();
      const later = new DeferredResponse();
      context.answer(MethodName.AcpLocalCommandAdd, () => null)
        .answer(MethodName.ProviderKindList, () => context.count(MethodName.ProviderKindList) === reads + 1 ? earlier.promise : later.promise);
      context.emit(EventName.ProviderKindsChanged, null);
      const added = store.addLocalAcpCommand("Tool", "tool", [], [], report);
      await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBe(reads + 2));
      later.resolve([SampleData.codex.toJson(), new ProviderKind("acp:tool", "Tool", true, true).toJson()]);
      return new KindReadRace(earlier, added);
    };

    it("reads the kinds afresh when a local command is added during an earlier read, and keeps them when that read answers late", async () => {
      const race = await addDuringRead();
      race.earlier.resolve([SampleData.codex.toJson()]);

      expect(await race.added).toBe(true);
      expect(store.kinds().map(t => t.id)).toEqual(["codex", "acp:tool"]);
    });

    it("keeps the kinds a later read gave, and doesn't call them failed, when an earlier read fails after it", async () => {
      const race = await addDuringRead();
      race.earlier.reject(new RuntimeRequestException(FailureCode.Internal, "The list failed."));

      expect(await race.added).toBe(true);
      expect([store.kindsFailed(), store.kinds().map(t => t.id)]).toEqual([false, ["codex", "acp:tool"]]);
    });

    it("adds a local command though its own read of the kinds fails after a later read applied the kinds with it", async () => {
      await store.initialize();
      const reads = context.count(MethodName.ProviderKindList);
      const own = new DeferredResponse();
      const later = new DeferredResponse();
      context.answer(MethodName.AcpLocalCommandAdd, () => null)
        .answer(MethodName.ProviderKindList, () => context.count(MethodName.ProviderKindList) === reads + 1 ? own.promise : later.promise);
      const added = store.addLocalAcpCommand("Tool", "tool", [], [], report);
      await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBe(reads + 1));
      context.emit(EventName.ProviderKindsChanged, null);
      await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBe(reads + 2));

      later.resolve([SampleData.codex.toJson(), new ProviderKind("acp:tool", "Tool", true, true).toJson()]);
      own.reject(new RuntimeRequestException(FailureCode.Internal, "The list failed."));

      expect(await added).toBe(true);
      expect([store.kindsFailed(), store.kinds().map(t => t.id), reported]).toEqual([false, ["codex", "acp:tool"], []]);
    });

    const freshReads: readonly FreshReadCase[] = [
      new FreshReadCase("ProviderKindsChanged", () => {
        context.emit(EventName.ProviderKindsChanged, null);
        return Promise.resolve(true);
      }),
      new FreshReadCase("adding an agent", t => t.addAcpAgent("droid", report)),
      new FreshReadCase("removing an agent", t => t.removeAcpAgent("droid", report))
    ];

    for (const fresh of freshReads) {
      it(`reads the kinds with its own request on ${fresh.name} while an earlier read is out`, async () => {
        context.answer(MethodName.AcpLocalCommandAdd, () => null).answer(MethodName.AcpAgentAdd, () => null).answer(MethodName.AcpAgentRemove, () => null)
          .answer(MethodName.ProviderKindInstall, () => new ProviderKindInstallation("droid", ProviderKindInstallState.Installed).toJson());
        await store.initialize();
        const reads = context.count(MethodName.ProviderKindList);
        const earlier = new DeferredResponse();
        context.answer(MethodName.ProviderKindList, () => context.count(MethodName.ProviderKindList) === reads + 1 ? earlier.promise : [SampleData.codex.toJson()]);
        const first = store.addLocalAcpCommand("Tool", "tool", [], [], report);
        await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBe(reads + 1));

        const done = fresh.act(store);

        await Wait.until(() => expect(context.count(MethodName.ProviderKindList)).toBe(reads + 2));
        earlier.resolve([SampleData.codex.toJson()]);
        expect([await first, await done]).toEqual([true, true]);
      });
    }
  });

  describe("when a call fails", () => {
    const failures: readonly FailureCase[] = [
      new FailureCase(MethodName.ProjectOpen, t => t.openProject("D:\\other"), t => expect(t.projects()).toHaveLength(2)),
      new FailureCase(MethodName.ProjectForget, t => t.forgetProject("p1"), t => expect(t.selectedProjectId()).toBe("p1")),
      new FailureCase(MethodName.ConversationCreate, t => t.createConversation("x"), t => expect(t.conversations()).toHaveLength(1)),
      new FailureCase(MethodName.ConversationRename, t => t.renameConversation("c1", "x"), t => expect(t.selectedConversation()?.title).toBe("First")),
      new FailureCase(MethodName.ConversationMove, async t => expect(await t.moveConversation("c1", "p2")).toBe(false), t => expect(t.conversation("c1")?.projectId).toBe("p1")),
      new FailureCase(MethodName.ChatFolderAttach, async t => expect(await t.attachFolder("c1", "D:/site")).toBe(false),
        t => expect(t.conversation("c1")?.attachedFolder).toBeNull()),
      new FailureCase(MethodName.ChatFolderDetach, async t => expect(await t.detachFolder("c1")).toBe(false), t => expect(t.conversation("c1")?.folder).toBeNull()),
      new FailureCase(MethodName.ConversationResponderSet, t => t.setResponder("c1", new ConversationResponder("bob")), t => expect(t.conversation("c1")?.responder).toBeNull()),
      new FailureCase(MethodName.ConversationDelete, t => t.deleteConversation("c1"), t => expect(t.selectedConversationId()).toBe("c1")),
      new FailureCase(MethodName.ConversationAddMember, t => t.addMember("c1", "bob"), t => expect(t.membersOf("c1")).toEqual([])),
      new FailureCase(MethodName.ConversationRemoveMember, t => t.removeMember("c1", "bob"), t => expect(t.membersOf("c1")).toEqual([])),
      new FailureCase(MethodName.ConversationSetMemberMode, async t => expect(await t.setMemberMode("c1", "bob", "plan")).toBe(false), t => expect(t.membersOf("c1")).toEqual([])),
      new FailureCase(MethodName.ConversationSetMemberSettings, async t => expect(await t.setMemberSettings("c1", "bob", null)).toBe(false),
        t => expect(t.membersOf("c1")).toEqual([])),
      new FailureCase(MethodName.ConversationSetPlanFirst, async t => expect(await t.setPlanFirst("c1", true)).toBe(false),
        t => expect(t.conversation("c1")?.planFirst).toBe(false)),
      new FailureCase(MethodName.TeammateCreate, t => t.saveTeammate(new TeammateCreateParams("Carol", null, "a1", Harness.Provider, null, null)),
        t => expect(t.teammates()).toEqual([])),
      new FailureCase(MethodName.TeammateUpdate, t => t.saveTeammate(new TeammateUpdateParams("t1", "Carol", null, "a1", Harness.Provider, null, null)),
        t => expect(t.teammates()).toEqual([])),
      new FailureCase(MethodName.DefaultTeammateSet, t => t.setDefaultTeammate(new DefaultTeammate(new RequestedSettings("codex", null, null))),
        t => expect(t.defaultTeammate()).toBeNull()),
      new FailureCase(MethodName.MessageSend, t => t.send("hi", settings), t => expect(t.history()?.held).toHaveLength(2)),
      new FailureCase(MethodName.MessageCancel, t => t.cancel("m2"), t => expect(t.runningReply()?.id).toBe("m2")),
      new FailureCase(MethodName.MessageApprovePlan, async t => expect(await t.approvePlan(SampleData.reply)).toBe(false), t => expect(t.history()?.held).toHaveLength(2)),
      new FailureCase(MethodName.ApprovalDecide, t => t.decide("ap1", "yes"), t => expect(t.pendingApprovals()).toHaveLength(1)),
      new FailureCase(MethodName.ConversationRewind, t => t.rewind(SampleData.userMessage, false), t => expect(t.history()?.held).toHaveLength(2)),
      new FailureCase(MethodName.ProviderCreate, t => t.addProvider("claude", "Home", "D:\\h"), t => expect(t.providers()).toHaveLength(1)),
      new FailureCase(MethodName.ProviderUpdate, async t => expect(await t.updateProvider("a1", "Office", "D:\\o")).toBe(false),
        t => expect(t.providers()[0]?.label).toBe("Work")),
      new FailureCase(MethodName.ProviderCheck, t => t.checkProvider("a1"), t => expect(t.providers()[0]?.authStatus).toBe(AuthStatus.LoggedIn)),
      new FailureCase(MethodName.ProviderDelete, t => t.removeProvider("a1"), t => expect(t.providers()).toHaveLength(1)),
      new FailureCase(MethodName.ApprovalList, t => t.selectProject("p2"), t => expect(t.history()?.held ?? []).toEqual([])),
      new FailureCase(MethodName.ConversationList, t => t.openProject("D:\\other"), t => expect(t.selectedProjectId()).toBe("p1"))
    ];

    for (const failure of failures)
      it(`records the runtime part's message for ${failure.method} and keeps the store as it was`, async () => {
        context.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
        context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)]);
        context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === "p1" ? [SampleData.conversation.toJson()]
          : [new Conversation("c3", "p2", "Third", SampleData.timestamp, SampleData.timestamp).toJson()]);
        await store.initialize();
        await store.selectConversation("c1");
        context.fail(failure.method, `${failure.method} failed`);

        await failure.act(store);

        expect(context.noticeText()).toContain(`${failure.method} failed`);
        expect(store.isBusy()).toBe(false);
        failure.unchanged(store);
      });

    for (const method of [MethodName.ProviderKindList, MethodName.ProviderList, MethodName.TeammateList, MethodName.DefaultTeammateRead, MethodName.ProjectList,
      MethodName.MessageListOpen, MethodName.ApprovalListPending, MethodName.ProviderKindInstallationList])
      it(`records the runtime part's message when ${method} fails while the catalog loads`, async () => {
        context.fail(method, `${method} failed`);

        await store.initialize();

        expect(context.noticeText()).toBe(`${method} failed`);
        expect(store.loaded()).toBe(false);
        expect(store.projects()).toEqual([]);
      });

    it("lists the computer-use grants and revokes one through the runtime part, reporting a refused revoke to its caller", async () => {
      const grant = new ComputerUseGrant("g1", "c1", "Release notes", null, "com.example.notes", null, null, SampleData.timestamp);
      context.answer(MethodName.ComputerUseGrantList, () => [grant.toJson()]);
      context.answer(MethodName.ComputerUseGrantRevoke, () => null);
      const reported: string[] = [];

      expect((await store.listComputerUseGrants()).map(t => t.toJson())).toEqual([grant.toJson()]);
      expect(await store.revokeComputerUseGrant("g1", t => reported.push(t))).toBe(true);
      expect(context.parametersOf(MethodName.ComputerUseGrantRevoke)).toEqual({ grantId: "g1" });
      context.fail(MethodName.ComputerUseGrantRevoke, "The computer-use grant \"g1\" does not exist or was already revoked.");
      expect(await store.revokeComputerUseGrant("g1", t => reported.push(t))).toBe(false);

      expect(reported).toEqual(["The computer-use grant \"g1\" does not exist or was already revoked."]);
      expect(context.noticeText()).toBeNull();
      expect(store.isBusy()).toBe(false);
    });

    it("rejects a failed search, model list, attachment preparation, attachment read or own MCP server list with the runtime part's message", async () => {
      context.fail(MethodName.ChatFind, "search failed").fail(MethodName.MessageSearch, "message search failed").fail(MethodName.ProviderModelCatalog, "catalog failed")
        .fail(MethodName.AttachmentPrepare, "prepare failed").fail(MethodName.AttachmentRead, "read failed")
        .fail(MethodName.ProviderOwnMcpServerList, "list failed");

      await expect(store.findChats("login")).rejects.toThrow("search failed");
      await expect(store.searchMessages("login")).rejects.toThrow("message search failed");
      await expect(store.listModels("codex", null)).rejects.toThrow("catalog failed");
      await expect(store.prepareAttachment(new AttachmentInput("notes.txt", "text/plain", "AA==", null))).rejects.toThrow("prepare failed");
      await expect(store.readAttachment("c1", "D:/data/attachments/drafts/c1/gone.png")).rejects.toThrow("read failed");
      await expect(store.listOwnMcpServers("a1")).rejects.toThrow("list failed");
      expect(context.noticeText()).toBeNull();
    });

    it("reports a refused switch of a provider's own MCP servers to its caller and keeps them as they were", async () => {
      await store.initialize();
      context.fail(MethodName.ProviderUpdate, "Claude Code keeps them off.");
      const reported: string[] = [];

      expect(await store.switchOwnMcpServers(Required.of(store.providers()[0]), true, t => reported.push(t))).toBe(false);

      expect(reported).toEqual(["Claude Code keeps them off."]);
      expect(context.noticeText()).toBeNull();
      expect(store.isBusy()).toBe(false);
      expect(store.providers()[0]?.ownMcpServers).toBe(false);
    });

    it("records a failure that is not an error by its text", async () => {
      context.answer(MethodName.ProviderKindList, () => Promise.reject("offline"));

      await store.initialize();

      expect(context.noticeText()).toBe("offline");
    });
  });

  describe("usage", () => {
    const plan = (percent: number, readAt: string, providerId: string | null = "a1"): PlanUsage =>
      new PlanUsage("claude", providerId, [new PlanWindow(PlanWindowName.FiveHour, percent, null)], readAt);
    const used = (tokens: number): ContextUsage => new ContextUsage(tokens, 200_000, 180_000);
    const replied = (id: string, startedAt: string, tokens: number | null, conversationId: string = "c1", teammateId: string | null = null,
      providerId: string = "a1"): Message =>
      new Message(id, conversationId, Number(id.slice(1)), MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
        new Provenance(providerId, SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null,
          Object.isNull(tokens) ? null : new ReplyUsage(10, 20, null, used(tokens))), SampleData.timestamp, startedAt, startedAt, [], teammateId, teammateId);

    it("loads the known plans and each known teammate's last context after the catalog, and keeps a plan's newest read", async () => {
      new TeammateFixture(context);
      context.answer(MethodName.PlanUsageList, () => [plan(30, "2026-10-22T09:00:00.000Z").toJson()])
        .answer(MethodName.TeammateUsageList, () => [new TeammateUsage("alice", "c1", "m7", null, null, new ReplyUsage(1, 2, null, used(90_000))).toJson(),
          new TeammateUsage("bob", "c1", "m8", null, null, new ReplyUsage(1, 2, 0.5, null)).toJson(),
          new TeammateUsage("gone", "c1", "m9", null, null, new ReplyUsage(1, 2, null, used(10_000))).toJson()]);
      await store.initialize();

      await Wait.until(() => expect(store.contextOf("c1", "alice")?.context).toEqual(used(90_000)));
      expect(store.planUsageOf("claude", "a1")).toEqual(plan(30, "2026-10-22T09:00:00.000Z"));
      expect([store.planUsageOf("claude", null), store.planUsageOf("codex", "a1"), store.contextOf("c1", "bob"), store.contextOf("c2", "alice"),
        store.contextOf("c1", "gone")]).toEqual([null, null, null, null, null]);
      context.emit(EventName.PlanUsageUpdated, plan(10, "2026-10-22T08:00:00.000Z").toJson());
      expect(store.planUsageOf("claude", "a1")?.windows[0]?.usedPercent).toBe(30);
      context.emit(EventName.PlanUsageUpdated, plan(85, "2026-10-22T10:00:00.000Z").toJson());
      context.emit(EventName.PlanUsageUpdated, plan(5, "2026-10-22T10:00:00.000Z", null).toJson());
      expect([store.planUsageOf("claude", "a1")?.windows[0]?.usedPercent, store.planUsageOf("claude", null)?.windows[0]?.usedPercent]).toEqual([85, 5]);
    });

    it("keeps the window working when Core can't list usage", async () => {
      context.disconnect(MethodName.PlanUsageList, "Not supported");
      await store.initialize();

      await Wait.until(() => expect(context.count(MethodName.PlanUsageList)).toBe(1));
      expect(context.count(MethodName.TeammateUsageList)).toBe(0);
      expect(context.noticeText()).toBeNull();
      expect(store.conversations().map(t => t.id)).toEqual(["c1"]);
    });

    it("lets a usage list's failure other than the runtime's or the answer's propagate", async () => {
      const failures = unhandled();
      const broken = new Error("broken");
      context.answer(MethodName.PlanUsageList, () => {
        throw broken;
      });

      await store.initialize();

      await Wait.until(() => expect(failures).toEqual([broken]));
    });

    it("lets a plan read's failure other than the runtime's or the answer's propagate, and reads again after it", async () => {
      await store.initialize();
      const broken = new Error("broken");
      context.answer(MethodName.PlanUsageRead, () => {
        throw broken;
      });

      await expect(store.readPlanUsage("grok", null)).rejects.toBe(broken);
      await expect(store.readPlanUsage("grok", null)).rejects.toBe(broken);

      expect(context.count(MethodName.PlanUsageRead)).toBe(2);
    });

    it("reads a reported plan once, reads again after nothing or a failure, and keeps quiet when the read fails", async () => {
      const reads: PlanUsageParams[] = [];
      context.answer(MethodName.PlanUsageRead, t => {
        const params = PlanUsageParams.fromJson(t);
        reads.push(params);
        if (params.kind === "grok")
          throw new RuntimeRequestException(FailureCode.Disconnected, "offline");
        return params.kind === "codex" ? null : plan(12, "2026-10-22T09:00:00.000Z", params.providerId).toJson();
      });
      await store.initialize();

      await store.readPlanUsage("codex", "a1");
      await store.readPlanUsage("codex", "a1");
      await store.readPlanUsage("grok", null);
      await store.readPlanUsage("grok", null);
      await store.readPlanUsage("claude", null);
      await store.readPlanUsage("claude", null);
      expect(reads).toEqual([new PlanUsageParams("codex", "a1"), new PlanUsageParams("codex", "a1"), new PlanUsageParams("grok", null),
        new PlanUsageParams("grok", null), new PlanUsageParams("claude", null)]);
      expect([store.planUsageOf("codex", "a1"), store.planUsageOf("grok", null)]).toEqual([null, null]);
      expect(store.planUsageOf("claude", null)).toEqual(plan(12, "2026-10-22T09:00:00.000Z", null));
      expect(context.noticeText()).toBeNull();
    });

    it("reads a provider's plan again once the provider signs in, and not for an update that leaves it signed in", async () => {
      const reads: PlanUsageParams[] = [];
      context.answer(MethodName.PlanUsageRead, t => {
        reads.push(PlanUsageParams.fromJson(t));
        return plan(12, "2026-10-22T09:00:00.000Z").toJson();
      });
      const provider = (status: AuthStatus, label: string = "Work", id: string = "a1"): JsonValue =>
        new Provider(id, "claude", label, "D:\\p", status, null, null, null, null, SampleData.timestamp).toJson();
      await store.initialize();

      await store.readPlanUsage("claude", "a1");
      context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedOut));
      await store.readPlanUsage("claude", "a1");
      context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn));
      await store.readPlanUsage("claude", "a1");
      context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn, "Renamed"));
      await store.readPlanUsage("claude", "a1");
      context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn, "New", "a8"));
      await store.readPlanUsage("claude", "a8");

      expect(reads).toEqual([new PlanUsageParams("claude", "a1"), new PlanUsageParams("claude", "a1"), new PlanUsageParams("claude", "a8")]);
    });

    it("keeps a teammate's context through a model change, and drops it once a provider change starts a new session, even from the chat's history", async () => {
      const alice = new TeammateFixture(context).alice;
      context.answer(MethodName.TeammateUsageList, () => [new TeammateUsage("alice", "c1", "m7", null, null, new ReplyUsage(1, 2, null, used(90_000))).toJson()])
        .answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, replied("m2", "2026-10-22T08:00:00.000Z", 40_000, "c1", "alice")], false, false).toJson());
      const move = (providerId: string): Promise<boolean> =>
        store.saveTeammate(new TeammateUpdateParams(alice.id, alice.name, alice.role, providerId, alice.harness, "gpt-5-mini", "low"));
      await store.initialize();
      await Wait.until(() => expect(store.contextOf("c1", "alice")?.context).toEqual(used(90_000)));

      await move("a1");
      expect(store.contextOf("c1", "alice")?.context).toEqual(used(90_000));
      await move("a2");
      expect(store.contextOf("c1", "alice")).toBeNull();
      await move("a1");
      expect(store.contextOf("c1", "alice")).toBeNull();
      await move("a2");
      await store.selectConversation("c1");
      expect(store.contextOf("c1", "alice")).toBeNull();
      context.emit(EventName.MessageUpdated, replied("m9", "2026-10-22T10:00:00.000Z", 5_000, "c1", "alice", "a2").toJson());
      expect(store.contextOf("c1", "alice")?.context).toEqual(used(5_000));
    });

    it("follows the context of each chat's latest reply from its history and events, and forgets it when the chat is rewound or deleted", async () => {
      let paged: readonly Message[] = [SampleData.userMessage, replied("m2", "2026-10-22T08:00:00.000Z", 40_000)];
      context.answer(MethodName.MessagePage, () => SampleData.page(paged, false, false).toJson());
      await store.initialize();
      await store.selectConversation("c1");

      expect(store.contextOf("c1", null)?.context).toEqual(used(40_000));
      context.emit(EventName.MessageUpdated, replied("m3", "2026-10-22T09:00:00.000Z", 120_000).toJson());
      expect(store.contextOf("c1", null)?.messageId).toBe("m3");
      context.emit(EventName.MessageUpdated, replied("m2", "2026-10-22T08:00:00.000Z", 41_000).toJson());
      context.emit(EventName.MessageCreated, replied("m4", "2026-10-22T09:30:00.000Z", null).toJson());
      context.emit(EventName.MessageCreated, replied("m5", "2026-10-22T09:30:00.000Z", 5_000, "c2").toJson());
      expect(store.contextOf("c1", null)?.context).toEqual(used(120_000));
      expect(store.contextOf("c2", null)?.context).toEqual(used(5_000));

      paged = [SampleData.userMessage];
      context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 1).toJson());
      expect(store.contextOf("c1", null)).toBeNull();
      expect(store.contextOf("c2", null)).not.toBeNull();
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
      expect(store.contextOf("c2", null)).toBeNull();
      await Wait.until(() => expect(ids()).toEqual(["m1"]));
      expect(store.contextOf("c1", null)).toBeNull();
    });
  });

  describe("app-wide failures, as notices", () => {
    const openChat = (id: string): CommandRun => new CommandRun(QualifiedName.parse(Resources.openChatCommand), { [Resources.chatIdArgument]: id });
    const tryAgain = (load: string, windowId: string = store.windowId): NotificationAction => new NotificationAction(Resources.tryAgainLabel,
      new CommandRun(QualifiedName.parse(Resources.reloadCommand),
        { [Resources.windowIdArgument]: windowId, [Resources.noticeKeyArgument]: Resources.formatNoticeKey(windowId, load) }));
    const manage = new NotificationAction(Resources.showProvidersTitle, new CommandRun(QualifiedName.parse(Resources.showProvidersCommand), null));
    const enable = (id: string): NotificationAction => new NotificationAction(Resources.enableProviderTitle,
      new CommandRun(QualifiedName.parse(Resources.enableProviderCommand), { [Resources.providerIdArgument]: id }));
    const keys = (kind: string): readonly (string | null)[] => context.shownNotices(kind).map(t => t.key);
    const local = (key: string | null, windowId: string = store.windowId): string | null => key?.replace(Resources.formatNoticeKey(windowId, String.empty), String.empty) ?? null;
    const loads = (): readonly (string | null)[] => keys(Resources.loadFailedNotice).map(t => local(t));
    const work = (authStatus: AuthStatus, enabled: boolean, label: string = "Work"): Provider =>
      new Provider("a1", "codex", label, "D:\\profiles\\codex", authStatus, null, "1.0", SampleData.timestamp, null, SampleData.timestamp, enabled);
    const home = (label: string): Provider =>
      new Provider("a2", "codex", label, "D:\\profiles\\home", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp, true);
    const reply = (id: string, conversationId: string, status: MessageStatus, details: readonly MessageDetail[], teammateName: string | null): Message =>
      new Message(id, conversationId, 1, MessageAuthor.Provider, "m1", status, details, SampleData.provenance, SampleData.timestamp, SampleData.timestamp,
        status === MessageStatus.Running ? null : SampleData.timestamp, [], Object.isNull(teammateName) ? null : "alice", teammateName);

    it("posts a message refused for a disabled provider as Message not sent, with Enable provider, Manage providers and Open chat, and replaces it on the next failure", async () => {
      context.answer(MethodName.ProviderList, () => [work(AuthStatus.LoggedIn, false).toJson()]);
      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Work is disabled.", "alice", "a1");
      await store.initialize();

      expect(await store.send("hi", settings, "c1")).toBe(false);
      expect(context.shownNotices(Resources.messageNotSentNotice).map(t => [t.key, t.title, t.text, t.open, t.actions]))
        .toEqual([["c1", Resources.messageNotSentTitle, "Work is disabled.", openChat("c1"), [enable("a1"), manage]]]);

      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Home is signed out.", "a2");
      expect(await store.send("hi", settings, "c1")).toBe(false);
      expect(context.shownNotices(Resources.messageNotSentNotice).map(t => [t.key, t.text, t.actions])).toEqual([["c1", "Home is signed out.", [manage]]]);

      context.fail(MethodName.MessageSend, "Disconnected");
      expect(await store.send("hi", settings, "c1")).toBe(false);
      expect(context.shownNotices(Resources.messageNotSentNotice).map(t => [t.key, t.text, t.actions])).toEqual([["c1", "Disconnected", []]]);
      expect(context.shownNotices(Resources.chatActionFailedNotice)).toEqual([]);
    });

    it("dismisses Message not sent once its provider is enabled or signed in, and keeps it through another provider's change", async () => {
      context.answer(MethodName.ProviderList, () => [work(AuthStatus.LoggedIn, false).toJson(), home("Home").toJson()]);
      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Work is disabled.", "a1");
      await store.initialize();
      await store.send("hi", settings, "c1");
      context.fail(MethodName.MessageSend, "Disconnected");
      await store.send("hi", settings, "c2");

      context.emit(EventName.ProviderUpdated, home("Renamed").toJson());
      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedIn, false, "Still off").toJson());
      expect(keys(Resources.messageNotSentNotice)).toEqual(["c1", "c2"]);

      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedOut, true).toJson());
      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual(["c2"]));

      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Work is signed out.", "a1");
      await store.send("hi", settings, "c1");
      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedOut, true, "Signing in").toJson());
      expect(keys(Resources.messageNotSentNotice)).toEqual(["c2", "c1"]);
      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedIn, true).toJson());
      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual(["c2"]));
    });

    it("dismisses Message not sent from Enable provider's own change of the provider", async () => {
      context.answer(MethodName.ProviderList, () => [work(AuthStatus.LoggedIn, false).toJson()]);
      context.answer(MethodName.ProviderSetEnabled, t => work(AuthStatus.LoggedIn, ProviderEnabledParams.fromJson(t).enabled).toJson());
      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Work is disabled.", "alice", "a1");
      await store.initialize();
      await store.send("hi", settings, "c1");

      await store.setProviderEnabled("a1", true);

      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual([]));
    });

    it("dismisses Message not sent once the teammate it named moves to another provider, or a send in its chat succeeds", async () => {
      new TeammateFixture(context);
      context.refuse(MethodName.MessageSend, ErrorCode.Unavailable, "Work is disabled.", "alice", "a1");
      await store.initialize();
      await store.send("hi", settings, "c1");
      context.fail(MethodName.MessageSend, "Disconnected");
      await store.send("hi", settings, "c2");

      await store.saveTeammate(new TeammateUpdateParams("alice", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high"));
      expect(keys(Resources.messageNotSentNotice)).toEqual(["c1", "c2"]);
      await store.saveTeammate(new TeammateUpdateParams("alice", "Alice", "Review", "a2", Harness.Provider, "gpt-5", "high"));
      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual(["c2"]));

      context.answer(MethodName.MessageSend, () => new MessageSendResult(new Message("m1", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [],
        null, SampleData.timestamp, null, SampleData.timestamp), []).toJson());
      expect(await store.send("hi", settings, "c2")).toBe(true);
      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual([]));
    });

    it("leaves a failed reply to the runtime's notice, posting none of its own for a chat on screen or not", async () => {
      context.answer(MethodName.MessageListOpen, () => [reply("m2", "c1", MessageStatus.Running, [], "Alice").toJson()]);
      await store.initialize();

      context.emit(EventName.MessageUpdated, reply("m2", "c1", MessageStatus.Failed, [SampleData.detail(0, DetailKind.Error, "The model is overloaded.")], "Alice").toJson());

      expect([store.isWorking("c1"), context.shownNotices()]).toEqual([false, []]);
    });

    it("dismisses a deleted chat's Message not sent and failed chat actions, and keeps another chat's", async () => {
      context.fail(MethodName.MessageSend, "Disconnected");
      await store.initialize();
      await store.send("hi", settings, "c1");
      store.reportFailure(ChatAction.RenameChat, "c1", "The title is taken.", "c1");
      store.reportFailure(ChatAction.RenameChat, "c2", "The title is taken.", "c2");
      store.reportFailure(ChatAction.OpenProject, "D:\\work", "The folder is gone.", null);
      expect(context.shownNotices().map(t => [t.kind.text, t.key])).toEqual([[Resources.messageNotSentNotice, "c1"],
        [Resources.chatActionFailedNotice, Resources.formatNoticeKey(ChatAction.RenameChat, "c1")],
        [Resources.chatActionFailedNotice, Resources.formatNoticeKey(ChatAction.RenameChat, "c2")],
        [Resources.chatActionFailedNotice, Resources.formatNoticeKey(ChatAction.OpenProject, "D:\\work")]]);

      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());

      await Wait.until(() => expect(context.shownNotices().map(t => t.key)).toEqual([Resources.formatNoticeKey(ChatAction.RenameChat, "c2"),
        Resources.formatNoticeKey(ChatAction.OpenProject, "D:\\work")]));
    });

    it("dismisses Message not sent once a message is sent in its chat from another window, and keeps it through another chat's", async () => {
      context.fail(MethodName.MessageSend, "Disconnected");
      await store.initialize();
      await store.send("hi", settings, "c1");
      const sent = (conversationId: string): Message => new Message("m9", conversationId, 4, MessageAuthor.User, null, MessageStatus.Completed, [], null,
        SampleData.timestamp, null, SampleData.timestamp);

      context.emit(EventName.MessageCreated, sent("c2").toJson());
      context.emit(EventName.MessageUpdated, sent("c1").toJson());
      context.emit(EventName.MessageCreated, reply("m10", "c1", MessageStatus.Running, [], "Alice").toJson());
      expect(keys(Resources.messageNotSentNotice)).toEqual(["c1"]);
      context.emit(EventName.MessageCreated, sent("c1").toJson());

      await Wait.until(() => expect(keys(Resources.messageNotSentNotice)).toEqual([]));
    });

    it("keeps each window's load notices apart on one notification center, and reloads only the window a Try again names", async () => {
      const other = SampleData.createContext();
      other.notifications = context.notifications;
      const second = new ChatStoreService(other);
      context.fail(MethodName.ProjectList, "offline");
      other.fail(MethodName.ProjectList, "offline");
      await store.initialize();
      await second.initialize();
      const shown = (): readonly (readonly JsonValue[])[] =>
        context.shownNotices(Resources.loadFailedNotice).map(t => [t.key, t.actions[0]?.command.commandArguments ?? null]);
      expect(second.windowId).not.toBe(store.windowId);
      expect(shown()).toEqual([[Resources.formatNoticeKey(store.windowId, Resources.catalogLoad), tryAgain(Resources.catalogLoad).command.commandArguments],
        [Resources.formatNoticeKey(second.windowId, Resources.catalogLoad), tryAgain(Resources.catalogLoad, second.windowId).command.commandArguments]]);

      other.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]);
      const asked = other.count(MethodName.ProjectList);
      other.emit(EventName.WindowReloadRequested, new WindowIdParams(store.windowId).toJson());
      expect(other.count(MethodName.ProjectList)).toBe(asked);
      other.emit(EventName.WindowReloadRequested, new WindowIdParams(second.windowId).toJson());

      await Wait.until(() => expect(shown().map(t => t[0])).toEqual([Resources.formatNoticeKey(store.windowId, Resources.catalogLoad)]));
      expect([store.hasFailedLoads(), second.hasFailedLoads(), second.loaded()]).toEqual([true, false, true]);
      second.dispose();
    });

    it("dismisses a disposed window's load notices and failed terminal show, and keeps another window's on the same notification center", async () => {
      const other = SampleData.createContext();
      other.notifications = context.notifications;
      const second = new ChatStoreService(other);
      context.fail(MethodName.ProjectList, "offline");
      other.fail(MethodName.ProjectList, "offline").fail(MethodName.ProviderKindList, "offline");
      await store.initialize();
      await second.initialize();
      store.reportFailure(ChatAction.ShowTerminals, store.windowId, "The runtime stopped.", null);
      second.reportFailure(ChatAction.ShowTerminals, second.windowId, "The runtime stopped.", null);
      second.reportFailure(ChatAction.OpenProject, "D:\\work", "The folder is gone.", null);

      second.dispose();

      await Wait.until(() => expect(context.shownNotices().map(t => t.key)).toEqual([Resources.formatNoticeKey(store.windowId, Resources.catalogLoad),
        Resources.formatNoticeKey(ChatAction.ShowTerminals, store.windowId), Resources.formatNoticeKey(ChatAction.OpenProject, "D:\\work")]));
      expect([store.hasFailedLoads(), second.hasFailedLoads()]).toEqual([true, false]);
    });

    it("says so in place of another window's failed load when Try again finds that window closed, and passes on any other refusal", async () => {
      const other = SampleData.createContext();
      other.notifications = context.notifications;
      const closed = new ChatStoreService(other);
      other.fail(MethodName.ProjectList, "offline");
      await store.initialize();
      await closed.initialize();
      const key = Resources.formatNoticeKey(closed.windowId, Resources.catalogLoad);
      context.refuse(MethodName.WindowReload, ErrorCode.NotFound, "The window is closed.", closed.windowId);

      const unnamed = await store.reloadIn(closed.windowId).then(() => null, (t: unknown) => t);
      const elsewhere = await store.reloadIn("w9", key).then(() => null, (t: unknown) => t);
      await store.reloadIn(closed.windowId, key);
      context.fail(MethodName.WindowReload, "offline");
      const failed = await store.reloadIn(closed.windowId, key).then(() => null, (t: unknown) => t);

      await Wait.until(() => expect(context.shownNotices(Resources.loadFailedNotice).map(t => [t.key, t.title, t.text, t.open, t.actions]))
        .toEqual([[key, Resources.windowClosedTitle, Resources.windowClosedText, null, []]]));
      expect([unnamed, elsewhere, failed].map(t => t instanceof Error ? t.message : null)).toEqual(["The window is closed.", "The window is closed.", "offline"]);
      store.dispose();
      await Wait.until(() => expect(context.shownNotices(Resources.loadFailedNotice)).toEqual([]));
      closed.dispose();
    });

    it("drops a chat's failed Try again once the chat's tab closed or the chat was deleted while it loaded, and posts it while the tab stays", async () => {
      const other = new Conversation("c2", SampleData.otherProject.id, "Other", SampleData.timestamp, SampleData.timestamp);
      context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)])
        .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [other.toJson()]);
      await store.initialize();
      const page = (): JsonValue => SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson();
      const failLater = (): (() => void) => {
        const gate = new DeferredResponse();
        context.answer(MethodName.MessagePage, async () => {
          await gate.promise;
          throw new Error("The page is gone.");
        });
        return () => gate.resolve(null);
      };
      context.fail(MethodName.MessagePage, "The page is gone.");
      const first = store.showConversation("c1");
      await store.conversationInView("c1");
      await Wait.until(() => expect(loads()).toEqual(["chat/c1"]));
      context.answer(MethodName.MessagePage, page);
      const second = store.showConversation("c2");
      await store.conversationInView("c2");

      const kept = failLater();
      const keeping = store.reload();
      kept();
      await keeping;
      expect([loads(), store.hasFailedLoads()]).toEqual([["chat/c1"], true]);
      const closing = failLater();
      const reloading = store.reload();
      first();
      closing();
      await reloading;
      await Wait.until(() => expect([loads(), store.hasFailedLoads()]).toEqual([[], false]));

      context.fail(MethodName.MessagePage, "The page is gone.");
      const again = store.showConversation("c1");
      await Wait.until(() => expect(loads()).toEqual(["chat/c1"]));
      const deleting = failLater();
      const deleted = store.reload();
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      deleting();
      await deleted;

      await Wait.until(() => expect([loads(), store.hasFailedLoads()]).toEqual([[], false]));
      again();
      second();
    });

    it("posts nothing for a chat's first load whose tab closed or whose chat was deleted while it read", async () => {
      await store.initialize();
      const failLater = (): (() => void) => {
        const gate = new DeferredResponse();
        context.answer(MethodName.MessagePage, async () => {
          await gate.promise;
          throw new Error("The page is gone.");
        });
        return () => gate.resolve(null);
      };

      const closing = failLater();
      const closed = store.showConversation("c1");
      await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(1));
      closed();
      closing();
      await Wait.until(() => expect(store.isBusy()).toBe(false));
      expect([loads(), store.hasFailedLoads()]).toEqual([[], false]);

      const deleting = failLater();
      const held = store.showConversation("c1");
      await Wait.until(() => expect(context.count(MethodName.MessagePage)).toBe(2));
      context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
      deleting();
      await Wait.until(() => expect(store.isBusy()).toBe(false));

      expect([loads(), store.hasFailedLoads()]).toEqual([[], false]);
      held();
    });

    it("dismisses a provider's failed sign-in and check once it is signed in, and keeps another provider's", async () => {
      context.answer(MethodName.ProviderList, () => [work(AuthStatus.LoggedOut, true).toJson(), home("Home").toJson()]);
      await store.initialize();
      store.reportFailure(ChatAction.SignIn, "a1", "The terminal closed.", null);
      store.reportFailure(ChatAction.CheckProvider, "a1", "The check failed.", null);
      store.reportFailure(ChatAction.CheckProvider, "a2", "The check failed.", null);

      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedOut, true, "Still out").toJson());
      const before = keys(Resources.chatActionFailedNotice);
      context.emit(EventName.ProviderUpdated, work(AuthStatus.LoggedIn, true).toJson());

      expect(before).toEqual([Resources.formatNoticeKey(ChatAction.SignIn, "a1"), Resources.formatNoticeKey(ChatAction.CheckProvider, "a1"),
        Resources.formatNoticeKey(ChatAction.CheckProvider, "a2")]);
      await Wait.until(() => expect(keys(Resources.chatActionFailedNotice)).toEqual([Resources.formatNoticeKey(ChatAction.CheckProvider, "a2")]));
    });

    it("posts a failed load with Try again, which loads it again and dismisses it once it loads", async () => {
      context.fail(MethodName.ProjectList, "offline");
      await store.initialize();

      expect(context.shownNotices(Resources.loadFailedNotice).map(t => [t.key, t.title, t.text, t.open, t.actions]))
        .toEqual([[Resources.formatNoticeKey(store.windowId, Resources.catalogLoad), Resources.catalogNotLoaded, "offline", null, [tryAgain(Resources.catalogLoad)]]]);
      expect(store.hasFailedLoads()).toBe(true);

      await store.reload();
      expect(loads()).toEqual([Resources.catalogLoad]);
      context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)]);
      await store.reload();

      await Wait.until(() => expect(loads()).toEqual([]));
      expect([store.hasFailedLoads(), store.loaded(), store.projects().map(t => t.id)]).toEqual([false, true, ["p1"]]);
    });

    it("posts providers that failed to load, at the start and on a resync, and loads them again from Try again", async () => {
      context.disconnect(MethodName.ProviderKindList, "offline");
      await store.initialize();
      expect(context.shownNotices(Resources.loadFailedNotice).map(t => [local(t.key), t.title, t.text])).toEqual([[Resources.kindsLoad, Resources.kindsNotLoaded, "offline"]]);
      expect(store.loaded()).toBe(false);

      await store.reload();
      expect([loads(), store.loaded()]).toEqual([[Resources.kindsLoad], false]);
      await store.resync();
      expect([loads(), store.loaded()]).toEqual([[Resources.kindsLoad], true]);

      context.answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson()]);
      await store.reload();
      await Wait.until(() => expect(loads()).toEqual([]));
      expect(store.kinds().map(t => t.id)).toEqual(["codex"]);
    });

    it("posts a chat that failed to load with Open chat, and dismisses it once Try again loads it, or once the chat closes", async () => {
      await store.initialize();
      context.fail(MethodName.MessagePage, "The page is gone.");

      const release = store.showConversation("c1");
      await Wait.until(() => expect(context.shownNotices(Resources.loadFailedNotice).map(t => [local(t.key), t.title, t.text, t.open, t.actions]))
        .toEqual([["chat/c1", Resources.chatNotLoaded, "The page is gone.", openChat("c1"), [tryAgain("chat/c1")]]]));
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson());
      await store.reload();
      await Wait.until(() => expect(loads()).toEqual([]));
      expect(store.isHistoryLoaded("c1")).toBe(true);
      release();

      context.fail(MethodName.MessagePage, "The page is gone.");
      const again = store.showConversation("c1");
      await Wait.until(() => expect(loads()).toEqual(["chat/c1"]));
      again();
      await Wait.until(() => expect(loads()).toEqual([]));
      expect(store.hasFailedLoads()).toBe(false);
    });

    it("loads again only a chat whose load failed when Try again comes while another chat is shown, which stays selected", async () => {
      const other = new Conversation("c2", SampleData.otherProject.id, "Other", SampleData.timestamp, SampleData.timestamp);
      context.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)])
        .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [other.toJson()]);
      await store.initialize();
      context.fail(MethodName.MessagePage, "The page is gone.");
      const first = store.showConversation("c1");
      await store.conversationInView("c1");
      await Wait.until(() => expect(loads()).toEqual(["chat/c1"]));
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson());
      const second = store.showConversation("c2");
      await store.conversationInView("c2");
      expect([store.selectedConversationId(), store.selectedProjectId()]).toEqual(["c2", "p2"]);

      await store.reload();

      await Wait.until(() => expect(loads()).toEqual([]));
      expect([store.selectedConversationId(), store.selectedProjectId(), store.shownConversationId()]).toEqual(["c2", "p2", "c2"]);
      expect(store.isHistoryLoaded("c1")).toBe(true);
      first();
      second();
    });

    it("selects the chat whose load failed again from Try again while it is still the one asked for", async () => {
      await store.initialize();
      context.fail(MethodName.MessagePage, "The page is gone.");
      await store.conversationInView("c1");
      await Wait.until(() => expect(loads()).toEqual(["chat/c1"]));
      expect(store.selectedConversationId()).toBeNull();
      context.answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson());

      await store.reload();

      await Wait.until(() => expect(store.selectedConversationId()).toBe("c1"));
      expect(loads()).toEqual([]);
    });

    it("posts a chat whose existence couldn't be checked, and asks again from Try again", async () => {
      await store.initialize();
      context.fail(MethodName.ConversationListMembers, "The runtime stopped.");

      expect(await store.confirmConversation("elsewhere")).toBe(true);
      expect(context.shownNotices(Resources.loadFailedNotice).map(t => [local(t.key), t.open])).toEqual([["chat/elsewhere", openChat("elsewhere")]]);
      context.answer(MethodName.ConversationListMembers, () => []);
      await store.reload();

      await Wait.until(() => expect(loads()).toEqual([]));
    });

    it("posts the running replies a watching window couldn't read, and reads them again from Try again", async () => {
      context.fail(MethodName.MessageListOpen, "offline");
      ChatStoreService.watch(context);
      const watched = ChatStoreService.of(context);
      await Wait.until(() => expect(keys(Resources.loadFailedNotice).map(t => local(t, watched.windowId))).toContain(Resources.workingLoad));
      expect(context.shownNotices(Resources.loadFailedNotice).find(t => local(t.key, watched.windowId) === Resources.workingLoad)?.title).toBe(Resources.workingNotLoaded);

      context.answer(MethodName.MessageListOpen, () => []);
      await watched.reload();

      await Wait.until(() => expect(loads()).toEqual([]));
      ChatStoreService.release(context);
    });

    it("posts a first launch or tools check that failed, and runs the reader's own retry from Try again", async () => {
      context.fail(MethodName.FirstLaunchRead, "offline").fail(MethodName.ProviderToolList, "offline");
      await store.initialize();
      let retried = 0;

      expect(await store.readFirstLaunch()).toBeNull();
      expect(await store.refreshTools()).toBe(false);
      expect(context.shownNotices(Resources.loadFailedNotice).map(t => [local(t.key), t.title]))
        .toEqual([[Resources.firstLaunchLoad, Resources.firstLaunchNotLoaded], [Resources.toolsLoad, Resources.toolsNotLoaded]]);
      await store.reload();
      expect(loads()).toEqual([Resources.firstLaunchLoad, Resources.toolsLoad]);
      await store.readFirstLaunch(async () => {
        retried += 1;
        await store.readFirstLaunch();
      });

      context.answer(MethodName.FirstLaunchRead, () => new FirstLaunch(null).toJson()).answer(MethodName.ProviderToolList, () => []);
      await store.reload();

      expect(retried).toBe(1);
      await Wait.until(() => expect(loads()).toEqual([]));
    });

    it("posts a failed chat action by its action and target, with Open chat for a chat's, and keeps it through later successes", async () => {
      await store.initialize();
      context.fail(MethodName.ConversationRename, "The title is taken.");
      await store.renameConversation("c1", "Other");
      context.answer(MethodName.ConversationRename, t => SampleData.conversation.withTitle(ConversationRenameParams.fromJson(t).title, SampleData.timestamp).toJson());
      await store.renameConversation("c1", "Renamed");
      store.reportFailure(ChatAction.CopyImage, "image-1", Resources.imageCopyFailed, null);

      expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title, t.text, t.open, t.actions])).toEqual([
        [Resources.formatNoticeKey(ChatAction.RenameChat, "c1"), Resources.chatActionTitles[ChatAction.RenameChat], "The title is taken.", openChat("c1"), []],
        [Resources.formatNoticeKey(ChatAction.CopyImage, "image-1"), Resources.chatActionTitles[ChatAction.CopyImage], Resources.imageCopyFailed, null, []]
      ]);
    });

    it("gives a page's or dialog's failure to its report instead of a notice", async () => {
      new TeammateFixture(context);
      context.fail(MethodName.TeammateUpdate, "That name is taken.").fail(MethodName.ProviderCheck, "codex was not found");
      await store.initialize();
      const reported: string[] = [];

      expect(await store.saveTeammate(new TeammateUpdateParams("alice", "Bob", null, "a1", Harness.Provider, null, null), t => reported.push(t))).toBe(false);
      await store.checkProvider("a1", t => reported.push(t));

      expect(reported).toEqual([Resources.formatTeammateError("Bob", "That name is taken."), "codex was not found"]);
      expect(context.shownNotices()).toEqual([]);
    });
  });
});
