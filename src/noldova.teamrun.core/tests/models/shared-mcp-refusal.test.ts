/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpRefusal } from "@noldova/teamrun.core";

@TestClass
export class SharedMcpRefusalTests {
  @TestMethod
  public keepsTheReasonAndItsFewWordsOrNoneByDefault(): void {
    const refusal = new SharedMcpRefusal("TeamRun doesn't pass shared MCP servers to Pi yet.", "not passed yet");

    Assert.areEqual(JSON.stringify(["TeamRun doesn't pass shared MCP servers to Pi yet.", "not passed yet"]),
      JSON.stringify([refusal.reason, refusal.short]));
    Assert.isNull(new SharedMcpRefusal("Why.").short);
    Assert.isNull(new SharedMcpRefusal("Why.", null).short);
  }

  @TestMethod
  public refusesABlankReasonOrABlankShortForm(): void {
    Assert.areEqual("reason", Assert.throws(() => new SharedMcpRefusal(" "), ArgumentException).parameterName);
    Assert.areEqual("short", Assert.throws(() => new SharedMcpRefusal("Why.", " "), ArgumentException).parameterName);
  }
}
