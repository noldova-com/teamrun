/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { isAbsolute, join } from "node:path";
import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import {
  AuthStatus, ConversationMemberParams, ProviderAbility, RequestedSettings, Teammate, TeammateFallback, TeammateMention, MentionResolver,
  AttachmentContent,
  AttachmentInput,
  type AttachmentReadParams,
  LinkedPaths,
  Approval,
  type ApprovalDecideParams,
  BackgroundTaskStatus,
  type Conversation,
  type ConversationResponder,
  type ConversationResponderParams,
  ConversationIdParams,
  type ConversationRewindParams,
  ConversationRewindResult,
  DetailEventPayload,
  DetailKind,
  type Draft,
  ErrorCode,
  Event,
  EventName,
  Message,
  type MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessageIdParams,
  MessageSendParams,
  MessageSendResult,
  MessageSender,
  MessageStatus,
  ObservedSettings,
  Provenance,
  type ProviderMode,
  type McpToolCallParams,
  type McpToolListParams,
  ReplyPlan,
  SenderEnvironment,
  Resources as ProtocolResources,
  type ConversationMember,
  type Provider,
  type WrittenImageReadParams,
  WrittenImageReader,
  SubAgent,
  type SubAgentStartParams,
  SubAgentStatus,
  type SubAgentStopParams,
  type SubAgentWaitParams,
  type BackgroundTask,
  type ChatIdParams,
  WaitingMessage,
  type WaitingMessageAddParams,
  type WaitingMessageEditParams,
  type WaitingMessageIdParams,
  WaitingMessagesPayload,
  type CommandStartParams,
  SubAgentWaitResult
} from "@noldova/teamrun.protocol";

import { ChatWakeKind } from "../../enums/chat-wake-kind.js";
import { ChatWakeState } from "../../enums/chat-wake-state.js";
import { FolderState } from "../../enums/folder-state.js";
import { PermissionAnswer } from "../../enums/permission-answer.js";
import { SessionCarry } from "../../enums/session-carry.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IBackgroundTasksService } from "../../interfaces/i-background-tasks.service.js";
import type { ICheckpointsService } from "../../interfaces/i-checkpoints.service.js";
import type { ICommandStarter } from "../../interfaces/i-command-starter.js";
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { ITimer } from "../../interfaces/i-timer.js";
import type { IConversationEngine } from "../../interfaces/i-conversation-engine.js";
import type { IOpenedFile } from "../../interfaces/i-opened-file.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { IOrganizationSender } from "../../interfaces/i-organization-sender.js";
import type { IOutsideMessages } from "../../interfaces/i-outside-messages.js";
import type { IPermissionAsker } from "../../interfaces/i-permission-asker.js";
import type { ISenderSends } from "../../interfaces/i-sender-sends.js";
import type { ISenderTokens } from "../../interfaces/i-sender-tokens.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ISharedMcpServersService } from "../../interfaces/i-shared-mcp-servers.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { ITurnToolSessions } from "../../interfaces/i-turn-tool-sessions.js";
import { Guid } from "../../models/guid.js";
import type { OutsideReply } from "../../models/outside-reply.js";
import { PermissionAsk } from "../../models/permission-ask.js";
import { ReplyWork } from "../../models/reply-work.js";
import { ReportedSharedMcpFailures } from "../../models/reported-shared-mcp-failures.js";
import { SendAsk } from "../../models/send-ask.js";
import { SharedMcpSelection } from "../../models/shared-mcp-selection.js";
import { TaskEnd } from "../../models/task-end.js";
import { TaskStart } from "../../models/task-start.js";
import { ParticipantContext } from "./participant-context.js";
import { ChatWake } from "../../models/chat-wake.js";
import type { CommandExit } from "../../models/command-exit.js";
import { AttachmentStore } from "./attachment-store.js";
import { ChatWakes } from "./chat-wakes.js";
import { WaitingSends } from "./waiting-sends.js";
import { FileSystemErrors } from "./file-system-errors.js";
import { ProjectImageReader } from "./project-image.reader.js";
import { SharedImages } from "./shared-images.js";
import { TeammateCommand } from "../../models/teammate-command.js";
import { TurnRequest } from "../../models/turn-request.js";
import { TitleModel } from "../../models/title-model.js";
import type { TurnWake } from "../../models/turn-wake.js";
import { WakeTurn } from "../../models/wake-turn.js";
import { WorkFolder } from "../../models/work-folder.js";
import { ConversationTitle } from "../../models/conversation-title.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";
import { NodeTimer } from "../node-timer.js";
import { AccountLimits } from "../sustain/account-limits.js";
import { ChatSummary } from "../sustain/chat-summary.js";
import { HandoverNote } from "../sustain/handover-note.js";
import type { HandoverPrompt } from "../sustain/handover-prompt.js";
import { SustainRouter } from "../sustain/sustain-router.js";
import { SustainAttempts } from "../sustain/sustain-attempts.js";
import { HandoverSummaries } from "../sustain/handover-summaries.js";
import { ProjectActivity } from "../projects/project-activity.js";
import { EngineServices } from "./engine-services.js";
import { KeptSessions } from "./kept-sessions.js";
import { McpToolCalls } from "./mcp-tool-calls.js";
import { MentionCheck } from "./mention-check.js";
import { OutsideMessages } from "./outside-messages.js";
import { PermissionAsks } from "./permission-asks.js";
import { ChatTitles } from "./chat-titles.js";
import { ReplyRun } from "./reply-run.js";
import { TurnState } from "./turn-state.js";
import { SendPlan } from "./send-plan.js";
import { ReplyCheckpoints } from "./reply-checkpoints.js";
import { CommandRun } from "./command-run.js";
import { StoppedCommands } from "./stopped-commands.js";
import { SubAgentRun } from "./sub-agent-run.js";

export class ConversationEngine implements IConversationEngine, IOrganizationSender, IOutsideMessages, IPermissionAsker, ISenderSends, ISenderTokens {
  private readonly adoptedSenders: Map<ReplyWork, string> = new Map();
  private readonly teammates: ITeammatesService;
  private readonly sharedFailures: ReportedSharedMcpFailures = new ReportedSharedMcpFailures();
  private readonly state: TurnState = new TurnState();
  private readonly completions: Map<string, Promise<void>> = new Map();
  private readonly followed: Map<ReplyWork, Promise<void>> = new Map();
  private readonly subAgents: Map<string, SubAgentRun> = new Map();
  private readonly commands: Map<string, CommandRun> = new Map();
  private readonly startingCommands: Set<CommandRun> = new Set();
  private readonly stoppedCommands: StoppedCommands = new StoppedCommands();
  private readonly writers: Map<string, Promise<void>> = new Map();
  private readonly replyHops: Map<string, Map<string, number>> = new Map();
  private readonly stopping: Map<ReplyWork, Promise<void>> = new Map();
  private readonly listedByStop: WeakSet<ReplyWork> = new WeakSet();
  private readonly wakes: ChatWakes;
  private readonly context: DatabaseContext;
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly providers: IProvidersService;
  private readonly registry: ProviderKindRegistry;
  private readonly events: IEventSink;
  private readonly attachments: AttachmentStore;
  private readonly sharedImages: SharedImages;
  private readonly readHopLimit: () => number;
  private readonly readIdleCompaction: () => boolean;
  private readonly log: ILog | null;
  private readonly readCommand: () => Promise<TeammateCommand | null>;
  private readonly tasks: IBackgroundTasksService | null;
  private readonly planUsage: IPlanUsageService | null;
  private readonly tools: ITurnToolSessions | null;
  private readonly sharedServers: ISharedMcpServersService | null;
  private readonly checkpoints: ReplyCheckpoints | null;
  private readonly commandStarter: ICommandStarter | null;
  private readonly titles: ChatTitles;
  private readonly outside: OutsideMessages;
  private readonly toolCalls: McpToolCalls;
  private readonly permissions: PermissionAsks;
  private readonly keptSessions: KeptSessions;
  private readonly waitingSends: WaitingSends;
  private readonly timer: ITimer;
  private readonly limits: AccountLimits;
  private readonly attempts: SustainAttempts;
  private readonly summaries: HandoverSummaries;
  private readonly sustain: SustainRouter;
  private readonly chosenModes: Map<string, Map<string, ProviderMode | null>> = new Map();
  private readonly sendingChats: Set<string> = new Set();
  private readonly refusedSends: Set<string> = new Set();
  private readonly background: Set<Promise<void>> = new Set();

  public constructor(
    context: DatabaseContext,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    providers: IProvidersService,
    teammates: ITeammatesService,
    registry: ProviderKindRegistry,
    events: IEventSink,
    attachments: AttachmentStore | null = null,
    readHopLimit: () => number = () => Resources.defaultHopLimit,
    log: ILog | null = null,
    readCommand: () => Promise<TeammateCommand | null> = () => Promise.resolve(new TeammateCommand(Resources.defaultCommand)),
    tasks: IBackgroundTasksService | null = null,
    planUsage: IPlanUsageService | null = null,
    tools: ITurnToolSessions | null = null,
    checkpoints: ICheckpointsService | null = null,
    sharedServers: ISharedMcpServersService | null = null,
    sharedImages: SharedImages | null = null,
    commandStarter: ICommandStarter | null = null,
    readTitleModel: () => string = () => String.empty,
    readIdleCompaction: () => boolean = () => true,
    timer: ITimer = new NodeTimer()) {
    this.context = context;
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
    this.approvals = approvals;
    this.providers = providers;
    this.teammates = teammates;
    this.registry = registry;
    this.events = events;
    this.wakes = new ChatWakes(context, log);
    this.attachments = attachments ?? new AttachmentStore(context.dataDirectory);
    this.sharedImages = sharedImages ?? new SharedImages(join(context.dataDirectory, Resources.sharedImagesDirectoryName), undefined, undefined, undefined, log);
    this.readHopLimit = readHopLimit;
    this.readIdleCompaction = readIdleCompaction;
    this.log = log;
    try {
      this.sharedImages.clean();
    }
    catch (error) {
      if (!FileSystemErrors.isFileSystemError(error))
        throw error;
      this.log?.write(Resources.formatSharedImagesNotCleaned(Resources.formatFailureKind(error)));
    }
    this.readCommand = readCommand;
    this.tasks = tasks;
    this.planUsage = planUsage;
    this.tools = tools;
    this.sharedServers = sharedServers;
    this.checkpoints = Object.isNull(checkpoints) ? null : new ReplyCheckpoints(checkpoints);
    this.commandStarter = commandStarter;
    this.titles = new ChatTitles(conversations, providers, registry, events, join(context.dataDirectory, Resources.titleSessionsDirectoryName), readTitleModel, log);
    const services = new EngineServices(context, projects, conversations, messages, approvals, providers, teammates, registry, events, tools, log,
      this.checkpoints, this.attachments);
    const callbacks: IEngineCallbacks = {
      requireConversationAsync: (id, transaction) => this.requireConversationAsync(id, transaction),
      requireTeammateAsync: (id, transaction) => this.requireTeammateAsync(id, transaction),
      capEndsTasksAsync: (teammate, chatId) => this.capEndsTasksAsync(teammate, chatId),
      sendMessageAsync: (params, prompt, allowed, signal, outside, queues) => this.sendMessageAsync(params, prompt, allowed, signal, outside, queues),
      refuseRaisedModeAsync: params => this.refuseRaisedModeAsync(params),
      toolModeOfAsync: open => this.toolModeOfAsync(open),
      modeIn: requested => this.modeIn(requested),
      nameOf: reply => this.nameOf(reply),
      cancelAsync: params => this.cancelAsync(params),
      startedRequestedAsync: (reply, transaction) => this.startedRequestedAsync(reply, transaction),
      requireMessageAsync: (messageId, transaction) => this.requireMessageAsync(messageId, transaction),
      sendWaitingAsync: chatId => this.waitingSends.sendWaitingAsync(chatId),
      findGroup: conversationId => this.findGroup(conversationId),
      requireWorkFolderAsync: (conversation, prepare, transaction) => this.requireWorkFolderAsync(conversation, prepare, transaction),
      stopAsync: item => this.stopAsync(item),
      isIdleAsync: (chatId, held) => this.isIdleAsync(chatId, undefined, held),
      beginSending: chatId => this.beginSending(chatId),
      endSending: chatId => this.endSending(chatId),
      track: (chatId, work) => this.track(chatId, work),
      settleSafelyAsync: (conversationId, settleAsync) => this.settleSafelyAsync(conversationId, settleAsync)
    };
    this.outside = new OutsideMessages(services, callbacks);
    this.toolCalls = new McpToolCalls(services, this.state, callbacks);
    this.permissions = new PermissionAsks(services, this.state, callbacks);
    this.keptSessions = new KeptSessions(services, callbacks);
    this.waitingSends = new WaitingSends(services, this.state, callbacks);
    this.timer = timer;
    this.limits = new AccountLimits(context);
    this.attempts = new SustainAttempts(context);
    this.summaries = new HandoverSummaries(context, registry, join(context.dataDirectory, Resources.summarySessionsDirectoryName), timer, log);
    this.sustain = new SustainRouter(this.limits, () => this.planUsage?.list() ?? [], async t => this.canReply(await this.providers.findAsync(t)), timer);
  }

  public get activeRunCount(): number {
    return this.state.groups.size;
  }

  public prepareAttachment(input: AttachmentInput): MessageAttachment {
    return this.attachments.prepare(input);
  }

  public prepareOpenedAttachmentAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment> {
    return this.attachments.prepareOpenedAsync(input, source);
  }

  public async refuseRaisedModeAsync(params: MessageSendParams): Promise<void> {
    const requested = params.requested;
    if (Object.isNull(requested) || Object.isNull(requested.mode))
      return;
    const chosen = (await this.conversations.findAsync(params.conversationId))?.responder?.requested ?? null;
    const allowed = [chosen, (await this.teammates.readDefaultAsync())?.requested ?? null];
    if (!allowed.some(t => t?.kind === requested.kind && t.mode === requested.mode))
      throw new ServiceException(ErrorCode.Unauthorized, Resources.unchosenModeRefused, [requested.kind, requested.mode]);
  }

  public discardAttachment(attachment: MessageAttachment): void {
    this.attachments.discardPrepared(attachment);
  }

  public async readAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<AttachmentContent> {
    const attachment = await this.attachmentOfAsync(params, draft);
    return new AttachmentContent(attachment.name, attachment.mediaType, attachment.size,
      this.attachments.load(attachment).toString(Resources.base64Encoding));
  }

  public async locateAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<MessageAttachment> {
    return this.attachments.locateSaved(await this.attachmentOfAsync(params, draft));
  }

  public async hasAttachmentAsync(params: AttachmentReadParams): Promise<boolean> {
    const attachment = await this.messages.findAttachmentAsync(params.conversationId, params.path);
    if (Object.isNull(attachment))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatAttachmentNotFound(params.path), [params.path]);
    return this.attachments.exists(attachment);
  }

  public async listLinkedFolders(params: LinkedPaths): Promise<LinkedPaths> {
    const candidates = [...new Set(params.paths.filter(t => isAbsolute(t) && !Resources.linkedNetworkPathPattern.test(t) && !Resources.linkedControlCharacterPattern.test(t)))]
      .slice(0, Resources.maximumLinkedFolderPaths);
    const states = await Promise.all(candidates.map(t => this.projects.checkLinkedFolderAsync(t)));
    return new LinkedPaths(candidates.filter((_, i) => states[i] === FolderState.Present));
  }

  public async readWrittenImageAsync(params: WrittenImageReadParams): Promise<AttachmentContent> {
    return ProjectImageReader.read((await this.writtenImageFolderOfAsync(params)).path, params.path);
  }

  public async locateWrittenImageAsync(params: WrittenImageReadParams): Promise<MessageAttachment> {
    const folder = await this.writtenImageFolderOfAsync(params);
    return ProjectImageReader.share(folder.path, params.path, folder.isStored ? null : this.sharedImages);
  }

  private async writtenImageFolderOfAsync(params: WrittenImageReadParams): Promise<{ readonly path: string; readonly isStored: boolean }> {
    const conversation = await this.requireConversationAsync(params.conversationId);
    const folder = await this.requireWorkFolderAsync(conversation, false);
    const message = await this.messages.findAsync(params.messageId);
    const notFound = new ServiceException(ErrorCode.NotFound, Resources.formatWrittenImageNotFound(params.path), [params.path]);
    if (Object.isNull(message) || message.conversationId !== conversation.id)
      throw notFound;
    const reader = new WrittenImageReader();
    if (message.details.some(t => reader.storedPathOf(t) === params.path))
      return { path: join(this.context.dataDirectory, Resources.imagesDirectoryName), isStored: true };
    if (!reader.pathsOf(message, folder.path).includes(params.path) && !reader.markdownImagePathsOf(message, folder.path).includes(params.path)
      && !reader.markdownLinkImagePathsOf(message, folder.path).includes(params.path)
      && !message.details.some(t => reader.generatedPathOf(t, folder.path) === params.path))
      throw notFound;
    return { path: folder.path, isStored: false };
  }

  public async sendAsync(params: MessageSendParams, signal?: AbortSignal): Promise<MessageSendResult> {
    return this.sendMessageAsync(params, null, null, signal);
  }

  public addWaitingAsync(params: WaitingMessageAddParams, fromOutside: boolean = false): Promise<WaitingMessage> {
    return this.waitingSends.addWaitingAsync(params, fromOutside);
  }

  public listWaitingAsync(params: ChatIdParams): Promise<WaitingMessagesPayload> {
    return this.waitingSends.listWaitingAsync(params);
  }

  public editWaitingAsync(params: WaitingMessageEditParams, fromOutside: boolean = false): Promise<WaitingMessage> {
    return this.waitingSends.editWaitingAsync(params, fromOutside);
  }

  public removeWaitingAsync(params: WaitingMessageIdParams): Promise<void> {
    return this.waitingSends.removeWaitingAsync(params);
  }

  public sendWaitingNowAsync(params: WaitingMessageIdParams): Promise<WaitingMessage> {
    return this.waitingSends.sendWaitingNowAsync(params);
  }

  public async describeSendAsync(params: MessageSendParams): Promise<SendAsk | null> {
    try {
      return await this.askOfAsync(await this.planSendAsync(params, false));
    }
    catch (error) {
      if (error instanceof ServiceException)
        return null;
      throw error;
    }
  }

  public async sendAllowedAsync(params: MessageSendParams, starts: string | null): Promise<MessageSendResult> {
    return this.sendMessageAsync(params, null, { starts }, undefined);
  }

  public sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId: string | null = null): Promise<string> {
    return this.outside.sendOutsideAsync(teammateId, text, label, chatId);
  }

  public async startOutsideAsync(teammateId: string, text: string, label: string): Promise<MessageSendResult> {
    const teammate = await this.requireTeammateAsync(teammateId);
    const provider = await this.providers.findAsync(teammate.providerId);
    if (!this.canReply(provider))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatAccountCannotReply(teammate.name, provider?.label ?? null), [teammateId]);
    return this.outside.startOutsideAsync(teammateId, text, label);
  }

  public listOutsideChatsAsync(): Promise<readonly JsonObject[]> {
    return this.outside.listOutsideChatsAsync();
  }

  public listOutsideAsync(): Promise<readonly JsonObject[]> {
    return this.outside.listOutsideAsync();
  }

  public readOutsideAsync(messageId: string): Promise<OutsideReply> {
    return this.outside.readOutsideAsync(messageId);
  }

  public forgetOutsideAsync(): Promise<void> {
    return this.outside.forgetOutsideAsync();
  }

  private async sendMessageAsync(params: MessageSendParams, prompt: string | null, allowed: { readonly starts: string | null } | null,
    signal: AbortSignal | undefined, outside: MessageSender | null = null, queues: boolean = false): Promise<MessageSendResult> {
    if (!Object.isNull(params.senderToken) && !Object.isNull(params.requested) && !Object.isNull(params.requested.mode)) {
      this.requireTurn(params.senderToken);
      await this.refuseUnrestrictedAsync(params.requested, params.requested.mode, params.providerId);
    }
    let plan = await this.planSendAsync(params, true, null, outside, queues);
    if (!Object.isNull(plan.origin)) {
      const shown = Object.isNull(allowed) ? await this.permissions.askSendAsync(plan.origin, await this.askOfAsync(plan), params.text, signal) : allowed.starts;
      plan = await this.planSendAsync(params, true, plan.origin);
      if ((await this.askOfAsync(plan)).starts !== shown)
        throw new ServiceException(ErrorCode.Conflict, Resources.sendChangedBeforeAllowed, [plan.conversation.id]);
    }
    const { conversation, folder, origin, sender, group, mentions, called, participants, requested, providerId, hop, limit, stopped } = plan;
    const projectLease = this.context.projectActivity.enterTurn(folder.path);
    let attachments: readonly MessageAttachment[] = [];
    let sent: Message | null = null;
    let work: readonly ReplyWork[] = [];
    const completion = Promise.withResolvers<void>();
    void completion.promise.catch(ConversationEngine.ignore);
    try {
      const now = new Date().toISOString();
      attachments = this.attachments.save(params.attachments);
      const { message, pending, wake, opening, joined, joining } = await this.context.database.connection.runInTransactionAsync(async transaction => {
        await this.requireUnmovedAsync(conversation, transaction);
        const busy = !Object.isNull(await this.messages.findOpenReplyAsync(conversation.id, transaction)) || !Object.isNull(this.findGroup(conversation.id));
        const joining = Object.isNull(sender) && !queues ? null : this.findGroup(conversation.id);
        if (busy && Object.isNull(joining))
          throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id), [conversation.id]);
        if (!Object.isNull(origin) && (Object.isNull(params.senderToken) || this.state.turns.get(params.senderToken) !== origin))
          throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
        if (!Object.isNull(group) && joining !== group && !queues)
          throw new ServiceException(ErrorCode.Conflict, Resources.replyEndedWhileSent, [conversation.id]);
        const sequence = await this.messages.nextSequenceAsync(conversation.id, transaction);
        const opening = ConversationEngine.openingOf(conversation, sequence, params.text, attachments);
        const question = new MessageDetail(0, DetailKind.Text, params.text, Object.isNull(prompt) ? null : { [Resources.promptField]: prompt }, now);
        const details = String.isNullOrEmpty(params.text) ? [] : [question];
        const note = new MessageDetail(details.length, DetailKind.Note, Resources.formatChainStopped(limit), { source: Resources.handOffSource }, now);
        const message = new Message(Guid.createVersion7().toString(), conversation.id, sequence, MessageAuthor.User, null,
          MessageStatus.Completed, stopped ? [...details, note] : details, null, now, null, now, attachments,
          null, null, mentions.map(t => new TeammateMention(t.id, t.name)), sender ?? outside);
        const pending: ReplyWork[] = [];
        for (const participant of stopped ? [] : participants) {
          const item = await this.prepareReplyAsync(participant, requested, providerId, message, sequence + pending.length + 1, now, hop, null, null, transaction);
          if (!Object.isNull(item))
            pending.push(item);
        }
        const wake = params.wakeWhenDone && !Object.isNull(origin) && pending.length > 0
          ? new ChatWake(Guid.createVersion7().toString(), ChatWakeKind.Reply, origin.message.conversationId, origin.message.id, conversation.id,
            pending.map(t => t.message.id), ChatWakeState.Waiting, null, null, now)
          : null;
        let joined = false;
        for (const participant of called) {
          const member = new ConversationMemberParams(conversation.id, participant.id);
          if (Object.isNull(await this.conversations.findMemberAsync(member, transaction))) {
            await this.conversations.addMemberAsync(member, transaction);
            joined = true;
          }
        }
        await this.messages.insertAsync(message, transaction);
        for (const item of pending)
          await this.messages.insertAsync(item.message, transaction);
        if (!Object.isNull(wake))
          await this.wakes.addAsync(wake, transaction);
        if (!Object.isNull(opening))
          await this.conversations.giveTitleAsync(conversation.id, new ConversationTitle(opening).text, transaction);
        return { message, pending, wake, opening, joined, joining };
      });
      sent = message;
      work = pending;
      const into = Object.isNull(joining) ? null : this.findGroup(conversation.id);
      if (!Object.isNull(into))
        into.push(...pending);
      origin?.recordSend([...mentions, ...participants].flatMap(t => Object.isNull(t) ? [] : [t.id]));
      if (Object.isNull(into) && pending.length > 0) {
        this.state.groups.set(message.id, pending);
        this.completions.set(message.id, completion.promise);
      }
      for (const item of pending)
        this.state.runs.set(item.message.id, item.run);
      this.events.publish(new Event(EventName.MessageCreated, message.toJson()));
      for (const item of pending)
        this.events.publish(new Event(EventName.MessageCreated, item.message.toJson()));
      if (joined || !Object.isNull(opening))
        this.events.publish(new Event(EventName.StateInvalidated, null));
      if (!Object.isNull(opening))
        await this.titles.beginAsync(conversation.id, opening,ConversationEngine.titleModelOf(pending[0]));
      if (pending.length === 0 || !Object.isNull(into)) {
        this.titles.end(conversation.id);
        this.context.projectActivity.leave(projectLease);
        return new MessageSendResult(message, pending.map(t => t.message), wake?.id ?? null);
      }
      const execution = this.executeRepliesAsync(pending, folder).finally(async () => {
        for (const item of pending) {
          item.end();
          this.closeRun(item);
          this.releaseWake(item);
          this.followed.delete(item);
        }
        this.state.groups.delete(message.id);
        this.completions.delete(message.id);
        this.titles.end(message.conversationId);
        this.context.projectActivity.leave(projectLease);
        await this.sendQueuedAsync(message.conversationId);
        await this.settleWakesAsync(message.conversationId, pending);
      });
      void execution.then(() => completion.resolve(), error => completion.reject(error));
      return new MessageSendResult(message, pending.map(t => t.message), wake?.id ?? null);
    }
    catch (error) {
      const chatId = sent?.conversationId ?? null;
      try {
        if (Object.isNull(chatId))
          this.attachments.discard(attachments);
        else
          await this.failPendingRepliesAsync(work, error);
      }
      finally {
        if (!Object.isNull(sent)) {
          this.state.groups.delete(sent.id);
          this.completions.delete(sent.id);
        }
        for (const item of work) {
          item.end();
          this.closeRun(item);
          this.releaseWake(item);
          this.followed.delete(item);
        }
        this.context.projectActivity.leave(projectLease);
        completion.resolve();
        if (!Object.isNull(chatId)) {
          await this.sendQueuedAsync(chatId);
          await this.settleWakesAsync(chatId, work);
        }
      }
      throw error;
    }
  }

  public async reconcileAsync(): Promise<readonly Message[]> {
    const now = new Date().toISOString();
    const interrupted: Message[] = [];
    const ended = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const stopped: { readonly open: Message; readonly withoutSubAgents: Message; readonly message: Message; readonly cancelled: readonly Approval[] }[] = [];
      for (const open of await this.messages.listOpenAsync(transaction)) {
        const note = new MessageDetail(open.details.length, DetailKind.Note, Resources.replyInterruptedByStop, null, now);
        const withoutSubAgents = ConversationEngine.stopSubAgents(open);
        const message = withoutSubAgents.withDetail(note).withStatus(MessageStatus.Interrupted, now);
        const cancelled = (await this.approvals.listPendingAsync(open.id, transaction)).filter(t => Object.isNull(ReplyRun.replyToOf(t)))
          .map(t => t.withCancellation(now));
        await this.messages.updateAsync(message, transaction);
        for (const approval of cancelled)
          await this.approvals.updateAsync(approval, transaction);
        stopped.push({ open, withoutSubAgents, message, cancelled });
      }
      return stopped;
    });
    for (const { open, withoutSubAgents, message, cancelled } of ended) {
      this.publishStopped(open, withoutSubAgents);
      this.events.publish(new Event(EventName.MessageUpdated, message.toJson()));
      for (const approval of cancelled)
        this.events.publish(new Event(EventName.ApprovalUpdated, approval.toJson()));
      interrupted.push(message);
    }
    const left = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const stopped: (readonly [Message, Message])[] = [];
      for (const running of await this.messages.listWithRunningSubAgentsAsync(transaction)) {
        const message = ConversationEngine.stopSubAgents(running);
        await this.messages.updateAsync(message, transaction);
        stopped.push([running, message]);
      }
      return stopped;
    });
    for (const [running, message] of left) {
      this.publishStopped(running, message);
      this.events.publish(new Event(EventName.MessageUpdated, message.toJson()));
    }
    const late = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const cancelled = (await this.approvals.listPendingAllAsync(transaction)).filter(t => Object.isNull(ReplyRun.replyToOf(t))).map(t => t.withCancellation(now));
      for (const approval of cancelled)
        await this.approvals.updateAsync(approval, transaction);
      return cancelled;
    });
    for (const approval of late)
      this.events.publish(new Event(EventName.ApprovalUpdated, approval.toJson()));
    const unsent = new Set<string>();
    for (const approval of await this.approvals.listUnsentAnswersAsync()) {
      const queued = this.permissions.answerOf(approval, await this.requireMessageAsync(approval.messageId));
      if (!Object.isNull(queued)) {
        this.permissions.queueAnswer(queued);
        unsent.add(queued.params.conversationId);
      }
    }
    for (const wake of await this.wakes.listAsync(ChatWakeState.Waiting))
      await this.settleSafelyAsync(wake.chatId, async () => {
        const [text, end] = await this.lostOfAsync(wake);
        await this.deliverWakeAsync(wake.settled(ChatWakeState.Ready, text, null), end);
      });
    for (const conversationId of unsent)
      await this.permissions.sendAnswersAsync(conversationId);
    await this.waitingSends.resumeAsync();
    for (const chatId of new Set((await this.wakes.listAsync(ChatWakeState.Ready)).map(t => t.chatId)))
      await this.settleSafelyAsync(chatId, () => this.sendWakesAsync(chatId));

    return interrupted;
  }

  public rewindAsync(params: ConversationRewindParams): Promise<ConversationRewindResult> {
    return this.keptSessions.rewindAsync(params);
  }

  public releaseFolderAsync(conversationId: string): Promise<void> {
    return this.keptSessions.releaseFolderAsync(conversationId);
  }

  public async requireNothingRunningAsync(conversationId: string, change: string): Promise<void> {
    const running = await this.runningWorkAsync(conversationId);
    if (running.length > 0)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatChatWorkRunning(change, running), [conversationId]);
  }

  private async runningWorkAsync(conversationId: string): Promise<readonly string[]> {
    const tasks = await this.runningTasksAsync(conversationId);
    let kept = false;
    for (const [messageId, run] of this.state.runs) {
      const message = run.isOpen && !tasks.some(t => t.messageId === messageId) ? await this.messages.findAsync(messageId) : null;
      kept ||= message?.conversationId === conversationId && !Object.isNull(message.endedAt);
    }
    return [...tasks.map(t => Object.isNull(t.subAgentId) ? Resources.formatRunningCommand(t.command) : Resources.formatRunningHelper(t.command)),
      ...(kept ? [Resources.runningReplyWork] : [])];
  }

  private async runningTasksAsync(chatId: string): Promise<readonly BackgroundTask[]> {
    const listed = Object.isNull(this.tasks) ? [] : await this.tasks.listAsync(new ConversationIdParams(chatId));
    return listed.filter(t => t.status === BackgroundTaskStatus.Running);
  }

  public sweepFoldersAsync(signal: AbortSignal): Promise<void> {
    return this.keptSessions.sweepFoldersAsync(signal);
  }

  private async attachmentOfAsync(params: AttachmentReadParams, draft: Draft | null): Promise<MessageAttachment> {
    const attachment = await this.messages.findAttachmentAsync(params.conversationId, params.path) ?? draft?.attachments.find(t => t.path === params.path);
    if (Object.isNullOrUndefined(attachment))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatAttachmentNotFound(params.path), [params.path]);
    return attachment;
  }

  public async cancelAsync(params: MessageIdParams): Promise<Message> {
    const [key, group] = [...this.state.groups].find(t => t[1].some(work => work.message.id === params.messageId)) ?? [String.empty, []];
    const item = group.find(t => t.message.id === params.messageId);
    const completion = this.completions.get(key);
    if (Object.isUndefined(item) || Object.isUndefined(completion) || item.isEnded)
      return this.cancelAfterTurnAsync(await this.requireMessageAsync(params.messageId));

    await this.stopAsync(item);
    await item.ended;
    if (group.every(t => t.isEnded))
      await completion;
    return this.requireMessageAsync(params.messageId);
  }

  public async approvePlanAsync(params: MessageIdParams): Promise<MessageSendResult> {
    const { reply, approved, provenance } = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const reply = await this.requireMessageAsync(params.messageId, transaction);
      const conversation = await this.conversations.findAsync(reply.conversationId, transaction);
      const plan = ReplyPlan.ofDetails(reply.details);
      const provenance = reply.provenance;
      if (!reply.awaitsPlanApproval(conversation) || Object.isNull(plan) || Object.isNull(plan.title) || Object.isNull(provenance)
        || await this.messages.nextSequenceAsync(reply.conversationId, transaction) !== reply.sequence + 1)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatPlanNotAwaitingApproval(reply.id), [reply.id]);
      const approved = reply.withDetail(new MessageDetail(reply.details.length, DetailKind.Plan, plan.title,
        new ReplyPlan([], null, plan.text, false, true).toJson(), new Date().toISOString()));
      await this.messages.updateAsync(approved, transaction);
      await this.conversations.approvePlanAsync(reply.conversationId, reply.teammateId, transaction);
      return { reply, approved, provenance };
    });
    const named = !Object.isNull(reply.teammateId);
    try {
      const followed = await this.sendAsync(new MessageSendParams(reply.conversationId, Resources.planApprovedPrompt,
        named ? null : provenance.requested.withPlanFirst(false), named ? null : provenance.providerId, [], [], reply.teammateId));
      this.events.publish(new Event(EventName.MessageUpdated, approved.toJson()));
      this.events.publish(new Event(EventName.StateInvalidated, null));
      return followed;
    }
    catch (error) {
      await this.context.database.connection.runInTransactionAsync(async transaction => {
        if (await this.messages.nextSequenceAsync(reply.conversationId, transaction) !== reply.sequence + 1)
          return;
        await this.messages.updateAsync(reply, transaction);
        await this.conversations.reopenPlanAsync(reply.conversationId, reply.teammateId, transaction);
      });
      throw error;
    }
  }

  public async cancelConversationAsync(params: ConversationIdParams): Promise<readonly Message[]> {
    const [key, group] = [...this.state.groups].find(t => t[1][0]?.message.conversationId === params.conversationId) ?? [String.empty, undefined];
    const completion = this.completions.get(key);
    if (Object.isUndefined(group) || Object.isUndefined(completion))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatNoReplyInProgress(params.conversationId), [params.conversationId]);

    const open = group.filter(t => !t.isEnded && !t.run.isCancelled);
    const known = new Set(group);
    await Promise.all(group.map(t => this.stopAsync(t)));
    await completion;
    const listed = [...open, ...group.filter(t => !known.has(t))].filter(t => !this.listedByStop.has(t));
    for (const item of listed)
      this.listedByStop.add(item);
    return (await Promise.all(listed.map(t => this.requireMessageAsync(t.message.id)))).filter(t => t.status === MessageStatus.Cancelled);
  }

  public async setResponderAsync(params: ConversationResponderParams): Promise<Conversation> {
    const conversation = await this.conversations.setResponderAsync(params);
    const requested = conversation.responder?.requested ?? null;
    if (!Object.isNull(requested) && this.registry.has(requested.kind)) {
      const kinds = this.chosenModes.get(conversation.id) ?? new Map<string, ProviderMode | null>();
      this.chosenModes.set(conversation.id, kinds.set(requested.kind, this.modeIn(requested)));
    }
    return conversation;
  }

  public async forgetAsync(conversationIds: readonly string[]): Promise<void> {
    this.titles.forget(conversationIds);
    for (const conversationId of conversationIds) {
      this.chosenModes.delete(conversationId);
      this.replyHops.delete(conversationId);
      this.keptSessions.forget(conversationId);
    }
    this.sharedFailures.forget(conversationIds);
    this.stoppedCommands.forget(conversationIds);
    for (const wake of (await this.wakes.listAsync(ChatWakeState.Waiting)).filter(t => conversationIds.includes(t.watchedChatId)))
      await this.settleSafelyAsync(wake.chatId, async () => {
        await this.deliverWakeAsync(wake.settled(ChatWakeState.Ready, Resources.formatWakeChatDeleted(wake.watchedChatId), null), ProtocolResources.wakeChatDeletedEnd);
      });
  }

  public forgetTeammate(teammateId: string, conversationId: string | null): void {
    this.stoppedCommands.forgetTeammate(teammateId, conversationId);
  }

  public async planFirstAsync(conversationId: string): Promise<void> {
    const sessions = new Map<string, Set<string>>();
    for (const id of [...this.state.runs.keys()]) {
      const reply = await this.messages.findAsync(id);
      const session = reply?.provenance?.nativeSessionId;
      const kind = reply?.provenance?.requested.kind;
      if (reply?.conversationId !== conversationId || Object.isNullOrUndefined(session) || Object.isUndefined(kind)
        || !await this.plansFirstAsync(conversationId, kind, reply.teammateId))
        continue;
      sessions.set(kind, (sessions.get(kind) ?? new Set<string>()).add(session));
    }
    for (const [kind, ids] of sessions)
      await this.registry.get(kind).plansFirst?.([...ids]);
  }

  public decideAsync(params: ApprovalDecideParams): Promise<Approval> {
    return this.permissions.decideAsync(params);
  }

  public stopSessionAsync(session: string, reason: string): Promise<void> {
    return this.toolCalls.stopSessionAsync(session, reason);
  }

  public listMcpToolsAsync(params: McpToolListParams, signal: AbortSignal = new AbortController().signal): Promise<readonly JsonObject[]> {
    return this.toolCalls.listMcpToolsAsync(params, signal);
  }

  public callMcpToolAsync(params: McpToolCallParams, signal: AbortSignal = new AbortController().signal): Promise<JsonObject> {
    return this.toolCalls.callMcpToolAsync(params, signal);
  }

  public acceptsSessionTokenAsync(token: string): Promise<boolean> {
    return this.toolCalls.acceptsSessionTokenAsync(token);
  }

  public senderTokenOf(session: string): string | null {
    return this.toolCalls.senderTokenOf(session);
  }

  public async waitForIdle(): Promise<void> {
    await Promise.all([...this.completions.values()]);
    while (this.background.size > 0)
      await Promise.all([...this.background]);
  }

  public askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer> {
    return this.permissions.askPermissionAsync(session, module, ask, signal);
  }

  public async startSubAgentAsync(params: SubAgentStartParams): Promise<SubAgent> {
    const turn = this.state.turns.get(params.senderToken);
    const parent = Object.isUndefined(turn) ? undefined : this.state.replyRuns.get(turn);
    if (Object.isUndefined(turn) || Object.isUndefined(parent) || turn.run.signal.aborted)
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    const isExplorer = params.agent === Resources.explorerAgent;
    if (!isExplorer && params.agent !== Resources.helperAgent)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSubAgentUnavailable(params.agent), [params.agent]);
    const started = await this.startedRequestedAsync(turn.message);
    const adapter = this.registry.get(started.kind);
    const requested = isExplorer ? ConversationEngine.explorerRequested(started, adapter) : started;
    const folder = await this.requireWorkFolderAsync(await this.requireConversationAsync(turn.message.conversationId), true);
    if (this.state.replyRuns.get(turn) !== parent || turn.run.signal.aborted)
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    if (this.subAgentsOf(turn, []).filter(t => t.current.isRunning).length >= Resources.subAgentLimit)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSubAgentLimitReached(Resources.subAgentLimit), [turn.message.id]);
    const root = ProjectActivity.rootOf(folder.path);
    const request = async (): Promise<TurnRequest> => {
      const shared = isExplorer ? SharedMcpSelection.none : await this.sharedOfAsync(turn.provider, turn.message.teammateId, folder.path);
      return new TurnRequest(turn.provider, folder.path, params.brief, requested, null, [], Resources.formatSubAgentInstructions(turn.instructions),
        params.brief, {}, false, null, shared.servers, null, undefined, shared.values);
    };
    const child = new SubAgentRun(Guid.createVersion7().toString(), isExplorer ? Resources.explorerType : Resources.helperType, params.description,
      requested.model, turn.message.id, parent, isExplorer);
    this.subAgents.set(child.id, child);
    turn.run.signal.addEventListener(Resources.abortEvent, () => {
      if (turn.run.isCancelled)
        void this.stopSubAgentAsync(child);
    }, { once: true });
    await child.beginAsync();
    const ahead = isExplorer ? Promise.resolve() : this.writers.get(root) ?? Promise.resolve();
    const run = (): Promise<void> => child.executeAsync(adapter, request);
    const done = ahead.then(run, run);
    if (!isExplorer)
      this.writers.set(root, done);
    const settle = (): void => {
      this.keptSessions.noteSession(turn.message.conversationId, requested.kind, child.nativeSessionId);
      if (this.writers.get(root) === done)
        this.writers.delete(root);
      if (!this.state.replyRuns.has(turn)) {
        this.subAgents.delete(child.id);
        void this.wakeForSubAgentAsync(turn, child);
      }
    };
    void done.catch((error: unknown) => this.log?.write(Resources.formatSubAgentNotSaved(child.id, Resources.formatFailureKind(error)))).then(settle);
    return child.current;
  }

  public async waitSubAgents(params: SubAgentWaitParams): Promise<SubAgentWaitResult> {
    const chosen = this.subAgentsOf(this.requireTurn(params.senderToken), params.subAgentIds);
    const running = chosen.filter(t => t.current.isRunning);
    if (running.length > 0) {
      const timeout = Promise.withResolvers<void>();
      const timer = setTimeout(timeout.resolve, params.seconds * Resources.millisecondsPerSecond);
      await Promise.race([timeout.promise, ...running.map(t => t.ended)]);
      clearTimeout(timer);
    }
    return new SubAgentWaitResult(chosen.filter(t => !t.current.isRunning).map(t => t.current), chosen.filter(t => t.current.isRunning).map(t => t.id));
  }

  public async stopSubAgent(params: SubAgentStopParams): Promise<SubAgent> {
    const child = this.subAgentOf(this.requireTurn(params.senderToken), params.subAgentId);
    await child.stopAsync();
    return child.current;
  }

  public async startCommandAsync(params: CommandStartParams): Promise<BackgroundTask> {
    const turn = this.state.turns.get(params.senderToken);
    if (Object.isUndefined(turn) || !this.state.replyRuns.has(turn) || turn.run.signal.aborted)
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    const starter = this.commandStarter;
    const tasks = this.tasks;
    if (Object.isNull(starter) || Object.isNull(tasks))
      throw new ServiceException(ErrorCode.Unavailable, Resources.commandsUnavailable, []);
    const refusal = starter.refusalOf(params.command);
    if (!Object.isNull(refusal))
      throw new ServiceException(ErrorCode.InvalidParams, refusal, []);
    const chatId = turn.message.conversationId;
    const folder = await this.requireWorkFolderAsync(await this.requireConversationAsync(chatId), true);
    if (!this.state.replyRuns.has(turn) || turn.run.signal.aborted)
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    if ([...this.commands.values(), ...this.startingCommands].filter(t => t.chatId === chatId && t.isRunning).length >= Resources.commandLimit)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatCommandLimitReached(Resources.commandLimit), [chatId]);
    const run = new CommandRun(Guid.createVersion7().toString(), turn, params.description);
    this.startingCommands.add(run);
    let task: BackgroundTask | null;
    try {
      task = await tasks.startAsync(chatId, turn.message.id, turn.provenance.requested.kind, new TaskStart(run.key, params.command, () => this.stopCommand(run)),
        turn.message.teammateId);
    }
    finally {
      this.startingCommands.delete(run);
    }
    if (Object.isNull(task))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(chatId), [chatId]);
    if (!this.state.replyRuns.has(turn) || turn.run.signal.aborted) {
      await tasks.endAsync(turn.message.id, new TaskEnd(run.key, BackgroundTaskStatus.Stopped, null));
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    }
    run.begin(task.id, starter.start(params.command, folder.path, text => {
      run.write(text);
      tasks.write(turn.message.id, run.key, text);
    }));
    if (run.wasStopped)
      this.noteStopped(run);
    this.commands.set(run.key, run);
    turn.run.signal.addEventListener(Resources.abortEvent, () => {
      if (turn.run.isCancelled)
        void this.stopCommand(run);
    }, { once: true });
    void run.ended.then(exit => {
      const ended = !this.state.replyRuns.has(turn);
      if (ended)
        this.commands.delete(run.key);
      return this.endCommandAsync(tasks, run, exit, ended);
    }).catch((error: unknown) => this.log?.write(Resources.formatBackgroundTaskNotSaved(run.id, Resources.formatFailureKind(error))));
    return task;
  }

  private async endCommandAsync(tasks: IBackgroundTasksService, run: CommandRun, exit: CommandExit, wakes: boolean): Promise<void> {
    await tasks.endAsync(run.turn.message.id, new TaskEnd(run.key, run.status, run.exitCode));
    if (wakes)
      await this.wakeForCommandAsync(run, exit);
  }

  public async shutdown(): Promise<void> {
    this.state.closing = true;
    this.context.projectActivity.releaseWaiting();
    for (const run of this.state.runs.values())
      run.cancel();
    await this.titles.shutdown();
    await Promise.all([...this.subAgents.values()].map(t => this.stopSubAgentAsync(t)));
    await Promise.all([...this.commands.values()].map(t => t.stopAsync()));
    await this.waitForIdle();
  }

  private static openingOf(conversation: Conversation, sequence: number, text: string, attachments: readonly MessageAttachment[]): string | null {
    const opening = [text, ...attachments.map(t => t.name)].join(Resources.lineSeparator);
    return sequence === 0 && conversation.title === Resources.defaultConversationTitle && !conversation.titleChosen && !String.isNullOrWhitespace(opening) ? opening : null;
  }

  private static titleModelOf(item: ReplyWork | undefined): TitleModel | null {
    const provenance = item?.message.provenance ?? null;
    return Object.isUndefined(item) || Object.isNull(provenance) ? null : new TitleModel(item.provider, provenance.requested.kind, provenance.requested.model);
  }

  private async planSendAsync(params: MessageSendParams, prepare: boolean, allowedFor: ReplyWork | null = null, outside: MessageSender | null = null,
    queues: boolean = false): Promise<SendPlan> {
    const conversation = await this.requireConversationAsync(params.conversationId);
    const folder = await this.requireWorkFolderAsync(conversation, prepare);
    const origin = Object.isNull(params.senderToken) ? null : allowedFor ?? this.requireTurn(params.senderToken);
    const sender = Object.isNull(origin) ? null : await this.senderOfAsync(origin);
    const group = this.findGroup(conversation.id);
    const busy = !Object.isNull(await this.messages.findOpenReplyAsync(conversation.id)) || !Object.isNull(group);
    if (busy && (Object.isNull(group) || (Object.isNull(sender) && !queues)))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id), [conversation.id]);

    const mentions: Teammate[] = [];
    for (const id of new Set(params.mentionedTeammateIds))
      mentions.push(await this.requireTeammateAsync(id));
    const available = (await this.teammates.listAsync()).map(t => new TeammateMention(t.id, t.name));
    const matches = !Object.isNull(outside) ? mentions.length === 0
      : MentionCheck.matches(params.text, mentions.map(t => t.id), available, !Object.isNull(sender));
    if (!matches)
      throw new ServiceException(ErrorCode.Conflict, Resources.mentionsChanged, []);
    const called = Object.isNull(sender) ? mentions : mentions.filter(t => t.id !== sender.teammateId);
    const responder = called.length > 0 || Object.isNull(params.responderTeammateId) ? null : await this.requireTeammateAsync(params.responderTeammateId);
    const answersItself = !Object.isNull(responder) && responder.id === sender?.teammateId;
    if (called.length === 0 && !Object.isNull(responder) && !answersItself
      && Object.isNull(await this.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, responder.id))))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatMemberNotFound(conversation.id, responder.id), [conversation.id, responder.id]);
    const byChoice = called.length === 0 && !Object.isNull(sender) && Object.isNull(responder) && Object.isNull(params.requested);
    const usable = byChoice ? await this.usableResponderOfAsync(conversation, sender) : null;
    const choice = usable?.[0] ?? null;
    const participants = called.length > 0 ? called : answersItself ? [] : !byChoice ? [responder] : Object.isNull(usable) ? [] : [usable[1]];
    const requested = choice?.requested ?? params.requested;
    const providerId = Object.isNull(choice) ? params.providerId : choice.providerId;
    if (Object.isNull(sender) && Object.isNull(providerId) && !Object.isNull(requested) && participants.includes(null))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProviderRequired(requested.kind), [requested.kind]);
    if (Object.isNull(sender))
      await this.refuseDisabledAsync(participants, providerId);
    const hop = Object.isNull(origin) ? 0 : origin.hop + 1;
    const limit = Object.isNull(sender) ? Number.POSITIVE_INFINITY : this.readHopLimit();
    if (!Object.isNull(sender) && !Object.isNull(requested) && hop <= limit && participants.includes(null))
      await this.resolveProviderAsync(requested, providerId);
    return new SendPlan(conversation, folder, origin, sender, group, mentions, called, participants, requested, providerId, hop, limit);
  }

  private async askOfAsync(plan: SendPlan): Promise<SendAsk> {
    const starts: string[] = [];
    if (plan.stopped)
      starts.push(Resources.sendStopsAtLimit);
    else
      for (const participant of plan.participants)
        if (Object.isNull(participant) || this.canReply(await this.providers.findAsync(participant.providerId)))
          starts.push(Object.isNull(participant) ? Resources.sendDefaultTeammate : participant.name);
    const title = plan.conversation.title;
    return new SendAsk(plan.conversation.id, title, Resources.formatSendMessageRequest(title),
      starts.length === 0 ? Resources.sendStartsNoOne : starts.join(Resources.sendStartsSeparator));
  }

  private async usableResponderOfAsync(conversation: Conversation, sender: MessageSender): Promise<readonly [ConversationResponder, Teammate | null] | null> {
    const chosen = conversation.responder;
    if (Object.isNull(chosen))
      return null;
    if (!Object.isNull(chosen.teammateId)) {
      const teammate = await this.teammates.findAsync(chosen.teammateId);
      return chosen.teammateId === sender.teammateId || Object.isNull(teammate)
        || Object.isNull(await this.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, chosen.teammateId))) ? null : [chosen, teammate];
    }
    const kind = chosen.requested!.kind;
    const provider = Object.isNull(chosen.providerId) ? null : await this.providers.findAsync(chosen.providerId);
    return (Object.isNull(sender.teammateId) && sender.conversationId === conversation.id) || !this.registry.has(kind)
      || provider?.kind !== kind || provider?.enabled !== true ? null : [chosen, null];
  }

  private async requireTeammateAsync(id: string, transaction?: SqlTransaction): Promise<Teammate> {
    const teammate = await this.teammates.findAsync(id, transaction);
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(id), [id]);
    return teammate;
  }

  private async prepareReplyAsync(teammate: Teammate | null, settings: RequestedSettings | null, providerId: string | null, trigger: Message, sequence: number,
    createdAt: string, hop: number, chain: string | null = null, continued: Message | null = null, transaction?: SqlTransaction): Promise<ReplyWork | null> {
    const provider = Object.isNull(teammate) ? await this.resolveProviderAsync(settings!, providerId, transaction)
      : await this.providers.findAsync(teammate.providerId, transaction);
    if (!Object.isNull(teammate) && !this.canReply(provider))
      return null;
    const chosen = Object.isNull(teammate) ? settings!
      : await this.teammateSettingsOfAsync(teammate, provider!.kind, trigger.conversationId, await this.answersOutsideAsync(trigger, transaction), transaction);
    const requested = chosen.withPlanFirst(await this.plansFirstAsync(trigger.conversationId, chosen.kind, teammate?.id ?? null, transaction));
    this.registry.get(requested.kind);
    const provenance = new Provenance(provider?.id ?? null, requested, new ObservedSettings(null, null, null, null), null, false);
    const reply = new Message(Guid.createVersion7().toString(), trigger.conversationId, sequence, MessageAuthor.Provider, trigger.id,
      MessageStatus.Pending, [], provenance, createdAt, null, null, [], teammate?.id ?? null, teammate?.name ?? null);
    return new ReplyWork(reply, provider, teammate?.role ?? null, trigger, hop, null, chain, continued);
  }

  private canReply(provider: Provider | null): boolean {
    return !Object.isNull(provider) && provider.enabled && provider.authStatus !== AuthStatus.LoggedOut && this.registry.has(provider.kind);
  }

  private async teammateSettingsOfAsync(teammate: Teammate, kind: string, conversationId: string, outside: boolean,
    transaction?: SqlTransaction): Promise<RequestedSettings> {
    const own = (await this.conversations.findMemberAsync(new ConversationMemberParams(conversationId, teammate.id), transaction))?.settings ?? null;
    const mode = await this.chatModeOfAsync(teammate, kind, conversationId, outside, transaction);
    if (Object.isNull(own))
      return new RequestedSettings(kind, teammate.model, teammate.effort, teammate.speed, mode, false, teammate.contextWindow);
    return new RequestedSettings(kind, own.model, own.effort, own.speed, mode, false, own.model === teammate.model ? teammate.contextWindow : null);
  }

  private async chatModeOfAsync(teammate: Teammate, kind: string, conversationId: string, outside: boolean, transaction?: SqlTransaction): Promise<string | null> {
    const chosen = (await this.conversations.findMemberAsync(new ConversationMemberParams(conversationId, teammate.id), transaction))?.mode ?? null;
    const adapter = this.registry.get(kind);
    const own = await this.outside.isOutsideAsync(conversationId, transaction);
    const mode = adapter.modes.some(t => t.id === chosen) ? chosen : own ? adapter.defaultMode : teammate.mode;
    return outside && !own && adapter.modes.some(t => t.id === mode && t.unrestricted) ? adapter.defaultMode : mode;
  }

  private async capEndsTasksAsync(teammate: Teammate, chatId: string): Promise<boolean> {
    if ((await this.runningTasksAsync(chatId)).length === 0)
      return false;
    for (const provider of await this.providers.listAsync())
      if (provider.id === teammate.providerId && this.registry.has(provider.kind)
        && await this.chatModeOfAsync(teammate, provider.kind, chatId, true) !== await this.chatModeOfAsync(teammate, provider.kind, chatId, false))
        return true;
    return false;
  }

  private async answersOutsideAsync(reply: Message, transaction?: SqlTransaction): Promise<boolean> {
    return (await this.originOfAsync(reply, transaction)).sender?.outside === true;
  }

  private async originOfAsync(message: Message, transaction?: SqlTransaction): Promise<Message> {
    const woken = message.details.map(t => t.payload).filter(ConversationEngine.isJsonObject).map(t => t[Resources.wakeSourceMessageField]);
    for (const id of [message.inReplyTo, ...woken].filter(Object.isString)) {
      const trigger = await this.messages.findAsync(id, transaction);
      if (!Object.isNull(trigger))
        return this.originOfAsync(trigger, transaction);
    }
    return message;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async startedRequestedAsync(reply: Message, transaction?: SqlTransaction): Promise<RequestedSettings> {
    const requested = reply.provenance!.requested;
    const teammate = Object.isNull(reply.teammateId) ? null : await this.teammates.findAsync(reply.teammateId, transaction);
    const planFirst = await this.plansFirstAsync(reply.conversationId, requested.kind, reply.teammateId, transaction);
    if (Object.isNull(teammate))
      return requested.withPlanFirst(planFirst);
    const mode = await this.chatModeOfAsync(teammate, requested.kind, reply.conversationId, await this.answersOutsideAsync(reply, transaction), transaction);
    return (mode === requested.mode ? requested : new RequestedSettings(requested.kind, requested.model, requested.effort, requested.speed, mode, false,
      requested.contextWindow))
      .withPlanFirst(planFirst);
  }

  private async wakeRequestedAsync(source: Message, requested: RequestedSettings, transaction?: SqlTransaction): Promise<RequestedSettings> {
    const mode = Object.isNull(source.teammateId) ? await this.responderModeAsync(source.conversationId, requested, transaction)
      : (await this.startedRequestedAsync(source, transaction)).mode;
    return mode === requested.mode ? requested
      : new RequestedSettings(requested.kind, requested.model, requested.effort, requested.speed, mode, requested.planFirst, requested.contextWindow);
  }

  private async responderModeAsync(conversationId: string, requested: RequestedSettings, transaction?: SqlTransaction): Promise<string | null> {
    const chosen = (await this.conversations.findAsync(conversationId, transaction))?.responder?.requested ?? null;
    return Object.isNull(chosen) || chosen.kind !== requested.kind ? requested.mode : chosen.mode;
  }

  private async plansFirstAsync(conversationId: string, kind: string, teammateId: string | null, transaction?: SqlTransaction): Promise<boolean> {
    return (await this.conversations.findAsync(conversationId, transaction))?.plansFirst(teammateId) === true
      && !String.isNullOrWhitespace(this.registry.get(kind).planMode ?? null);
  }

  private async toolModeOfAsync(open: { readonly reply: Message; readonly mode: ProviderMode | null }): Promise<ProviderMode | null> {
    const requested = await this.startedRequestedAsync(open.reply);
    const chosen = Object.isNull(open.reply.teammateId) ? this.chosenModes.get(open.reply.conversationId)?.get(requested.kind) : undefined;
    const current = chosen ?? this.modeIn(requested);
    const started = ReplyPlan.ofDetails((await this.requireMessageAsync(open.reply.id)).details)?.approved === true ? current : open.mode;
    if (started?.readOnly === true || current?.readOnly === true)
      return started?.readOnly === true ? started : current;
    return started?.unrestricted === true ? current : started;
  }

  private modeIn(requested: RequestedSettings): ProviderMode | null {
    const adapter = this.registry.get(requested.kind);
    const id = requested.planFirst ? adapter.planMode! : requested.mode;
    return adapter.modes.find(t => t.id === id) ?? adapter.modes.find(t => t.id === adapter.defaultMode) ?? null;
  }

  private async cancelAfterTurnAsync(message: Message): Promise<Message> {
    const run = this.state.runs.get(message.id);
    if (Object.isUndefined(run) || !run.isOpen)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(message.id), [message.id]);
    await run.cancelAfterTurn();
    return this.requireMessageAsync(message.id);
  }

  private async stopAsync(item: ReplyWork): Promise<void> {
    item.run.cancel();
    item.wake?.cancel();
    if (item.isStarted || item.isEnded)
      return;
    const stopping = this.stopping.get(item) ?? this.cancelPendingAsync(item);
    this.stopping.set(item, stopping);
    await stopping;
  }

  private async interruptUnstartedAsync(reply: Message): Promise<void> {
    const now = new Date().toISOString();
    const interrupted = reply.withDetail(new MessageDetail(reply.details.length, DetailKind.Note, Resources.replyInterruptedByStop, null, now))
      .withStatus(MessageStatus.Interrupted, now);
    await this.messages.updateAsync(interrupted);
    this.events.publish(new Event(EventName.MessageCreated, interrupted.toJson()));
  }

  private async cancelPendingAsync(item: ReplyWork): Promise<void> {
    try {
      const cancelled = item.message.withStatus(MessageStatus.Cancelled, new Date().toISOString());
      await this.messages.updateAsync(cancelled);
      this.events.publish(new Event(EventName.MessageUpdated, cancelled.toJson()));
      item.end();
    }
    finally {
      this.stopping.delete(item);
    }
  }

  private async handOffAsync(item: ReplyWork, work: ReplyWork[]): Promise<void> {
    const handed = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const found = await this.messages.findAsync(item.message.id, transaction);
      if (Object.isNull(found))
        return null;
      const finished = item.run.isStoppedAfterTurn && found.status === MessageStatus.Completed
        ? found.withStatus(MessageStatus.Cancelled, new Date().toISOString()) : found;
      const handed = await this.handOffOfAsync(item, work, finished, transaction);
      if (!Object.isNull(handed) || finished === found)
        return handed;
      await this.messages.updateAsync(finished, transaction);
      return { stored: finished, pending: [], waiting: [], joined: false };
    });
    if (Object.isNull(handed))
      return;
    const { stored, pending, waiting, joined } = handed;
    for (const open of waiting)
      open.join(stored, item.hop + 1);
    for (const next of pending) {
      work.push(next);
      this.state.runs.set(next.message.id, next.run);
      if (item.run.isCancelled)
        next.run.cancel();
    }
    this.events.publish(new Event(EventName.MessageUpdated, stored.toJson()));
    for (const next of pending)
      this.events.publish(new Event(EventName.MessageCreated, next.message.toJson()));
    if (joined)
      this.events.publish(new Event(EventName.StateInvalidated, null));
  }

  private async handOffOfAsync(item: ReplyWork, work: ReplyWork[], finished: Message, transaction: SqlTransaction)
    : Promise<{ stored: Message; pending: ReplyWork[]; waiting: ReplyWork[]; joined: boolean } | null> {
    if (Object.isNull(finished.teammateId))
      return null;
    const halted = item.run.isCancelled;
    if (finished.status !== MessageStatus.Completed && !halted)
      return null;
    const text = finished.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator);
    const available = (await this.teammates.listAsync(transaction)).map(t => new TeammateMention(t.id, t.name));
    const mentions = MentionResolver.resolveTeammateText(text, available);
    if (mentions.length === 0)
      return null;
    const skipped = new Set([finished.teammateId, item.trigger.sender?.teammateId, ...item.sentTo]);
    const others: Teammate[] = [];
    for (const addressed of MentionResolver.resolveAddressed(text, available).filter(t => !skipped.has(t.teammateId)))
      others.push((await this.teammates.findAsync(addressed.teammateId, transaction))!);
    const limit = this.readHopLimit();
    const stopped = others.length > 0 && (halted || item.hop >= limit);
    const now = new Date().toISOString();
    const note = halted ? Resources.formatHandOffStopped(others.map(t => t.name)) : Resources.formatChainStopped(limit);
    const stored = stopped
      ? finished.withMentions(mentions).withDetail(new MessageDetail(finished.details.length, DetailKind.Note, note, { source: Resources.handOffSource }, now))
      : finished.withMentions(mentions);
    const sequence = await this.messages.nextSequenceAsync(finished.conversationId, transaction);
    const pending: ReplyWork[] = [];
    const waiting: ReplyWork[] = [];
    for (const teammate of stopped ? [] : others) {
      const open = work.find(t => t.message.teammateId === teammate.id && !t.isEnded && Object.isNull(t.wake));
      if (!Object.isUndefined(open)) {
        waiting.push(open);
        continue;
      }
      const next = await this.prepareReplyAsync(teammate, null, null, stored, sequence + pending.length, now, item.hop + 1, item.chain, null, transaction);
      if (!Object.isNull(next))
        pending.push(next);
    }
    let joined = false;
    for (const teammate of stopped ? [] : others) {
      const member = new ConversationMemberParams(finished.conversationId, teammate.id);
      if (Object.isNull(await this.conversations.findMemberAsync(member, transaction))) {
        await this.conversations.addMemberAsync(member, transaction);
        joined = true;
      }
    }
    await this.messages.updateAsync(stored, transaction);
    for (const next of pending)
      await this.messages.insertAsync(next.message, transaction);
    return { stored, pending, waiting, joined };
  }

  private async isIdleAsync(chatId: string, transaction?: SqlTransaction, held: boolean = false): Promise<boolean> {
    return !this.permissions.hasAnswers(chatId) && Object.isNull(await this.messages.findOpenReplyAsync(chatId, transaction)) && Object.isNull(this.findGroup(chatId))
      && (held || !this.sendingChats.has(chatId));
  }

  private beginSending(chatId: string): boolean {
    if (this.sendingChats.has(chatId)) {
      this.refusedSends.add(chatId);
      return false;
    }
    this.sendingChats.add(chatId);
    return true;
  }

  private endSending(chatId: string): void {
    this.sendingChats.delete(chatId);
    if (this.refusedSends.delete(chatId))
      this.track(chatId, this.resumeSendingAsync(chatId));
  }

  private track(chatId: string, work: Promise<void>): void {
    const tracked = work.catch((error: unknown) => {
      this.log?.write(Resources.formatChatSendingStopped(chatId, Resources.formatFailureKind(error)));
    }).finally(() => this.background.delete(tracked));
    this.background.add(tracked);
  }

  private async resumeSendingAsync(chatId: string): Promise<void> {
    await this.sendQueuedAsync(chatId);
    await this.settleSafelyAsync(chatId, () => this.sendWakesAsync(chatId));
  }

  private async sendQueuedAsync(chatId: string): Promise<void> {
    await this.permissions.sendAnswersAsync(chatId).catch((error: unknown) => {
      this.log?.write(Resources.formatQuestionReplyNotSent(chatId, Resources.formatFailureKind(error)));
    });
    await this.sendWaitingSafelyAsync(chatId);
  }

  private async sendWaitingSafelyAsync(chatId: string): Promise<void> {
    await this.waitingSends.sendWaitingAsync(chatId).catch((error: unknown) => {
      this.log?.write(Resources.formatWaitingMessageNotSent(chatId, Resources.formatFailureKind(error)));
    });
  }

  private findGroup(conversationId: string): ReplyWork[] | null {
    return [...this.state.groups.values()].find(t => t[0]?.message.conversationId === conversationId) ?? null;
  }

  private requireTurn(token: string): ReplyWork {
    const turn = this.state.turns.get(token);
    if (Object.isUndefined(turn))
      throw new ServiceException(ErrorCode.Unauthorized, Resources.senderTurnEnded, []);
    return turn;
  }

  private async requireConversationAsync(id: string, transaction?: SqlTransaction): Promise<Conversation> {
    const conversation = await this.conversations.findAsync(id, transaction);
    if (Object.isNull(conversation))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(id), [id]);
    return conversation;
  }

  private async requireUnmovedAsync(conversation: Conversation, transaction: SqlTransaction): Promise<void> {
    if ((await this.requireConversationAsync(conversation.id, transaction)).projectId !== conversation.projectId)
      throw new ServiceException(ErrorCode.Conflict, Resources.chatMovedWhileSent, [conversation.id]);
  }

  private subAgentOf(turn: ReplyWork, id: string): SubAgentRun {
    const child = this.subAgentsOf(turn, []).find(t => t.id === id);
    if (Object.isUndefined(child))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatSubAgentNotFound(id), [id]);
    return child;
  }

  private subAgentsOf(turn: ReplyWork, ids: readonly string[]): SubAgentRun[] {
    const own = [...this.subAgents.values()].filter(t => t.messageId === turn.message.id);
    const missing = ids.find(t => !own.some(u => u.id === t));
    if (!Object.isUndefined(missing))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatSubAgentNotFound(missing), [missing]);
    return ids.length === 0 ? own : own.filter(t => ids.includes(t.id));
  }

  private async stopSubAgentAsync(run: SubAgentRun): Promise<void> {
    try {
      await run.stopAsync();
    }
    catch (error) {
      this.log?.write(Resources.formatSubAgentNotStopped(run.id, Resources.formatFailureKind(error)));
    }
  }

  private stopCommand(run: CommandRun): Promise<void> {
    if (run.isRunning && !run.wasStopped && !String.isNullOrEmpty(run.id))
      this.noteStopped(run);
    return run.stopAsync();
  }

  private noteStopped(run: CommandRun): void {
    this.stoppedCommands.add(run.chatId, run.turn.message.teammateId, Resources.formatStoppedCommand(run.description, run.id));
  }

  private async forgetChildrenAsync(turn: ReplyWork): Promise<void> {
    this.state.replyRuns.delete(turn);
    const children = this.subAgentsOf(turn, []);
    const commands = [...this.commands.values()].filter(t => t.turn === turn);
    await this.forgetSubAgentsAsync(turn, children);
    await this.forgetCommandsAsync(turn, commands);
  }

  private async forgetCommandsAsync(turn: ReplyWork, commands: readonly CommandRun[]): Promise<void> {
    for (const run of commands) {
      if (!run.isRunning)
        this.commands.delete(run.key);
      if (turn.run.isCancelled || this.state.closing)
        continue;
      await this.wakes.addAsync(new ChatWake(Guid.createVersion7().toString(), ChatWakeKind.Command, turn.message.conversationId, turn.message.id,
        turn.message.conversationId, [run.id], ChatWakeState.Waiting, null, null, new Date().toISOString(),
        ConversationEngine.taskViewOf(ProtocolResources.wakeCommandTask, run.description, null, null)));
      const exit = run.endedWith;
      if (!Object.isNull(exit))
        await this.wakeForCommandAsync(run, exit);
    }
  }

  private async forgetSubAgentsAsync(turn: ReplyWork, children: readonly SubAgentRun[]): Promise<void> {
    const running = children.filter(t => t.current.isRunning);
    for (const child of children.filter(t => !running.includes(t)))
      this.subAgents.delete(child.id);
    for (const child of running) {
      if (turn.run.isCancelled || this.state.closing)
        continue;
      await this.wakes.addAsync(new ChatWake(Guid.createVersion7().toString(), ChatWakeKind.SubAgent, turn.message.conversationId, turn.message.id,
        turn.message.conversationId, [child.id], ChatWakeState.Waiting, null, null, new Date().toISOString(),
        ConversationEngine.taskViewOf(ProtocolResources.wakeSubAgentTask, child.current.description, null, null)));
      if (!child.current.isRunning)
        await this.wakeForSubAgentAsync(turn, child);
    }
  }

  private async senderOfAsync(turn: ReplyWork): Promise<MessageSender> {
    const reply = turn.message;
    if (Object.isNull(reply.teammateId)) {
      const provenance = turn.provenance;
      const kind = this.registry.get(provenance.requested.kind).descriptor.displayName;
      const provider = (await this.providers.listAsync()).find(t => t.id === provenance.providerId);
      const named = Object.isUndefined(provider) ? kind : Resources.formatProviderSender(kind, provider.label);
      return new MessageSender(reply.conversationId, null, MessageSender.allowsDefaultName(named) ? named : kind);
    }
    const teammate = await this.requireTeammateAsync(reply.teammateId);
    return new MessageSender(reply.conversationId, teammate.id, teammate.name);
  }

  private async executeRepliesAsync(work: ReplyWork[], folder: WorkFolder): Promise<void> {
    const context = new ParticipantContext(this.messages, this.teammates, this.conversations);
    let checked: Promise<FolderState> | null = null;
    try {
      for (let index = 0; index < work.length; index++) {
        const item = work[index]!;
        const reply = item.message;
        if (!item.run.isCancelled && !item.isEnded && Object.isNull(item.wake)) {
          const conversation = await this.conversations.findAsync(reply.conversationId);
          checked ??= this.projects.checkFolderAsync(folder.path, conversation?.projectId ?? null);
          await this.failIfUnableAsync(item, folder, await checked, !Object.isNullOrUndefined(conversation?.attachedFolder));
        }
        if (item.run.isCancelled)
          await this.stopAsync(item);
        if (item.isEnded) {
          this.releaseWake(item);
          continue;
        }
        this.replyHops.set(reply.conversationId, (this.replyHops.get(reply.conversationId) ?? new Map<string, number>()).set(reply.id, item.hop));
        item.start();
        if (!Object.isNull(item.wake)) {
          await (this.followed.get(item) ?? this.followWithToolsAsync(item, item.wake, folder));
          this.followed.delete(item);
          this.releaseWake(item);
          await this.handOffAsync(item, work);
          item.end();
          continue;
        }
        if (await this.handOffUsageAsync(item, work, index))
          continue;
        const conversation = (await this.conversations.findAsync(reply.conversationId))!;
        const member = Object.isNull(reply.teammateId) ? null
          : await this.conversations.findMemberAsync(new ConversationMemberParams(reply.conversationId, reply.teammateId));
        const { sustained, requested, handover, posted, kept } = await this.movedOfAsync(item, member, context);
        const fork = Object.isNull(reply.teammateId) ? conversation.forkedSession : null;
        const useFork = !Object.isNull(fork) && fork.matches(requested.kind, item.provider?.id ?? null);
        const resume = Object.isNull(reply.teammateId)
          ? (conversation.sessionReset ? null : useFork ? fork.nativeSessionId
            : await this.messages.findResumableSessionAsync(reply.conversationId, requested.kind, item.provider?.id ?? null))
          : !Object.isNull(kept) ? kept : Object.isNull(item.continued) ? await this.sessionOnAsync(member, item.provider) : null;
        const freshPrompt = Object.isNull(item.continued) ? await context.createAsync(reply, item.trigger, null, false, item.handOffs)
          : await context.createAsync(item.continued, item.trigger, null, false, item.handOffs) + Resources.transcriptSeparator
            + Resources.formatSustainContinued(ConversationEngine.writtenOf(item.continued));
        const prompt = Object.isNull(resume) ? handover?.text ?? freshPrompt
          : Object.isNull(item.continued) ? await context.createAsync(reply, item.trigger, resume, useFork, item.handOffs)
            : Resources.formatSustainContinued(ConversationEngine.writtenOf(item.continued));
        const command = await this.readCommand();
        const token = randomBytes(Resources.senderTokenBytes).toString("base64url");
        const environment = { ...command?.environment, ...SenderEnvironment.of(token) };
        const compacts = ParticipantContext.asksToCompact(item.trigger);
        const slashCommand = ParticipantContext.commandOf(item.trigger);
        const run = this.createRun(item, folder, requested, posted ?? item.message);
        this.state.turns.set(token, item);
        this.state.replyRuns.set(item, run);
        const tools = await this.toolCalls.openToolsAsync(reply, run, token, folder, requested);
        try {
          const shared = await this.sharedOfAsync(item.provider, reply.teammateId, folder.path);
          const descriptor = this.registry.get(requested.kind).descriptor;
          const refusal = compacts ? descriptor.reasonAgainst(ProviderAbility.Compact) : null;
          if (!Object.isNull(refusal))
            await run.answerAsync(Resources.formatCompactRefused(descriptor.displayName, refusal));
          else if (compacts && Object.isNull(resume))
            await run.answerAsync(Resources.nothingToCompact);
          else {
            const adapter = this.registry.get(requested.kind);
            const hasTools = !Object.isNull(this.tools) && adapter.takesTeamRunTools === true;
            const instructionsOf = (tools: boolean): string => Resources.formatTeammateInstructions(item.instructions, command?.words ?? null, tools,
              adapter.backgroundSubAgentsNote ?? null);
            const stopped = compacts || !Object.isNull(slashCommand) ? [] : this.stoppedCommands.of(reply.conversationId, reply.teammateId);
            const awaited = !compacts && await this.isAwaitedAsync(reply);
            const told = (text: string): string => {
              const asked = awaited ? `${text}${Resources.transcriptSeparator}${Resources.awaitedReplyNote}` : text;
              return stopped.length === 0 ? asked : `${Resources.formatStoppedCommands(stopped)}${Resources.transcriptSeparator}${asked}`;
            };
            await run.executeAsync(adapter, new TurnRequest(item.provider, folder.path, told(prompt), requested, resume,
              item.trigger.attachments, instructionsOf(hasTools), told(freshPrompt), environment, compacts, tools, shared.servers,
              useFork ? fork.resumeAt : null, t => this.adoptSender(t, token), shared.values, hasTools ? instructionsOf(false) : null, false, slashCommand,
              this.readIdleCompaction()), shared.notes, sustained?.note ?? null, Object.isNull(resume) ? this.handoverNoteOf(told(prompt), handover, item.provider) : null,
              !Object.isNull(posted));
            if ((await this.messages.findAsync(reply.id))?.status === MessageStatus.Completed)
              this.stoppedCommands.told(reply.conversationId, reply.teammateId, stopped);
          }
        }
        finally {
          this.state.turns.delete(token);
          this.releaseAdopted(item);
          await this.noteLimitAsync(item.provider, run);
          this.keptSessions.noteSession(reply.conversationId, requested.kind, (await this.messages.findAsync(reply.id))?.provenance?.nativeSessionId);
          await this.forgetChildrenAsync(item);
          this.toolCalls.closeTools(tools);
        }
        if (Object.isNull(reply.teammateId) && !Object.isNullOrUndefined((await this.messages.findAsync(reply.id))?.provenance?.nativeSessionId)) {
          if (conversation.sessionReset)
            await this.conversations.setSessionResetAsync(conversation.id, false);
          if (useFork)
            await this.conversations.setForkedSessionAsync(conversation.id, null);
        }
        const continuation = await this.continueAfterLimitAsync(item, run);
        if (!Object.isNull(continuation))
          work.splice(index + 1, 0, continuation);
        await this.handOffAsync(item, work);
        item.end();
      }
    }
    catch (error) {
      await this.failPendingRepliesAsync(work, error);
      throw error;
    }
    finally {
      this.closeGroup(work);
    }
  }

  private async sustainedAsync(item: ReplyWork, carry: SessionCarry | null): Promise<{ readonly requested: RequestedSettings; readonly note: string | null } | null> {
    const reply = item.message;
    const teammate = Object.isNull(reply.teammateId) ? null : await this.teammates.findAsync(reply.teammateId);
    if (Object.isNull(teammate) || !teammate.sustain)
      return null;
    const prepared = item.provenance.requested;
    const own = new TeammateFallback(teammate.providerId, prepared.model, prepared.effort);
    const entry = await this.sustain.chooseAsync(teammate, own, await this.attempts.triedAsync(item.chain, teammate.id));
    const provider = await this.providers.findAsync(entry.providerId);
    const member = await this.conversations.findMemberAsync(new ConversationMemberParams(reply.conversationId, teammate.id));
    const from = Object.isNull(member) || Object.isNull(member.nativeSessionId) ? null : member.sessionProviderId ?? teammate.providerId;
    if (!Object.isNull(provider))
      item.moveTo(provider);
    if (Object.isNull(provider) || (entry === own && (Object.isNull(from) || from === own.providerId)))
      return null;
    if (entry === own) {
      const started = await this.startedRequestedAsync(reply);
      return { requested: started, note: await this.sustain.isOutAsync(teammate) ? null
        : Resources.formatSustainReturned(this.kindNameOf(provider), provider.label, started.model) };
    }
    const mode = await this.chatModeOfAsync(teammate, provider.kind, reply.conversationId, await this.answersOutsideAsync(reply));
    const requested = new RequestedSettings(provider.kind, entry.model, entry.effort, null, mode, false, null)
      .withPlanFirst(await this.plansFirstAsync(reply.conversationId, provider.kind, teammate.id));
    const left = await this.providers.findAsync(from ?? own.providerId);
    const note = from === entry.providerId || Object.isNull(left) ? null
      : ConversationEngine.movedNoteOf(carry, this.kindNameOf(provider), provider.label, entry.model, left.label);
    return { requested, note };
  }

  private async movedOfAsync(item: ReplyWork, member: ConversationMember | null, context: ParticipantContext): Promise<{
    readonly sustained: { readonly requested: RequestedSettings; readonly note: string | null } | null; readonly requested: RequestedSettings;
    readonly handover: HandoverPrompt | null; readonly posted: Message | null; readonly kept: string | null; }> {
    let summary: Promise<ChatSummary | null> | null = null;
    let posted: Message | null = null;
    for (;;) {
      const first = await this.sustainedAsync(item, null);
      const reply = item.message;
      const requested = first?.requested ?? await this.startedRequestedAsync(reply);
      const provider = item.provider;
      const teammateId = reply.teammateId;
      if (Object.isNull(teammateId) || Object.isNull(provider) || (Object.isNull(first) && Object.isNull(item.continued))
        || (Object.isNull(item.continued) && !Object.isNull(await this.sessionOnAsync(member, provider))))
        return { sustained: first, requested, handover: null, posted, kept: null };
      const carried = await this.carryOfAsync(member, provider);
      const sustained = Object.isNull(carried) ? first : await this.sustainedAsync(item, carried.carry);
      const note = sustained?.note ?? null;
      if (carried?.carry === SessionCarry.Carried)
        return { sustained, requested, handover: null, posted, kept: carried.sessionId };
      summary ??= await context.compactedAsync(reply, item.continued) ? this.summaryOfAsync(item, teammateId, member, provider, requested, context, async () => {
        posted = await this.postMovedAsync(reply, note);
      }) : Promise.resolve(null);
      const handover = await context.createHandoverAsync(reply, item.trigger, item.continued, item.handOffs,
        await this.messages.findWindowTokensAsync(provider.id, requested.model), item.instructions, await summary);
      if (!Object.isNull(handover) || await this.triedElseRecordNoRoomAsync(item, teammateId, provider.id))
        return { sustained, requested, handover, posted, kept: null };
    }
  }

  private async triedElseRecordNoRoomAsync(item: ReplyWork, teammateId: string, providerId: string): Promise<boolean> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const tried = (await this.attempts.triedAsync(item.chain, teammateId, transaction)).has(providerId);
      if (!tried)
        await this.attempts.recordAsync(item.message.conversationId, item.chain, teammateId, providerId, Resources.sustainAttemptNoRoom, transaction);
      return tried;
    });
  }

  private async continueAfterLimitAsync(item: ReplyWork, run: ReplyRun): Promise<ReplyWork | null> {
    const reply = item.message;
    const teammate = Object.isNull(reply.teammateId) ? null : await this.teammates.findAsync(reply.teammateId);
    const failed = await this.messages.findAsync(reply.id);
    const provider = item.provider;
    if (Object.isNull(teammate) || !teammate.sustain || Object.isNull(provider) || Object.isNull(run.limit) || item.run.isCancelled || Object.isNull(failed))
      return null;
    const tried = new Set(await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.attempts.recordAsync(reply.conversationId, item.chain, teammate.id, provider.id, Resources.sustainAttemptLimit, transaction);
      return this.attempts.triedAsync(item.chain, teammate.id, transaction);
    }));
    const prepared = item.provenance.requested;
    const own = new TeammateFallback(teammate.providerId, prepared.model, prepared.effort);
    const context = new ParticipantContext(this.messages, this.teammates, this.conversations);
    const summary = await context.compactedAsync(failed, failed)
      ? await this.compactionOfAsync(await this.conversations.findMemberAsync(new ConversationMemberParams(reply.conversationId, teammate.id))) : null;
    for (let entry = await this.sustain.nextAsync(teammate, own, tried); ; entry = await this.sustain.nextAsync(teammate, own, tried)) {
      if (Object.isNull(entry)) {
        await this.noteAllOutAsync(run, teammate, tried, await this.attempts.recordedForAsync(item.chain, teammate.id, Resources.sustainAttemptNoRoom));
        return null;
      }
      const window = await this.messages.findWindowTokensAsync(entry.providerId, entry.model);
      if (!Object.isNull(await context.createHandoverAsync(failed, item.trigger, failed, item.handOffs, window, item.instructions, summary)))
        break;
      await this.attempts.recordAsync(reply.conversationId, item.chain, teammate.id, entry.providerId, Resources.sustainAttemptNoRoom);
      tried.add(entry.providerId);
    }
    const next = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const continued = await this.prepareReplyAsync(teammate, null, null, item.trigger, await this.messages.nextSequenceAsync(reply.conversationId, transaction),
        new Date().toISOString(), item.hop, item.chain, failed, transaction);
      if (!Object.isNull(continued))
        await this.messages.insertAsync(continued.message, transaction);
      return continued;
    });
    if (Object.isNull(next))
      return null;
    this.state.runs.set(next.message.id, next.run);
    this.events.publish(new Event(EventName.MessageCreated, next.message.toJson()));
    return next;
  }

  private async noteAllOutAsync(run: ReplyRun, teammate: Teammate, tried: ReadonlySet<string>, skipped: ReadonlySet<string>): Promise<void> {
    const now = new Date(this.timer.now());
    const providers = await this.providers.listAsync();
    const listed = [teammate.providerId, ...teammate.fallbacks.map(t => t.providerId)].flatMap(id => providers.filter(t => t.id === id));
    const out: boolean[] = [];
    const resets: (string | null)[] = [];
    for (const provider of listed) {
      out.push(await this.sustain.isAccountOutAsync(provider.id));
      resets.push(await this.sustain.resetOfAsync(provider.id));
    }
    const firstOut = listed.findIndex((_, index) => out[index] === true && !Object.isNull(resets[index] ?? null));
    const entries = listed.map((t, index) => out[index] === true
      ? Resources.formatSustainEntryReset(this.stoppedAccountOf(t), resets[index] ?? null, now, index === firstOut)
      : skipped.has(t.id) ? Resources.formatSustainEntryNoRoom(this.stoppedAccountOf(t))
        : tried.has(t.id) ? Resources.formatSustainEntryTried(this.stoppedAccountOf(t)) : Resources.formatSustainEntryUnavailable(this.stoppedAccountOf(t)));
    await run.noteAllOutAsync(Resources.formatSustainAllOut(entries));
  }

  private static writtenOf(message: Message): string {
    return message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator).trim();
  }

  private async handOffUsageAsync(item: ReplyWork, work: ReplyWork[], index: number): Promise<boolean> {
    const reply = item.message;
    const teammate = Object.isNull(reply.teammateId) ? null : await this.teammates.findAsync(reply.teammateId);
    if (Object.isNull(teammate) || teammate.usageHandOffs.length === 0 || !await this.sustain.isOutAsync(teammate))
      return false;
    const order = teammate.usageHandOffs;
    const candidates: Teammate[] = [];
    for (const candidate of await this.teammates.listAsync())
      if (order.includes(candidate.id) && this.canReply(await this.providers.findAsync(candidate.providerId)) && !await this.sustain.isOutAsync(candidate))
        candidates.push(candidate);
    const target = candidates.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0] ?? null;
    const limit = this.readHopLimit();
    const to = Object.isNull(target) || item.hop >= limit ? null : target;
    const text = Object.isNull(target) ? Resources.formatUsageNoOneLeft(teammate.name)
      : Object.isNull(to) ? Resources.formatUsageChainStopped(teammate.name, limit) : Resources.formatUsageHandedOff(teammate.name, to.name);
    const now = new Date().toISOString();
    const ended = reply.withDetail(new MessageDetail(reply.details.length, DetailKind.Note, text,
      { source: Resources.usageHandOffSource, [Resources.handedOffField]: !Object.isNull(to) }, now)).withStatus(MessageStatus.Completed, now);
    const { next, member } = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const next = Object.isNull(to) || work.some(t => t.message.teammateId === to.id && t.trigger.id === item.trigger.id) ? null
        : await this.prepareReplyAsync(to, null, null, item.trigger, await this.messages.nextSequenceAsync(reply.conversationId, transaction), now, item.hop + 1,
          item.chain, null, transaction);
      const joining = Object.isNull(next) || Object.isNull(to) ? null : new ConversationMemberParams(reply.conversationId, to.id);
      const member = Object.isNull(joining) || !Object.isNull(await this.conversations.findMemberAsync(joining, transaction)) ? null : joining;
      if (!Object.isNull(member))
        await this.conversations.addMemberAsync(member, transaction);
      await this.messages.updateAsync(ended, transaction);
      if (!Object.isNull(next))
        await this.messages.insertAsync(next.message, transaction);
      return { next, member };
    });
    if (!Object.isNull(next)) {
      work.splice(index + 1, 0, next);
      this.state.runs.set(next.message.id, next.run);
    }
    this.events.publish(new Event(EventName.MessageUpdated, ended.toJson()));
    if (!Object.isNull(next))
      this.events.publish(new Event(EventName.MessageCreated, next.message.toJson()));
    if (!Object.isNull(member))
      this.events.publish(new Event(EventName.StateInvalidated, null));
    item.end();
    return true;
  }

  private async sessionOnAsync(member: ConversationMember | null, provider: Provider | null): Promise<string | null> {
    if (Object.isNull(member) || Object.isNull(member.nativeSessionId))
      return null;
    const session = member.nativeSessionId;
    return await this.accountOfSessionAsync(member) === provider?.id ? session : null;
  }

  private static movedNoteOf(carry: SessionCarry | null, kind: string, label: string, model: string | null, from: string): string {
    if (carry === SessionCarry.Carried)
      return Resources.formatSustainKept(kind, label, model, from);
    if (carry === SessionCarry.Held)
      return Resources.formatSustainHeld(kind, label, model, from);
    return Resources.formatSustainMoved(kind, label, model, from);
  }

  private async carryOfAsync(member: ConversationMember | null, provider: Provider): Promise<{ readonly carry: SessionCarry; readonly sessionId: string } | null> {
    if (Object.isNull(member) || Object.isNull(member.nativeSessionId))
      return null;
    const session = member.nativeSessionId;
    const account = await this.accountOfSessionAsync(member);
    const from = (await this.providers.listAsync()).find(t => t.id === account);
    const adapter = this.registry.get(provider.kind);
    if (Object.isUndefined(from) || from.id === provider.id || from.kind !== provider.kind || !adapter.descriptor.carriesSessions
      || Object.isUndefined(adapter.carrySession))
      return null;
    return { carry: await adapter.carrySession(from, provider, session), sessionId: session };
  }

  private async accountOfSessionAsync(member: ConversationMember): Promise<string | undefined> {
    return member.sessionProviderId ?? (await this.teammates.findAsync(member.teammateId))?.providerId;
  }

  private async summaryOfAsync(item: ReplyWork, teammateId: string, member: ConversationMember | null, provider: Provider, requested: RequestedSettings,
    context: ParticipantContext, askingAsync: () => Promise<void>): Promise<ChatSummary | null> {
    const read = await this.compactionOfAsync(member);
    const chatId = item.message.conversationId;
    const window = await this.messages.findWindowTokensAsync(provider.id, requested.model);
    const asked = Object.isNull(read) ? await context.createSummaryPromptAsync(item.message, item.trigger, item.continued, window) : null;
    if (Object.isNull(asked))
      return read;
    const [through, prompt] = asked;
    const kept = await this.summaries.findAsync(chatId, teammateId, through);
    if (!Object.isNull(kept))
      return kept;
    await askingAsync();
    return await this.summaries.writeAsync(chatId, teammateId, through, provider, requested, prompt, item.run.signal);
  }

  private async postMovedAsync(reply: Message, note: string | null): Promise<Message | null> {
    if (Object.isNull(note))
      return null;
    const posted = reply.withDetail(new MessageDetail(reply.details.length, DetailKind.Note, note, { source: Resources.sustainSource },
      new Date(this.timer.now()).toISOString()));
    await this.messages.updateAsync(posted);
    this.events.publish(new Event(EventName.MessageUpdated, posted.toJson()));
    return posted;
  }

  private async compactionOfAsync(member: ConversationMember | null): Promise<ChatSummary | null> {
    if (Object.isNull(member) || Object.isNull(member.nativeSessionId))
      return null;
    const session = member.nativeSessionId;
    const account = await this.accountOfSessionAsync(member);
    const provider = (await this.providers.listAsync()).find(t => t.id === account);
    if (Object.isUndefined(provider))
      return null;
    try {
      const text = await this.registry.get(provider.kind).readCompaction?.(provider, session) ?? null;
      return Object.isNull(text) ? null : new ChatSummary(text, this.kindNameOf(provider), true);
    }
    catch (error) {
      this.log?.write(Resources.formatCompactionUnread(provider.id, Resources.formatFailureKind(error)));
      return null;
    }
  }

  private async noteLimitAsync(provider: Provider | null, run: ReplyRun): Promise<void> {
    const limit = run.limit;
    if (Object.isNull(provider) || Object.isNull(limit))
      return;
    const held = this.planUsage?.list().find(t => t.providerId === provider.id)?.usedUpUntil ?? null;
    await this.limits.recordAsync(provider.id, new Date(this.timer.now()).toISOString(), limit.resetsAt ?? held);
  }

  private stoppedAccountOf(provider: Provider): string {
    return Resources.formatStoppedAccount(this.kindNameOf(provider), provider.label);
  }

  private handoverNoteOf(prompt: string, handover: HandoverPrompt | null, provider: Provider | null): HandoverNote | null {
    return Object.isNull(handover) ? null : new HandoverNote(prompt, handover.carried,
      handover.leftOut && !Object.isNull(provider) ? Resources.formatHandoverReads(this.kindNameOf(provider)) : null);
  }

  private kindNameOf(provider: Provider): string {
    return this.registry.get(provider.kind).descriptor.displayName;
  }

  private closeRun(item: ReplyWork): void {
    item.run.close();
    if (item.run.isOpen)
      void item.run.released.then(() => this.state.runs.delete(item.message.id));
    else
      this.state.runs.delete(item.message.id);
  }

  private closeGroup(work: ReplyWork[]): void {
    for (const [key, group] of this.state.groups)
      if (group === work)
        this.state.groups.delete(key);
  }

  private createRun(item: ReplyWork, folder: WorkFolder | null, requested: RequestedSettings, message: Message = item.message): ReplyRun {
    const provenance = item.message.provenance!;
    const providerId = item.provider?.id ?? provenance.providerId;
    const started = requested === provenance.requested && providerId === provenance.providerId ? provenance
      : new Provenance(providerId, requested, provenance.observed, provenance.nativeSessionId, provenance.resumedNativeSession, provenance.nativeTurnId,
        provenance.roleApplied, provenance.usage);
    return new ReplyRun(message.withProvenance(started), started, item.run, this.messages, this.approvals, this.events, this.context.dataDirectory, this.conversations,
      this.log, this.tasks, this.planUsage, (source, wake, ahead) => this.startWakeAsync(source, wake, ahead), this.checkpoints, folder,
      this.sharedFailures, this.titles, () => this.waitingSends.sendWaitingAsync(item.message.conversationId),
      Object.isNull(item.provider) ? null : this.stoppedAccountOf(item.provider));
  }

  private async startWakeAsync(source: Message, wake: TurnWake, ahead: boolean): Promise<WakeTurn | null> {
    const conversation = await this.conversations.findAsync(source.conversationId);
    if (Object.isNull(conversation) || (wake.compaction && !await this.compactsWhenIdleAsync(conversation)))
      return null;
    const folder = await this.findWorkFolderAsync(conversation, true);
    const teammate = Object.isNull(source.teammateId) ? null : await this.teammates.findAsync(source.teammateId);
    const provenance = source.provenance;
    if (this.state.closing || Object.isNull(folder) || Object.isNull(provenance) || (!Object.isNull(source.teammateId) && Object.isNull(teammate))
      || (!Object.isNull(teammate) && Object.isNull(await this.conversations.findMemberAsync(new ConversationMemberParams(source.conversationId, teammate.id)))))
      return null;
    const provider = Object.isNull(provenance.providerId) ? null : await this.providers.findAsync(provenance.providerId);
    const usual = Object.isNull(provenance.providerId) ? await this.providers.findUsualAsync(provenance.requested.kind) : null;
    if (provider?.enabled === false || usual?.enabled === false)
      return null;
    const now = new Date().toISOString();
    const payload = {
      source: Resources.wakeSource,
      ...wake.compaction ? { [Resources.idleCompactionField]: true } : {},
      ...Object.isNull(wake.taskId) ? {} : { [ProtocolResources.taskIdField]: wake.taskId },
      ...Object.isNull(wake.command) ? {} : { [ProtocolResources.commandField]: wake.command }
    };
    const note = new MessageDetail(0, DetailKind.Note, wake.compaction ? Resources.idleCompactionNote : Resources.formatWakeNote(wake.command), payload, now);
    const token = randomBytes(Resources.senderTokenBytes).toString("base64url");
    const requested = await this.wakeRequestedAsync(source, provenance.requested);
    const turn = new WakeTurn(SenderEnvironment.of(token), await this.plansFirstAsync(source.conversationId, requested.kind, source.teammateId),
      t => this.adoptSender(t, token), requested.mode);
    const hop = this.replyHops.get(source.conversationId)?.get(source.id);
    if (Object.isUndefined(hop) || this.state.closing)
      return null;
    const activity = this.context.projectActivity;
    const lease = activity.tryEnterTurn(folder.path);
    if (Object.isNull(lease)) {
      await activity.whenReleasedAsync();
      return this.startWakeAsync(source, wake, ahead);
    }
    const reply = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.conversations.findAsync(source.conversationId, transaction);
      if (Object.isNull(current) || current.projectId !== conversation.projectId || Object.isNull(await this.messages.findAsync(source.id, transaction)))
        return null;
      const created = new Message(Guid.createVersion7().toString(), source.conversationId, await this.messages.nextSequenceAsync(source.conversationId, transaction),
        MessageAuthor.Provider, source.id, MessageStatus.Pending, [note],
        new Provenance(provider?.id ?? null, requested, new ObservedSettings(null, null, null, null), null, false),
        now, null, null, [], teammate?.id ?? null, teammate?.name ?? null);
      await this.messages.insertAsync(created, transaction);
      return created;
    }).catch((error: unknown) => {
      activity.leave(lease);
      throw error;
    });
    if (Object.isNull(reply) || this.state.closing) {
      activity.leave(lease);
      if (!Object.isNull(reply))
        await this.interruptUnstartedAsync(reply);
      return null;
    }
    const item = new ReplyWork(reply, provider, teammate?.role ?? null, source, hop, turn);
    this.state.runs.set(reply.id, item.run);
    this.state.turns.set(token, item);
    this.events.publish(new Event(EventName.MessageCreated, reply.toJson()));
    const group = this.findGroup(source.conversationId);
    if (!Object.isNull(group)) {
      group.push(item);
      activity.leave(lease);
      if (ahead)
        this.followAhead(item, turn, folder);
      return turn;
    }

    this.runGroup(reply.id, [item], folder, lease);
    return turn;
  }

  private async compactsWhenIdleAsync(conversation: Conversation): Promise<boolean> {
    if (!this.readIdleCompaction() || conversation.sessionReset || !await this.isIdleAsync(conversation.id))
      return false;
    return (await this.runningTasksAsync(conversation.id)).length === 0;
  }

  private runGroup(key: string, work: ReplyWork[], folder: WorkFolder, lease: string): void {
    const conversationId = work[0]!.message.conversationId;
    this.state.groups.set(key, work);
    const execution = this.executeRepliesAsync(work, folder).catch(ConversationEngine.ignore).finally(async () => {
      for (const done of work) {
        done.end();
        this.closeRun(done);
        this.releaseWake(done);
        this.followed.delete(done);
      }
      this.state.groups.delete(key);
      this.completions.delete(key);
      this.context.projectActivity.leave(lease);
      await this.sendQueuedAsync(conversationId);
      await this.settleWakesAsync(conversationId, work);
    });
    this.completions.set(key, execution);
  }

  private static ignore(): void { }

  private static explorerRequested(started: RequestedSettings, adapter: IProviderAdapter): RequestedSettings {
    if (Object.isUndefined(adapter.explorerMode))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatExplorerUnavailable(adapter.descriptor.displayName, adapter.explorerUnavailable ?? null),
        [started.kind]);
    return new RequestedSettings(started.kind, started.model, started.effort, started.speed, adapter.explorerMode, false, started.contextWindow);
  }

  private sharedOfAsync(provider: Provider | null, teammateId: string | null, workingDirectory: string): Promise<SharedMcpSelection> {
    return this.sharedServers?.selectAsync(provider, teammateId, workingDirectory) ?? Promise.resolve(SharedMcpSelection.none);
  }

  private async requireWorkFolderAsync(conversation: Conversation, prepare: boolean, transaction?: SqlTransaction): Promise<WorkFolder> {
    const folder = await this.findWorkFolderAsync(conversation, prepare, transaction);
    if (Object.isNull(folder))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(conversation.projectId!), [conversation.projectId!]);
    return folder;
  }

  private async findWorkFolderAsync(conversation: Conversation, prepare: boolean, transaction?: SqlTransaction): Promise<WorkFolder | null> {
    const folders = this.context.chatFolders;
    if (!Object.isNull(conversation.attachedFolder))
      return WorkFolder.attached(conversation.attachedFolder);
    if (Object.isNull(conversation.projectId))
      return new WorkFolder(conversation.id, prepare ? folders.prepare(conversation.id) : folders.pathOf(conversation.id));
    const project = await this.projects.findAsync(conversation.projectId, transaction);
    return Object.isNull(project) ? null : new WorkFolder(project.id, project.rootPath);
  }

  private followAhead(item: ReplyWork, wake: WakeTurn, folder: WorkFolder): void {
    item.start();
    const following = this.followWithToolsAsync(item, wake, folder).finally(() => this.releaseWake(item));
    following.catch(ConversationEngine.ignore);
    this.followed.set(item, following);
  }

  private async followWithToolsAsync(item: ReplyWork, wake: WakeTurn, folder: WorkFolder): Promise<void> {
    const requested = await this.startedRequestedAsync(item.message);
    const run = this.createRun(item, null, requested);
    const tools = await this.toolCalls.openToolsAsync(item.message, run, SenderEnvironment.read(wake.environment)!, folder, requested);
    this.state.replyRuns.set(item, run);
    for (const resume of this.state.runWaits.get(item) ?? [])
      resume();
    await wake.useToolsAsync(tools);
    try {
      await this.messages.setCheckpointFolderAsync(item.message.id, folder.id);
      await run.followAsync(wake);
    }
    finally {
      await this.forgetChildrenAsync(item);
      this.toolCalls.closeTools(tools);
    }
  }

  private releaseWake(item: ReplyWork): void {
    const token = Object.isNull(item.wake) ? null : SenderEnvironment.read(item.wake.environment);
    if (!Object.isNull(token))
      this.state.turns.delete(token);
    this.releaseAdopted(item);
  }

  private releaseAdopted(item: ReplyWork): void {
    const adopted = this.adoptedSenders.get(item);
    if (!Object.isUndefined(adopted))
      this.state.turns.delete(adopted);
    this.adoptedSenders.delete(item);
  }

  private adoptSender(token: string, own: string): boolean {
    const item = this.state.turns.get(own);
    if (Object.isUndefined(item) || this.state.turns.has(token))
      return false;
    this.state.turns.set(token, item);
    this.adoptedSenders.set(item, token);
    return true;
  }

  private async failPendingRepliesAsync(work: readonly ReplyWork[], error: unknown): Promise<void> {
    for (const item of work) {
      const failed = await this.context.database.connection.runInTransactionAsync(async transaction => {
        const current = await this.messages.findAsync(item.message.id, transaction);
        if (Object.isNull(current) || !Object.isNull(current.endedAt))
          return null;
        const now = new Date().toISOString();
        const note = new MessageDetail(current.details.length, DetailKind.Error, error instanceof Error ? error.message : String(error), null, now);
        const ended = current.withDetail(note).withStatus(MessageStatus.Failed, now);
        await this.messages.updateAsync(ended, transaction);
        return ended;
      });
      if (Object.isNull(failed))
        continue;
      this.events.publish(new Event(EventName.MessageUpdated, failed.toJson()));
      if (!Object.isNull(failed.provenance))
        this.log?.write(Resources.formatReplyFailed(failed.provenance.requested.kind, failed.provenance.providerId, Resources.formatFailureKind(error)));
    }
  }

  private async failIfUnableAsync(item: ReplyWork, folder: WorkFolder, state: FolderState, isAttached: boolean): Promise<void> {
    if (item.isEnded)
      return;
    const provenance = item.message.provenance!;
    const provider = Object.isNull(provenance.providerId) ? await this.providers.findUsualAsync(provenance.requested.kind)
      : await this.providers.findAsync(provenance.providerId);
    const reason = provider?.enabled === false ? Resources.formatProviderDisabled(provider.label)
      : state === FolderState.Present ? null
        : state === FolderState.Missing
          ? isAttached ? Resources.formatAttachedFolderMissing(folder.path) : Resources.formatWorkFolderMissing(folder.path)
          : isAttached ? Resources.formatAttachedFolderUnreachable(folder.path) : Resources.formatWorkFolderUnreachable(folder.path);
    if (Object.isNull(reason) || item.isEnded)
      return;
    const now = new Date().toISOString();
    const note = new MessageDetail(item.message.details.length, DetailKind.Error, reason, null, now);
    const failed = item.message.withDetail(note).withStatus(MessageStatus.Failed, now);
    await this.messages.updateAsync(failed);
    this.events.publish(new Event(EventName.MessageUpdated, failed.toJson()));
    item.end();
  }

  private async refuseDisabledAsync(participants: readonly (Teammate | null)[], providerId: string | null): Promise<void> {
    for (const participant of participants) {
      const provider = await this.providers.findAsync(participant?.providerId ?? providerId!);
      if (Object.isNull(provider) || provider.enabled)
        continue;
      throw Object.isNull(participant)
        ? new ServiceException(ErrorCode.Unavailable, Resources.formatProviderDisabled(provider.label), [provider.id])
        : new ServiceException(ErrorCode.Unavailable, Resources.formatTeammateProviderDisabled(participant.name, provider.label), [participant.id, provider.id]);
    }
  }

  private async refuseUnrestrictedAsync(requested: RequestedSettings, mode: string, providerId: string | null): Promise<void> {
    const list = await this.registry.get(requested.kind).listModels(await this.resolveProviderAsync(requested, providerId));
    if (list.modes.some(t => t.id === mode && t.unrestricted))
      throw new ServiceException(ErrorCode.Unauthorized, Resources.unrestrictedModeRefused, [requested.kind, mode]);
  }

  private async resolveProviderAsync(requested: RequestedSettings, providerId: string | null, transaction?: SqlTransaction): Promise<Provider | null> {
    const usual = Object.isNull(providerId) ? await this.providers.findUsualAsync(requested.kind, transaction) : null;
    if (usual?.enabled === false)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatProviderDisabled(usual.label), [usual.id]);
    if (Object.isNull(providerId))
      return null;

    const provider = await this.providers.findAsync(providerId, transaction);
    if (Object.isNull(provider))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);
    if (provider.kind !== requested.kind)
      throw new ServiceException(
        ErrorCode.InvalidParams,
        Resources.formatProviderMismatch(provider.id, requested.kind),
        [provider.id, requested.kind]);
    if (!provider.enabled)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatProviderDisabled(provider.label), [provider.id]);

    return provider;
  }

  private async requireMessageAsync(messageId: string, transaction?: SqlTransaction): Promise<Message> {
    const message = await this.messages.findAsync(messageId, transaction);
    if (Object.isNull(message))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotFound(messageId), [messageId]);

    return message;
  }

  private publishStopped(before: Message, after: Message): void {
    for (const [index, detail] of after.details.entries())
      if (detail !== before.details[index])
        this.events.publish(new Event(EventName.DetailUpdated, new DetailEventPayload(after.id, detail).toJson()));
  }

  private static stopSubAgents(message: Message): Message {
    return message.withDetails(message.details.map(t => {
      if (t.kind !== DetailKind.SubAgent)
        return t;
      try {
        const agent = SubAgent.fromJson(t.payload);
        return agent.isRunning
          ? new MessageDetail(t.sequence, t.kind, t.text, agent.with({ status: SubAgentStatus.Stopped }).toJson(), t.createdAt, t.parentSequence)
          : t;
      }
      catch {
        return t;
      }
    }));
  }

  private async isAwaitedAsync(reply: Message): Promise<boolean> {
    try {
      return (await this.wakes.listAsync(ChatWakeState.Waiting)).some(t => t.kind === ChatWakeKind.Reply && t.watchedIds.includes(reply.id));
    }
    catch (error) {
      this.log?.write(Resources.formatAwaitedReplyUnread(reply.id, Resources.formatFailureKind(error)));
      return false;
    }
  }

  private async settleWakesAsync(conversationId: string, work: readonly ReplyWork[]): Promise<void> {
    await this.settleSafelyAsync(conversationId, async () => {
      const hop = Math.max(0, ...work.map(t => t.hop)) + 1;
      const settled = await this.context.database.connection.runInTransactionAsync(async transaction => {
        const ready: ChatWake[] = [];
        for (const wake of (await this.wakes.listAsync(ChatWakeState.Waiting, transaction))
          .filter(t => t.kind === ChatWakeKind.Reply && t.watchedChatId === conversationId)) {
          if (!await this.watchedEndedAsync(wake, transaction))
            continue;
          await this.wakes.updateAsync(wake.settled(ChatWakeState.Ready, await this.wakeTextOfAsync(wake, work, transaction), hop,
            await this.wakeViewOfAsync(wake, null, transaction)), transaction);
          ready.push(wake);
        }
        return ready;
      });
      for (const wake of settled)
        await this.sendWakesAsync(wake.chatId);
      await this.sendWakesAsync(conversationId);
    });
  }

  private async watchedEndedAsync(wake: ChatWake, transaction: SqlTransaction): Promise<boolean> {
    for (const id of wake.watchedIds)
      if (!ConversationEngine.hasEnded(await this.messages.findAsync(id, transaction)))
        return false;
    return true;
  }

  private async wakeForSubAgentAsync(turn: ReplyWork, child: SubAgentRun): Promise<void> {
    await this.settleSafelyAsync(turn.message.conversationId, async () => {
      const ended = child.current;
      const text = Resources.formatSubAgentWake(ended.description, child.id, ended.status, ended.summary);
      const view = ConversationEngine.taskViewOf(ProtocolResources.wakeSubAgentTask, ended.description, Resources.formatSubAgentEnding(ended.status),
        Object.isNull(ended.summary) ? null : Resources.formatWakeQuote(ended.summary));
      const settled = await this.context.database.connection.runInTransactionAsync(async transaction => {
        const waiting = (await this.wakes.listAsync(ChatWakeState.Waiting, transaction)).filter(t => t.kind === ChatWakeKind.SubAgent && t.watchedIds.includes(child.id));
        for (const wake of waiting)
          await this.wakes.updateAsync(wake.settled(child.wasStopped ? ChatWakeState.Undeliverable : ChatWakeState.Ready, text, turn.hop + 1, view), transaction);
        return waiting;
      });
      for (const wake of settled)
        await this.sendWakesAsync(wake.chatId);
    });
  }

  private async wakeForCommandAsync(run: CommandRun, exit: CommandExit): Promise<void> {
    await this.settleSafelyAsync(run.chatId, async () => {
      const settled = await this.context.database.connection.runInTransactionAsync(async transaction => {
        const waiting = (await this.wakes.listAsync(ChatWakeState.Waiting, transaction)).filter(t => t.kind === ChatWakeKind.Command && t.watchedIds.includes(run.id));
        for (const wake of waiting)
          await this.wakes.updateAsync(wake.settled(run.wasStopped ? ChatWakeState.Undeliverable : ChatWakeState.Ready, run.wakeTextOf(exit), run.turn.hop + 1,
            ConversationEngine.taskViewOf(ProtocolResources.wakeCommandTask, run.description, Resources.formatCommandEnding(exit),
              Resources.formatCommandQuote(run.lastLines))), transaction);
        return waiting;
      });
      for (const wake of settled)
        await this.sendWakesAsync(wake.chatId);
    });
  }

  private async settleSafelyAsync(conversationId: string, settleAsync: () => Promise<void>): Promise<void> {
    if (this.state.closing)
      return;
    try {
      await settleAsync();
    }
    catch (error) {
      this.log?.write(Resources.formatWakesNotSettled(conversationId, Resources.formatFailureKind(error)));
    }
  }

  private async sendWakesAsync(conversationId: string): Promise<void> {
    while (!this.state.closing && await this.isIdleAsync(conversationId, undefined, true)) {
      if (this.sendingChats.has(conversationId)) {
        this.refusedSends.add(conversationId);
        return;
      }
      const next = (await this.wakes.listAsync(ChatWakeState.Ready)).find(t => t.chatId === conversationId);
      if (Object.isUndefined(next) || await this.deliverWakeAsync(next, null))
        return;
    }
  }

  private async deliverWakeAsync(wake: ChatWake, end: string | null): Promise<boolean> {
    const startsTurn = Object.isNull(end);
    const conversation = await this.requireConversationAsync(wake.chatId);
    const folder = await this.requireWorkFolderAsync(conversation, true);
    const text = wake.text!;
    const activity = this.context.projectActivity;
    const lease = startsTurn ? activity.tryEnterTurn(folder.path) : null;
    if (startsTurn && Object.isNull(lease)) {
      void activity.whenReleasedAsync().then(() => this.settleSafelyAsync(conversation.id, () => this.sendWakesAsync(conversation.id)));
      return true;
    }
    const leave = (): void => {
      if (!Object.isNull(lease))
        activity.leave(lease);
    };
    const delivered = await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireUnmovedAsync(conversation, transaction);
      const open = [...await this.wakes.listAsync(ChatWakeState.Waiting, transaction), ...await this.wakes.listAsync(ChatWakeState.Ready, transaction)];
      if (!open.some(t => t.id === wake.id) || (startsTurn && !await this.isIdleAsync(conversation.id, transaction)))
        return null;
      const source = await this.messages.findAsync(wake.sourceMessageId, transaction);
      const now = new Date().toISOString();
      const sequence = await this.messages.nextSequenceAsync(conversation.id, transaction);
      const view = await this.wakeViewOfAsync(wake, end, transaction);
      const watched = Object.isNull(view) ? null : await this.conversations.findAsync(wake.watchedChatId, transaction);
      const body = Object.isNull(view) || !Object.isNull(end) || !Object.isNull(watched) ? text
        : `${text}${Resources.transcriptSeparator}${Resources.wakeChatDeletedSince}`;
      const id = Guid.createVersion7().toString();
      const sender = await this.wakeSenderOfAsync(wake, transaction);
      const messageOf = (reply: string | null): Message => new Message(id, conversation.id, sequence, MessageAuthor.User, null, MessageStatus.Completed,
        [new MessageDetail(0, DetailKind.Text, body, {
          source: ProtocolResources.chatWakeSource, [Resources.wakeIdField]: wake.id, [Resources.wakeSourceMessageField]: wake.sourceMessageId, ...view,
          ...Object.isNull(reply) ? {} : { [ProtocolResources.wakeReplyField]: reply }
        }, now)], null, now, null, now, [], null, null, [], sender);
      const message = messageOf(null);
      const limit = this.readHopLimit();
      const hop = wake.hop ?? 0;
      const blocked = startsTurn ? await this.unwokenReasonOfAsync(conversation, source, transaction) : null;
      const stopped = startsTurn && Object.isNull(blocked) && hop > limit;
      const received = Object.isNull(view) ? null
        : new MessageDetail(0, DetailKind.Note, wake.kind === ChatWakeKind.Reply ? Resources.formatWakeReceived(watched?.title ?? null) : Resources.taskWakeReceived,
          { source: ProtocolResources.wakeReceivedSource, ...view }, now);
      const started = !startsTurn || stopped ? null : blocked ?? await this.wakeReplyOfAsync(source!, message, sequence + 1, now, hop, received, transaction);
      const item = started instanceof ReplyWork ? started : null;
      const note = stopped ? new MessageDetail(1, DetailKind.Note, Resources.formatChainStopped(limit), { source: Resources.handOffSource }, now)
        : Object.isString(started) ? new MessageDetail(1, DetailKind.Note, Resources.formatWakeNotStarted(started), null, now) : null;
      const shown = Object.isNull(item) || Object.isNull(view) ? message : messageOf(item.message.id);
      const stored = Object.isNull(note) ? shown : shown.withDetail(note);
      await this.messages.insertAsync(stored, transaction);
      if (!Object.isNull(item))
        await this.messages.insertAsync(item.message, transaction);
      await this.wakes.updateAsync(wake.settled(Object.isNull(item) ? ChatWakeState.Undeliverable : ChatWakeState.Delivered, body, hop), transaction);
      return { stored, item };
    }).catch((error: unknown) => {
      leave();
      throw error;
    });
    if (Object.isNull(delivered)) {
      leave();
      return false;
    }
    const { stored, item } = delivered;
    this.events.publish(new Event(EventName.MessageCreated, stored.toJson()));
    if (Object.isNull(item) || Object.isNull(lease)) {
      leave();
      return false;
    }
    if (this.state.closing) {
      leave();
      await this.interruptUnstartedAsync(item.message);
      return true;
    }
    this.state.runs.set(item.message.id, item.run);
    this.events.publish(new Event(EventName.MessageCreated, item.message.toJson()));
    this.runGroup(stored.id, [item], folder, lease);
    return true;
  }

  private async unwokenReasonOfAsync(conversation: Conversation, source: Message | null, transaction?: SqlTransaction): Promise<string | null> {
    if (Object.isNull(source) || Object.isNull(source.provenance))
      return Resources.wakeSenderGone;
    if (!Object.isNull(source.teammateId) && (Object.isNull(await this.teammates.findAsync(source.teammateId, transaction))
      || Object.isNull(await this.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, source.teammateId), transaction))))
      return Resources.wakeTeammateGone;
    return null;
  }

  private async wakeReplyOfAsync(source: Message, trigger: Message, sequence: number, createdAt: string, hop: number, received: MessageDetail | null,
    transaction?: SqlTransaction): Promise<ReplyWork | string> {
    const provenance = source.provenance!;
    const teammate = Object.isNull(source.teammateId) ? null : await this.teammates.findAsync(source.teammateId, transaction);
    let work: ReplyWork | null;
    try {
      work = await this.prepareReplyAsync(teammate, await this.wakeRequestedAsync(source, provenance.requested, transaction), provenance.providerId, trigger,
        sequence, createdAt, hop, null, null, transaction);
    }
    catch (error) {
      if (!(error instanceof ServiceException))
        throw error;
      return Resources.formatWakeProviderRefused(error.message);
    }
    if (Object.isNull(work))
      return Resources.wakeProviderUnavailable;
    return Object.isNull(received) ? work
      : new ReplyWork(work.message.withDetail(received), work.provider, work.instructions, work.trigger, work.hop, work.wake, work.chain, work.continued);
  }

  private async wakeViewOfAsync(wake: ChatWake, end: string | null, transaction?: SqlTransaction): Promise<JsonObject | null> {
    if (wake.kind !== ChatWakeKind.Reply)
      return Object.isNull(wake.view) ? null : { [ProtocolResources.wakeTaskField]: wake.view, ...Object.isNull(end) ? {} : { [ProtocolResources.wakeEndField]: end } };
    if (!Object.isNull(end))
      return { [ProtocolResources.wakeChatField]: wake.watchedChatId, [ProtocolResources.wakeRepliesField]: [], [ProtocolResources.wakeEndField]: end };
    if (!Object.isNull(wake.view))
      return wake.view;
    const replies: JsonObject[] = [];
    for (const id of wake.watchedIds) {
      const reply = await this.messages.findAsync(id, transaction);
      if (!Object.isNull(reply)) {
        const quote = ConversationEngine.quoteOf(reply);
        replies.push({
          [ProtocolResources.nameField]: this.nameOf(reply),
          [ProtocolResources.statusField]: reply.status,
          [ProtocolResources.textField]: Object.isNull(quote) ? null : Resources.formatWakeQuote(quote)
        });
      }
    }
    return { [ProtocolResources.wakeChatField]: wake.watchedChatId, [ProtocolResources.wakeRepliesField]: replies };
  }

  private async wakeSenderOfAsync(wake: ChatWake, transaction?: SqlTransaction): Promise<MessageSender> {
    const from = wake.kind === ChatWakeKind.Reply ? await this.messages.findAsync(wake.watchedIds[0]!, transaction) : null;
    return new MessageSender(wake.watchedChatId, from?.teammateId ?? null, Object.isNull(from) ? Resources.wakeSenderName : this.nameOf(from));
  }

  private async wakeTextOfAsync(wake: ChatWake, work: readonly ReplyWork[], transaction?: SqlTransaction): Promise<string> {
    const replies: string[] = [];
    for (const id of wake.watchedIds) {
      const reply = await this.messages.findAsync(id, transaction);
      if (!Object.isNull(reply))
        replies.push(Resources.formatWakeReply(this.nameOf(reply), reply.id, reply.status, ConversationEngine.quoteOf(reply)));
    }
    const handOffs = work.filter(t => !wake.watchedIds.includes(t.message.id) && t.trigger.author === MessageAuthor.Provider)
      .map(t => Resources.formatWakeHandOff(this.nameOf(t.message), t.message.id));
    return [Resources.formatWakeHeader((await this.requireConversationAsync(wake.watchedChatId, transaction)).title, wake.watchedChatId), ...replies,
      ...handOffs.length === 0 ? [] : [Resources.formatWakeHandOffs(handOffs.join(Resources.listSeparator))], Resources.wakeReadWhole]
      .join(Resources.transcriptSeparator);
  }

  private async lostOfAsync(wake: ChatWake): Promise<readonly [string, string]> {
    switch (wake.kind) {
      case ChatWakeKind.SubAgent:
        return [Resources.formatSubAgentWakeLost(wake.watchedIds[0]!), ProtocolResources.wakeLostEnd];
      case ChatWakeKind.Command:
        return [Resources.formatCommandWakeLost(wake.watchedIds.join(Resources.listSeparator)), ProtocolResources.wakeLostEnd];
      case ChatWakeKind.Reply: {
        const watched = await this.conversations.findAsync(wake.watchedChatId);
        return Object.isNull(watched) ? [Resources.formatWakeChatDeleted(wake.watchedChatId), ProtocolResources.wakeChatDeletedEnd]
          : [Resources.formatWakeLost(watched.title, wake.watchedChatId), ProtocolResources.wakeLostEnd];
      }
    }
  }

  private static taskViewOf(kind: string, name: string, ending: string | null, text: string | null): JsonObject {
    return { [ProtocolResources.kindField]: kind, [ProtocolResources.nameField]: name, [ProtocolResources.endingField]: ending, [ProtocolResources.textField]: text };
  }

  private nameOf(reply: Message): string {
    return reply.teammateName ?? this.registry.get(reply.provenance!.requested.kind).descriptor.displayName;
  }

  private static hasEnded(message: Message | null): boolean {
    return Object.isNull(message)
      || [MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Cancelled, MessageStatus.Interrupted].includes(message.status);
  }

  private static quoteOf(reply: Message): string | null {
    const text = reply.details.filter(t => t.kind === DetailKind.Text).at(-1)?.text ?? String.empty;
    return String.isNullOrWhitespace(text) ? null : text;
  }

}
