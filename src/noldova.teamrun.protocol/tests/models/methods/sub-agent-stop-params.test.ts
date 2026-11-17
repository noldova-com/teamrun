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
import { SubAgentStopParams } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentStopParamsTests {
  private static readonly json: object = { senderToken: "token-1", subAgentId: "sub-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = SubAgentStopParams.fromJson(SubAgentStopParamsTests.json);

    Assert.areEqual(JSON.stringify(SubAgentStopParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new SubAgentStopParams(String.empty, "sub-1"), ArgumentException);
    Assert.throws(() => new SubAgentStopParams("token-1", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => SubAgentStopParams.fromJson({ senderToken: "token-1" }), JsonException);

    Assert.areEqual("$.subAgentId", exception.path);
  }
}
