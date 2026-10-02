/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  DataDirectory,
  DiscoveryPublisher,
  FolderProtectorFactory,
  OwnershipLock,
  OwnershipReleasedException,
  RuntimeDiscovery,
  SystemCommand
} from "@noldova/teamrun-shell-runtime";

import { AccessControlFixture } from "../../fixtures/access-control.fixture.js";
import { AccessRecordingProtectorFixture } from "../../fixtures/access-recording-protector.fixture.js";
import { FolderProtectorFixture } from "../../fixtures/folder-protector.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DiscoveryPublisherTests {
  private static readonly DISCOVERY: RuntimeDiscovery = new RuntimeDiscovery("127.0.0.1:52000", "secret-token", 4242, "/opt/teamrun/node", "0.0.1", 1, "build-1");

  @TestMethod
  public async publishesTheMetadataAsOneFileAndProtectsTheNewFolderOnce(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const protector = new FolderProtectorFixture();
    const publisher = new DiscoveryPublisher(lock, protector);
    const replacement = new RuntimeDiscovery("127.0.0.1:52001", "other-token", 4243, "/opt/teamrun/node", "0.0.1", 1, "build-1");

    const file = await publisher.publishAsync(DiscoveryPublisherTests.DISCOVERY);
    await publisher.publishAsync(replacement);

    Assert.areEqual(lock.dataDirectory.discoveryFile, file);
    Assert.areEqual(lock.dataDirectory.discoveryFolder, protector.folders.join(","));
    Assert.areEqual("runtime.json", (await readdir(lock.dataDirectory.discoveryFolder)).join(","));
    Assert.areEqual(`${JSON.stringify(replacement.toJson())}\n`, await readFile(file, "utf8"));
  }

  @TestMethod
  public async retriesTheRenameWhileTheOldFileIsHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    let attempts = 0;
    const publisher = new DiscoveryPublisher(lock, new FolderProtectorFixture(), (from, to) => {
      attempts++;
      return attempts < 3 ? Promise.reject(Object.assign(new Error("held"), { code: attempts === 1 ? "EPERM" : "EBUSY" })) : rename(from, to);
    });

    const file = await publisher.publishAsync(DiscoveryPublisherTests.DISCOVERY);

    Assert.areEqual(3, attempts);
    Assert.areEqual("runtime.json", (await readdir(lock.dataDirectory.discoveryFolder)).join(","));
    Assert.areEqual(`${JSON.stringify(DiscoveryPublisherTests.DISCOVERY.toJson())}\n`, await readFile(file, "utf8"));
  }

  @TestMethod
  public async removesItsNewFileWhenTheRenameKeepsFailing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    let held = 0;
    let broken = 0;
    const heldPublisher = new DiscoveryPublisher(lock, new FolderProtectorFixture(), () => {
      held++;
      return Promise.reject(Object.assign(new Error("held"), { code: "EACCES" }));
    });
    const brokenPublisher = new DiscoveryPublisher(lock, new FolderProtectorFixture(), () => {
      broken++;
      return Promise.reject(Object.assign(new Error("broken"), { code: "EIO" }));
    });

    const heldFailure = await Assert.throwsAsync(() => heldPublisher.publishAsync(DiscoveryPublisherTests.DISCOVERY), Error);
    const brokenFailure = await Assert.throwsAsync(() => brokenPublisher.publishAsync(DiscoveryPublisherTests.DISCOVERY), Error);
    const left = await readdir(lock.dataDirectory.discoveryFolder);

    Assert.areEqual("held 40, broken 1", `${heldFailure.message} ${held}, ${brokenFailure.message} ${broken}`);
    Assert.areEqual(0, left.length);
  }

  @TestMethod
  public async withdrawsOnlyItsOwnMetadata(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const publisher = new DiscoveryPublisher(lock, new FolderProtectorFixture());
    const other = new RuntimeDiscovery("127.0.0.1:52001", "other-token", 4243, "/opt/teamrun/node", "0.0.1", 1, "build-1");

    const missing = await publisher.withdrawAsync(DiscoveryPublisherTests.DISCOVERY);
    await publisher.publishAsync(other);
    const foreign = await publisher.withdrawAsync(DiscoveryPublisherTests.DISCOVERY);
    const own = await publisher.withdrawAsync(other);

    Assert.isFalse(missing);
    Assert.isFalse(foreign);
    Assert.isTrue(own);
    Assert.isFalse(existsSync(lock.dataDirectory.discoveryFile));
  }

  @TestMethod
  public async publishesAndWithdrawsOnlyWhileTheOwnershipIsHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const publisher = new DiscoveryPublisher(lock, new FolderProtectorFixture());
    lock.release();

    await Assert.throwsAsync(() => publisher.publishAsync(DiscoveryPublisherTests.DISCOVERY), OwnershipReleasedException);
    await Assert.throwsAsync(() => publisher.withdrawAsync(DiscoveryPublisherTests.DISCOVERY), OwnershipReleasedException);
  }

  @TestMethod
  public async leavesTheDiscoveryReadableByTheCurrentUserAlone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const protector = new AccessRecordingProtectorFixture(FolderProtectorFactory.create(process.platform, new SystemCommand(), process.env));

    const file = await new DiscoveryPublisher(lock, protector).publishAsync(DiscoveryPublisherTests.DISCOVERY);

    if (process.platform === "win32") {
      const access = `before: ${protector.before}; after: ${AccessControlFixture.readSddl(lock.dataDirectory.discoveryFolder)}`;
      DiscoveryPublisherTests.assertOwnerOnlyAccess(lock.dataDirectory.discoveryFolder, "(OI)(CI)(F)", access);
      DiscoveryPublisherTests.assertOwnerOnlyAccess(file, "(I)(F)", access);
    }
    else {
      Assert.areEqual(0o700, (await stat(lock.dataDirectory.discoveryFolder)).mode & 0o777);
      Assert.areEqual(0o600, (await stat(file)).mode & 0o777);
    }
  }

  @TestMethod
  public async keepsAnExistingFolderAsItIs(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const protector = new FolderProtectorFixture();
    await new DiscoveryPublisher(lock, new FolderProtectorFixture()).publishAsync(DiscoveryPublisherTests.DISCOVERY);
    await writeFile(path.join(lock.dataDirectory.discoveryFolder, "note.txt"), "kept");

    await new DiscoveryPublisher(lock, protector).publishAsync(DiscoveryPublisherTests.DISCOVERY);

    Assert.areEqual(0, protector.folders.length);
    Assert.areEqual("note.txt,runtime.json", (await readdir(lock.dataDirectory.discoveryFolder)).sort().join(","));
  }

  private static assertOwnerOnlyAccess(target: string, rights: string, access: string): void {
    const user = execFileSync(path.join(process.env["SystemRoot"] ?? "", "System32", "whoami.exe"), { encoding: "utf8" }).trim().toLowerCase();
    const entries = execFileSync(path.join(process.env["SystemRoot"] ?? "", "System32", "icacls.exe"), [target], { encoding: "utf8" })
      .replace(target, "")
      .split(/\r?\n/)
      .map(t => t.trim())
      .filter(t => t.includes(":("));

    Assert.areEqual(1, entries.length, `${entries.join(" | ")}; ${access}`);
    Assert.areEqual(`${user}:${rights}`.toLowerCase(), entries[0]?.toLowerCase(), access);
  }
}
