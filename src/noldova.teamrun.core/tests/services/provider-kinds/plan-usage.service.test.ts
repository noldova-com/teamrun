/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "@noldova/teamrun.core";
import { EventName, PlanUsage, PlanWindow, PlanWindowName } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class PlanUsageServiceTests {
  private static readonly now: number = Date.parse("2026-11-02T10:00:00.000Z");
  private static readonly hour: number = 3_600_000;

  @TestMethod
  public async holdsAProviderUsedUpUntilTheLatestResetOfItsUsedUpWindowsAndNotOneWhoseResetHasPassed(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    const waiting = host.timer.pending;

    const two = host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(1)),
      new PlanWindow(PlanWindowName.Weekly, 99.6, PlanUsageServiceTests.at(72)), new PlanWindow(PlanWindowName.MonthlyCompletions, 40, PlanUsageServiceTests.at(400))],
    "2026-11-02T10:00:00.000Z");
    const left = host.planUsage.record("claude", "acc-2", [new PlanWindow(PlanWindowName.FiveHour, 98, PlanUsageServiceTests.at(1))], "2026-11-02T10:00:00.000Z");
    const passed = host.planUsage.record("grok", "acc-3", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(-1))], "2026-11-02T10:00:00.000Z");
    const unknown = host.planUsage.record("copilot", "acc-4", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(1)),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 300, 300)], "2026-11-02T10:00:00.000Z");

    Assert.areEqual(`true ${PlanUsageServiceTests.at(72)}`, `${two.usedUp} ${two.usedUpUntil}`);
    Assert.areEqual("false null;false null;true null", [left, passed, unknown].map(t => `${t.usedUp} ${t.usedUpUntil}`).join(";"));
    Assert.areEqual(JSON.stringify(unknown.toJson()), JSON.stringify(host.listener.events.at(-1)?.payload));
    Assert.areEqual(waiting + 1, host.timer.pending);
  }

  @TestMethod
  public async letsTheStateGoAtTheResetWithNoNewReportAndPublishesIt(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(2))];
    const waiting = host.timer.pending;
    host.planUsage.record("codex", "acc-1", windows, "2026-11-02T10:00:00.000Z", "pro");

    host.timer.advance(2 * PlanUsageServiceTests.hour - 1);
    await PlanUsageServiceTests.settled();
    const before = PlanUsageServiceTests.usageOf(host);
    host.timer.advance(1);
    await PlanUsageServiceTests.settled();
    const after = PlanUsageServiceTests.usageOf(host);

    Assert.isTrue(before.usedUp);
    Assert.areEqual("false null pro 100", `${after.usedUp} ${after.usedUpUntil} ${after.plan} ${after.windows[0]?.usedPercent}`);
    Assert.areEqual(2, host.listener.count(EventName.PlanUsageUpdated));
    Assert.areEqual(JSON.stringify(after.toJson()), JSON.stringify(host.listener.events.at(-1)?.payload));
    Assert.areEqual(waiting, host.timer.pending);
  }

  @TestMethod
  public async waitsInShortPartsForAResetFarAwayAndChecksTheClockAfterEach(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    const reset = 30 * 24 * PlanUsageServiceTests.hour;
    const begun = host.timer.begun;
    host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 100, new Date(PlanUsageServiceTests.now + reset).toISOString())],
      "2026-11-02T10:00:00.000Z");

    host.timer.advance(Resources.usedUpCheckInterval);
    await PlanUsageServiceTests.settled();
    const partway = PlanUsageServiceTests.usageOf(host).usedUp;
    host.timer.advance(reset - Resources.usedUpCheckInterval);
    await PlanUsageServiceTests.settled();

    Assert.isTrue(partway);
    Assert.areEqual(begun + 2, host.timer.begun);
    Assert.isFalse(PlanUsageServiceTests.usageOf(host).usedUp);
  }

  @TestMethod
  public async letsTheStateGoWithinOneCheckWhenTheClockJumpsPastTheResetDuringAWait(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(5))], "2026-11-02T10:00:00.000Z");

    host.timer.jump(23 * PlanUsageServiceTests.hour);
    await PlanUsageServiceTests.settled();
    const jumped = PlanUsageServiceTests.usageOf(host).usedUp;
    host.timer.advance(Resources.usedUpCheckInterval - 1);
    await PlanUsageServiceTests.settled();
    const before = PlanUsageServiceTests.usageOf(host).usedUp;
    host.timer.advance(1);
    await PlanUsageServiceTests.settled();

    Assert.areEqual("true true", `${jumped} ${before}`);
    Assert.isFalse(PlanUsageServiceTests.usageOf(host).usedUp);
  }

  @TestMethod
  public async letsTheStateGoAtANewerReportWithUsageLeftAndStopsWaitingForTheOldReset(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    const waiting = host.timer.pending;
    host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(2))], "2026-11-02T10:00:00.000Z");
    const unknown = host.planUsage.record("codex", "acc-2", [new PlanWindow(PlanWindowName.FiveHour, 100, null)], "2026-11-02T10:00:00.000Z");

    const older = host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 10, PlanUsageServiceTests.at(2))], "2026-11-02T09:00:00.000Z");
    const newer = host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 20, PlanUsageServiceTests.at(5))], "2026-11-02T10:00:01.000Z");
    const again = host.planUsage.record("codex", "acc-2", [new PlanWindow(PlanWindowName.FiveHour, 5, PlanUsageServiceTests.at(5))], "2026-11-02T10:00:01.000Z");
    const pending = host.timer.pending;
    host.timer.advance(3 * PlanUsageServiceTests.hour);
    await PlanUsageServiceTests.settled();

    Assert.areEqual("true,true,false,false", [unknown.usedUp, older.usedUp, newer.usedUp, again.usedUp].join());
    Assert.areEqual(waiting, pending);
    Assert.areEqual(4, host.listener.count(EventName.PlanUsageUpdated));
  }

  @TestMethod
  public async stopsWaitingForEveryResetWhenDisposed(): Promise<void> {
    await using host = await PlanUsageServiceTests.hostAtNowAsync();
    host.planUsage.record("codex", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(2))], "2026-11-02T10:00:00.000Z");
    host.planUsage.record("claude", "acc-2", [new PlanWindow(PlanWindowName.FiveHour, 100, PlanUsageServiceTests.at(3))], "2026-11-02T10:00:00.000Z");

    const waiting = host.timer.pending;
    host.planUsage[Symbol.dispose]();

    Assert.areEqual(2, waiting - host.timer.pending);
    Assert.isTrue(host.planUsage.list().every(t => t.usedUp));
  }

  @TestMethod
  public async keepsTheLatestUseOfEachProviderAndPublishesEachChange(): Promise<void> {
    await using host = await CoreHost.createAsync();

    host.planUsage.record("codex", null, [new PlanWindow(PlanWindowName.Weekly, 10, null)], "2026-10-22T08:00:00.000Z");
    host.planUsage.record("codex", "acc-1", [], "2026-10-22T08:00:00.000Z");
    const latest = host.planUsage.record("codex", null, [new PlanWindow(PlanWindowName.Weekly, 20, "2026-10-26T00:00:00.000Z")], "2026-10-22T08:00:01.000Z");

    Assert.areEqual("codex/-/20;codex/acc-1/", host.planUsage.list().map(t => `${t.kind}/${t.providerId ?? "-"}/${t.windows.map(w => w.usedPercent).join()}`).join(";"));
    Assert.areEqual("2026-10-22T08:00:01.000Z", latest.readAt);
    Assert.areEqual(3, host.listener.count(EventName.PlanUsageUpdated));
    Assert.areEqual(JSON.stringify(latest.toJson()), JSON.stringify(host.listener.events.at(-1)?.payload));
  }

  @TestMethod
  public async keepsThePlanAReadNamedUntilAnotherNamesOneAndNoneForAProviderWhoseReadsNameNone(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const named = host.planUsage.record("copilot", "acc-1", [], "2026-10-22T08:00:00.000Z", "free");
    const kept = host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.Quota, 100, null)], "2026-10-22T08:00:01.000Z");
    const renamed = host.planUsage.record("copilot", "acc-1", [], "2026-10-22T08:00:02.000Z", "pro");
    const none = host.planUsage.record("codex", "acc-2", [new PlanWindow(PlanWindowName.Weekly, 10, null)], "2026-10-22T08:00:00.000Z");

    Assert.areEqual("free,free,pro,null", [named.plan, kept.plan, renamed.plan, String(none.plan)].join());
    Assert.areEqual("Quota", kept.windows.map(t => t.name).join());
    Assert.areEqual("pro", host.listener.events.filter(t => t.name === EventName.PlanUsageUpdated).map(t => PlanUsage.fromJson(t.payload).plan).at(-2));
  }

  @TestMethod
  public async clearsThePlanWhenAPlanReadNamesNoneAndKeepsItThroughAReadThatDoesNotReadThePlan(): Promise<void> {
    await using host = await CoreHost.createAsync();

    host.planUsage.record("copilot", "acc-1", [], "2026-10-22T08:00:00.000Z", "pro");
    const kept = host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.Quota, 10, null)], "2026-10-22T08:00:01.000Z");
    const cleared = host.planUsage.record("copilot", "acc-1", [], "2026-10-22T08:00:02.000Z", null);

    Assert.areEqual("pro,null", [kept.plan, String(cleared.plan)].join());
    Assert.areEqual(3, host.listener.count(EventName.PlanUsageUpdated));
  }

  @TestMethod
  public async takesTheWindowsFromTheLatestReadAndThePlanFromTheLatestReadThatNamesItWhenTheyAnswerOutOfOrder(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const reply = host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.Quota, 40, null)], "2026-10-22T08:00:02.000Z");
    const slow = host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.Quota, 10, null)], "2026-10-22T08:00:01.000Z", "pro");
    const older = host.planUsage.record("copilot", "acc-1", [new PlanWindow(PlanWindowName.Quota, 5, null)], "2026-10-22T08:00:00.000Z", "free");

    Assert.areEqual("Quota 40 2026-10-22T08:00:02.000Z pro", `${slow.windows.map(t => `${t.name} ${t.usedPercent}`).join()} ${slow.readAt} ${slow.plan}`);
    Assert.isNull(reply.plan);
    Assert.isTrue(older === slow);
    Assert.areEqual(2, host.listener.count(EventName.PlanUsageUpdated));
    Assert.areEqual(JSON.stringify(slow.toJson()), JSON.stringify(host.listener.events.at(-1)?.payload));
  }

  @TestMethod
  public async keepsTheLaterReadWhenAnOlderReadAnswersLast(): Promise<void> {
    await using host = await CoreHost.createAsync();

    const later = host.planUsage.record("grok", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 82, null)], "2026-10-22T08:00:02.000Z");
    const older = host.planUsage.record("grok", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 79, null)], "2026-10-22T08:00:01.000Z");
    const same = host.planUsage.record("grok", "acc-1", [new PlanWindow(PlanWindowName.FiveHour, 83, null)], "2026-10-22T08:00:02.000Z");

    Assert.isTrue(later === older);
    Assert.areEqual("83", host.planUsage.list().map(t => t.windows.map(w => w.usedPercent).join()).join(";"));
    Assert.areEqual(JSON.stringify(same.toJson()), JSON.stringify(host.planUsage.list()[0]?.toJson()));
    Assert.areEqual(2, host.listener.count(EventName.PlanUsageUpdated));
  }

  private static usageOf(host: CoreHost): PlanUsage {
    const [usage] = host.planUsage.list();
    Assert.isDefined(usage);
    return usage;
  }

  private static async hostAtNowAsync(): Promise<CoreHost> {
    const host = await CoreHost.createAsync();
    host.timer.advance(PlanUsageServiceTests.now);
    return host;
  }

  private static at(hours: number): string {
    return new Date(PlanUsageServiceTests.now + hours * PlanUsageServiceTests.hour).toISOString();
  }

  private static async settled(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }
}
