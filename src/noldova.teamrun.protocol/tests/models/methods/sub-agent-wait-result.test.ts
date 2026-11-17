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
import { SubAgent, SubAgentStatus, SubAgentWaitResult } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentWaitResultTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const ended = new SubAgent("sub-1", "Helper", "Check the tests", "model-1", SubAgentStatus.Completed, true, 2, 120, 900, "All pass.");
    const json = { ended: [ended.toJson()], running: ["sub-2"] };

    const value = SubAgentWaitResult.fromJson(json);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual(JSON.stringify(["All pass."]), JSON.stringify(value.ended.map(t => t.summary)));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new SubAgentWaitResult([], [" "]), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const row = new SubAgent("sub-1", "Helper", "Check the tests", null, SubAgentStatus.Completed, true).toJson();

    const exception = Assert.throws(() => SubAgentWaitResult.fromJson({ ended: [{ ...row, status: "Lost" }], running: [] }), JsonException);

    Assert.areEqual("$.ended.0.status", exception.path);
  }
}
