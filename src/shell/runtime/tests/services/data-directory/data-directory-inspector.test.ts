/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  DataDirectory,
  DataDirectoryInspector,
  DataDirectoryState,
  OwnershipLock,
  OwnershipReleasedException
} from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DataDirectoryInspectorTests {
  private static readonly MOMENT: Date = new Date("2026-10-01T12:34:56.789Z");

  @TestMethod
  public async findsAMissingOrRuntimeOnlyDirectoryEmpty(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));
    const missing = await DataDirectoryInspector.inspectAsync(directory);
    using lock = OwnershipLock.acquire(directory);
    await mkdir(directory.discoveryFolder);
    await mkdir(directory.profileFolder);
    await writeFile(`${directory.ownershipDatabase}-journal`, "");

    const runtimeOnly = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.Empty, missing.state);
    Assert.areEqual(DataDirectoryState.Empty, runtimeOnly.state);
    Assert.areEqual(0, runtimeOnly.entries.length);
    Assert.isTrue(lock.isHeld);
  }

  @TestMethod
  public async findsTheShellDatabaseCurrent(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await writeFile(directory.shellDatabase, "");
    await mkdir(directory.modulesFolder);

    const inspection = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.Current, inspection.state);
    Assert.areEqual("modules,shell.sqlite", inspection.entries.join(","));
  }

  @TestMethod
  public async findsAnythingElseWithoutTheShellDatabasePreShell(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);

    const inspection = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.PreShell, inspection.state);
    Assert.areEqual("attachments,runtime.lock,runtime.lock.sqlite,teamrun.db", inspection.entries.join(","));
  }

  @TestMethod
  public async movesPreShellDataIntoADatedSiblingAndKeepsTheRuntimeEntries(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));
    using lock = OwnershipLock.acquire(directory);
    await mkdir(directory.discoveryFolder);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);

    const destination = await DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT);

    Assert.areEqual(path.join(folder.path, "teamrun-before-shell-20261001T123456Z"), destination);
    Assert.isTrue((await readdir(directory.root)).every(t => ["discovery", "ownership.sqlite", "ownership.sqlite-journal"].includes(t)));
    Assert.areEqual("attachments,runtime.lock,runtime.lock.sqlite,teamrun.db", (await readdir(destination ?? "")).sort().join(","));
    Assert.areEqual("old records", await readFile(path.join(destination ?? "", "teamrun.db"), "utf8"));
    Assert.areEqual(DataDirectoryState.Empty, (await DataDirectoryInspector.inspectAsync(directory)).state);
  }

  @TestMethod
  public async movesNothingFromAnEmptyOrCurrentDirectory(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));
    using lock = OwnershipLock.acquire(directory);

    const empty = await DataDirectoryInspector.moveAsideAsync(lock);
    await writeFile(directory.shellDatabase, "");
    const current = await DataDirectoryInspector.moveAsideAsync(lock);

    Assert.isNull(empty);
    Assert.isNull(current);
    Assert.isTrue(existsSync(directory.shellDatabase));
  }

  @TestMethod
  public async neverMovesIntoAnExistingFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));
    using lock = OwnershipLock.acquire(directory);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);
    await mkdir(path.join(folder.path, "teamrun-before-shell-20261001T123456Z"));

    await Assert.throwsAsync(() => DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT), Error);

    Assert.areEqual(DataDirectoryState.PreShell, (await DataDirectoryInspector.inspectAsync(directory)).state);
  }

  @TestMethod
  public async movesOnlyWhileTheOwnershipIsHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    lock.release();

    await Assert.throwsAsync(() => DataDirectoryInspector.moveAsideAsync(lock), OwnershipReleasedException);
  }

  private static async writePreShellDataAsync(directory: DataDirectory): Promise<void> {
    await writeFile(path.join(directory.root, "teamrun.db"), "old records");
    await writeFile(path.join(directory.root, "runtime.lock"), "{}");
    await writeFile(path.join(directory.root, "runtime.lock.sqlite"), "");
    await mkdir(path.join(directory.root, "attachments"));
    await writeFile(path.join(directory.root, "attachments", "image.png"), "image");
  }
}
