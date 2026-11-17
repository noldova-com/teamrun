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
import { McpToolCallParams } from "@noldova/teamrun.protocol";

@TestClass
export class McpToolCallParamsTests {
  private static readonly json: object = { token: "t-1", name: "teamrun_list_chats", arguments: { project_id: "p1" } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = McpToolCallParams.fromJson(McpToolCallParamsTests.json);

    Assert.areEqual(JSON.stringify(McpToolCallParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("p1", value.arguments["project_id"]);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new McpToolCallParams(" ", "teamrun_list_chats", {}), ArgumentException);
    Assert.throws(() => new McpToolCallParams("t-1", String.empty, {}), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.name", Assert.throws(() => McpToolCallParams.fromJson({ ...McpToolCallParamsTests.json, name: " " }), JsonException).path);
    Assert.areEqual("$.arguments", Assert.throws(() => McpToolCallParams.fromJson({ ...McpToolCallParamsTests.json, arguments: [] }), JsonException).path);
  }
}
