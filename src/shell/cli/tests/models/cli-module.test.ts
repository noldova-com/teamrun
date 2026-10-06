/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliModuleTests {
  @TestMethod
  public async isListedUnderItsDisplayNameAndDescribedByItsDescription(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await fixture.writeDeclarationsAsync([
      { ...ProbeBuildFixture.declare("notes", "Notes", [], [ProbeBuildFixture.command("notes.add")]), description: "Notes keeps plain text notes." }
    ]);

    const all = await fixture.runAsync(["help"]);
    const module = await fixture.runAsync(["help", "notes"]);

    Assert.isTrue(all.output.endsWith("\nModule commands:\n  Notes\n    teamrun notes add  Runs notes.add.\n"), all.output);
    Assert.isTrue(module.output.startsWith("Usage: teamrun notes <command> [options]\n\nNotes: Notes keeps plain text notes.\n"), module.output);
  }

  @TestMethod
  public async refusesDeclarationsWhoseModuleLacksAFieldTheCommandLineReads(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const prefix = `The module declarations ${fixture.declarationsFile} could not be read: $.modules.0.`;
    const module = ProbeBuildFixture.declare("notes", "Notes", [], []);
    const cases: readonly (readonly [Readonly<Record<string, unknown>>, string])[] = [
      [{ ...module, id: " " }, "id: Expected a string that is not blank."],
      [{ ...module, description: undefined }, "description: The field is required."],
      [{ ...module, dependencies: [1] }, "dependencies.0: Expected string."],
      [{ ...module, cliPackage: false }, "cliPackage: Expected string."],
      [{ ...module, cliCommands: ["notes.add"] }, "cliCommands.0: Expected object."]
    ];

    for (const [declared, problem] of cases) {
      await fixture.writeDeclarationsAsync([declared]);

      const help = await fixture.runAsync(["help"]);

      Assert.areEqual(1, help.code, problem);
      Assert.areEqual(`${prefix}${problem}\n`, help.error);
    }
  }
}
