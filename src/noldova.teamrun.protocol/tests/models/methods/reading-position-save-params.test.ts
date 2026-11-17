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
import { ChatPosition, ReadingPositionSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class ReadingPositionSaveParamsTests {
  private static readonly json: object = {
    positions: [{ chatId: "conv-1", messageId: "m3", sequence: 2, distance: 40 }],
    cleared: ["conv-2"],
    dropped: [{ chatId: "conv-3", messageId: "m1", sequence: 0, distance: 0 }]
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ReadingPositionSaveParams.fromJson(ReadingPositionSaveParamsTests.json);

    Assert.areEqual(JSON.stringify(ReadingPositionSaveParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsABlankClearedIdAndAChatNamedTwice(): void {
    const position = new ChatPosition("conv-1", "m3", 2, 40);

    Assert.throws(() => new ReadingPositionSaveParams([], [" "]), ArgumentException);
    Assert.throws(() => new ReadingPositionSaveParams([position, position]), ArgumentException);
    Assert.throws(() => new ReadingPositionSaveParams([position], ["conv-1"]), ArgumentException);
    Assert.throws(() => new ReadingPositionSaveParams([], ["conv-2", "conv-2"]), ArgumentException);
    Assert.throws(() => new ReadingPositionSaveParams([], ["conv-1"], [position]), ArgumentException);
    Assert.throws(() => new ReadingPositionSaveParams([position], [], [position]), ArgumentException);
    Assert.areEqual("0,0", [new ReadingPositionSaveParams([position]).cleared.length, new ReadingPositionSaveParams([position]).dropped.length].join());
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = { ...ReadingPositionSaveParamsTests.json, positions: [{ chatId: "conv-1", messageId: "m3", sequence: "2", distance: 40 }] };
    const exception = Assert.throws(() => ReadingPositionSaveParams.fromJson(json), JsonException);

    Assert.areEqual("$.positions.0.sequence", exception.path);
  }
}
