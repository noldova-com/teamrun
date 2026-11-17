/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { PlanWindow, PlanWindowName } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class CopilotQuotaReader {
  private static readonly snapshots: ReadonlyMap<string, PlanWindowName> = new Map([
    [Resources.copilotPremiumInteractionsField, PlanWindowName.MonthlyPremiumRequests],
    [Resources.copilotChatField, PlanWindowName.MonthlyChatRequests],
    [Resources.copilotCompletionsField, PlanWindowName.MonthlyCompletions]
  ]);

  public static read(answer: JsonValue): readonly PlanWindow[] | null {
    const snapshots = UsageValues.objectOf(UsageValues.fieldOf(answer, Resources.copilotSnapshotsField));
    const states = UsageValues.fieldOf(answer, Resources.copilotProviderQuotasField);
    if (Object.isNull(snapshots) && !Array.isArray(states))
      return null;
    const tokenBilled = UsageValues.fieldOf(answer, Resources.copilotTokenBillingField) === true;
    const listed = [...CopilotQuotaReader.snapshots].map(([field, name]) => CopilotQuotaReader.windowOf(name, snapshots?.[field])).filter(t => !Object.isNull(t));
    const read = (Array.isArray(states) ? states : []).map(t => CopilotQuotaReader.budgetOf(t)).filter(t => !Object.isNull(t))
      .sort((a, b) => Number(CopilotQuotaReader.isSpent(b)) - Number(CopilotQuotaReader.isSpent(a)));
    const budgets = read.filter((t, index) => read.findIndex(other => other.name === t.name) === index);
    return [...listed.filter(t => !budgets.some(other => other.name === t.name)), ...budgets]
      .filter(t => !tokenBilled || !t.unlimited || t.name !== PlanWindowName.MonthlyPremiumRequests);
  }

  public static readPlan(answer: JsonValue): string | null {
    const tier = UsageValues.fieldOf(answer, Resources.copilotPlanTierField);
    return typeof tier === "string" && tier.trim().length > 0 ? tier : null;
  }

  private static windowOf(name: PlanWindowName, snapshot: JsonValue | undefined): PlanWindow | null {
    const unlimited = UsageValues.fieldOf(snapshot, Resources.copilotUnlimitedField);
    const resetsAt = UsageValues.timeFromMilliseconds(UsageValues.fieldOf(snapshot, Resources.copilotResetDateField));
    if (unlimited === true)
      return new PlanWindow(name, null, resetsAt, null, null, true);
    return unlimited === false ? CopilotQuotaReader.measured(name, resetsAt, UsageValues.fieldOf(snapshot, Resources.copilotRemainingPercentageField),
      UsageValues.fieldOf(snapshot, Resources.copilotEntitlementField), UsageValues.fieldOf(snapshot, Resources.copilotUsedRequestsField)) : null;
  }

  private static budgetOf(state: JsonValue): PlanWindow | null {
    if (UsageValues.fieldOf(state, Resources.copilotAcquisitionStatusField) !== Resources.copilotSucceededStatus)
      return null;
    const name = CopilotQuotaReader.snapshots.get(String(UsageValues.fieldOf(state, Resources.copilotCompatibilityKeyField)))
      ?? (UsageValues.fieldOf(state, Resources.copilotUnitField) === Resources.copilotAiCreditsUnit ? PlanWindowName.MonthlyCredits : null);
    const budget = UsageValues.fieldOf(state, Resources.copilotBudgetMetadataField);
    const resetsAt = UsageValues.timeFromMilliseconds(UsageValues.fieldOf(budget, Resources.copilotResetAtField));
    const capacity = UsageValues.fieldOf(state, Resources.copilotCapacityStateField);
    if (CopilotQuotaReader.isUsedUp(state, capacity))
      return new PlanWindow(name ?? PlanWindowName.Quota, Resources.percentScale, resetsAt);
    if (Object.isNull(name) || UsageValues.fieldOf(state, Resources.copilotQuantityKindField) !== Resources.copilotAuthoritativeBudget)
      return null;
    if (capacity === Resources.copilotUnlimitedState || UsageValues.fieldOf(budget, Resources.unlimitedField) === true
      || UsageValues.fieldOf(state, Resources.copilotEntitledQuantityField) === Resources.copilotUnlimitedQuantity)
      return new PlanWindow(name, null, resetsAt, null, null, true);
    return CopilotQuotaReader.measured(name, resetsAt, UsageValues.fieldOf(budget, Resources.copilotRemainingPercentageField),
      UsageValues.fieldOf(budget, Resources.copilotBudgetEntitlementField), UsageValues.fieldOf(budget, Resources.copilotConsumedField));
  }

  private static measured(name: PlanWindowName, resetsAt: string | null, remaining: JsonValue | undefined, entitlement: JsonValue | undefined,
    consumed: JsonValue | undefined): PlanWindow | null {
    const usedPercent = typeof remaining === "number" && Number.isFinite(remaining) ? Math.max(0, Resources.percentScale - remaining) : null;
    const allowance = UsageValues.amount(entitlement);
    const used = Object.isNull(allowance) ? null : UsageValues.amount(consumed);
    return Object.isNull(usedPercent) && Object.isNull(used) ? null : new PlanWindow(name, usedPercent, resetsAt, used, Object.isNull(used) ? null : allowance);
  }

  private static isUsedUp(state: JsonValue, capacity: JsonValue | undefined): boolean {
    const access = UsageValues.fieldOf(state, Resources.copilotAccessStateField);
    if (capacity === Resources.copilotExhaustedState || access === Resources.copilotDeniedState)
      return true;
    return UsageValues.fieldOf(state, Resources.copilotHasQuotaField) === false
      && !Resources.copilotNoQuotaStates.includes(String(access)) && !Resources.copilotNoQuotaStates.includes(String(capacity));
  }

  private static isSpent(window: PlanWindow): boolean {
    return (window.usedPercent ?? 0) >= Resources.percentScale;
  }
}
