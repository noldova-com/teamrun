/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";

import "@noldova/teamrun-foundation-core";
import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiscoveryReader, OwnershipLock, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../fixtures/runtime-host.fixture.js";

@TestClass
export class RuntimeEntryTests {
  private static readonly USAGE: string = "Usage: runtime-entry --data-dir <absolute path> [--idle-grace <milliseconds>] [--start-log <start log name>]";

  @TestMethod
  public explainsItsUsage(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (_fixture, signals, error) => {
      const code = await RuntimeEntry.runAsync(["--idle-grace", "5"], process.platform, process.env, signals, error);

      Assert.areEqual(2, code);
      Assert.areEqual(`ArgumentException: The --data-dir argument is required. (Parameter 'arguments')\n${RuntimeEntryTests.USAGE}\n`, RuntimeEntryTests.read(error));
    });
  }

  @TestMethod
  public endsQuietlyWhenAnotherRuntimeOwnsTheDirectory(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);

      const code = await RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root], process.platform, process.env, signals, error);

      Assert.areEqual(3, code);
      Assert.areEqual("", RuntimeEntryTests.read(error));
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public reportsAFailureToStart(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      await mkdir(fixture.root, { recursive: true });
      await writeFile(fixture.dataDirectory.root, "not a folder");

      const code = await RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root], process.platform, process.env, signals, error);

      Assert.areEqual(1, code);
      Assert.isTrue(RuntimeEntryTests.read(error).startsWith("Error: "));
    });
  }

  @TestMethod
  public stopsOnASignal(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      const endedWith = await Promise.race([listening.then(() => null), running]);
      Assert.isNull(endedWith, `the runtime ended before it started: ${RuntimeEntryTests.read(error)}`);
      Assert.isNotNull(await DiscoveryReader.readAsync(fixture.dataDirectory));
      Assert.areEqual(1, signals.listenerCount("SIGTERM"));
      Assert.areEqual(1, signals.listenerCount("SIGINT"));

      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.areEqual(0, signals.listenerCount("SIGTERM"));
      Assert.areEqual(0, signals.listenerCount("SIGINT"));
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public writesAnUncaughtFailureToTheLog(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      await listening;

      signals.emit("uncaughtExceptionMonitor", new Error("The module notes threw."));
      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.areEqual(0, signals.listenerCount("uncaughtExceptionMonitor"));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).startsWith("Error: The module notes threw.\n    at "));
    });
  }

  @TestMethod
  public runsAsAProgram(): Promise<void> {
    return RuntimeEntryTests.runAsync(async () => {
      const child = spawn(process.execPath, [RuntimeEntry.entryPath, "--data-dir"], {
        env: CoverageEnvironment.forChild(process.env),
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true
      });
      let output = "";
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => output += chunk);

      const [code] = await once(child, "exit");

      Assert.areEqual(2, code);
      Assert.areEqual(`ArgumentException: The argument --data-dir needs a value. (Parameter 'arguments')\n${RuntimeEntryTests.USAGE}\n`, output.replaceAll("\r\n", "\n"));
    });
  }

  @TestMethod
  public async settlesTheExitCodeARunEndsWith(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await RuntimeEntry.settleAsync(Promise.resolve(3), error, exit);

    Assert.areEqual(3, exit.exitCode);
    Assert.areEqual("", RuntimeEntryTests.read(error));
  }

  @TestMethod
  public async writesARejectedRunAndExitsWithAFailure(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await RuntimeEntry.settleAsync(Promise.reject(new RangeError("The run broke.")), error, exit);

    Assert.areEqual(1, exit.exitCode);
    Assert.isTrue(RuntimeEntryTests.read(error).startsWith("RangeError: The run broke.\n    at "));
  }

  private static read(stream: PassThrough): string {
    return String(stream.read() ?? "");
  }

  private static waitForListenerAsync(emitter: EventEmitter, event: string): Promise<void> {
    return new Promise<void>(resolve => {
      const added = (name: string | symbol): void => {
        if (name !== event)
          return;
        emitter.off("newListener", added);
        resolve();
      };
      emitter.on("newListener", added);
    });
  }

  private static async runAsync(test: (fixture: RuntimeHostFixture, signals: EventEmitter, error: PassThrough) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture, new EventEmitter(), new PassThrough({ encoding: "utf8" }));
  }
}
