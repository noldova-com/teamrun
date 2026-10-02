/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Failure, FailureCode, PreShellData, ShellMethods, StopPolicy } from "@noldova/teamrun-shell-protocol";
import {
  ConnectionException,
  LaunchException,
  LaunchSettings,
  MethodFailureException,
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

@TestClass
export class RuntimeLauncherTests {
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
  public givesUpOnARuntimeItCannotReach(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await fake.server.server.closeAsync();

      const exception = await Assert.throwsAsync(
        () => new RuntimeLauncher(fake.createSettings(300), RuntimeServerFixture.IDENTITY).attachAsync("desktop", new ClientListenerFixture()),
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

  private static async runWithHostAsync(test: (fixture: RuntimeHostFixture, settings: LaunchSettings) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture, new LaunchSettings(fixture.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 30_000, 5_000, 25));
  }

  private static async runWithFakeAsync(test: (fake: FakeRuntimeFixture) => Promise<void>, token?: string, endpoint?: string): Promise<void> {
    await using fake = await FakeRuntimeFixture.startAsync(token, endpoint);
    await test(fake);
  }
}
