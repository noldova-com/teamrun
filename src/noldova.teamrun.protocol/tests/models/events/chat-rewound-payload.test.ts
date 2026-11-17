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
import { ChatRewoundPayload } from "@noldova/teamrun.protocol";

@TestClass
export class ChatRewoundPayloadTests {
  private static readonly json: object = { chatId: "conv-1", fromSequence: 4 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatRewoundPayload.fromJson(ChatRewoundPayloadTests.json);

    Assert.areEqual(JSON.stringify(ChatRewoundPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(4, value.fromSequence);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatRewoundPayload(String.empty, 1), ArgumentException);
    Assert.throws(() => new ChatRewoundPayload("conv-1", -1), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatRewoundPayload.fromJson({ chatId: "conv-1", fromSequence: "4" }), JsonException);

    Assert.areEqual("$.fromSequence", exception.path);
  }
}
