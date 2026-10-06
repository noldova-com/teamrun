/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliTests {
  @TestMethod
  public async usesTheGivenDataDirectoryOrElseTheDevelopmentOrPersonalOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const development = { ...fixture.environment, [CliFixture.CHECKOUT_VARIABLE]: fixture.root };

    const personal = await fixture.runAsync(["status"]);
    const checkout = await fixture.runAsync(["status"], null, development);
    const variable = await fixture.runAsync(["status"], null, { ...development, [CliFixture.DATA_DIRECTORY_VARIABLE]: path.join(fixture.root, "chosen") });
    const relative = await fixture.runAsync(["status", "--data-dir=relative-data"]);

    Assert.areEqual(`No runtime is running for ${path.join(fixture.homeFolder, ".noldova", "teamrun")}.\n`, personal.error);
    Assert.areEqual(`No runtime is running for ${path.join(fixture.root, "_build", "data")}.\n`, checkout.error);
    Assert.areEqual(`No runtime is running for ${path.join(fixture.root, "chosen")}.\n`, variable.error);
    Assert.areEqual(`No runtime is running for ${path.resolve("relative-data")}.\n`, relative.error);
  }

  @TestMethod
  public async passesACommandsArgumentsFromTheCommandLineAFileOrStandardInput(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const argumentsFile = path.join(fixture.root, "arguments.json");
    await writeFile(argumentsFile, "{\"from\":\"file\"}");

    const inline = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"from\":\"line\"}", "--json"]));
    const file = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", argumentsFile, "--json"]));
    const input = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "-", "--json"]), null, fixture.environment, "[1,2]");

    Assert.areEqual("{\"from\":\"line\"}\n", inline.output);
    Assert.areEqual("{\"from\":\"file\"}\n", file.output);
    Assert.areEqual("[1,2]\n", input.output);
  }

  @TestMethod
  public async refusesInvalidArguments(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const missing = path.join(fixture.root, "missing.json");

    const invalid = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{a"]));
    const unreadable = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", missing]));
    const badName = await fixture.runAsync(fixture.withDataDirectory(["run", "Not a name"]));

    Assert.areEqual(2, invalid.code);
    Assert.isTrue(invalid.error.startsWith("The command's arguments are not valid JSON: "), invalid.error);
    Assert.areEqual(2, unreadable.code);
    Assert.isTrue(unreadable.error.startsWith(`The arguments file ${missing} could not be read: `), unreadable.error);
    Assert.areEqual(2, badName.code);
  }

  @TestMethod
  public async startsARuntimeThatLaterCallsAttachTo(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");

    const first = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "1"]), build);
    const processId = await fixture.readRuntimeProcessIdAsync();
    const second = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "2", "--no-start"]), build);
    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]), build);

    Assert.areEqual(0, first.code, first.error);
    Assert.areEqual("1\n", first.output);
    Assert.isNotNull(processId);
    Assert.areNotEqual(process.pid, processId);
    Assert.areEqual("2\n", second.output);
    Assert.areEqual(processId, await fixture.readRuntimeProcessIdAsync());
    Assert.isTrue(status.output.includes("Modules: probe (active)\n"), status.output);
  }

  @TestMethod
  public async opensTheDesktopWithTheSameDataDirectory(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const development = { ...fixture.environment, [CliFixture.CHECKOUT_VARIABLE]: fixture.root, ELECTRON_RUN_AS_NODE: "1" };
    const developmentData = path.join(fixture.root, "_build", "data");

    const fromCheckout = await fixture.runAsync(["open"], null, development);
    const installed = await fixture.runAsync(fixture.withDataDirectory(["open", "--json"]));
    fixture.opener.failure = new Error("No such program.");
    const failed = await fixture.runAsync(fixture.withDataDirectory(["open"]));

    Assert.areEqual(0, fromCheckout.code);
    Assert.areEqual(`TeamRun is opening with ${developmentData}.\n`, fromCheckout.output);
    const [checkoutOpen, installedOpen] = fixture.opener.opened;
    Assert.areEqual(process.execPath, checkoutOpen?.executable);
    Assert.areEqual(
      JSON.stringify([path.join(fixture.root, "node_modules", "@noldova", "teamrun-shell-desktop", "main.js"), `--data-dir=${developmentData}`]),
      JSON.stringify(checkoutOpen?.launchArguments));
    Assert.isUndefined(checkoutOpen?.environment["ELECTRON_RUN_AS_NODE"]);
    Assert.areEqual(JSON.stringify([`--data-dir=${fixture.dataDirectory}`]), JSON.stringify(installedOpen?.launchArguments));
    Assert.areEqual(JSON.stringify({ dataDirectory: fixture.dataDirectory }), installed.output.trim());
    Assert.areEqual(1, failed.code);
    Assert.areEqual("TeamRun could not be started.\n", failed.error);
  }

  @TestMethod
  public async stopsAModuleCommandAtItsTimeoutOrAnInterruptionAndThenItsParts(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const marker = build.locate(ProbeBuildFixture.CLI_WAITING_MARKER);

    const timedOut = await fixture.runModuleAsync(build, ["probe", "wait-forever", "--timeout", "1", "--json"]);
    const isSettled = await Wait.untilAsync(async () => await build.readPartsLogAsync() !== "activate probe\n", 15_000);
    const afterTimeout = await build.readPartsLogAsync();
    await rm(marker, { force: true });
    await rm(build.locate(ProbeBuildFixture.PARTS_LOG), { force: true });
    const running = fixture.runModuleAsync(build, ["probe", "wait-forever", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code, timedOut.error);
    Assert.areEqual("DeadlineExceeded", (JSON.parse(timedOut.error) as { code: string }).code);
    Assert.isTrue(isSettled && ["", "activate probe\ndeactivate probe\n"].includes(afterTimeout), afterTimeout);
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", (JSON.parse(interrupted.error) as { code: string }).code);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
    Assert.areEqual("activate probe\ndeactivate probe\n", await build.readPartsLogAsync());
  }

  @TestMethod
  public async stopsAModuleCommandWhosePartNeverFinishesStartingWithoutWaitingForThatPart(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const marker = build.locate(ProbeBuildFixture.STALLED_MARKER);

    const timedOut = await fixture.runModuleAsync(build, ["stalled", "run", "--timeout", "1", "--json"]);
    const afterTimeout = await build.readPartsLogAsync();
    await rm(marker, { force: true });
    await rm(build.locate(ProbeBuildFixture.PARTS_LOG), { force: true });
    const running = fixture.runModuleAsync(build, ["stalled", "run", "--json"]);
    await ProbeBuildFixture.waitUntilWaitingAsync(marker);
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code, timedOut.error);
    Assert.areEqual("DeadlineExceeded", (JSON.parse(timedOut.error) as { code: string }).code);
    Assert.areEqual(6, interrupted.code, interrupted.error);
    Assert.areEqual("Cancelled", (JSON.parse(interrupted.error) as { code: string }).code);
    Assert.isTrue(["", "activate stalled\n"].includes(afterTimeout), afterTimeout);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
    Assert.areEqual("activate stalled\n", await build.readPartsLogAsync());
  }
}
