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
import { MessageDetailsAfterParams } from "@noldova/teamrun.protocol";

@TestClass
export class MessageDetailsAfterParamsTests {
  private static readonly json: object = { messageId: "m1", afterSequence: 40, sequences: [3, 17] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageDetailsAfterParams.fromJson(MessageDetailsAfterParamsTests.json);

    Assert.areEqual(JSON.stringify(MessageDetailsAfterParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("m1", value.messageId);
    Assert.areEqual(40, value.afterSequence);
    Assert.areEqual("3,17", value.sequences.join(","));
    Assert.areEqual(0, MessageDetailsAfterParams.fromJson({ messageId: "m1", afterSequence: 0, sequences: [] }).sequences.length);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheSequences(): void {
    const sequences = [3];
    const value = new MessageDetailsAfterParams("m1", 5, sequences);

    sequences.push(4);

    Assert.areEqual("3", value.sequences.join(","));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new MessageDetailsAfterParams(String.empty, 0, []), ArgumentException);
    Assert.throws(() => new MessageDetailsAfterParams("m1", -1, []), ArgumentOutOfRangeException);
    Assert.throws(() => new MessageDetailsAfterParams("m1", 1.5, []), ArgumentOutOfRangeException);
    Assert.throws(() => new MessageDetailsAfterParams("m1", 5, [2, -1]), ArgumentOutOfRangeException);
    Assert.throws(() => new MessageDetailsAfterParams("m1", 5, [2.5]), ArgumentOutOfRangeException);
  }

  @TestMethod
  public takesAtMostAThousandChangedSequences(): void {
    const thousand = Array.from({ length: 1_000 }, (_, index) => index);

    Assert.areEqual(1_000, new MessageDetailsAfterParams("m1", 1_000, thousand).sequences.length);
    Assert.throws(() => new MessageDetailsAfterParams("m1", 1_000, [...thousand, 1_000]), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const notArray = Assert.throws(() => MessageDetailsAfterParams.fromJson({ ...MessageDetailsAfterParamsTests.json, sequences: "3" }), JsonException);
    const notNumber = Assert.throws(() => MessageDetailsAfterParams.fromJson({ ...MessageDetailsAfterParamsTests.json, sequences: [3, "4"] }), JsonException);
    const after = Assert.throws(() => MessageDetailsAfterParams.fromJson({ ...MessageDetailsAfterParamsTests.json, afterSequence: null }), JsonException);

    Assert.areEqual("$.sequences", notArray.path);
    Assert.areEqual("$.sequences", notNumber.path);
    Assert.areEqual("$.afterSequence", after.path);
  }
}
