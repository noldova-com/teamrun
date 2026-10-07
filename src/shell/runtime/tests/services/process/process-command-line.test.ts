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
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppImageCopyCleanup, DataDirectory } from "@noldova/teamrun-shell-runtime";

import { CommandLinePatchFixture } from "../../fixtures/command-line-patch.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ProcessCommandLineTests {
  private static readonly RECORD: string = "copy-21212121-3434-4565-8787-909090909090.log";
  private static readonly IMAGE: string = "/home/ada/TeamRun.AppImage";
  private static readonly HOLDER: number = 900_011;

  @TestMethod
  public async endsOnlyAMountWhoseCommandLineMountsTheRecordedImageWhenItsHolderIsGone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const mounting = await ProcessCommandLineTests.startAsync();
    const other = await ProcessCommandLineTests.startAsync();
    try {
      await mkdir(directory.logsFolder, { recursive: true });
      await writeFile(path.join(directory.logsFolder, ProcessCommandLineTests.RECORD),
        `teamrun-copy mount ${ProcessCommandLineTests.HOLDER} ${mounting.pid} ${ProcessCommandLineTests.IMAGE}\nteamrun-copy mount ${ProcessCommandLineTests.HOLDER} ${other.pid} ${ProcessCommandLineTests.IMAGE}\n`);
      const ended = once(mounting, "exit");
      const diagnostics = new TextOutputFixture();
      using _commandLines = new CommandLinePatchFixture(new Map([
        [Number(mounting.pid), `${ProcessCommandLineTests.IMAGE}\0--appimage-mount\0`],
        [Number(other.pid), "/home/ada/Other.AppImage\0--appimage-mount\0"]
      ]));

      await AppImageCopyCleanup.removeAsync(directory, diagnostics);
      await ended;

      Assert.areEqual(String.empty, diagnostics.text);
      Assert.isNull(other.exitCode ?? other.signalCode);
      Assert.isFalse(existsSync(path.join(directory.logsFolder, ProcessCommandLineTests.RECORD)));
    }
    finally {
      mounting.kill();
      other.kill();
    }
  }

  @TestMethod
  public async leavesARecordWhoseHoldersCommandLineCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const record = path.join(directory.logsFolder, ProcessCommandLineTests.RECORD);
    await mkdir(directory.logsFolder, { recursive: true });
    await writeFile(record, `teamrun-copy mount ${ProcessCommandLineTests.HOLDER} 900012 ${ProcessCommandLineTests.IMAGE}\n`);
    const diagnostics = new TextOutputFixture();
    using _commandLines = new CommandLinePatchFixture(new Map([[ProcessCommandLineTests.HOLDER, Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })]]));

    await AppImageCopyCleanup.removeAsync(directory, diagnostics);

    Assert.areEqual(`The runtime could not end the AppImage copy recorded in ${record}, so the record is left: Error: EACCES: permission denied\n`, diagnostics.text);
    Assert.isTrue(existsSync(record));
  }

  private static async startAsync(): Promise<ChildProcess> {
    const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    await once(child, "spawn");
    return child;
  }
}
