/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import {
  AuthStatus,
  type DiscoveredProfile,
  NameOrder,
  type PlanUsage,
  type Provider,
  ProviderIdentity,
  type ProviderKindInstallation,
  ProviderKindInstallState,
  Resources as ProtocolResources
} from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ProviderFoundRow } from "../models/provider-found-row";
import { ProviderGroup } from "../models/provider-group";
import { ProviderRow } from "../models/provider-row";
import type { ChatStoreService } from "./chat-store.service";
import type { UsageFormatterService } from "./usage-formatter.service";

export class ProviderRows {
  private readonly store: ChatStoreService;
  private readonly usage: UsageFormatterService;

  public constructor(store: ChatStoreService, usage: UsageFormatterService) {
    this.store = store;
    this.usage = usage;
  }

  public groupOf(kind: string, providers: readonly Provider[]): ProviderGroup {
    const name = this.kindNameOf(kind);
    const installation = this.store.installations().get(kind) ?? null;
    const rows = providers.map((t, i) => this.rowOf(t, installation, providers.slice(0, i)));
    return new ProviderGroup(kind, name, rows, installation);
  }

  public foundRowOf(profile: DiscoveredProfile): ProviderFoundRow {
    const status = Resources.providerStatusLabels[profile.authStatus];
    const known = ProviderIdentity.describeAccount(profile.authStatus, profile.identity);
    const isUnchecked = Object.isNull(known) && profile.authStatus === AuthStatus.Unknown;
    const account = known ?? (isUnchecked ? ProtocolResources.accountNotReported : status);
    const state = isUnchecked ? Resources.checksWhenAdded : status;
    const detail = [account, profile.identity?.organization ?? "", Resources.formatProfileFolder(profile.profileDir)].filter(t => !String.isNullOrWhitespace(t))
      .join(Resources.titleSeparator);
    const plan = ProviderRows.planTagOf(profile.kind, profile.identity?.plan);
    return new ProviderFoundRow(profile, status, state, Resources.providerStatusDots[profile.authStatus], account, detail, Object.isNull(known),
      plan === Resources.noPlanTag ? null : plan);
  }

  public kindsInOrder(kinds: readonly string[]): string[] {
    const listed = this.store.kinds().map(t => t.id);
    const rankOf = (kind: string): number => {
      const fixed = Resources.providerKindOrder.indexOf(kind);
      const shown = listed.indexOf(kind);
      return fixed >= 0 ? fixed : shown >= 0 ? Resources.providerKindOrder.length + shown : Number.MAX_SAFE_INTEGER;
    };
    return [...NameOrder.sort([...new Set(kinds)], t => t)].sort((a, b) => rankOf(a) - rankOf(b));
  }

  public kindNameOf(kind: string): string {
    return this.store.kinds().find(t => t.id === kind)?.displayName ?? kind;
  }

  private rowOf(provider: Provider, kindInstallation: ProviderKindInstallation | null, earlier: readonly Provider[]): ProviderRow {
    const id = provider.id;
    const installation = Object.isNull(provider.binaryPath) ? kindInstallation : null;
    if (this.store.isRetiredKind(provider.kind))
      return this.noted(provider, Resources.unsupportedProviderLabel, Resources.quietStatusDot, false, Resources.unsupportedProviderHint);
    if (!provider.enabled)
      return this.noted(provider, Resources.disabledProviderLabel, Resources.quietStatusDot, false, Resources.disabledProviderHint);
    if (installation?.state === ProviderKindInstallState.Unavailable)
      return this.noted(provider, Resources.notInstalledLabel, Resources.failedStatusDot, true, null, installation.reason!);
    if (installation?.state === ProviderKindInstallState.NotInstalled)
      return Object.isNull(installation.reason)
        ? this.noted(provider, Resources.notInstalledLabel, Resources.quietStatusDot, false, null)
        : this.noted(provider, Resources.notInstalledLabel, Resources.failedStatusDot, true, null, installation.reason);
    if (this.store.terminalSignOuts().has(id))
      return this.live(provider, Resources.signingOutLabel, Resources.quietStatusDot,
        this.store.kinds().some(t => t.id === provider.kind && t.signOutEndsWithCommand) ? Resources.terminalSigningOutCommandHint : Resources.terminalSigningOutHint,
        Resources.formatLiveStatus(provider.label, Resources.signingOutLabel), Resources.signingOutLabel, null);
    if (this.store.terminalSignIns().has(id))
      return this.live(provider, Resources.signingInLabel, Resources.liveStatusDot,
        Resources.terminalSigningInHints.get(provider.kind) ?? Resources.terminalSigningInHint, Resources.formatLiveStatus(provider.label, Resources.signingInLabel),
        Resources.signingInTerminalNote, this.store.signInCommands().get(id) ?? null);
    if (this.store.signingIn().has(id))
      return this.live(provider, Resources.signingInLabel, Resources.liveStatusDot, Resources.signingInHint,
        Resources.formatLiveStatus(provider.label, Resources.signingInLabel), Resources.signingInBrowserNote, null);
    const status = Resources.providerStatusLabels[provider.authStatus];
    const dot = Resources.providerStatusDots[provider.authStatus];
    const error = provider.lastError ?? installation?.reason ?? null;
    const account = ProviderIdentity.describeAccount(provider.authStatus, provider.identity);
    if (!Object.isNull(provider.lastError) && Resources.checkErrorStatuses.includes(provider.authStatus))
      return this.erred(provider, Resources.providerStatusLabels[AuthStatus.Error], Resources.failedStatusDot, provider.lastError);
    if (!Object.isNull(error))
      return this.erred(provider, status, dot, error);
    const unfinished = this.store.unfinishedSignIns().get(id);
    if (!Object.isUndefined(unfinished) && provider.authStatus !== AuthStatus.LoggedIn)
      return this.erred(provider, status, Resources.failedStatusDot, Resources.formatSignInUnfinished(unfinished));
    if (provider.authStatus === AuthStatus.Expired)
      return this.row(provider, status, dot, account ?? "", false, false, false, null, null, null, status);
    if (Resources.signInAgainStatuses.includes(provider.authStatus))
      return this.erred(provider, status, dot, status);
    if (Object.isNull(account))
      return this.noted(provider, status, dot, dot !== Resources.quietStatusDot, null);
    const usedUp = this.usage.usedUpNote(this.store.planUsageOf(provider.kind, provider.id));
    if (!Object.isNull(usedUp))
      return this.row(provider, status, Resources.warningStatusDot, account, false, false, false, null, null, null, usedUp);
    const key = ProviderRows.accountKey(provider.identity);
    const same = earlier.find(t => !Object.isNull(key) && ProviderRows.accountKey(t.identity) === key)?.label ?? null;
    return this.row(provider, status, dot, account, false, false, false, null, null, same, null);
  }

  private noted(provider: Provider, status: string, dot: string, isFailed: boolean, hint: string | null, note: string = status): ProviderRow {
    return this.row(provider, status, dot, note, true, isFailed, false, null, hint, null, null);
  }

  private erred(provider: Provider, status: string, dot: string, note: string): ProviderRow {
    return this.row(provider, status, dot, note, true, true, true, null, null, null, null);
  }

  private live(provider: Provider, status: string, dot: string, hint: string, announcement: string, note: string, command: string | null): ProviderRow {
    return this.row(provider, status, dot, note, true, false, false, announcement, hint, null, null, command);
  }

  private row(provider: Provider, status: string, dot: string, account: string, isNote: boolean, isFailed: boolean, isError: boolean,
    announcement: string | null, hint: string | null, sameAccountAs: string | null, warning: string | null, command: string | null = null): ProviderRow {
    const plan = provider.enabled ? this.store.planUsageOf(provider.kind, provider.id) : null;
    const known = isNote ? ProviderIdentity.describeAccount(provider.authStatus, provider.identity) ?? "" : "";
    const runs = provider.binaryPath ?? this.store.installations().get(provider.kind)?.foundPath ?? null;
    const detail = [hint ?? account, known, provider.identity?.organization ?? "", ...(Object.isNull(plan) ? [] : this.usage.otherLines(plan)),
      Resources.formatProfileFolder(provider.profileDir), Object.isNull(runs) ? "" : Resources.formatBinaryPath(runs)]
      .filter(t => !String.isNullOrWhitespace(t)).join(Resources.titleSeparator);
    const tag = ProviderRows.planTagOf(provider.kind, ProviderRows.planOf(provider.identity, plan));
    const limits = Object.isNull(plan) ? [] : this.usage.limitsOf(plan);
    const limitsNote = Object.isNull(plan) || limits.length > 0 ? null : Resources.formatNoLimits(this.kindNameOf(provider.kind));
    return new ProviderRow(provider, status, dot, account, detail, isNote, isFailed, isError, announcement, sameAccountAs, tag, limits, limitsNote, warning,
      command);
  }

  private static planOf(identity: ProviderIdentity | null, usage: PlanUsage | null): string | null {
    const named = identity?.plan ?? "";
    return String.isNullOrWhitespace(named) ? usage?.plan ?? null : named;
  }

  private static planTagOf(kind: string, plan: string | null | undefined): string {
    const code = plan ?? "";
    return String.isNullOrWhitespace(code) ? Resources.noPlanTag : ProviderRows.planName(kind, code);
  }

  private static accountKey(identity: ProviderIdentity | null): string | null {
    const key = (identity?.email ?? identity?.userName ?? "").trim().toLowerCase();
    return key.length === 0 ? null : key;
  }

  private static planName(kind: string, plan: string): string {
    const named = Resources.planNames.get(kind)?.get(plan);
    if (!Object.isUndefined(named))
      return named;
    return Resources.upperCasePattern.test(plan) ? plan
      : plan.split(Resources.planCodeSeparator).map(t => `${t.charAt(0).toUpperCase()}${t.slice(1)}`).join(Resources.planWordSeparator);
  }
}
