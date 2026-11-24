/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/teamrun.core";

@TestClass
export class CoreApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "ActiveRun", "ChatTitles", "ConversationTitle", "TitleModel", "ApprovalAsk", "ApprovalScopesMigration", "BackgroundTasksMigration", "ApprovalsService", "AttachmentStore", "BackgroundTasksService", "ChangeEntity", "DenyingTurn", "CommandExit", "ConversationEngine", "ConversationsService", "DatabaseContext", "DraftsMigration",
      "DraftsService", "EventHub", "EventSubscription", "ForgottenSessionsMigration", "ForkRequest", "GitIgnores", "Guid", "ChatSummary", "Handover", "HandoverHistory", "HandoverNote", "HandoverPrompt", "HandoverSummary", "HandoverSummaryKindsMigration", "CheckpointFoldersMigration", "HandoverTurn", "ImageSize", "ImageSizeReader", "InitialMigration", "McpEndpoint", "MessagesService", "MigrationCatalog", "ParticipantContext", "PermissionAnswer", "PermissionAsk", "PlanReading", "PlanUsageService", "PreferencesMigration", "ProfileSearch", "ProjectlessConversationsMigration", "ProviderNamesMigration", "ProviderKindVersions", "RenamedJsonField",
        "ProjectActivity", "ProjectImageReader", "ProjectsService", "ProvidersService", "ProviderKindRegistry",
      "ProviderKindsService", "OrganizationChatOpening", "OutsideReply", "OutsideReplyState", "QuestionAsk", "SendAllowance", "QueuedAnswer", "ReadingPositionsMigration", "RunOutputsMigration", "MessageTextMigration", "ReadingPositionsService", "ReplyCheckpoints", "ReplyCheckpointsMigration", "ReplyIdentityMigration", "WaitingMessagesMigration", "WaitingFolder", "MemberToken", "MemberTokens", "ReplyRun", "ReplyWork", "ReportedSharedMcpFailures", "RequestDispatcher", "Resources", "SendAsk", "SessionTokens", "SharedImages", "SharedMcpAccess", "SharedMcpFailure", "SharedMcpFailureKind", "SharedMcpRefusal", "SharedMcpSelection", "SharedMcpServersMigration", "SharedMcpServersService", "SharedMcpValues", "SignInCheck", "StoppedCommands", "TeammateCommand", "TaskEnd", "TaskStart", "TeammatesMigration", "TeammatesService", "OrganizationService", "DepartmentsMigration", "OrganizationMessagesMigration", "OrganizationMessagesDropMigration", "UniqueIndexNamesMigration", "NodeTypesMigration", "TeammatePlacementsMigration", "OrganizationsMigration", "TeammateLastRepliesMigration", "TimeoutException", "CoreException", "ApprovalNotDeniableException", "OwnSummaryUnansweredException", "GuidFormatException", "ToolCallRecord",
      "TurnDetail", "TurnOutcome", "TurnRequest", "TurnResult", "TurnStart", "TurnSteer", "TurnTools", "TurnWake", "UsageLimit", "WakeTurn", "AccountLimitsMigration", "SustainAttemptsMigration", "SustainAttemptReasonsMigration", "HandoverSummariesMigration", "SummaryTurn", "TitleTurn", "AccountLimits", "SustainRouter",
      "CheckpointRestore", "ChatFolders", "AcpAgentOffer", "AcpAgentsMigration", "AcpAgentsService", "AcpStoredAgent", "ChatNamesMigration", "ChatLayoutNamesMigration", "ChatWakesMigration", "ChatTitlesMigration", "ComputerUseGrantsService", "ComputerUseGrantTimings", "NodeTimer", "AppLook", "RememberedAppGrant", "ReplyEvidence", "WindowsService", "WorkFolder", "WorkingTreeChange", "CommandWrites", "ToolWindows", "FileSnapshot", "DiffRun", "FolderProbe", "FolderState", "SessionCarry", "FolderCheckTimings"
    ];
    Assert.areEqual(expected.sort().join(","), Object.keys(api).sort().join(","));
  }
}
