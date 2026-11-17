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
import { BackgroundTasksClearedPayload } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTasksClearedPayloadTests {
  private static readonly json: object = { chatId: "conv-1", clearedAt: "2026-11-02T20:00:00.000Z", count: 2 };

  @TestMethod
  public roundTripsThroughJsonWithTheChatTheTimeAndTheCount(): void {
    const value = BackgroundTasksClearedPayload.fromJson(BackgroundTasksClearedPayloadTests.json);

    Assert.areEqual(JSON.stringify(BackgroundTasksClearedPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("conv-1:2026-11-02T20:00:00.000Z:2", [value.chatId, value.clearedAt, value.count].join(":"));
    Assert.areEqual(0, new BackgroundTasksClearedPayload("conv-1", "2026-11-02T20:00:00.000Z", 0).count);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new BackgroundTasksClearedPayload(String.empty, "2026-11-02T20:00:00.000Z", 1), ArgumentException);
    Assert.throws(() => new BackgroundTasksClearedPayload("conv-1", " ", 1), ArgumentException);
    Assert.throws(() => new BackgroundTasksClearedPayload("conv-1", "2026-11-02T20:00:00.000Z", -1), ArgumentOutOfRangeException);
    Assert.throws(() => new BackgroundTasksClearedPayload("conv-1", "2026-11-02T20:00:00.000Z", 1.5), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const time = Assert.throws(() => BackgroundTasksClearedPayload.fromJson({ ...BackgroundTasksClearedPayloadTests.json, clearedAt: 7 }), JsonException);
    const count = Assert.throws(() => BackgroundTasksClearedPayload.fromJson({ ...BackgroundTasksClearedPayloadTests.json, count: "2" }), JsonException);

    Assert.areEqual("$.clearedAt,$.count", [time.path, count.path].join(","));
  }
}
