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
import { BackgroundTaskOutputPayload } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskOutputPayloadTests {
  private static readonly json: object = { chatId: "conv-1", taskId: "task-1", text: "  listening on 5173\n" };

  @TestMethod
  public roundTripsThroughJsonKeepingTheTextAsWritten(): void {
    const value = BackgroundTaskOutputPayload.fromJson(BackgroundTaskOutputPayloadTests.json);

    Assert.areEqual(JSON.stringify(BackgroundTaskOutputPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("  listening on 5173\n", value.text);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new BackgroundTaskOutputPayload(String.empty, "task-1", "x"), ArgumentException);
    Assert.throws(() => new BackgroundTaskOutputPayload("conv-1", String.empty, "x"), ArgumentException);
    Assert.throws(() => new BackgroundTaskOutputPayload("conv-1", "task-1", String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => BackgroundTaskOutputPayload.fromJson({ ...BackgroundTaskOutputPayloadTests.json, taskId: 3 }), JsonException);

    Assert.areEqual("$.taskId", exception.path);
  }
}
