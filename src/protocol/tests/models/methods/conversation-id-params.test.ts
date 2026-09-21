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
import { ConversationIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationIdParamsTests {
  private static readonly json: object = { conversationId: "conv-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationIdParams.fromJson(ConversationIdParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ConversationIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const invalid = { ...ConversationIdParamsTests.json, conversationId: String.empty };
    const exception = Assert.throws(() => ConversationIdParams.fromJson(invalid), JsonException);

    Assert.areEqual("$.conversationId", exception.path);
  }
}
