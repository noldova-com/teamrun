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
export class TeammateUpdateCommandTests {
  @TestMethod
  public async exercisesTheRuntimeContractAndUsage(): Promise<void> {
    await using host = await CliTestHost.create();
    const before = await host.createTeammate();
    const updated = Teammate.fromJson(await host.runJson("teammate-update", before.id, "Renamed", before.providerAccountId,
      "--model", "m", "--effort", "low", "--role", "Review only"));
    Assert.areEqual(before.id, updated.id);
    Assert.areEqual("Renamed", updated.name);
    Assert.areEqual("Review only", updated.role);
    Assert.areEqual(0, await host.run("teammate-update", before.id, "Renamed", before.providerAccountId));
    Assert.isTrue(host.console.output.includes("Renamed"));
    const reset = Teammate.fromJson((await host.runJson("teammates") as unknown[])[0]);
    Assert.isNull(reset.role);
    Assert.isNull(reset.model);
    Assert.isNull(reset.effort);
    Assert.areEqual(2, await host.run("teammate-update", before.id));
  }
}
