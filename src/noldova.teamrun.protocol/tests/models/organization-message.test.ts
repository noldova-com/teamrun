/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  OrganizationMessage, OrganizationMessageSendParams, OrganizationRecipient, OrganizationRecipientState, OrganizationTarget, OrganizationTargetKind
} from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationMessageTests {
  @TestMethod
  public namesEveryTargetKindAndRecipientState(): void {
    Assert.areEqual("Teammate,Department,Leaders,Everyone", Object.values(OrganizationTargetKind).join(","));
    Assert.areEqual("Queued,Started,Stopped,Removed,Failed", Object.values(OrganizationRecipientState).join(","));
  }

  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const message = new OrganizationMessage("o1", OrganizationTarget.department("d1"), "Ship it", "c", [
      new OrganizationRecipient("t1", "Ada", OrganizationRecipientState.Started, "c1", "m1"),
      new OrganizationRecipient("t2", "Bob", OrganizationRecipientState.Failed, null, null, "Signed out")
    ]);
    const json = message.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(OrganizationMessage.fromJson(json).toJson()));
    Assert.areEqual("$.input.target.kind",
      Assert.throws(() => OrganizationMessage.fromJson({ ...json, target: { kind: "Nobody", id: null } }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.recipients.0.state",
      Assert.throws(() => OrganizationMessage.fromJson({ ...json, recipients: [{ teammateId: "t1", teammateName: "Ada", state: "Lost" }] }, "$.input"),
        JsonException).path);
  }

  @TestMethod
  public replacesOneRecipientByItsTeammateAndKeepsTheFieldsNotGiven(): void {
    const queued = new OrganizationRecipient("t1", "Ada", OrganizationRecipientState.Queued);
    const message = new OrganizationMessage("o1", OrganizationTarget.everyone, "Hi", "c", [queued, new OrganizationRecipient("t2", "Bob", OrganizationRecipientState.Queued)]);

    const started = message.withRecipient(queued.with(OrganizationRecipientState.Started, "c1", "m1"));
    const failed = queued.with(OrganizationRecipientState.Started, "c1", "m1").with(OrganizationRecipientState.Failed, undefined, undefined, "Gone");

    Assert.areEqual("Started:c1:m1,Queued:null:null", started.recipients.map(t => `${t.state}:${t.chatId}:${t.messageId}`).join(","));
    Assert.areEqual("Failed:c1:m1:Gone", `${failed.state}:${failed.chatId}:${failed.messageId}:${failed.reason}`);
    Assert.areEqual("Queued", message.recipients[0]?.state);
  }

  @TestMethod
  public namesItsTargetsAndComparesThem(): void {
    Assert.isTrue(OrganizationTarget.teammate("t1").equals(new OrganizationTarget(OrganizationTargetKind.Teammate, "t1")));
    Assert.isFalse(OrganizationTarget.teammate("t1").equals(OrganizationTarget.department("t1")));
    Assert.isFalse(OrganizationTarget.teammate("t1").equals(OrganizationTarget.teammate("t2")));
    Assert.areEqual(JSON.stringify(OrganizationTarget.leaders.toJson()), JSON.stringify(OrganizationTarget.fromJson({ kind: "Leaders", id: null }).toJson()));
  }

  @TestMethod
  public sendsATargetAndText(): void {
    const json = new OrganizationMessageSendParams(OrganizationTarget.department("d1"), "Status?").toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(OrganizationMessageSendParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.text", Assert.throws(() => OrganizationMessageSendParams.fromJson({ target: json["target"] }, "$.input"), JsonException).path);
    Assert.throws(() => new OrganizationMessageSendParams(OrganizationTarget.everyone, " "), ArgumentException);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.throws(() => new OrganizationTarget(OrganizationTargetKind.Teammate, null), ArgumentException);
    Assert.throws(() => new OrganizationTarget(OrganizationTargetKind.Department, " "), ArgumentException);
    Assert.throws(() => new OrganizationTarget(OrganizationTargetKind.Leaders, "t1"), ArgumentException);
    Assert.throws(() => new OrganizationRecipient(" ", "Ada", OrganizationRecipientState.Queued), ArgumentException);
    Assert.throws(() => new OrganizationRecipient("t1", " ", OrganizationRecipientState.Queued), ArgumentException);
    const ada = new OrganizationRecipient("t1", "Ada", OrganizationRecipientState.Queued);
    Assert.throws(() => new OrganizationMessage(" ", OrganizationTarget.everyone, "Hi", "c", []), ArgumentException);
    Assert.throws(() => new OrganizationMessage("o1", OrganizationTarget.everyone, " ", "c", []), ArgumentException);
    Assert.throws(() => new OrganizationMessage("o1", OrganizationTarget.everyone, "Hi", " ", []), ArgumentException);
    Assert.throws(() => new OrganizationMessage("o1", OrganizationTarget.everyone, "Hi", "c", [ada, ada]), ArgumentException);
  }
}
