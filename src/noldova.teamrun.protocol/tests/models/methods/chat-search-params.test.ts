/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatSearchParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatSearchParamsTests {
  private static readonly json: object = { query: "login", limit: 20 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatSearchParams.fromJson(ChatSearchParamsTests.json);

    Assert.areEqual(JSON.stringify(ChatSearchParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(20, value.limit);
  }

  @TestMethod
  public rejectsABlankQueryAndALimitOutOfRange(): void {
    Assert.areEqual("query", Assert.throws(() => new ChatSearchParams(" ", 5), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ChatSearchParams("x", 0), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ChatSearchParams("x", 101), ArgumentException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new ChatSearchParams("x", 2.5), ArgumentException).parameterName);
    Assert.areEqual(100, new ChatSearchParams("x", 100).limit);
    Assert.areEqual("$.limit", Assert.throws(() => ChatSearchParams.fromJson({ query: "x", limit: "many" }), JsonException).path);
  }
}
