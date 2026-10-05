/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliFailureTests {
  @TestMethod
  public async reportsThatNoRuntimeIsRunningWithoutStartingOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();

    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));
    const json = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));
    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands", "--no-start"]));

    Assert.areEqual(3, status.code);
    Assert.areEqual(`No runtime is running for ${fixture.dataDirectory}.\n`, status.error);
    Assert.areEqual(3, json.code);
    Assert.areEqual(JSON.stringify({ code: "NoRuntime", message: `No runtime is running for ${fixture.dataDirectory}.` }), json.error.trim());
    Assert.areEqual(3, commands.code);
    Assert.isFalse(existsSync(new DataDirectory(fixture.dataDirectory).logsFolder), "no runtime was started");
  }

  @TestMethod
  public async refusesAnotherBuildsRuntimeUnlessTakingItOver(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using older = await ProbeBuildFixture.createAsync("0.0.0");
    await using newer = await ProbeBuildFixture.createAsync("999.0.0");
    const host = await fixture.startHostAsync(newer.declarationsFile);

    const fromNewer = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]), newer);
    const fromOlder = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]), older);
    const work = host.work.begin("Indexing the project");
    const busy = await fixture.runAsync(fixture.withDataDirectory(["commands", "--take-over", "--json"]), newer);
    work[Symbol.dispose]();
    const takenOver = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "\"taken\"", "--take-over"]), newer);

    Assert.areEqual(4, fromNewer.code);
    const refusal = JSON.parse(fromNewer.error);
    Assert.areEqual("BuildMismatch", refusal.code);
    Assert.areEqual(RuntimeBuild.identity.fingerprint, refusal.details.identity.fingerprint);
    Assert.areEqual(4, fromOlder.code);
    Assert.areEqual("BuildMismatch", JSON.parse(fromOlder.error).code);
    Assert.areEqual(4, busy.code);
    Assert.areEqual(JSON.stringify({ descriptions: ["Indexing the project"] }), JSON.stringify(JSON.parse(busy.error).details));
    Assert.areEqual(0, takenOver.code, takenOver.error);
    Assert.areEqual("\"taken\"\n", takenOver.output);
    Assert.areEqual("request", await host.waitForStopAsync());
  }

  @TestMethod
  public async reportsDataFromBeforeTheShellWithoutMovingIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await mkdir(fixture.dataDirectory, { recursive: true });
    const old = path.join(fixture.dataDirectory, "teamrun.db");
    await writeFile(old, "old data");
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]));

    Assert.areEqual(5, result.code);
    const failure = JSON.parse(result.error);
    Assert.areEqual("PreShellData", failure.code);
    Assert.areEqual(fixture.dataDirectory, failure.details.location);
    Assert.areEqual("old data", await readFile(old, "utf8"));
  }

  @TestMethod
  public async reportsADataDirectoryItCannotUse(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const file = path.join(fixture.root, "file");
    await writeFile(file, "not a folder");

    const result = await fixture.runAsync(["commands", "--data-dir", path.join(file, "data")], build);

    Assert.areEqual(5, result.code);
    Assert.isTrue(result.error.startsWith("The data directory cannot be used: "), result.error);
  }

  @TestMethod
  public async reportsARuntimeOfAnotherProgram(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const discoveryFile = new DataDirectory(fixture.dataDirectory).discoveryFile;
    const discovery = JSON.parse(await readFile(discoveryFile, "utf8"));
    await writeFile(discoveryFile, JSON.stringify({ ...discovery, token: "x".repeat(String(discovery.token).length) }));

    const result = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]));

    Assert.areEqual(5, result.code);
    Assert.areEqual("Unauthorized", JSON.parse(result.error).code);
  }

  @TestMethod
  public async reportsARuntimeThatEndsDuringACommandAndOneThatCannotStart(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const marker = path.join(new DataDirectory(fixture.dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.WAITING_MARKER);

    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]), build);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    await fixture.stopRuntimeAsync();
    const lost = await running;
    const broken = { identity: new BuildIdentity("1.0.0", RuntimeBuild.identity.protocolVersion, "broken"), entryPath: path.join(fixture.root, "missing-entry.js") };
    const notStarted = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]), broken as unknown as ProbeBuildFixture);

    Assert.areEqual(1, lost.code);
    Assert.areEqual("Unavailable", JSON.parse(lost.error).code);
    Assert.areEqual(1, notStarted.code);
    Assert.areEqual("Failed", JSON.parse(notStarted.error).code);
  }

  @TestMethod
  public async letsAnUnexpectedErrorReachItsCaller(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const starter = { startAsync: (): Promise<number> => Promise.reject(new RangeError("The starter broke.")) };

    const run = fixture.runAsync(fixture.withDataDirectory(["commands"]), null, fixture.environment, "", starter);

    Assert.areEqual("The starter broke.", (await Assert.throwsAsync(() => run, RangeError)).message);
  }
}
