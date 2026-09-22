/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Teammate } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class TeammatesCommandTests {
  @TestMethod
  public async exercisesTheRuntimeContractAndUsage(): Promise<void> {
    await using host = await CliTestHost.create();
    const teammate = await host.createTeammate();
    const listed = await host.runJson("teammates") as unknown[];
    Assert.areEqual(teammate.id, Teammate.fromJson(listed[0]).id);
    Assert.areEqual(0, await host.run("teammates"));
    Assert.isTrue(host.console.output.includes("Alice"));
  }
}
