/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";
import type { IProviderAdapter } from "@noldova/teamrun.core";
import { AbilityAnswer, type Provider, type ProviderAbilities, ProviderAbility, type ProviderKind, type ProviderModelList, SharedMcpServerDefinition,
  SharedMcpTransport } from "@noldova/teamrun.protocol";

export type AbilityProbe = () => Promise<boolean | string>;

export type ProbedAbility = Exclude<ProviderAbility, ProviderAbility.CompactCommand | ProviderAbility.LogoutCommand>;

export type AbilityProbes = Readonly<Record<ProbedAbility, AbilityProbe | string>>;

export class AbilityChecks {
  public static readonly platformFlag: string = "the descriptor's singleAccount answers it for each platform, while a row is one answer for every platform";
  public static readonly acpCommands: string = "every ACP agent takes a command through the same path, which the ACP adapter's own tests check with an agent that lists commands";
  public static readonly commandLists: string = "which commands a provider has comes from its own docs or a live run, while a double lists only what its test gives it";
  public static readonly install: string = "an install downloads the provider's release, and the runtime's ProviderKindRegistryFactory gives each adapter its installer";
  private static readonly stdioServer = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], [], null, [], null);
  private static readonly httpServer = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], null);

  public static async runAsync(descriptor: ProviderKind, probes: AbilityProbes): Promise<void> {
    const row = descriptor.abilities;
    const failures: string[] = [];
    if (Object.isNull(row))
      failures.push(`${descriptor.id} has no ability row`);
    else
      for (const ability of Object.values(ProviderAbility)) {
        const probe = probes[AbilityChecks.probedOf(ability)];
        if (typeof probe !== "string")
          failures.push(...AbilityChecks.compare(row, descriptor.displayName, ability, await AbilityChecks.outcomeOf(probe)));
      }

    Assert.areEqual(String.empty, failures.join("\n"));
  }

  public static async refusalOf(action: () => Promise<unknown>): Promise<boolean | string> {
    try {
      await action();
      return true;
    }
    catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  public static listsModel(listModels: () => Promise<ProviderModelList>, id: string): AbilityProbe {
    return async () => (await listModels()).models.some(t => t.id === id);
  }

  public static listsModes(listModels: () => Promise<ProviderModelList>): AbilityProbe {
    return async () => (await listModels()).modes.length > 0;
  }

  public static surface(adapter: IProviderAdapter, provider: Provider, listModels: () => Promise<ProviderModelList>): Pick<AbilityProbes,
    ProviderAbility.ChooseModel | ProviderAbility.ChooseEffort | ProviderAbility.ChooseSpeed | ProviderAbility.ChooseContext | ProviderAbility.PlanMode |
    ProviderAbility.ReadOnlyMode | ProviderAbility.UnrestrictedMode | ProviderAbility.Explorer | ProviderAbility.ChatTitle | ProviderAbility.TeamRunTools |
    ProviderAbility.SharedStdioServers | ProviderAbility.SharedHttpServers | ProviderAbility.OwnServersSwitch | ProviderAbility.OwnServersList | ProviderAbility.SignIn |
    ProviderAbility.SignOut | ProviderAbility.SeveralAccounts | ProviderAbility.Account | ProviderAbility.PlanLimits | ProviderAbility.Install | ProviderAbility.ListedCommands |
    ProviderAbility.BuiltInCommands | ProviderAbility.CustomCommands> {
    let models: Promise<ProviderModelList> | null = null;
    const listed = (): Promise<ProviderModelList> => models ??= listModels();
    const modes = async (): Promise<readonly { readonly readOnly: boolean; readonly unrestricted: boolean }[]> => [...adapter.modes, ...(await listed()).modes];
    const shared = (server: SharedMcpServerDefinition): AbilityProbe => () =>
      Promise.resolve(!Object.isNullOrUndefined(adapter.sharedServerUnavailable) && Object.isNull(adapter.sharedServerUnavailable(server, provider, null)));
    return {
      [ProviderAbility.ChooseModel]: async () => (await listed()).models.length > 0,
      [ProviderAbility.ChooseEffort]: async () => (await listed()).models.some(t => (t.effortLevels?.length ?? 0) > 0),
      [ProviderAbility.ChooseSpeed]: async () => (await listed()).models.some(t => t.speeds.length > 0),
      [ProviderAbility.ChooseContext]: async () => (await listed()).models.some(t => !Object.isNull(t.contextWindows)),
      [ProviderAbility.PlanMode]: async () => !Object.isNullOrUndefined((await listed()).planMode ?? adapter.planMode),
      [ProviderAbility.ReadOnlyMode]: async () => (await modes()).some(t => t.readOnly),
      [ProviderAbility.UnrestrictedMode]: async () => (await modes()).some(t => t.unrestricted),
      [ProviderAbility.Explorer]: () => Promise.resolve(!Object.isNullOrUndefined(adapter.explorerMode)),
      [ProviderAbility.ChatTitle]: () => Promise.resolve(!Object.isNullOrUndefined(adapter.askIsolated)),
      [ProviderAbility.TeamRunTools]: () => Promise.resolve(adapter.takesTeamRunTools === true),
      [ProviderAbility.SharedStdioServers]: shared(AbilityChecks.stdioServer),
      [ProviderAbility.SharedHttpServers]: shared(AbilityChecks.httpServer),
      [ProviderAbility.OwnServersSwitch]: () => Promise.resolve(adapter.descriptor.ownMcpServersUnavailable ?? true),
      [ProviderAbility.OwnServersList]: async () => !Object.isNullOrUndefined(await adapter.listOwnMcpServers?.(provider)),
      [ProviderAbility.SignIn]: () => Promise.resolve(adapter.descriptor.supportsSignIn || !Object.isNullOrUndefined(adapter.descriptor.profile?.signInCommand)),
      [ProviderAbility.SignOut]: () => Promise.resolve(AbilityChecks.signsOut(adapter.descriptor)),
      [ProviderAbility.SeveralAccounts]: AbilityChecks.platformFlag,
      [ProviderAbility.Account]: async () => !Object.isNull((await adapter.checkSignIn(provider)).identity),
      [ProviderAbility.PlanLimits]: async () => ((await adapter.readPlanUsage?.(provider))?.windows.length ?? 0) > 0,
      [ProviderAbility.Install]: AbilityChecks.install,
      [ProviderAbility.ListedCommands]: AbilityChecks.acpCommands,
      [ProviderAbility.BuiltInCommands]: AbilityChecks.commandLists,
      [ProviderAbility.CustomCommands]: AbilityChecks.commandLists
    };
  }

  private static probedOf(ability: ProviderAbility): ProbedAbility {
    return ability === ProviderAbility.CompactCommand ? ProviderAbility.Compact : ability === ProviderAbility.LogoutCommand ? ProviderAbility.SignOut : ability;
  }

  private static async outcomeOf(probe: AbilityProbe): Promise<boolean | string> {
    try {
      return await probe();
    }
    catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private static signsOut(descriptor: ProviderKind): boolean {
    const command = descriptor.signOutEndsWithCommand ? descriptor.signOutCommand : descriptor.profile?.toolCommand ?? null;
    return descriptor.supportsSignOut || (!Object.isNull(descriptor.profile) && !Object.isNull(command));
  }

  private static compare(row: ProviderAbilities, displayName: string, ability: ProviderAbility, outcome: boolean | string): readonly string[] {
    const cell = row.cellOf(ability);
    const offered = cell.answer === AbilityAnswer.Works || cell.answer === AbilityAnswer.NotChecked;
    if (offered)
      return outcome === true ? [] : [`${ability}: the row says "${cell.label}", but ${typeof outcome === "string" ? `it refuses: ${outcome}` : "it isn't offered"}`];
    if (outcome === true)
      return [`${ability}: the row says "${cell.label}", but it works`];
    const reasons = [cell.reasonAlone, cell.reasonFor(displayName)].filter(t => !Object.isNull(t));
    return typeof outcome === "string" && reasons.length > 0 && !reasons.some(t => outcome.includes(t))
      ? [`${ability}: the row says "${cell.label}", but its refusal leaves out the row's reason: ${outcome}`] : [];
  }
}
