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
export class AccountAddCommandTests {
  @TestMethod
  public async addsAnAccountWithAnAbsoluteProfile(): Promise<void> {
    await using host = await CliTestHost.create();

    const account = ProviderAccount.fromJson(await host.runJson("account-add", "fake", "Work", host.directory.resolve("profile")));
    const missing = await host.run("account-add", "fake", "Work");

    Assert.areEqual("fake", account.provider);
    Assert.areEqual("Work", account.label);
    Assert.areEqual(host.directory.resolve("profile"), account.profileDir);
    Assert.areEqual(2, missing);
  }
}
