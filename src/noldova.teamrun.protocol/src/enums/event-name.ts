/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum EventName {
  StateInvalidated = "StateInvalidated",
  StateResyncRequested = "StateResyncRequested",
  MessageCreated = "MessageCreated",
  MessageUpdated = "MessageUpdated",
  DetailAppended = "DetailAppended",
  DetailUpdated = "DetailUpdated",
  ReplyThinking = "ReplyThinking",
  ApprovalCreated = "ApprovalCreated",
  ApprovalUpdated = "ApprovalUpdated",
  ProviderUpdated = "ProviderUpdated",
  ProviderSignInsChanged = "ProviderSignInsChanged",
  ProviderKindInstallationChanged = "ProviderKindInstallationChanged",
  ProviderKindsChanged = "ProviderKindsChanged",
  SignInLink = "SignInLink",
  ConversationRewound = "ConversationRewound",
  ConversationDeleted = "ConversationDeleted",
  PlanUsageUpdated = "PlanUsageUpdated",
  BackgroundTaskUpdated = "BackgroundTaskUpdated",
  BackgroundTaskOutput = "BackgroundTaskOutput",
  ProjectsLayoutUpdated = "ProjectsLayoutUpdated",
  ProjectFolderChanged = "ProjectFolderChanged",
  ComposerDefaultUpdated = "ComposerDefaultUpdated",
  BackgroundTasksCleared = "BackgroundTasksCleared",
  PanelRequested = "PanelRequested",
  WindowReloadRequested = "WindowReloadRequested",
  WaitingMessagesChanged = "WaitingMessagesChanged"
}
