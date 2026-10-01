/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FolderProtectorFactory, PosixFolderProtector, SystemCommand, WindowsFolderProtector } from "@noldova/teamrun-shell-runtime";

@TestClass
export class FolderProtectorFactoryTests {
  @TestMethod
  public choosesSystemToolsOnWindows(): void {
    Assert.isInstanceOf(FolderProtectorFactory.create("win32", new SystemCommand(), {}), WindowsFolderProtector);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public choosesPosixPermissionsElsewhere(platform: string): void {
    Assert.isInstanceOf(FolderProtectorFactory.create(platform, new SystemCommand(), {}), PosixFolderProtector);
  }
}
