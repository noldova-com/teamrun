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
export class ModuleNotActiveExceptionTests {
  @TestMethod
  public async isReportedWithItsExitCodeTheRuntimesCauseAndTheModuleThatBlocksIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const status = await fixture.runModuleAsync(build, ["status", "--json"]);
    const modules = (JSON.parse(status.output) as { modules: { id: string; cause?: string }[] }).modules;
    const cause = (id: string): string => String(modules.find(t => t.id === id)?.cause);

    const failing = await fixture.runModuleAsync(build, ["failing", "run"]);
    const blocked = await fixture.runModuleAsync(build, ["blocked", "run", "--json"]);

    Assert.areEqual(7, failing.code, failing.error);
    Assert.areEqual(`The module failing is not active: ${cause("failing")}\n`, failing.error);
    Assert.areEqual(7, blocked.code, blocked.error);
    Assert.areEqual(JSON.stringify({
      code: "ModuleNotActive",
      message: `The module blocked is not active: ${cause("blocked")}`,
      details: { module: "blocked", cause: cause("blocked"), blockedBy: "failing" }
    }), blocked.error.trimEnd());
    Assert.areEqual("", await build.readPartsLogAsync());
  }

  @TestMethod
  public async isReportedForARuntimeCommandOnlyWhenItsModuleIsNotActive(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const failing = await fixture.runModuleAsync(build, ["run", "failing.run", "--json"]);
    const unknownModule = await fixture.runModuleAsync(build, ["run", "nosuch.run", "--json"]);
    const unknownCommand = await fixture.runModuleAsync(build, ["run", "probe.nope", "--json"]);

    Assert.areEqual(7, failing.code, failing.error);
    Assert.areEqual("ModuleNotActive", (JSON.parse(failing.error) as { code: string }).code);
    Assert.areEqual(1, unknownModule.code, unknownModule.error);
    Assert.areEqual("NotFound", (JSON.parse(unknownModule.error) as { code: string }).code);
    Assert.areEqual(1, unknownCommand.code, unknownCommand.error);
    Assert.areEqual("NotFound", (JSON.parse(unknownCommand.error) as { code: string }).code);
  }

  @TestMethod
  public async isReportedForAModuleTheRunningRuntimeDoesNotHave(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using plain = await ProbeBuildFixture.createAsync("1.0.0");
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(plain.declarationsFile);

    const result = await fixture.runModuleAsync(build, ["needy", "run"]);

    Assert.areEqual(7, result.code, result.error);
    Assert.areEqual("The module needy is not active: The runtime does not have it.\n", result.error);
    Assert.areEqual("", await build.readPartsLogAsync());
  }
}
