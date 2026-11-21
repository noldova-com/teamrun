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
  DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings, TeammateLastReply
} from "@noldova/teamrun.protocol";

@TestClass
export class TeammateLastReplyTests {
  @TestMethod
  public preservesItsFieldsAndRejectsABlankOne(): void {
    const reply = new TeammateLastReply("t1", "c1", "m1", "Done.", "2026-11-20T10:00:00.000Z");
    const json = reply.toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammateLastReply.fromJson(json).toJson()));
    Assert.areEqual("$.input.text", Assert.throws(() => TeammateLastReply.fromJson({ ...json, text: " " }, "$.input"), JsonException).path);
    for (const field of [0, 1, 2, 3, 4])
      Assert.throws(() => new TeammateLastReply(...TeammateLastReplyTests.fields(field)), ArgumentException);
  }

  @TestMethod
  public comparesEveryField(): void {
    const reply = new TeammateLastReply("t1", "c1", "m1", "Done.", "e");

    Assert.isTrue(reply.equals(new TeammateLastReply("t1", "c1", "m1", "Done.", "e")));
    Assert.areEqual("false,false,false,false,false", [
      new TeammateLastReply("t2", "c1", "m1", "Done.", "e"), new TeammateLastReply("t1", "c2", "m1", "Done.", "e"),
      new TeammateLastReply("t1", "c1", "m2", "Done.", "e"), new TeammateLastReply("t1", "c1", "m1", "Other", "e"),
      new TeammateLastReply("t1", "c1", "m1", "Done.", "f")
    ].map(t => reply.equals(t)).join(","));
  }

  @TestMethod
  public takesATeammatesCompletedReplyWithTextJoiningItsTextDetailsAndNothingElse(): void {
    const details = [new MessageDetail(0, DetailKind.Text, "Shipped", null, "t"), new MessageDetail(1, DetailKind.Reasoning, "hidden", null, "t"),
      new MessageDetail(2, DetailKind.Text, "it.", null, "t")];
    const blank = [new MessageDetail(0, DetailKind.Text, " ", null, "t"), new MessageDetail(1, DetailKind.Reasoning, "thinking", null, "t")];

    const taken = TeammateLastReply.of(TeammateLastReplyTests.reply(MessageStatus.Completed, details));

    Assert.areEqual("t1 c1 m1 Shipped it. e", `${taken?.teammateId} ${taken?.chatId} ${taken?.messageId} ${taken?.text} ${taken?.endedAt}`);
    Assert.isNull(TeammateLastReply.of(TeammateLastReplyTests.reply(MessageStatus.Failed, details)));
    Assert.isNull(TeammateLastReply.of(TeammateLastReplyTests.reply(MessageStatus.Completed, blank)));
    Assert.isNull(TeammateLastReply.of(TeammateLastReplyTests.reply(MessageStatus.Completed, details, null)));
    Assert.isNull(TeammateLastReply.of(new Message("u1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, details, null, "t", null, "e")));
  }

  private static reply(status: MessageStatus, details: readonly MessageDetail[], teammateId: string | null = "t1"): Message {
    return new Message("m1", "c1", 1, MessageAuthor.Provider, null, status, details,
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false), "t", "s", "e", [],
      teammateId, teammateId);
  }

  private static fields(blank: number): [string, string, string, string, string] {
    const fields: [string, string, string, string, string] = ["t1", "c1", "m1", "Done.", "e"];
    fields[blank] = " ";
    return fields;
  }
}
