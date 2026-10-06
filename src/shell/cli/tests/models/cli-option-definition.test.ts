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
export class CliOptionDefinitionTests {
  @TestMethod
  public async showsItsCamelCaseNameAsAKebabCaseFlagWithAPlaceholderForItsType(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const option = (name: string, type: string, required: boolean, fallback: unknown): Readonly<Record<string, unknown>> =>
      ({ name, description: `The ${name}.`, type, required, repeated: false, default: fallback });
    const options = [option("dryRun", "Boolean", false, null), option("maxCount", "Number", true, null), option("title", "Text", false, "Untitled")];
    await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], [ProbeBuildFixture.command("notes.add", [], options)])]);

    const help = await fixture.runAsync(["help", "notes", "add"]);

    Assert.areEqual([
      "Usage: teamrun notes add [--dry-run] --max-count <number> [--title <text>]",
      "",
      "Runs notes.add.",
      "",
      "Options:",
      "  --dry-run             The dryRun.",
      "  --max-count <number>  The maxCount. Required.",
      "  --title <text>        The title. Default: \"Untitled\".",
      ""
    ].join("\n"), help.output);
  }

  @TestMethod
  public async refusesDeclarationsWhoseOptionHasAnUnknownTypeOrLacksAField(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const prefix = `The module declarations ${fixture.declarationsFile} hold command-line commands that are not valid: notes.cliCommands.0.options.0.`;
    const option = { name: "title", description: "The title.", type: "Text", required: false, repeated: false, default: null };
    const cases: readonly (readonly [Readonly<Record<string, unknown>>, string])[] = [
      [{ ...option, type: "Date" }, "type: Expected one of Text, Number, Boolean."],
      [{ ...option, name: "" }, "name: Expected a string that is not blank."],
      [{ ...option, repeated: null }, "repeated: Null is not an accepted value here."],
      [{ ...option, default: undefined }, "default: The field is required."]
    ];

    for (const [declared, problem] of cases) {
      await fixture.writeDeclarationsAsync([ProbeBuildFixture.declare("notes", "Notes", [], [ProbeBuildFixture.command("notes.add", [], [declared])])]);

      const help = await fixture.runAsync(["help"]);

      Assert.areEqual(1, help.code, problem);
      Assert.areEqual(`${prefix}${problem}\n`, help.error);
    }
  }
}
