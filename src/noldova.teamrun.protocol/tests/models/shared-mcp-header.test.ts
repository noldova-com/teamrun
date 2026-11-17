/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpHeader } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpHeaderTests {
  @TestMethod
  public namesAHeaderAndTheVariableThatHoldsItsValue(): void {
    const json = { name: "X-Api-Key", variable: "SEARCH_KEY" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpHeader.fromJson(json).toJson()));
    Assert.areEqual("$.input.variable", Assert.throws(() => SharedMcpHeader.fromJson({ name: "X-Api-Key" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public refusesAHeaderNameThatIsNoTokenAndAVariableNameThatIsNoName(): void {
    Assert.areEqual("name", Assert.throws(() => new SharedMcpHeader("X Api", "KEY"), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new SharedMcpHeader("", "KEY"), ArgumentException).parameterName);
    Assert.areEqual("variable", Assert.throws(() => new SharedMcpHeader("X-Api-Key", "1KEY"), ArgumentException).parameterName);
    Assert.areEqual("variable", Assert.throws(() => new SharedMcpHeader("X-Api-Key", "${KEY}"), ArgumentException).parameterName);
  }
}
