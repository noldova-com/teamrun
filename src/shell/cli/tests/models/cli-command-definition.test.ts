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
export class CliCommandDefinitionTests {
  @TestMethod
  public async isCalledByTheKebabCaseOfItsNameAfterTheModuleId(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const commands = [ProbeBuildFixture.command("notes.addNote", [], [], "Adds a note to the open notebook."), ProbeBuildFixture.command("notes.list")];
    await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], commands)]);

    const module = await fixture.runAsync(["help", "notes"]);
    const command = await fixture.runAsync(["help", "notes", "add-note"]);
    const camel = await fixture.runAsync(["help", "notes", "addNote"]);

    Assert.isTrue(module.output.includes("\n  add-note  Runs notes.addNote.\n  list      Runs notes.list.\n"), module.output);
    Assert.areEqual("Usage: teamrun notes add-note\n\nAdds a note to the open notebook.\n", command.output);
    Assert.areEqual(2, camel.code);
  }

  @TestMethod
  public async refusesDeclarationsWhoseCommandLacksASummaryOrHasABlankExample(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const prefix = `The module declarations ${fixture.declarationsFile} could not be read: $.modules.0.cliCommands.0.`;
    const command = ProbeBuildFixture.command("notes.add");
    const cases: readonly (readonly [Readonly<Record<string, unknown>>, string])[] = [
      [{ ...command, summary: " " }, "summary: Expected a string that is not blank."],
      [{ ...command, description: 1 }, "description: Expected string."],
      [{ ...command, options: undefined }, "options: The field is required."],
      [{ ...command, examples: [{ arguments: "x", description: "" }] }, "examples.0.description: Expected a string that is not blank."]
    ];

    for (const [declared, problem] of cases) {
      await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], [declared])]);

      const help = await fixture.runAsync(["help"]);

      Assert.areEqual(1, help.code, problem);
      Assert.areEqual(`${prefix}${problem}\n`, help.error);
    }
  }
}
