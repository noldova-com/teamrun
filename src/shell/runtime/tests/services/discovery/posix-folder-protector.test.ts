/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, stat } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PosixFolderProtector } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PosixFolderProtectorTests {
  @TestMethod
  public async setsTheFolderToOwnerOnly(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await chmod(folder.path, 0o755);

    await new PosixFolderProtector().protectAsync(folder.path);

    const expected = process.platform === "win32" ? (await stat(folder.path)).mode & 0o777 : 0o700;
    Assert.areEqual(expected, (await stat(folder.path)).mode & 0o777);
  }
}
