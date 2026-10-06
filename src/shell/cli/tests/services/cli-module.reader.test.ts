/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";

@TestClass
export class CliModuleReaderTests {
  @TestMethod
  public async refusesDeclarationsItCannotReadAsAFailureNamingTheFile(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const prefix = `The module declarations ${fixture.declarationsFile} are not valid: `;

    await fixture.writeDeclarationsAsync([], 2);
    const version = await fixture.runAsync(["help", "--json"]);
    await fixture.writeDeclarationsAsync([], "1");
    const versionText = await fixture.runAsync(["help"]);
    await fixture.writeDeclarationsAsync([{ id: "notes" }]);
    const module = await fixture.runAsync(["help"]);
    await writeFile(fixture.declarationsFile, "{");
    const text = await fixture.runAsync(["help"]);
    await rm(fixture.declarationsFile);
    const missing = await fixture.runAsync(["help"]);

    Assert.areEqual(1, version.code, version.error);
    Assert.areEqual(`${JSON.stringify({ code: "Failed", message: `${prefix}DeclarationsFormatException: The module declarations have the unsupported format version 2.` })}\n`, version.error);
    Assert.areEqual(`${prefix}DeclarationsFormatException: The module declarations have the unsupported format version 1.\n`, versionText.error);
    Assert.areEqual(`${prefix}DeclarationsFormatException: A module declaration's version is missing or invalid.\n`, module.error);
    Assert.isTrue(text.error.startsWith(`${prefix}SyntaxError: `), text.error);
    Assert.areEqual(1, missing.code);
    Assert.isTrue(missing.error.startsWith(`${prefix}Error: ENOENT`), missing.error);
    Assert.areEqual("", missing.output);
  }

  @TestMethod
  public async isNotReadByTheCommandLinesOwnCommandsOtherThanHelp(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await rm(fixture.declarationsFile);

    const status = await fixture.runAsync(fixture.withDataDirectory(["status"]));

    Assert.areEqual(3, status.code, status.error);
  }
}
