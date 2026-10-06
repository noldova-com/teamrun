/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliHelpTests {
  private static readonly PROBE_HELP: string = [
    "Usage: teamrun probe <command> [options]",
    "",
    "Probe: Probe answers the command line tests.",
    "",
    "Commands:",
    "  echo-values     Runs probe.echoValues.",
    "  call-runtime    Runs probe.callRuntime.",
    "  call-missing    Runs probe.callMissing.",
    "  wait-forever    Runs probe.waitForever.",
    "  fail-with-code  Runs probe.failWithCode.",
    "  refuse          Runs probe.refuse.",
    "  stay-quiet      Runs probe.stayQuiet.",
    "  unregistered    Runs probe.unregistered.",
    "",
    "Run \"teamrun help probe <command>\" for a command's arguments and options.",
    ""
  ].join("\n");

  @TestMethod
  public async listsEachModulesCommandsUnderItsNameAfterTheCommandLinesOwnWithoutAModuleThatHasNone(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    const plain = await fixture.runAsync(["help"]);

    const help = await fixture.runModuleAsync(build.declarationsFile, ["help"]);
    const flag = await fixture.runModuleAsync(build.declarationsFile, ["status", "--help"]);
    const word = await fixture.runModuleAsync(build.declarationsFile, ["help", "status"]);

    Assert.areEqual(0, help.code, help.error);
    Assert.isTrue(help.output.startsWith(`${plain.output}\nModule commands:\n  Probe\n    teamrun probe echo-values     Runs probe.echoValues.\n`), help.output);
    Assert.isTrue(help.output.includes("\n  Needy\n    teamrun needy run             Runs needy.run.\n  hollow\n"), help.output);
    Assert.isTrue(help.output.endsWith("\n  Blocked\n    teamrun blocked run           Runs blocked.run.\n"), help.output);
    Assert.isFalse(help.output.includes("\n  Quiet\n"), help.output);
    Assert.areEqual(help.output, flag.output);
    Assert.areEqual(help.output, word.output);
    Assert.isNull(await fixture.readRuntimeProcessIdAsync());
  }

  @TestMethod
  public async listsOneModulesCommandsOrSaysItHasNone(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);

    const help = await fixture.runModuleAsync(build.declarationsFile, ["help", "probe"]);
    const flag = await fixture.runModuleAsync(build.declarationsFile, ["probe", "--help"]);
    const unknown = await fixture.runModuleAsync(build.declarationsFile, ["probe", "nope", "--help"]);
    const quiet = await fixture.runModuleAsync(build.declarationsFile, ["help", "quiet"]);

    Assert.areEqual(0, help.code, help.error);
    Assert.areEqual(CliHelpTests.PROBE_HELP, help.output);
    Assert.areEqual(help.output, flag.output);
    Assert.areEqual(help.output, unknown.output);
    Assert.areEqual("Usage: teamrun quiet <command> [options]\n\nQuiet: Quiet answers the command line tests.\n\nCommands:\n  It has no commands.\n", quiet.output);
  }

  @TestMethod
  public async printsACommandsUsageDescriptionArgumentsOptionsAndExamples(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    const expected = [
      "Usage: teamrun probe echo-values <text> [<more-text>...] [--times <number>] [--loud] [--tag <text>]... --level <number> [--prefix <text>] [--note <text>]",
      "",
      "Echoes the values it was given.",
      "",
      "Arguments:",
      "  <text>          The text.",
      "  <more-text>...  More text. Optional.",
      "",
      "Options:",
      "  --times <number>  The times. Default: 1.",
      "  --loud            The loud.",
      "  --tag <text>      The tag. Repeatable.",
      "  --level <number>  The level. Required.",
      "  --prefix <text>   The prefix. Default: Probe.",
      "  --note <text>     The note.",
      "",
      "Examples:",
      "  teamrun probe echo-values hello --level 2",
      "    Echoes hello.",
      "  teamrun probe echo-values",
      "    Fails for want of a level.",
      ""
    ].join("\n");

    const help = await fixture.runModuleAsync(build.declarationsFile, ["help", "probe", "echo-values"]);
    const flag = await fixture.runModuleAsync(build.declarationsFile, ["probe", "echo-values", "--help", "--bogus"]);
    const call = await fixture.runModuleAsync(build.declarationsFile, ["help", "probe", "call-runtime"]);
    const quiet = await fixture.runModuleAsync(build.declarationsFile, ["help", "probe", "stay-quiet"]);

    Assert.areEqual(0, help.code, help.error);
    Assert.areEqual(expected, help.output);
    Assert.areEqual(0, flag.code, flag.error);
    Assert.areEqual(expected, flag.output);
    Assert.areEqual("Usage: teamrun probe call-runtime <text>\n\nRuns probe.callRuntime.\n\nArguments:\n  <text>  The text.\n", call.output);
    Assert.areEqual("Usage: teamrun probe stay-quiet\n\nRuns probe.stayQuiet.\n", quiet.output);
    Assert.isNull(await fixture.readRuntimeProcessIdAsync());
  }

  @TestMethod
  public async refusesAnUnknownModuleCommandOrExtraWordWithTheUsageItConcerns(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    const usage = (await fixture.runAsync(["help"])).output;
    const cases: readonly (readonly [readonly string[], string, string])[] = [
      [["help", "nope"], "\"nope\" is not a command.", usage],
      [["nope", "run"], "\"nope\" is not a command.", usage],
      [["help", "probe", "nope"], "\"nope\" is not a command of probe.", CliHelpTests.PROBE_HELP],
      [["help", "probe", "echo-values", "extra"], "\"extra\" was not expected.", CliHelpTests.PROBE_HELP],
      [["probe"], "probe needs one of its commands.", CliHelpTests.PROBE_HELP],
      [["probe", "nope"], "\"nope\" is not a command of probe.", CliHelpTests.PROBE_HELP],
      [["probe", "--loud", "echo-values"], "\"--loud\" is not a command of probe.", CliHelpTests.PROBE_HELP]
    ];

    for (const [commandLineArguments, message, help] of cases) {
      const result = await fixture.runModuleAsync(build.declarationsFile, commandLineArguments);

      Assert.areEqual(2, result.code, commandLineArguments.join(" "));
      Assert.areEqual(`${message}\n\n${help}`, result.error);
    }
  }
}
