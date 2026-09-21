/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessCommand } from "@noldova/teamrun-providers";

@TestClass
export class ProcessCommandTests {
  @TestMethod
  public copiesArgumentsAndAppendsMore(): void {
    const args = ["a"];
    const command = new ProcessCommand("node", args);
    args.push("mutated");

    const extended = command.withArguments("b", "c");

    Assert.areEqual("a", command.arguments.join(","));
    Assert.areEqual("a,b,c", extended.arguments.join(","));
    Assert.areEqual("node", extended.executable);
    Assert.areEqual("executable", Assert.throws(() => new ProcessCommand(" ", []), ArgumentException).parameterName);
  }
}
