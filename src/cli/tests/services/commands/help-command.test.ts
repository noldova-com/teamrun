/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class HelpCommandTests {
  @TestMethod
  public async printsUsageAndEveryCommand(): Promise<void> {
    await using host = await CliTestHost.create();

    const code = await host.run("help");

    Assert.areEqual(0, code);
    Assert.areEqual("Usage: teamrun <command> [arguments] [--data-dir <path>] [--json]", host.console.lines[0]);
    Assert.areEqual("Commands:", host.console.lines[1]);
    Assert.areEqual(34, host.console.lines.length);
    Assert.isTrue(host.console.lines.some(t => t.startsWith("  live-check")));
  }
}
