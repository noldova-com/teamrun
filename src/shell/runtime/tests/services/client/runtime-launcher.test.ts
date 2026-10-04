/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Failure, FailureCode, PreShellData, QualifiedName, ShellMethods, StopPolicy } from "@noldova/teamrun-shell-protocol";
import {
  AttachOptions,
  BuildMismatchException,
  ConnectionException,
  LaunchException,
  LaunchSettings,
  MethodFailureException,
  NoRuntimeException,
  OwnershipLock,
  PreShellDataFoundException,
  Refusal,
  RuntimeBuild,
  RuntimeEntry,
  RuntimeHandoverException,
  RuntimeLauncher,
  WorkInProgressException
} from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "../../fixtures/client-listener.fixture.js";
import { FakeRuntimeFixture } from "../../fixtures/fake-runtime.fixture.js";
import { RuntimeBuildFixture } from "../../fixtures/runtime-build.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { RuntimeLaunchFixture } from "../../fixtures/runtime-launch.fixture.js";
import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { ScriptedStarterFixture } from "../../fixtures/scripted-starter.fixture.js";

@TestClass
export class RuntimeLauncherTests {
  private static readonly PROBE_COUNT: QualifiedName = new QualifiedName("probe", "count");
  private static readonly PROBE_PART: string = [
    "import { Migration } from \"@noldova/teamrun-shell-runtime\";",
    "export class RuntimePart {",
    "  migrations = [new Migration(\"create-entries\", [\"CREATE TABLE entries (value TEXT NOT NULL) STRICT\"])];",
    "  async activateAsync(context) {",
    "    const database = context.database;",
    "    context.registerMethod(\"probe.count\", { handleAsync: async () => {",
    "      database.run(\"INSERT INTO entries (value) VALUES ('entry')\");",
    "      return { entries: database.readAll(\"SELECT value FROM entries\").length };",
    "    } });",
    "  }",
    "  async deactivateAsync() {}",
    "}"
  ].join("\n");
  @TestMethod
  public async startsARuntimeAndStopsItOnRequest(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const client = await new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity).attachAsync("desktop", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const response = await client.stopAsync(StopPolicy.IfIdle);

    Assert.isNull(client.handover);
    Assert.isFalse(response.hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId), "the runtime process exits");
    Assert.isFalse(OwnershipLock.isOwned(launch.dataDirectory));
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual("runtime.log", (await readdir(launch.dataDirectory.logsFolder)).join(","), "the start log is removed once attached");
  }

  @TestMethod
  public async clientsStartingTogetherShareOneRuntime(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const launchers = [1, 2, 3].map(() => new RuntimeLauncher(launch.createSettings(1_000), RuntimeBuild.identity));

    const clients = await Promise.all(launchers.map((t, index) => t.attachAsync(`client${index}`, new ClientListenerFixture())));
    const processId = await launch.readProcessIdAsync();
    const listener = new ClientListenerFixture();
    const late = await new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity).attachAsync("late", listener);

    Assert.areEqual(3, clients.filter(t => t.isConnected).length);
    Assert.areEqual(processId, await launch.readProcessIdAsync());
    Assert.isFalse((await late.stopAsync(StopPolicy.IfIdle)).hasFailed);
    await listener.disconnectedAsync;
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async anIdleRuntimeEndsItsProcess(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const listener = new ClientListenerFixture();
    const client = await new RuntimeLauncher(launch.createSettings(300), RuntimeBuild.identity).attachAsync("desktop", listener);
    const processId = await launch.readProcessIdAsync();

    client.close();

    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId), "the idle runtime's process exits");
    Assert.isFalse(OwnershipLock.isOwned(launch.dataDirectory));
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual(1, listener.disconnections);
  }

  @TestMethod
  public async aNewerBuildTakesOverAnOlderRuntime(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using older = await RuntimeBuildFixture.createAsync("0.0.0");
    const olderClient = await new RuntimeLauncher(launch.createSettings(30_000, older.entryPath), older.identity).attachAsync("older", new ClientListenerFixture());
    const olderProcessId = await launch.readProcessIdAsync();
    olderClient.close();

    const client = await new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity).attachAsync("desktop", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    Assert.isNull(client.handover);
    Assert.areNotEqual(olderProcessId, processId);
    Assert.isFalse(RuntimeLaunchFixture.isRunning(olderProcessId));
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async anOlderBuildHandsOverToANewerRuntime(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using newer = await RuntimeBuildFixture.createAsync("999.0.0");
    const newerClient = await new RuntimeLauncher(launch.createSettings(30_000, newer.entryPath), newer.identity).attachAsync("newer", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const handover = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity).attachAsync("desktop", new ClientListenerFixture()),
      RuntimeHandoverException);

    Assert.areEqual("999.0.0", handover.handover.identity.productVersion);
    Assert.areEqual(newer.identity.fingerprint, handover.handover.identity.fingerprint);
    Assert.areEqual(process.execPath, handover.handover.executablePath);
    Assert.isTrue(RuntimeLaunchFixture.isRunning(processId), "the newer runtime keeps running");
    Assert.isFalse((await newerClient.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async aModuleWhoseRuntimePartImportsTheRuntimesApiActivatesInTheRuntimesProcess(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using build = await RuntimeBuildFixture.createWithModuleAsync("0.0.0", "probe", "probe.count", RuntimeLauncherTests.PROBE_PART);
    const client = await new RuntimeLauncher(launch.createSettings(30_000, build.entryPath), build.identity).attachAsync("desktop", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const response = await client.callAsync(RuntimeLauncherTests.PROBE_COUNT, null);

    Assert.areEqual("{\"entries\":1}", JSON.stringify(response.payload));
    Assert.isTrue(existsSync(launch.dataDirectory.locateModuleDatabase("probe")));
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public reportsWorkInProgressInsteadOfTakingOver(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      const host = await fixture.startAsync();
      host.work.begin("Indexing the project");
      const newer = new BuildIdentity("999.0.0", BuildIdentity.supportedProtocolVersion, "newer-build");

      const exception = await Assert.throwsAsync(() => new RuntimeLauncher(settings, newer).attachAsync("desktop", new ClientListenerFixture()), WorkInProgressException);

      Assert.areEqual("Indexing the project", exception.work.descriptions.join(","));
      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory), "the runtime keeps running");
    });
  }

  @TestMethod
  public startsNothingWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const settings = new LaunchSettings(fixture.dataDirectory, path.join(fixture.root, "missing-program"), RuntimeEntry.entryPath, {}, process.platform, 1_000, 1_000, 25);

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false)),
        NoRuntimeException);

      Assert.areEqual(`No runtime is running for ${fixture.dataDirectory.root}.`, exception.message);
      Assert.isFalse(existsSync(fixture.dataDirectory.logsFolder), "no start was tried");
    });
  }

  @TestMethod
  public attachesToARunningRuntimeWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      const host = await fixture.startAsync();

      const client = await new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false));

      Assert.isTrue(client.isConnected);
      Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public refusesAnotherBuildsRuntimeWhenToldNotToTakeOver(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      await fixture.startAsync();
      const newer = new BuildIdentity("999.0.0", BuildIdentity.supportedProtocolVersion, "newer-build");

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(settings, newer).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(true, false)),
        BuildMismatchException);

      Assert.areEqual(RuntimeBuild.identity.fingerprint, exception.handover.identity.fingerprint);
      Assert.areEqual(process.execPath, exception.handover.executablePath);
      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory), "the runtime keeps running");
    });
  }

  @TestMethod
  public refusesToAttachToARuntimeHoldingDataFromBeforeTheShell(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      await mkdir(fixture.dataDirectory.root, { recursive: true });
      await writeFile(path.join(fixture.dataDirectory.root, "teamrun.db"), "old data");
      await fixture.startAsync();
      const launcher = new RuntimeLauncher(settings, RuntimeBuild.identity);

      const exception = await Assert.throwsAsync(() => launcher.attachAsync("desktop", new ClientListenerFixture()), PreShellDataFoundException);
      const client = await launcher.moveAsideAsync("desktop", new ClientListenerFixture());
      const again = await launcher.moveAsideAsync("desktop", new ClientListenerFixture());

      Assert.areEqual(fixture.dataDirectory.root, exception.data.location);
      Assert.isTrue(client.isConnected);
      Assert.isNull(client.preShellData);
      Assert.isNull(again.preShellData);
      Assert.isFalse(existsSync(path.join(fixture.dataDirectory.root, "teamrun.db")));
    });
  }

  @TestMethod
  public reportsAFailedMoveAside(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const failure = new Failure(FailureCode.PreShellData, "Move it.", new PreShellData(fake.dataDirectory.root).toJson());
      fake.server.server.refuse(new Refusal(failure, ShellMethods.moveAside));
      fake.server.methods.register(ShellMethods.moveAside, { handleAsync: () => Promise.reject(new MethodFailureException(new Failure(FailureCode.Internal, "The disk is full."))) });

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).moveAsideAsync("desktop", new ClientListenerFixture()),
        LaunchException);

      Assert.areEqual("The runtime could not move the old data aside: The disk is full.", exception.message);
    });
  }

  @TestMethod
  public async reportsAnOlderRuntimeThatRefusesToStop(): Promise<void> {
    for (const failure of [new Failure(FailureCode.Internal, "It broke."), new Failure(FailureCode.Conflict, "It is busy.")]) {
      await RuntimeLauncherTests.runWithFakeAsync(async fake => {
        fake.server.methods.register(ShellMethods.stop, { handleAsync: () => Promise.reject(new MethodFailureException(failure)) });

        const exception = await Assert.throwsAsync(
          () => new RuntimeLauncher(fake.createSettings(), FakeRuntimeFixture.NEWER).attachAsync("desktop", new ClientListenerFixture(), StopPolicy.StopWork),
          LaunchException);

        Assert.areEqual(`The other build's runtime refused to stop: ${failure.message}`, exception.message);
      });
    }
  }

  @TestMethod
  public givesUpOnAnOlderRuntimeThatDoesNotStop(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      fake.server.methods.register(ShellMethods.stop, { handleAsync: () => Promise.resolve(null) });

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(300), FakeRuntimeFixture.NEWER).attachAsync("desktop", new ClientListenerFixture()),
        LaunchException);

      Assert.areEqual("The other build's runtime did not stop in time.", exception.message);
    });
  }

  @TestMethod
  public givesUpAtItsTimeoutOnARuntimeItCannotReachAndDidNotStart(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await fake.server.server.closeAsync();

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(300, 600), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        LaunchException);

      Assert.areEqual("The runtime did not start in time.", exception.message);
    });
  }

  @TestMethod
  public passesOnARefusedConnection(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        ConnectionException);

      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
    }, "wrong-token");
  }

  @TestMethod
  public passesOnUnreadableDiscovery(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        Error);
    }, undefined, "tcp://127.0.0.1:port");
  }

  @TestMethod
  public reportsARuntimeThatCannotStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const missing = path.join(fixture.root, "missing-program");
      const settings = new LaunchSettings(fixture.dataDirectory, missing, RuntimeEntry.entryPath, {}, "win32", 1_000, 1_000, 25);

      const exception = await Assert.throwsAsync(() => new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("desktop", new ClientListenerFixture()), LaunchException);

      Assert.areEqual(`The runtime could not be started with ${missing}.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }


  @TestMethod
  public async reportsARuntimeThatExitsWhileStarting(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const token = "9f".repeat(32);
    const starter = new ScriptedStarterFixture(
      `console.error("Cannot open " + ${JSON.stringify(path.join(homedir(), "data"))} + " with token ${token}"); process.exit(1);`);
    const started = Date.now();

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.isTrue(Date.now() - started < 3_000, "the launcher stops waiting well before its time limit");
    Assert.areEqual(`The runtime exited while starting: Cannot open ${path.join("~", "data")} with token [redacted]`, exception.message);
    Assert.isFalse(exception.message.includes(token));
    Assert.isFalse(exception.message.includes(homedir()));
    const request = starter.requests[0] ?? [];
    const name = request[request.indexOf("--start-log") + 1];
    Assert.isTrue(/^start-[0-9a-f-]{36}\.log$/.test(String(name)));
    Assert.areEqual(path.join(launch.dataDirectory.logsFolder, String(name)), starter.errorFiles[0]);
    Assert.areEqual("", (await readdir(launch.dataDirectory.logsFolder)).join(","), "the start log is removed after reading it");
  }

  @TestMethod
  public async reportsARuntimeThatExitsWithoutAReason(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, new ScriptedStarterFixture("process.exit(1);")).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.areEqual("The runtime exited while starting and left no reason.", exception.message);
  }

  @TestMethod
  public async removesItsStartLogWhenTheRuntimeNeverStarts(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const starter = new ScriptedStarterFixture("setTimeout(() => {}, 1000);");
    const settings = new LaunchSettings(launch.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 1_000, 400, 25);

    const exception = await Assert.throwsAsync(() => new RuntimeLauncher(settings, RuntimeBuild.identity, starter).attachAsync("desktop", new ClientListenerFixture()), LaunchException);

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.areEqual("", (await readdir(launch.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
  }

  @TestMethod
  public async waitsPastItsTimeoutWhileTheRuntimeItStartedRunsAndTheDirectoryIsOwned(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setTimeout(() => {}, 1500);");
    const started = Date.now();
    const publishing = delay(600).then(() => fake.publishAsync());

    const client = await new RuntimeLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture());
    client.close();
    await publishing;

    Assert.isTrue(Date.now() - started >= 600, "the launcher waited for the runtime past its timeout");
    Assert.areEqual(1, starter.processIds.length);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
  }

  @TestMethod
  public async givesUpAtItsLimitOnARuntimeThatNeverStarts(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setTimeout(() => {}, 1500);");
    const started = Date.now();

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(fake.createSettings(200, 800), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.isTrue(Date.now() - started >= 800, "the launcher waited until its limit");
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
  }

  @TestMethod
  public async stopsWaitingAtItsTimeoutOnceTheRuntimeItStartedHasExited(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("process.exit(0);");

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(fake.createSettings(400, 20_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.areEqual("The runtime did not start in time.", exception.message);
  }

  private static async runWithHostAsync(test: (fixture: RuntimeHostFixture, settings: LaunchSettings) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture, new LaunchSettings(fixture.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 30_000, 5_000, 25));
  }

  private static async runWithFakeAsync(test: (fake: FakeRuntimeFixture) => Promise<void>, token?: string, endpoint?: string): Promise<void> {
    await using fake = await FakeRuntimeFixture.startAsync(token, endpoint);
    await test(fake);
  }
}
