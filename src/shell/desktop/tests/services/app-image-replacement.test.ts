/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppImageReplacement, UpdateHandoffException } from "@noldova/teamrun-shell-desktop";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { UnwritableFolderFixture } from "../fixtures/unwritable-folder.fixture.js";

@TestClass
export class AppImageReplacementTests {
  private static readonly OLD: string = "old version";
  private static readonly NEW: string = "new version";
  private static readonly UNIQUE: string = "0f8e6c1a-52d4-4b7e-9a3c-6d2f1e0b9c47";

  private readonly logged: string[] = [];

  @TestMethod
  public async replacesTheAppImageInPlaceKeepingItsPermissionsAndTheDownload(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image, download) => {
      const before = (await stat(image)).mode;

      await this.create(image).replaceAsync(download);

      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(image, "utf8"));
      Assert.areEqual(before, (await stat(image)).mode);
      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(download, "utf8"));
      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", "update"]), JSON.stringify((await readdir(folder)).sort()));
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async flushesItsFolderWithoutALogOnceTheAppImageIsReplaced(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (_folder, image, download) => {
      await this.create(image).replaceAsync(download);

      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(image, "utf8"));
      Assert.areEqual(0, this.logged.length);
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async replacesTheFileALinkNamesAndKeepsTheLink(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image, download) => {
      const link = path.join(folder, "update", "TeamRun");
      await symlink(image, link);

      await this.create(link).replaceAsync(download);

      Assert.isTrue((await lstat(link)).isSymbolicLink());
      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(image, "utf8"));
      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", "update"]), JSON.stringify((await readdir(folder)).sort()));
    });
  }

  @TestMethod
  public async removesOnlyTheCopiesAnEarlierReplacementOfThatAppImageLeftBehind(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image, download) => {
      const kept = [
        `.Other.AppImage.${AppImageReplacementTests.UNIQUE}.part`,
        ".TeamRun.AppImage.unique.part",
        `TeamRun.AppImage.${AppImageReplacementTests.UNIQUE}.part`,
        `.TeamRun.AppImage.${AppImageReplacementTests.UNIQUE}.partial`
      ];
      for (const name of [`.TeamRun.AppImage.${AppImageReplacementTests.UNIQUE}.part`, ...kept])
        await writeFile(path.join(folder, name), AppImageReplacementTests.OLD);

      await this.create(image).replaceAsync(download);

      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", ...kept, "update"].sort()), JSON.stringify((await readdir(folder)).sort()));
      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(image, "utf8"));
    });
  }

  @TestMethod
  public async logsAFolderItCannotFlushAndKeepsTheReplacement(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image, download) => {
      using _open = new FailingFileCallFixture("open", folder, "EIO");

      await this.create(image).replaceAsync(download);

      Assert.areEqual(AppImageReplacementTests.NEW, await readFile(image, "utf8"));
      Assert.areEqual(JSON.stringify([`The AppImage in ${folder} was replaced, but the folder could not be flushed to disk: Error: EIO: operation failed, open '${folder}'`]),
        JSON.stringify(this.logged));
    });
  }

  @TestMethod
  public async refusesWhenItsFolderCannotBeWrittenAndLeavesTheAppImage(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image, download) => {
      using _folder = new UnwritableFolderFixture(folder);

      const failure = await Assert.throwsAsync(() => this.create(image).replaceAsync(download), UpdateHandoffException);

      Assert.isTrue(failure.message.startsWith(`The folder ${folder} cannot be written, so the AppImage in it cannot be replaced with the update: `), failure.message);
      Assert.isTrue(failure.message.includes("EACCES"), failure.message);
      Assert.areEqual(AppImageReplacementTests.OLD, await readFile(image, "utf8"));
      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", "update"]), JSON.stringify((await readdir(folder)).sort()));
    });
  }

  @TestMethod
  public async removesItsCopyWhenTheDownloadCannotBeReadAndLeavesTheAppImage(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, image) => {
      const missing = path.join(folder, "update", "missing.AppImage");

      const failure = await Assert.throwsAsync(() => this.create(image).replaceAsync(missing), UpdateHandoffException);

      Assert.isTrue(failure.message.startsWith(`The AppImage ${image} could not be replaced with the update and was left as it was: `), failure.message);
      Assert.isTrue(failure.message.includes("ENOENT"), failure.message);
      Assert.areEqual(AppImageReplacementTests.OLD, await readFile(image, "utf8"));
      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", "update"]), JSON.stringify((await readdir(folder)).sort()));
    });
  }

  @TestMethod
  public async refusesWhenTheAppImageCannotBeRead(): Promise<void> {
    await AppImageReplacementTests.runInFolderAsync(async (folder, _image, download) => {
      const missing = path.join(folder, "Missing.AppImage");

      const failure = await Assert.throwsAsync(() => this.create(missing).replaceAsync(download), UpdateHandoffException);

      Assert.isTrue(failure.message.startsWith(`The AppImage ${missing} could not be read, so the update was not installed: `), failure.message);
      Assert.isTrue(failure.message.includes("ENOENT"), failure.message);
      Assert.areEqual(JSON.stringify(["TeamRun.AppImage", "update"]), JSON.stringify((await readdir(folder)).sort()));
    });
  }

  private create(image: string): AppImageReplacement {
    return new AppImageReplacement(image, t => this.logged.push(t));
  }

  private static async runInFolderAsync(action: (folder: string, image: string, download: string) => Promise<void>): Promise<void> {
    const folder = await realpath(await mkdtemp(path.join(tmpdir(), "tr-replace-")));
    try {
      const image = path.join(folder, "TeamRun.AppImage");
      const download = path.join(folder, "update", "TeamRun-linux-x64.AppImage");
      await writeFile(image, AppImageReplacementTests.OLD);
      await chmod(image, 0o750);
      await mkdir(path.dirname(download));
      await writeFile(download, AppImageReplacementTests.NEW);
      await action(folder, image, download);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
