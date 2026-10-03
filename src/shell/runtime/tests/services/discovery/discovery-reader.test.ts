/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, DiscoveryFormatException, DiscoveryPublisher, DiscoveryReader, OwnershipLock, RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";

import { FolderProtectorFixture } from "../../fixtures/folder-protector.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DiscoveryReaderTests {
  @TestMethod
  public async readsWhatTheOwnerPublished(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);
    const published = new RuntimeDiscovery("127.0.0.1:52000", "token", 4242, "/opt/teamrun/node", "0.0.1", 1, "build");
    await new DiscoveryPublisher(lock, new FolderProtectorFixture()).publishAsync(published);

    const discovery = await DiscoveryReader.readAsync(directory);

    Assert.areEqual(JSON.stringify(published.toJson()), JSON.stringify(discovery?.toJson()));
  }

  @TestMethod
  public async findsNothingWithoutADiscoveryFile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    Assert.isNull(await DiscoveryReader.readAsync(new DataDirectory(folder.path)));
  }

  @TestMethod
  public async findsNothingOnceTheOwnerHasWithdrawnTheFile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);
    const publisher = new DiscoveryPublisher(lock, new FolderProtectorFixture());
    const published = new RuntimeDiscovery("127.0.0.1:52000", "token", 4242, "/opt/teamrun/node", "0.0.1", 1, "build");
    await publisher.publishAsync(published);
    await publisher.withdrawAsync(published);

    const discovery = await DiscoveryReader.readAsync(directory);

    Assert.isTrue(existsSync(directory.discoveryFolder));
    Assert.isNull(discovery);
  }

  @TestMethod
  public async letsAFileThatCannotBeReadFail(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await mkdir(directory.discoveryFile, { recursive: true });

    const error = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), Error);

    Assert.areEqual("EISDIR", (error as NodeJS.ErrnoException).code);
  }

  @TestMethod
  public async refusesAMalformedFileAndNamesIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await mkdir(directory.discoveryFolder);

    await writeFile(directory.discoveryFile, "{ not json");
    const unparsable = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), DiscoveryFormatException);
    await writeFile(directory.discoveryFile, "{\"formatVersion\":2}");
    const newer = await Assert.throwsAsync(() => DiscoveryReader.readAsync(directory), DiscoveryFormatException);

    Assert.isTrue(unparsable.message.startsWith(`The discovery file ${directory.discoveryFile} is not valid: SyntaxError`));
    Assert.isInstanceOf(unparsable.cause, SyntaxError);
    Assert.isTrue(newer.message.endsWith("DiscoveryFormatException: The discovery metadata has the unsupported format version 2."));
  }
}
