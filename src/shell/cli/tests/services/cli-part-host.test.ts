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
export class CliPartHostTests {
  @TestMethod
  public async startsOnlyTheTargetsPartAndItsDependenciesInDeclarationOrderAndStopsThemInReverse(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const text = await fixture.runModuleAsync(build.declarationsFile, ["needy", "run"]);
    const log = await build.readPartsLogAsync();
    const json = await fixture.runModuleAsync(build.declarationsFile, ["needy", "run", "--json"]);

    Assert.areEqual(0, text.code, text.error);
    Assert.areEqual("Needy ran.\n", text.output);
    Assert.areEqual("activate probe\nactivate needy\ndeactivate needy\ndeactivate probe\n", log);
    Assert.areEqual(0, json.code, json.error);
    Assert.areEqual("\"needy\"\n", json.output);
  }

  @TestMethod
  public async refusesAModuleWhosePartCannotStartAsNotActiveAndStopsThePartsItStarted(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const missing = "Its command-line part does not export a CliPart class with activateAsync and deactivateAsync.";
    const failed = "Its command-line part failed to start: ";
    const cases: readonly (readonly [string, string])[] = [
      ["hollow", missing],
      ["nameless", missing],
      ["inert", missing],
      ["halfway", missing],
      ["clumsy", `${failed}The clumsy part tripped.`],
      ["greedy", `${failed}greedy.extra is not a command-line command that greedy declares. (Parameter 'name')`],
      ["doubled", `${failed}doubled.run is registered already. (Parameter 'name')`]
    ];

    for (const [id, reason] of cases) {
      const result = await fixture.runModuleAsync(build.declarationsFile, [id, "run"]);
      const json = await fixture.runModuleAsync(build.declarationsFile, [id, "run", "--json"]);

      Assert.areEqual(7, result.code, id);
      Assert.areEqual(`The module ${id} is not active: ${reason}\n`, result.error);
      Assert.areEqual(JSON.stringify({ code: "ModuleNotActive", message: `The module ${id} is not active: ${reason}`, details: { module: id, cause: reason } }),
        json.error.trimEnd());
    }
    const absent = await fixture.runModuleAsync(build.declarationsFile, ["absent", "run"]);
    const unregistered = await fixture.runModuleAsync(build.declarationsFile, ["probe", "unregistered"]);

    Assert.areEqual(7, absent.code);
    Assert.isTrue(absent.error.startsWith(`The module absent is not active: ${failed}`), absent.error);
    Assert.areEqual(7, unregistered.code);
    Assert.areEqual("The module probe is not active: Its command-line part did not register probe.unregistered.\n", unregistered.error);
    Assert.areEqual("activate probe\ndeactivate probe\n", await build.readPartsLogAsync());
  }
}
