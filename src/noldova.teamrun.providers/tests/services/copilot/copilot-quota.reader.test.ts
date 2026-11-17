/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject } from "@noldova/context.json";
import type { PlanWindow } from "@noldova/teamrun.protocol";
import { CopilotQuotaReader } from "@noldova/teamrun.providers";

@TestClass
export class CopilotQuotaReaderTests {
  @TestMethod
  public readsThePlanItsTierNamesAndNoneWhenItNamesNone(): void {
    Assert.areEqual("free,pro,none,none,none,none", [{ isFreeUser: true, planTier: "free" }, { planTier: "pro", snapshots: {} }, {}, { planTier: " " }, { planTier: 1 }, null]
      .map(t => CopilotQuotaReader.readPlan(t) ?? "none").join(","));
  }

  @TestMethod
  public readsTheMonthlyPremiumRequestsUsedFromWhatRemains(): void {
    const windows = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 62.5,
      resetDateEpochMs: 1_796_083_200_000 } } });
    const overdrawn = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: -10 } } });
    const spare = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 120 } } });

    Assert.areEqual("MonthlyPremiumRequests 37.5 2026-12-01T00:00:00.000Z null null", CopilotQuotaReaderTests.describe(windows));
    Assert.areEqual(110, overdrawn?.[0]?.usedPercent);
    Assert.areEqual(0, spare?.[0]?.usedPercent);
  }

  @TestMethod
  public readsTheRequestsUsedOfTheAllowanceBesideThePercentage(): void {
    const windows = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 59.5,
      entitlementRequests: 300, usedRequests: 121.5 }, chat: { isUnlimitedEntitlement: false, entitlementRequests: 50, usedRequests: 12 } } });
    const halves = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 50, usedRequests: 150 },
      chat: { isUnlimitedEntitlement: false, remainingPercentage: 50, entitlementRequests: 50 } } });

    Assert.areEqual("MonthlyPremiumRequests 40.5 null 121.5 300,MonthlyChatRequests null null 12 50", CopilotQuotaReaderTests.describe(windows));
    Assert.areEqual("MonthlyPremiumRequests 50 null null null,MonthlyChatRequests 50 null null null", CopilotQuotaReaderTests.describe(halves));
  }

  @TestMethod
  public readsAnUnlimitedSnapshotAsAnUnlimitedWindow(): void {
    const windows = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: true, remainingPercentage: 100, entitlementRequests: 0,
      usedRequests: 3 }, chat: { isUnlimitedEntitlement: true }, completions: { isUnlimitedEntitlement: true, resetDateEpochMs: 1_796_083_200_000 } } });

    Assert.areEqual("MonthlyPremiumRequests,MonthlyChatRequests,MonthlyCompletions", (windows ?? []).map(t => t.name).join(","));
    Assert.isTrue((windows ?? []).every(t => t.unlimited && Object.isNull(t.usedPercent) && Object.isNull(t.used)));
    Assert.areEqual("2026-12-01T00:00:00.000Z", windows?.[2]?.resetsAt);
  }

  @TestMethod
  public readsNoWindowForAnUnreadableSnapshotAndNothingFromAnotherShape(): void {
    Assert.areEqual(0, CopilotQuotaReader.read({ snapshots: { premium_interactions: { remainingPercentage: 50 } } })?.length);
    Assert.areEqual(0, CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: "half",
      entitlementRequests: 300, usedRequests: -1 } } })?.length);
    Assert.areEqual(0, CopilotQuotaReader.read({ snapshots: { chat: { isUnlimitedEntitlement: "yes" }, other: { isUnlimitedEntitlement: true } } })?.length);
    Assert.areEqual(0, CopilotQuotaReader.read({ snapshots: {} })?.length);
    Assert.isNull(CopilotQuotaReader.read({ isFreeUser: false }));
  }

  @TestMethod
  public readsABudgetTheServiceSaysIsExhaustedOrDeniedAsUsedInFullInPlaceOfTheUnlimitedSnapshotOfItsName(): void {
    const windows = CopilotQuotaReader.read({ isTbbUser: false, snapshots: { premium_interactions: { isUnlimitedEntitlement: true }, chat: { isUnlimitedEntitlement: true } },
      providerQuotas: [
        { compatibilityKey: "premium_interactions", unit: "requests", acquisitionStatus: "succeeded", accessState: "allowed", capacityState: "exhausted",
          quantityKind: "none", budgetMetadata: { resetAtEpochMs: 1_796_083_200_000 } },
        { unit: "ai_credits", acquisitionStatus: "succeeded", accessState: "denied", capacityState: "unknown", quantityKind: "none" }] });

    Assert.areEqual("MonthlyChatRequests null null null null,MonthlyPremiumRequests 100 2026-12-01T00:00:00.000Z null null,MonthlyCredits 100 null null null",
      CopilotQuotaReaderTests.describe(windows));
    Assert.areEqual("true,false,false", (windows ?? []).map(t => t.unlimited).join(","));
  }

  @TestMethod
  public readsAnAuthoritativeBudgetAsMeasuredOrUnlimitedAndKeepsAnExhaustedReadingOverAnotherOfItsName(): void {
    const measured = { unit: "ai_credits", acquisitionStatus: "succeeded", accessState: "allowed", capacityState: "available", quantityKind: "authoritative_budget",
      observationKind: "account_snapshot", budgetMetadata: { remainingPercentage: 25, entitlement: 1000, consumed: 750, resetAtEpochMs: 1_796_083_200_000 } };
    const windows = CopilotQuotaReader.read({ providerQuotas: [measured,
      { unit: "ai_credits", acquisitionStatus: "succeeded", accessState: "allowed", capacityState: "exhausted", quantityKind: "none", observationKind: "admission_state" },
      { compatibilityKey: "chat", unit: "requests", acquisitionStatus: "succeeded", capacityState: "unlimited", quantityKind: "authoritative_budget" },
      { compatibilityKey: "completions", unit: "requests", acquisitionStatus: "succeeded", capacityState: "available", quantityKind: "authoritative_budget",
        budgetMetadata: { unlimited: true } },
      { compatibilityKey: "premium_interactions", unit: "requests", acquisitionStatus: "succeeded", capacityState: "available", quantityKind: "authoritative_budget",
        entitledQuantity: -1 }] });
    const alone = CopilotQuotaReader.read({ snapshots: { premium_interactions: { isUnlimitedEntitlement: true } }, providerQuotas: [measured] });

    Assert.areEqual("MonthlyCredits 100 null null null,MonthlyChatRequests null null null null,MonthlyCompletions null null null null,"
      + "MonthlyPremiumRequests null null null null", CopilotQuotaReaderTests.describe(windows));
    Assert.areEqual("false,true,true,true", (windows ?? []).map(t => t.unlimited).join(","));
    Assert.areEqual("MonthlyPremiumRequests null null null null,MonthlyCredits 75 2026-12-01T00:00:00.000Z 750 1000", CopilotQuotaReaderTests.describe(alone));
  }

  @TestMethod
  public readsNoWindowFromAReadingThatFailedIsUnavailableOrHasNoNameOrFigure(): void {
    const windows = CopilotQuotaReader.read({ snapshots: {}, providerQuotas: [
      { unit: "ai_credits", acquisitionStatus: "failed", capacityState: "exhausted", hasQuota: false },
      { unit: "ai_credits", acquisitionStatus: "unavailable", accessState: "denied" },
      { unit: "tokens", acquisitionStatus: "succeeded", accessState: "allowed", capacityState: "available", quantityKind: "authoritative_budget",
        budgetMetadata: { remainingPercentage: 50 } },
      { compatibilityKey: "other", unit: "requests", acquisitionStatus: "succeeded", capacityState: "unlimited", quantityKind: "authoritative_budget" },
      { unit: "ai_credits", acquisitionStatus: "succeeded", capacityState: "available", quantityKind: "advisory_balance", entitledQuantity: 0, availableQuantity: 0 },
      { unit: "ai_credits", acquisitionStatus: "succeeded", capacityState: "available", quantityKind: "authoritative_budget", budgetMetadata: { remainingPercentage: "half" } },
      "reading"] });

    Assert.areEqual(0, windows?.length);
    Assert.areEqual(0, CopilotQuotaReader.read({ providerQuotas: [] })?.length);
    Assert.isNull(CopilotQuotaReader.read({ providerQuotas: {} }));
  }

  @TestMethod
  public readsAUsedUpReadingWithNoNameAsTheQuotaUsedInFullBesideAnUnlimitedPremiumSnapshot(): void {
    const windows = CopilotQuotaReader.read({ isTbbUser: false, snapshots: { premium_interactions: { isUnlimitedEntitlement: true } }, providerQuotas: [
      { quotaId: "q1", unit: "tokens", acquisitionStatus: "succeeded", accessState: "allowed", capacityState: "exhausted", quantityKind: "none",
        budgetMetadata: { resetAtEpochMs: 1_796_083_200_000 } },
      { quotaId: "q2", compatibilityKey: "other", unit: "requests", acquisitionStatus: "succeeded", accessState: "denied", capacityState: "unknown" }] });

    Assert.areEqual("MonthlyPremiumRequests null null null null,Quota 100 2026-12-01T00:00:00.000Z null null", CopilotQuotaReaderTests.describe(windows));
    Assert.areEqual("true,false", (windows ?? []).map(t => t.unlimited).join(","));
  }

  @TestMethod
  public readsAReadingWithoutQuotaAsUsedUpUnlessItSaysNoQuotaIsNeeded(): void {
    const reading = { compatibilityKey: "premium_interactions", unit: "requests", acquisitionStatus: "succeeded", accessState: "allowed",
      capacityState: "unknown", quantityKind: "none", hasQuota: false };
    const read = (changes: JsonObject): string => CopilotQuotaReaderTests.describe(CopilotQuotaReader.read({
      snapshots: { premium_interactions: { isUnlimitedEntitlement: true } }, providerQuotas: [{ ...reading, ...changes }] }));
    const needsNone = [{ accessState: "not_required" }, { capacityState: "not_required" }, { capacityState: "not_applicable" }, { capacityState: "unlimited" },
      { hasQuota: null }];

    Assert.areEqual("MonthlyPremiumRequests 100 null null null", read({}));
    Assert.areEqual("MonthlyPremiumRequests 100 null null null", read({ capacityState: "available" }));
    Assert.areEqual("MonthlyPremiumRequests null null null null,Quota 100 null null null", read({ compatibilityKey: "other" }));
    Assert.areEqual(needsNone.map(() => "MonthlyPremiumRequests null null null null").join(";"), needsNone.map(t => read(t)).join(";"));
  }

  @TestMethod
  public leavesOutAnUnlimitedPremiumWindowFromASnapshotOrAReadingOnlyWhenTheAccountHasTokenBasedBilling(): void {
    const unlimited = { snapshots: { premium_interactions: { isUnlimitedEntitlement: true }, chat: { isUnlimitedEntitlement: true } } };

    const tokenBilled = CopilotQuotaReader.read({ ...unlimited, isTbbUser: true });
    const limited = CopilotQuotaReader.read({ isTbbUser: true, snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 40 } } });
    const plain = CopilotQuotaReader.read({ ...unlimited, isTbbUser: false });
    const budgeted = CopilotQuotaReader.read({ ...unlimited, isTbbUser: true, providerQuotas: [{ compatibilityKey: "premium_interactions", unit: "requests",
      acquisitionStatus: "succeeded", capacityState: "unlimited", quantityKind: "authoritative_budget" }] });

    Assert.areEqual("MonthlyChatRequests", (tokenBilled ?? []).map(t => t.name).join(","));
    Assert.areEqual("MonthlyPremiumRequests 60 null null null", CopilotQuotaReaderTests.describe(limited));
    Assert.areEqual("MonthlyPremiumRequests,MonthlyChatRequests", (plain ?? []).map(t => t.name).join(","));
    Assert.areEqual("MonthlyChatRequests", (budgeted ?? []).map(t => t.name).join(","));
  }

  private static describe(windows: readonly PlanWindow[] | null): string {
    return (windows ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt} ${t.used} ${t.allowance}`).join(",");
  }
}
