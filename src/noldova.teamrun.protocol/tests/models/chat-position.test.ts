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
import { ChatPosition } from "@noldova/teamrun.protocol";

@TestClass
export class ChatPositionTests {
  private static readonly json: object = { chatId: "conv-1", messageId: "m3", sequence: 2, distance: -40.5 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ChatPosition.fromJson(ChatPositionTests.json);

    Assert.areEqual(JSON.stringify(ChatPositionTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ChatPosition(String.empty, "m3", 2, 0), ArgumentException);
    Assert.throws(() => new ChatPosition("conv-1", " ", 2, 0), ArgumentException);
    Assert.throws(() => new ChatPosition("conv-1", "m3", -1, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new ChatPosition("conv-1", "m3", 1.5, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new ChatPosition("conv-1", "m3", 2, Number.NaN), ArgumentOutOfRangeException);
    Assert.throws(() => new ChatPosition("conv-1", "m3", 2, Number.POSITIVE_INFINITY), ArgumentOutOfRangeException);
    Assert.areEqual(0, new ChatPosition("conv-1", "m3", 0, 0).sequence);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ChatPosition.fromJson({ ...ChatPositionTests.json, messageId: String.empty }), JsonException);

    Assert.areEqual("$.messageId", exception.path);
  }
}
