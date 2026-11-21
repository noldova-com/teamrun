/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, InjectionToken, type Signal, type WritableSignal, computed, inject, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { CommandRun, NotificationAction, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { type LaunchedTerminal, TerminalLaunch, TerminalLauncher, type TerminalShellKind } from "@noldova/terminal.window";
import {
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalStatus,
  AttachmentContent,
  type AttachmentInput,
  AttachmentReadParams,
  AttachmentShare,
  AuthStatus,
  ChatFolderAttachParams,
  ChatIdParams,
  ChatMemberModeParams,
  ChatMemberSettings,
  ChatMemberSettingsParams,
  ChatPlanFirstParams,
  ComputerUseGrant,
  ComputerUseGrantIdParams,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMember,
  ConversationMemberParams,
  ConversationMoveParams,
  ConversationPosition,
  ConversationRenameParams,
  type ConversationResponder,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  type ConversationSearchHit,
  ConversationSearchParams,
  ChatFindParams,
  ChatFindResult,
  MessageSearchResult,
  DataFolder,
  DefaultTeammate,
  DefaultTeammateSetParams,
  DetailEventPayload,
  type DiscoveredProfile,
  Draft,
  DraftDiscardParams,
  type DraftSaveParams,
  Event,
  ErrorCode,
  EventName,
  FirstLaunch,
  LinkedPaths,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDelivery,
  type MessageDetail,
  MessageIdParams,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  MethodName,
  NameOrder,
  OutsideConnection,
  type OwnMcpServer,
  PlanUsage,
  PlanUsageParams,
  Project,
  ProjectFolderChange,
  ProjectIdParams,
  ProjectListing,
  ProjectOpenParams,
  ProfileFolderPath,
  Provider,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  ProviderSignIns,
  ProviderMcpServerList,
  ProviderUpdateParams,
  ProviderKind,
  ProviderKindParams,
  ProviderKindInstallation,
  ProviderKindInstallState,
  ProviderListModelsParams,
  ProviderModelList,
  type ProviderProfile,
  ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  ProviderTool,
  type QuestionAnswer,
  ReadingPositionSaveParams,
  ReplySummary,
  Resources as ProtocolResources,
  SharedMcpProviderSetParams,
  SharedMcpSecret,
  SharedMcpSecretSetParams,
  SharedMcpSignInStarted,
  AcpAgentIdParams,
  AcpAgentListing,
  AcpLocalCommandAddParams,
  ProviderSignInCommand,
  SharedMcpServer,
  type SharedMcpServerDefinition,
  SharedMcpServerIdParams,
  SharedMcpServerListing,
  SharedMcpServerUpdateParams,
  type SharedMcpSetting,
  SharedMcpTeammateSetParams,
  SignInLinkPayload,
  Teammate,
  type TeammateCreateParams,
  TeammateIdParams,
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
import { LinkGesture } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ChatAction } from "../enums/chat-action";
import { SendKey } from "../enums/send-key";
import { TeammateStopReason } from "../enums/teammate-stop-reason";
import { TerminalStep } from "../enums/terminal-step";
import { DraftStaleException } from "../exceptions/draft-stale.exception";
import { FileGrantException } from "../exceptions/file-grant.exception";
import { ListNotArrayException } from "../exceptions/list-not-array.exception";
import { ModelCatalogUnavailableException } from "../exceptions/model-catalog-unavailable.exception";
import type { ITerminalLauncher } from "../interfaces/i-terminal-launcher";
import type { AcpLocalVariable } from "../models/acp-local-variable";
import { ApprovalAnswer } from "../models/approval-answer";
import { ChatContext } from "../models/chat-context";
import { ChatSpeed } from "../models/chat-speed";
import { ChatThread } from "../models/chat-thread";
import { ComposerSettings } from "../models/composer-settings";
import { ConversationHistorySource } from "../models/conversation-history-source";
import { ConversationWindow } from "../models/conversation-window";
import { FileShare } from "../models/file-share";
import type { MessageControlState } from "../models/message-control-state";
import { MessageFocus } from "../models/message-focus";
import { MessageIndex } from "../models/message-index";
import type { MessageIndexEntry } from "../models/message-index-entry";
import type { ModelCatalog } from "../models/model-catalog";
import type { ProviderChoice } from "../models/provider-choice";
import { ReadingPosition } from "../models/reading-position";
import { RewoundDraft } from "../models/rewound-draft";
import type { ProviderAction } from "../types/provider-action";
import { ErrorNotices } from "./error-notices";
import { FormatterService } from "./formatter.service";
import { ModelCatalogCache } from "./model-catalog-cache";

export class ChatStoreService {
  public static readonly terminals: InjectionToken<ITerminalLauncher> =
    new InjectionToken<ITerminalLauncher>(Resources.terminalLauncherToken, { factory: (): ITerminalLauncher => TerminalLauncher });
  public static readonly provider: FactoryProvider = {
    provide: ChatStoreService,
    useFactory: (): ChatStoreService => ChatStoreService.of(inject(WindowPartTokens.context), inject(ChatStoreService.terminals))
  };

  private static readonly ACTIVE_STATUSES: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  private static readonly stores: WeakMap<IWindowPartContext, ChatStoreService> = new WeakMap();
  private static readonly sustainFields: readonly string[] = [ProtocolResources.sustainField, ProtocolResources.fallbacksField, ProtocolResources.resetsSoonestFirstField];

  private readonly context: IWindowPartContext;
  private readonly terminals: ITerminalLauncher;
  private readonly notices: ErrorNotices;
  private readonly retries: Map<string, () => Promise<unknown>> = new Map();
  private readonly unsent: Map<string, { readonly providerId: string | null; readonly teammateId: string | null }> = new Map();
  private readonly actionChats: Map<string, string> = new Map();
  private readonly kindsSignal: WritableSignal<readonly ProviderKind[]> = signal([]);
  private readonly kindsFailedSignal: WritableSignal<boolean> = signal(false);
  private readonly kindsLoadedSignal: WritableSignal<boolean> = signal(false);
  private readonly kindLoadsSignal: WritableSignal<number> = signal(0);
  private readonly welcomingSignal: WritableSignal<boolean> = signal(false);
  private readonly providersSignal: WritableSignal<readonly Provider[]> = signal([]);
  private readonly signingInSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly signInLinksSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly terminalSessionsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly terminalSignInsSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly signInCommandsSignal: WritableSignal<ReadonlyMap<string, string | null>> = signal(new Map());
  private readonly unfinishedSignInsSignal: WritableSignal<ReadonlyMap<string, string | null>> = signal(new Map());
  private readonly openSignInTerminalsSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly terminalStops: Map<string, () => Promise<void>> = new Map();
  private readonly terminalSignOutsSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly signOutStops: Map<string, () => Promise<void>> = new Map();
  private readonly signOutRuns: Map<string, Promise<boolean | null>> = new Map();
  private readonly installStops: Map<string, () => Promise<void>> = new Map();
  private readonly leavingProviders: Set<string> = new Set();
  private readonly runningSignInsSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly installationsSignal: WritableSignal<ReadonlyMap<string, ProviderKindInstallation>> = signal(new Map());
  private readonly toolsSignal: WritableSignal<ReadonlyMap<string, ProviderTool>> = signal(new Map());
  private readonly toolInstallsSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly teammatesSignal: WritableSignal<readonly Teammate[]> = signal([]);
  private readonly teammateMovesSignal: WritableSignal<ReadonlyMap<string, ProviderChoice>> = signal(new Map());
  private readonly teammateEdits: Map<string, Promise<boolean>> = new Map();
  private readonly savedMoves: Map<string, ProviderChoice> = new Map();
  private readonly defaultTeammateSignal: WritableSignal<DefaultTeammate | null> = signal(null);
  private readonly defaultTeammateAskedSignal: WritableSignal<boolean> = signal(false);
  private readonly planUsagesSignal: WritableSignal<readonly PlanUsage[]> = signal([]);
  private readonly chatContextsSignal: WritableSignal<readonly ChatContext[]> = signal([]);
  private readonly chatSpeedsSignal: WritableSignal<readonly ChatSpeed[]> = signal([]);
  private readonly chatThreadsSignal: WritableSignal<readonly ChatThread[]> = signal([]);
  private readonly steersSignal: WritableSignal<readonly Message[]> = signal([]);
  private readonly planReads: Set<string> = new Set();
  private readonly membersSignal: WritableSignal<readonly ConversationMember[]> = signal([]);
  private readonly projectsSignal: WritableSignal<readonly Project[]> = signal([]);
  private readonly missingFoldersSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly setAsideConversationIdSignal: WritableSignal<string | null> = signal(null);
  private readonly openingConversationIdSignal: WritableSignal<string | null> = signal(null);
  private readonly conversationsByProjectSignal: WritableSignal<ReadonlyMap<string | null, readonly Conversation[]>> = signal(new Map());
  private readonly windowsSignal: WritableSignal<ReadonlyMap<string, ConversationWindow>> = signal(new Map());
  private readonly messageIndexes: Map<string, MessageIndex> = new Map();
  private readonly positions: Map<string, ReadingPosition> = new Map();
  private readonly unsavedPositions: Set<string> = new Set();
  private readonly droppedPositions: Map<string, ReadingPosition> = new Map();
  private readonly forgottenPositions: Set<string> = new Set();
  private savingPositions: Promise<void> | null = null;
  private readonly responderWrites: Map<string, Promise<ConversationResponder | null>> = new Map();
  private readonly deletionWatchers: Set<(conversationId: string) => void> = new Set();
  private readonly replyEndWatchers: Set<(message: Message) => void> = new Set();
  private readonly shownWatchers: Set<(conversationId: string | null) => void> = new Set();
  private readonly kindWatchers: Set<() => void> = new Set();
  private announcedShownId: string | null = null;
  private readonly deletedIds: Set<string> = new Set();
  private readonly confirmations: Map<string, Promise<boolean>> = new Map();
  private readonly approvalsSignal: WritableSignal<readonly Approval[]> = signal([]);
  private readonly approvalsByMessage: Signal<ReadonlyMap<string, readonly Approval[]>> = computed(() => ChatStoreService.byMessage(this.approvalsSignal()));
  private readonly answersSignal: WritableSignal<ReadonlyMap<string, ApprovalAnswer>> = signal(new Map());
  private readonly selectedProjectIdSignal: WritableSignal<string | null> = signal(null);
  private readonly selectedConversationIdSignal: WritableSignal<string | null> = signal(null);
  private readonly cancellingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly stoppingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly conversationsInViewSignal: WritableSignal<readonly string[]> = signal([]);
  private readonly focusSignal: WritableSignal<MessageFocus | null> = signal(null);
  private readonly planFocusSignal: WritableSignal<MessageFocus | null> = signal(null);
  private readonly subAgentFocusSignal: WritableSignal<MessageFocus | null> = signal(null);
  private readonly rewoundDraftSignal: WritableSignal<RewoundDraft | null> = signal(null);
  private readonly workingSignal: WritableSignal<ReadonlyMap<string, Message>> = signal(new Map());
  private readonly replyChatsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly replyTeammatesSignal: WritableSignal<ReadonlyMap<string, string | null>> = signal(new Map());
  private readonly resolvingChats: Set<string> = new Set();
  private readonly arrivedMessages: Map<string, string> = new Map();
  private readonly waitingReplies: Signal<readonly string[]> = computed(() => {
    const working = this.workingSignal();
    const asking = [...working.values()].filter(t => t.status === MessageStatus.AwaitingApproval).map(t => t.id);
    return [...new Set([...asking, ...this.pendingApprovals().map(t => t.messageId).filter(t => !working.has(t))])];
  });
  private readonly workingTabs: Map<string, () => void> = new Map();
  private readonly thinkingSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly savingCheckpointSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly busySignal: WritableSignal<number> = signal(0);
  private readonly loadedSignal: WritableSignal<boolean> = signal(false);
  private readonly resyncsSignal: WritableSignal<number> = signal(0);
  private readonly invalidationsSignal: WritableSignal<number> = signal(0);
  private readonly sendKeySignal: WritableSignal<SendKey> = signal(SendKey.Enter);
  private readonly whileReplyingSignal: WritableSignal<MessageDelivery> = signal(MessageDelivery.Steer);
  private readonly waitingSignal: WritableSignal<ReadonlyMap<string, readonly WaitingMessage[]>> = signal(new Map());
  private readonly snapshots: Set<Map<string, Event>> = new Set();
  private readonly linkedFolders: Map<string, Map<string, Promise<boolean>>> = new Map();
  private readonly membersTickets: Map<string, number> = new Map();
  private membersGeneration: number = 0;
  private selectionGeneration: number = 0;
  private openTicket: number = 0;
  private shownOpenTicket: number = 0;
  private requestedConversationId: string | null = null;
  private requestedWindow: ConversationWindow | null = null;
  private selectedWindow: ConversationWindow | null = null;
  private catalogReload: Promise<boolean> | null = null;
  private kindLoad: Promise<void> | null = null;
  private kindRequests: number = 0;
  private kindsApplied: number = 0;
  private catalogDirty: boolean = false;
  private resyncRequested: boolean = false;
  private disposed: boolean = false;
  private subscriptions: readonly (() => void)[] = [];
  private watchSubscriptions: readonly (() => void)[] = [];
  private watchedMessages: Map<string, Message> | null = null;

  public readonly windowId: string = crypto.randomUUID();
  public readonly kinds: Signal<readonly ProviderKind[]> = this.kindsSignal.asReadonly();
  public readonly invalidations: Signal<number> = this.invalidationsSignal.asReadonly();
  public readonly kindsFailed: Signal<boolean> = this.kindsFailedSignal.asReadonly();
  public readonly welcoming: Signal<boolean> = this.welcomingSignal.asReadonly();
  public readonly kindsLoaded: Signal<boolean> = this.kindsLoadedSignal.asReadonly();
  public readonly loadingKinds: Signal<boolean> = computed(() => this.kindLoadsSignal() > 0);
  public readonly providers: Signal<readonly Provider[]> = computed(() => NameOrder.sort(this.providersSignal(), t => t.label));
  public readonly enabledProviders: Signal<readonly Provider[]> = computed(() => this.providers().filter(t => t.enabled));
  public readonly signingIn: Signal<ReadonlySet<string>> = computed(() => new Set([...this.signingInSignal(), ...this.runningSignInsSignal()]));
  public readonly installations: Signal<ReadonlyMap<string, ProviderKindInstallation>> = this.installationsSignal.asReadonly();
  public readonly tools: Signal<ReadonlyMap<string, ProviderTool>> = this.toolsSignal.asReadonly();
  public readonly toolInstalls: Signal<ReadonlySet<string>> = this.toolInstallsSignal.asReadonly();
  public readonly signInLinks: Signal<ReadonlyMap<string, string>> = this.signInLinksSignal.asReadonly();
  public readonly terminalSessions: Signal<ReadonlyMap<string, string>> = this.terminalSessionsSignal.asReadonly();
  public readonly terminalSignIns: Signal<ReadonlySet<string>> = this.terminalSignInsSignal.asReadonly();
  public readonly signInCommands: Signal<ReadonlyMap<string, string | null>> = this.signInCommandsSignal.asReadonly();
  public readonly unfinishedSignIns: Signal<ReadonlyMap<string, string | null>> = this.unfinishedSignInsSignal.asReadonly();
  public readonly openSignInTerminals: Signal<ReadonlySet<string>> = this.openSignInTerminalsSignal.asReadonly();
  public readonly terminalSignOuts: Signal<ReadonlySet<string>> = this.terminalSignOutsSignal.asReadonly();
  public readonly teammates: Signal<readonly Teammate[]> = computed(() => NameOrder.sort(this.teammatesSignal(), t => t.name));
  public readonly teammateMoves: Signal<ReadonlyMap<string, ProviderChoice>> = this.teammateMovesSignal.asReadonly();
  public readonly defaultTeammate: Signal<DefaultTeammate | null> = this.defaultTeammateSignal.asReadonly();
  public readonly onlyTeammateChoice: Signal<ComposerSettings | null> = computed(() => {
    const [only, ...others] = this.teammates();
    const provider = this.enabledProviders().find(t => t.id === only?.providerId);
    return others.length > 0 || Object.isUndefined(provider) ? null : new ComposerSettings(provider.kind, null, null, provider.id);
  });
  public readonly defaultTeammateAsked: Signal<boolean> = this.defaultTeammateAskedSignal.asReadonly();
  public readonly projects: Signal<readonly Project[]> = this.projectsSignal.asReadonly();
  public readonly conversations: Signal<readonly Conversation[]> = computed(() => this.conversationsOf(this.selectedProjectId()));
  public readonly history: Signal<ConversationHistorySource | null> = computed(() => this.historyOf(this.selectedConversationId()));
  public readonly messageIndex: Signal<readonly MessageIndexEntry[]> = computed(() => this.messageIndexOf(this.selectedConversationId()));
  public readonly pendingPosition: Signal<ReadingPosition | null> = computed(() => this.pendingPositionOf(this.selectedConversationId()));
  public readonly selectedProjectId: Signal<string | null> = this.selectedProjectIdSignal.asReadonly();
  public readonly selectedConversationId: Signal<string | null> = this.selectedConversationIdSignal.asReadonly();
  public readonly shownConversationId: Signal<string | null> = computed(() => {
    const id = this.selectedConversationIdSignal();
    const open = this.conversationsInViewSignal();
    return !Object.isNull(id) && open.includes(id) ? id : open.at(-1) ?? null;
  });
  public readonly markedConversationId: Signal<string | null> = computed(() => {
    const shown = this.shownConversationId();
    return this.openingConversationIdSignal() ?? (shown === this.setAsideConversationIdSignal() ? null : shown);
  });
  public readonly screenConversationId: Signal<string | null> = computed(() => {
    const shown = this.shownConversationId();
    return !Object.isNull(shown) && shown === this.setAsideConversationIdSignal() ? shown : this.selectedConversationId();
  });
  public readonly rewoundDraft: Signal<RewoundDraft | null> = this.rewoundDraftSignal.asReadonly();
  public readonly loaded: Signal<boolean> = this.loadedSignal.asReadonly();
  public readonly resyncs: Signal<number> = this.resyncsSignal.asReadonly();
  public readonly sendKey: Signal<SendKey> = this.sendKeySignal.asReadonly();
  public readonly whileReplying: Signal<MessageDelivery> = this.whileReplyingSignal.asReadonly();
  public readonly modelCatalogs: ModelCatalogCache = new ModelCatalogCache((kind, providerId, refresh, workingDirectory) => this.listModels(kind, providerId, refresh, workingDirectory),
    () => performance.now());
  public readonly focus: Signal<MessageFocus | null> = this.focusSignal.asReadonly();
  public readonly planFocus: Signal<MessageFocus | null> = this.planFocusSignal.asReadonly();
  public readonly subAgentFocus: Signal<MessageFocus | null> = this.subAgentFocusSignal.asReadonly();
  public readonly isBusy: Signal<boolean> = computed(() => this.busySignal() > 0);
  public readonly selectedProject: Signal<Project | null> = computed(() => this.projects().find(t => t.id === this.selectedProjectId()) ?? null);
  public readonly selectedConversation: Signal<Conversation | null> = computed(() => this.findConversation(this.selectedConversationId()));
  public readonly screenConversation: Signal<Conversation | null> = computed(() => this.findConversation(this.screenConversationId()));
  public readonly recentConversations: Signal<readonly Conversation[]> = computed(() =>
    ChatStoreService.newestFirst([...this.conversationsByProjectSignal().values()].flat()).slice(0, Resources.recentCount));
  public readonly pendingApprovals: Signal<readonly Approval[]> = computed(() => this.approvalsSignal().filter(t => t.status === ApprovalStatus.Pending));
  public readonly waitingTeammates: Signal<ReadonlySet<string>> = computed(() => {
    const teammates = this.replyTeammatesSignal();
    const asking = [...this.workingSignal().values()].filter(t => t.status === MessageStatus.AwaitingApproval).map(t => t.id);
    return new Set([...asking, ...this.pendingApprovals().map(t => t.messageId)].map(t => teammates.get(t)).filter(t => Object.isString(t)));
  });
  public readonly workingReplies: Signal<readonly Message[]> = computed(() => [...this.workingSignal().values()]);
  public readonly thinkingReplies: Signal<ReadonlySet<string>> = this.thinkingSignal.asReadonly();
  public readonly savingCheckpointReplies: Signal<ReadonlySet<string>> = this.savingCheckpointSignal.asReadonly();
  public readonly runningReply: Signal<Message | null> = computed(() => this.runningReplyOf(this.screenConversationId()));

  public constructor(context: IWindowPartContext, terminals: ITerminalLauncher = TerminalLauncher) {
    this.context = context;
    this.terminals = terminals;
    this.notices = new ErrorNotices(context);
  }

  public static of(context: IWindowPartContext, terminals: ITerminalLauncher = TerminalLauncher): ChatStoreService {
    const found = ChatStoreService.stores.get(context);
    if (!Object.isUndefined(found) && found.watchSubscriptions.length === 0)
      return found;
    const store = found ?? new ChatStoreService(context, terminals);
    ChatStoreService.stores.set(context, store);
    void untracked(() => store.initialize());
    return store;
  }

  public static watch(context: IWindowPartContext): ChatStoreService {
    const found = ChatStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new ChatStoreService(context);
    ChatStoreService.stores.set(context, store);
    store.watchSubscriptions = [
      ...[EventName.MessageCreated, EventName.MessageUpdated].map(t => context.onEvent(Resources.formatQualifiedName(t), u => store.watchMessage(Message.fromJson(u)))),
      ...[EventName.StateInvalidated, EventName.StateResyncRequested].map(t => context.onEvent(Resources.formatQualifiedName(t), () => void store.readWorking()))
    ];
    void store.readWorking();
    return store;
  }

  public static release(context: IWindowPartContext): void {
    ChatStoreService.stores.get(context)?.dispose();
    ChatStoreService.stores.delete(context);
  }

  public static resync(context: IWindowPartContext): Promise<boolean> {
    return ChatStoreService.stores.get(context)?.resync() ?? Promise.resolve(true);
  }

  public async initialize(): Promise<void> {
    this.disposed = false;
    if (this.subscriptions.length === 0) {
      this.unwatch();
      this.subscriptions = [
        ...Object.values(EventName).map(t => this.context.onEvent(Resources.formatQualifiedName(t), u => this.apply(new Event(t, u)))),
        this.context.onSettingChanged(Resources.sendKeySetting, t => this.applySendKey(t)),
        this.context.onSettingChanged(Resources.whileReplyingSetting, t => this.applyWhileReplying(t)),
        this.context.registerSave(() => this.savePositions())
      ];
      this.applySendKey(this.context.readSetting(Resources.sendKeySetting));
      this.applyWhileReplying(this.context.readSetting(Resources.whileReplyingSetting));
    }
    this.kindLoadsSignal.update(t => t + 1);
    try {
      await this.perform(async () => {
        await this.loadPositions();
        await this.loadKinds();
        await this.reloadCatalog();
      }, this.loadFailed(Resources.kindsLoad, Resources.kindsNotLoaded, null, () => this.initialize()));
    }
    finally {
      this.kindLoadsSignal.update(t => t - 1);
    }
    const first = this.projects()[0];
    if (!Object.isUndefined(first) && Object.isNull(this.selectedProjectId()))
      this.selectedProjectIdSignal.set(first.id);
  }

  public resync(): Promise<boolean> {
    this.modelCatalogs.expire();
    if (this.watchSubscriptions.length > 0)
      return this.readWorking();
    this.resyncRequested = true;
    return this.reloadCatalog();
  }

  public dispose(): void {
    this.disposed = true;
    this.selectionGeneration += 1;
    this.snapshots.clear();
    this.messageIndexes.clear();
    for (const window of this.windowsSignal().values())
      window.generation += 1;
    this.requestedWindow = null;
    this.selectedWindow = null;
    this.windowsSignal.set(new Map());
    this.teammateMovesSignal.set(new Map());
    this.unwatch();
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
    this.subscriptions = [];
    for (const clear of this.workingTabs.values())
      clear();
    this.workingTabs.clear();
    this.retries.clear();
    this.notices.dismiss(Resources.loadFailedNotice, () => true);
    this.notices.dismiss(Resources.chatActionFailedNotice, t => t === Resources.formatNoticeKey(ChatAction.ShowTerminals, this.windowId));
  }

  public async prepareAttachment(input: AttachmentInput): Promise<MessageAttachment> {
    try {
      return MessageAttachment.fromJson(await this.request(MethodName.AttachmentPrepare, input.toJson()));
    }
    catch (error) {
      if (!Object.isNull(input.grant))
        this.context.discardFileGrants([input.grant]);
      throw error;
    }
  }

  public async grantFile(file: File): Promise<string> {
    const granted = (await this.context.grantFilesAsync([file])).files[0];
    if (Object.isUndefined(granted))
      throw new FileGrantException(file.name);
    return granted.grant;
  }

  public async discardAttachment(attachment: MessageAttachment): Promise<void> {
    try {
      await this.request(MethodName.AttachmentDiscard, attachment.toJson());
    }
    catch {
    }
  }

  public async readAttachment(conversationId: string, path: string): Promise<AttachmentContent> {
    return AttachmentContent.fromJson(await this.request(MethodName.AttachmentRead, new AttachmentReadParams(conversationId, path).toJson()));
  }

  public async shareAttachment(conversationId: string, path: string): Promise<FileShare> {
    return this.fileShareOf(await this.request(MethodName.AttachmentShare, new AttachmentReadParams(conversationId, path).toJson()));
  }

  public async shareWrittenImage(conversationId: string, messageId: string, path: string): Promise<FileShare> {
    return this.fileShareOf(await this.request(MethodName.WrittenImageShare, new WrittenImageReadParams(conversationId, messageId, path).toJson()));
  }

  public async hasAttachment(conversationId: string, path: string): Promise<boolean> {
    return await this.request(MethodName.AttachmentExists, new AttachmentReadParams(conversationId, path).toJson()) !== false;
  }

  public async isLinkedFolderAsync(message: Message, path: string): Promise<boolean> {
    return (await this.linkedFoldersAsync(message, [path])).has(path);
  }

  public async linkedFoldersAsync(message: Message, paths: readonly string[]): Promise<ReadonlySet<string>> {
    const known = this.linkedFolders.get(message.conversationId) ?? new Map<string, Promise<boolean>>();
    this.linkedFolders.set(message.conversationId, known);
    const unknown = [...new Set(paths.filter(t => !known.has(t)))];
    if (unknown.length > 0) {
      const asked = this.request(MethodName.LinkedFolderList, new LinkedPaths(unknown).toJson()).then(t => LinkedPaths.fromJson(t).paths, (): readonly string[] => []);
      for (const path of unknown)
        known.set(path, asked.then(t => {
          const isFolder = t.includes(path);
          if (!isFolder)
            known.delete(path);
          return isFolder;
        }));
    }
    const folders = await Promise.all(paths.map(t => known.get(t)));
    return new Set(paths.filter((_, i) => folders[i] === true));
  }

  public async readWrittenImage(conversationId: string, messageId: string, path: string): Promise<AttachmentContent> {
    return AttachmentContent.fromJson(await this.request(MethodName.WrittenImageRead, new WrittenImageReadParams(conversationId, messageId, path).toJson()));
  }

  public async readDataFolder(): Promise<DataFolder> {
    return DataFolder.fromJson(await this.request(MethodName.DataFolderRead, null));
  }

  public async readDraft(conversationId: string): Promise<Draft | null> {
    const payload = await this.request(MethodName.DraftRead, new ConversationIdParams(conversationId).toJson());
    return Object.isNull(payload) ? null : Draft.fromJson(payload);
  }

  public async saveDraft(conversationId: string, params: () => Promise<DraftSaveParams>): Promise<Draft | null> {
    let draft: Draft | null = null;
    let stale = false;
    await this.attempt(async () => {
      const saving = await params();
      try {
        draft = Draft.fromJson(await this.request(MethodName.DraftSave, saving.toJson()));
      }
      catch (error) {
        stale = ChatStoreService.isRefusalOver(error, ErrorCode.Conflict, saving.conversationId);
        if (stale)
          return;
        if (!ChatStoreService.isRefusalOver(error, ErrorCode.NotFound, saving.conversationId))
          throw error;
        this.applyDeleted(saving.conversationId);
      }
    }, t => this.actionFailed(ChatAction.SaveDraft, conversationId, conversationId)(Resources.formatDraftNotSaved(t)));
    if (stale)
      throw new DraftStaleException();
    return draft;
  }

  public discardDraft(conversationId: string, revision: number): Promise<boolean> {
    return this.attempt(async () => {
      await this.request(MethodName.DraftDiscard, new DraftDiscardParams(conversationId, revision).toJson());
    }, this.actionFailed(ChatAction.DiscardDraft, conversationId, conversationId));
  }

  public isDeleted(conversationId: string): boolean {
    return this.deletedIds.has(conversationId);
  }

  public confirmConversation(conversationId: string): Promise<boolean> {
    if (this.deletedIds.has(conversationId))
      return Promise.resolve(false);
    if (this.hasConversation(conversationId))
      return Promise.resolve(true);
    const pending = this.confirmations.get(conversationId);
    if (!Object.isUndefined(pending))
      return pending;
    const confirmation = this.askConversation(conversationId).finally(() => this.confirmations.delete(conversationId));
    this.confirmations.set(conversationId, confirmation);
    return confirmation;
  }

  public hasConversation(conversationId: string): boolean {
    return !Object.isNull(this.findConversation(conversationId));
  }

  public conversation(conversationId: string): Conversation | null {
    return this.findConversation(conversationId);
  }

  public folderOf(conversationId: string): string | null {
    const conversation = this.findConversation(conversationId);
    return conversation?.folder ?? this.projects().find(t => t.id === conversation?.projectId)?.rootPath ?? null;
  }

  public isFolderMissing(projectId: string): boolean {
    return this.missingFoldersSignal().has(projectId);
  }

  public conversationsOf(projectId: string | null): readonly Conversation[] {
    return this.conversationsByProjectSignal().get(projectId) ?? [];
  }

  public newestConversationsOf(projectId: string | null): readonly Conversation[] {
    return ChatStoreService.newestFirst(this.conversationsOf(projectId));
  }

  public runningReplyOf(conversationId: string | null): Message | null {
    const replies = [...this.workingSignal().values()].filter(t => t.conversationId === conversationId).sort((a, b) => a.sequence - b.sequence);
    return replies.find(t => t.status !== MessageStatus.Pending) ?? replies[0] ?? null;
  }

  public takeArrived(messageId: string): boolean {
    return this.arrivedMessages.delete(messageId);
  }

  public isWorking(conversationId: string): boolean {
    return [...this.workingSignal().values()].some(t => t.conversationId === conversationId);
  }

  public isAwaitingApproval(conversationId: string): boolean {
    return this.waitingRepliesOf(conversationId).length > 0;
  }

  public isAwaitingAnswer(conversationId: string): boolean {
    const waiting = this.waitingRepliesOf(conversationId);
    return waiting.length > 0 && waiting.every(t => this.isAsking(t));
  }

  public isAsking(messageId: string): boolean {
    const pending = this.pendingApprovalsOf(messageId);
    return pending.length > 0 && pending.every(t => t.kind === ApprovalKind.Question);
  }

  public focusPlan(message: Message): void {
    this.planFocusSignal.set(new MessageFocus(message.conversationId, message.id, message.sequence));
  }

  public showPlan(focus: MessageFocus): void {
    this.planFocusSignal.set(focus);
    this.focusMessage(focus);
  }

  public clearPlanFocus(): void {
    this.planFocusSignal.set(null);
  }

  public showSubAgent(focus: MessageFocus): void {
    this.subAgentFocusSignal.set(focus);
    this.focusMessage(focus);
  }

  public clearSubAgentFocus(): void {
    this.subAgentFocusSignal.set(null);
  }

  public focusMessage(focus: MessageFocus | null): void {
    this.focusSignal.set(focus);
  }

  public historyOf(conversationId: string | null): ConversationHistorySource | null {
    return this.windowOf(conversationId)?.history() ?? null;
  }

  public async showLatest(conversationId: string): Promise<boolean> {
    const window = this.windowOf(conversationId);
    if (Object.isNull(window) || !window.isLoaded())
      return false;
    while (!Object.isNull(window.loading))
      await Promise.allSettled([window.loading]);
    if (!this.isHeld(window) || window.history()?.holdsNewest() !== false)
      return false;
    let isShown = false;
    await this.attempt(async () => {
      isShown = await this.readLatest(window);
    }, this.actionFailed(ChatAction.ShowLatest, conversationId, conversationId));
    return isShown;
  }

  public messageIndexOf(conversationId: string | null): readonly MessageIndexEntry[] {
    return this.windowOf(conversationId)?.index() ?? [];
  }

  public pendingPositionOf(conversationId: string | null): ReadingPosition | null {
    return this.windowOf(conversationId)?.pendingPosition() ?? null;
  }

  public isHistoryLoaded(conversationId: string | null): boolean {
    return this.windowOf(conversationId)?.isLoaded() ?? false;
  }

  public onConversationDeleted(watcher: (conversationId: string) => void): () => void {
    this.deletionWatchers.add(watcher);
    return () => void this.deletionWatchers.delete(watcher);
  }

  public onReplyEnded(watcher: (message: Message) => void): () => void {
    this.replyEndWatchers.add(watcher);
    return () => void this.replyEndWatchers.delete(watcher);
  }

  public onKindsChanged(watcher: () => void): () => void {
    this.kindWatchers.add(watcher);
    return () => void this.kindWatchers.delete(watcher);
  }

  public onShownConversationChanged(watcher: (conversationId: string | null) => void): () => void {
    this.shownWatchers.add(watcher);
    return () => void this.shownWatchers.delete(watcher);
  }

  public showConversation(conversationId: string): () => void {
    const window = this.holdWindow(conversationId);
    if (this.hasConversation(conversationId))
      void this.loadChat(conversationId, async () => {
        await this.waitLoaded(window);
      });
    let isHeld = true;
    return () => {
      if (isHeld)
        this.releaseWindow(window);
      isHeld = false;
    };
  }

  public messageControlsOf(conversationId: string, messageId: string): MessageControlState | null {
    this.windowOf(conversationId)?.index();
    return this.messageIndexes.get(conversationId)?.find(messageId)?.controls ?? null;
  }

  public rememberMessageControls(messageId: string, controls: MessageControlState, conversationId: string | null = this.selectedConversationId()): void {
    if (Object.isNull(conversationId))
      return;
    const entry = this.messageIndexes.get(conversationId)?.find(messageId) ?? null;
    if (!Object.isNull(entry)) {
      entry.controls = controls.hasChanges ? controls : null;
      return;
    }
    const message = this.windowOf(conversationId)?.history()?.find(messageId) ?? null;
    if (!Object.isNull(message) && controls.hasChanges)
      this.indexFor(conversationId).keep(message, controls);
  }

  public async showMessage(hit: ConversationSearchHit): Promise<void> {
    await this.selectConversation(hit.conversationId);
    if (!Object.isNull(hit.messageId) && !Object.isNull(hit.sequence) && hit.conversationId === this.selectedConversationId())
      this.focusMessage(new MessageFocus(hit.conversationId, hit.messageId, hit.sequence));
  }

  public rememberPosition(conversationId: string, position: ReadingPosition | null): void {
    const wasAtEnd = this.positions.get(conversationId)?.isFollowing ?? true;
    if (Object.isNull(position))
      this.positions.delete(conversationId);
    else
      this.positions.set(conversationId, position);
    if (!wasAtEnd || !(position?.isFollowing ?? true))
      this.unsavedPositions.add(conversationId);
  }

  public forgetPosition(conversationId: string): void {
    this.positions.delete(conversationId);
    this.unsavedPositions.add(conversationId);
    this.messageIndexes.delete(conversationId);
  }

  public async savePositions(): Promise<void> {
    while (!Object.isNull(this.savingPositions))
      await this.savingPositions;
    if (this.unsavedPositions.size === 0 && this.droppedPositions.size === 0)
      return;
    const saving = this.writePositions();
    this.savingPositions = saving;
    try {
      await saving;
    }
    finally {
      this.savingPositions = null;
    }
  }

  public consumePosition(conversationId: string | null = this.selectedConversationId()): void {
    this.windowOf(conversationId)?.pendingPosition.set(null);
  }

  public reportFailure(action: ChatAction, target: string, text: string, conversationId: string | null): void {
    this.actionFailed(action, target, conversationId)(text);
  }

  public reportNotice(action: ChatAction, target: string, text: string, conversationId: string | null): void {
    this.actionFailed(action, target, conversationId, NotificationSeverity.Info)(text);
  }

  public hasFailedLoads(): boolean {
    return this.retries.size > 0;
  }

  public async reload(): Promise<void> {
    await Promise.all([...this.retries.values()].map(t => t()));
  }

  public async reloadIn(windowId: string | null, noticeKey: string | null = null): Promise<void> {
    if (Object.isNull(windowId) || windowId === this.windowId) {
      await this.reload();
      return;
    }
    try {
      await this.request(MethodName.WindowReload, new WindowIdParams(windowId).toJson());
    }
    catch (error) {
      if (Object.isNull(noticeKey) || !ChatStoreService.isRefusalOver(error, ErrorCode.NotFound, windowId))
        throw error;
      this.notices.post(Resources.loadFailedNotice, noticeKey, Resources.windowClosedTitle, Resources.windowClosedText, null);
    }
  }

  public async openProject(rootPath: string, report: (message: string) => void = this.actionFailed(ChatAction.OpenProject, rootPath)): Promise<Project | null> {
    let opened: Project | null = null;
    const ticket = ++this.openTicket;
    await this.perform(async () => {
      const project = Project.fromJson(await this.request(MethodName.ProjectOpen, new ProjectOpenParams(rootPath).toJson()));
      this.projectsSignal.update(t => ChatStoreService.upsert(t, project));
      await this.loadConversations(project.id);
      if (ticket > this.shownOpenTicket) {
        this.shownOpenTicket = ticket;
        await this.showProject(project.id);
      }
      opened = project;
    }, report);
    return opened;
  }

  public async selectProject(projectId: string): Promise<void> {
    this.shownOpenTicket = this.openTicket;
    if (projectId === this.selectedProjectId())
      return;
    await this.perform(() => this.showProject(projectId), this.actionFailed(ChatAction.ShowProject, projectId));
  }

  public async forgetProject(projectId: string): Promise<void> {
    await this.perform(async () => {
      await this.request(MethodName.ProjectForget, new ProjectIdParams(projectId).toJson());
      this.projectsSignal.update(t => t.filter(u => u.id !== projectId));
      this.conversationsByProjectSignal.update(t => {
        const next = new Map(t);
        next.delete(projectId);
        return next;
      });
      if (this.selectedProjectId() === projectId) {
        this.selectedProjectIdSignal.set(null);
        this.deselectConversation();
      }
    }, this.actionFailed(ChatAction.ForgetProject, projectId));
  }

  public async createConversation(title: string | null, projectId: string | null = this.selectedProjectId(),
    teammateId: string | null = null, report: (message: string) => void = this.actionFailed(ChatAction.StartChat, projectId ?? String.empty)): Promise<Conversation | null> {
    this.shownOpenTicket = this.openTicket;
    let created: Conversation | null = null;
    await this.perform(async () => {
      const params = new ConversationCreateParams(projectId, title, teammateId);
      const conversation = Conversation.fromJson(await this.request(MethodName.ConversationCreate, params.toJson()));
      this.storeConversation(conversation);
      this.selectedProjectIdSignal.set(projectId);
      await this.loadMessages(conversation.id);
      if (!Object.isNull(teammateId))
        await this.loadMembers(conversation.id);
      created = conversation;
    }, report);
    return created;
  }

  public teammate(id: string | null): Teammate | null {
    return this.teammates().find(t => t.id === id) ?? null;
  }

  public planUsageOf(kind: string, providerId: string | null): PlanUsage | null {
    return this.planUsagesSignal().find(t => t.kind === kind && t.providerId === providerId) ?? null;
  }

  public planUsageOfProvider(providerId: string): PlanUsage | null {
    return this.planUsagesSignal().find(t => t.providerId === providerId) ?? null;
  }

  public contextOf(conversationId: string, teammateId: string | null): ChatContext | null {
    const context = this.chatContextsSignal().find(t => t.conversationId === conversationId && t.teammateId === teammateId) ?? null;
    return Object.isNull(teammateId) || context?.providerId === this.teammate(teammateId)?.providerId ? context : null;
  }

  public chatSpeedOf(conversationId: string, teammateId: string | null): ChatSpeed | null {
    return this.chatSpeedsSignal().find(t => t.conversationId === conversationId && t.teammateId === teammateId) ?? null;
  }

  public steersOf(replyId: string): readonly Message[] {
    return this.steersSignal().filter(t => FormatterService.steeredIntoOf(t) === replyId);
  }

  public steeredIntoOf(messageId: string): string | null {
    const steer = this.steersSignal().find(t => t.id === messageId);
    return Object.isUndefined(steer) ? null : FormatterService.steeredIntoOf(steer);
  }

  public chatThreadOf(conversationId: string, teammateId: string | null, kind: string, providerId: string | null): ChatThread | null {
    if (Object.isNull(teammateId) && this.findConversation(conversationId)?.sessionReset === true)
      return null;
    return this.chatThreadsSignal().find(t => t.conversationId === conversationId && t.teammateId === teammateId && t.kind === kind && t.providerId === providerId) ?? null;
  }

  public followedThreadOf(conversationId: string, teammateId: string | null, kind: string | null, providerId: string | null, model: string | null,
    effort: string | null): ChatThread | null {
    return Object.isNull(kind) || this.kinds().find(t => t.id === kind)?.followsOwnConfig !== true || !Object.isNull(model) || !Object.isNull(effort) ? null
      : this.chatThreadOf(conversationId, teammateId, kind, providerId ?? this.usualProviderOf(kind));
  }

  public async readPlanUsage(kind: string, providerId: string | null): Promise<void> {
    const key = ChatStoreService.planReadKey(kind, providerId);
    if (this.planReads.has(key))
      return;
    this.planReads.add(key);
    try {
      const read = await this.request(MethodName.PlanUsageRead, new PlanUsageParams(kind, providerId).toJson());
      if (Object.isNull(read))
        this.planReads.delete(key);
      else
        this.upsertPlanUsage(PlanUsage.fromJson(read));
    }
    catch {
      this.planReads.delete(key);
    }
  }

  public membersOf(conversationId: string | null): readonly ConversationMember[] {
    return this.membersSignal().filter(t => t.conversationId === conversationId);
  }

  public approvalsOf(messageId: string): readonly Approval[] {
    return this.approvalsByMessage().get(messageId) ?? [];
  }

  public pendingApprovalsOf(messageId: string): readonly Approval[] {
    return this.approvalsOf(messageId).filter(t => t.status === ApprovalStatus.Pending);
  }

  public answerOf(approvalId: string): ApprovalAnswer | null {
    return this.answersSignal().get(approvalId) ?? null;
  }

  public loadedCatalogOf(message: Message): ModelCatalog | undefined {
    const provenance = message.provenance;
    return Object.isNull(provenance) ? undefined : this.modelCatalogs.loadedOf(provenance.observed.kind ?? provenance.requested.kind, provenance.providerId);
  }

  public isReplyAuthorUnavailable(teammateId: string | null): boolean {
    return !Object.isNull(teammateId) && this.isTeammateUnavailable(teammateId);
  }

  public isTeammateUnavailable(id: string): boolean {
    return !Object.isNull(this.teammateStopReason(id));
  }

  public teammateStopReason(id: string): TeammateStopReason | null {
    return this.providerStopReason(this.teammate(id)?.providerId ?? null);
  }

  public providerStopReason(providerId: string | null): TeammateStopReason | null {
    const provider = this.providers().find(t => t.id === providerId);
    if (Object.isUndefined(provider))
      return TeammateStopReason.ProviderDeleted;
    if (!provider.enabled)
      return TeammateStopReason.ProviderTurnedOff;
    if (provider.authStatus === AuthStatus.LoggedOut)
      return TeammateStopReason.SignedOut;
    return this.hasKind(provider.kind) ? null : TeammateStopReason.KindMissing;
  }

  public isTeammateProviderDisabled(id: string): boolean {
    const teammate = this.teammate(id);
    return this.providers().find(t => t.id === teammate?.providerId)?.enabled === false;
  }

  public disabledMarkedName(teammate: Teammate): string {
    return this.isTeammateProviderDisabled(teammate.id) ? Resources.formatProviderDisabled(teammate.name) : teammate.name;
  }

  public listedName(teammate: Teammate): string {
    if (this.isTeammateProviderDisabled(teammate.id))
      return Resources.formatProviderDisabled(teammate.name);
    return this.isTeammateUnavailable(teammate.id) ? Resources.formatUnavailable(teammate.name) : teammate.name;
  }

  public hasKind(kind: string): boolean {
    return this.kindsSignal().some(t => t.id === kind);
  }

  public isRetiredKind(kind: string): boolean {
    return this.kindsLoadedSignal() && !this.hasKind(kind);
  }

  public async saveTeammate(params: TeammateCreateParams | TeammateUpdateParams, report?: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void): Promise<boolean> {
    const name = params instanceof TeammateUpdateParams ? params.name ?? this.teammate(params.teammateId)?.name ?? params.teammateId : params.name;
    return this.perform(async () => {
      const method = params instanceof TeammateUpdateParams ? MethodName.TeammateUpdate : MethodName.TeammateCreate;
      const teammate = Teammate.fromJson(await this.request(method, params.toJson()));
      if (this.teammate(teammate.id)?.providerId !== teammate.providerId)
        this.chatContextsSignal.update(t => t.filter(u => u.teammateId !== teammate.id));
      this.setTeammates(ChatStoreService.upsert(this.teammatesSignal(), teammate));
    }, (t, error) => (report ?? this.actionFailed(ChatAction.SaveTeammate, name))(Resources.formatTeammateError(name, t),
      Object.isUndefined(params.name) ? null : ChatStoreService.takenNameOf(error, params.name), ChatStoreService.refusesSustain(error),
      ChatStoreService.refusesHandOffs(error)));
  }

  public editTeammate(id: string, providerId: string, settings: (teammate: Teammate) => readonly [string | null, string | null, string | null]): Promise<boolean> {
    const move = this.teammateMovesSignal().get(id);
    return this.chainTeammateSave(id, t => {
      if (Object.isNull(t))
        return null;
      const [model, effort, speed] = settings(t);
      const moved = !Object.isUndefined(move) && this.savedMoves.get(id) === move && t.providerId === move.providerId;
      return TeammateUpdateParams.changing(t, { model, effort, speed }, moved ? t.providerId : providerId);
    });
  }

  public updateTeammate(teammateId: string, params: TeammateUpdateParams | null, report?: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void): Promise<boolean> {
    this.forgetMove(teammateId);
    return Object.isNull(params) ? Promise.resolve(true) : this.chainTeammateSave(teammateId, () => params, report);
  }

  public async moveTeammate(id: string, choice: ProviderChoice): Promise<void> {
    this.savedMoves.delete(id);
    this.teammateMovesSignal.update(t => new Map(t).set(id, choice));
    try {
      const catalog = await this.modelCatalogs.load(choice.kind, choice.providerId);
      await this.chainTeammateSave(id, t => {
        if (Object.isNull(t) || this.teammateMovesSignal().get(id) !== choice || t.providerId === choice.providerId)
          return null;
        const [model, effort, speed] = ChatStoreService.movedSettings(t, catalog);
        return TeammateUpdateParams.changing(t, { providerId: choice.providerId, model, effort, speed, mode: null });
      }, undefined, () => this.savedMoves.set(id, choice));
    }
    finally {
      if (this.teammateMovesSignal().get(id) === choice)
        this.forgetMove(id);
    }
  }

  public async createTeammate(params: TeammateCreateParams,
    report: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void = this.actionFailed(ChatAction.SaveTeammate, params.name)): Promise<Teammate | null> {
    let created: Teammate | null = null;
    await this.perform(async () => {
      const teammate = Teammate.fromJson(await this.request(MethodName.TeammateCreate, params.toJson()));
      this.setTeammates(ChatStoreService.upsert(this.teammatesSignal(), teammate));
      created = teammate;
    }, (t, error) => report(Resources.formatTeammateError(params.name, t), ChatStoreService.takenNameOf(error, params.name), ChatStoreService.refusesSustain(error),
      ChatStoreService.refusesHandOffs(error)));
    return created;
  }

  public askForDefaultTeammate(asked: boolean = true): void {
    this.defaultTeammateAskedSignal.set(asked);
  }

  public async setDefaultTeammate(defaultTeammate: DefaultTeammate | null,
    report: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void = this.actionFailed(ChatAction.SetDefaultTeammate, Resources.defaultTeammateTitle)): Promise<boolean> {
    return this.perform(async () => {
      const set = await this.request(MethodName.DefaultTeammateSet, new DefaultTeammateSetParams(defaultTeammate).toJson());
      this.defaultTeammateSignal.set(Object.isNull(set) ? null : DefaultTeammate.fromJson(set));
    }, t => report(Resources.formatDefaultTeammateError(t), null, false, false));
  }

  public async deleteTeammate(teammate: Teammate, report: (message: string) => void = this.actionFailed(ChatAction.DeleteTeammate, teammate.id)): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.TeammateDelete, new TeammateIdParams(teammate.id).toJson());
      this.teammatesSignal.update(t => t.filter(u => u.id !== teammate.id));
      this.membersSignal.update(t => t.filter(u => u.teammateId !== teammate.id));
    }, t => report(Resources.formatTeammateError(teammate.name, t)));
  }

  public async touchConversation(conversationId: string,
    report: (message: string) => void = this.actionFailed(ChatAction.StartChat, conversationId)): Promise<Conversation | null> {
    let touched: Conversation | null = null;
    await this.attempt(async () => {
      const conversation = Conversation.fromJson(await this.request(MethodName.ConversationTouch, new ConversationIdParams(conversationId).toJson()));
      this.storeConversation(conversation);
      touched = conversation;
    }, report);
    return touched;
  }

  public async listEmptyConversations(projectId: string | null,
    report: (message: string) => void = this.actionFailed(ChatAction.StartChat, projectId ?? String.empty)): Promise<readonly string[] | null> {
    let ids: readonly string[] | null = null;
    await this.attempt(async () => {
      const listed = await this.request(MethodName.ConversationListEmpty, new ConversationListParams(projectId).toJson());
      ids = ChatStoreService.readArray(listed, Conversation.fromJson).map(t => t.id);
    }, report);
    return ids;
  }

  public async listMembers(conversationId: string,
    report: (message: string) => void = this.actionFailed(ChatAction.StartChat, conversationId)): Promise<readonly ConversationMember[] | null> {
    let members: readonly ConversationMember[] | null = null;
    await this.attempt(async () => {
      const listed = await this.request(MethodName.ConversationListMembers, new ConversationIdParams(conversationId).toJson());
      members = ChatStoreService.readArray(listed, ConversationMember.fromJson).filter(t => t.conversationId === conversationId);
    }, report);
    return members;
  }

  public async addMember(conversationId: string, teammateId: string,
    report: (message: string) => void = this.actionFailed(ChatAction.AddMember, Resources.formatNoticeKey(conversationId, teammateId), conversationId)): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.ConversationAddMember, new ConversationMemberParams(conversationId, teammateId).toJson());
      await this.loadMembers(conversationId);
    }, report);
  }

  public async setMemberMode(conversationId: string, teammateId: string, mode: string | null): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.ConversationSetMemberMode, new ChatMemberModeParams(conversationId, teammateId, mode).toJson());
      await this.loadMembers(conversationId);
    }, this.actionFailed(ChatAction.SetMemberMode, Resources.formatNoticeKey(conversationId, teammateId), conversationId));
  }

  public async setMemberSettings(conversationId: string, teammateId: string, settings: ChatMemberSettings | null): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.ConversationSetMemberSettings, new ChatMemberSettingsParams(conversationId, teammateId, settings).toJson());
      await this.loadMembers(conversationId);
    }, this.actionFailed(ChatAction.SetMemberSettings, Resources.formatNoticeKey(conversationId, teammateId), conversationId));
  }

  public async setPlanFirst(conversationId: string, planFirst: boolean): Promise<boolean> {
    return this.perform(async () => {
      const params = new ChatPlanFirstParams(conversationId, planFirst);
      this.storeConversation(Conversation.fromJson(await this.request(MethodName.ConversationSetPlanFirst, params.toJson())));
    }, this.actionFailed(ChatAction.SetPlanFirst, conversationId, conversationId));
  }

  public async removeMember(conversationId: string, teammateId: string): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.ConversationRemoveMember, new ConversationMemberParams(conversationId, teammateId).toJson());
      await this.loadMembers(conversationId);
    }, this.actionFailed(ChatAction.RemoveMember, Resources.formatNoticeKey(conversationId, teammateId), conversationId));
  }

  public activateConversation(conversationId: string): Promise<void> {
    return conversationId === this.setAsideConversationIdSignal() ? Promise.resolve() : this.selectConversation(conversationId);
  }

  public async selectConversation(conversationId: string): Promise<void> {
    this.shownOpenTicket = this.openTicket;
    const conversation = this.findConversation(conversationId);
    if (Object.isNull(conversation) || (conversationId === this.selectedConversationId() && conversationId === this.requestedConversationId)) {
      this.settleOpening(conversationId);
      return;
    }
    this.setAsideConversationIdSignal.set(null);

    const select = async (): Promise<void> => {
      this.selectedProjectIdSignal.set(conversation.projectId);
      await this.loadMessages(conversationId);
    };
    await this.loadChat(conversationId, select, () => this.requestedConversationId === conversationId ? select() : this.reloadWindow(conversationId));
  }

  public conversationOpening(conversationId: string): void {
    const inView = this.conversationsInViewSignal().includes(conversationId);
    this.openingConversationIdSignal.set(inView ? null : conversationId);
    if (inView)
      void this.selectConversation(conversationId);
  }

  public conversationInView(conversationId: string): Promise<void> {
    if (this.openingConversationIdSignal() !== conversationId)
      this.openingConversationIdSignal.set(null);
    this.conversationsInViewSignal.update(t => [...t.filter(u => u !== conversationId), conversationId]);
    this.announceShown();
    return this.selectConversation(conversationId);
  }

  public conversationOutOfView(conversationId: string): void {
    this.settleOpening(conversationId);
    const inView = this.conversationsInViewSignal().filter(t => t !== conversationId);
    this.conversationsInViewSignal.set(inView);
    [...this.arrivedMessages].filter(t => t[1] === conversationId).forEach(t => this.arrivedMessages.delete(t[0]));
    this.announceShown();
    const next = inView.at(-1);
    if (!Object.isUndefined(next) && this.requestedConversationId === conversationId && Object.isNull(this.openingConversationIdSignal()))
      void this.selectConversation(next);
  }

  public deselectConversation(): void {
    this.selectionGeneration += 1;
    this.requestedConversationId = null;
    this.selectedConversationIdSignal.set(null);
    this.announceShown();
    this.holdRequested(null);
    this.holdSelected(null);
  }

  public async stepConversation(offset: number): Promise<Conversation | null> {
    const recents = this.recentConversations();
    const current = this.requestedConversationId ?? this.selectedConversationId();
    const index = recents.findIndex(t => t.id === current);
    const target = recents[index < 0 ? 0 : Math.min(recents.length - 1, Math.max(0, index + offset))];
    if (Object.isUndefined(target))
      return null;
    if (target.id !== current)
      await this.selectConversation(target.id);
    return this.selectedConversationId() === target.id ? target : null;
  }

  public moveConversation(conversationId: string, projectId: string): Promise<boolean> {
    return this.perform(async () => {
      const params = new ConversationMoveParams(conversationId, projectId);
      const conversation = Conversation.fromJson(await this.request(MethodName.ConversationMove, params.toJson()));
      this.storeConversation(conversation);
    }, this.actionFailed(ChatAction.MoveChat, conversationId, conversationId));
  }

  public attachFolder(conversationId: string, folder: string): Promise<boolean> {
    return this.perform(async () => {
      const conversation = Conversation.fromJson(await this.request(MethodName.ChatFolderAttach, new ChatFolderAttachParams(conversationId, folder).toJson()));
      this.storeConversation(conversation);
    }, this.actionFailed(ChatAction.AttachFolder, conversationId, conversationId));
  }

  public detachFolder(conversationId: string): Promise<boolean> {
    return this.perform(async () => {
      const conversation = Conversation.fromJson(await this.request(MethodName.ChatFolderDetach, new ConversationIdParams(conversationId).toJson()));
      this.storeConversation(conversation);
    }, this.actionFailed(ChatAction.DetachFolder, conversationId, conversationId));
  }

  public async renameConversation(conversationId: string, title: string): Promise<void> {
    await this.perform(async () => {
      const params = new ConversationRenameParams(conversationId, title);
      const conversation = Conversation.fromJson(await this.request(MethodName.ConversationRename, params.toJson()));
      this.storeConversation(conversation);
    }, this.actionFailed(ChatAction.RenameChat, conversationId, conversationId));
  }

  public async waitForResponderWrites(): Promise<void> {
    await Promise.all(this.responderWrites.values());
  }

  public async setResponder(conversationId: string, responder: ConversationResponder, chosen: boolean = false, start: boolean = false): Promise<void> {
    const previous = this.findConversation(conversationId);
    if (Object.isNull(previous))
      return;
    this.storeConversation(previous.withResponder(responder));
    const write = (this.responderWrites.get(conversationId) ?? Promise.resolve(previous.responder)).then(async held => {
      let stored: ConversationResponder | null = responder;
      const kept = await this.attempt(async () => {
        const chat = await this.request(MethodName.ConversationResponderSet, new ConversationResponderParams(conversationId, responder, chosen, start).toJson());
        if (!chosen)
          stored = Conversation.fromJson(chat).responder;
      }, this.actionFailed(ChatAction.SetResponder, conversationId, conversationId));
      return kept ? stored : held;
    });
    this.responderWrites.set(conversationId, write);
    const held = await write;
    if (this.responderWrites.get(conversationId) !== write)
      return;
    this.responderWrites.delete(conversationId);
    const current = this.findConversation(conversationId);
    if (held !== responder && current?.responder === responder)
      this.storeConversation(current.withResponder(held));
  }

  public async countFolderFilesAsync(conversationId: string, action: ChatAction): Promise<number | null> {
    let count: number | null = null;
    await this.perform(async () => {
      count = Number(await this.request(MethodName.ConversationFolderCount, new ConversationIdParams(conversationId).toJson()));
    }, this.actionFailed(action, conversationId, conversationId));
    return count;
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    await this.perform(async () => {
      await this.request(MethodName.ConversationDelete, new ConversationIdParams(conversationId).toJson());
      this.applyDeleted(conversationId);
    }, this.actionFailed(ChatAction.DeleteChat, conversationId, conversationId));
  }

  public async send(text: string, settings: ComposerSettings, conversationId: string | null = this.selectedConversationId(),
    attachments: readonly AttachmentInput[] = [], mentionedTeammateIds: readonly string[] = [],
    responderTeammateId: string | null = null): Promise<boolean> {
    if (Object.isNull(conversationId))
      return false;

    const succeeded = await this.perform(async () => {
      await this.sendThrough(MethodName.MessageSend,
        ChatStoreService.sendParams(text, settings, conversationId, attachments, mentionedTeammateIds, responderTeammateId).toJson());
    }, (message, error) => this.notSent(conversationId, message, error));
    if (succeeded)
      this.dismissUnsent(t => t === conversationId);
    if (succeeded && mentionedTeammateIds.length > 0)
      await this.loadChat(conversationId, () => this.loadMembers(conversationId));
    return succeeded;
  }

  public waitingOf(conversationId: string | null): readonly WaitingMessage[] {
    return Object.isNull(conversationId) ? [] : this.waitingSignal().get(conversationId) ?? [];
  }

  public async addWaiting(text: string, settings: ComposerSettings, conversationId: string, delivery: MessageDelivery,
    attachments: readonly AttachmentInput[] = [], mentionedTeammateIds: readonly string[] = [], responderTeammateId: string | null = null): Promise<boolean> {
    const params = ChatStoreService.sendParams(text, settings, conversationId, attachments, mentionedTeammateIds, responderTeammateId);
    const succeeded = await this.perform(async () => {
      await this.request(MethodName.WaitingMessageAdd, new WaitingMessageAddParams(params, delivery).toJson());
    }, (message, error) => this.notSent(conversationId, message, error));
    if (succeeded)
      this.dismissUnsent(t => t === conversationId);
    return succeeded;
  }

  public editWaiting(waiting: WaitingMessage, text: string, attachments: readonly AttachmentInput[], mentioned: readonly string[]): Promise<boolean> {
    const message = waiting.message;
    const params = new MessageSendParams(message.chatId, text, message.requested, message.providerId, attachments,
      mentioned, message.responderTeammateId);
    return this.perform(async () => {
      await this.request(MethodName.WaitingMessageEdit, new WaitingMessageEditParams(waiting.id, params).toJson());
    }, this.actionFailed(ChatAction.EditWaiting, waiting.id, waiting.chatId));
  }

  public removeWaiting(waiting: WaitingMessage): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.WaitingMessageRemove, new WaitingMessageIdParams(waiting.id).toJson());
    }, this.actionFailed(ChatAction.RemoveWaiting, waiting.id, waiting.chatId));
  }

  public sendWaitingNow(waiting: WaitingMessage): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.WaitingMessageSendNow, new WaitingMessageIdParams(waiting.id).toJson());
    }, this.actionFailed(ChatAction.SendWaitingNow, waiting.id, waiting.chatId));
  }

  public awaitsPlanApproval(message: Message): boolean {
    return this.messageIndexOf(message.conversationId).at(-1)?.id === message.id && message.awaitsPlanApproval(this.findConversation(message.conversationId));
  }

  public async approvePlan(message: Message): Promise<boolean> {
    return this.perform(async () => {
      await this.sendThrough(MethodName.MessageApprovePlan, new MessageIdParams(message.id).toJson());
    }, this.actionFailed(ChatAction.ApprovePlan, message.id, message.conversationId));
  }

  public async findChats(query: string): Promise<ChatFindResult> {
    const params = new ChatFindParams(query, Resources.searchLimit);
    const found = ChatFindResult.fromJson(await this.request(MethodName.ChatFind, params.toJson()));
    const hits = found.hits.filter(t => !this.deletedIds.has(t.chatId));
    return new ChatFindResult(hits, found.total - (found.hits.length - hits.length));
  }

  public async searchMessages(query: string): Promise<MessageSearchResult> {
    const params = new ConversationSearchParams(query, Resources.searchLimit);
    const found = MessageSearchResult.fromJson(await this.request(MethodName.MessageSearch, params.toJson()));
    const hits = found.hits.filter(t => !this.deletedIds.has(t.chatId));
    return new MessageSearchResult(hits, found.total - (found.hits.length - hits.length), found.capped);
  }

  public async rewind(target: Message, restoreFiles: boolean,
    report: (message: string) => void = this.actionFailed(ChatAction.Rewind, target.id, target.conversationId)): Promise<ConversationRewindResult | null> {
    const conversationId = target.conversationId;
    const fromSequence = this.messageIndexes.get(conversationId)?.find(target.id)?.sequence ?? target.sequence;
    let result: ConversationRewindResult | null = null;
    await this.perform(async () => {
      const params = new ConversationRewindParams(conversationId, target.id, restoreFiles);
      result = ConversationRewindResult.fromJson(await this.request(MethodName.ConversationRewind, params.toJson()));
      this.storeConversation(result.conversation);
      this.applyRewound(new ConversationRewoundPayload(conversationId, fromSequence));
      const removed = new Set(result.removedMessageIds);
      this.approvalsSignal.update(t => t.filter(u => !removed.has(u.messageId)));
    }, report);

    return result;
  }

  public offerRewoundDraft(target: Message): void {
    if (target.author === MessageAuthor.User)
      this.rewoundDraftSignal.set(RewoundDraft.of(target));
  }

  public clearRewoundDraft(): void {
    this.rewoundDraftSignal.set(null);
  }

  public isCancelling(messageId: string): boolean {
    const conversationId = this.workingSignal().get(messageId)?.conversationId;
    return this.cancellingSignal().has(messageId) || (!Object.isUndefined(conversationId) && this.isStopping(conversationId));
  }

  public async cancel(messageId: string): Promise<boolean> {
    if (this.isCancelling(messageId))
      return false;
    this.cancellingSignal.update(t => new Set([...t, messageId]));
    try {
      return await this.perform(() => ChatStoreService.unlessRefused(async () => {
        const message = Message.fromJson(await this.request(MethodName.MessageCancel, new MessageIdParams(messageId).toJson()));
        this.trackWorking(message);
        this.upsertMessage(message);
      }), this.actionFailed(ChatAction.StopReply, messageId));
    }
    finally {
      this.cancellingSignal.update(t => new Set([...t].filter(u => u !== messageId)));
    }
  }

  public isStopping(conversationId: string): boolean {
    return this.stoppingSignal().has(conversationId);
  }

  public async stop(conversationId: string): Promise<boolean> {
    if (this.isStopping(conversationId))
      return false;
    this.stoppingSignal.update(t => new Set([...t, conversationId]));
    try {
      return await this.perform(() => ChatStoreService.unlessRefused(async () => {
        const replies = ChatStoreService.readArray(await this.request(MethodName.ConversationCancel, new ConversationIdParams(conversationId).toJson()),
          Message.fromJson);
        for (const reply of replies) {
          this.trackWorking(reply);
          this.upsertMessage(reply);
        }
      }), this.actionFailed(ChatAction.StopReplies, conversationId, conversationId));
    }
    finally {
      this.stoppingSignal.update(t => new Set([...t].filter(u => u !== conversationId)));
    }
  }

  public async decide(approvalId: string, optionId: string, answers: readonly QuestionAnswer[] | null = null): Promise<boolean> {
    if (this.answerOf(approvalId)?.isSending === true)
      return false;
    const answer = ApprovalAnswer.sending(optionId, new Date());
    this.setAnswer(approvalId, answer);
    const isSettled = await this.perform(() => ChatStoreService.unlessRefused(() => this.sendDecision(approvalId, optionId, answers)),
      this.actionFailed(ChatAction.Answer, approvalId));
    this.setAnswer(approvalId, isSettled ? null : answer.failed());
    return isSettled;
  }

  public async addProvider(kind: string, label: string, profileDir: string | null,
    report: (message: string) => void = this.namedFailed(ChatAction.AddProvider, kind, label), opensTab: boolean = true): Promise<boolean> {
    return this.perform(async () => {
      const params = new ProviderCreateParams(kind, label, profileDir);
      const provider = Provider.fromJson(await this.request(MethodName.ProviderCreate, params.toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
      if (!Object.isNull(profileDir))
        void this.checkProvider(provider.id, report);
      else if (this.canSignIn(provider) && this.isInstalled(provider.kind))
        void this.signInProvider(provider.id, this.providerFailed(ChatAction.SignIn, provider.id), opensTab);
    }, report);
  }

  public async updateProvider(providerId: string, label: string, profileDir: string, binaryPath: string | null = null,
    report: (message: string) => void = this.providerFailed(ChatAction.ChangeProvider, providerId)): Promise<boolean> {
    return this.perform(async () => {
      const params = new ProviderUpdateParams(providerId, label, profileDir, null, binaryPath);
      const provider = Provider.fromJson(await this.request(MethodName.ProviderUpdate, params.toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
    }, report);
  }

  public async setProviderEnabled(providerId: string, enabled: boolean,
    report: (message: string) => void = this.providerFailed(enabled ? ChatAction.EnableProvider : ChatAction.DisableProvider, providerId)): Promise<void> {
    await this.perform(async () => {
      const params = new ProviderEnabledParams(providerId, enabled);
      if (!enabled)
        this.leavingProviders.add(providerId);
      try {
        const provider = Provider.fromJson(await this.request(MethodName.ProviderSetEnabled, params.toJson()));
        this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
        if (!enabled)
          await Promise.all([this.stopTerminalSignIn(providerId), this.stopTerminalSignOut(providerId)]);
      }
      finally {
        if (!enabled)
          this.leavingProviders.delete(providerId);
      }
    }, report);
  }

  public async switchOwnMcpServers(provider: Provider, on: boolean, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      const params = new ProviderUpdateParams(provider.id, provider.label, provider.profileDir, on);
      const updated = Provider.fromJson(await this.request(MethodName.ProviderUpdate, params.toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), updated));
    }, report);
  }

  public async listOwnMcpServers(providerId: string): Promise<readonly OwnMcpServer[] | null> {
    return ProviderMcpServerList.fromJson(await this.request(MethodName.ProviderOwnMcpServerList, new ProviderIdParams(providerId).toJson())).servers;
  }

  public async listSharedMcpServers(): Promise<readonly SharedMcpServerListing[]> {
    return ChatStoreService.readArray(await this.request(MethodName.SharedMcpServerList, null), SharedMcpServerListing.fromJson);
  }

  public async readGitHubSignedIn(): Promise<boolean> {
    try {
      return ChatStoreService.isGitHubSignedIn(await this.context.requestAsync(Resources.gitHubReadSignInMethod, null));
    }
    catch {
      return false;
    }
  }

  public onGitHubSignInChanged(listener: (signedIn: boolean) => void): () => void {
    return this.context.onEvent(Resources.gitHubSignInChangedEvent, t => listener(ChatStoreService.isGitHubSignedIn(t)));
  }

  public async saveSharedMcpServer(serverId: string | null, definition: SharedMcpServerDefinition, report: (message: string) => void): Promise<SharedMcpServer | null> {
    let saved: SharedMcpServer | null = null;
    await this.perform(async () => {
      saved = SharedMcpServer.fromJson(Object.isNull(serverId)
        ? await this.request(MethodName.SharedMcpServerCreate, definition.toJson())
        : await this.request(MethodName.SharedMcpServerUpdate, new SharedMcpServerUpdateParams(serverId, definition).toJson()));
    }, report);
    return saved;
  }

  public async saveSharedMcpSecret(serverId: string, variable: string, value: string, report: (message: string) => void): Promise<boolean> {
    const reference = `${Resources.sharedMcpSecretReferencePrefix}${crypto.randomUUID().replaceAll("-", String.empty)}`;
    return this.perform(async () => {
      await this.context.secrets.saveAsync(reference, value);
      try {
        await this.request(MethodName.SharedMcpSecretSet, new SharedMcpSecretSetParams(serverId, variable, reference).toJson());
      }
      catch (error) {
        await this.context.secrets.removeAsync(reference).catch(() => undefined);
        throw error;
      }
    }, report);
  }

  public async listAcpAgents(report: (message: string) => void): Promise<AcpAgentListing | null> {
    let listing: AcpAgentListing | null = null;
    await this.attempt(async () => {
      listing = AcpAgentListing.fromJson(await this.request(MethodName.AcpAgentList, null));
    }, report);
    return listing;
  }

  public async readAcpAgentIcon(id: string): Promise<string | null> {
    let icon: string | null = null;
    await this.attempt(async () => {
      const answer = await this.request(MethodName.AcpAgentIcon, new AcpAgentIdParams(id).toJson());
      icon = typeof answer === "string" ? answer : null;
    }, () => undefined);
    return icon;
  }

  public async addAcpAgent(id: string, report: (message: string) => void): Promise<boolean> {
    const added = await this.perform(async () => {
      await this.request(MethodName.AcpAgentAdd, new AcpAgentIdParams(id).toJson());
      await this.loadKinds(true);
    }, report);
    if (added)
      void this.installKind(id, report);
    return added;
  }

  public async addLocalAcpCommand(name: string, command: string, args: readonly string[], variables: readonly AcpLocalVariable[], report: (message: string) => void): Promise<boolean> {
    const saved: string[] = [];
    return this.perform(async () => {
      try {
        const secrets: SharedMcpSecret[] = [];
        for (const variable of variables) {
          const reference = `${Resources.sharedMcpSecretReferencePrefix}${crypto.randomUUID().replaceAll("-", String.empty)}`;
          await this.context.secrets.saveAsync(reference, variable.value);
          saved.push(reference);
          secrets.push(new SharedMcpSecret(variable.name, reference));
        }
        await this.request(MethodName.AcpLocalCommandAdd, new AcpLocalCommandAddParams(name, command, args, secrets).toJson());
      }
      catch (error) {
        await Promise.all(saved.map(t => this.context.secrets.removeAsync(t).catch(() => undefined)));
        throw error;
      }
      await this.loadKinds(true);
    }, report);
  }

  public acpAgentFailed(action: ChatAction.AddAcpAgent | ChatAction.RemoveAcpAgent, target: string, name: string): (message: string) => void {
    return this.actionFailed(action, target, null, NotificationSeverity.Error, () => Resources.formatAcpAgentActionTitle(action, name));
  }

  public async removeAcpAgent(id: string, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.AcpAgentRemove, new AcpAgentIdParams(id).toJson());
      await this.loadKinds(true);
    }, report);
  }

  public async removeSharedMcpSecret(serverId: string, variable: string, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.SharedMcpSecretSet, new SharedMcpSecretSetParams(serverId, variable, null).toJson());
    }, report);
  }

  public async deleteSharedMcpServer(serverId: string, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.SharedMcpServerDelete, new SharedMcpServerIdParams(serverId).toJson());
    }, report);
  }

  public async startSharedMcpSignIn(serverId: string, gesture: LinkGesture, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      const started = SharedMcpSignInStarted.fromJson(await this.request(MethodName.SharedMcpSignInStart, new SharedMcpServerIdParams(serverId).toJson()));
      if (!Object.isNull(started.url))
        await this.context.openLinkAsync(started.url, { gesture, place: LinkPlace.System });
    }, report);
  }

  public async signOutOfSharedMcp(serverId: string, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.SharedMcpSignOut, new SharedMcpServerIdParams(serverId).toJson());
    }, report);
  }

  public async switchSharedMcpProvider(serverId: string, providerId: string, on: boolean, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.SharedMcpProviderSet, new SharedMcpProviderSetParams(serverId, providerId, on).toJson());
    }, report);
  }

  public async setSharedMcpTeammate(serverId: string, teammateId: string, setting: SharedMcpSetting, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.SharedMcpTeammateSet, new SharedMcpTeammateSetParams(serverId, teammateId, setting).toJson());
    }, report);
  }

  public async listComputerUseGrants(): Promise<readonly ComputerUseGrant[]> {
    return ChatStoreService.readArray(await this.request(MethodName.ComputerUseGrantList, null), ComputerUseGrant.fromJson);
  }

  public async readOutsideConnection(): Promise<OutsideConnection> {
    return OutsideConnection.fromJson(await this.request(MethodName.OutsideConnectionRead, null));
  }

  public async resetOutsideToken(): Promise<OutsideConnection> {
    return OutsideConnection.fromJson(await this.request(MethodName.OutsideTokenReset, null));
  }

  public async revokeComputerUseGrant(grantId: string, report: (message: string) => void): Promise<boolean> {
    return this.perform(async () => {
      await this.request(MethodName.ComputerUseGrantRevoke, new ComputerUseGrantIdParams(grantId).toJson());
    }, report);
  }

  public async checkProvider(providerId: string, report: (message: string) => void = this.providerFailed(ChatAction.CheckProvider, providerId)): Promise<boolean> {
    return this.perform(async () => {
      const params = new ProviderIdParams(providerId);
      const provider = Provider.fromJson(await this.request(MethodName.ProviderCheck, params.toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
    }, report);
  }

  public startingProviderOf(kind: string): string | null {
    const enabled = this.enabledProviders().filter(t => t.kind === kind);
    const usual = this.usualProviderOf(kind);
    return (enabled.find(t => t.id === usual) ?? enabled[0])?.id ?? null;
  }

  public startingChoiceOf(teammateIds: readonly string[], found: ComposerSettings | null): ComposerSettings | null {
    const enabled = this.enabledProviders();
    const members = new Set(teammateIds);
    const teammate = this.teammates().find(t => members.has(t.id) && enabled.some(u => u.id === t.providerId));
    if (!Object.isUndefined(teammate)) {
      const kind = enabled.find(t => t.id === teammate.providerId)!.kind;
      return found?.kind === kind ? this.withEnabledProvider(found, teammate.providerId) : new ComposerSettings(kind, null, null, teammate.providerId);
    }
    if (!Object.isNull(found) && enabled.some(t => t.kind === found.kind))
      return this.withEnabledProvider(found, this.startingProviderOf(found.kind));
    const kind = this.kinds().find(t => enabled.some(u => u.kind === t.id));
    return Object.isUndefined(kind) ? found : new ComposerSettings(kind.id, null, null, this.startingProviderOf(kind.id));
  }

  public usualProviderOf(kind: string | null): string | null {
    const usual = this.kindsSignal().find(t => t.id === kind)?.profile?.usualFolder ?? null;
    return Object.isNull(usual) ? null : this.providersSignal().find(t => t.kind === kind && ProfileFolderPath.isSame(t.profileDir, usual))?.id ?? null;
  }

  public canSignOut(provider: Provider): boolean {
    return provider.enabled && provider.authStatus === AuthStatus.LoggedIn &&
      (this.kindsSignal().some(t => t.id === provider.kind && t.supportsSignOut) || !Object.isNull(this.signOutLaunchOf(provider)));
  }

  public signOutCommandOf(provider: Provider): string | null {
    const kind = this.kindsSignal().find(t => t.id === provider.kind);
    return Object.isUndefined(kind) || Object.isNull(this.signOutLaunchOf(provider)) ? null : kind.signOutCommand;
  }

  public async signOutProvider(providerId: string, report: (message: string) => void = this.providerFailed(ChatAction.SignOut, providerId)): Promise<boolean> {
    return this.perform(async () => {
      const provider = Provider.fromJson(await this.request(MethodName.ProviderSignOut, new ProviderIdParams(providerId).toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
    }, report);
  }

  public confirmsSignInAtPrompt(kind: string): boolean {
    return this.kindsSignal().some(t => t.id === kind && t.confirmsSignInAtPrompt);
  }

  public hasServer(provider: Provider): boolean {
    return !Object.isNull(provider.binaryPath) || this.isInstalled(provider.kind);
  }

  public canSignIn(provider: Provider): boolean {
    return this.kindsSignal().some(t => t.id === provider.kind && t.supportsSignIn) || !Object.isNull(this.terminalLaunchOf(provider, true));
  }

  public async signOutInTerminal(providerId: string, report: (message: string) => void = this.providerFailed(ChatAction.SignOut, providerId)): Promise<boolean | null> {
    if (this.terminalSignOutsSignal().has(providerId))
      return await this.signOutRuns.get(providerId)!;
    const provider = this.providersSignal().find(t => t.id === providerId);
    const launch = Object.isUndefined(provider) ? null : this.signOutLaunchOf(provider);
    if (Object.isUndefined(provider) || Object.isNull(launch))
      return false;
    const endsWithCommand = this.kindsSignal().some(t => t.id === provider.kind && t.signOutEndsWithCommand);
    const run = this.followProviderTerminal(this.terminalSignOutsSignal, this.signOutStops, providerId, launch, report,
      endsWithCommand ? null : AuthStatus.LoggedOut);
    this.signOutRuns.set(providerId, run);
    return await run;
  }

  public async stopTerminalSignOut(providerId: string): Promise<void> {
    await this.signOutStops.get(providerId)?.();
  }

  public async signInProvider(providerId: string, report: (message: string) => void = this.providerFailed(ChatAction.SignIn, providerId),
    opensTab: boolean = true): Promise<void> {
    const provider = this.providersSignal().find(t => t.id === providerId);
    const refreshing = Object.isUndefined(provider) ? null : this.refreshProfileOf(provider);
    if (!Object.isNull(refreshing) && !await refreshing.then(() => true, () => false)) {
      report(Resources.signInKindsNotRead);
      return;
    }
    const launch = Object.isUndefined(provider) ? null : this.terminalLaunchOf(provider, opensTab);
    if (!Object.isNull(launch)) {
      await this.followSignInTerminal(providerId, () => this.signInLaunchOf(providerId, launch), report);
      return;
    }
    if (this.signingIn().has(providerId))
      return;
    this.signingInSignal.update(t => new Set([...t, providerId]));
    let agentLaunch: TerminalLaunch | null = null;
    try {
      agentLaunch = await this.signInOrFindTerminalLaunch(providerId, provider, report, opensTab);
    }
    finally {
      this.signingInSignal.update(t => new Set([...t].filter(u => u !== providerId)));
      this.signInLinksSignal.update(t => new Map([...t].filter(([u]) => u !== providerId)));
    }
    if (!Object.isNull(agentLaunch))
      await this.followSignInTerminal(providerId, agentLaunch, report);
  }

  public refreshProfileOf(provider: Provider): Promise<void> | null {
    return (this.kindsSignal().find(t => t.id === provider.kind)?.profile?.personFolders.length ?? 0) > 0 ? this.loadKinds(true) : null;
  }

  public async openSignInLink(providerId: string, gesture: LinkGesture = LinkGesture.Plain,
    report: (message: string) => void = this.actionFailed(ChatAction.OpenSignInPage, providerId)): Promise<void> {
    const url = this.signInLinksSignal().get(providerId);
    if (!Object.isUndefined(url))
      await this.attempt(() => this.context.openLinkAsync(url, { gesture, place: LinkPlace.System }), report);
  }

  public async cancelSignIn(providerId: string, report: (message: string) => void = this.actionFailed(ChatAction.CancelSignIn, providerId)): Promise<void> {
    await this.attempt(async () => {
      await this.request(MethodName.ProviderSignInCancel, new ProviderIdParams(providerId).toJson());
    }, report);
  }

  public isInstalled(kind: string): boolean {
    const installation = this.installationsSignal().get(kind);
    return Object.isUndefined(installation) || installation.state === ProviderKindInstallState.Installed;
  }

  public async installKind(kind: string, report: (message: string) => void = this.kindFailed(ChatAction.InstallKind, kind)): Promise<void> {
    if (this.installationsSignal().get(kind)?.state === ProviderKindInstallState.Installing)
      return;
    await this.attempt(async () => {
      this.applyInstallation(ProviderKindInstallation.fromJson(await this.request(MethodName.ProviderKindInstall, new ProviderKindParams(kind).toJson())));
    }, report);
  }

  public async readFirstLaunch(retry: () => Promise<unknown> = () => this.readFirstLaunch()): Promise<FirstLaunch | null> {
    let firstLaunch: FirstLaunch | null = null;
    if (await this.attempt(async () => {
      firstLaunch = FirstLaunch.fromJson(await this.request(MethodName.FirstLaunchRead, null));
    }, this.loadFailed(Resources.firstLaunchLoad, Resources.firstLaunchNotLoaded, null, retry)))
      this.markLoaded(Resources.firstLaunchLoad);
    return firstLaunch;
  }

  public async finishFirstLaunch(report: (message: string) => void = this.actionFailed(ChatAction.FinishSetup, Resources.firstLaunchLoad)): Promise<boolean> {
    const finished = await this.attempt(async () => {
      FirstLaunch.fromJson(await this.request(MethodName.FirstLaunchFinish, null));
    }, report);
    if (finished)
      this.welcomingSignal.set(false);
    return finished;
  }

  public welcome(): void {
    this.welcomingSignal.set(true);
  }

  public async showChatPageAsync(conversationId: string): Promise<void> {
    const profileKey = this.conversation(conversationId)?.projectId ?? ProtocolResources.projectlessPageProfile;
    await this.context.runCommandAsync(Resources.browserOpenPageCommand, { [Resources.browserProfileKeyField]: profileKey, [Resources.browserInstanceField]: conversationId });
  }

  public showChatPage(conversationId: string): void {
    void this.showChatPageAsync(conversationId)
      .catch(() => this.reportFailure(ChatAction.OpenPage, conversationId, Resources.chatPageNotShown, conversationId));
  }

  public async openBrowser(report: (message: string) => void = this.actionFailed(ChatAction.OpenBrowser, Resources.browserLinkProfile)): Promise<void> {
    await this.attempt(async () => {
      await this.context.runCommandAsync(Resources.browserOpenPageCommand, { [Resources.browserProfileKeyField]: Resources.browserLinkProfile });
    }, report);
  }

  public async openPage(url: string, gesture: LinkGesture, report: (message: string) => void = this.actionFailed(ChatAction.OpenPage, url)): Promise<void> {
    await this.attempt(() => this.context.openLinkAsync(url, { gesture }), report);
  }

  public async openSystemPage(url: string, gesture: LinkGesture, report: (message: string) => void): Promise<void> {
    await this.attempt(() => this.context.openLinkAsync(url, { gesture, place: LinkPlace.System }), report);
  }

  public async refreshTools(report: (message: string, error: unknown) => void = this.loadFailed(Resources.toolsLoad, Resources.toolsNotLoaded, null,
    () => this.refreshTools())): Promise<boolean> {
    const isRead = await this.attempt(async () => {
      const tools = ChatStoreService.readArray(await this.request(MethodName.ProviderToolList, null), ProviderTool.fromJson);
      if (!this.disposed)
        this.toolsSignal.set(new Map(tools.map(t => [t.kind, t])));
    }, report);
    if (isRead)
      this.markLoaded(Resources.toolsLoad);
    return isRead;
  }

  public async discoverProfiles(report: (message: string, error: unknown) => void, kinds: readonly string[]): Promise<readonly DiscoveredProfile[] | null> {
    let profiles: readonly DiscoveredProfile[] | null = null;
    await this.attempt(async () => {
      profiles = ProviderProfileDiscovery.fromJson(await this.request(MethodName.ProviderProfileDiscover, new ProviderProfileDiscoverParams(kinds).toJson())).profiles;
    }, report);
    return profiles;
  }

  public async installTool(kind: string, report?: (message: string) => void, opensTab: boolean = true): Promise<void> {
    const command = this.toolsSignal().get(kind)?.installCommand ?? null;
    const displayName = this.kindsSignal().find(t => t.id === kind)?.displayName ?? kind;
    if (Object.isNull(command) || this.toolInstallsSignal().has(kind))
      return;
    this.toolInstallsSignal.update(t => new Set([...t, kind]));
    let waiting = true;
    const release = (): void => {
      if (waiting)
        this.toolInstallsSignal.update(t => new Set([...t].filter(u => u !== kind)));
      waiting = false;
    };
    const launch = new TerminalLaunch(null, {}, Resources.terminalInstallNotice, Resources.formatTerminalInstallTitle(displayName), command, opensTab,
      ChatStoreService.minimumRowsOf(opensTab), ChatStoreService.providerShellKinds());
    await this.followTerminal(this.installStops, kind, launch, release, report ?? this.kindFailed(ChatAction.InstallTool, kind),
      async () => !this.disposed && await this.refreshTools(report) && this.toolsSignal().get(kind)?.found === true);
  }

  public async refreshInstallations(): Promise<void> {
    await this.attempt(async () => {
      const installations = ChatStoreService.readArray(await this.request(MethodName.ProviderKindInstallationList, null), ProviderKindInstallation.fromJson);
      this.installationsSignal.set(new Map(installations.map(t => [t.kind, t])));
    }, () => undefined);
  }

  public async cancelInstall(kind: string, report: (message: string) => void = this.actionFailed(ChatAction.CancelInstall, kind)): Promise<void> {
    await this.attempt(async () => {
      await this.request(MethodName.ProviderKindInstallCancel, new ProviderKindParams(kind).toJson());
    }, report);
  }

  public async stopTerminalSignIn(providerId: string): Promise<void> {
    await this.terminalStops.get(providerId)?.();
  }

  public async removeProvider(providerId: string, report: (message: string) => void = this.providerFailed(ChatAction.RemoveProvider, providerId)): Promise<void> {
    await this.perform(async () => {
      this.leavingProviders.add(providerId);
      try {
        await this.request(MethodName.ProviderDelete, new ProviderIdParams(providerId).toJson());
        this.providersSignal.update(t => t.filter(u => u.id !== providerId));
        this.defaultTeammateSignal.update(t => t?.providerId === providerId ? null : t);
        await Promise.all([this.stopTerminalSignIn(providerId), this.stopTerminalSignOut(providerId)]);
      }
      finally {
        this.leavingProviders.delete(providerId);
      }
    }, report);
  }

  public async listModels(kind: string, providerId: string | null, refresh: boolean = false, workingDirectory: string | null = null): Promise<ProviderModelList> {
    const payload = await this.request(MethodName.ProviderModelCatalog, new ProviderListModelsParams(kind, providerId, refresh, workingDirectory).toJson());
    if (Object.isNull(payload) || typeof payload !== "object")
      throw new ModelCatalogUnavailableException(kind, providerId);
    return ProviderModelList.fromJson(payload);
  }

  private fileShareOf(answer: JsonValue): FileShare {
    const grant = AttachmentShare.fromJson(answer).grant;
    return new FileShare(this.context.fileAddressOf(grant), () => this.context.discardFileGrants([grant]));
  }

  private announceShown(): void {
    const shown = untracked(() => this.shownConversationId());
    if (shown === this.announcedShownId)
      return;
    this.announcedShownId = shown;
    for (const watcher of [...this.shownWatchers])
      watcher(shown);
  }

  private async askConversation(conversationId: string): Promise<boolean> {
    const key = Resources.formatNoticeKey(Resources.chatLoad, conversationId);
    let exists = true;
    const isAsked = await this.attempt(async () => {
      try {
        await this.request(MethodName.ConversationListMembers, new ConversationIdParams(conversationId).toJson());
      }
      catch (error) {
        if (!ChatStoreService.isRefusalOver(error, ErrorCode.NotFound, conversationId))
          throw error;
        exists = false;
        this.applyDeleted(conversationId);
      }
    }, this.loadFailed(key, Resources.chatNotLoaded, conversationId, () => this.confirmConversation(conversationId)));
    if (isAsked)
      this.markLoaded(key);
    return exists;
  }

  private async loadPositions(): Promise<void> {
    try {
      for (const stored of ChatStoreService.readArray(await this.request(MethodName.ReadingPositionList, null), ConversationPosition.fromJson))
        if (!this.positions.has(stored.conversationId))
          this.positions.set(stored.conversationId, new ReadingPosition(stored.messageId, stored.sequence, stored.distance));
    }
    catch {
      return;
    }
  }

  private async writePositions(): Promise<void> {
    const ids = [...this.unsavedPositions];
    const dropped = [...this.droppedPositions].filter(([id]) => !this.unsavedPositions.has(id));
    this.unsavedPositions.clear();
    this.droppedPositions.clear();
    this.forgottenPositions.clear();
    const positions: ConversationPosition[] = [];
    const cleared: string[] = [];
    for (const id of ids) {
      const position = this.positions.get(id);
      if (Object.isUndefined(position) || position.isFollowing)
        cleared.push(id);
      else
        positions.push(new ConversationPosition(id, position.messageId, position.sequence, position.distance));
    }
    try {
      await this.request(MethodName.ReadingPositionSave, new ReadingPositionSaveParams(positions, cleared,
        dropped.map(([id, position]) => new ConversationPosition(id, position.messageId, position.sequence, position.distance))).toJson());
    }
    catch {
      for (const id of ids.filter(t => !this.forgottenPositions.has(t)))
        this.unsavedPositions.add(id);
      for (const [id, position] of [...dropped, ...this.droppedPositions])
        this.droppedPositions.set(id, position);
    }
  }

  private dropPosition(conversationId: string, position: ReadingPosition): void {
    this.positions.delete(conversationId);
    this.unsavedPositions.delete(conversationId);
    this.droppedPositions.set(conversationId, position);
    this.forgottenPositions.add(conversationId);
  }

  private withEnabledProvider(settings: ComposerSettings, providerId: string | null): ComposerSettings {
    return this.enabledProviders().some(t => t.id === settings.providerId && t.kind === settings.kind) ? settings : settings.withProvider(providerId);
  }

  private static sendParams(text: string, settings: ComposerSettings, conversationId: string, attachments: readonly AttachmentInput[],
    mentionedTeammateIds: readonly string[], responderTeammateId: string | null): MessageSendParams {
    const named = mentionedTeammateIds.length > 0 || !Object.isNull(responderTeammateId);
    return new MessageSendParams(conversationId, text, named ? null : settings.toRequested(),
      named ? null : settings.providerId, attachments, mentionedTeammateIds, responderTeammateId);
  }

  private async sendThrough(method: MethodName, parameters: JsonValue): Promise<MessageSendResult> {
    const events = this.beginSnapshot();
    try {
      const result = MessageSendResult.fromJson(await this.request(method, parameters));
      this.upsertMessage(result.sent);
      for (const reply of result.replies) {
        this.trackWorking(reply);
        this.upsertMessage(reply);
      }
      this.replaySnapshot(events);
      return result;
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private static isGitHubSignedIn(signIn: JsonValue): boolean {
    return typeof signIn === "object" && !Object.isNull(signIn)
      && Object.entries(signIn).some(([key, value]) => key === Resources.gitHubStateField && value === Resources.gitHubSignedInState);
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }

  private apply(event: Event): void {
    switch (event.name) {
      case EventName.MessageCreated:
      case EventName.MessageUpdated: {
        const message = Message.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.MessageUpdated, message.id]));
        if (event.name === EventName.MessageCreated && message.author === MessageAuthor.User)
          this.dismissUnsent(t => t === message.conversationId);
        if (event.name === EventName.MessageCreated && this.conversationsInViewSignal().includes(message.conversationId))
          this.arrivedMessages.set(message.id, message.conversationId);
        this.trackWorking(message);
        this.upsertMessage(message);
        this.chatContextsSignal.update(t => ChatContext.merge(t, ChatContext.ofMessage(message)));
        this.chatSpeedsSignal.update(t => ChatSpeed.merge(t, ChatSpeed.ofMessage(message)));
        this.chatThreadsSignal.update(t => ChatThread.merge(t, ChatThread.ofMessage(message)));
        this.rememberSteers([message]);
        break;
      }
      case EventName.PlanUsageUpdated:
        this.upsertPlanUsage(PlanUsage.fromJson(event.payload));
        break;
      case EventName.DetailAppended:
      case EventName.DetailUpdated: {
        const payload = DetailEventPayload.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.DetailUpdated, payload.messageId, payload.detail.sequence]));
        this.captureEvent(new Event(EventName.ReplyCheckpointEnded, new MessageIdParams(payload.messageId).toJson()),
          JSON.stringify([EventName.ReplyCheckpointStarted, payload.messageId]));
        this.stopThinking(payload.messageId);
        this.stopSavingCheckpoint(payload.messageId);
        this.applyDetail(payload);
        break;
      }
      case EventName.ReplyThinking: {
        const messageId = MessageIdParams.fromJson(event.payload).messageId;
        if (this.workingSignal().has(messageId))
          this.thinkingSignal.update(t => new Set(t).add(messageId));
        break;
      }
      case EventName.ReplyCheckpointStarted: {
        const messageId = MessageIdParams.fromJson(event.payload).messageId;
        this.captureEvent(event, JSON.stringify([EventName.ReplyCheckpointStarted, messageId]));
        if (this.workingSignal().has(messageId))
          this.savingCheckpointSignal.update(t => new Set(t).add(messageId));
        break;
      }
      case EventName.ReplyCheckpointEnded: {
        const messageId = MessageIdParams.fromJson(event.payload).messageId;
        this.captureEvent(event, JSON.stringify([EventName.ReplyCheckpointStarted, messageId]));
        this.stopSavingCheckpoint(messageId);
        break;
      }
      case EventName.WaitingMessagesChanged: {
        const payload = WaitingMessagesPayload.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.WaitingMessagesChanged, payload.chatId]));
        this.setWaiting(payload);
        break;
      }
      case EventName.ApprovalCreated:
      case EventName.ApprovalUpdated: {
        const approval = Approval.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ApprovalUpdated, approval.id]));
        this.upsertApproval(approval);
        break;
      }
      case EventName.ProviderUpdated: {
        const provider = Provider.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ProviderUpdated, provider.id]));
        if (provider.authStatus === AuthStatus.LoggedIn && this.providersSignal().find(t => t.id === provider.id)?.authStatus !== AuthStatus.LoggedIn)
          this.planReads.delete(ChatStoreService.planReadKey(provider.kind, provider.id));
        this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
        break;
      }
      case EventName.ProviderSignInsChanged: {
        const signIns = ProviderSignIns.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ProviderSignInsChanged]));
        this.runningSignInsSignal.set(new Set(signIns.providerIds));
        break;
      }
      case EventName.ProviderKindInstallationChanged: {
        const installation = ProviderKindInstallation.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ProviderKindInstallationChanged, installation.kind]));
        this.applyInstallation(installation);
        break;
      }
      case EventName.ProviderKindsChanged: {
        this.captureEvent(event, JSON.stringify([EventName.ProviderKindsChanged]));
        void this.loadKinds(true).catch(() => undefined);
        void this.refreshInstallations();
        break;
      }
      case EventName.SignInLink: {
        const link = SignInLinkPayload.fromJson(event.payload);
        if (this.signingInSignal().has(link.providerId)) {
          this.signInLinksSignal.update(t => new Map(t).set(link.providerId, link.url));
          void this.openSignInLink(link.providerId);
        }
        break;
      }
      case EventName.ConversationRewound:
        this.captureEvent(event, JSON.stringify([EventName.ConversationRewound, event.payload]));
        this.applyRewound(ConversationRewoundPayload.fromJson(event.payload));
        break;
      case EventName.ProjectFolderChanged: {
        const change = ProjectFolderChange.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ProjectFolderChanged, change.projectId]));
        this.markFolder(change.projectId, change.folderMissing);
        break;
      }
      case EventName.ConversationDeleted: {
        const conversationId = ConversationIdParams.fromJson(event.payload).conversationId;
        this.captureEvent(event, JSON.stringify([EventName.ConversationDeleted, conversationId]));
        this.applyDeleted(conversationId);
        break;
      }
      case EventName.StateInvalidated:
      case EventName.StateResyncRequested:
        this.resyncRequested ||= event.name === EventName.StateResyncRequested;
        if (event.name === EventName.StateResyncRequested)
          this.modelCatalogs.expire();
        this.invalidationsSignal.update(t => t + 1);
        void this.reloadCatalog();
        break;
      case EventName.WindowReloadRequested:
        if (WindowIdParams.fromJson(event.payload).windowId === this.windowId)
          void this.reload();
        break;
    }
  }

  private forgetContexts(conversationId: string): void {
    this.chatContextsSignal.update(t => t.filter(u => u.conversationId !== conversationId));
    this.chatSpeedsSignal.update(t => t.filter(u => u.conversationId !== conversationId));
    this.chatThreadsSignal.update(t => t.filter(u => u.conversationId !== conversationId));
  }

  private async loadUsage(): Promise<void> {
    try {
      const plans = ChatStoreService.readArray(await this.request(MethodName.PlanUsageList, null), PlanUsage.fromJson);
      const teammates = ChatStoreService.readArray(await this.request(MethodName.TeammateUsageList, null), TeammateUsage.fromJson);
      for (const usage of plans)
        this.upsertPlanUsage(usage);
      this.chatContextsSignal.update(t => teammates.reduce((all, usage) =>
        ChatContext.merge(all, ChatContext.ofTeammate(usage, this.teammate(usage.teammateId)?.providerId ?? null)), t));
    }
    catch {
      return;
    }
  }

  private upsertPlanUsage(usage: PlanUsage): void {
    this.planUsagesSignal.update(t => {
      const same = t.find(u => u.kind === usage.kind && u.providerId === usage.providerId);
      return !Object.isUndefined(same) && same.readAt > usage.readAt ? t : [...t.filter(u => u !== same), usage];
    });
  }

  private applyInstallation(installation: ProviderKindInstallation): void {
    this.installationsSignal.update(t => new Map([...t, [installation.kind, installation]]));
  }

  private chainTeammateSave(id: string, change: (teammate: Teammate | null) => TeammateUpdateParams | null,
    report?: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void, saved?: () => void): Promise<boolean> {
    const save = async (): Promise<boolean> => {
      const name = this.teammate(id)?.name ?? id;
      let listed: readonly Teammate[] = [];
      const read = await this.attempt(async () => {
        listed = ChatStoreService.readArray(await this.request(MethodName.TeammateList, null), Teammate.fromJson);
      }, t => (report ?? this.actionFailed(ChatAction.SaveTeammate, name))(Resources.formatTeammateError(name, t), null, false, false));
      const params = read ? change(listed.find(t => t.id === id) ?? null) : null;
      const done = !Object.isNull(params) && await this.saveTeammate(params, report);
      if (done)
        saved?.();
      return done;
    };
    const link = (this.teammateEdits.get(id) ?? Promise.resolve(true)).then(save, save);
    this.teammateEdits.set(id, link);
    return link;
  }

  private forgetMove(id: string): void {
    this.teammateMovesSignal.update(t => new Map([...t].filter(([u]) => u !== id)));
  }

  private async loadWaiting(conversationId: string): Promise<void> {
    const events = this.beginSnapshot();
    try {
      this.setWaiting(WaitingMessagesPayload.fromJson(await this.request(MethodName.WaitingMessageList, new ChatIdParams(conversationId).toJson())));
      this.replaySnapshot(events);
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private setWaiting(payload: WaitingMessagesPayload): void {
    this.waitingSignal.update(t => new Map(t).set(payload.chatId, payload.messages));
  }

  private async loadMembers(conversationId: string): Promise<void> {
    if (!this.holdsMembers(conversationId))
      return;
    const generation = this.selectionGeneration;
    const ticket = ++this.membersGeneration;
    this.membersTickets.set(conversationId, ticket);
    const result = await this.request(MethodName.ConversationListMembers, new ConversationIdParams(conversationId).toJson());
    const isSetAside = conversationId === this.setAsideConversationIdSignal();
    if (this.disposed || ticket !== this.membersTickets.get(conversationId)
      || (!isSetAside && (generation !== this.selectionGeneration || conversationId !== this.requestedConversationId)))
      return;
    const loaded = ChatStoreService.readArray(result, ConversationMember.fromJson);
    this.membersSignal.update(t => [...t.filter(u => u.conversationId !== conversationId && this.holdsMembers(u.conversationId)), ...loaded]);
  }

  private holdsMembers(conversationId: string): boolean {
    return conversationId === this.requestedConversationId || conversationId === this.setAsideConversationIdSignal();
  }

  private async loadConversations(projectId: string): Promise<void> {
    const listed = await this.request(MethodName.ConversationList, new ConversationListParams(projectId).toJson());
    const conversations = ChatStoreService.readArray(listed, Conversation.fromJson);
    this.conversationsByProjectSignal.update(t => new Map(t).set(projectId, conversations));
  }

  private reloadCatalog(): Promise<boolean> {
    this.catalogDirty = true;
    if (!Object.isNull(this.catalogReload))
      return this.catalogReload;
    const reload = this.perform(async () => {
      do {
        this.catalogDirty = false;
        if (this.kindsFailedSignal())
          await this.reloadKinds();
        await this.readCatalog();
        if (!this.catalogDirty && this.resyncRequested && !this.disposed) {
          this.resyncRequested = false;
          const held = [...this.windowsSignal().values()].filter(t => this.hasConversation(t.conversationId));
          await Promise.all([...held.map(t => this.loadWindow(t)), ...held.map(t => this.loadWaiting(t.conversationId))]);
          this.resyncsSignal.update(t => t + 1);
        }
      } while (this.catalogDirty && !this.disposed);
    }, this.loadFailed(Resources.catalogLoad, Resources.catalogNotLoaded, null, () => this.reloadCatalog())).then(t => {
      if (t)
        this.markLoaded(Resources.catalogLoad);
      return t;
    });
    this.catalogReload = reload;
    void reload.finally(() => this.catalogReload = null);
    return reload;
  }

  private loadKinds(fresh: boolean = false): Promise<void> {
    if (!fresh && !Object.isNull(this.kindLoad))
      return this.kindLoad;
    const load = this.requestKinds(++this.kindRequests).finally(() => {
      if (this.kindLoad === load)
        this.kindLoad = null;
    });
    this.kindLoad = load;
    return load;
  }

  private async requestKinds(request: number): Promise<void> {
    try {
      const kinds = ChatStoreService.readArray(await this.request(MethodName.ProviderKindList, null), ProviderKind.fromJson);
      if (request < this.kindsApplied)
        return;
      this.kindsApplied = request;
      this.kindsSignal.set(kinds);
      for (const watcher of [...this.kindWatchers])
        watcher();
      this.kindsFailedSignal.set(false);
      this.kindsLoadedSignal.set(true);
      this.markLoaded(Resources.kindsLoad);
    }
    catch (error) {
      if (request < this.kindsApplied)
        return;
      this.kindsFailedSignal.set(true);
      throw error;
    }
  }

  private async reloadKinds(): Promise<void> {
    this.kindLoadsSignal.update(t => t + 1);
    try {
      await this.attempt(() => this.loadKinds(), this.loadFailed(Resources.kindsLoad, Resources.kindsNotLoaded, null, () => this.reloadCatalog()));
    }
    finally {
      this.kindLoadsSignal.update(t => t - 1);
    }
  }

  private async readCatalog(): Promise<void> {
    const events = this.beginSnapshot();
    try {
      const providers = ChatStoreService.readArray(await this.request(MethodName.ProviderList, null), Provider.fromJson);
      const signIns = ProviderSignIns.fromJson(await this.request(MethodName.ProviderSignInList, null));
      const teammates = ChatStoreService.readArray(await this.request(MethodName.TeammateList, null), Teammate.fromJson);
      const preferred = await this.request(MethodName.DefaultTeammateRead, null);
      const listings = ChatStoreService.readArray(await this.request(MethodName.ProjectList, null), ProjectListing.fromJson);
      const projects = listings.map(t => t.project);
      const conversations = new Map<string | null, readonly Conversation[]>();
      await Promise.all([...projects.map(t => t.id), null].map(async t => {
        const listed = await this.request(MethodName.ConversationList, new ConversationListParams(t).toJson());
        conversations.set(t, ChatStoreService.readArray(listed, Conversation.fromJson).filter(u => u.projectId === t));
      }));
      const open = ChatStoreService.readArray(await this.request(MethodName.MessageListOpen, null), Message.fromJson);
      const approvals = ChatStoreService.readArray(await this.request(MethodName.ApprovalListPending, null), Approval.fromJson);
      const resyncing = !this.loadedSignal() || this.resyncRequested;
      const installations = resyncing
        ? ChatStoreService.readArray(await this.request(MethodName.ProviderKindInstallationList, null), ProviderKindInstallation.fromJson) : null;
      if (this.disposed)
        return;
      this.setProviders(providers);
      this.runningSignInsSignal.set(new Set(signIns.providerIds));
      if (!Object.isNull(installations))
        this.installationsSignal.set(new Map(installations.map(t => [t.kind, t])));
      this.setTeammates(teammates);
      this.defaultTeammateSignal.set(Object.isNull(preferred) ? null : DefaultTeammate.fromJson(preferred));
      this.projectsSignal.set(projects);
      this.missingFoldersSignal.set(new Set(listings.filter(t => t.folderMissing).map(t => t.project.id)));
      const existing = new Set([...conversations.values()].flat().map(t => t.id));
      const dropped = [...this.conversationsByProjectSignal().values()].flat().filter(t => !existing.has(t.id));
      for (const [projectId, listed] of conversations)
        conversations.set(projectId, [...listed, ...dropped.filter(t => t.projectId === projectId)]);
      this.conversationsByProjectSignal.set(conversations);
      const checks = await Promise.all(dropped.map(t => this.confirmDropped(t.id).catch((u: unknown) => u)));
      this.setWorking(new Map(open.map(t => [t.id, t])));
      this.thinkingSignal.update(t => new Set([...t].filter(u => this.workingSignal().has(u))));
      this.savingCheckpointSignal.update(t => resyncing ? new Set() : new Set([...t].filter(u => this.workingSignal().has(u))));
      this.approvalsSignal.update(t => t.filter(u => u.status !== ApprovalStatus.Pending));
      for (const approval of approvals)
        this.upsertApproval(approval);
      this.replaySnapshot(events);
      this.loadedSignal.set(true);
      void this.loadUsage();
      const selected = this.findConversation(this.selectedConversationId());
      if (!Object.isNull(selected) && this.requestedConversationId === selected.id)
        this.selectedProjectIdSignal.set(selected.projectId);
      else if (Object.isNull(selected) && !Object.isNull(this.selectedConversationId()))
        this.deselectConversation();
      if (!projects.some(t => t.id === this.selectedProjectId()))
        this.selectedProjectIdSignal.set(null);
      for (const id of this.positions.keys())
        if (!this.hasConversation(id))
          this.positions.delete(id);
      for (const id of this.messageIndexes.keys())
        if (!this.hasConversation(id))
          this.messageIndexes.delete(id);
      if (!Object.isNull(selected))
        await this.loadMembers(selected.id);
      const setAside = this.findConversation(this.setAsideConversationIdSignal());
      if (!Object.isNull(setAside))
        await this.loadMembers(setAside.id);
      const failure = checks.find(t => !Object.isUndefined(t));
      if (!Object.isUndefined(failure))
        throw failure;
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private beginSnapshot(): Map<string, Event> {
    const events = new Map<string, Event>();
    this.snapshots.add(events);
    return events;
  }

  private markFolder(projectId: string, missing: boolean): void {
    const marked = new Set(this.missingFoldersSignal());
    if (missing)
      marked.add(projectId);
    else
      marked.delete(projectId);
    this.missingFoldersSignal.set(marked);
  }

  private captureEvent(event: Event, key: string): void {
    for (const snapshot of this.snapshots) {
      snapshot.delete(key);
      snapshot.set(key, event);
    }
  }

  private replaySnapshot(events: Map<string, Event>): void {
    this.snapshots.delete(events);
    const checkpoint = (event: Event): boolean => event.name === EventName.ReplyCheckpointStarted || event.name === EventName.ReplyCheckpointEnded;
    for (const event of [...events.values()].sort((left, right) => Number(checkpoint(left)) - Number(checkpoint(right))))
      this.apply(event);
  }

  private settleOpening(conversationId: string): void {
    if (this.openingConversationIdSignal() === conversationId)
      this.openingConversationIdSignal.set(null);
  }

  private async showProject(projectId: string): Promise<void> {
    this.openingConversationIdSignal.set(null);
    const shown = this.findConversation(this.shownConversationId());
    this.setAsideConversationIdSignal.set(Object.isNull(shown) || shown.projectId === projectId ? null : shown.id);
    this.selectedProjectIdSignal.set(projectId);
    this.deselectConversation();
    const first = this.conversationsOf(projectId)[0];
    if (!Object.isUndefined(first))
      await this.loadMessages(first.id);
  }

  private stopThinking(messageId: string): void {
    if (!this.thinkingSignal().has(messageId))
      return;
    this.thinkingSignal.update(t => {
      const next = new Set(t);
      next.delete(messageId);
      return next;
    });
  }

  private stopSavingCheckpoint(messageId: string): void {
    if (!this.savingCheckpointSignal().has(messageId))
      return;
    this.savingCheckpointSignal.update(t => {
      const next = new Set(t);
      next.delete(messageId);
      return next;
    });
  }

  private trackWorking(message: Message): void {
    const active = ChatStoreService.ACTIVE_STATUSES.includes(message.status);
    if (!active) {
      this.stopThinking(message.id);
      this.stopSavingCheckpoint(message.id);
    }
    if (!active && !this.workingSignal().has(message.id))
      return;
    const next = new Map(this.workingSignal());
    if (active)
      next.set(message.id, message);
    else
      next.delete(message.id);
    this.setWorking(next);
    if (!active)
      for (const watcher of this.replyEndWatchers)
        watcher(message);
  }

  private waitingRepliesOf(conversationId: string): readonly string[] {
    const chats = this.replyChatsSignal();
    return this.waitingReplies().filter(t => chats.get(t) === conversationId);
  }

  private learnChats(chats: readonly (readonly [string, string])[]): void {
    const learned = chats.filter(([t]) => !this.replyChatsSignal().has(t));
    if (learned.length > 0)
      this.replyChatsSignal.update(t => new Map([...t, ...learned]));
  }

  private learnTeammates(replies: readonly Message[]): void {
    const learned = replies.filter(t => !this.replyTeammatesSignal().has(t.id));
    if (learned.length > 0)
      this.replyTeammatesSignal.update(t => new Map([...t, ...learned.map(u => [u.id, u.teammateId] as const)]));
  }

  private resolveChat(messageId: string): void {
    if ((this.replyChatsSignal().has(messageId) && this.replyTeammatesSignal().has(messageId)) || this.resolvingChats.has(messageId))
      return;
    this.resolvingChats.add(messageId);
    void this.request(MethodName.MessageSummary, new MessageIdParams(messageId).toJson())
      .then(value => {
        if (Object.isNull(value))
          return;
        const preview = ReplySummary.fromJson(value).preview;
        this.learnChats([[messageId, preview.conversationId]]);
        this.learnTeammates([preview]);
      }, () => undefined)
      .finally(() => this.resolvingChats.delete(messageId));
  }

  private setWorking(working: ReadonlyMap<string, Message>): void {
    this.learnChats([...working.values()].map(t => [t.id, t.conversationId] as const));
    this.learnTeammates([...working.values()]);
    this.workingSignal.set(working);
    const conversationIds = new Set([...working.values()].map(t => t.conversationId));
    for (const [conversationId, clear] of this.workingTabs) {
      if (conversationIds.has(conversationId))
        continue;
      clear();
      this.workingTabs.delete(conversationId);
    }
    for (const conversationId of conversationIds)
      if (!this.workingTabs.has(conversationId))
        this.workingTabs.set(conversationId, this.context.markWorking(Resources.conversationDocumentName, conversationId));
  }

  private watchMessage(message: Message): void {
    this.watchedMessages?.set(message.id, message);
    this.trackWorking(message);
  }

  private readWorking(): Promise<boolean> {
    const seen = new Map<string, Message>();
    this.watchedMessages = seen;
    return this.attempt(async () => {
      const open = ChatStoreService.readArray(await this.request(MethodName.MessageListOpen, null), Message.fromJson);
      if (this.watchedMessages !== seen || this.watchSubscriptions.length === 0)
        return;
      this.setWorking(new Map(open.map(t => [t.id, t])));
      for (const message of seen.values())
        this.trackWorking(message);
    }, this.loadFailed(Resources.workingLoad, Resources.workingNotLoaded, null, () => this.readWorking())).then(t => {
      if (t)
        this.markLoaded(Resources.workingLoad);
      return t;
    }).finally(() => {
      if (this.watchedMessages === seen)
        this.watchedMessages = null;
    });
  }

  private unwatch(): void {
    for (const unsubscribe of this.watchSubscriptions)
      unsubscribe();
    this.watchSubscriptions = [];
  }

  private storeConversation(conversation: Conversation): void {
    this.conversationsByProjectSignal.update(t => {
      const next = new Map(t);
      for (const [projectId, listed] of next)
        if (projectId !== conversation.projectId && listed.some(u => u.id === conversation.id))
          next.set(projectId, listed.filter(u => u.id !== conversation.id));
      next.set(conversation.projectId, ChatStoreService.upsert(next.get(conversation.projectId) ?? [], conversation));
      return next;
    });
    if (this.selectedConversationId() === conversation.id)
      this.selectedProjectIdSignal.set(conversation.projectId);
  }

  private findConversation(conversationId: string | null): Conversation | null {
    if (Object.isNull(conversationId))
      return null;
    for (const conversations of this.conversationsByProjectSignal().values()) {
      const found = conversations.find(t => t.id === conversationId);
      if (!Object.isUndefined(found))
        return found;
    }
    return null;
  }

  private async loadMessages(conversationId: string): Promise<void> {
    const generation = ++this.selectionGeneration;
    this.requestedConversationId = conversationId;
    const window = this.holdWindow(conversationId);
    this.holdRequested(window);
    if (!await this.waitLoaded(window) || generation !== this.selectionGeneration)
      return;
    await Promise.all([this.loadMembers(conversationId), this.loadWaiting(conversationId)]);
    if (generation !== this.selectionGeneration)
      return;
    const conversation = this.findConversation(conversationId);
    if (Object.isNull(conversation)) {
      this.deselectConversation();
      return;
    }
    this.selectedConversationIdSignal.set(conversationId);
    this.settleOpening(conversationId);
    this.announceShown();
    this.selectedProjectIdSignal.set(conversation.projectId);
    this.requestedWindow = null;
    this.holdSelected(window);
  }

  private windowOf(conversationId: string | null): ConversationWindow | null {
    return Object.isNull(conversationId) ? null : this.windowsSignal().get(conversationId) ?? null;
  }

  private holdWindow(conversationId: string): ConversationWindow {
    const held = this.windowsSignal().get(conversationId);
    const window = held ?? new ConversationWindow(conversationId);
    if (Object.isUndefined(held))
      this.windowsSignal.update(t => new Map(t).set(conversationId, window));
    window.holders += 1;
    return window;
  }

  private releaseWindow(window: ConversationWindow): void {
    window.holders -= 1;
    if (window.holders > 0 || this.windowsSignal().get(window.conversationId) !== window)
      return;
    window.generation += 1;
    window.loading = null;
    this.linkedFolders.delete(window.conversationId);
    this.markLoaded(Resources.formatNoticeKey(Resources.chatLoad, window.conversationId));
    this.windowsSignal.update(t => {
      const next = new Map(t);
      next.delete(window.conversationId);
      return next;
    });
  }

  private holdRequested(window: ConversationWindow | null): void {
    const previous = this.requestedWindow;
    this.requestedWindow = window;
    if (!Object.isNull(previous))
      this.releaseWindow(previous);
  }

  private holdSelected(window: ConversationWindow | null): void {
    const previous = this.selectedWindow;
    this.selectedWindow = window;
    if (!Object.isNull(previous))
      this.releaseWindow(previous);
  }

  private async waitLoaded(window: ConversationWindow): Promise<boolean> {
    while (!window.isLoaded()) {
      if (!this.isHeld(window))
        return false;
      await (window.loading ?? this.loadWindow(window));
    }
    return this.isHeld(window);
  }

  private loadWindow(window: ConversationWindow): Promise<boolean> {
    const loading = this.readWindow(window);
    const clear = (): void => {
      if (window.loading === loading)
        window.loading = null;
    };
    window.loading = loading;
    loading.then(clear, clear);
    return loading;
  }

  private async readWindow(window: ConversationWindow): Promise<boolean> {
    const generation = ++window.generation;
    const conversationId = window.conversationId;
    const events = this.beginSnapshot();
    try {
      const position = this.positions.get(conversationId);
      const page = Object.isUndefined(position) || position.isFollowing ? await this.fetchPage(conversationId, null, null) : await this.fetchAround(conversationId, position.sequence);
      if (!this.isCurrent(window, generation))
        return false;
      const listedApprovals = await this.request(MethodName.ApprovalList, new ConversationIdParams(conversationId).toJson());
      if (!this.isCurrent(window, generation))
        return false;
      const found = !Object.isUndefined(position) && page.messages.some(t => t.id === position.messageId);
      if (!Object.isUndefined(position) && !found)
        this.dropPosition(conversationId, position);
      window.pendingPosition.set(found ? position : null);
      this.setHistory(window, page);
      window.isLoaded.set(true);
      this.markLoaded(Resources.formatNoticeKey(Resources.chatLoad, conversationId));
      const listed = ChatStoreService.readArray(listedApprovals, Approval.fromJson);
      this.learnChats(listed.map(t => [t.messageId, conversationId] as const));
      this.learnTeammates(page.messages.filter(t => listed.some(u => u.messageId === t.id)));
      for (const approval of listed)
        this.upsertApproval(approval);
      for (const message of page.messages)
        this.trackWorking(message);
      this.replaySnapshot(events);
      return true;
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private async readLatest(window: ConversationWindow): Promise<boolean> {
    const generation = ++window.generation;
    const events = this.beginSnapshot();
    try {
      const page = await this.fetchPage(window.conversationId, null, null);
      if (!this.isCurrent(window, generation))
        return false;
      this.rememberPage(window, page);
      window.pendingPosition.set(null);
      const source: ConversationHistorySource = new ConversationHistorySource(page,
        (start, end) => this.readHistoryAsync(window, source, start, end));
      window.history.set(source);
      for (const message of page.messages)
        this.trackWorking(message);
      this.replaySnapshot(events);
      return true;
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private isHeld(window: ConversationWindow): boolean {
    return !this.disposed && this.windowsSignal().get(window.conversationId) === window;
  }

  private isCurrent(window: ConversationWindow, generation: number): boolean {
    return this.isHeld(window) && window.generation === generation;
  }

  private async fetchPage(conversationId: string, beforeSequence: number | null, afterSequence: number | null,
    limit: number = Resources.messagePageSize): Promise<MessagePage> {
    const params = new MessagePageParams(conversationId, beforeSequence, afterSequence, limit);
    const page = MessagePage.fromJson(await this.request(MethodName.MessagePage, params.toJson()));
    this.chatContextsSignal.update(t => page.messages.reduce((all, message) => ChatContext.merge(all, ChatContext.ofMessage(message)), t));
    this.chatSpeedsSignal.update(t => page.messages.reduce((all, message) => ChatSpeed.merge(all, ChatSpeed.ofMessage(message)), t));
    this.chatThreadsSignal.update(t => page.messages.reduce((all, message) => ChatThread.merge(all, ChatThread.ofMessage(message)), t));
    this.rememberSteers(page.messages);
    return page;
  }

  private async fetchAround(conversationId: string, sequence: number): Promise<MessagePage> {
    const before = await this.fetchPage(conversationId, sequence + 1, null);
    const after = await this.fetchPage(conversationId, null, sequence);
    return new MessagePage(ChatStoreService.merge(before.messages, after.messages), before.hasEarlier, after.hasLater, after.count);
  }

  private setHistory(window: ConversationWindow, page: MessagePage): void {
    this.rememberPage(window, page);
    const history = window.history();
    if (Object.isNull(history)) {
      const source: ConversationHistorySource = new ConversationHistorySource(page,
        (start, end) => this.readHistoryAsync(window, source, start, end));
      window.history.set(source);
    }
    else {
      window.pendingPosition.set(null);
      history.refresh(page);
    }
  }

  private async readHistoryAsync(window: ConversationWindow, source: ConversationHistorySource, start: number,
    end: number): Promise<readonly Message[]> {
    const page = await this.fetchPage(window.conversationId, end, null, end - start);
    const kept = page.messages.filter(t => t.sequence < source.length() && (source.heldAt(t.sequence)?.id ?? t.id) === t.id);
    if (this.isHeld(window) && kept.length > 0)
      this.rememberPage(window, new MessagePage(kept, page.hasEarlier, page.hasLater, page.count));
    return page.messages;
  }

  private upsertMessage(message: Message): void {
    const window = this.windowOf(message.conversationId);
    const history = window?.history() ?? null;
    if (Object.isNull(window) || Object.isNull(history))
      return;

    const index = this.indexFor(message.conversationId);
    if (message.sequence === (index.entries.at(-1)?.sequence ?? -1) + 1) {
      index.rememberMessage(message);
      window.index.set(index.entries);
    }
    history.upsert(message);
  }

  private rememberSteers(messages: readonly Message[]): void {
    const steers = messages.filter(t => !Object.isNull(FormatterService.steeredIntoOf(t)));
    if (steers.length === 0)
      return;
    const ids = new Set(steers.map(t => t.id));
    this.steersSignal.update(t => [...t.filter(u => !ids.has(u.id)), ...steers].toSorted((a, b) => a.sequence - b.sequence));
  }

  private applyDeleted(conversationId: string): void {
    this.forgetContexts(conversationId);
    const chats = this.replyChatsSignal();
    this.approvalsSignal.update(t => t.filter(u => u.status !== ApprovalStatus.Pending || chats.get(u.messageId) !== conversationId));
    this.steersSignal.update(t => t.filter(u => u.conversationId !== conversationId));
    this.conversationsByProjectSignal.update(t => {
      const next = new Map(t);
      for (const [projectId, conversations] of t)
        next.set(projectId, conversations.filter(u => u.id !== conversationId));
      return next;
    });
    if (this.selectedConversationId() === conversationId || this.requestedConversationId === conversationId)
      this.deselectConversation();
    this.dismissUnsent(t => t === conversationId);
    const actions = [...this.actionChats].filter(([, t]) => t === conversationId).map(([t]) => t);
    for (const key of actions)
      this.actionChats.delete(key);
    this.notices.dismiss(Resources.chatActionFailedNotice, t => actions.includes(t));
    this.markLoaded(Resources.formatNoticeKey(Resources.chatLoad, conversationId));
    this.forgetDeleted(conversationId);
  }

  private async confirmDropped(conversationId: string): Promise<void> {
    try {
      await this.request(MethodName.ConversationListMembers, new ConversationIdParams(conversationId).toJson());
    }
    catch (error) {
      if (!ChatStoreService.isRefusalOver(error, ErrorCode.NotFound, conversationId))
        throw error;
      this.applyDeleted(conversationId);
    }
  }

  private forgetDeleted(conversationId: string): void {
    this.deletedIds.add(conversationId);
    this.linkedFolders.delete(conversationId);
    this.membersTickets.delete(conversationId);
    for (const watcher of this.deletionWatchers)
      watcher(conversationId);
    this.context.forgetDocument(Resources.conversationDocumentName, conversationId);
  }

  private applyRewound(payload: ConversationRewoundPayload): void {
    this.forgetContexts(payload.conversationId);
    this.steersSignal.update(t => t.filter(u => u.conversationId !== payload.conversationId || u.sequence < payload.fromSequence));
    this.linkedFolders.delete(payload.conversationId);
    const index = this.messageIndexes.get(payload.conversationId);
    index?.removeFrom(payload.fromSequence);
    const position = this.positions.get(payload.conversationId);
    if (!Object.isUndefined(position) && position.sequence >= payload.fromSequence) {
      this.positions.delete(payload.conversationId);
      this.unsavedPositions.delete(payload.conversationId);
      this.droppedPositions.delete(payload.conversationId);
      this.forgottenPositions.add(payload.conversationId);
    }
    const window = this.windowOf(payload.conversationId);
    if (Object.isNull(window))
      return;
    window.index.set(index?.entries ?? []);
    const pending = window.pendingPosition();
    if (!Object.isNull(pending) && pending.sequence >= payload.fromSequence)
      window.pendingPosition.set(null);
    const removedIds = new Set(window.history()?.removeFrom(payload.fromSequence));
    this.approvalsSignal.update(t => t.filter(u => !removedIds.has(u.messageId)));
  }

  private applyDetail(payload: DetailEventPayload): void {
    for (const window of this.windowsSignal().values()) {
      const history = window.history();
      const held = history?.find(payload.messageId) ?? null;
      if (!Object.isNull(history) && !Object.isNull(held))
        history.upsert(ChatStoreService.withAppliedDetail(held, payload.detail));
    }
  }

  private indexFor(conversationId: string): MessageIndex {
    let index = this.messageIndexes.get(conversationId);
    if (Object.isUndefined(index)) {
      index = new MessageIndex();
      this.messageIndexes.set(conversationId, index);
    }
    return index;
  }

  private rememberPage(window: ConversationWindow, page: MessagePage): void {
    const index = this.indexFor(window.conversationId);
    index.rememberPage(page);
    window.index.set(index.entries);
  }

  private upsertApproval(approval: Approval): void {
    this.approvalsSignal.update(t => approval.status === ApprovalStatus.Pending && t.some(u => u.id === approval.id && u.status !== ApprovalStatus.Pending)
      ? t : ChatStoreService.upsert(t, approval));
    if (approval.status === ApprovalStatus.Pending)
      this.resolveChat(approval.messageId);
    else {
      this.setAnswer(approval.id, null);
      for (const index of this.messageIndexes.values())
        index.find(approval.messageId)?.controls?.dropDraft(approval.id);
    }
  }

  private applySendKey(value: JsonValue | undefined): void {
    this.sendKeySignal.set(Object.values(SendKey).find(t => t === value) ?? SendKey.Enter);
  }

  private applyWhileReplying(value: JsonValue | undefined): void {
    this.whileReplyingSignal.set(Object.values(MessageDelivery).find(t => t === value) ?? MessageDelivery.Steer);
  }

  private setAnswer(approvalId: string, answer: ApprovalAnswer | null): void {
    if (Object.isNull(answer) && !this.answersSignal().has(approvalId))
      return;
    this.answersSignal.update(t => {
      const next = new Map(t);
      if (Object.isNull(answer))
        next.delete(approvalId);
      else
        next.set(approvalId, answer);
      return next;
    });
  }

  private async sendDecision(approvalId: string, optionId: string, answers: readonly QuestionAnswer[] | null = null): Promise<void> {
    try {
      this.upsertApproval(Approval.fromJson(await this.request(MethodName.ApprovalDecide, new ApprovalDecideParams(approvalId, optionId, answers).toJson())));
    }
    catch (error) {
      const withdrawn = this.approvalsSignal().find(t => t.id === approvalId && ChatStoreService.isRefusalOver(error, ErrorCode.Conflict, t.messageId));
      if (Object.isUndefined(withdrawn))
        throw error;
      this.upsertApproval(withdrawn.withCancellation(new Date().toISOString()));
    }
  }

  private async followSignInTerminal(providerId: string, launchOf: TerminalLaunch | (() => Promise<TerminalLaunch>), report: (message: string) => void): Promise<void> {
    if (this.terminalSignInsSignal().has(providerId))
      return;
    this.unfinishedSignInsSignal.update(t => new Map([...t].filter(([u]) => u !== providerId)));
    this.forgetSignInCommand(providerId);
    this.openSignInTerminalsSignal.update(t => new Set([...t, providerId]));
    const launch = (typeof launchOf === "function" ? launchOf() : Promise.resolve(launchOf)).then(t => {
      this.signInCommandsSignal.update(u => new Map(u).set(providerId, t.command));
      return t;
    });
    const ended = await this.followProviderTerminal(this.terminalSignInsSignal, this.terminalStops, providerId, () => launch, report, AuthStatus.LoggedIn);
    this.forgetSignInCommand(providerId);
    this.openSignInTerminalsSignal.update(t => this.terminalSignInsSignal().has(providerId) ? t : new Set([...t].filter(u => u !== providerId)));
    if (ended !== false && this.providersSignal().some(t => t.id === providerId && t.enabled && t.authStatus !== AuthStatus.LoggedIn)) {
      const { command } = await launch;
      this.unfinishedSignInsSignal.update(t => new Map(t).set(providerId, command));
    }
  }

  private forgetSignInCommand(providerId: string): void {
    this.signInCommandsSignal.update(t => new Map([...t].filter(([u]) => u !== providerId)));
  }

  private async followProviderTerminal(running: WritableSignal<ReadonlySet<string>>, stops: Map<string, () => Promise<void>>, providerId: string,
    launchOf: TerminalLaunch | (() => Promise<TerminalLaunch>), report: (message: string) => void, wanted: AuthStatus | null): Promise<boolean | null> {
    running.update(t => new Set([...t, providerId]));
    const launch = typeof launchOf === "function" ? launchOf() : launchOf;
    let waiting = true;
    const release = (): void => {
      if (waiting)
        running.update(t => new Set([...t].filter(u => u !== providerId)));
      waiting = false;
    };
    return await this.followTerminal(stops, providerId, launch, release, report, t => this.checkTerminalProvider(providerId, report, wanted, t));
  }

  private async followTerminal(stops: Map<string, () => Promise<void>>, key: string, launch: TerminalLaunch | Promise<TerminalLaunch>, release: () => void,
    report: (message: string) => void, lookAgain: (exitCode: number | null) => Promise<boolean>): Promise<boolean | null> {
    const earlier = stops.get(key);
    const open = (): Promise<LaunchedTerminal> => launch instanceof Promise ? launch.then(t => this.terminals.openAsync(this.context, t)) :
      this.terminals.openAsync(this.context, launch);
    const opening = Object.isUndefined(earlier) ? open() : earlier().then(open);
    let session: string | null = null;
    void opening.then(t => {
      session = t.sessionId;
      this.terminalSessionsSignal.update(u => new Map(u).set(key, t.sessionId));
    }, () => undefined);
    const stopped = new Promise<TerminalStep>(resolve => stops.set(key, async () => {
      resolve(TerminalStep.Stopped);
      await this.attempt(async () => {
        await (await opening.catch(() => null))?.closeAsync();
      }, report);
    }));
    const stop = stops.get(key);
    let ended: boolean | null = false;
    try {
      await this.attempt(async () => {
        let step = await Promise.race([opening.then(t => ChatStoreService.stepOf(t)), stopped]);
        if (step === TerminalStep.CommandEnded) {
          if (await lookAgain(await (await opening).commandEnded)) {
            release();
            await (await opening).closeAsync();
            ended = true;
            return;
          }
          release();
          step = await Promise.race([opening.then(t => t.ended).then(() => TerminalStep.Ended), stopped]);
        }
        else if (step === TerminalStep.Ended)
          ended = null;
        if (step === TerminalStep.Ended)
          await lookAgain(null);
      }, report);
    }
    finally {
      if (stops.get(key) === stop)
        stops.delete(key);
      this.terminalSessionsSignal.update(t => t.get(key) === session ? new Map([...t].filter(([u]) => u !== key)) : t);
      release();
    }
    return ended;
  }

  private async checkTerminalProvider(providerId: string, report: (message: string) => void, wanted: AuthStatus | null,
    exitCode: number | null): Promise<boolean> {
    if (this.disposed || this.leavingProviders.has(providerId) || !this.providersSignal().some(t => t.id === providerId && t.enabled))
      return false;
    if (Object.isNull(wanted) && !Object.isNull(exitCode) && exitCode !== 0)
      return false;
    const checked = await this.checkProvider(providerId, report);
    return Object.isNull(wanted) ? !Object.isNull(exitCode) : checked && this.providersSignal().find(t => t.id === providerId)?.authStatus === wanted;
  }

  private static stepOf(terminal: LaunchedTerminal): Promise<TerminalStep> {
    return Promise.race([terminal.commandEnded.then(t => Object.isNull(t) ? new Promise<TerminalStep>(() => undefined) : TerminalStep.CommandEnded),
      terminal.ended.then(() => TerminalStep.Ended)]);
  }

  private terminalLaunchOf(provider: Provider, opensTab: boolean): TerminalLaunch | null {
    const kind = this.kindsSignal().find(t => t.id === provider.kind);
    const profile = Object.isUndefined(kind) || kind.supportsSignIn ? null : kind.profile;
    const command = profile?.signInCommand ?? null;
    return Object.isNull(profile) || Object.isNull(command) ? null : new TerminalLaunch(provider.profileDir,
      ChatStoreService.profileEnvironment(profile, provider.profileDir), Resources.terminalSignInNotices.get(provider.kind) ?? Resources.terminalSignInNotice,
      Resources.formatTerminalSignInTitle(provider.label), command, opensTab, ChatStoreService.minimumRowsOf(opensTab),
      ChatStoreService.providerShellKinds());
  }

  private async signInOrFindTerminalLaunch(providerId: string, known: Provider | undefined, report: (message: string) => void,
    opensTab: boolean): Promise<TerminalLaunch | null> {
    const launch = Object.isUndefined(known) ? null : await this.agentTerminalLaunchOf(known, opensTab);
    if (!Object.isNull(launch))
      return launch;
    await this.attempt(async () => {
      const params = new ProviderIdParams(providerId);
      const provider = Provider.fromJson(await this.request(MethodName.ProviderSignIn, params.toJson()));
      this.setProviders(ChatStoreService.upsert(this.providersSignal(), provider));
    }, report);
    return null;
  }

  private async signInLaunchOf(providerId: string, launch: TerminalLaunch): Promise<TerminalLaunch> {
    let resolved = launch;
    await this.attempt(async () => {
      const answer = await this.request(MethodName.ProviderSignInCommand, new ProviderIdParams(providerId).toJson());
      if (!Object.isNull(answer)) {
        const command = ProviderSignInCommand.fromJson(answer);
        resolved = new TerminalLaunch(launch.folder, { ...launch.environment, ...command.environment }, launch.notice, launch.title, command.command, launch.opensTab,
          launch.minimumRows, launch.shellKinds);
      }
    }, () => undefined);
    return resolved;
  }

  private async agentTerminalLaunchOf(provider: Provider, opensTab: boolean): Promise<TerminalLaunch | null> {
    let launch: TerminalLaunch | null = null;
    await this.attempt(async () => {
      const answer = await this.request(MethodName.ProviderSignInCommand, new ProviderIdParams(provider.id).toJson());
      if (!Object.isNull(answer)) {
        const command = ProviderSignInCommand.fromJson(answer);
        launch = new TerminalLaunch(provider.profileDir, command.environment, Resources.terminalSignInNotice, Resources.formatTerminalSignInTitle(provider.label),
          command.command, opensTab, ChatStoreService.minimumRowsOf(opensTab), ChatStoreService.providerShellKinds());
      }
    }, () => undefined);
    return launch;
  }

  private signOutLaunchOf(provider: Provider): TerminalLaunch | null {
    const kind = this.kindsSignal().find(t => t.id === provider.kind);
    const profile = Object.isUndefined(kind) || kind.supportsSignOut || Object.isNull(kind.signOutCommand) ? null : kind.profile;
    const command = (kind?.signOutEndsWithCommand ? kind.signOutCommand : profile?.toolCommand) ?? null;
    const notice = kind?.signOutEndsWithCommand ? Resources.terminalSignOutCommandNotice : Resources.terminalSignOutNotice;
    return Object.isNull(profile) || Object.isNull(command) ? null : new TerminalLaunch(provider.profileDir,
      ChatStoreService.profileEnvironment(profile, provider.profileDir), notice, Resources.formatTerminalSignOutTitle(provider.label), command, true, null,
      ChatStoreService.providerShellKinds());
  }

  private static providerShellKinds(): readonly TerminalShellKind[] {
    return navigator.platform.startsWith(Resources.windowsPlatformPrefix) ? Resources.windowsProviderShellKinds : [];
  }

  private static minimumRowsOf(opensTab: boolean): number | null {
    return opensTab ? Resources.providerTerminalRows : null;
  }

  private static profileEnvironment(profile: ProviderProfile, folder: string): Record<string, string> {
    const separator = folder.includes(Resources.backslash) ? Resources.backslash : Resources.slash;
    const root = folder.endsWith(separator) ? folder.slice(0, -separator.length) : folder;
    return { ...profile.personFolders.some(t => ProfileFolderPath.isSame(t, folder)) ? {} : { [profile.variable]: folder }, ...Object.fromEntries(Object.entries(profile.signInVariables)
      .map(([name, path]) => [name, [root, ...path.split(Resources.slash)].join(separator)])), ...profile.signInValues };
  }

  private async perform(action: () => Promise<void>, report: (message: string, error: unknown) => void): Promise<boolean> {
    this.busySignal.update(t => t + 1);
    try {
      return await this.attempt(action, report);
    }
    finally {
      this.busySignal.update(t => t - 1);
    }
  }

  private async attempt(action: () => Promise<void>, report: (message: string, error: unknown) => void): Promise<boolean> {
    try {
      await action();
      return true;
    }
    catch (error) {
      report(ChatStoreService.messageOf(error), error);
      return false;
    }
  }

  private actionFailed(action: ChatAction, target: string, conversationId: string | null = null,
    severity: NotificationSeverity = NotificationSeverity.Error, title: () => string = () => Resources.chatActionTitles[action]): (message: string) => void {
    return message => {
      const key = Resources.formatNoticeKey(action, target);
      if (!Object.isNull(conversationId))
        this.actionChats.set(key, conversationId);
      this.notices.post(Resources.chatActionFailedNotice, key, title(), message, ChatStoreService.openChatOf(conversationId), [], severity);
    };
  }

  private providerFailed(action: ProviderAction, providerId: string): (message: string) => void {
    return this.actionFailed(action, providerId, null, NotificationSeverity.Error,
      () => Resources.formatProviderActionTitle(action, this.providersSignal().find(t => t.id === providerId)?.label ?? null));
  }

  private kindFailed(action: ProviderAction, kind: string): (message: string) => void {
    return this.actionFailed(action, kind, null, NotificationSeverity.Error,
      () => Resources.formatProviderActionTitle(action, this.kindsSignal().find(t => t.id === kind)?.displayName ?? null));
  }

  private namedFailed(action: ProviderAction, target: string, name: string): (message: string) => void {
    return this.actionFailed(action, target, null, NotificationSeverity.Error, () => Resources.formatProviderActionTitle(action, name));
  }

  private loadFailed(key: string, title: string, conversationId: string | null, retry: () => Promise<unknown>): (message: string) => void {
    return message => {
      this.retries.set(key, retry);
      this.notices.post(Resources.loadFailedNotice, Resources.formatNoticeKey(this.windowId, key), title, message,
        ChatStoreService.openChatOf(conversationId),
        [new NotificationAction(Resources.tryAgainLabel, new CommandRun(QualifiedName.parse(Resources.reloadCommand),
          { [Resources.windowIdArgument]: this.windowId, [Resources.noticeKeyArgument]: Resources.formatNoticeKey(this.windowId, key) }))]);
    };
  }

  private async loadChat(conversationId: string, action: () => Promise<void>, retry: () => Promise<void> = action): Promise<boolean> {
    const key = Resources.formatNoticeKey(Resources.chatLoad, conversationId);
    const failed = this.loadFailed(key, Resources.chatNotLoaded, conversationId, () => this.loadChat(conversationId, retry, retry));
    const isLoaded = await this.perform(action, message => {
      if (this.hasConversation(conversationId) && !Object.isNull(this.windowOf(conversationId)))
        failed(message);
      else
        this.markLoaded(key);
    });
    if (isLoaded)
      this.markLoaded(key);
    return isLoaded;
  }

  private async reloadWindow(conversationId: string): Promise<void> {
    const window = this.holdWindow(conversationId);
    try {
      await this.waitLoaded(window);
    }
    finally {
      this.releaseWindow(window);
    }
  }

  private markLoaded(key: string): void {
    this.retries.delete(key);
    this.notices.dismiss(Resources.loadFailedNotice, t => t === Resources.formatNoticeKey(this.windowId, key));
  }

  private notSent(conversationId: string, message: string, error: unknown): void {
    const ids = ChatStoreService.refusedIds(error, ErrorCode.Unavailable);
    const providerId = ids.at(-1) ?? null;
    this.unsent.set(conversationId, { providerId, teammateId: ids.slice(0, -1).at(0) ?? null });
    const isDisabled = this.providersSignal().some(t => t.id === providerId && !t.enabled);
    const actions = Object.isNull(providerId) ? [] : [
      ...isDisabled ? [new NotificationAction(Resources.enableProviderTitle,
        new CommandRun(QualifiedName.parse(Resources.enableProviderCommand), { [Resources.providerIdArgument]: providerId }))] : [],
      new NotificationAction(Resources.showProvidersTitle, new CommandRun(QualifiedName.parse(Resources.showProvidersCommand), null))
    ];
    this.notices.post(Resources.messageNotSentNotice, conversationId, Resources.messageNotSentTitle, message, ChatStoreService.openChatOf(conversationId), actions);
  }

  private dismissUnsent(isDismissed: (conversationId: string, providerId: string | null, teammateId: string | null) => boolean): void {
    const dismissed = [...this.unsent].filter(([id, t]) => isDismissed(id, t.providerId, t.teammateId)).map(([id]) => id);
    for (const id of dismissed)
      this.unsent.delete(id);
    this.notices.dismiss(Resources.messageNotSentNotice, t => dismissed.includes(t));
  }

  private setProviders(providers: readonly Provider[]): void {
    const previous = this.providersSignal();
    this.providersSignal.set(providers);
    const signedIn = providers.filter(t => previous.some(u => u.id === t.id && u.authStatus !== AuthStatus.LoggedIn) && t.authStatus === AuthStatus.LoggedIn)
      .map(t => t.id);
    const fixed = new Set([...providers.filter(t => previous.find(u => u.id === t.id)?.enabled === false && t.enabled).map(t => t.id), ...signedIn]);
    if (fixed.size > 0)
      this.dismissUnsent((_, providerId) => !Object.isNull(providerId) && fixed.has(providerId));
    this.notices.dismiss(Resources.chatActionFailedNotice,
      t => signedIn.some(u => t === Resources.formatNoticeKey(ChatAction.SignIn, u) || t === Resources.formatNoticeKey(ChatAction.CheckProvider, u)));
  }

  private setTeammates(teammates: readonly Teammate[]): void {
    const previous = this.teammatesSignal();
    this.teammatesSignal.set(teammates);
    const replaced = new Set(teammates.filter(t => previous.some(u => u.id === t.id && u.providerId !== t.providerId)).map(t => t.id));
    if (replaced.size > 0)
      this.dismissUnsent((_, _providerId, teammateId) => !Object.isNull(teammateId) && replaced.has(teammateId));
  }

  private static openChatOf(conversationId: string | null): CommandRun | null {
    return Object.isNull(conversationId) ? null
      : new CommandRun(QualifiedName.parse(Resources.openChatCommand), { [Resources.chatIdArgument]: conversationId });
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static async unlessRefused(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    }
    catch (error) {
      if (!(error instanceof Error) || Reflect.get(error, Resources.errorCodeField) !== ErrorCode.Conflict)
        throw error;
    }
  }

  private static takenNameOf(error: unknown, name: string): string | null {
    return ChatStoreService.isRefusalOver(error, ErrorCode.Conflict, name) ? name : null;
  }

  private static isRefusalOver(error: unknown, code: ErrorCode, id: string): boolean {
    return ChatStoreService.refusedIds(error, code).includes(id);
  }

  private static refusedIds(error: unknown, code: ErrorCode): readonly string[] {
    return Reflect.get(Object(error), Resources.errorCodeField) === code ? ChatStoreService.refusedArguments(error) : [];
  }

  private static refusesSustain(error: unknown): boolean {
    return ChatStoreService.refusedArguments(error).some(t => ChatStoreService.sustainFields.includes(t));
  }

  private static refusesHandOffs(error: unknown): boolean {
    return ChatStoreService.refusedArguments(error).includes(ProtocolResources.usageHandOffsField);
  }

  private static refusedArguments(error: unknown): readonly string[] {
    const details: unknown = Reflect.get(Object(error), Resources.errorDetailsField);
    const ids: unknown = Object.isObject(details) ? Reflect.get(details, Resources.errorArgumentsField) : null;
    return Array.isArray(ids) ? ids.filter((t): t is string => typeof t === "string") : [];
  }

  private static movedSettings(teammate: Teammate, catalog: ModelCatalog): [string | null, string | null, string | null] {
    if (catalog.failed)
      return [teammate.model, teammate.effort, teammate.speed];
    const model = catalog.resolveModel(teammate.model);
    return model === teammate.model ? [model, catalog.resolveEffort(model, teammate.effort), catalog.resolveSpeed(model, teammate.speed)] : [model, null, null];
  }

  private static byMessage(approvals: readonly Approval[]): ReadonlyMap<string, readonly Approval[]> {
    const grouped = new Map<string, Approval[]>();
    for (const approval of approvals) {
      const group = grouped.get(approval.messageId);
      if (Object.isUndefined(group))
        grouped.set(approval.messageId, [approval]);
      else
        group.push(approval);
    }
    for (const group of grouped.values())
      group.sort((a, b) => a.id < b.id ? -1 : 1);
    return grouped;
  }

  private static newestFirst(conversations: readonly Conversation[]): readonly Conversation[] {
    return conversations.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private static merge(first: readonly Message[], second: readonly Message[]): readonly Message[] {
    const byId = new Map<string, Message>();
    for (const message of [...first, ...second])
      byId.set(message.id, message);
    return [...byId.values()].toSorted((a, b) => a.sequence - b.sequence);
  }

  private static withAppliedDetail(message: Message, detail: MessageDetail): Message {
    return message.withDetails(message.details.filter(t => t.sequence !== detail.sequence).concat(detail).toSorted((a, b) => a.sequence - b.sequence));
  }

  private static planReadKey(kind: string, providerId: string | null): string {
    return JSON.stringify([kind, providerId]);
  }

  private static upsert<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
    const index = items.findIndex(t => t.id === item.id);
    return index < 0 ? [...items, item] : items.map((t, i) => i === index ? item : t);
  }

  private static readArray<T>(value: JsonValue, read: (item: unknown) => T): readonly T[] {
    if (!Array.isArray(value))
      throw new ListNotArrayException(Resources.formatValueKind(value));

    return value.map(t => read(t));
  }
}
