/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EndpointKind, LockFile, ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeEntry } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeEntryTests {
  @TestMethod
  public readsSettingsAndProviders(): void {
    using directory = new TemporaryDirectory();
    const explicit = new RuntimeEntry(["--data-dir", directory.path, "--product-version", "2.0.0", "--idle-grace", "700", "--providers", "none", "--stop-on-input-end"], "linux", {});
    const defaults = new RuntimeEntry(["--data-dir", directory.resolve("relative")], "win32", {});
    const missing = new RuntimeEntry([], "win32", {});
    const unknown = new RuntimeEntry(["--data-dir", directory.path, "--providers", "some"], "win32", {});

    const explicitSettings = explicit.createSettings();
    const defaultSettings = defaults.createSettings();

    Assert.areEqual(directory.path, explicitSettings.dataDirectory);
    Assert.areEqual("2.0.0", explicitSettings.productVersion);
    Assert.areEqual(700, explicitSettings.idleGraceMilliseconds);
    Assert.areEqual(EndpointKind.Socket, explicitSettings.endpointKind);
    Assert.isTrue(explicit.stopsOnInputEnd);
    Assert.areEqual(0, explicit.createRegistry("2.0.0", RuntimeEntryTests.tracker(directory)).all().length);
    Assert.areEqual("0.0.0", defaultSettings.productVersion);
    Assert.areEqual(30_000, defaultSettings.idleGraceMilliseconds);
    Assert.areEqual(EndpointKind.Tcp, defaultSettings.endpointKind);
    Assert.isFalse(defaults.stopsOnInputEnd);
    Assert.areEqual("codex,claude,grok", defaults.createRegistry("0.0.0", RuntimeEntryTests.tracker(directory)).all().map(t => t.descriptor.id).join(","));
    Assert.areEqual("dataDirectory", Assert.throws(() => missing.createSettings(), ArgumentException).parameterName);
    Assert.areEqual("--providers", Assert.throws(() => unknown.createRegistry("1", RuntimeEntryTests.tracker(directory)), ArgumentException).parameterName);
    Assert.isTrue(RuntimeEntry.entryPath.endsWith("runtime-entry.js"));
  }

  @TestMethod
  public async runsUntilTheInputEnds(): Promise<void> {
    using directory = new TemporaryDirectory();
    const entry = new RuntimeEntry(["--data-dir", directory.resolve("data"), "--providers", "none", "--stop-on-input-end"], process.platform, {});
    const input = new PassThrough();
    const lockFile = new LockFile(directory.resolve("data", "runtime.lock"), new ProcessProbe());

    const running = entry.run(input, new EventEmitter());
    await Wait.until(() => lockFile.readLive() !== null);
    input.end();
    const reason = await running;

    Assert.areEqual("input end", reason);
    Assert.isNull(lockFile.read());
  }

  @TestMethod
  public async stopsOnASignal(): Promise<void> {
    using directory = new TemporaryDirectory();
    const entry = new RuntimeEntry(["--data-dir", directory.resolve("data"), "--providers", "none"], process.platform, {});
    const signals = new EventEmitter();
    const lockFile = new LockFile(directory.resolve("data", "runtime.lock"), new ProcessProbe());

    const running = entry.run(new PassThrough(), signals);
    await Wait.until(() => lockFile.readLive() !== null);
    signals.emit("SIGTERM");
    signals.emit("SIGINT");
    const reason = await running;

    Assert.areEqual("signal", reason);
  }

  private static tracker(directory: TemporaryDirectory): ProcessRegistry {
    return new ProcessRegistry(directory.resolve("processes.json"), process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
  }
}
