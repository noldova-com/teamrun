/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MethodName } from "@noldova/teamrun.protocol";

@TestClass
export class MethodNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("ProviderKindList", MethodName.ProviderKindList);
    Assert.areEqual("ProviderListModels", MethodName.ProviderListModels);
    Assert.areEqual("ProviderList", MethodName.ProviderList);
    Assert.areEqual("ProviderCreate", MethodName.ProviderCreate);
    Assert.areEqual("ProviderUpdate", MethodName.ProviderUpdate);
    Assert.areEqual("ProviderSetEnabled", MethodName.ProviderSetEnabled);
    Assert.areEqual("ProviderCheck", MethodName.ProviderCheck);
    Assert.areEqual("ProviderSignIn", MethodName.ProviderSignIn);
    Assert.areEqual("ProviderSignInCancel", MethodName.ProviderSignInCancel);
    Assert.areEqual("ProviderSignInList", MethodName.ProviderSignInList);
    Assert.areEqual("ProviderSignInCommand", MethodName.ProviderSignInCommand);
    Assert.areEqual("AcpAgentList", MethodName.AcpAgentList);
    Assert.areEqual("AcpAgentIcon", MethodName.AcpAgentIcon);
    Assert.areEqual("AcpAgentAdd", MethodName.AcpAgentAdd);
    Assert.areEqual("AcpLocalCommandAdd", MethodName.AcpLocalCommandAdd);
    Assert.areEqual("AcpAgentRemove", MethodName.AcpAgentRemove);
    Assert.areEqual("ProviderSignOut", MethodName.ProviderSignOut);
    Assert.areEqual("ProviderOwnMcpServerList", MethodName.ProviderOwnMcpServerList);
    Assert.areEqual("ProviderProfileDiscover", MethodName.ProviderProfileDiscover);
    Assert.areEqual("ProviderKindInstallationList", MethodName.ProviderKindInstallationList);
    Assert.areEqual("ProviderToolList", MethodName.ProviderToolList);
    Assert.areEqual("ProviderKindInstall", MethodName.ProviderKindInstall);
    Assert.areEqual("ProviderKindInstallCancel", MethodName.ProviderKindInstallCancel);
    Assert.areEqual("ProviderDelete", MethodName.ProviderDelete);
    Assert.areEqual("ProjectList", MethodName.ProjectList);
    Assert.areEqual("ProjectOpen", MethodName.ProjectOpen);
    Assert.areEqual("ProjectForget", MethodName.ProjectForget);
    Assert.areEqual("ProjectsLayoutRead", MethodName.ProjectsLayoutRead);
    Assert.areEqual("ProjectsLayoutSave", MethodName.ProjectsLayoutSave);
    Assert.areEqual("ConversationList", MethodName.ConversationList);
    Assert.areEqual("ConversationListEmpty", MethodName.ConversationListEmpty);
    Assert.areEqual("ConversationCreate", MethodName.ConversationCreate);
    Assert.areEqual("ConversationRename", MethodName.ConversationRename);
    Assert.areEqual("ConversationTouch", MethodName.ConversationTouch);
    Assert.areEqual("ConversationResponderSet", MethodName.ConversationResponderSet);
    Assert.areEqual("DefaultTeammateRead", MethodName.DefaultTeammateRead);
    Assert.areEqual("DefaultTeammateSet", MethodName.DefaultTeammateSet);
    Assert.areEqual("ComposerDefaultRead", MethodName.ComposerDefaultRead);
    Assert.areEqual("ComposerDefaultSave", MethodName.ComposerDefaultSave);
    Assert.areEqual("ConversationDelete", MethodName.ConversationDelete);
    Assert.areEqual("ConversationFolderCount", MethodName.ConversationFolderCount);
    Assert.areEqual("ConversationRewind", MethodName.ConversationRewind);
    Assert.areEqual("ConversationSearch", MethodName.ConversationSearch);
    Assert.areEqual("ChatFind", MethodName.ChatFind);
    Assert.areEqual("ChatFolderAttach", MethodName.ChatFolderAttach);
    Assert.areEqual("ChatFolderDetach", MethodName.ChatFolderDetach);
    Assert.areEqual("MessageSearch", MethodName.MessageSearch);
    Assert.areEqual("MessageList", MethodName.MessageList);
    Assert.areEqual("MessageSend", MethodName.MessageSend);
    Assert.areEqual("MessageCancel", MethodName.MessageCancel);
    Assert.areEqual("MessageApprovePlan", MethodName.MessageApprovePlan);
    Assert.areEqual("ConversationCancel", MethodName.ConversationCancel);
    Assert.areEqual("ApprovalList", MethodName.ApprovalList);
    Assert.areEqual("ApprovalDecide", MethodName.ApprovalDecide);
    Assert.areEqual("BackgroundTaskList", MethodName.BackgroundTaskList);
    Assert.areEqual("BackgroundTaskRead", MethodName.BackgroundTaskRead);
    Assert.areEqual("BackgroundTaskStop", MethodName.BackgroundTaskStop);
    Assert.areEqual("BackgroundTaskClearFinished", MethodName.BackgroundTaskClearFinished);
    Assert.areEqual("SubAgentStart", MethodName.SubAgentStart);
    Assert.areEqual("SubAgentWait", MethodName.SubAgentWait);
    Assert.areEqual("SubAgentStop", MethodName.SubAgentStop);
    Assert.areEqual("PlanUsageList", MethodName.PlanUsageList);
    Assert.areEqual("PlanUsageRead", MethodName.PlanUsageRead);
    Assert.areEqual("TeammateUsageList", MethodName.TeammateUsageList);
    Assert.areEqual("TeammateLastReplyList", MethodName.TeammateLastReplyList);
    Assert.areEqual("WindowFocused", MethodName.WindowFocused);
    Assert.areEqual("WindowClosed", MethodName.WindowClosed);
    Assert.areEqual("WindowReload", MethodName.WindowReload);
    Assert.areEqual("PanelAnswered", MethodName.PanelAnswered);
    Assert.areEqual("SharedMcpServerList", MethodName.SharedMcpServerList);
    Assert.areEqual("SharedMcpServerCreate", MethodName.SharedMcpServerCreate);
    Assert.areEqual("SharedMcpServerUpdate", MethodName.SharedMcpServerUpdate);
    Assert.areEqual("SharedMcpServerDelete", MethodName.SharedMcpServerDelete);
    Assert.areEqual("SharedMcpProviderSet", MethodName.SharedMcpProviderSet);
    Assert.areEqual("SharedMcpTeammateSet", MethodName.SharedMcpTeammateSet);
    Assert.areEqual("SharedMcpSecretSet", MethodName.SharedMcpSecretSet);
    Assert.areEqual("SharedMcpSignInStart", MethodName.SharedMcpSignInStart);
    Assert.areEqual("SharedMcpSignOut", MethodName.SharedMcpSignOut);
    Assert.areEqual("ComputerUseGrantList", MethodName.ComputerUseGrantList);
    Assert.areEqual("ComputerUseGrantRevoke", MethodName.ComputerUseGrantRevoke);
    Assert.areEqual("WaitingMessageAdd", MethodName.WaitingMessageAdd);
    Assert.areEqual("WaitingMessageList", MethodName.WaitingMessageList);
    Assert.areEqual("WaitingMessageEdit", MethodName.WaitingMessageEdit);
    Assert.areEqual("WaitingMessageRemove", MethodName.WaitingMessageRemove);
    Assert.areEqual("WaitingMessageSendNow", MethodName.WaitingMessageSendNow);
    Assert.areEqual("OutsideConnectionRead", MethodName.OutsideConnectionRead);
    Assert.areEqual("OutsideTokenReset", MethodName.OutsideTokenReset);
    Assert.areEqual("AttachmentRead", MethodName.AttachmentRead);
    Assert.areEqual("AttachmentShare", MethodName.AttachmentShare);
    Assert.areEqual("AttachmentExists", MethodName.AttachmentExists);
    Assert.areEqual("WrittenImageRead", MethodName.WrittenImageRead);
    Assert.areEqual("WrittenImageShare", MethodName.WrittenImageShare);
    Assert.areEqual("LinkedFolderList", MethodName.LinkedFolderList);
    Assert.areEqual("DraftSave", MethodName.DraftSave);
    Assert.areEqual("DraftRead", MethodName.DraftRead);
    Assert.areEqual("DraftDiscard", MethodName.DraftDiscard);
    Assert.areEqual("ReadingPositionList", MethodName.ReadingPositionList);
    Assert.areEqual("ReadingPositionSave", MethodName.ReadingPositionSave);
    Assert.areEqual("RunOutputList", MethodName.RunOutputList);
    Assert.areEqual("RunOutputSave", MethodName.RunOutputSave);
    Assert.areEqual("DataFolderRead", MethodName.DataFolderRead);
    Assert.areEqual("FirstLaunchRead", MethodName.FirstLaunchRead);
    Assert.areEqual("FirstLaunchFinish", MethodName.FirstLaunchFinish);
    Assert.areEqual("ConversationSetMemberMode", MethodName.ConversationSetMemberMode);
    Assert.areEqual("ConversationSetMemberSettings", MethodName.ConversationSetMemberSettings);
    Assert.areEqual("ConversationSetPlanFirst", MethodName.ConversationSetPlanFirst);
    Assert.areEqual("OrganizationList", MethodName.OrganizationList);
    Assert.areEqual("DepartmentCreate", MethodName.DepartmentCreate);
    Assert.areEqual("DepartmentUpdate", MethodName.DepartmentUpdate);
    Assert.areEqual("DepartmentMove", MethodName.DepartmentMove);
    Assert.areEqual("DepartmentDelete", MethodName.DepartmentDelete);
    Assert.areEqual("DepartmentMemberSet", MethodName.DepartmentMemberSet);
    Assert.areEqual("OrganizationLayoutRead", MethodName.OrganizationLayoutRead);
    Assert.areEqual("OrganizationLayoutSave", MethodName.OrganizationLayoutSave);
    Assert.areEqual("TeammateWorkRead", MethodName.TeammateWorkRead);
    Assert.areEqual("OrganizationMessageSend", MethodName.OrganizationMessageSend);
    Assert.areEqual("OrganizationMessageStop", MethodName.OrganizationMessageStop);
    Assert.areEqual("OrganizationMessageList", MethodName.OrganizationMessageList);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(MethodName);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
