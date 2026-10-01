/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, DataDirectoryOwnedException, OwnershipLock, OwnershipReleasedException } from "@noldova/teamrun-shell-runtime";

import { OwnerProcessFixture } from "../../fixtures/owner-process.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class OwnershipLockTests {
  @TestMethod
  public async createsTheDirectoryAndHoldsItsOwnership(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "nested", "teamrun"));

    using lock = OwnershipLock.acquire(directory);

    Assert.isTrue(lock.isHeld);
    Assert.areEqual(directory, lock.dataDirectory);
    Assert.isTrue(existsSync(directory.ownershipDatabase));
    lock.requireHeld();
  }

  @TestMethod
  public async refusesASecondOwnerInTheSameProcess(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);

    const exception = Assert.throws(() => OwnershipLock.acquire(directory), DataDirectoryOwnedException);

    Assert.areEqual(directory.root, exception.root);
    Assert.isTrue(lock.isHeld);
  }

  @TestMethod
  public async releasesOnceSoTheNextOwnerCanAcquire(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const lock = OwnershipLock.acquire(directory);

    lock.release();
    lock.release();

    Assert.isFalse(lock.isHeld);
    Assert.throws(() => lock.requireHeld(), OwnershipReleasedException);
    using next = OwnershipLock.acquire(directory);
    Assert.isTrue(next.isHeld);
  }

  @TestMethod
  public async letsExactlyOneOfSeveralRacingProcessesOwnTheDirectory(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const owners = await Promise.all([1, 2, 3, 4].map(() => OwnerProcessFixture.startAsync(folder.path)));
    try {
      Assert.areEqual(1, owners.filter(t => t.hasAcquired).length);
      Assert.areEqual(3, owners.filter(t => t.outcome === "owned").length);
      Assert.throws(() => OwnershipLock.acquire(new DataDirectory(folder.path)), DataDirectoryOwnedException);
    }
    finally {
      for (const owner of owners)
        await owner[Symbol.asyncDispose]();
    }
  }

  @TestMethod
  public async passesOwnershipOnWhenTheOwnerReleasesIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using owner = await OwnerProcessFixture.startAsync(folder.path);
    Assert.isTrue(owner.hasAcquired);

    await owner.stopAsync();

    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    Assert.isTrue(lock.isHeld);
  }

  @TestMethod
  public async passesOwnershipOnWhenTheOwnerDies(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using owner = await OwnerProcessFixture.startAsync(folder.path);
    Assert.isTrue(owner.hasAcquired);

    await owner.killAsync();

    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    Assert.isTrue(lock.isHeld);
    await using successor = await OwnerProcessFixture.startAsync(folder.path);
    Assert.areEqual("owned", successor.outcome);
  }

  @TestMethod
  public async reportsAnUnusableOwnershipDatabaseAsIs(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await writeFile(directory.ownershipDatabase, "not a database, but long enough to be read as one by SQLite's header check....");

    const error = Assert.throws(() => OwnershipLock.acquire(directory), Error);

    Assert.isFalse(error instanceof DataDirectoryOwnedException);
  }

  @TestMethod
  public async probesOwnershipWithoutTakingIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));

    const withoutDatabase = OwnershipLock.isOwned(directory);
    const lock = OwnershipLock.acquire(directory);
    const heldHere = OwnershipLock.isOwned(directory);
    lock.release();
    const released = OwnershipLock.isOwned(directory);

    Assert.isFalse(withoutDatabase);
    Assert.isTrue(heldHere);
    Assert.isFalse(released);
    using next = OwnershipLock.acquire(directory);
    Assert.isTrue(next.isHeld);
  }

  @TestMethod
  public async probesNothingIntoExistence(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));

    OwnershipLock.isOwned(directory);

    Assert.isFalse(existsSync(directory.root));
  }

  @TestMethod
  public async seesALiveOwnerInAnotherProcessAndNotADeadOne(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await using owner = await OwnerProcessFixture.startAsync(folder.path);

    const live = OwnershipLock.isOwned(directory);
    await owner.killAsync();
    const dead = OwnershipLock.isOwned(directory);

    Assert.isTrue(live);
    Assert.isFalse(dead);
  }

  @TestMethod
  public async reportsAnUnusableOwnershipDatabaseWhenProbing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await writeFile(directory.ownershipDatabase, "not a database, but long enough to be read as one by SQLite's header check....");

    Assert.throws(() => OwnershipLock.isOwned(directory), Error);
  }
}
