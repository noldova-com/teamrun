/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, OwnershipLock, OwnershipReleasedException, RuntimeLog } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class RuntimeLogTests {
  private static readonly OWN: string = "start-11111111-2222-4333-8444-555555555555.log";
  private static readonly STALE: string = "start-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.log";
  private static readonly STAMP: string = "2026-10-02T23:40:01.250Z";

  @TestMethod
  public keepsExactlyThePreviousRun(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      for (const run of ["first", "second", "third"]) {
        const log = await RuntimeLogTests.openAsync(lock, null);
        log.writeLine(`${run} run`);
        await new Promise<void>(resolve => log.diagnostics.write(`${run} diagnostics\n`, () => resolve()));
        await log.closeAsync();
      }

      const directory = lock.dataDirectory;
      Assert.areEqual("runtime.log,runtime.previous.log", (await readdir(directory.logsFolder)).sort().join(","));
      Assert.areEqual(`${RuntimeLogTests.STAMP} third run\n${RuntimeLogTests.STAMP} third diagnostics\n`, await readFile(directory.runtimeLog, "utf8"));
      Assert.areEqual(`${RuntimeLogTests.STAMP} second run\n${RuntimeLogTests.STAMP} second diagnostics\n`, await readFile(directory.previousRuntimeLog, "utf8"));
    });
  }

  @TestMethod
  public stampsAndRedactsEveryRecordFromBothWriters(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const token = "a1B2_c3D4-".repeat(4);
      const log = await RuntimeLogTests.openAsync(lock, null);

      log.writeLine(`Saved in ${path.join(homedir(), "notes")} with ${token}.`);
      await new Promise<void>(resolve => log.diagnostics.write(`The module notes: failed.\nin ${homedir()}\n`, () => resolve()));
      await log.closeAsync();

      Assert.areEqual(
        `${RuntimeLogTests.STAMP} Saved in ${path.join("~", "notes")} with [redacted].\n${RuntimeLogTests.STAMP} The module notes: failed.\nin ~\n`,
        await readFile(lock.dataDirectory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public takesADiagnosticWithoutALineEndingAsOneRecord(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const log = await RuntimeLogTests.openAsync(lock, null);

      await new Promise<void>(resolve => log.diagnostics.write("No ending", () => resolve()));
      await new Promise<void>(resolve => log.diagnostics.write(Buffer.from("As bytes\n"), () => resolve()));
      await log.closeAsync();

      Assert.areEqual(`${RuntimeLogTests.STAMP} No ending\n${RuntimeLogTests.STAMP} As bytes\n`, await readFile(lock.dataDirectory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public reportsOnceAndStopsWritingWhenTheLogCannotBeWritten(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const error = new TextOutputFixture();
      const log = await RuntimeLog.openAsync(lock, null, () => new Date(RuntimeLogTests.STAMP), error);
      await rm(lock.dataDirectory.logsFolder, { recursive: true });

      await new Promise<void>(resolve => log.diagnostics.write("Lost", () => resolve()));
      log.writeLine("Lost too");
      await log.closeAsync();

      Assert.isTrue(error.text.startsWith(`${RuntimeLogTests.STAMP} The runtime's log could not be written, so it is no longer written to: Error: `));
      Assert.areEqual(1, error.text.trimEnd().split("\n").length);
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

      const log = await RuntimeLogTests.openAsync(lock, RuntimeLogTests.OWN);
      await log.closeAsync();

      Assert.areEqual(
        ["notes.txt", "runtime.log", RuntimeLogTests.OWN, "start-cccccccc-dddd-4eee-8fff-000000000000.log", "start-other.log"].sort().join(","),
        (await readdir(folder)).sort().join(","));
    });
  }

  @TestMethod
  public keepsTheCurrentLogAndRejectsWhenThePreviousCannotBeReplaced(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const directory = lock.dataDirectory;
      await mkdir(path.join(directory.previousRuntimeLog, "held"), { recursive: true });
      await writeFile(directory.runtimeLog, "older run\n");

      await Assert.throwsAsync(() => RuntimeLogTests.openAsync(lock, null), Error);

      Assert.areEqual("older run\n", await readFile(directory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public writesNothingOnceClosed(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      const log = await RuntimeLogTests.openAsync(lock, null);
      log.writeLine("before");
      await log.closeAsync();

      log.writeLine("after");
      await log.closeAsync();

      Assert.areEqual(`${RuntimeLogTests.STAMP} before\n`, await readFile(lock.dataDirectory.runtimeLog, "utf8"));
    });
  }

  @TestMethod
  public requiresOwnership(): Promise<void> {
    return RuntimeLogTests.runAsync(async lock => {
      lock.release();

      await Assert.throwsAsync(() => RuntimeLog.openAsync(lock, null), OwnershipReleasedException);
    });
  }

  private static openAsync(lock: OwnershipLock, ownStartLogName: string | null): Promise<RuntimeLog> {
    return RuntimeLog.openAsync(lock, ownStartLogName, () => new Date(RuntimeLogTests.STAMP));
  }

  private static async runAsync(test: (lock: OwnershipLock) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    await mkdir(directory.logsFolder, { recursive: true });
    using lock = OwnershipLock.acquire(directory);
    await test(lock);
  }
}
