/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, ShellMethods, UpdateReady, UpdateRequest } from "@noldova/teamrun-shell-protocol";
import {
  DataDirectory, Installation, LaunchSettings, ProcessPresence, RuntimeBuild, RuntimeEntry, RuntimeLauncher, SystemCommand, UpdateBarrier, UpdateBarrierState
} from "@noldova/teamrun-shell-runtime";

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
  public async reportsAnUnknownCommandAndOneThatFails(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);

    const unknown = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.nothing", "--json"]));
    const refused = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail"]));
    const refusedJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail", "--json"]));

    Assert.areEqual(1, unknown.code);
    Assert.areEqual("NotFound", JSON.parse(unknown.error).code);
    Assert.areEqual(1, refused.code);
    Assert.areEqual("The runtime failed to handle the request.\n", refused.error);
    Assert.areEqual("{\"code\":\"Internal\",\"message\":\"The runtime failed to handle the request.\"}\n", refusedJson.error);
  }

  @TestMethod
  public async reportsACommandStoppedAtItsTimeoutOrByAnInterruption(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const marker = ProbeBuildFixture.markerPath(fixture.dataDirectory);

    const timedOut = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--timeout", "1", "--json"]));
    await rm(marker, { force: true });
    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]));
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code);
    Assert.areEqual("DeadlineExceeded", JSON.parse(timedOut.error).code);
    Assert.areEqual(6, interrupted.code);
    Assert.areEqual("Cancelled", JSON.parse(interrupted.error).code);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async reportsARuntimeThatEndsDuringACommandAndOneThatCannotStart(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    const marker = ProbeBuildFixture.markerPath(fixture.dataDirectory);

    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]), build);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    await fixture.stopRuntimeAsync();
    const lost = await running;
    const broken = { identity: new BuildIdentity("1.0.0", RuntimeBuild.identity.protocolVersion, "broken"), entryPath: path.join(fixture.root, "missing-entry.js") };
    const notStarted = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]), broken as unknown as ProbeBuildFixture);

    Assert.areEqual(1, lost.code);
    Assert.areEqual("Disconnected", JSON.parse(lost.error).code);
    Assert.areEqual(1, notStarted.code);
    Assert.areEqual("Failed", JSON.parse(notStarted.error).code);
  }

  @TestMethod
  public async reportsACommandLeftUnansweredOnAnOpenConnectionAsUnavailable(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");

    let unanswered: { code: number; output: string; error: string };
    try {
      unanswered = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.block", "--timeout", "1", "--json"]), build);
    }
    finally {
      await writeFile(ProbeBuildFixture.releasePath(fixture.dataDirectory), "yes");
    }
    const answered = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "1", "--json"]), build);

    Assert.areEqual(1, unanswered.code);
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The runtime did not answer shell.runCommand in time." }), JSON.stringify(JSON.parse(unanswered.error)));
    Assert.isTrue(existsSync(ProbeBuildFixture.markerPath(fixture.dataDirectory)), "the probe's command started blocking the runtime");
    Assert.areEqual(0, answered.code);
    Assert.areEqual("1\n", answered.output);
  }

  @TestMethod
  public async letsAnUnexpectedErrorReachItsCaller(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const starter = { startAsync: (): Promise<number> => Promise.reject(new RangeError("The starter broke.")) };

    const run = fixture.runAsync(fixture.withDataDirectory(["commands"]), null, fixture.environment, "", starter);

    Assert.areEqual("The starter broke.", (await Assert.throwsAsync(() => run, RangeError)).message);
  }

  @TestMethod
  public async reportsAnUpdateStillUnderWayAfterWaitingForIt(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const device = path.join(fixture.root, "device");
    await CliFailureTests.holdBarrierAsync(Installation.locate(device, process.execPath, process.platform));
    const started = Date.now();

    const waited = await fixture.runAsync(fixture.withDataDirectory(["commands", "--device-dir", device, "--json"]), null, { ...fixture.environment, SystemRoot: process.env["SystemRoot"] }, "", undefined, 300);

    Assert.areEqual(8, waited.code);
    Assert.areEqual(JSON.stringify({ code: "Updating", message: "TeamRun is installing an update." }), waited.error.trim());
    Assert.isTrue(Date.now() - started >= 300);
    Assert.isFalse(existsSync(new DataDirectory(fixture.dataDirectory).logsFolder), "no runtime was started");
  }

  @TestMethod
  public async answersARuntimePreparingForAnUpdateAndReportsTheUpdate(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const installation = Installation.locate(fixture.deviceFolder, process.execPath, process.platform);
    await CliFailureTests.holdBarrierAsync(installation);
    const settings = new LaunchSettings(new DataDirectory(fixture.dataDirectory), process.execPath, RuntimeEntry.entryPath, fixture.environment, process.platform);
    const desktop = await new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("desktop", { onEvent: () => undefined, onDisconnected: () => undefined });

    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]));
    await ProbeBuildFixture.waitUntilWaitingAsync(ProbeBuildFixture.markerPath(fixture.dataDirectory));
    const prepared = await desktop.callAsync(ShellMethods.update, new UpdateRequest(installation).toJson());
    const answered = await running;
    const refused = await fixture.runAsync(fixture.withDataDirectory(["status", "--json"]), null, fixture.environment, "", undefined, 300);
    desktop.close();

    Assert.areEqual(`${process.pid} cli`, UpdateReady.fromJson(prepared.payload).processes.map(t => `${t.processId} ${t.role}`).join("|"));
    Assert.areEqual(8, answered.code);
    Assert.areEqual("Updating", JSON.parse(answered.error).code);
    Assert.areEqual(8, refused.code);
    Assert.areEqual(JSON.stringify({ code: "Updating", message: "TeamRun is preparing to install an update." }), refused.error.trim());
  }

  private static async holdBarrierAsync(folder: string): Promise<void> {
    const [holder] = await ProcessPresence.create(process.platform, new SystemCommand(), process.env).stampAsync([[process.pid, "desktop"]]);
    Assert.isDefined(holder);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "barrier.json"), JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing).toJson()));
  }
}
