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
import { SubAgentWaitParams } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentWaitParamsTests {
  private static readonly json: object = { senderToken: "token-1", subAgentIds: ["sub-1", "sub-2"], seconds: 50 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = SubAgentWaitParams.fromJson(SubAgentWaitParamsTests.json);

    Assert.areEqual(JSON.stringify(SubAgentWaitParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(0, new SubAgentWaitParams("token-1", [], 0).seconds);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new SubAgentWaitParams(String.empty, [], 10), ArgumentException);
    Assert.throws(() => new SubAgentWaitParams("token-1", ["sub-1", " "], 10), ArgumentException);
    for (const seconds of [-1, 1.5, 51])
      Assert.throws(() => new SubAgentWaitParams("token-1", [], seconds), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => SubAgentWaitParams.fromJson({ ...SubAgentWaitParamsTests.json, subAgentIds: "sub-1" }), JsonException);

    Assert.areEqual("$.subAgentIds", exception.path);
  }
}
