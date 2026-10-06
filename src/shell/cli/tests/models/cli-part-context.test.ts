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
export class CliPartContextTests {
  @TestMethod
  public async givesAPartItsModuleIdAndTheRuntimesMethods(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const needy = await fixture.runModuleAsync(build.declarationsFile, ["needy", "run", "--json"]);
    const text = await fixture.runModuleAsync(build.declarationsFile, ["probe", "call-runtime", "hi"]);
    const json = await fixture.runModuleAsync(build.declarationsFile, ["probe", "call-runtime", "hi", "--json"]);

    Assert.areEqual("\"needy\"\n", needy.output);
    Assert.areEqual(0, text.code, text.error);
    Assert.areEqual("The runtime answered hi.\n", text.output);
    Assert.areEqual(0, json.code, json.error);
    Assert.areEqual("{\"pong\":\"hi\"}\n", json.output);
  }

  @TestMethod
  public async reportsTheRuntimesFailureForAMethodItDoesNotHave(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runModuleAsync(build.declarationsFile, ["probe", "call-missing", "--json"]);

    Assert.areEqual(1, result.code, result.error);
    Assert.areEqual("{\"code\":\"UnknownMethod\",\"message\":\"The method probe.missing is not registered.\"}\n", result.error);
    Assert.areEqual("", result.output);
    Assert.areEqual("activate probe\ndeactivate probe\n", await build.readPartsLogAsync());
  }
}
