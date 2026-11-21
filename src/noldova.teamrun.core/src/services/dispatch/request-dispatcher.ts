/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { ServiceException, ServiceResponseInfo } from "@noldova/teamrun.services";
import {
  AttachmentInput,
  AttachmentReadParams,
  WrittenImageReadParams,
  ConversationMemberParams,
  ChatFindParams,
  ChatFolderAttachParams,
  ChatMemberModeParams,
  ChatMemberSettingsParams,
  ChatPlanFirstParams,
  TeammateCreateParams,
  TeammateUpdateParams,
  TeammateIdParams,
  SharedMcpProviderSetParams,
  SharedMcpServerDefinition,
  SharedMcpServerIdParams,
  SharedMcpServerUpdateParams,
  SharedMcpSecretSetParams,
  AcpAgentIdParams,
  AcpLocalCommandAddParams,
  SharedMcpTeammateSetParams,
  ComputerUseGrantIdParams,
  DepartmentCreateParams,
  DepartmentIdParams,
  DepartmentMemberSetParams,
  OrganizationMessageSendParams,
  DepartmentMoveParams,
  DepartmentUpdateParams,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams,
  DefaultTeammateSetParams,
  ComposerDefaultSaveParams,
  MessageAttachment,
  ApprovalDecideParams,
  BackgroundTaskIdParams,
  BackgroundTaskListParams,
  SubAgentStartParams,
  CommandStartParams,
  SubAgentStopParams,
  SubAgentWaitParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationSearchParams,
  DataFolder,
  DraftDiscardParams,
  DraftSaveParams,
  ErrorCode,
  DetailKind,
  Event,
  EventName,
  LinkedPaths,
  MessageDetailsAfterParams,
  MessageIdParams,
  MessageListParams,
  MessagePageParams,
  MessageSendParams,
  MethodName,
  PanelAnsweredParams,
  ProjectIdParams,
  ProjectOpenParams,
  ProjectsLayoutSaveParams,
  ProviderCreateParams,
  ProviderIdParams,
  ProviderProfileDiscoverParams,
  ProviderKindParams,
  ProviderUpdateParams,
  ProviderEnabledParams,
  PlanUsageParams,
  ProviderContextWindows,
  ProviderListModelsParams,
  type ProviderKind,
  ReadingPositionSaveParams,
  RunOutput,
  Resources as ProtocolResources,
  type Request,
  Response,
  ReplyPanel,
  ReplySummary,
  TeammateFallback,
  WindowFocusedParams,
  WindowIdParams
} from "@noldova/teamrun.protocol";

import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IBackgroundTasksService } from "../../interfaces/i-background-tasks.service.js";
import type { IComputerUseGrantsService } from "../../interfaces/i-computer-use-grants.service.js";
import type { IConversationEngine } from "../../interfaces/i-conversation-engine.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IDraftsService } from "../../interfaces/i-drafts.service.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { IProviderKindsService } from "../../interfaces/i-provider-kinds.service.js";
import type { IReadingPositionsService } from "../../interfaces/i-reading-positions.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IAcpAgentsService } from "../../interfaces/i-acp-agents.service.js";
import type { ISharedMcpServersService } from "../../interfaces/i-shared-mcp-servers.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { IOrganizationMessagesService } from "../../interfaces/i-organization-messages.service.js";
import type { IOrganizationService } from "../../interfaces/i-organization.service.js";
import type { IWindowsService } from "../../interfaces/i-windows.service.js";
import { Resources } from "../../resources.js";

export class RequestDispatcher {
  private static readonly catalogMutations: ReadonlySet<string> = new Set([
    MethodName.TeammateCreate, MethodName.TeammateUpdate, MethodName.TeammateDelete, MethodName.DefaultTeammateSet, MethodName.ConversationAddMember,
    MethodName.ConversationRemoveMember, MethodName.ConversationSetMemberMode, MethodName.ConversationSetMemberSettings,
    MethodName.ConversationSetPlanFirst,
    MethodName.ProjectOpen, MethodName.ProjectForget, MethodName.ConversationCreate, MethodName.ConversationRename, MethodName.ConversationTouch,
    MethodName.ConversationResponderSet, MethodName.ConversationMove, MethodName.ConversationDelete, MethodName.ChatFolderAttach, MethodName.ChatFolderDetach,
    MethodName.ProviderCreate, MethodName.ProviderUpdate,
    MethodName.ProviderSetEnabled, MethodName.ProviderDelete, MethodName.SharedMcpServerCreate, MethodName.SharedMcpServerUpdate,
    MethodName.SharedMcpServerDelete, MethodName.SharedMcpProviderSet, MethodName.SharedMcpTeammateSet, MethodName.SharedMcpSecretSet,
    MethodName.SharedMcpSignOut
  ]);
  private readonly events: IEventSink | null;
  private readonly kinds: IProviderKindsService;
  private readonly providers: IProvidersService;
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly engine: IConversationEngine;
  private readonly teammates: ITeammatesService;
  private readonly drafts: IDraftsService | null;
  private readonly dataFolder: DataFolder | null;
  private readonly tasks: IBackgroundTasksService | null;
  private readonly planUsage: IPlanUsageService | null;
  private readonly readingPositions: IReadingPositionsService | null;
  private readonly windows: IWindowsService | null;
  private readonly sharedServers: ISharedMcpServersService | null;
  private readonly acpAgents: IAcpAgentsService | null;
  private readonly organization: IOrganizationService | null;
  private readonly organizationMessages: IOrganizationMessagesService | null;
  private readonly computerUseGrants: IComputerUseGrantsService | null;

  public constructor(
    kinds: IProviderKindsService,
    providers: IProvidersService,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    engine: IConversationEngine,
    teammates: ITeammatesService,
    events: IEventSink | null = null,
    drafts: IDraftsService | null = null,
    dataFolder: DataFolder | null = null,
    tasks: IBackgroundTasksService | null = null,
    planUsage: IPlanUsageService | null = null,
    readingPositions: IReadingPositionsService | null = null,
    windows: IWindowsService | null = null,
    sharedServers: ISharedMcpServersService | null = null,
    computerUseGrants: IComputerUseGrantsService | null = null,
    acpAgents: IAcpAgentsService | null = null,
    organization: IOrganizationService | null = null, organizationMessages: IOrganizationMessagesService | null = null) {
    this.acpAgents = acpAgents;
    this.organization = organization;
    this.organizationMessages = organizationMessages;
    this.events = events;
    this.kinds = kinds;
    this.providers = providers;
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
    this.approvals = approvals;
    this.engine = engine;
    this.teammates = teammates;
    this.drafts = drafts;
    this.dataFolder = dataFolder;
    this.tasks = tasks;
    this.planUsage = planUsage;
    this.readingPositions = readingPositions;
    this.windows = windows;
    this.sharedServers = sharedServers;
    this.computerUseGrants = computerUseGrants;
  }

  public async dispatch(request: Request, signal?: AbortSignal): Promise<Response> {
    try {
      const payload = await this.invoke(request.method, request.payload, signal);
      if (RequestDispatcher.catalogMutations.has(request.method))
        this.publish(new Event(EventName.StateInvalidated, null));
      return Response.success(request.id, payload);
    }
    catch (error) {
      return Response.failure(request.id, RequestDispatcher.describe(error));
    }
  }

  public static describe(error: unknown): ServiceResponseInfo {
    if (error instanceof ServiceException)
      return error.info;
    if (error instanceof JsonException)
      return new ServiceResponseInfo(ErrorCode.InvalidParams, error.message, [error.path]);
    if (error instanceof ArgumentException)
      return new ServiceResponseInfo(ErrorCode.InvalidParams, error.message, [error.parameterName].filter((t): t is string => !Object.isUndefined(t)));

    return new ServiceResponseInfo(ErrorCode.Internal, error instanceof Error ? error.message : String(error));
  }

  private async invoke(method: string, payload: JsonValue, signal: AbortSignal | undefined): Promise<JsonValue> {
    switch (method) {
      case MethodName.TeammateList:
        return (await this.teammates.listAsync()).map(t => t.toJson());
      case MethodName.TeammateCreate: {
        const params = TeammateCreateParams.fromJson(payload);
        await this.requireContextWindow(params.providerId, params.model, params.contextWindow);
        await this.requireSustain(params.providerId, params.model, params.effort, params.sustain, params.fallbacks, params.usageHandOffs);
        return (await this.teammates.createAsync(params)).toJson();
      }
      case MethodName.TeammateUpdate: {
        const params = TeammateUpdateParams.fromJson(payload);
        const current = await this.teammates.findAsync(params.teammateId);
        const bound = [params.providerId, params.model, params.contextWindow];
        const sustained = [params.effort, params.sustain, params.fallbacks];
        if (Object.isNull(current) || [...bound, ...sustained].every(t => Object.isUndefined(t)))
          return (await this.teammates.updateAsync(params)).toJson();
        const next = params.applyTo(current, current.updatedAt);
        if (bound.some(t => !Object.isUndefined(t)))
          await this.requireContextWindow(next.providerId, next.model, next.contextWindow);
        await this.requireSustain(next.providerId, next.model, next.effort, next.sustain, next.fallbacks, next.usageHandOffs);
        return (await this.teammates.updateAsync(params, current)).toJson();
      }
      case MethodName.TeammateDelete: {
        const params = TeammateIdParams.fromJson(payload);
        if (await this.teammates.deleteAsync(params) && !Object.isNull(this.organization))
          await this.publishOrganizationAsync(this.organization);
        this.tasks?.stopTeammate(params.teammateId, null);
        this.engine.forgetTeammate(params.teammateId, null);
        return null;
      }
      case MethodName.OrganizationList:
      case MethodName.DepartmentCreate:
      case MethodName.DepartmentUpdate:
      case MethodName.DepartmentMove:
      case MethodName.DepartmentDelete:
      case MethodName.DepartmentMemberSet:
        return await this.organizeAsync(RequestDispatcher.require(this.organization, method), method, payload);
      case MethodName.OrganizationMessageSend:
        return (await RequestDispatcher.require(this.organizationMessages, method).sendAsync(OrganizationMessageSendParams.fromJson(payload))).toJson();
      case MethodName.OrganizationMessageStop:
        return (await RequestDispatcher.require(this.organizationMessages, method).stopAsync(MessageIdParams.fromJson(payload))).toJson();
      case MethodName.OrganizationMessageList:
        return (await RequestDispatcher.require(this.organizationMessages, method).listAsync()).map(t => t.toJson());
      case MethodName.SharedMcpServerList:
        return (await RequestDispatcher.require(this.sharedServers, method).listAsync()).map(t => t.toJson());
      case MethodName.SharedMcpServerCreate:
        return (await RequestDispatcher.require(this.sharedServers, method).createAsync(SharedMcpServerDefinition.fromJson(payload))).toJson();
      case MethodName.SharedMcpServerUpdate:
        return (await RequestDispatcher.require(this.sharedServers, method).updateAsync(SharedMcpServerUpdateParams.fromJson(payload))).toJson();
      case MethodName.SharedMcpServerDelete:
        await RequestDispatcher.require(this.sharedServers, method).deleteAsync(SharedMcpServerIdParams.fromJson(payload));
        return null;
      case MethodName.SharedMcpProviderSet:
        return (await RequestDispatcher.require(this.sharedServers, method).setProviderAsync(SharedMcpProviderSetParams.fromJson(payload))).toJson();
      case MethodName.SharedMcpTeammateSet:
        return (await RequestDispatcher.require(this.sharedServers, method).setTeammateAsync(SharedMcpTeammateSetParams.fromJson(payload))).toJson();
      case MethodName.SharedMcpSecretSet:
        return (await RequestDispatcher.require(this.sharedServers, method).setSecretAsync(SharedMcpSecretSetParams.fromJson(payload))).toJson();
      case MethodName.SharedMcpSignInStart:
        return (await RequestDispatcher.require(this.sharedServers, method).startSignInAsync(SharedMcpServerIdParams.fromJson(payload))).toJson();
      case MethodName.SharedMcpSignOut:
        return (await RequestDispatcher.require(this.sharedServers, method).signOutOfAsync(SharedMcpServerIdParams.fromJson(payload))).toJson();
      case MethodName.AcpAgentList:
        return (await RequestDispatcher.require(this.acpAgents, method).listAsync()).toJson();
      case MethodName.AcpAgentIcon:
        return await RequestDispatcher.require(this.acpAgents, method).readIconAsync(AcpAgentIdParams.fromJson(payload));
      case MethodName.AcpAgentAdd:
        return (await RequestDispatcher.require(this.acpAgents, method).addAsync(AcpAgentIdParams.fromJson(payload))).toJson();
      case MethodName.AcpLocalCommandAdd:
        return (await RequestDispatcher.require(this.acpAgents, method).addLocalAsync(AcpLocalCommandAddParams.fromJson(payload))).toJson();
      case MethodName.AcpAgentRemove:
        await RequestDispatcher.require(this.acpAgents, method).removeAsync(AcpAgentIdParams.fromJson(payload));
        return null;
      case MethodName.ComputerUseGrantList:
        return (await RequestDispatcher.require(this.computerUseGrants, method).listAsync(signal)).map(t => t.toJson());
      case MethodName.ComputerUseGrantRevoke:
        RequestDispatcher.require(this.computerUseGrants, method).revoke(ComputerUseGrantIdParams.fromJson(payload));
        return null;
      case MethodName.DefaultTeammateRead:
        return (await this.teammates.readDefaultAsync())?.toJson() ?? null;
      case MethodName.DefaultTeammateSet:
        return (await this.teammates.setDefaultAsync(DefaultTeammateSetParams.fromJson(payload)))?.toJson() ?? null;
      case MethodName.ComposerDefaultRead:
        return await this.teammates.readComposerDefaultAsync();
      case MethodName.ComposerDefaultSave: {
        const choice = await this.teammates.saveComposerDefaultAsync(ComposerDefaultSaveParams.fromJson(payload));
        this.publish(new Event(EventName.ComposerDefaultUpdated, choice));
        return choice;
      }
      case MethodName.ConversationListMembers:
        return (await this.conversations.listMembersAsync(ConversationIdParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.ConversationAddMember:
        return (await this.conversations.addMemberAsync(ConversationMemberParams.fromJson(payload))).toJson();
      case MethodName.ConversationRemoveMember: {
        const params = ConversationMemberParams.fromJson(payload);
        await this.conversations.removeMemberAsync(params);
        this.tasks?.stopTeammate(params.teammateId, params.conversationId);
        this.engine.forgetTeammate(params.teammateId, params.conversationId);
        return null;
      }
      case MethodName.ConversationSetMemberMode:
        return (await this.conversations.setMemberModeAsync(ChatMemberModeParams.fromJson(payload))).toJson();
      case MethodName.ConversationSetMemberSettings:
        return (await this.conversations.setMemberSettingsAsync(ChatMemberSettingsParams.fromJson(payload))).toJson();
      case MethodName.ConversationSetPlanFirst: {
        const params = ChatPlanFirstParams.fromJson(payload);
        const conversation = await this.conversations.setPlanFirstAsync(params);
        if (params.planFirst)
          await this.engine.planFirstAsync(params.chatId);
        return conversation.toJson();
      }
      case MethodName.AttachmentPrepare:
        return this.engine.prepareAttachment(AttachmentInput.fromJson(payload)).toJson();
      case MethodName.AttachmentDiscard:
        this.engine.discardAttachment(MessageAttachment.fromJson(payload));
        return null;
      case MethodName.AttachmentRead: {
        const params = AttachmentReadParams.fromJson(payload);
        return (await this.engine.readAttachmentAsync(params, await RequestDispatcher.require(this.drafts, method).readAsync(new ConversationIdParams(params.conversationId)))).toJson();
      }
      case MethodName.AttachmentShare: {
        const params = AttachmentReadParams.fromJson(payload);
        return (await this.engine.locateAttachmentAsync(params, await RequestDispatcher.require(this.drafts, method).readAsync(new ConversationIdParams(params.conversationId)))).toJson();
      }
      case MethodName.AttachmentExists:
        return await this.engine.hasAttachmentAsync(AttachmentReadParams.fromJson(payload));
      case MethodName.LinkedFolderList:
        return (await this.engine.listLinkedFolders(LinkedPaths.fromJson(payload))).toJson();
      case MethodName.WrittenImageRead:
        return (await this.engine.readWrittenImageAsync(WrittenImageReadParams.fromJson(payload))).toJson();
      case MethodName.WrittenImageShare:
        return (await this.engine.locateWrittenImageAsync(WrittenImageReadParams.fromJson(payload))).toJson();
      case MethodName.DraftSave:
        return (await RequestDispatcher.require(this.drafts, method).saveAsync(DraftSaveParams.fromJson(payload))).toJson();
      case MethodName.DraftRead:
        return (await RequestDispatcher.require(this.drafts, method).readAsync(ConversationIdParams.fromJson(payload)))?.toJson() ?? null;
      case MethodName.DraftDiscard:
        await RequestDispatcher.require(this.drafts, method).discardAsync(DraftDiscardParams.fromJson(payload));
        return null;
      case MethodName.ReadingPositionList:
        return (await RequestDispatcher.require(this.readingPositions, method).listAsync()).map(t => t.toJson());
      case MethodName.ReadingPositionSave:
        await RequestDispatcher.require(this.readingPositions, method).saveAsync(ReadingPositionSaveParams.fromJson(payload));
        return null;
      case MethodName.RunOutputList:
        return (await this.conversations.listRunOutputsAsync(ConversationIdParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.RunOutputSave:
        await this.conversations.saveRunOutputAsync(RunOutput.fromJson(payload));
        return null;
      case MethodName.DataFolderRead:
        return RequestDispatcher.require(this.dataFolder, method).toJson();
      case MethodName.FirstLaunchRead:
        return (await this.providers.readFirstLaunchAsync()).toJson();
      case MethodName.FirstLaunchFinish:
        return (await this.providers.finishFirstLaunchAsync()).toJson();
      case MethodName.ProviderKindList:
        return (await this.kinds.listAsync()).map(t => t.toJson());
      case MethodName.ProviderListModels:
        return [...await this.kinds.listModelsAsync(ProviderListModelsParams.fromJson(payload))];
      case MethodName.ProviderModelCatalog:
        return (await this.kinds.modelCatalogAsync(ProviderListModelsParams.fromJson(payload))).toJson();
      case MethodName.ProviderKindInstallationList:
        return (await this.kinds.listInstallations()).map(t => t.toJson());
      case MethodName.ProviderToolList:
        return (await this.kinds.listTools()).map(t => t.toJson());
      case MethodName.ProviderKindInstall:
        return (await this.kinds.install(ProviderKindParams.fromJson(payload))).toJson();
      case MethodName.ProviderKindInstallCancel:
        this.kinds.cancelInstall(ProviderKindParams.fromJson(payload));
        return null;
      case MethodName.ProviderList:
        return (await this.providers.listAsync()).map(t => t.toJson());
      case MethodName.ProviderCreate:
        return (await this.providers.createAsync(ProviderCreateParams.fromJson(payload))).toJson();
      case MethodName.ProviderUpdate:
        return (await this.providers.updateAsync(ProviderUpdateParams.fromJson(payload))).toJson();
      case MethodName.ProviderSetEnabled:
        return (await this.providers.setEnabledAsync(ProviderEnabledParams.fromJson(payload))).toJson();
      case MethodName.ProviderCheck:
        return (await this.providers.checkAsync(ProviderIdParams.fromJson(payload))).toJson();
      case MethodName.ProviderSignIn:
        return (await this.providers.signInAsync(ProviderIdParams.fromJson(payload), signal)).toJson();
      case MethodName.ProviderSignInCommand:
        return (await this.providers.readSignInCommandAsync(ProviderIdParams.fromJson(payload)))?.toJson() ?? null;
      case MethodName.ProviderSignInCancel:
        this.providers.cancelSignIn(ProviderIdParams.fromJson(payload));
        return null;
      case MethodName.ProviderSignInList:
        return this.providers.listSignIns().toJson();
      case MethodName.ProviderSignOut:
        return (await this.providers.signOutAsync(ProviderIdParams.fromJson(payload))).toJson();
      case MethodName.ProviderProfileDiscover:
        return (await this.providers.discoverAsync(ProviderProfileDiscoverParams.fromJson(payload))).toJson();
      case MethodName.ProviderOwnMcpServerList:
        return (await this.providers.listOwnMcpServersAsync(ProviderIdParams.fromJson(payload))).toJson();
      case MethodName.ProviderDelete:
        await this.providers.deleteAsync(ProviderIdParams.fromJson(payload));
        return null;
      case MethodName.ProjectList:
        return (await this.projects.listAsync()).map(t => t.toJson());
      case MethodName.ProjectOpen:
        return (await this.projects.openAsync(ProjectOpenParams.fromJson(payload))).toJson();
      case MethodName.ProjectForget:
        await this.publishDeletedAsync(await this.projects.forgetAsync(ProjectIdParams.fromJson(payload)));
        return null;
      case MethodName.ProjectsLayoutRead:
        return await this.projects.readLayoutAsync();
      case MethodName.ProjectsLayoutSave: {
        const layout = await this.projects.saveLayoutAsync(ProjectsLayoutSaveParams.fromJson(payload));
        this.publish(new Event(EventName.ProjectsLayoutUpdated, layout));
        return layout;
      }
      case MethodName.ConversationList:
        return (await this.conversations.listAsync(ConversationListParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.ConversationListEmpty:
        return (await this.conversations.listEmptyAsync(ConversationListParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.ConversationCreate:
        return (await this.conversations.createAsync(ConversationCreateParams.fromJson(payload))).toJson();
      case MethodName.ConversationRename:
        return (await this.conversations.renameAsync(ConversationRenameParams.fromJson(payload))).toJson();
      case MethodName.ConversationTouch:
        return (await this.conversations.touchAsync(ConversationIdParams.fromJson(payload))).toJson();
      case MethodName.ConversationResponderSet:
        return (await this.engine.setResponderAsync(ConversationResponderParams.fromJson(payload))).toJson();
      case MethodName.ConversationMove: {
        const moved = await this.conversations.moveAsync(ConversationMoveParams.fromJson(payload));
        await this.engine.releaseFolderAsync(moved.id);
        return moved.toJson();
      }
      case MethodName.ConversationDelete: {
        const params = ConversationIdParams.fromJson(payload);
        await this.conversations.deleteAsync(params);
        await this.publishDeletedAsync([params.conversationId]);
        await this.engine.releaseFolderAsync(params.conversationId);
        return null;
      }
      case MethodName.ConversationFolderCount:
        return await this.conversations.countFolderFilesAsync(ConversationIdParams.fromJson(payload));
      case MethodName.ChatFolderAttach:
        return (await this.conversations.attachFolderAsync(ChatFolderAttachParams.fromJson(payload), t => this.projects.checkFolderAsync(t, null))).toJson();
      case MethodName.ChatFolderDetach:
        return (await this.conversations.detachFolderAsync(ConversationIdParams.fromJson(payload))).toJson();
      case MethodName.ConversationRewind:
        return (await this.engine.rewindAsync(ConversationRewindParams.fromJson(payload))).toJson();
      case MethodName.ConversationSearch:
        return (await this.conversations.searchAsync(ConversationSearchParams.fromJson(payload))).toJson();
      case MethodName.ChatFind:
        return (await this.conversations.findChatsAsync(ChatFindParams.fromJson(payload))).toJson();
      case MethodName.MessageSearch:
        return (await this.conversations.searchMessagesAsync(ConversationSearchParams.fromJson(payload))).toJson();
      case MethodName.MessageList:
        return (await this.messages.listAsync(MessageListParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.MessageListOpen:
        return (await this.messages.listOpenAsync()).map(t => t.toJson());
      case MethodName.MessagePage:
        return (await this.messages.pageAsync(MessagePageParams.fromJson(payload))).toJson();
      case MethodName.MessageActivityPage:
        return (await this.messages.replyPageAsync(MessagePageParams.fromJson(payload), ReplyPanel.Activity)).toJson();
      case MethodName.MessageChangesPage:
        return (await this.messages.replyPageAsync(MessagePageParams.fromJson(payload), ReplyPanel.Changes)).toJson();
      case MethodName.MessagePlanPage:
        return (await this.messages.replyPageAsync(MessagePageParams.fromJson(payload), ReplyPanel.Plan)).toJson();
      case MethodName.MessageSubAgentsPage:
        return (await this.messages.replyPageAsync(MessagePageParams.fromJson(payload), ReplyPanel.SubAgents)).toJson();
      case MethodName.MessageSummary: {
        const message = await this.messages.findAsync(MessageIdParams.fromJson(payload).messageId);
        return Object.isNull(message) ? null : ReplySummary.fromMessage(message).toJson();
      }
      case MethodName.MessageDetails: {
        const message = await this.messages.findAsync(MessageIdParams.fromJson(payload).messageId);
        return Object.isNull(message) ? null : message.withDetails(message.details.filter(t => t.kind !== DetailKind.Text)).toJson();
      }
      case MethodName.MessageDetailsAfter: {
        const params = MessageDetailsAfterParams.fromJson(payload);
        const message = await this.messages.findAsync(params.messageId);
        const changed = new Set(params.sequences);
        return Object.isNull(message) ? null : message.withDetails(message.details.filter(t => t.kind !== DetailKind.Text
          && (t.sequence > params.afterSequence || changed.has(t.sequence)))).toJson();
      }
      case MethodName.MessageSend:
        return (await this.engine.sendAsync(MessageSendParams.fromJson(payload), signal)).toJson();
      case MethodName.MessageCancel:
        return (await this.engine.cancelAsync(MessageIdParams.fromJson(payload))).toJson();
      case MethodName.MessageApprovePlan:
        return (await this.engine.approvePlanAsync(MessageIdParams.fromJson(payload))).toJson();
      case MethodName.ConversationCancel:
        return (await this.engine.cancelConversationAsync(ConversationIdParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.WaitingMessageAdd:
        return (await this.engine.addWaitingAsync(WaitingMessageAddParams.fromJson(payload))).toJson();
      case MethodName.WaitingMessageList:
        return (await this.engine.listWaitingAsync(ConversationIdParams.fromJson(payload))).toJson();
      case MethodName.WaitingMessageEdit:
        return (await this.engine.editWaitingAsync(WaitingMessageEditParams.fromJson(payload))).toJson();
      case MethodName.WaitingMessageRemove:
        await this.engine.removeWaitingAsync(WaitingMessageIdParams.fromJson(payload));
        return null;
      case MethodName.WaitingMessageSendNow:
        return (await this.engine.sendWaitingNowAsync(WaitingMessageIdParams.fromJson(payload))).toJson();
      case MethodName.ApprovalList:
        return (await this.approvals.listAsync(ConversationIdParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.ApprovalListPending:
        return (await this.approvals.listPendingAllAsync()).map(t => t.toJson());
      case MethodName.ApprovalDecide:
        return (await this.engine.decideAsync(ApprovalDecideParams.fromJson(payload))).toJson();
      case MethodName.PlanUsageList:
        return RequestDispatcher.require(this.planUsage, method).list().map(t => t.toJson());
      case MethodName.PlanUsageRead:
        return (await this.kinds.readPlanUsageAsync(PlanUsageParams.fromJson(payload)))?.toJson() ?? null;
      case MethodName.TeammateUsageList:
        return (await this.messages.listTeammateUsageAsync()).map(t => t.toJson());
      case MethodName.TeammateLastReplyList:
        return (await this.messages.listTeammateLastRepliesAsync()).map(t => t.toJson());
      case MethodName.BackgroundTaskList:
        return (await RequestDispatcher.require(this.tasks, method).pageAsync(BackgroundTaskListParams.fromJson(payload))).toJson();
      case MethodName.BackgroundTaskRead:
        return (await RequestDispatcher.require(this.tasks, method).readAsync(BackgroundTaskIdParams.fromJson(payload))).toJson();
      case MethodName.BackgroundTaskStop:
        return (await RequestDispatcher.require(this.tasks, method).stop(BackgroundTaskIdParams.fromJson(payload))).toJson();
      case MethodName.BackgroundTaskClearFinished:
        return (await RequestDispatcher.require(this.tasks, method).clearFinishedAsync(ConversationIdParams.fromJson(payload))).toJson();
      case MethodName.SubAgentStart:
        return (await this.engine.startSubAgentAsync(SubAgentStartParams.fromJson(payload))).toJson();
      case MethodName.SubAgentWait:
        return (await this.engine.waitSubAgents(SubAgentWaitParams.fromJson(payload))).toJson();
      case MethodName.SubAgentStop:
        return (await this.engine.stopSubAgent(SubAgentStopParams.fromJson(payload))).toJson();
      case MethodName.CommandStart:
        return (await this.engine.startCommandAsync(CommandStartParams.fromJson(payload))).toJson();
      case MethodName.WindowFocused:
        RequestDispatcher.require(this.windows, method).focus(WindowFocusedParams.fromJson(payload));
        return null;
      case MethodName.WindowClosed:
        RequestDispatcher.require(this.windows, method).close(WindowIdParams.fromJson(payload));
        return null;
      case MethodName.WindowReload:
        RequestDispatcher.require(this.windows, method).reload(WindowIdParams.fromJson(payload));
        return null;
      case MethodName.PanelAnswered:
        RequestDispatcher.require(this.windows, method).answer(PanelAnsweredParams.fromJson(payload));
        return null;
      default:
        throw new ServiceException(ErrorCode.UnknownMethod, Resources.formatUnknownMethod(method), [method]);
    }
  }

  private async requireContextWindow(providerId: string, model: string | null, contextWindow: number | null): Promise<void> {
    const provider = await this.providers.findAsync(providerId);
    if (Object.isNull(contextWindow) || Object.isNull(provider))
      return;
    const list = await this.kinds.modelCatalogAsync(new ProviderListModelsParams(provider.kind, provider.id));
    const windows = list.models.find(t => t.matches(model))?.contextWindows ?? null;
    if (Object.isNull(windows))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.contextWindowUnavailable, [ProtocolResources.contextWindowField]);
    if (!windows.allows(contextWindow))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatContextWindowOutOfBounds(contextWindow,
        ProviderContextWindows.nameOf(windows.minimum), ProviderContextWindows.nameOf(windows.maximum)), [ProtocolResources.contextWindowField]);
  }

  private async requireSustain(providerId: string, model: string | null, effort: string | null, sustain: boolean,
    fallbacks: readonly TeammateFallback[], usageHandOffs: readonly string[]): Promise<void> {
    const own = await this.providers.findAsync(providerId);
    const ownKind = Object.isNull(own) ? null : this.kindOf(own.kind);
    if (sustain && ownKind?.reportsLimits === false)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSustainLimitsUnread(ownKind.displayName), [ProtocolResources.sustainField]);
    if (usageHandOffs.length > 0 && ownKind?.reportsLimits === false)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSustainLimitsUnread(ownKind.displayName), [ProtocolResources.usageHandOffsField]);
    const entries = [new TeammateFallback(providerId, model, effort), ...fallbacks];
    for (const [index, entry] of fallbacks.entries()) {
      const number = index + 2;
      const provider = await this.providers.findAsync(entry.providerId);
      if (Object.isNull(provider))
        throw new ServiceException(ErrorCode.NotFound, Resources.sustainEntryProviderMissing, [ProtocolResources.fallbacksField]);
      const kind = this.kindOf(provider.kind);
      const kindName = kind?.displayName ?? provider.kind;
      if (kind?.reportsLimits !== true)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSustainEntryLimitsUnread(number, kindName), [ProtocolResources.fallbacksField]);
      const list = provider.enabled ? await this.kinds.modelCatalogAsync(new ProviderListModelsParams(provider.kind, provider.id)) : null;
      const listed = Object.isNull(entry.model) ? undefined : list?.models.find(t => t.matches(entry.model));
      if (!Object.isNull(entry.model) && !Object.isNull(list) && !list.partial && Object.isUndefined(listed))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSustainEntryModelUnlisted(entry.model, kindName), [ProtocolResources.fallbacksField]);
      const earlier = entries.findIndex(t => t.equals(entry)) + 1;
      if (earlier < number)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSustainEntryRepeated(number, earlier, `${kindName} · ${provider.label}`,
          listed?.displayName ?? entry.model, Object.isNull(entry.effort) ? null : listed?.effortNames[entry.effort] ?? null, entry.effort),
          [ProtocolResources.fallbacksField]);
    }
  }

  private kindOf(kind: string): ProviderKind | null {
    return this.kinds.list().find(t => t.id === kind) ?? null;
  }

  private async publishDeletedAsync(conversationIds: readonly string[]): Promise<void> {
    this.tasks?.forget(conversationIds);
    await this.engine.forgetAsync(conversationIds);
    this.computerUseGrants?.forget(conversationIds);
    for (const conversationId of conversationIds)
      this.publish(new Event(EventName.ConversationDeleted, new ConversationIdParams(conversationId).toJson()));
  }

  private async organizeAsync(organization: IOrganizationService, method: string, payload: JsonValue): Promise<JsonValue> {
    let result: JsonValue = null;
    switch (method) {
      case MethodName.OrganizationList:
        return (await organization.listAsync()).toJson();
      case MethodName.DepartmentCreate:
        result = (await organization.createAsync(DepartmentCreateParams.fromJson(payload))).toJson();
        break;
      case MethodName.DepartmentUpdate:
        result = (await organization.updateAsync(DepartmentUpdateParams.fromJson(payload))).toJson();
        break;
      case MethodName.DepartmentMove:
        result = (await organization.moveAsync(DepartmentMoveParams.fromJson(payload))).toJson();
        break;
      case MethodName.DepartmentDelete:
        await organization.deleteAsync(DepartmentIdParams.fromJson(payload));
        break;
      default:
        await organization.setMemberAsync(DepartmentMemberSetParams.fromJson(payload));
    }
    await this.publishOrganizationAsync(organization);
    return result;
  }

  private async publishOrganizationAsync(organization: IOrganizationService): Promise<void> {
    this.publish(new Event(EventName.OrganizationChanged, (await organization.listAsync()).toJson()));
  }

  private publish(event: Event): void {
    this.events?.publish(event);
  }

  private static require<T>(service: T | null, method: string): T {
    if (Object.isNull(service))
      throw new ServiceException(ErrorCode.UnknownMethod, Resources.formatUnknownMethod(method), [method]);
    return service;
  }
}
