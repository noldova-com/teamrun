/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ReplyWork } from "@noldova/teamrun.core";
import { ErrorCode, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

@TestClass
export class ReplyWorkTests {
  @TestMethod
  public ownsTheCapturedReplyAndItsCancellation(): void {
    const message = new Message("m", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const trigger = new Message("t", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const work = new ReplyWork(message, null, "role", trigger, 2);
    Assert.areEqual(message, work.message);
    Assert.isNull(work.provider);
    Assert.areEqual("role", work.instructions);
    Assert.areEqual(trigger, work.trigger);
    Assert.areEqual(2, work.hop);
    Assert.isFalse(work.run.isCancelled);
    work.run.cancel();
    Assert.isTrue(work.run.isCancelled);
    work.run.close();
  }

  @TestMethod
  public joinsHandOffsInOrderAndKeepsTheLongestChain(): void {
    const message = new Message("m", "c", 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const trigger = new Message("t", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const work = new ReplyWork(message, null, null, trigger, 2);
    Assert.areEqual(0, work.handOffs.length);
    work.join(new Message("a", "c", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), 1);
    Assert.areEqual(2, work.hop);
    work.join(new Message("b", "c", 3, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), 3);
    Assert.areEqual(3, work.hop);
    Assert.areEqual("a,b", work.handOffs.map(t => t.id).join(","));
    work.run.close();
  }

  @TestMethod
  public refusesToReadTheProvenanceOfAReplyWhoseMessageHoldsNone(): void {
    const message = new Message("m", "c", 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const trigger = new Message("t", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const work = new ReplyWork(message, null, null, trigger, 0);

    const failure = Assert.throws(() => work.provenance, ServiceException);

    Assert.areEqual(JSON.stringify([ErrorCode.Internal, "m"]), JSON.stringify([failure.info.name, failure.info.arguments[0]]));
    work.run.close();
  }
}
