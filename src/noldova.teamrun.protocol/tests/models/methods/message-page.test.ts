/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Message, MessageAuthor, MessagePage, MessageStatus } from "@noldova/teamrun.protocol";

@TestClass
export class MessagePageTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const message = new Message("msg-1", "conv-1", 3, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t1", null, "t1");
    const page = new MessagePage([message], true, false, 10);

    const read = MessagePage.fromJson(JSON.parse(JSON.stringify(page.toJson())));

    Assert.areEqual(JSON.stringify(page.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual(1, read.messages.length);
    Assert.areEqual("msg-1", read.messages[0]?.id);
    Assert.isTrue(read.hasEarlier);
    Assert.isFalse(read.hasLater);
    Assert.areEqual(10, read.count);
    Assert.areEqual(0, new MessagePage([], false, false, 0).messages.length);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badMessages = Assert.throws(() => MessagePage.fromJson({ messages: "x", hasEarlier: false, hasLater: false, count: 0 }), JsonException);
    const badFlag = Assert.throws(() => MessagePage.fromJson({ messages: [], hasEarlier: "no", hasLater: false, count: 0 }), JsonException);
    const badCount = Assert.throws(() => MessagePage.fromJson({ messages: [], hasEarlier: false, hasLater: false, count: "1" }), JsonException);

    Assert.areEqual("$.messages", badMessages.path);
    Assert.areEqual("$.hasEarlier", badFlag.path);
    Assert.areEqual("$.count", badCount.path);
  }

  @TestMethod
  public rejectsACountBelowItsMessagesOrNotAnInteger(): void {
    const message = new Message("msg-1", "conv-1", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t1", null, "t1");

    Assert.throws(() => new MessagePage([message], false, false, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new MessagePage([], false, false, -1), ArgumentOutOfRangeException);
    Assert.throws(() => new MessagePage([], false, false, 1.5), ArgumentOutOfRangeException);
    Assert.areEqual(1, new MessagePage([message], false, false, 1).count);
  }
}
