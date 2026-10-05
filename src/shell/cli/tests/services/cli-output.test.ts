/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliOutputTests {
  private static readonly NOTE: string = "Commands of TeamRun's window are not reachable from the command line.";

  @TestMethod
  public async writesTheCommandsAndACommandsResultAsTextOrJson(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);

    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands"]));
    const commandsJson = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]));
    const result = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"a\":1}"]));
    const resultJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"a\":1}", "--json"]));
    const none = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo"]));
    const noneJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--json"]));

    Assert.areEqual(0, commands.code);
    Assert.areEqual(`probe.echo  Echo\nprobe.fail  Fail\nprobe.wait  Wait\n\n${CliOutputTests.NOTE}\n`, commands.output);
    Assert.areEqual(
      JSON.stringify({ commands: [{ name: "probe.echo", title: "Echo", module: "probe" }, { name: "probe.fail", title: "Fail", module: "probe" }, { name: "probe.wait", title: "Wait", module: "probe" }] }),
      commandsJson.output.trim());
    Assert.areEqual("{\n  \"a\": 1\n}\n", result.output);
    Assert.areEqual("{\"a\":1}\n", resultJson.output);
    Assert.areEqual("", none.output);
    Assert.areEqual(0, none.code);
    Assert.areEqual("null\n", noneJson.output);
  }

  @TestMethod
  public async saysWhenNoCommandsAreAvailable(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const declarations = path.join(fixture.root, "declarations.json");
    await writeFile(declarations, "{\"formatVersion\":1,\"modules\":[]}");
    await fixture.startHostAsync(declarations);

    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands"]));
    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));

    Assert.areEqual(`No commands are available.\n\n${CliOutputTests.NOTE}\n`, commands.output);
    Assert.isTrue(status.output.includes("Modules: none\n"));
  }
}
