/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandFlags } from "@noldova/teamrun.providers";

@TestClass
export class CommandFlagsTests {
  @TestMethod
  public keepsEveryFlag(): void {
    const flags = new CommandFlags("in", "A", "e", ["--hidden"], ["--glob"], "--regexp");

    Assert.areEqual("in", flags.letters);
    Assert.areEqual("A", flags.valueLetters);
    Assert.areEqual("e", flags.patternLetter);
    Assert.areEqual("--hidden", flags.names.join(","));
    Assert.areEqual("--glob", flags.valueNames.join(","));
    Assert.areEqual("--regexp", flags.patternName);
  }
}
