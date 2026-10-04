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
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliTests {
  private static readonly NOTE: string = "Commands of TeamRun's window are not reachable from the command line.";
  private static readonly WAIT_LIMIT: number = 15_000;

  @TestMethod
  public async explainsItsUsageWhenAskedAndWhenGivenNoCommand(): Promise<void> {
    await using fixture = await CliFixture.createAsync();

    const help = await fixture.runAsync(["help"]);
    const flag = await fixture.runAsync(["status", "--help"]);
    const none = await fixture.runAsync([]);

    Assert.areEqual(0, help.code);
    Assert.isTrue(help.output.startsWith("Usage: teamrun <command> [options]\n"));
    Assert.areEqual(help.output, flag.output);
    Assert.areEqual(2, none.code);
    Assert.areEqual(`A command is required.\n\n${help.output}`, none.error);
    Assert.areEqual("", none.output);
  }

  @TestMethod
  public async refusesAnInvalidCommandLineWithTheUsageExitCode(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const cases: readonly (readonly [readonly string[], string])[] = [
      [["frobnicate"], "\"frobnicate\" is not a command."],
      [["status", "--bogus"], "\"--bogus\" is not an option."],
      [["status", "--json=yes"], "\"--json=yes\" is not an option."],
      [["status", "--timeout", "5"], "The --timeout option does not apply to status."],
      [["open", "--args-file", "a.json"], "The --args-file option does not apply to open."],
      [["status", "--no-start"], "The --no-start option does not apply to status."],
      [["open", "--take-over"], "The --take-over option does not apply to open."],
      [["status", "extra"], "\"extra\" was not expected."],
      [["run"], "The run command needs the name of a command to run."],
      [["run", "probe.echo", "{}", "extra"], "\"extra\" was not expected."],
      [["run", "probe.echo", "{}", "--args-file", "a.json"], "The command's arguments were given more than once."],
      [["run", "probe.echo", "--timeout", "0"], "The --timeout option takes a number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "3601"], "The --timeout option takes a number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout", "soon"], "The --timeout option takes a number of seconds from 1 to 3600."],
      [["run", "probe.echo", "--timeout"], "The --timeout option needs a value."],
      [["status", "--data-dir="], "The --data-dir option needs a value."]
    ];

    for (const [commandLine, message] of cases) {
      const result = await fixture.runAsync(commandLine);

      Assert.areEqual(2, result.code, commandLine.join(" "));
      Assert.isTrue(result.error.startsWith(`${message}\n\nUsage: `), `${commandLine.join(" ")}: ${result.error}`);
    }
    const json = await fixture.runAsync(["--json", "status", "--bogus"]);
    Assert.areEqual(2, json.code);
    Assert.areEqual("{\"code\":\"Usage\",\"message\":\"\\\"--bogus\\\" is not an option.\"}\n", json.error);
    Assert.areEqual("", json.output);
  }

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
  public async reportsARuntimeWithoutModulesAndAFailedModule(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const declarations = path.join(fixture.root, "declarations.json");
    const missing = { id: "broken", displayName: "Broken", description: "Fails to load.", dependencies: [], runtimePackage: "@noldova/teamrun-fixture-missing-runtime", contributes: {} };
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

  @TestMethod
  public async listsTheRuntimesCommandsAndRunsThem(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const argumentsFile = path.join(fixture.root, "arguments.json");
    await writeFile(argumentsFile, "{\"from\":\"file\"}");

    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands"]));
    const commandsJson = await fixture.runAsync(fixture.withDataDirectory(["commands", "--json"]));
    const inline = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"a\":1}"]));
    const inlineJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{\"a\":1}", "--json"]));
    const none = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo"]));
    const noneJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--json"]));
    const file = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", argumentsFile, "--json"]));
    const input = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "-", "--json"]), null, fixture.environment, "[1,2]");

    Assert.areEqual(0, commands.code);
    Assert.areEqual(`probe.echo  Echo\nprobe.fail  Fail\nprobe.wait  Wait\n\n${CliTests.NOTE}\n`, commands.output);
    Assert.areEqual(
      JSON.stringify({ commands: [{ name: "probe.echo", title: "Echo", module: "probe" }, { name: "probe.fail", title: "Fail", module: "probe" }, { name: "probe.wait", title: "Wait", module: "probe" }] }),
      commandsJson.output.trim());
    Assert.areEqual("{\n  \"a\": 1\n}\n", inline.output);
    Assert.areEqual("{\"a\":1}\n", inlineJson.output);
    Assert.areEqual("", none.output);
    Assert.areEqual(0, none.code);
    Assert.areEqual("null\n", noneJson.output);
    Assert.areEqual("{\"from\":\"file\"}\n", file.output);
    Assert.areEqual("[1,2]\n", input.output);
  }

  @TestMethod
  public async saysWhenNoCommandsAreAvailable(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const declarations = path.join(fixture.root, "declarations.json");
    await writeFile(declarations, "{\"formatVersion\":1,\"modules\":[]}");
    await fixture.startHostAsync(declarations);

    const commands = await fixture.runAsync(fixture.withDataDirectory(["commands"]));
    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));

    Assert.areEqual(`No commands are available.\n\n${CliTests.NOTE}\n`, commands.output);
    Assert.isTrue(status.output.includes("Modules: none\n"));
  }

  @TestMethod
  public async refusesInvalidArgumentsAndReportsACommandThatFails(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const missing = path.join(fixture.root, "missing.json");

    const invalid = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "{a"]));
    const unreadable = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.echo", "--args-file", missing]));
    const badName = await fixture.runAsync(fixture.withDataDirectory(["run", "Not a name"]));
    const unknown = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.nothing", "--json"]));
    const refused = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail"]));
    const refusedJson = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.fail", "--json"]));

    Assert.areEqual(2, invalid.code);
    Assert.isTrue(invalid.error.startsWith("The command's arguments are not valid JSON: "), invalid.error);
    Assert.areEqual(2, unreadable.code);
    Assert.isTrue(unreadable.error.startsWith(`The arguments file ${missing} could not be read: `), unreadable.error);
    Assert.areEqual(2, badName.code);
    Assert.areEqual(1, unknown.code);
    Assert.areEqual("NotFound", JSON.parse(unknown.error).code);
    Assert.areEqual(1, refused.code);
    Assert.areEqual("The runtime failed to handle the request.\n", refused.error);
    Assert.areEqual("{\"code\":\"Internal\",\"message\":\"The runtime failed to handle the request.\"}\n", refusedJson.error);
  }

  @TestMethod
  public async stopsACommandAtItsTimeoutAndWhenInterrupted(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0");
    await fixture.startHostAsync(build.declarationsFile);
    const marker = path.join(new DataDirectory(fixture.dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.WAITING_MARKER);

    const timedOut = await fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--timeout", "0.2", "--json"]));
    await rm(marker, { force: true });
    const running = fixture.runAsync(fixture.withDataDirectory(["run", "probe.wait", "--json"]));
    await CliTests.waitForAsync(() => existsSync(marker));
    fixture.signals.emit("SIGINT");
    const interrupted = await running;

    Assert.areEqual(6, timedOut.code);
    Assert.areEqual("DeadlineExceeded", JSON.parse(timedOut.error).code);
    Assert.areEqual(6, interrupted.code);
    Assert.areEqual("Cancelled", JSON.parse(interrupted.error).code);
    Assert.areEqual(0, fixture.signals.listenerCount("SIGINT"));
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
    await CliTests.waitForAsync(() => existsSync(marker));
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

  private static async waitForAsync(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + CliTests.WAIT_LIMIT;
    while (!condition() && Date.now() < deadline)
      await delay(10);
    Assert.isTrue(condition());
  }
}
