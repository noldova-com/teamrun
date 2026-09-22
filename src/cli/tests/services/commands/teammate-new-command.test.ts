/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Teammate, ProviderAccount } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class TeammateNewCommandTests {
  @TestMethod
  public async exercisesTheRuntimeContractAndUsage(): Promise<void> {
    await using host = await CliTestHost.create();
    const account = ProviderAccount.fromJson(await host.runJson("account-add", "fake", "Work", host.directory.resolve("profile")));
    const teammate = Teammate.fromJson(await host.runJson("teammate-new", "Alice", account.id, "--model", "model", "--effort", "high", "--role", "# Review"));
    Assert.areEqual("# Review", teammate.role);
    Assert.areEqual("model", teammate.model);
    Assert.areEqual("high", teammate.effort);
    Assert.areEqual(account.id, teammate.providerAccountId);
    Assert.areEqual(0, await host.run("teammate-new", "Bob", account.id));
    Assert.isTrue(host.console.output.includes("Bob"));
    Assert.areEqual(2, await host.run("teammate-new", "MissingAccount"));
  }
}
