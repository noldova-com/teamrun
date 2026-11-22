/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import * as api from "@noldova/teamrun.protocol";

@TestClass
export class ProtocolApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.isDefined(api.AcpAgentEntry);
    Assert.isDefined(api.AcpAgentIdParams);
    Assert.isDefined(api.AcpAgentListing);
    Assert.isDefined(api.AcpLocalCommandAddParams);
    Assert.isDefined(api.ProviderSignInCommand);
    Assert.isDefined(api.Teammate);
    Assert.isDefined(api.TeammateUsage);
    Assert.isDefined(api.TeammateLastReply);
    Assert.isDefined(api.TeammateWork);
    Assert.isDefined(api.TeammateDocument);
    Assert.isDefined(api.TeammateCreateParams);
    Assert.isDefined(api.TeammateUpdateParams);
    Assert.isDefined(api.TeammateIdParams);
    Assert.isDefined(api.Department);
    Assert.isDefined(api.DepartmentMember);
    Assert.isDefined(api.NodeType);
    Assert.isDefined(api.NodeTypeCreateParams);
    Assert.isDefined(api.NodeTypeUpdateParams);
    Assert.isDefined(api.NodeTypeIdParams);
    Assert.isDefined(api.Organization);
    Assert.isDefined(api.DepartmentCreateParams);
    Assert.isDefined(api.DepartmentUpdateParams);
    Assert.isDefined(api.DepartmentMoveParams);
    Assert.isDefined(api.DepartmentIdParams);
    Assert.isDefined(api.DepartmentMemberSetParams);
    Assert.isDefined(api.OrganizationIdParams);
    Assert.isDefined(api.OrganizationCreateParams);
    Assert.isDefined(api.OrganizationUpdateParams);
    Assert.isDefined(api.TeammatePlaceParams);
    Assert.isDefined(api.OrganizationNodeKind);
    Assert.isDefined(api.OrganizationParent);
    Assert.isDefined(api.TeammatePlacement);
    Assert.isDefined(api.OrganizationTargetKind);
    Assert.isDefined(api.OrganizationTarget);
    Assert.isDefined(api.ChatMemberParams);
    Assert.isDefined(api.ChatMember);
    Assert.isDefined(api.TeammateMention);
    Assert.isDefined(api.Harness);
    Assert.isDefined(api.SharedMcpTransport);
    Assert.isDefined(api.SharedMcpAccount);
    Assert.isDefined(api.SharedMcpSetting);
    Assert.isDefined(api.SharedMcpHeader);
    Assert.isDefined(api.SharedMcpSignIn);
    Assert.isDefined(api.SharedMcpSignInStarted);
    Assert.isDefined(api.SharedMcpServerDefinition);
    Assert.isDefined(api.SharedMcpTeammateSetting);
    Assert.isDefined(api.SharedMcpServer);
    Assert.isDefined(api.SharedMcpUnavailability);
    Assert.isDefined(api.SharedMcpServerListing);
    Assert.isDefined(api.SharedMcpServerIdParams);
    Assert.isDefined(api.SharedMcpServerUpdateParams);
    Assert.isDefined(api.SharedMcpProviderSetParams);
    Assert.isDefined(api.SharedMcpTeammateSetParams);
    Assert.isDefined(api.TeammateName);
    Assert.isDefined(api.NameOrder);
    Assert.isDefined(api.TextCut);
    Assert.isDefined(api.ProfileFolderName);
    Assert.isDefined(api.ProfileFolderPath);
    Assert.isDefined(api.DiscoveredProfile);
    Assert.isDefined(api.ProviderProfileDiscoverParams);
    Assert.isDefined(api.ProviderProfileDiscovery);
    Assert.isDefined(api.SenderEnvironment);
    Assert.isDefined(api.McpServer);
    Assert.isDefined(api.McpToolListParams);
    Assert.isDefined(api.McpToolCallParams);
    Assert.isDefined(api.OwnMcpServerState);
    Assert.isDefined(api.OwnMcpServer);
    Assert.isDefined(api.ProviderMcpServerList);
    Assert.isDefined(api.MessageSender);
    Assert.isDefined(api.MentionResolver);
    Assert.isDefined(api.MentionSpan);
    Assert.isDefined(api.MentionToken);
    Assert.isDefined(api.RoleApplication);
    Assert.isDefined(api.ReplyAction);
    Assert.isDefined(api.Approval);
    Assert.isDefined(api.ApprovalDecideParams);
    Assert.isDefined(api.ApprovalKind);
    Assert.isDefined(api.ApprovalOption);
    Assert.isDefined(api.ApprovalQuestion);
    Assert.isDefined(api.ApprovalOutcome);
    Assert.isDefined(api.ApprovalScope);
    Assert.isDefined(api.PermissionDetail);
    Assert.isDefined(api.PermissionDetailKind);
    Assert.isDefined(api.PermissionPayload);
    Assert.isDefined(api.PermissionRisk);
    Assert.isDefined(api.ApprovalStatus);
    Assert.isDefined(api.QuestionAnswer);
    Assert.isDefined(api.QuestionOption);
    Assert.isDefined(api.PlanStep);
    Assert.isDefined(api.ReplyPlan);
    Assert.isDefined(api.SubAgent);
    Assert.isDefined(api.SubAgentStatus);
    Assert.isDefined(api.SubAgentStartParams);
    Assert.isDefined(api.CommandStartParams);
    Assert.isDefined(api.SubAgentStopParams);
    Assert.isDefined(api.SubAgentWaitParams);
    Assert.isDefined(api.SubAgentWaitResult);
    Assert.isDefined(api.BackgroundTask);
    Assert.isDefined(api.BackgroundTaskIdParams);
    Assert.isDefined(api.BackgroundTaskListParams);
    Assert.isDefined(api.BackgroundTaskPage);
    Assert.isDefined(api.BackgroundTaskOutputPayload);
    Assert.isDefined(api.BackgroundTasksClearedPayload);
    Assert.isDefined(api.MessageSendingPayload);
    Assert.isDefined(api.MessageSendAbandonedPayload);
    Assert.isDefined(api.BackgroundTaskStatus);
    Assert.isDefined(api.MessageDelivery);
    Assert.isDefined(api.WaitingMessage);
    Assert.isDefined(api.WaitingMessagesPayload);
    Assert.isDefined(api.WaitingMessageAddParams);
    Assert.isDefined(api.WaitingMessageEditParams);
    Assert.isDefined(api.WaitingMessageIdParams);
    Assert.isDefined(api.ContextUsage);
    Assert.isDefined(api.PlanUsage);
    Assert.isDefined(api.PlanUsageParams);
    Assert.isDefined(api.PlanWindow);
    Assert.isDefined(api.PlanWindowName);
    Assert.isDefined(api.PlanStepStatus);
    Assert.isDefined(api.ReplyUsage);
    Assert.isDefined(api.AuthStatus);
    Assert.isDefined(api.ProviderKindInstallState);
    Assert.isDefined(api.Chat);
    Assert.isDefined(api.ChatCreateParams);
    Assert.isDefined(api.ChatIdParams);
    Assert.isDefined(api.ChatRenameParams);
    Assert.isDefined(api.ChatRewindParams);
    Assert.isDefined(api.ChatRewindResult);
    Assert.isDefined(api.ChatSearchHit);
    Assert.isDefined(api.ChatSearchParams);
    Assert.isDefined(api.ChatSearchResult);
    Assert.isDefined(api.ChatFindHit);
    Assert.isDefined(api.ChatFindParams);
    Assert.isDefined(api.ChatFolderAttachParams);
    Assert.isDefined(api.ChatFindResult);
    Assert.isDefined(api.MessageSearchHit);
    Assert.isDefined(api.MessageSearchResult);
    Assert.isDefined(api.ChatRewoundPayload);
    Assert.isDefined(api.SignInLinkPayload);
    Assert.isDefined(api.PanelRequestedPayload);
    Assert.isDefined(api.WindowFocusedParams);
    Assert.isDefined(api.WindowIdParams);
    Assert.isDefined(api.PanelAnsweredParams);
    Assert.isDefined(api.DetailEventPayload);
    Assert.isDefined(api.DetailKind);
    Assert.isDefined(api.ErrorCode);
    Assert.isDefined(api.Event);
    Assert.isDefined(api.EventName);
    Assert.isDefined(api.Hello);
    Assert.isDefined(api.DataFolder);
    Assert.isDefined(api.FirstLaunch);
    Assert.isDefined(api.Message);
    Assert.isDefined(api.AttachmentInput);
    Assert.isDefined(api.MessageAttachment);
    Assert.isDefined(api.AttachmentContent);
    Assert.isDefined(api.AttachmentShare);
    Assert.isDefined(api.AttachmentReadParams);
    Assert.isDefined(api.WrittenImageReadParams);
    Assert.isDefined(api.LinkedPaths);
    Assert.isDefined(api.Draft);
    Assert.isDefined(api.DraftDiscardParams);
    Assert.isDefined(api.DraftSaveParams);
    Assert.isDefined(api.ChatPosition);
    Assert.isDefined(api.ReadingPositionSaveParams);
    Assert.isDefined(api.RunOutput);
    Assert.isDefined(api.MessageAuthor);
    Assert.isDefined(api.MessageDetail);
    Assert.isDefined(api.MessageDetailsAfterParams);
    Assert.isDefined(api.MessageIdParams);
    Assert.isDefined(api.MessageListParams);
    Assert.isDefined(api.MessageSendParams);
    Assert.isDefined(api.MessageSendResult);
    Assert.isDefined(api.MessageStatus);
    Assert.isDefined(api.MethodName);
    Assert.isDefined(api.ReplySummary);
    Assert.isDefined(api.ReplyPage);
    Assert.isDefined(api.ReplyPanel);
    Assert.isDefined(api.PanelName);
    Assert.isDefined(api.PanelOutcome);
    Assert.isDefined(api.FileChangeSummary);
    Assert.isDefined(api.FileChangeReader);
    Assert.isDefined(api.WrittenImageReader);
    Assert.isDefined(api.FileEdit);
    Assert.isDefined(api.DiffLine);
    Assert.isDefined(api.DiffLineKind);
    Assert.isDefined(api.ObservedSettings);
    Assert.isDefined(api.Project);
    Assert.isDefined(api.ProjectIdParams);
    Assert.isDefined(api.ChatListParams);
    Assert.isDefined(api.ProjectOpenParams);
    Assert.isDefined(api.ProtocolVersion);
    Assert.isDefined(api.Provenance);
    Assert.isDefined(api.Provider);
    Assert.isDefined(api.ProviderCreateParams);
    Assert.isDefined(api.ProviderIdParams);
    Assert.isDefined(api.ProviderSignIns);
    Assert.isDefined(api.ProviderIdentity);
    Assert.isDefined(api.ProviderUpdateParams);
    Assert.isDefined(api.ProviderEnabledParams);
    Assert.isDefined(api.ProviderKind);
    Assert.isDefined(api.ProviderAbility);
    Assert.isDefined(api.AbilityAnswer);
    Assert.isDefined(api.AbilitySource);
    Assert.isDefined(api.AbilityCell);
    Assert.isDefined(api.ProviderAbilities);
    Assert.isDefined(api.ProviderProfile);
    Assert.isDefined(api.ProviderKindParams);
    Assert.isDefined(api.ProviderKindInstallation);
    Assert.isDefined(api.ProviderTool);
    Assert.isDefined(api.ProviderModel);
    Assert.isDefined(api.ProviderListModelsParams);
    Assert.isDefined(api.Request);
    Assert.isDefined(api.RequestedSettings);
    Assert.isDefined(api.Resources);
    Assert.isDefined(api.Response);
    Assert.isDefined(api.WireDecoder);
    Assert.isDefined(api.WireMessage);
    Assert.isDefined(api.WireMessageKind);
  }

  @TestMethod
  public keepsEachEarlierChatNameAsTheSameExport(): void {
    const same = (earlier: unknown, current: unknown): boolean => earlier === current && !Object.isUndefined(current);
    const kept = [
      same(api.Conversation, api.Chat), same(api.ConversationResponder, api.ChatResponder), same(api.ConversationCreateParams, api.ChatCreateParams),
      same(api.ConversationIdParams, api.ChatIdParams), same(api.ConversationListParams, api.ChatListParams),
      same(api.ConversationMoveParams, api.ChatMoveParams), same(api.ConversationRenameParams, api.ChatRenameParams),
      same(api.ConversationResponderParams, api.ChatResponderParams), same(api.ConversationRewindParams, api.ChatRewindParams),
      same(api.ConversationRewindResult, api.ChatRewindResult), same(api.ConversationSearchHit, api.ChatSearchHit),
      same(api.ConversationSearchParams, api.ChatSearchParams), same(api.ConversationSearchResult, api.ChatSearchResult),
      same(api.ConversationRewoundPayload, api.ChatRewoundPayload), same(api.ConversationPosition, api.ChatPosition),
      same(api.ConversationMemberParams, api.ChatMemberParams), same(api.ConversationMember, api.ChatMember)
    ];

    Assert.areEqual(kept.length, kept.filter(t => t).length);
    Assert.areEqual(api.Resources.invalidChatResponder, api.Resources.invalidConversationResponder);
    Assert.areEqual(api.Resources.panelChatMismatch, api.Resources.panelConversationMismatch);
    Assert.areEqual("chatId,shownChatId,chat", [api.Resources.conversationIdField, api.Resources.shownConversationIdField, api.Resources.conversationField].join(","));
  }

  @TestMethod
  public readsEachEarlierChatFieldFromItsNewName(): void {
    const earlier = (prototype: object, name: string, field: string): unknown =>
      Object.getOwnPropertyDescriptor(prototype, name)?.get?.call({ [field]: "c1" });
    const models = [
      api.AttachmentReadParams, api.BackgroundTask, api.BackgroundTaskOutputPayload, api.BackgroundTasksClearedPayload, api.ChatIdParams, api.ChatMember,
      api.ChatMemberParams, api.ChatMoveParams, api.ChatPosition, api.ChatRenameParams, api.ChatResponderParams, api.ChatRewindParams, api.ChatRewoundPayload,
      api.ChatSearchHit, api.Draft, api.DraftDiscardParams, api.DraftSaveParams, api.Message, api.MessageListParams, api.MessagePageParams, api.MessageSender,
      api.MessageSendParams, api.PanelRequestedPayload, api.TeammateUsage, api.WrittenImageReadParams
    ];

    Assert.areEqual(models.map(() => "c1").join(","), models.map(t => String(earlier(t.prototype, "conversationId", "chatId"))).join(","));
    Assert.areEqual("c1", earlier(api.WindowFocusedParams.prototype, "shownConversationId", "shownChatId"));
    Assert.areEqual("c1", earlier(api.ChatRewindResult.prototype, "conversation", "chat"));
  }
}
