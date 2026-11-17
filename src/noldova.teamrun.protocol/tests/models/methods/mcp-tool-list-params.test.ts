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
import { McpToolListParams } from "@noldova/teamrun.protocol";

@TestClass
export class McpToolListParamsTests {
  private static readonly json: object = { token: "t-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = McpToolListParams.fromJson(McpToolListParamsTests.json);

    Assert.areEqual(JSON.stringify(McpToolListParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new McpToolListParams(" "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => McpToolListParams.fromJson({ token: String.empty }), JsonException);

    Assert.areEqual("$.token", exception.path);
  }
}
