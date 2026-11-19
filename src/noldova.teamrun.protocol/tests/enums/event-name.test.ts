/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EventName } from "@noldova/teamrun.protocol";

@TestClass
export class EventNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("MessageCreated", EventName.MessageCreated);
    Assert.areEqual("MessageUpdated", EventName.MessageUpdated);
    Assert.areEqual("DetailAppended", EventName.DetailAppended);
    Assert.areEqual("DetailUpdated", EventName.DetailUpdated);
    Assert.areEqual("ReplyThinking", EventName.ReplyThinking);
    Assert.areEqual("ReplyCheckpointStarted", EventName.ReplyCheckpointStarted);
    Assert.areEqual("ReplyCheckpointEnded", EventName.ReplyCheckpointEnded);
    Assert.areEqual("ApprovalCreated", EventName.ApprovalCreated);
    Assert.areEqual("ApprovalUpdated", EventName.ApprovalUpdated);
    Assert.areEqual("ProviderUpdated", EventName.ProviderUpdated);
    Assert.areEqual("ProviderSignInsChanged", EventName.ProviderSignInsChanged);
    Assert.areEqual("ProviderKindInstallationChanged", EventName.ProviderKindInstallationChanged);
    Assert.areEqual("SignInLink", EventName.SignInLink);
    Assert.areEqual("ConversationRewound", EventName.ConversationRewound);
    Assert.areEqual("ConversationDeleted", EventName.ConversationDeleted);
    Assert.areEqual("BackgroundTaskUpdated", EventName.BackgroundTaskUpdated);
    Assert.areEqual("BackgroundTaskOutput", EventName.BackgroundTaskOutput);
    Assert.areEqual("ProjectsLayoutUpdated", EventName.ProjectsLayoutUpdated);
    Assert.areEqual("ProjectFolderChanged", EventName.ProjectFolderChanged);
    Assert.areEqual("ComposerDefaultUpdated", EventName.ComposerDefaultUpdated);
    Assert.areEqual("BackgroundTasksCleared", EventName.BackgroundTasksCleared);
    Assert.areEqual("PanelRequested", EventName.PanelRequested);
    Assert.areEqual("WindowReloadRequested", EventName.WindowReloadRequested);
    Assert.areEqual("WaitingMessagesChanged", EventName.WaitingMessagesChanged);
    Assert.areEqual("PlanUsageUpdated", EventName.PlanUsageUpdated);
    Assert.areEqual("ProviderKindsChanged", EventName.ProviderKindsChanged);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(EventName);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
