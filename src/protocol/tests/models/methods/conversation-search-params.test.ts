/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationSearchParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationSearchParamsTests {
  private static readonly json: object = { query: "login", limit: 20 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationSearchParams.fromJson(ConversationSearchParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationSearchParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(20, value.limit);
  }

  @TestMethod
  public rejectsABlankQueryAndALimitOutOfRange(): void {
    Assert.areEqual("query", Assert.throws(() => new ConversationSearchParams(" ", 5), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ConversationSearchParams("x", 0), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ConversationSearchParams("x", 101), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ConversationSearchParams("x", 2.5), ArgumentException).parameterName);
    Assert.areEqual(100, new ConversationSearchParams("x", 100).limit);
    Assert.areEqual("$.limit", Assert.throws(() => ConversationSearchParams.fromJson({ query: "x", limit: "many" }), JsonException).path);
  }
}
