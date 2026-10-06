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
export class CliArgumentDefinitionTests {
  @TestMethod
  public async showsItsCamelCaseNameAsAKebabCasePlaceholder(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const argument = { name: "notePath", description: "The note's path.", required: true, variadic: false };
    await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], [ProbeBuildFixture.command("notes.open", [argument])])]);

    const help = await fixture.runAsync(["help", "notes", "open"]);

    Assert.areEqual("Usage: teamrun notes open <note-path>\n\nRuns notes.open.\n\nArguments:\n  <note-path>  The note's path.\n", help.output);
  }

  @TestMethod
  public async refusesDeclarationsWhoseArgumentLacksADescriptionOrFlags(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const prefix = `The module declarations ${fixture.declarationsFile} hold command-line commands that are not valid: JsonException: notes.cliCommands.0.arguments.0.`;
    const cases: readonly (readonly [Readonly<Record<string, unknown>>, string])[] = [
      [{ name: "notePath", description: " ", required: true, variadic: false }, "description: Expected a string that is not blank."],
      [{ name: "notePath", description: "The path.", variadic: false }, "required: The field is required."],
      [{ name: "notePath", description: "The path.", required: true, variadic: "no" }, "variadic: Expected boolean."]
    ];

    for (const [argument, problem] of cases) {
      await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], [ProbeBuildFixture.command("notes.open", [argument])])]);

      const help = await fixture.runAsync(["help"]);

      Assert.areEqual(1, help.code, problem);
      Assert.areEqual(`${prefix}${problem}\n`, help.error);
    }
  }
}
