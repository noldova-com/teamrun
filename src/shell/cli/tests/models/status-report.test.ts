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
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class StatusReportTests {
  @TestMethod
  public async reportsTheRuntimeItsModulesAndItsWork(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const host = await fixture.startHostAsync(build.declarationsFile);
    const identity = RuntimeBuild.identity;

    const idle = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const work = host.work.begin("Indexing the project");
    const busy = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const json = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));
    work[Symbol.dispose]();

    Assert.areEqual(0, idle.code);
    Assert.areEqual(
      `Runtime: TeamRun ${identity.productVersion} (build ${identity.fingerprint})\nData directory: ${fixture.dataDirectory}\nModules: probe (active)\nWork in progress: none\n`,
      idle.output);
    Assert.isTrue(busy.output.endsWith("Work in progress: Indexing the project\n"));
    Assert.areEqual(
      JSON.stringify({ build: identity.toJson(), dataDirectory: fixture.dataDirectory, modules: [{ id: "probe", state: "Active" }], work: ["Indexing the project"] }),
      json.output.trim());
  }

  @TestMethod
  public async reportsARuntimeWithoutModules(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const declarations = path.join(fixture.root, "declarations.json");
    await writeFile(declarations, "{\"formatVersion\":1,\"modules\":[]}");
    await fixture.startHostAsync(declarations);

    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const json = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));

    Assert.areEqual(0, status.code);
    Assert.isTrue(status.output.includes("Modules: none\n"), status.output);
    Assert.areEqual("[]", JSON.stringify((JSON.parse(json.output) as { modules: unknown }).modules));
  }

  @TestMethod
  public async reportsAFailedModule(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const declarations = path.join(fixture.root, "declarations.json");
    const missing = { id: "broken", version: "0.0.1", displayName: "Broken", description: "Fails to load.", dependencies: [], runtimePackage: "@noldova/teamrun-fixture-missing-runtime", contributes: {} };
    await writeFile(declarations, JSON.stringify({ formatVersion: 1, modules: [missing] }));
    await fixture.startHostAsync(declarations);

    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const json = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));

    Assert.areEqual(0, status.code);
    Assert.isTrue(status.output.includes("Modules: broken (failed: "), status.output);
    Assert.areEqual(
      JSON.stringify([{ id: "broken", state: "Failed", cause: "Its runtime part could not be loaded." }]),
      JSON.stringify((JSON.parse(json.output) as { modules: unknown }).modules));
  }
}
