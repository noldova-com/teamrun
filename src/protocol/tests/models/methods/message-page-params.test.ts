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
import { MessagePageParams } from "@noldova/teamrun-protocol";

@TestClass
export class MessagePageParamsTests {
  private static readonly json: object = { conversationId: "conv-1", beforeSequence: 40, afterSequence: null, limit: 50 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessagePageParams.fromJson(MessagePageParamsTests.json);

    Assert.areEqual(JSON.stringify(MessagePageParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(40, value.beforeSequence);
    Assert.isNull(value.afterSequence);
    Assert.areEqual(50, value.limit);
    Assert.areEqual(7, MessagePageParams.fromJson({ ...MessagePageParamsTests.json, beforeSequence: null, afterSequence: 7 }).afterSequence);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new MessagePageParams(String.empty, null, null, 50), ArgumentException);
    Assert.throws(() => new MessagePageParams("conv-1", -1, null, 50), ArgumentOutOfRangeException);
    Assert.throws(() => new MessagePageParams("conv-1", null, 1.5, 50), ArgumentOutOfRangeException);
    Assert.throws(() => new MessagePageParams("conv-1", 3, 3, 50), ArgumentException);
    Assert.throws(() => new MessagePageParams("conv-1", null, null, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new MessagePageParams("conv-1", null, null, 501), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessagePageParams.fromJson({ ...MessagePageParamsTests.json, limit: "many" }), JsonException);

    Assert.areEqual("$.limit", exception.path);
  }
}
