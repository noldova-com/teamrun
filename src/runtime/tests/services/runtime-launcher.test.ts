/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, MethodName, ProtocolVersion, Response } from "@noldova/teamrun-protocol";
import { ConnectionException, Endpoint, LaunchException, RuntimeEntry, RuntimeLauncher, RuntimeLock, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";

import { RecordingClientListener } from "../fixtures/recording-client-listener.fixture.js";
import { RawServer } from "../fixtures/raw-server.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeLauncherTests {
  private static readonly timings: RuntimeTimings = new RuntimeTimings(2000, 5000, 15000, 50);

  @TestMethod
  @TestData(0, 0)
  @TestData(0, 2)
  @TestData(1, 1)
  public async refusesIncompatibleDiscoveryWithoutConnectingOrReplacingTheLock(major: number, minor: number): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = new RawServer();
    server.linesOnConnect = [Response.success(null, ProtocolVersion.current.toJson()).toText()];
    const endpoint = await server.start();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-test", null);
    const lock = new RuntimeLock(process.pid, endpoint, "fixture-token", new ProtocolVersion(major, minor), settings.productVersion, "fixture-time");
    RuntimeLauncherTests.writeLock(settings, lock);
    const original = readFileSync(settings.lockPath, "utf8");
    const launcher = new RuntimeLauncher(settings, process.execPath, directory.resolve("must-not-launch.js"), [], process.env, RuntimeLauncherTests.timings);

    const failure = await Assert.throwsAsync(() => launcher.attach("test", new RecordingClientListener()), LaunchException);

    Assert.isTrue(failure.message.includes("0.1"));
    Assert.isTrue(failure.message.includes(lock.protocolVersion.toString()));
    Assert.areEqual(0, server.sockets.length);
    Assert.areEqual(original, readFileSync(settings.lockPath, "utf8"));
  }

  @TestMethod
  public async refusesADifferentLiveProductWithoutReplacingItsRuntime(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const client = await launcher.attach("original", new RecordingClientListener());
    const original = launcher.readLiveLock();
    const newer = new RuntimeLauncher(RuntimeSettings.forPlatform(process.platform, settings.dataDirectory, "0.0.2-launch", 400),
      process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env, RuntimeLauncherTests.timings);
    try {
      const error = await Assert.throwsAsync(() => newer.attach("newer", new RecordingClientListener()), LaunchException);
      Assert.isTrue(error.message.includes("cannot attach to runtime"));
      Assert.areEqual(original?.processId, launcher.readLiveLock()?.processId);
      Assert.isFalse((await client.call(MethodName.ProviderList, null)).hasErrors);
    }
    finally {
      client.close();
      await Wait.until(() => launcher.readLiveLock() === null);
    }
  }

  @TestMethod
  public async startsARuntimeProcessThenAttachesToIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const first = new RecordingClientListener();
    const second = new RecordingClientListener();

    const starter = await launcher.attach("starter", first);
    const lock = launcher.readLiveLock();
    const attacher = await launcher.attach("attacher", second);
    const providers = await starter.call(MethodName.ProviderList, null);
    const project = await attacher.call(MethodName.ProjectOpen, { rootPath: directory.resolve("repo") });
    starter.close();
    attacher.close();
    await Wait.until(() => launcher.readLiveLock() === null);

    Assert.isNotNull(lock);
    Assert.areNotEqual(process.pid, lock?.processId);
    Assert.areEqual("0.0.1-launch", lock?.productVersion);
    Assert.isTrue(lock?.protocolVersion.equals(ProtocolVersion.current) ?? false);
    Assert.areEqual("[]", JSON.stringify(providers.payload));
    Assert.isFalse(project.hasErrors);
    Assert.areEqual(1, first.disconnections);
  }

  @TestMethod
  public async replacesAStaleLockWhoseProcessIdIsAliveButNotAnswering(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const staleLock = new RuntimeLock(process.pid, Endpoint.tcp(1), "token", ProtocolVersion.current, "0.0.1", "2026-09-10T00:00:00.000Z");
    RuntimeLauncherTests.writeLock(settings, staleLock);

    const client = await launcher.attach("client", new RecordingClientListener());
    const lock = launcher.readLiveLock();
    client.close();
    await Wait.until(() => launcher.readLiveLock() === null);

    Assert.isNotNull(lock);
    Assert.areNotEqual(process.pid, lock?.processId);
    Assert.areNotEqual("token", lock?.token);
  }

  @TestMethod
  public async givesUpWhenNoRuntimeBecomesReachable(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", null);
    const exiting = directory.resolve("exit.js");
    mkdirSync(directory.path, { recursive: true });
    writeFileSync(exiting, "process.exit(0);\n");
    const launcher = new RuntimeLauncher(settings, process.execPath, exiting, [], process.env, new RuntimeTimings(500, 500, 1500, 50));

    const failure = await Assert.throwsAsync(() => launcher.attach("client", new RecordingClientListener()), LaunchException);

    Assert.areEqual("The runtime could not be started: The runtime did not publish its endpoint in time.", failure.message);
    Assert.throws(() => new RuntimeLauncher(settings, " ", RuntimeEntry.entryPath, [], process.env, RuntimeLauncherTests.timings), ArgumentException);
    Assert.throws(() => new RuntimeLauncher(settings, process.execPath, "", [], process.env, RuntimeLauncherTests.timings), ArgumentException);
  }

  @TestMethod
  public async reportsARefusedHelloInsteadOfStartingAnotherRuntime(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const client = await launcher.attach("starter", new RecordingClientListener());
    const lock = launcher.readLiveLock();
    if (lock === null)
      throw new Error("Expected a live lock.");
    RuntimeLauncherTests.writeLock(settings, new RuntimeLock(lock.processId, lock.endpoint, "wrong-token", lock.protocolVersion, lock.productVersion, lock.startedAt));

    const refused = await Assert.throwsAsync(() => launcher.attach("intruder", new RecordingClientListener()), ConnectionException);
    RuntimeLauncherTests.writeLock(settings, lock);
    client.close();
    await Wait.until(() => launcher.readLiveLock() === null);

    Assert.areEqual(ErrorCode.Unauthorized, refused.info?.name);
  }

  private static writeLock(settings: RuntimeSettings, lock: RuntimeLock): void {
    mkdirSync(settings.dataDirectory, { recursive: true });
    writeFileSync(settings.lockPath, `${JSON.stringify(lock.toJson())}\n`);
  }
}
