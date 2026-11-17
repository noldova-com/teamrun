/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "@noldova/teamrun.protocol";

@TestClass
export class ResourcesTests {
  @TestMethod
  public carriesTheStampedProtocolVersion(): void {
    Assert.areEqual("0.2", Resources.protocolVersion);
  }

  @TestMethod
  public saysChatNeverConversationInEveryTextItHolds(): void {
    const texts = Object.values(Resources).filter((t: unknown): t is string => typeof t === "string" && t.includes(" "));

    Assert.isTrue(texts.includes(Resources.panelChatMismatch));
    Assert.areEqual("", texts.filter(t => /conversation/i.test(t)).join(" | "));
  }

  @TestMethod
  public namesTheWireFields(): void {
    Assert.areEqual("version", Resources.versionField);
    Assert.areEqual("token", Resources.tokenField);
    Assert.areEqual("method", Resources.methodField);
    Assert.areEqual("payload", Resources.payloadField);
  }

  @TestMethod
  public namesTheModelFields(): void {
    Assert.areEqual("createdAt", Resources.createdAtField);
    Assert.areEqual("parentSequence", Resources.parentSequenceField);
    Assert.areEqual("isBackground", Resources.isBackgroundField);
    Assert.areEqual("toolUses", Resources.toolUsesField);
    Assert.areEqual("tokens", Resources.tokensField);
    Assert.areEqual("durationMs", Resources.durationMsField);
    Assert.areEqual("profileDir", Resources.profileDirField);
    Assert.areEqual("state", Resources.stateField);
    Assert.areEqual("reason", Resources.reasonField);
    Assert.areEqual("received", Resources.receivedField);
    Assert.areEqual("missingTool", Resources.missingToolField);
    Assert.areEqual("foundPath", Resources.foundPathField);
    Assert.areEqual("binaryPath", Resources.binaryPathField);
    Assert.areEqual("choosesServerPath", Resources.choosesServerPathField);
    Assert.areEqual("reportsLimits", Resources.reportsLimitsField);
    Assert.areEqual("carriesSessions", Resources.carriesSessionsField);
    Assert.areEqual("sessionsChecked", Resources.sessionsCheckedField);
    Assert.areEqual("usageHandOffs", Resources.usageHandOffsField);
    Assert.areEqual("sustain", Resources.sustainField);
    Assert.areEqual("fallbacks", Resources.fallbacksField);
    Assert.areEqual("resetsSoonestFirst", Resources.resetsSoonestFirstField);
    Assert.areEqual("total", Resources.totalField);
    Assert.areEqual("update", Resources.updateField);
    Assert.areEqual("inReplyTo", Resources.inReplyToField);
    Assert.areEqual("decidedAt", Resources.decidedAtField);
    Assert.areEqual("nativeKind", Resources.nativeKindField);
    Assert.areEqual("taskId", Resources.taskIdField);
    Assert.areEqual("clearedAt", Resources.clearedAtField);
    Assert.areEqual("command", Resources.commandField);
    Assert.areEqual("transport", Resources.transportField);
    Assert.areEqual("variables", Resources.variablesField);
    Assert.areEqual("headers", Resources.headersField);
    Assert.areEqual("bearerVariable", Resources.bearerVariableField);
    Assert.areEqual("signsIn", Resources.signsInField);
    Assert.areEqual("account", Resources.accountField);
    Assert.areEqual("signIn", Resources.signInField);
    Assert.areEqual("expiresAt", Resources.expiresAtField);
    Assert.areEqual("needsSignIn", Resources.needsSignInField);
    Assert.areEqual("definition", Resources.definitionField);
    Assert.areEqual("teammates", Resources.teammatesField);
    Assert.areEqual("setting", Resources.settingField);
    Assert.areEqual("server", Resources.serverField);
    Assert.areEqual("serverId", Resources.serverIdField);
    Assert.areEqual("unavailable", Resources.unavailableField);
    Assert.areEqual("on", Resources.onField);
    Assert.areEqual("exitCode", Resources.exitCodeField);
    Assert.areEqual("output", Resources.outputField);
    Assert.areEqual(65536, Resources.maximumBackgroundTaskOutput);
    Assert.areEqual("usage", Resources.usageField);
    Assert.areEqual("costUsd", Resources.costUsdField);
    Assert.areEqual("compactAtTokens", Resources.compactAtTokensField);
    Assert.areEqual("usedPercent", Resources.usedPercentField);
    Assert.areEqual("windowId", Resources.windowIdField);
    Assert.areEqual("shownChatId", Resources.shownChatIdField);
    Assert.areEqual("requestId", Resources.requestIdField);
    Assert.areEqual("panel", Resources.panelField);
    Assert.areEqual("open", Resources.openField);
    Assert.areEqual("focused", Resources.focusedField);
  }

  @TestMethod
  public namesTheSharedFields(): void {
    Assert.areEqual("kind", Resources.kindField);
    Assert.areEqual("id", Resources.idField);
    Assert.areEqual("teamrun.chat/", Resources.chatTerminalOwnerPrefix);
  }

  @TestMethod
  public formatsAToolFailureWithItsModuleCodeWhenItHasOne(): void {
    Assert.areEqual("Denied: The token is unknown.", Resources.formatMcpToolFailure("Denied", null, "The token is unknown."));
    Assert.areEqual("Unavailable (teamrun.noRunningTurn): No turn.", Resources.formatMcpToolFailure("Unavailable", "teamrun.noRunningTurn", "No turn."));
  }

  @TestMethod
  public messagesAreSentences(): void {
    const messages = [
      Resources.versionTextInvalid, Resources.resumedWithoutSession, Resources.approvalDecisionMismatch,
      Resources.approvalWithoutOptions, Resources.decisionStatusMismatch, Resources.unknownDecision, Resources.decisionOutcomeMismatch,
      Resources.provenanceMismatch, Resources.messageEndMismatch, Resources.nestedTextDetail
    ];

    for (const message of messages)
      Assert.isTrue(message.endsWith("."));
  }
}
