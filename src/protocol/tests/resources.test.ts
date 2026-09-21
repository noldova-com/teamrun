/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-protocol";

@TestClass
export class ResourcesTests {
  @TestMethod
  public carriesTheStampedProtocolVersion(): void {
    Assert.areEqual("0.1", Resources.protocolVersion);
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
    Assert.areEqual("profileDir", Resources.profileDirField);
    Assert.areEqual("provider", Resources.providerField);
    Assert.areEqual("inReplyTo", Resources.inReplyToField);
    Assert.areEqual("decidedAt", Resources.decidedAtField);
    Assert.areEqual("nativeKind", Resources.nativeKindField);
  }

  @TestMethod
  public namesTheSharedFields(): void {
    Assert.areEqual("kind", Resources.kindField);
    Assert.areEqual("id", Resources.idField);
  }

  @TestMethod
  public messagesAreSentences(): void {
    const messages = [
      Resources.versionTextInvalid, Resources.resumedWithoutSession, Resources.approvalDecisionMismatch,
      Resources.approvalWithoutOptions, Resources.decisionStatusMismatch, Resources.unknownDecision, Resources.decisionOutcomeMismatch,
      Resources.provenanceMismatch, Resources.messageEndMismatch
    ];

    for (const message of messages)
      Assert.isTrue(message.endsWith("."));
  }
}
