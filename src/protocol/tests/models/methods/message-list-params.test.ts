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
import { MessageListParams } from "@noldova/teamrun-protocol";

@TestClass
export class MessageListParamsTests {
  @TestMethod
  public keepsTheKindsAndRejectsAnUnknownOne(): void {
    const kinds = MessageListParams.fromJson({ conversationId: "conv-1", afterSequence: null, kinds: ["Command", "Note"] });

    Assert.areEqual("Command,Note", kinds.kinds.join(","));
    Assert.areEqual("Command,Note", MessageListParams.fromJson(kinds.toJson()).kinds.join(","));
    Assert.throws(() => MessageListParams.fromJson({ conversationId: "conv-1", afterSequence: null, kinds: ["poem"] }), ArgumentOutOfRangeException);
  }

  private static readonly json: object = { conversationId: "conv-1", afterSequence: 4, kinds: [] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageListParams.fromJson(MessageListParamsTests.json);

    Assert.areEqual(JSON.stringify(MessageListParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = MessageListParams.fromJson(MessageListParamsTests.json);

    Assert.throws(() => new MessageListParams(String.empty, valid.afterSequence), ArgumentException);
    Assert.throws(() => new MessageListParams(valid.conversationId, -1), ArgumentOutOfRangeException);
    Assert.doesNotThrow(() => new MessageListParams(valid.conversationId, null));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageListParams.fromJson({ ...MessageListParamsTests.json, afterSequence: 1.5 }), JsonException);

    Assert.areEqual("$.afterSequence", exception.path);
  }
}
