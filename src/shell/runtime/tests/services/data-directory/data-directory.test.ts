/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DataDirectoryTests {
  private static readonly ROOT: string = path.resolve("teamrun-data");

  @TestMethod
  public normalizesTheRootAndLaysOutItsFiles(): void {
    const directory = new DataDirectory(path.join(DataDirectoryTests.ROOT, "extra", ".."));

    Assert.areEqual(DataDirectoryTests.ROOT, directory.root);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "ownership.sqlite"), directory.ownershipDatabase);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "shell.sqlite"), directory.shellDatabase);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "discovery"), directory.discoveryFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "discovery", "runtime.json"), directory.discoveryFile);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "backups"), directory.backupsFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "desktop"), directory.profileFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules"), directory.modulesFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "work"), directory.workFolder);
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "logs"), directory.logsFolder);
  }

  @TestMethod
  public refusesARelativeRoot(): void {
    const exception = Assert.throws(() => new DataDirectory("teamrun-data"), ArgumentException);

    Assert.areEqual("root", exception.parameterName);
  }

  @TestMethod
  @TestData("checkpoints")
  @TestData("git-hub2")
  public locatesAModuleFolderUnderModules(id: string): void {
    Assert.areEqual(path.join(DataDirectoryTests.ROOT, "modules", id), new DataDirectory(DataDirectoryTests.ROOT).locateModuleFolder(id));
  }

  @TestMethod
  @TestData("shell")
  @TestData("Checkpoints")
  @TestData("-dash")
  @TestData("../escape")
  @TestData("")
  public refusesAnythingButAModuleId(id: string): void {
    const exception = Assert.throws(() => new DataDirectory(DataDirectoryTests.ROOT).locateModuleFolder(id), ArgumentException);

    Assert.areEqual("id", exception.parameterName);
  }
}
