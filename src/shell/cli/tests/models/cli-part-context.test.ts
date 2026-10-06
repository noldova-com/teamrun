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

    const needy = await fixture.runModuleAsync(build, ["needy", "run", "--json"]);
    const text = await fixture.runModuleAsync(build, ["probe", "call-runtime", "hi"]);
    const json = await fixture.runModuleAsync(build, ["probe", "call-runtime", "hi", "--json"]);

    Assert.areEqual("{\"pong\":\"needy\"}\n", needy.output);
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

    const result = await fixture.runModuleAsync(build, ["probe", "call-missing", "--json"]);

    Assert.areEqual(1, result.code, result.error);
    Assert.areEqual("{\"code\":\"UnknownMethod\",\"message\":\"The method probe.missing is not registered.\"}\n", result.error);
    Assert.areEqual("", result.output);
    Assert.areEqual("activate probe\ndeactivate probe\n", await build.readPartsLogAsync());
  }

  @TestMethod
  public async refusesAMethodThatIsMalformedOrBelongsToAModuleItDoesNotDependOn(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const other = await fixture.runModuleAsync(build, ["probe", "call-other", "--json"]);
    const malformed = await fixture.runModuleAsync(build, ["probe", "call-malformed"]);

    Assert.areEqual(1, other.code, other.error);
    Assert.areEqual(JSON.stringify({
      code: "Failed",
      message: "The command failed: ArgumentException: needy.secret is not a method of probe or of a module it depends on. (Parameter 'method')"
    }), other.error.trimEnd());
    Assert.areEqual(1, malformed.code, malformed.error);
    Assert.isTrue(malformed.error.startsWith("The command failed: ArgumentException: "), malformed.error);
    Assert.areEqual("", `${other.output}${malformed.output}`);
  }
}
