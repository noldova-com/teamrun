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

import { CommandLinePatchFixture } from "../../fixtures/command-line-patch.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class AppImageCopyCleanupTests {
  private static readonly ORPHANED: string = "copy-11111111-2222-4333-8444-555555555555.log";
  private static readonly HELD: string = "copy-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.log";
  private static readonly HIDDEN: string = "copy-dddddddd-eeee-4fff-8000-111111111111.log";
  private static readonly UNREADABLE: string = "copy-bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.log";
  private static readonly START_LOG: string = "start-cccccccc-dddd-4eee-8fff-000000000000.log";
  private static readonly IMAGE: string = "/home/ada/TeamRun.AppImage";
  private static readonly HOLDER: number = 900_001;
  private static readonly GONE: number = 900_002;
  private static readonly UNREADABLE_HOLDER: number = 900_003;
  private static readonly LIMIT: number = 10_000;

  @TestMethod
  public async createsTheLogsFolderWhenThereIsNone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));

    await AppImageCopyCleanup.removeAsync(directory);

    Assert.areEqual("", (await readdir(directory.logsFolder)).join(","));
  }

  @TestMethod
  public async endsTheMountsOfAHolderThatIsGoneAndLeavesThoseOfOneThatRunsOrCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    using orphaned = await AppImageCopyCleanupTests.startAsync();
    using unrelated = await AppImageCopyCleanupTests.startAsync();
    using held = await AppImageCopyCleanupTests.startAsync();
    using logged = await AppImageCopyCleanupTests.startAsync();
    using hidden = await AppImageCopyCleanupTests.startAsync();
    const mounting = `${AppImageCopyCleanupTests.IMAGE}\0--appimage-mount\0`;
    using _commandLines = AppImageCopyCleanupTests.patchCommandLines([
      [Number(orphaned.pid), mounting],
      [Number(unrelated.pid), "/home/ada/Other.AppImage\0--appimage-mount\0"],
      [Number(held.pid), mounting],
      [Number(logged.pid), mounting],
      [Number(hidden.pid), `/bin/sh\0${mounting}`]
    ]);
    const image = AppImageCopyCleanupTests.IMAGE;
    await AppImageCopyCleanupTests.writeRecordsAsync(directory, [
      `teamrun-copy mount ${AppImageCopyCleanupTests.GONE} ${orphaned.pid} ${image}`,
      `teamrun-copy mount ${AppImageCopyCleanupTests.GONE} ${unrelated.pid} ${image}`,
      `teamrun-copy mount ${AppImageCopyCleanupTests.GONE} ${AppImageCopyCleanupTests.GONE} ${image}`
    ], [`teamrun-copy mount ${AppImageCopyCleanupTests.HOLDER} ${held.pid} ${image}`],
    [`teamrun-copy mount ${AppImageCopyCleanupTests.UNREADABLE_HOLDER} ${hidden.pid} ${image}`],
    [`teamrun-copy mount ${AppImageCopyCleanupTests.GONE} ${logged.pid} ${image}`]);

    await AppImageCopyCleanup.removeAsync(directory);

    Assert.isTrue(await Wait.untilAsync(() => !ProgramFixture.isRunning(Number(orphaned.pid)), AppImageCopyCleanupTests.LIMIT), "The orphaned mount did not end.");
    Assert.areEqual("true,true,true,true", [unrelated, held, logged, hidden].map(t => ProgramFixture.isRunning(Number(t.pid))).join(","));
    Assert.areEqual(AppImageCopyCleanupTests.listLeft(), (await readdir(directory.logsFolder)).sort().join(","));
  }

  @TestMethod
  public async removesTheExtractionsOfAHolderThatIsGoneFromTheTemporaryFolderOnly(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using orphaned = await TemporaryFolderFixture.createAsync();
    await using held = await TemporaryFolderFixture.createAsync();
    await using hidden = await TemporaryFolderFixture.createAsync();
    using _commandLines = AppImageCopyCleanupTests.patchCommandLines([]);
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const nested = path.join(folder.path, "teamrun-runtime-Ab3dE6");
    const misnamed = path.join(folder.path, "copy");
    await mkdir(nested);
    await mkdir(misnamed);
    await AppImageCopyCleanupTests.writeRecordsAsync(directory, [
      `teamrun-copy extraction ${AppImageCopyCleanupTests.GONE} ${orphaned.path}`,
      `teamrun-copy extraction ${AppImageCopyCleanupTests.GONE} ${nested}`,
      `teamrun-copy extraction ${AppImageCopyCleanupTests.GONE} ${misnamed}`,
      "an unrelated line"
    ], [`teamrun-copy extraction ${AppImageCopyCleanupTests.HOLDER} ${held.path}`],
    [`teamrun-copy extraction ${AppImageCopyCleanupTests.UNREADABLE_HOLDER} ${hidden.path}`], []);

    await AppImageCopyCleanup.removeAsync(directory);

    Assert.areEqual("false,true,true,true,true", [orphaned.path, held.path, hidden.path, nested, misnamed].map(t => existsSync(t)).join(","));
    Assert.areEqual(AppImageCopyCleanupTests.listLeft(), (await readdir(directory.logsFolder)).sort().join(","));
  }

  private static patchCommandLines(mounters: readonly (readonly [number, string])[]): CommandLinePatchFixture {
    const permission = Object.assign(new Error("EACCES: permission denied, open '/proc/900003/cmdline'"), { code: "EACCES" });
    return new CommandLinePatchFixture(new Map<number, string | Error>([
      [AppImageCopyCleanupTests.HOLDER, "/bin/bash\0--noprofile\0--norc\0-p\0-c\0script\0teamrun-launch\0/home/ada/TeamRun.AppImage\0"],
      [AppImageCopyCleanupTests.UNREADABLE_HOLDER, permission],
      ...mounters
    ]));
  }

  private static listLeft(): string {
    return [AppImageCopyCleanupTests.HELD, AppImageCopyCleanupTests.HIDDEN, AppImageCopyCleanupTests.UNREADABLE, AppImageCopyCleanupTests.START_LOG].sort().join(",");
  }

  private static async writeRecordsAsync(directory: DataDirectory, orphaned: readonly string[], held: readonly string[], hidden: readonly string[],
    logged: readonly string[]): Promise<void> {
    await mkdir(path.join(directory.logsFolder, AppImageCopyCleanupTests.UNREADABLE), { recursive: true });
    const files: readonly (readonly [string, readonly string[]])[] = [
      [AppImageCopyCleanupTests.ORPHANED, orphaned],
      [AppImageCopyCleanupTests.HELD, held],
      [AppImageCopyCleanupTests.HIDDEN, hidden],
      [AppImageCopyCleanupTests.START_LOG, logged]
    ];
    for (const [name, lines] of files)
      await writeFile(path.join(directory.logsFolder, name), lines.map(t => `${t}\n`).join(""));
  }

  private static async startAsync(): Promise<ChildProcess> {
    const child = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    await once(child, "spawn");
    return child;
  }
}
