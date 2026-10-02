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
import { DeclarationsFormatException, ModuleDeclarationReader } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ModuleDeclarationReaderTests {
  private static readonly NOTES: Readonly<Record<string, unknown>> = { id: "notes", displayName: "Notes", dependencies: [], runtimePackage: null, contributes: {} };

  @TestMethod
  public readsTheBuildsDeclarationsInOrder(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      const tasks = { ...ModuleDeclarationReaderTests.NOTES, id: "tasks", displayName: "Tasks" };
      await writeFile(file, JSON.stringify({ formatVersion: 1, modules: [tasks, { ...ModuleDeclarationReaderTests.NOTES, dependencies: ["tasks"] }] }));

      const declarations = await ModuleDeclarationReader.readAsync(file);

      Assert.areEqual("tasks,notes", declarations.map(t => t.id).join(","));
      Assert.areEqual("tasks", declarations[1]?.dependencies.join(","));
    });
  }

  @TestMethod
  public refusesAMissingOrMalformedFileAndNamesIt(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      const missing = await Assert.throwsAsync(() => ModuleDeclarationReader.readAsync(file), DeclarationsFormatException);
      const cases: readonly (readonly [string, string])[] = [
        ["{", "SyntaxError"],
        ["[]", "The module declarations are not a JSON object with a list of modules."],
        ["{\"modules\":[]}", "The module declarations have the unsupported format version undefined."],
        ["{\"formatVersion\":2,\"modules\":[]}", "The module declarations have the unsupported format version 2."],
        ["{\"formatVersion\":1}", "The module declarations are not a JSON object with a list of modules."],
        ["{\"formatVersion\":1,\"modules\":[{}]}", "A module declaration's id is missing or invalid."]
      ];

      Assert.isTrue(missing.message.startsWith(`The module declarations ${file} are not valid: Error: ENOENT`), missing.message);
      Assert.isDefined(missing.cause);
      for (const [text, reason] of cases) {
        await writeFile(file, text);
        const exception = await Assert.throwsAsync(() => ModuleDeclarationReader.readAsync(file), DeclarationsFormatException);
        Assert.isTrue(exception.message.startsWith(`The module declarations ${file} are not valid: `), exception.message);
        Assert.isTrue(exception.message.includes(reason), exception.message);
      }
    });
  }

  private static async runAsync(action: (file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await action(path.join(folder.path, "declarations.json"));
  }
}
