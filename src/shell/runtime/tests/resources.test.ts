/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, DataDirectoryInspector, OwnershipLock } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "./fixtures/temporary-folder.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public async namesMovedDataByTheUtcSecondWithoutSeparators(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "teamrun"));
    using lock = OwnershipLock.acquire(directory);
    await writeFile(path.join(directory.root, "teamrun.db"), "");

    const destination = await DataDirectoryInspector.moveAsideAsync(lock, new Date("2026-01-02T03:04:05.006Z"));

    Assert.areEqual(`${directory.root}-before-shell-20260102T030405Z`, destination);
  }
}
