/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlMigration } from "@noldova/context.data.sql";

import { AccountLimitsMigration } from "../../models/migrations/account-limits-migration.js";
import { SustainAttemptReasonsMigration } from "../../models/migrations/sustain-attempt-reasons-migration.js";
import { SustainAttemptsMigration } from "../../models/migrations/sustain-attempts-migration.js";
import { AcpAgentsMigration } from "../../models/migrations/acp-agents-migration.js";
import { ApprovalScopesMigration } from "../../models/migrations/approval-scopes-migration.js";
import { BackgroundTasksMigration } from "../../models/migrations/background-tasks-migration.js";
import { ChatLayoutNamesMigration } from "../../models/migrations/chat-layout-names-migration.js";
import { ChatNamesMigration } from "../../models/migrations/chat-names-migration.js";
import { ChatTitlesMigration } from "../../models/migrations/chat-titles-migration.js";
import { ChatWakesMigration } from "../../models/migrations/chat-wakes-migration.js";
import { DraftsMigration } from "../../models/migrations/drafts-migration.js";
import { ForgottenSessionsMigration } from "../../models/migrations/forgotten-sessions-migration.js";
import { InitialMigration } from "../../models/migrations/initial-migration.js";
import { PreferencesMigration } from "../../models/migrations/preferences-migration.js";
import { ProjectlessConversationsMigration } from "../../models/migrations/projectless-conversations-migration.js";
import { ProviderNamesMigration } from "../../models/migrations/provider-names-migration.js";
import { ReadingPositionsMigration } from "../../models/migrations/reading-positions-migration.js";
import { ReplyIdentityMigration } from "../../models/migrations/reply-identity-migration.js";
import { ReplyCheckpointsMigration } from "../../models/migrations/reply-checkpoints-migration.js";
import { SharedMcpServersMigration } from "../../models/migrations/shared-mcp-servers-migration.js";
import { TeammatesMigration } from "../../models/migrations/teammates-migration.js";
import { RunOutputsMigration } from "../../models/migrations/run-outputs-migration.js";
import { MessageTextMigration } from "../../models/migrations/message-text-migration.js";
import { WaitingMessagesMigration } from "../../models/migrations/waiting-messages-migration.js";
import { HandoverSummariesMigration } from "../../models/migrations/handover-summaries-migration.js";
import { HandoverSummaryKindsMigration } from "../../models/migrations/handover-summary-kinds-migration.js";
import { CheckpointFoldersMigration } from "../../models/migrations/checkpoint-folders-migration.js";
import { DepartmentsMigration } from "../../models/migrations/departments-migration.js";
import { NodeTypesMigration } from "../../models/migrations/node-types-migration.js";
import { OrganizationMessagesDropMigration } from "../../models/migrations/organization-messages-drop-migration.js";
import { OrganizationMessagesMigration } from "../../models/migrations/organization-messages-migration.js";
import { TeammateLastRepliesMigration } from "../../models/migrations/teammate-last-replies-migration.js";
import { TeammatePlacementsMigration } from "../../models/migrations/teammate-placements-migration.js";
import { OrganizationsMigration } from "../../models/migrations/organizations-migration.js";
import { UniqueIndexNamesMigration } from "../../models/migrations/unique-index-names-migration.js";
import { OrganizationChatFoldersMigration } from "../../models/migrations/organization-chat-folders-migration.js";

export class MigrationCatalog {
  public static readonly all: readonly SqlMigration[] = [new InitialMigration(), new TeammatesMigration(), new DraftsMigration(), new ApprovalScopesMigration(),
    new ForgottenSessionsMigration(), new PreferencesMigration(), new ReadingPositionsMigration(), new ProviderNamesMigration(),
    new ReplyCheckpointsMigration(), new ProjectlessConversationsMigration(), new SharedMcpServersMigration(),
    new ChatTitlesMigration(), new ChatNamesMigration(), new ChatLayoutNamesMigration(), new ChatWakesMigration(),
    new BackgroundTasksMigration(), new AcpAgentsMigration(), new ReplyIdentityMigration(),
    new WaitingMessagesMigration(), new RunOutputsMigration(),
    new MessageTextMigration(), new AccountLimitsMigration(), new SustainAttemptsMigration(),
    new SustainAttemptReasonsMigration(), new HandoverSummariesMigration(), new HandoverSummaryKindsMigration(),
    new CheckpointFoldersMigration(), new DepartmentsMigration(),
    new OrganizationMessagesMigration(), new TeammateLastRepliesMigration(), new TeammatePlacementsMigration(),
    new OrganizationMessagesDropMigration(), new OrganizationsMigration(), new UniqueIndexNamesMigration(), new NodeTypesMigration(),
    new OrganizationChatFoldersMigration()];
}
