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
export class CliCommandResultTests {
  @TestMethod
  public async printsItsTextEndingInOneLineEndOrItsValueAsJson(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const unended = await fixture.runModuleAsync(build, ["needy", "run"]);
    const ended = await fixture.runModuleAsync(build, ["probe", "call-runtime", "hi"]);
    const quiet = await fixture.runModuleAsync(build, ["probe", "stay-quiet"]);
    const quietJson = await fixture.runModuleAsync(build, ["probe", "stay-quiet", "--json"]);

    Assert.areEqual("Needy ran.\n", unended.output);
    Assert.areEqual("The runtime answered hi.\n", ended.output);
    Assert.areEqual(0, quiet.code, quiet.error);
    Assert.areEqual("", quiet.output);
    Assert.areEqual("", quiet.error);
    Assert.areEqual(0, quietJson.code, quietJson.error);
    Assert.areEqual("null\n", quietJson.output);
  }
}
