/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatSearchHit, ChatSearchResult } from "@noldova/teamrun.protocol";

@TestClass
export class ChatSearchResultTests {
  private static readonly json: object = {
    hits: [
      { chatId: "conv-1", projectId: "prj-1", title: "Add login", messageId: null, snippet: "Add login", updatedAt: "t2", sequence: null },
      { chatId: "conv-2", projectId: "prj-1", title: "Chat", messageId: "msg-3", snippet: "…the login page…", updatedAt: "t1", sequence: 3 }
    ]
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatSearchResult.fromJson(ChatSearchResultTests.json);

    Assert.areEqual(JSON.stringify(ChatSearchResultTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(2, value.hits.length);
    Assert.isNull(value.hits[0]?.messageId);
    Assert.areEqual("msg-3", value.hits[1]?.messageId);
    Assert.areEqual(3, value.hits[1]?.sequence);
    Assert.isNull(value.hits[0]?.sequence);
    Assert.areEqual(0, new ChatSearchResult([]).hits.length);
    Assert.isTrue(value.hits[0] instanceof ChatSearchHit);
  }

  @TestMethod
  public findsAChatWithoutAProject(): void {
    const hit = new ChatSearchHit("conv-1", null, "T", null, "s", "t");

    Assert.isNull(ChatSearchHit.fromJson(hit.toJson()).projectId);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.throws(() => new ChatSearchHit(" ", "prj-1", "T", null, "s", "t"), ArgumentException);
    Assert.throws(() => new ChatSearchHit("conv-1", " ", "T", null, "s", "t"), ArgumentException);
    Assert.throws(() => new ChatSearchHit("conv-1", "prj-1", "T", null, "s", " "), ArgumentException);
    Assert.throws(() => new ChatSearchHit("conv-1", "prj-1", "T", "m", "s", "t", -1), ArgumentOutOfRangeException);
    const badHits = Assert.throws(() => ChatSearchResult.fromJson({ hits: "x" }), JsonException);
    const badHit = Assert.throws(() => ChatSearchResult.fromJson({ hits: [{ chatId: "c" }] }), JsonException);

    Assert.areEqual("$.hits", badHits.path);
    Assert.areEqual("$.hits.0.projectId", badHit.path);
  }
}
