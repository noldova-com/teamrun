/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";
import { AppImageCopyCleanup, DataDirectory } from "@noldova/teamrun-shell-runtime";

import { AppImageFixture } from "../../fixtures/app-image.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class AppImageCopyCleanupTests {
  private static readonly OWN: string = "start-11111111-2222-4333-8444-555555555555.log";
  private static readonly STALE: string = "start-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.log";
  private static readonly UNREADABLE: string = "start-bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.log";
  private static readonly LIMIT: number = 10_000;

  @TestMethod
  public async createsTheLogsFolderWhenThereIsNone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));

    await AppImageCopyCleanup.removeAsync(directory, null);

    Assert.areEqual("", (await readdir(directory.logsFolder)).join(","));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async endsTheMountOfAHolderThatIsGoneAndKeepsOneWhoseHolderRuns(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const orphaned = await fixture.startMounterAsync();
    const held = await fixture.startMounterAsync();
    const unrelated = await fixture.startMounterAsync();
    using holder = await AppImageCopyCleanupTests.startHolderAsync();
    const gone = await AppImageCopyCleanupTests.findEndedProcessAsync();
    await AppImageCopyCleanupTests.writeLogsAsync(directory, [
      `teamrun-copy mount ${gone} ${orphaned} ${fixture.image}`,
      `teamrun-copy mount ${holder.pid} ${held} ${fixture.image}`,
      `teamrun-copy mount ${gone} ${unrelated} ${path.join(fixture.folder, "other.AppImage")}`,
      `teamrun-copy mount ${gone} ${gone} ${fixture.image}`
    ], [`teamrun-copy mount ${gone} ${held} ${fixture.image}`]);

    await AppImageCopyCleanup.removeAsync(directory, AppImageCopyCleanupTests.OWN);

    Assert.isTrue(await Wait.untilAsync(() => !ProgramFixture.isRunning(orphaned), AppImageCopyCleanupTests.LIMIT), "The orphaned mount did not end.");
    Assert.isTrue(ProgramFixture.isRunning(held));
    Assert.isTrue(ProgramFixture.isRunning(unrelated));
    Assert.isFalse(existsSync(path.join(fixture.folder, `mount-${orphaned}`)));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async removesTheExtractionOfAHolderThatIsGoneFromTheTemporaryFolderOnly(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using orphaned = await TemporaryFolderFixture.createAsync();
    await using held = await TemporaryFolderFixture.createAsync();
    using holder = await AppImageCopyCleanupTests.startHolderAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const nested = path.join(folder.path, "teamrun-runtime-Ab3dE6");
    const misnamed = path.join(folder.path, "copy");
    await mkdir(nested);
    await mkdir(misnamed);
    const gone = await AppImageCopyCleanupTests.findEndedProcessAsync();
    await AppImageCopyCleanupTests.writeLogsAsync(directory, [
      `teamrun-copy extraction ${gone} ${orphaned.path}`,
      `teamrun-copy extraction ${holder.pid} ${held.path}`,
      `teamrun-copy extraction ${gone} ${nested}`,
      `teamrun-copy extraction ${gone} ${misnamed}`,
      "The runtime started."
    ], []);

    await AppImageCopyCleanup.removeAsync(directory, null);

    Assert.areEqual("false,true,true,true", [orphaned.path, held.path, nested, misnamed].map(t => existsSync(t)).join(","));
  }

  private static async writeLogsAsync(directory: DataDirectory, stale: readonly string[], own: readonly string[]): Promise<void> {
    await mkdir(path.join(directory.logsFolder, AppImageCopyCleanupTests.UNREADABLE), { recursive: true });
    await writeFile(path.join(directory.logsFolder, AppImageCopyCleanupTests.STALE), `${stale.join("\n")}\n`);
    await writeFile(path.join(directory.logsFolder, AppImageCopyCleanupTests.OWN), `${own.join("\n")}\n`);
  }

  private static async findEndedProcessAsync(): Promise<number> {
    const child = spawn("/bin/true", [], { stdio: "ignore" });
    await once(child, "exit");
    return child.pid ?? 0;
  }

  private static async startHolderAsync(): Promise<ChildProcess> {
    const child = spawn("/bin/bash", ["--noprofile", "--norc", "-c", "while :; do sleep 0.05; done", "teamrun-launch"], { stdio: "ignore" });
    await once(child, "spawn");
    return child;
  }
}
