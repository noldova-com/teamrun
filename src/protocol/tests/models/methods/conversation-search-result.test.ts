/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationSearchHit, ConversationSearchResult } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationSearchResultTests {
  private static readonly json: object = {
    hits: [
      { conversationId: "conv-1", projectId: "prj-1", title: "Add login", messageId: null, snippet: "Add login", updatedAt: "t2", sequence: null },
      { conversationId: "conv-2", projectId: "prj-1", title: "Chat", messageId: "msg-3", snippet: "…the login page…", updatedAt: "t1", sequence: 3 }
    ]
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationSearchResult.fromJson(ConversationSearchResultTests.json);

    Assert.areEqual(JSON.stringify(ConversationSearchResultTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(2, value.hits.length);
    Assert.isNull(value.hits[0]?.messageId);
    Assert.areEqual("msg-3", value.hits[1]?.messageId);
    Assert.areEqual(3, value.hits[1]?.sequence);
    Assert.isNull(value.hits[0]?.sequence);
    Assert.areEqual(0, new ConversationSearchResult([]).hits.length);
    Assert.isTrue(value.hits[0] instanceof ConversationSearchHit);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.throws(() => new ConversationSearchHit(" ", "prj-1", "T", null, "s", "t"), ArgumentException);
    Assert.throws(() => new ConversationSearchHit("conv-1", " ", "T", null, "s", "t"), ArgumentException);
    Assert.throws(() => new ConversationSearchHit("conv-1", "prj-1", "T", null, "s", " "), ArgumentException);
    Assert.throws(() => new ConversationSearchHit("conv-1", "prj-1", "T", "m", "s", "t", -1), ArgumentOutOfRangeException);
    const badHits = Assert.throws(() => ConversationSearchResult.fromJson({ hits: "x" }), JsonException);
    const badHit = Assert.throws(() => ConversationSearchResult.fromJson({ hits: [{ conversationId: "c" }] }), JsonException);

    Assert.areEqual("$.hits", badHits.path);
    Assert.areEqual("$.hits.0.projectId", badHit.path);
  }
}
