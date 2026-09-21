/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeFeed, ChangeOperation } from "@noldova/teamrun-foundation-data";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryChangeFeed } from "../fixtures/memory-change-feed.fixture.js";

@TestClass
export class ChangeFeedTests {
  @TestMethod
  public appendsAndReadsAfterASequence(): void {
    const feed = new MemoryChangeFeed();
    for (const id of ["a", "b", "c"])
      feed.append("note", id, ChangeOperation.Insert, id);

    Assert.isInstanceOf(feed, ChangeFeed);
    Assert.areEqual("a,b,c", feed.readAfter(0).map(t => t.entityId).join(","));
    Assert.areEqual("b,c", feed.readAfter(1).map(t => t.entityId).join(","));
    Assert.areEqual("a,b", feed.readAfter(0, 2).map(t => t.entityId).join(","));
    Assert.areEqual(0, feed.readAfter(3).length);
  }

  @TestMethod
  public validatesArgumentsBeforeTheStoreSeesThem(): void {
    const feed = new MemoryChangeFeed();

    Assert.areEqual("entity", Assert.throws(() => feed.append(" ", "id", ChangeOperation.Insert, ""), ArgumentException).parameterName);
    Assert.areEqual("entityId", Assert.throws(() => feed.append("note", "", ChangeOperation.Insert, ""), ArgumentException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => feed.readAfter(-1), ArgumentOutOfRangeException).parameterName);
    Assert.throws(() => feed.readAfter(0.5), ArgumentOutOfRangeException);
    Assert.areEqual("limit", Assert.throws(() => feed.readAfter(0, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual(0, feed.changes.length);
  }
}
