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
export class ModuleCallTests {
  @TestMethod
  public async readsArgumentsAndOptionsInAnyOrderWithTheirDefaultsAsOneFrozenObject(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const mixed = await fixture.runModuleAsync(build.declarationsFile, ["probe", "echo-values", "hi", "--level", "2", "--tag", "a", "there", "--loud", "--tag=b", "more"]);
    const json = await fixture.runModuleAsync(build.declarationsFile, ["probe", "echo-values", "--json", "hi", "--level=-2.5", "--times", "0.5", "--note=--x", "--prefix", "-"]);

    Assert.areEqual(0, mixed.code, mixed.error);
    Assert.areEqual("{\"text\":\"hi\",\"moreText\":[\"there\",\"more\"],\"times\":1,\"loud\":true,\"tag\":[\"a\",\"b\"],\"level\":2,\"prefix\":\"Probe\"} (frozen)\n", mixed.output);
    Assert.areEqual(0, json.code, json.error);
    Assert.areEqual("{\"text\":\"hi\",\"times\":0.5,\"level\":-2.5,\"prefix\":\"-\",\"note\":\"--x\"}\n", json.output);
  }

  @TestMethod
  public async takesEverythingAfterTheEndOfOptionsAsArguments(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runModuleAsync(build.declarationsFile, ["probe", "echo-values", "--level", "1", "--", "--tag", "--json", "--", "-x"]);

    Assert.areEqual(0, result.code, result.error);
    Assert.areEqual("{\"text\":\"--tag\",\"moreText\":[\"--json\",\"--\",\"-x\"],\"times\":1,\"level\":1,\"prefix\":\"Probe\"} (frozen)\n", result.output);
  }

  @TestMethod
  public async refusesACallItsDeclarationDoesNotAllowWithTheCommandsUsageBeforeAnyRuntimeStarts(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    const echo = ["probe", "echo-values"];
    const cases: readonly (readonly [readonly string[], string])[] = [
      [[...echo, "--level", "1"], "The <text> argument is required."],
      [[...echo, "hi"], "The --level option is required."],
      [[...echo, "hi", "--level", "1", "--bogus"], "\"--bogus\" is not an option."],
      [[...echo, "hi", "--level", "x"], "The --level option takes a number, not \"x\"."],
      [[...echo, "hi", "--level", "1.", "--loud"], "The --level option takes a number, not \"1.\"."],
      [[...echo, "hi", "--level", "1", "--loud=yes"], "The --loud option takes no value."],
      [[...echo, "hi", "--level"], "The --level option needs a value."],
      [[...echo, "hi", "--level", "1", "--note", "--loud"], "The --note option needs a value."],
      [[...echo, "hi", "--level", "1", "--level", "2"], "The --level option was given more than once."],
      [[...echo, "hi", "--level", "1", "--loud", "--loud"], "The --loud option was given more than once."],
      [["probe", "call-runtime", "a", "b"], "\"b\" was not expected."],
      [["probe", "stay-quiet", "x"], "\"x\" was not expected."]
    ];

    for (const [commandLineArguments, message] of cases) {
      const result = await fixture.runModuleAsync(build.declarationsFile, commandLineArguments);
      const help = await fixture.runModuleAsync(build.declarationsFile, ["help", ...commandLineArguments.slice(0, 2)]);

      Assert.areEqual(2, result.code, commandLineArguments.join(" "));
      Assert.areEqual(`${message}\n\n${help.output}`, result.error);
      Assert.areEqual("", result.output);
    }
    Assert.isNull(await fixture.readRuntimeProcessIdAsync());
  }
}
