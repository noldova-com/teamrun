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
import { BackgroundTaskListParams } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskListParamsTests {
  private static readonly json: object = { chatId: "conv-1", afterTaskId: "task-9", limit: 100 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = BackgroundTaskListParams.fromJson(BackgroundTaskListParamsTests.json);

    Assert.areEqual(JSON.stringify(BackgroundTaskListParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("conv-1:task-9:100", [value.chatId, value.afterTaskId, value.limit].join(":"));
    Assert.isNull(BackgroundTaskListParams.fromJson({ ...BackgroundTaskListParamsTests.json, afterTaskId: null }).afterTaskId);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new BackgroundTaskListParams(String.empty, null, 100), ArgumentException);
    Assert.throws(() => new BackgroundTaskListParams("conv-1", " ", 100), ArgumentException);
    Assert.throws(() => new BackgroundTaskListParams("conv-1", null, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new BackgroundTaskListParams("conv-1", null, 501), ArgumentOutOfRangeException);
    Assert.throws(() => new BackgroundTaskListParams("conv-1", null, 1.5), ArgumentOutOfRangeException);
    Assert.areEqual(500, new BackgroundTaskListParams("conv-1", null, 500).limit);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const limit = Assert.throws(() => BackgroundTaskListParams.fromJson({ ...BackgroundTaskListParamsTests.json, limit: "many" }), JsonException);
    const after = Assert.throws(() => BackgroundTaskListParams.fromJson({ ...BackgroundTaskListParamsTests.json, afterTaskId: 9 }), JsonException);

    Assert.areEqual("$.limit:$.afterTaskId", [limit.path, after.path].join(":"));
  }
}
