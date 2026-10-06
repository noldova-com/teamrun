/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Failure, FailureCode, PreShellData, QualifiedName, ShellMethods, StopPolicy } from "@noldova/teamrun-shell-protocol";
import {
  AttachOptions,
  BuildMismatchException,
  ConnectionException,
  type IProcessStarter,
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
  UpdateBarrierStatus,
  UpdateInProgressException,
  WorkInProgressException
} from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "../../fixtures/client-listener.fixture.js";
import { FakeRuntimeFixture } from "../../fixtures/fake-runtime.fixture.js";
import { RuntimeBuildFixture } from "../../fixtures/runtime-build.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { RuntimeLaunchFixture } from "../../fixtures/runtime-launch.fixture.js";
import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { ScriptedStarterFixture } from "../../fixtures/scripted-starter.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

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
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("desktop", new ClientListenerFixture());
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
  public async startsARuntimeThatJoinsItsInstallation(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const client = await new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, launch.starter).attachAsync("desktop", new ClientListenerFixture());

    const recorded = await readdir(installation.recordFolder);
    await client.stopAsync(StopPolicy.IfIdle);

    Assert.areEqual(1, recorded.length);
  }

  @TestMethod
  public async startsNoRuntimeWhileAnUpdateHoldsItsInstallation(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    await UpdateBarrierFixture.holdAsync(installation);

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, launch.starter).attachAsync("desktop", new ClientListenerFixture()),
      UpdateInProgressException);

    Assert.areEqual(UpdateBarrierStatus.Held, exception.status);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.isFalse(existsSync(installation.recordFolder));
  }

  @TestMethod
  public async reportsAnUpdateWhenTheRuntimeItStartedExitsForABarrierThatAppearedMeanwhile(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const starter: IProcessStarter = {
      startAsync: async (executable, launchArguments, environment, errorFile) => {
        await UpdateBarrierFixture.holdAsync(installation);
        return await launch.starter.startAsync(executable, launchArguments, environment, errorFile);
      }
    };

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, starter).attachAsync("desktop", new ClientListenerFixture()),
      UpdateInProgressException);

    Assert.areEqual(UpdateBarrierStatus.Held, exception.status);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual(1, (await readdir(installation.recordFolder)).length);
  }

  @TestMethod
  public async reportsTheExitWhenTheBarrierCannotBeReadOnceTheRuntimeItStartedHasExited(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const starter: IProcessStarter = {
      startAsync: async (executable, launchArguments, environment, errorFile) => {
        await mkdir(installation.barrierFile, { recursive: true });
        return await launch.starter.startAsync(executable, launchArguments, environment, errorFile);
      }
    };

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.isTrue(exception.message.includes("EISDIR"), exception.message);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
  }

  @TestMethod
  public async clientsStartingTogetherShareOneRuntime(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const launchers = [1, 2, 3].map(() => UpdateBarrierFixture.createLauncher(launch.createSettings(1_000), RuntimeBuild.identity, launch.starter));

    const clients = await Promise.all(launchers.map((t, index) => t.attachAsync(`client${index}`, new ClientListenerFixture())));
    const processId = await launch.readProcessIdAsync();
    const listener = new ClientListenerFixture();
    const late = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("late", listener);

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
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(300), RuntimeBuild.identity, launch.starter).attachAsync("desktop", listener);
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
    const olderClient = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, older.entryPath), older.identity, launch.starter).attachAsync("older", new ClientListenerFixture());
    const olderProcessId = await launch.readProcessIdAsync();
    olderClient.close();

    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("desktop", new ClientListenerFixture());
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
    const newerClient = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, newer.entryPath), newer.identity, launch.starter).attachAsync("newer", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const handover = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("desktop", new ClientListenerFixture()),
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
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, build.entryPath), build.identity, launch.starter).attachAsync("desktop", new ClientListenerFixture());
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

      const exception = await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(settings, newer).attachAsync("desktop", new ClientListenerFixture()), WorkInProgressException);

      Assert.areEqual("Indexing the project", exception.work.descriptions.join(","));
      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory), "the runtime keeps running");
    });
  }

  @TestMethod
  public startsNothingWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const settings = new LaunchSettings(fixture.dataDirectory, path.join(fixture.root, "missing-program"), RuntimeEntry.entryPath, {}, process.platform, 1_000, 1_000, 25);

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false)),
        NoRuntimeException);

      Assert.areEqual(`No runtime is running for ${fixture.dataDirectory.root}.`, exception.message);
      Assert.isFalse(existsSync(fixture.dataDirectory.logsFolder), "no start was tried");
    });
  }

  @TestMethod
  public attachesToARunningRuntimeWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      const host = await fixture.startAsync();

      const client = await UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false));

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
        () => UpdateBarrierFixture.createLauncher(settings, newer).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(true, false)),
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
      const launcher = UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity);

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
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).moveAsideAsync("desktop", new ClientListenerFixture()),
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
          () => UpdateBarrierFixture.createLauncher(fake.createSettings(), FakeRuntimeFixture.NEWER).attachAsync("desktop", new ClientListenerFixture(), StopPolicy.StopWork),
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
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(300), FakeRuntimeFixture.NEWER).attachAsync("desktop", new ClientListenerFixture()),
        LaunchException);

      Assert.areEqual("The other build's runtime did not stop in time.", exception.message);
    });
  }

  @TestMethod
  public givesUpAtItsLimitOnAnOwnedDirectoryWhoseRuntimeItCannotReach(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await fake.server.server.closeAsync();

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(300, 600), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        LaunchException);

      Assert.areEqual("A runtime held the data directory but was not reachable within 0.6 s.", exception.message);
    });
  }

  @TestMethod
  public passesOnARefusedConnection(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        ConnectionException);

      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
    }, "wrong-token");
  }

  @TestMethod
  public triesAgainWhenTheRuntimeThatRefusedTheTokenHasPublishedAnother(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const earlier = readFileSync(fake.dataDirectory.discoveryFile, "utf8");
      fake.server.onChange = () => writeFileSync(fake.dataDirectory.discoveryFile, earlier.replace("earlier-token", RuntimeServerFixture.TOKEN));

      const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture());

      Assert.isTrue(client.isConnected);
      client.close();
    }, "earlier-token");
  }

  @TestMethod
  public passesOnATokenRefusedAgainAfterEachNewPublication(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const earlier = readFileSync(fake.dataDirectory.discoveryFile, "utf8");
      let publications = 0;
      let open = 0;
      let connections = 0;
      fake.server.onChange = () => {
        connections += fake.server.server.sessionCount > open ? 1 : 0;
        open = fake.server.server.sessionCount;
        writeFileSync(fake.dataDirectory.discoveryFile, earlier.replace("earlier-token", `other-token-${++publications}`));
      };

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        ConnectionException);

      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
      Assert.areEqual(4, connections);
    }, "earlier-token");
  }

  @TestMethod
  public passesOnUnreadableDiscovery(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
        Error);
    }, undefined, "tcp://127.0.0.1:port");
  }

  @TestMethod
  public reportsARuntimeThatCannotStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const missing = path.join(fixture.root, "missing-program");
      const settings = new LaunchSettings(fixture.dataDirectory, missing, RuntimeEntry.entryPath, {}, "win32", 1_000, 1_000, 25);

      const exception = await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("desktop", new ClientListenerFixture()), LaunchException);

      Assert.areEqual(`The runtime could not be started with ${missing}.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  @TestMethod
  public async waitsPastItsTimeoutWhileTheRuntimeItStartedOwnsTheDirectory(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const started = Date.now();
    const publishing = delay(600).then(() => fake.publishAsync());

    const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture());
    client.close();
    await publishing;
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.isTrue(Date.now() - started >= 600, "the launcher waited for the runtime past its timeout");
    Assert.areEqual(1, starter.processIds.length);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async waitsPastItsTimeoutForARuntimeThatWonTheDirectoryFromTheOneItStarted(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("process.exit(0);");
    const started = Date.now();
    const publishing = delay(600).then(() => fake.publishAsync());

    const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture());
    client.close();
    await publishing;

    Assert.isTrue(Date.now() - started >= 600, "the launcher waited for the other runtime past its timeout");
    Assert.areEqual(1, starter.processIds.length);
  }

  @TestMethod
  public async givesUpAtItsLimitWhenTheDirectoryStaysOwnedButNoRuntimeIsReachable(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const started = Date.now();

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(fake.createSettings(200, 800), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.areEqual("A runtime held the data directory but was not reachable within 0.8 s.", exception.message);
    Assert.isTrue(Date.now() - started >= 800, "the launcher waited until its limit");
    Assert.areEqual("", (await readdir(fake.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async reportsWhyTheRuntimeItStartedExitedAfterItsTimeout(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture(`setTimeout(() => { console.error("The database is damaged."); process.exit(1); }, 400);`);
    const attaching = Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("desktop", new ClientListenerFixture()),
      LaunchException);

    Assert.isTrue(await Wait.untilAsync(() => starter.processIds.length > 0, 5_000), "The launcher started no runtime within 5 s.");
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
    fake.release();
    const exception = await attaching;

    Assert.areEqual("The runtime exited while starting: The database is damaged.", exception.message);
    Assert.areEqual("", (await readdir(fake.dataDirectory.logsFolder)).join(","));
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
