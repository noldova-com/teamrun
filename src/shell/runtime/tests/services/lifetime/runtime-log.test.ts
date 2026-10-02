/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, OwnershipLock, OwnershipReleasedException, RuntimeLog } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class RuntimeLogTests {
  private static readonly OWN: string = "start-11111111-2222-4333-8444-555555555555.log";
  private static readonly STALE: string = "start-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.log";

  @TestMethod
  public keepsExactlyThePreviousRun(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      for (const run of ["first", "second", "third"]) {
        const log = await RuntimeLog.openAsync(lock, null);
        log.writeLine(`${run} run`);
        await new Promise<void>(resolve => log.diagnostics.write(`${run} diagnostics\n`, () => resolve()));
        await log.closeAsync();
      }

      const directory = lock.dataDirectory;
      Assert.areEqual("runtime.log,runtime.previous.log", (await readdir(directory.logsFolder)).sort().join(","));
      Assert.areEqual("third run\nthird diagnostics\n", await readFile(directory.runtimeLog, "utf8"));
      Assert.areEqual("second run\nsecond diagnostics\n", await readFile(directory.previousRuntimeLog, "utf8"));
    });
  }

  @TestMethod
  public removesStartLogsLeftBehindButKeepsItsOwn(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const folder = lock.dataDirectory.logsFolder;
      await mkdir(path.join(folder, "start-cccccccc-dddd-4eee-8fff-000000000000.log"), { recursive: true });
      await writeFile(path.join(folder, path.join("start-cccccccc-dddd-4eee-8fff-000000000000.log", "kept.txt")), "busy");
      for (const name of [RuntimeLogTests.OWN, RuntimeLogTests.STALE, "start-other.log", "notes.txt"])
        await writeFile(path.join(folder, name), name);

      const log = await RuntimeLog.openAsync(lock, RuntimeLogTests.OWN);
      await log.closeAsync();

      Assert.areEqual(
        ["notes.txt", "runtime.log", RuntimeLogTests.OWN, "start-cccccccc-dddd-4eee-8fff-000000000000.log", "start-other.log"].sort().join(","),
        (await readdir(folder)).sort().join(","));
    });
  }

  @TestMethod
  public startsANewLogWhenThePreviousCannotBeReplaced(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const directory = lock.dataDirectory;
      await mkdir(path.join(directory.previousRuntimeLog, "held"), { recursive: true });
      await writeFile(directory.runtimeLog, "older run\n");

      const log = await RuntimeLog.openAsync(lock, null);
      log.writeLine("new run");
      await log.closeAsync();

      Assert.areEqual("new run\n", await readFile(directory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public writesNothingOnceClosed(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const log = await RuntimeLog.openAsync(lock, null);
      log.writeLine("before");
      await log.closeAsync();

      log.writeLine("after");
      await log.closeAsync();

      Assert.areEqual("before\n", await readFile(lock.dataDirectory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public requiresOwnership(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      lock.release();

      await Assert.throwsAsync(() => RuntimeLog.openAsync(lock, null), OwnershipReleasedException);
    });
  }

  private static async runAsync(test: (lock: OwnershipLock) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    await mkdir(directory.logsFolder, { recursive: true });
    using lock = OwnershipLock.acquire(directory);
    await test(lock);
  }
}
