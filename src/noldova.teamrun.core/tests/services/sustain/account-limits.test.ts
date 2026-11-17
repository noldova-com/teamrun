/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AccountLimits } from "@noldova/teamrun.core";
import { PlanUsage, PlanWindow, PlanWindowName } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class AccountLimitsTests {
  @TestMethod
  public async holdsALimitWithAResetUntilThatTimeEvenThroughALaterReadWithRoom(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const limits = new AccountLimits(host.context);
    await limits.recordAsync("work", new Date(1000).toISOString(), new Date(5000).toISOString());
    const later = AccountLimitsTests.usage("work", 2000, 40);

    Assert.areEqual("true,true,false", [await limits.isOutAsync("work", 4999, null), await limits.isOutAsync("work", 4999, later), await limits.isOutAsync("work", 5000, later)].join(","));
    Assert.isTrue(await new AccountLimits(host.context).isOutAsync("work", 4999, null));
  }

  @TestMethod
  public async holdsALimitWithoutAResetUntilAReadThatBeganAfterItShowsRoom(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const limits = new AccountLimits(host.context);
    await limits.recordAsync("work", new Date(1000).toISOString(), null);

    Assert.areEqual("true,true,true,false", [await limits.isOutAsync("work", 9000, null), await limits.isOutAsync("work", 9000, AccountLimitsTests.usage("work", 1000, 40)),
      await limits.isOutAsync("work", 9000, AccountLimitsTests.usage("work", 2000, 100)), await limits.isOutAsync("work", 9000, AccountLimitsTests.usage("work", 2000, 40))].join(","));
  }

  @TestMethod
  public async countsAnAccountWithoutALimitOutOnlyWhileItsPlanIsUsedUpAndKeepsOnlyTheLatestLimit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const limits = new AccountLimits(host.context);

    Assert.areEqual("false,false,true", [await limits.isOutAsync("spare", 0, null), await limits.isOutAsync("spare", 0, AccountLimitsTests.usage("spare", 0, 40)),
      await limits.isOutAsync("spare", 0, AccountLimitsTests.usage("spare", 0, 100))].join(","));
    await limits.recordAsync("spare", new Date(1000).toISOString(), null);
    await limits.recordAsync("spare", new Date(2000).toISOString(), new Date(3000).toISOString());
    Assert.areEqual("true,false", [await limits.isOutAsync("spare", 2999, AccountLimitsTests.usage("spare", 1500, 40)), await limits.isOutAsync("spare", 3000, null)].join(","));
  }

  @TestMethod
  public async readsTheResetOfAKeptLimitAndNoneWithoutOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const limits = new AccountLimits(host.context);
    await limits.recordAsync("work", new Date(1000).toISOString(), new Date(5000).toISOString());
    await limits.recordAsync("spare", new Date(1000).toISOString(), null);

    Assert.areEqual([new Date(5000).toISOString(), "null", "null"].join(","), [await limits.resetOfAsync("work"), await limits.resetOfAsync("spare"), await limits.resetOfAsync("none")].map(t => String(t)).join(","));
  }

  private static usage(providerId: string, readAt: number, usedPercent: number): PlanUsage {
    return new PlanUsage("fake", providerId, [new PlanWindow(PlanWindowName.FiveHour, usedPercent, null)], new Date(readAt).toISOString(), null, usedPercent >= 100);
  }
}
