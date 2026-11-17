/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { HomeInstructions, InstructionFile } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class HomeInstructionsTests {
  @TestMethod
  public keepsTheFilesInOrderUpToTheTotalAndNamesThoseLeftOut(): void {
    const files = ["a", "b", "c"].map(t => new InstructionFile(`/home/person/.grok/rules/${t}.md`, t.repeat(60_000)));

    const text = HomeInstructions.format("Grok", files) ?? "";

    Assert.isTrue(text.startsWith("The Grok instruction files TeamRun loaded for this session, the person's own from their home, then the project's, since Grok reads none of them itself:\n\nContents of /home/person/.grok/rules/a.md:\n\n"));
    Assert.isTrue(text.includes(`Contents of /home/person/.grok/rules/b.md:\n\n${"b".repeat(60_000)}\n\n`));
    Assert.isFalse(text.includes("Contents of /home/person/.grok/rules/c.md"));
    Assert.isTrue(text.endsWith("\n\nLeft out to keep the instructions under 131072 characters: /home/person/.grok/rules/c.md."));
    Assert.isNull(HomeInstructions.format("Grok", []));
  }

  @TestMethod
  public readsEachFileAsItIsAndSkipsOneThatIsMissingOrCantBeRead(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("home", "folder.md"), { recursive: true });
    writeFileSync(directory.resolve("home", "a.md"), "a-fixture\n@b.md");
    writeFileSync(directory.resolve("home", "b.md"), "b-fixture");

    const files = HomeInstructions.readAll([directory.resolve("home", "a.md"), directory.resolve("home", "missing.md"), directory.resolve("home", "folder.md")]);

    Assert.areEqual(`${directory.resolve("home", "a.md")}|a-fixture\n@b.md`, files.map(t => `${t.path}|${t.content}`).join(","));
  }
}
