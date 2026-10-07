/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowsProcessApi } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class WindowsProcessApiTests {
  @TestMethod
  @PlatformFixture.windowsOnly()
  public async holdsAFileThatCanBeReadButNotWrittenRenamedOrDeletedUntilItIsClosedOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = join(folder.path, "TeamRun-windows-x64.exe");
    await writeFile(file, "TeamRun 1.3.0");
    const api = new WindowsProcessApi();

    const handle = api.openFileForReading(file);
    const codeOf = (error: unknown): unknown => Reflect.get(Object(error), "code");
    let read: string;
    let written: unknown;
    let renamed: unknown;
    let deleted: unknown;
    try {
      read = await readFile(file, "utf8");
      written = await writeFile(file, "changed").then(() => null, codeOf);
      renamed = await rename(file, `${file}.moved`).then(() => null, codeOf);
      deleted = await rm(file).then(() => null, codeOf);
    }
    finally {
      if (Object.isBigInt(handle))
        api.closeHandle(handle);
    }
    await rename(file, `${file}.moved`);

    Assert.isTrue(Object.isBigInt(handle));
    Assert.areEqual("TeamRun 1.3.0", read);
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(written)), String(written));
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(renamed)), String(renamed));
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(deleted)), String(deleted));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async givesTheWindowsErrorForAFileItCannotOpenAndRefusesAPathWithANullCharacterOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const api = new WindowsProcessApi();

    const missing = api.openFileForReading(join(folder.path, "gone.exe"));

    Assert.areEqual(2, missing);
    Assert.throws(() => api.openFileForReading(`${join(folder.path, "gone.exe")}\0.txt`), TypeError);
  }
}
