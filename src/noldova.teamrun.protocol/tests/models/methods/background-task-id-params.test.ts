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
import { BackgroundTaskIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskIdParamsTests {
  private static readonly json: object = { taskId: "task-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = BackgroundTaskIdParams.fromJson(BackgroundTaskIdParamsTests.json);

    Assert.areEqual(JSON.stringify(BackgroundTaskIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new BackgroundTaskIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => BackgroundTaskIdParams.fromJson({ taskId: " " }), JsonException);

    Assert.areEqual("$.taskId", exception.path);
  }
}
