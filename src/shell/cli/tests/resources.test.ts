/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "./fixtures/cli.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public async describesEveryCommandOptionAndExitCodeUnderTheProductsName(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const parts = [
      "Usage: teamrun <command> [options]\n",
      "\n  status ",
      "\n  commands ",
      "\n  run <command> [<json> | --args-file <path> | -]\n",
      "\n  open                                     Starts TeamRun or brings its window forward.\n",
      "\n  help [<module> [<command>]]              Prints this help, a module's commands or one command's help.\n",
      "\n  <module> <command> [<argument>...]       Runs a module's command with its arguments and options.\n",
      "\n  --help ",
      "\n  --data-dir <path> ",
      "\n  --device-dir <path> ",
      "\n  --json ",
      "\n  --no-start ",
      "\n  --take-over ",
      "\n  --timeout <seconds> ",
      "\nExit codes: 0 success, 1 the command failed, 2 usage, 3 no runtime running, 4 another build's runtime,\n5 data directory unusable, 6 timed out or cancelled, 7 module not active, 8 TeamRun is installing an update,\n9 a module command ran but a command-line part failed to stop.\n"
    ];

    const help = await fixture.runAsync(["help"]);

    Assert.areEqual(0, help.code);
    for (const part of parts)
      Assert.isTrue(help.output.includes(part), part);
  }

  @TestMethod
  public async takesEachNameTheBuildReservesAsItsOwnCommand(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const names = ["status", "commands", "run", "open", "help"];

    const results = await Promise.all(names.map(t => fixture.runAsync([t, "--frobnicate"])));

    Assert.areEqual(JSON.stringify(names.map(() => [2, true])), JSON.stringify(results.map(t => [t.code, t.error.startsWith("\"--frobnicate\" is not an option.\n")])));
  }
}
