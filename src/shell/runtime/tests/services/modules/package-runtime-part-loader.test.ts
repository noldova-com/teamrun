/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleLoadException, PackageRuntimePartLoader } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PackageRuntimePartLoaderTests {
  @TestMethod
  public constructsThePackagesRuntimePart(): Promise<void> {
    return PackageRuntimePartLoaderTests.runAsync(
      "export class RuntimePart {\n  async activateAsync() {}\n  async deactivateAsync() {}\n  get kind() { return \"notes\"; }\n}\n",
      async name => {
        const part = await new PackageRuntimePartLoader().loadAsync(name);

        Assert.isTrue("kind" in part && part.kind === "notes");
      });
  }

  @TestMethod
  @TestData("export const other = 1;\n")
  @TestData("export const RuntimePart = {};\n")
  @TestData("export class RuntimePart {\n  async deactivateAsync() {}\n}\n")
  @TestData("export class RuntimePart {\n  activateAsync = 1;\n  async deactivateAsync() {}\n}\n")
  @TestData("export class RuntimePart {\n  async activateAsync() {}\n}\n")
  @TestData("export class RuntimePart {\n  async activateAsync() {}\n  deactivateAsync = 1;\n}\n")
  public refusesAPackageWithoutAUsableRuntimePart(source: string): Promise<void> {
    return PackageRuntimePartLoaderTests.runAsync(source, async name => {
      const exception = await Assert.throwsAsync(() => new PackageRuntimePartLoader().loadAsync(name), ModuleLoadException);

      Assert.areEqual("The package does not export a RuntimePart class whose instances can activate and deactivate.", exception.message);
    });
  }

  @TestMethod
  public passesOnAFailedImport(): Promise<void> {
    return PackageRuntimePartLoaderTests.runAsync("export {};\n", async name => {
      await Assert.throwsAsync(() => new PackageRuntimePartLoader().loadAsync(name.replace("part.mjs", "missing.mjs")), Error);
    });
  }

  private static async runAsync(source: string, action: (name: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "part.mjs");
    await writeFile(file, source);
    await action(pathToFileURL(file).href);
  }
}
