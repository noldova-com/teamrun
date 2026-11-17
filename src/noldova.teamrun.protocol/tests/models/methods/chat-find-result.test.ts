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
import { ChatFindHit, ChatFindParams, ChatFindResult } from "@noldova/teamrun.protocol";

@TestClass
export class ChatFindResultTests {
  private static readonly json: object = {
    hits: [
      { chatId: "chat-1", projectId: "prj-1", title: "Terminal tab freezes", teammateNames: ["Builder", "Reviewer"], updatedAt: "t2" },
      { chatId: "chat-2", projectId: null, title: "", teammateNames: [], updatedAt: "t1" }
    ],
    total: 7
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatFindResult.fromJson(ChatFindResultTests.json);

    Assert.areEqual(JSON.stringify(ChatFindResultTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("Builder,Reviewer|7|true", [value.hits[0]?.teammateNames.join(","), value.total, value.hits[1] instanceof ChatFindHit].join("|"));
  }

  @TestMethod
  public trimsTheQueryKeepsABlankOneAndRoundTripsTheParams(): void {
    const params = ChatFindParams.fromJson({ query: "  term ", limit: 5 });

    Assert.areEqual(JSON.stringify({ query: "term", limit: 5 }), JSON.stringify(params.toJson()));
    Assert.areEqual("", new ChatFindParams(" ", 1).query);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.throws(() => new ChatFindParams("t", 0), ArgumentException);
    Assert.throws(() => new ChatFindParams("t", 101), ArgumentException);
    Assert.throws(() => new ChatFindHit(" ", null, "T", [], "t"), ArgumentException);
    Assert.throws(() => new ChatFindHit("chat-1", " ", "T", [], "t"), ArgumentException);
    Assert.throws(() => new ChatFindHit("chat-1", null, "T", [" "], "t"), ArgumentException);
    Assert.throws(() => new ChatFindHit("chat-1", null, "T", [], " "), ArgumentException);
    Assert.throws(() => new ChatFindResult([new ChatFindHit("chat-1", null, "T", [], "t")], 0), ArgumentOutOfRangeException);
    Assert.throws(() => new ChatFindResult([], 1.5), ArgumentOutOfRangeException);
    const badQuery = Assert.throws(() => ChatFindParams.fromJson({ limit: 5 }), JsonException);
    const badNames = Assert.throws(() => ChatFindResult.fromJson({ hits: [{ chatId: "c", projectId: null, title: "T", teammateNames: "x", updatedAt: "t" }], total: 1 }),
      JsonException);
    const badTotal = Assert.throws(() => ChatFindResult.fromJson({ hits: [] }), JsonException);

    Assert.areEqual("$.query|$.hits.0.teammateNames|$.total", [badQuery.path, badNames.path, badTotal.path].join("|"));
  }
}
