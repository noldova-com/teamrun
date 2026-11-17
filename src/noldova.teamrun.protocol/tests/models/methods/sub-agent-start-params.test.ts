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
import { SubAgentStartParams } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentStartParamsTests {
  private static readonly json: object = { senderToken: "token-1", agent: "helper", description: "Check the tests", brief: "Run the tests and say what fails." };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = SubAgentStartParams.fromJson(SubAgentStartParamsTests.json);

    Assert.areEqual(JSON.stringify(SubAgentStartParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new SubAgentStartParams(String.empty, "helper", "Check", "Brief"), ArgumentException);
    Assert.throws(() => new SubAgentStartParams("token-1", " ", "Check", "Brief"), ArgumentException);
    Assert.throws(() => new SubAgentStartParams("token-1", "helper", String.empty, "Brief"), ArgumentException);
    Assert.throws(() => new SubAgentStartParams("token-1", "helper", "Check", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => SubAgentStartParams.fromJson({ ...SubAgentStartParamsTests.json, brief: " " }), JsonException);

    Assert.areEqual("$.brief", exception.path);
  }
}
