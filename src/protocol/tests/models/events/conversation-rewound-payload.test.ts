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
import { ConversationRewoundPayload } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationRewoundPayloadTests {
  private static readonly json: object = { conversationId: "conv-1", fromSequence: 4 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationRewoundPayload.fromJson(ConversationRewoundPayloadTests.json);

    Assert.areEqual(JSON.stringify(ConversationRewoundPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(4, value.fromSequence);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ConversationRewoundPayload(String.empty, 1), ArgumentException);
    Assert.throws(() => new ConversationRewoundPayload("conv-1", -1), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ConversationRewoundPayload.fromJson({ conversationId: "conv-1", fromSequence: "4" }), JsonException);

    Assert.areEqual("$.fromSequence", exception.path);
  }
}
