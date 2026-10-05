/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";

@TestClass
export class CommandLineTests {
  @TestMethod
  public async explainsItsUsageWhenAskedAndWhenGivenNoCommand(): Promise<void> {
    await using fixture = await CliFixture.createAsync();

    const help = await fixture.runAsync(["help"]);
    const flag = await fixture.runAsync(["status", "--help"]);
    const none = await fixture.runAsync([]);

    Assert.areEqual(0, help.code);
    Assert.isTrue(help.output.startsWith("Usage: teamrun <command> [options]\n"));
    Assert.areEqual(help.output, flag.output);
    Assert.areEqual(2, none.code);
    Assert.areEqual(`A command is required.\n\n${help.output}`, none.error);
    Assert.areEqual("", none.output);
  }

  @TestMethod
  public async refusesAnInvalidCommandLineWithTheUsageExitCode(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const cases: readonly (readonly [readonly string[], string])[] = [
      [["frobnicate"], "\"frobnicate\" is not a command."],
      [["status", "--bogus"], "\"--bogus\" is not an option."],
      [["status", "--json=yes"], "\"--json=yes\" is not an option."],
      [["status", "--timeout", "5"], "The --timeout option does not apply to status."],
      [["open", "--args-file", "a.json"], "The --args-file option does not apply to open."],
      [["status", "--no-start"], "The --no-start option does not apply to status."],
      [["open", "--take-over"], "The --take-over option does not apply to open."],
      [["status", "extra"], "\"extra\" was not expected."],
      [["run"], "The run command needs the name of a command to run."],
      [["run", "probe.echo", "{}", "extra"], "\"extra\" was not expected."],
      [["run", "probe.echo", "{}", "--args-file", "a.json"], "The command's arguments were given more than once."],
      [["run", "probe.echo", "--timeout", "0"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "0.5"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "1.5"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "-1"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "3601"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "soon"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "1e400"], "The --timeout option takes a whole number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout"], "The --timeout option needs a value."],
      [["status", "--data-dir="], "The --data-dir option needs a value."]
    ];

    for (const [commandLine, message] of cases) {
      const result = await fixture.runAsync(commandLine);

      Assert.areEqual(2, result.code, commandLine.join(" "));
      Assert.isTrue(result.error.startsWith(`${message}\n\nUsage: `), `${commandLine.join(" ")}: ${result.error}`);
    }
  }
}
