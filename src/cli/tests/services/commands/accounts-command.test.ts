/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class AccountsCommandTests {
  @TestMethod
  public async listsAccounts(): Promise<void> {
    await using host = await CliTestHost.create();

    const empty = await host.run("accounts");
    const emptyLine = host.console.lastLine;
    await host.run("account-add", "fake", "Work", host.directory.resolve("profile"));
    const listed = await host.run("accounts");

    Assert.areEqual(0, empty);
    Assert.areEqual("(none)", emptyLine);
    Assert.areEqual(0, listed);
    Assert.isTrue(host.console.lastLine.includes("  fake  Work  Unknown  "));
  }
}
