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
import { WindowIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class WindowIdParamsTests {
  private static readonly json: object = { windowId: "window-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = WindowIdParams.fromJson(WindowIdParamsTests.json);

    Assert.areEqual(JSON.stringify(WindowIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new WindowIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => WindowIdParams.fromJson({ windowId: " " }), JsonException);

    Assert.areEqual("$.windowId", exception.path);
  }
}
