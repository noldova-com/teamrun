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
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { Installation, UpdateBarrier, UpdateBarrierState, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class InstallationTests {
  private static readonly RUNNING: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "desktop");
  private static readonly GONE: UpdateProcess = new UpdateProcess(4121, 1500, 1501, "desktop");

  @TestMethod
  public isNamedByItsProgramsResolvedPath(): void {
    const folder = Installation.locate("device", path.join("opt", "TeamRun", "teamrun"));

    Assert.areEqual(path.join("device", "installations"), path.dirname(folder));
    Assert.isTrue(/^[0-9a-f]{16}$/.test(path.basename(folder)), folder);
    Assert.areEqual(folder, Installation.locate("device", path.join("opt", "other", "..", "TeamRun", "teamrun")));
    Assert.areNotEqual(folder, Installation.locate("device", path.join("opt", "TeamRun", "other")));
  }

  @TestMethod
  public async recordsEachDataDirectoryOnce(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const first = path.join(folder.path, "first");
    const second = path.join(folder.path, "second");

    await installation.recordAsync(first);
    await installation.recordAsync(path.join(second, "..", "second"));
    await installation.recordAsync(first);

    const files = await readdir(installation.recordFolder);
    const roots = await Promise.all(files.map(async t => JSON.parse(await readFile(path.join(installation.recordFolder, t), "utf8")) as { dataDirectory: string }));
    Assert.areEqual(path.join(folder.path, "installation", "data-directories"), installation.recordFolder);
    Assert.areEqual(2, files.length);
    Assert.isTrue(files.every(t => /^[0-9a-f]{16}\.json$/.test(t)), files.join(","));
    Assert.areEqual([first, second].toSorted().join("|"), roots.map(t => t.dataDirectory).toSorted().join("|"));
  }

  @TestMethod
  public async findsNoBarrierWhenNoneWasWritten(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);

    Assert.areEqual(UpdateBarrierStatus.None, await installation.checkAsync("0.2.0"));
    Assert.isFalse(await installation.isHeldAsync());
  }

  @TestMethod
  public async isHeldWhileTheBarriersHolderRuns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.HandedOff));

    Assert.areEqual(UpdateBarrierStatus.Held, await installation.checkAsync("0.2.0"));
    Assert.isTrue(await installation.isHeldAsync());
    Assert.isTrue(existsSync(installation.barrierFile));
  }

  @TestMethod
  public async removesABarrierLeftBeforeTheHandoffOrHandedOffForThisVersion(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const barriers = [
      new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Preparing),
      new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Closing),
      new UpdateBarrier(InstallationTests.GONE, "0.2.0", UpdateBarrierState.HandedOff)
    ];

    const results: string[] = [];
    for (const barrier of barriers) {
      await InstallationTests.writeAsync(installation, barrier);
      const isHeld = await installation.isHeldAsync();
      results.push(`${isHeld} ${await installation.checkAsync("0.2.0")} ${existsSync(installation.barrierFile)}`);
    }

    Assert.areEqual(["false None false", "false None false", "false None false"].join("|"), results.join("|"));
  }

  @TestMethod
  public async keepsABarrierHandedOffForAnotherVersionOrThatCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);

    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.HandedOff));
    const handedOff = `${await installation.isHeldAsync()} ${await installation.checkAsync("0.2.0")}`;
    await writeFile(installation.barrierFile, "{\"holder\":");
    const unreadable = `${await installation.isHeldAsync()} ${await installation.checkAsync("0.2.0")}`;

    Assert.areEqual("false Unfinished", handedOff);
    Assert.areEqual("false Unfinished", unreadable);
    Assert.isTrue(existsSync(installation.barrierFile));
  }

  @TestMethod
  public async passesOnAnErrorOtherThanAMissingBarrier(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await mkdir(installation.barrierFile, { recursive: true });

    const error = await Assert.throwsAsync(() => installation.checkAsync("0.2.0"), Error) as NodeJS.ErrnoException;

    Assert.areEqual("EISDIR", error.code);
  }

  private static open(folder: string): Installation {
    return new Installation(path.join(folder, "installation"), t => Promise.resolve(t.processId === InstallationTests.RUNNING.processId));
  }

  private static async writeAsync(installation: Installation, barrier: UpdateBarrier): Promise<void> {
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.barrierFile, JSON.stringify(barrier.toJson()));
  }
}
