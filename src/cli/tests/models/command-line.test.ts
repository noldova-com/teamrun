/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandLine, UsageException } from "@noldova/teamrun-cli";

@TestClass
export class CommandLineTests {
  @TestMethod
  public parsesWordsOptionsAndFlags(): void {
    const line = CommandLine.parse(["send", "conv", "hello there", "--provider", "codex", "--json", "--approve", "--effort", "high"]);
    const empty = CommandLine.parse([]);

    Assert.areEqual("send", line.command);
    Assert.areEqual("conv,hello there", line.positionals.join(","));
    Assert.areEqual("codex", line.option("provider"));
    Assert.areEqual("high", line.requireOption("effort"));
    Assert.isTrue(line.hasFlag("json"));
    Assert.isTrue(line.hasFlag("approve"));
    Assert.isNull(line.option("json"));
    Assert.isNull(line.option("missing"));
    Assert.areEqual("conv", line.requirePositional(0, "conversationId"));
    Assert.isNull(line.positional(5));
    Assert.isNull(empty.command);
    Assert.areEqual("The option --model is required.", Assert.throws(() => line.requireOption("model"), UsageException).message);
    Assert.areEqual("The argument <text> is required.", Assert.throws(() => empty.requirePositional(0, "text"), UsageException).message);
  }
}
