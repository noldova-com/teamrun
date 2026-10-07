/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateCheckLock, UpdateException } from "@noldova/teamrun-shell-desktop";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";

@TestClass
export class UpdateCheckLockTests {
  private static readonly SELF: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "desktop");
  private static readonly OTHER: UpdateProcess = new UpdateProcess(5230, 1600, 1601, "desktop");

  @TestMethod
  public holdsTheLockUntilItLetsGoAndLeavesNoTemporaryFile(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const file = join(folder, "installation", "update-check.lock");
      const lock = new UpdateCheckLock(join(folder, "installation"), () => Promise.resolve(UpdateCheckLockTests.SELF), () => Promise.resolve(true));

      const isHeld = await lock.tryAcquireAsync();
      const text = await readFile(file, "utf8");
      await lock.releaseAsync();
      await lock.releaseAsync();

      Assert.isTrue(isHeld);
      Assert.areEqual(JSON.stringify(UpdateCheckLockTests.SELF.toJson()), text);
      Assert.isFalse(existsSync(file));
      Assert.areEqual(0, (await readdir(join(folder, "installation"))).length);
    });
  }

  @TestMethod
  public leavesALockToAHolderThatRuns(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const file = join(folder, "update-check.lock");
      const asked: number[] = [];
      await writeFile(file, JSON.stringify(UpdateCheckLockTests.OTHER.toJson()));
      const lock = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), t => {
        asked.push(t.processId);
        return Promise.resolve(true);
      });

      const isHeld = await lock.tryAcquireAsync();
      await lock.releaseAsync();

      Assert.isFalse(isHeld);
      Assert.areEqual(JSON.stringify([5230]), JSON.stringify(asked));
      Assert.areEqual(JSON.stringify(UpdateCheckLockTests.OTHER.toJson()), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public async takesOverALockWhoseHolderIsGoneOrUnreadable(): Promise<void> {
    for (const text of [JSON.stringify(UpdateCheckLockTests.OTHER.toJson()), "{\"processId\":"])
      await UpdateCheckLockTests.withFolderAsync(async folder => {
        const file = join(folder, "update-check.lock");
        await writeFile(file, text);
        const lock = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), () => Promise.resolve(false));

        const isHeld = await lock.tryAcquireAsync();

        Assert.isTrue(isHeld, text);
        Assert.areEqual(JSON.stringify(UpdateCheckLockTests.SELF.toJson()), await readFile(file, "utf8"));
        Assert.areEqual(1, (await readdir(folder)).length);
      });
  }

  @TestMethod
  public leavesALockThatAnotherDesktopTookOverOrRemovedMeanwhile(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const file = join(folder, "update-check.lock");
      const newer = JSON.stringify(new UpdateProcess(6340, 1700, 1701, "desktop").toJson());
      await writeFile(file, JSON.stringify(UpdateCheckLockTests.OTHER.toJson()));
      const replacing = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), async () => {
        await writeFile(file, newer);
        return false;
      });
      const removing = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), async () => {
        await rm(file);
        return false;
      });

      const isReplacedHeld = await replacing.tryAcquireAsync();
      const kept = await readFile(file, "utf8");
      const isRemovedHeld = await removing.tryAcquireAsync();

      Assert.isFalse(isReplacedHeld);
      Assert.areEqual(newer, kept);
      Assert.isFalse(isRemovedHeld);
      Assert.areEqual(0, (await readdir(folder)).length);
    });
  }

  @TestMethod
  public countsALockItCannotReadAsHeld(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const file = join(folder, "update-check.lock");
      await mkdir(file);
      const lock = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), () => Promise.resolve(false));

      Assert.isFalse(await lock.tryAcquireAsync());
      Assert.isTrue(existsSync(file));
    });
  }

  @TestMethod
  public letsGoOfNothingButItsOwnLock(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const file = join(folder, "update-check.lock");
      const other = JSON.stringify(UpdateCheckLockTests.OTHER.toJson());
      const lock = new UpdateCheckLock(folder, () => Promise.resolve(UpdateCheckLockTests.SELF), () => Promise.resolve(true));

      await lock.tryAcquireAsync();
      await writeFile(file, other);
      await lock.releaseAsync();
      const kept = await readFile(file, "utf8");
      await rm(file);
      const isHeldAgain = await lock.tryAcquireAsync();
      await rm(file);
      await lock.releaseAsync();

      Assert.areEqual(other, kept);
      Assert.isTrue(isHeldAgain);
      Assert.areEqual(0, (await readdir(folder)).length);
    });
  }

  @TestMethod
  public refusesToCheckWhenItCannotIdentifyItsOwnProcess(): Promise<void> {
    return UpdateCheckLockTests.withFolderAsync(async folder => {
      const lock = new UpdateCheckLock(folder, () => Promise.resolve(null), () => Promise.resolve(false));

      const failure = await Assert.throwsAsync(() => lock.tryAcquireAsync(), UpdateException);

      Assert.areEqual("The desktop could not identify its own process, so it cannot check for updates.", failure.message);
      Assert.areEqual(0, (await readdir(folder)).length);
    });
  }

  private static async withFolderAsync(run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-update-check-lock-"));
    try {
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
