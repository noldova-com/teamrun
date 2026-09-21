/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProjectInstructions } from "@noldova/teamrun-providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ProjectInstructionsTests {
  @TestMethod
  public doesNotReadAnImportThroughALinkOutsideTheProject(): void {
    using directory = new TemporaryDirectory();
    const project = directory.resolve("project");
    const outside = directory.resolve("outside");
    mkdirSync(project);
    mkdirSync(outside);
    writeFileSync(directory.resolve("outside", "instructions.md"), "external-only-fixture-text");
    symlinkSync(outside, directory.resolve("project", "linked"), process.platform === "win32" ? "junction" : "dir");
    writeFileSync(directory.resolve("project", "CLAUDE.md"), "@linked/instructions.md");

    const result = ProjectInstructions.read(project);

    Assert.isFalse(result?.includes("external-only-fixture-text") ?? false);
    Assert.isTrue(result?.includes("@linked/instructions.md") ?? false);
  }

  @TestMethod
  public readsInternalLinksWhenTheProjectItselfIsOpenedThroughAnAlias(): void {
    using directory = new TemporaryDirectory();
    const project = directory.resolve("project");
    const nested = directory.resolve("project", "nested");
    const alias = directory.resolve("alias");
    mkdirSync(nested, { recursive: true });
    writeFileSync(directory.resolve("project", "nested", "instructions.md"), "internal-fixture-instructions");
    symlinkSync(nested, directory.resolve("project", "linked"), process.platform === "win32" ? "junction" : "dir");
    symlinkSync(project, alias, process.platform === "win32" ? "junction" : "dir");
    writeFileSync(directory.resolve("project", "CLAUDE.md"), "@linked/instructions.md");

    const result = ProjectInstructions.read(alias);

    Assert.isTrue(result?.includes("internal-fixture-instructions") ?? false);
  }
}
