/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  AbilityCell,
  AbilitySource,
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  type BackgroundTask,
  BackgroundTaskPage,
  ApprovalScope,
  ApprovalStatus,
  AttachmentInput,
  AuthStatus,
  ChatIdParams,
  ChatResponderParams,
  ComposerDefaultSaveParams,
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  type Department,
  DetailKind,
  Draft,
  DraftSaveParams,
  Message,
  MessageAttachment,
  MessageAuthor,
  MessageDetail,
  MessagePage,
  MessageStatus,
  MethodName,
  ObservedSettings,
  Organization,
  OrganizationLayoutSaveParams,
  Project,
  ProjectListing,
  ProjectsLayoutSaveParams,
  Provenance,
  Provider,
  ProviderAbilities,
  ProviderAbility,
  ProviderProfileDiscovery,
  ProviderSignIns,
  ProviderKind,
  ProviderProfile,
  ProviderMode,
  ProviderModel,
  ProviderModelList,
  RequestedSettings,
  Resources as ProtocolResources,
  type TeammatePlacement,
  WaitingMessagesPayload
} from "@noldova/teamrun.protocol";

import { FakeWindowPartContext } from "./fake-window-part-context.fixture";

export class SampleData {
  public static readonly timestamp: string = "2026-09-10T08:00:00.000Z";
  public static readonly touchedAt: string = "2026-09-20T08:00:00.000Z";
  public static readonly codex: ProviderKind = new ProviderKind("codex", "Codex", true, false, null,
    new ProviderProfile("CODEX_HOME", null, "D:\\profiles\\codex")).withNamesChats(true);
  public static readonly claude: ProviderKind = new ProviderKind("claude", "Claude Code", true);
  public static readonly provider: Provider =
    new Provider("a1", "codex", "Work", "D:\\profiles\\codex", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp);
  public static readonly project: Project = new Project("p1", "repo", "D:\\repo", SampleData.timestamp);
  public static readonly otherProject: Project = new Project("p2", "other", "D:\\other", SampleData.timestamp);
  public static readonly conversation: Conversation = new Conversation("c1", "p1", "First", SampleData.timestamp, SampleData.timestamp);
  public static readonly userMessage: Message =
    new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "hello")], null, SampleData.timestamp, null,
      SampleData.timestamp);
  public static readonly provenance: Provenance =
    new Provenance("a1", new RequestedSettings("codex", "gpt-5", "high"), new ObservedSettings("codex", "gpt-5", null, "1.0"), "s1", false);
  public static readonly reply: Message =
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
  public static readonly approval: Approval = new Approval(
    "ap1",
    "m2",
    ApprovalKind.Command,
    "exec",
    "run tests",
    null,
    [new ApprovalOption("yes", "Approve", ApprovalOutcome.Approved, ApprovalScope.Once), new ApprovalOption("no", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once)],
    ApprovalStatus.Pending,
    null,
    SampleData.timestamp,
    null);

  public static organizationOf(departments: readonly Department[], placements: readonly TeammatePlacement[]): Organization {
    return new Organization(ProtocolResources.defaultOrganizationId, "My organization", null, 0, SampleData.timestamp, SampleData.timestamp, departments, placements);
  }

  public static abilities(overrides: Partial<Record<ProviderAbility, AbilityCell>> = {}): ProviderAbilities {
    return ProviderAbilities.fromJson({ [ProtocolResources.cellsField]: Object.fromEntries(Object.values(ProviderAbility)
      .map(t => [t, (overrides[t] ?? AbilityCell.works(AbilitySource.Acp)).toJson()])) });
  }

  public static detail(sequence: number, kind: DetailKind, text: string): MessageDetail {
    return new MessageDetail(sequence, kind, text, null, SampleData.timestamp);
  }

  public static page(messages: readonly Message[], hasEarlier: boolean, hasLater: boolean): MessagePage {
    return new MessagePage(messages, hasEarlier, hasLater, Math.max(-1, ...messages.map(t => t.sequence)) + 1);
  }

  public static tasks(tasks: readonly BackgroundTask[], hasLater: boolean = false,
    count: number = tasks.filter(t => !t.isRunning && Object.isNull(t.subAgentId)).length): JsonValue {
    return new BackgroundTaskPage(tasks, hasLater, count).toJson();
  }

  public static listed(project: Project, folderMissing: boolean = false): JsonValue {
    return new ProjectListing(project, folderMissing).toJson();
  }

  public static savedDraft(params: DraftSaveParams, revision: number): Draft {
    const directory = `D:/data/attachments/drafts/${params.conversationId}/`;
    const attachments = params.attachments.map(t =>
      new MessageAttachment(t.name, t.mediaType, 0, t.path?.startsWith(directory) ? t.path : `${directory}${t.name}`));
    return new Draft(params.conversationId, params.text, attachments, [], revision, SampleData.timestamp);
  }

  public static keepCreatedEmpty(context: FakeWindowPartContext, create: (parameters: JsonValue) => Conversation): FakeWindowPartContext {
    const created: Conversation[] = [];
    return context
      .answer(MethodName.ConversationCreate, t => {
        const chat = create(t);
        created.push(chat);
        return chat.toJson();
      })
      .answer(MethodName.ConversationListEmpty, t => created.filter(u => u.projectId === ConversationListParams.fromJson(t).projectId).map(u => u.toJson()))
      .answer(MethodName.ConversationTouch, t => SampleData.touched(created.find(u => u.id === ConversationIdParams.fromJson(t).conversationId)!).toJson());
  }

  public static touched(conversation: Conversation): Conversation {
    return conversation.withTitle(conversation.title, SampleData.touchedAt);
  }

  public static createContext(): FakeWindowPartContext {
    let revision = 0;
    return new FakeWindowPartContext()
      .answer(MethodName.DraftRead, () => null)
      .answer(MethodName.DraftSave, t => SampleData.savedDraft(DraftSaveParams.fromJson(t), ++revision).toJson())
      .answer(MethodName.DraftDiscard, () => null)
      .answer(MethodName.ReadingPositionList, () => [])
      .answer(MethodName.ReadingPositionSave, () => null)
      .answer(MethodName.RunOutputList, () => [])
      .answer(MethodName.RunOutputSave, () => null)
      .answer(MethodName.AttachmentPrepare, t => {
        const input = AttachmentInput.fromJson(t);
        return new MessageAttachment(input.name, input.mediaType, 0, `D:/data/attachments/drafts/${input.name}`).toJson();
      })
      .answer(MethodName.AttachmentDiscard, () => null)
      .answer(MethodName.ProviderKindList, () => [SampleData.codex.toJson(), SampleData.claude.toJson()])
      .answer(MethodName.ProviderList, () => [SampleData.provider.toJson()])
      .answer(MethodName.ProviderSignInList, () => new ProviderSignIns([]).toJson())
      .answer(MethodName.ProviderProfileDiscover, () => new ProviderProfileDiscovery([]).toJson())
      .answer(MethodName.TeammateList, () => [])
      .answer(MethodName.DefaultTeammateRead, () => null)
      .answer(MethodName.BackgroundTaskList, () => SampleData.tasks([]))
      .answer(MethodName.ConversationListMembers, () => [])
      .answer(MethodName.WaitingMessageList, t => new WaitingMessagesPayload(ChatIdParams.fromJson(t).chatId, []).toJson())
      .answer(MethodName.ConversationResponderSet, t => SampleData.conversation.withResponder(ChatResponderParams.fromJson(t).responder).toJson())
      .answer(MethodName.ConversationListEmpty, () => [])
      .answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project)])
      .answer(MethodName.ProjectsLayoutRead, () => null)
      .answer(MethodName.ProjectsLayoutSave, t => ProjectsLayoutSaveParams.fromJson(t).layout)
      .answer(MethodName.OrganizationLayoutRead, () => null)
      .answer(MethodName.OrganizationLayoutSave, t => OrganizationLayoutSaveParams.fromJson(t).layout)
      .answer(MethodName.ComposerDefaultRead, () => null)
      .answer(MethodName.ComposerDefaultSave, t => ComposerDefaultSaveParams.fromJson(t).choice)
      .answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [])
      .answer(MethodName.MessagePage, () => SampleData.page([SampleData.userMessage, SampleData.reply], false, false).toJson())
      .answer(MethodName.MessageListOpen, () => [])
      .answer(MethodName.ApprovalListPending, () => [])
      .answer(MethodName.ProviderKindInstallationList, () => [])
      .answer(MethodName.PlanUsageList, () => [])
      .answer(MethodName.PlanUsageRead, () => null)
      .answer(MethodName.TeammateUsageList, () => [])
      .answer(MethodName.ApprovalList, () => [SampleData.approval.toJson()])
      .answerModule("terminal.sessions", () => ({ sessions: [] }))
      .answerModule("terminal.closeOwner", () => null)
      .answerModule("terminal.showOwner", () => null)
      .answerModule("computer-use.borderColorSet", () => null)
      .answer(MethodName.ProviderModelCatalog, () => SampleData.catalog(["gpt-5", "gpt-5-mini"].map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true))));
  }

  public static catalog(models: readonly ProviderModel[], signedIn: boolean | null = true, empty: boolean = false, planName: string | null = null,
    awaitsTurn: boolean = false, modes: readonly ProviderMode[] = [], defaultMode: string | null = null, defaultTakesListedEfforts: boolean = false,
    planMode: string | null = null): JsonObject {
    return new ProviderModelList(models, signedIn, empty, planName, awaitsTurn, modes, defaultMode, defaultTakesListedEfforts, planMode).toJson();
  }

  public static withStatus(message: Message, status: MessageStatus, details: readonly MessageDetail[] = message.details): Message {
    const active = status === MessageStatus.Pending || status === MessageStatus.Running || status === MessageStatus.AwaitingApproval;
    const endedAt = active ? null : SampleData.timestamp;
    const startedAt = message.author !== MessageAuthor.Provider || status === MessageStatus.Pending ? null : message.startedAt ?? message.createdAt;
    return new Message(message.id, message.conversationId, message.sequence, message.author, message.inReplyTo, status, details, message.provenance,
      message.createdAt, startedAt, endedAt);
  }
}
