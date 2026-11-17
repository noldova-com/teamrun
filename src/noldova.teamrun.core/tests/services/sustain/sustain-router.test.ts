/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AccountLimits, SustainRouter } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { Harness, PlanUsage, PlanWindow, PlanWindowName, Teammate, TeammateFallback } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class SustainRouterTests {
  private static readonly hour: number = 3_600_000;

  @TestMethod
  public async keepsTheOwnEntryWhileItHasUsageOrWhileSustainIsOffAndElseTakesTheFirstUsableFallbackWithUsage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { limits, router, unusable } = SustainRouterTests.arrange(host, []);
    const own = new TeammateFallback("work", "model-b", "low");
    const off = SustainRouterTests.teammate(false, false, ["off", "out", "spare", "other"]);
    const on = SustainRouterTests.teammate(true, false, ["off", "out", "spare", "other"]);

    const kept = await router.chooseAsync(on, own);
    await limits.recordAsync("work", new Date(0).toISOString(), null);
    await limits.recordAsync("out", new Date(0).toISOString(), null);
    unusable.add("off");

    Assert.areEqual(own, kept);
    Assert.areEqual(own, await router.chooseAsync(off, own));
    Assert.areEqual("spare", (await router.chooseAsync(on, own)).providerId);
  }

  @TestMethod
  public async staysOnTheOwnEntryAndCallsTheTeammateOutWhenNoFallbackIsLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { limits, router } = SustainRouterTests.arrange(host, []);
    const own = new TeammateFallback("work", null, null);
    const on = SustainRouterTests.teammate(true, false, ["spare"]);
    const off = SustainRouterTests.teammate(false, false, ["spare"]);

    const before = [await router.isOutAsync(on), await router.isOutAsync(off)];
    await limits.recordAsync("work", new Date(0).toISOString(), null);
    const after = [await router.isOutAsync(on), await router.isOutAsync(off)];
    await limits.recordAsync("spare", new Date(0).toISOString(), null);

    Assert.areEqual("false,false", before.join(","));
    Assert.areEqual("false,true", after.join(","));
    Assert.isTrue(await router.isOutAsync(on));
    Assert.areEqual(own, await router.chooseAsync(on, own));
  }

  @TestMethod
  public async takesTheFallbackWhosePlanResetsSoonestKeepingTheListOrderForEqualResetsAndUnreadPlansLast(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const hour = SustainRouterTests.hour;
    const usages = [SustainRouterTests.usage("late", [5 * hour]), SustainRouterTests.usage("soon", [3 * hour, hour]), SustainRouterTests.usage("tied", [hour]),
      SustainRouterTests.usage("unset", [null])];
    const { limits, router } = SustainRouterTests.arrange(host, usages);
    await limits.recordAsync("work", new Date(0).toISOString(), null);
    const own = new TeammateFallback("work", null, null);
    const choice = async (entries: readonly string[]): Promise<string> => (await router.chooseAsync(SustainRouterTests.teammate(true, true, entries), own)).providerId;

    Assert.areEqual("soon,soon,tied,late,unread", [await choice(["late", "soon", "tied"]), await choice(["soon", "late"]), await choice(["unread", "tied", "soon"]),
      await choice(["unset", "late"]), await choice(["unread", "unset"])].join(","));
  }

  @TestMethod
  public async skipsTheAccountsAChainTriedAndReadsEachAccountsResetFromItsLimitOrItsUsedUpPlan(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const until = new Date(SustainRouterTests.hour).toISOString();
    const used = new PlanUsage("fake", "full", [new PlanWindow(PlanWindowName.FiveHour, 100, until)], new Date(0).toISOString(), null, true, until);
    const { limits, router } = SustainRouterTests.arrange(host, [used, SustainRouterTests.usage("spare", [null])]);
    await limits.recordAsync("work", new Date(0).toISOString(), new Date(2 * SustainRouterTests.hour).toISOString());
    const own = new TeammateFallback("work", null, null);
    const on = SustainRouterTests.teammate(true, false, ["spare", "other"]);

    Assert.areEqual("other", (await router.chooseAsync(on, own, new Set(["spare"]))).providerId);
    Assert.areEqual(own, await router.chooseAsync(on, own, new Set(["spare", "other"])));
    Assert.isNull(await router.nextAsync(on, own, new Set(["spare", "other"])));
    const free = new TeammateFallback("free", null, null);
    Assert.areEqual(free, await router.nextAsync(on, free, new Set<string>()));
    Assert.areEqual("true,false", [await router.isAccountOutAsync("work"), await router.isAccountOutAsync("other")].join(","));
    Assert.areEqual("spare", (await router.chooseAsync(SustainRouterTests.teammate(true, false, ["spare"]), new TeammateFallback("free", null, null), new Set(["free"]))).providerId);
    Assert.areEqual([new Date(2 * SustainRouterTests.hour).toISOString(), until, "null"].join(","), [await router.resetOfAsync("work"), await router.resetOfAsync("full"), await router.resetOfAsync("spare")]
      .map(t => String(t)).join(","));
  }

  private static arrange(host: CoreHost, usages: readonly PlanUsage[]): { limits: AccountLimits; router: SustainRouter; unusable: Set<string> } {
    const limits = new AccountLimits(host.context);
    const unusable = new Set<string>();
    return { limits, router: new SustainRouter(limits, () => usages, t => Promise.resolve(!unusable.has(t)), new ManualTimer()), unusable };
  }

  private static teammate(sustain: boolean, resetsSoonestFirst: boolean, fallbacks: readonly string[]): Teammate {
    const now = new Date(0).toISOString();
    return new Teammate("teammate-1", "Bob", "Implement", "work", Harness.Provider, "model-b", "low", now, now, null, null, null, [], sustain,
      fallbacks.map(t => new TeammateFallback(t, null, null)), resetsSoonestFirst);
  }

  private static usage(providerId: string, resets: readonly (number | null)[]): PlanUsage {
    const names = [PlanWindowName.FiveHour, PlanWindowName.Weekly];
    const windows = resets.map((t, index) => new PlanWindow(names[index] ?? PlanWindowName.WeeklyOpus, 10, Object.isNull(t) ? null : new Date(t).toISOString()));
    return new PlanUsage("fake", providerId, windows, new Date(0).toISOString());
  }
}
