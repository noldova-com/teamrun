/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderAbilities, ProviderAbility } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class AbilityGroup {
  public static readonly all: readonly AbilityGroup[] = [
    new AbilityGroup(Resources.abilityGroupChats, [ProviderAbility.RunTurn, ProviderAbility.Resume, ProviderAbility.Fork, ProviderAbility.Compact,
      ProviderAbility.Images, ProviderAbility.Files, ProviderAbility.SteerTurn, ProviderAbility.ChatTitle]),
    new AbilityGroup(Resources.abilityGroupChoices, [ProviderAbility.ChooseModel, ProviderAbility.ChooseEffort, ProviderAbility.ChooseSpeed, ProviderAbility.ChooseContext]),
    new AbilityGroup(Resources.abilityGroupModes, [ProviderAbility.PlanMode, ProviderAbility.ReadOnlyMode, ProviderAbility.UnrestrictedMode,
      ProviderAbility.PermissionCards, ProviderAbility.ApprovedTools, ProviderAbility.Questions]),
    new AbilityGroup(Resources.abilityGroupReply, [ProviderAbility.PlanChecklist, ProviderAbility.ReplyUsage, ProviderAbility.PlanLimits, ProviderAbility.GeneratedImages]),
    new AbilityGroup(Resources.abilityGroupSubAgents, [ProviderAbility.SubAgentRows, ProviderAbility.BackgroundSubAgents, ProviderAbility.StopSubAgent,
      ProviderAbility.BackgroundCommands, ProviderAbility.Explorer]),
    new AbilityGroup(Resources.abilityGroupMcpServers, [ProviderAbility.TeamRunTools, ProviderAbility.SharedStdioServers, ProviderAbility.SharedHttpServers,
      ProviderAbility.OwnServersSwitch, ProviderAbility.OwnServersList]),
    new AbilityGroup(Resources.abilityGroupSignIn, [ProviderAbility.SignIn, ProviderAbility.SignOut, ProviderAbility.SeveralAccounts, ProviderAbility.Account,
      ProviderAbility.Install]),
    new AbilityGroup(Resources.abilityGroupCommands, ProviderAbilities.commands)
  ];

  public constructor(public readonly title: string, public readonly abilities: readonly ProviderAbility[]) {
  }
}
