/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderAccount } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class AccountRemoveCommandTests {
  @TestMethod
  public async removesTheAccount(): Promise<void> {
    await using host = await CliTestHost.create();
    const account = ProviderAccount.fromJson(await host.runJson("account-add", "fake", "Work", host.directory.resolve("profile")));

    const code = await host.run("account-remove", account.id);
    const printed = host.console.lastLine;
    const json = await host.runJson("account-remove", account.id).catch(() => "failed");

    Assert.areEqual(0, code);
    Assert.areEqual(account.id, printed);
    Assert.areEqual("failed", json);
  }
}
