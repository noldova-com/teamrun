/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { ProviderAbility } from "../enums/provider-ability.js";
import { Resources } from "../resources.js";
import { AbilityCell } from "./ability-cell.js";

export class ProviderAbilities {
  public static readonly names: Readonly<Record<ProviderAbility, string>> = {
    [ProviderAbility.RunTurn]: Resources.abilityRunTurnName,
    [ProviderAbility.Resume]: Resources.abilityResumeName,
    [ProviderAbility.Fork]: Resources.abilityForkName,
    [ProviderAbility.Compact]: Resources.abilityCompactName,
    [ProviderAbility.Images]: Resources.abilityImagesName,
    [ProviderAbility.Files]: Resources.abilityFilesName,
    [ProviderAbility.SteerTurn]: Resources.abilitySteerTurnName,
    [ProviderAbility.ChatTitle]: Resources.abilityChatTitleName,
    [ProviderAbility.ChooseModel]: Resources.abilityChooseModelName,
    [ProviderAbility.ChooseEffort]: Resources.abilityChooseEffortName,
    [ProviderAbility.ChooseSpeed]: Resources.abilityChooseSpeedName,
    [ProviderAbility.ChooseContext]: Resources.abilityChooseContextName,
    [ProviderAbility.PlanMode]: Resources.abilityPlanModeName,
    [ProviderAbility.ReadOnlyMode]: Resources.abilityReadOnlyModeName,
    [ProviderAbility.UnrestrictedMode]: Resources.abilityUnrestrictedModeName,
    [ProviderAbility.PermissionCards]: Resources.abilityPermissionCardsName,
    [ProviderAbility.ApprovedTools]: Resources.abilityApprovedToolsName,
    [ProviderAbility.Questions]: Resources.abilityQuestionsName,
    [ProviderAbility.PlanChecklist]: Resources.abilityPlanChecklistName,
    [ProviderAbility.ReplyUsage]: Resources.abilityReplyUsageName,
    [ProviderAbility.PlanLimits]: Resources.abilityPlanLimitsName,
    [ProviderAbility.SubAgentRows]: Resources.abilitySubAgentRowsName,
    [ProviderAbility.BackgroundSubAgents]: Resources.abilityBackgroundSubAgentsName,
    [ProviderAbility.StopSubAgent]: Resources.abilityStopSubAgentName,
    [ProviderAbility.BackgroundCommands]: Resources.abilityBackgroundCommandsName,
    [ProviderAbility.Explorer]: Resources.abilityExplorerName,
    [ProviderAbility.GeneratedImages]: Resources.abilityGeneratedImagesName,
    [ProviderAbility.TeamRunTools]: Resources.abilityTeamRunToolsName,
    [ProviderAbility.SharedStdioServers]: Resources.abilitySharedStdioServersName,
    [ProviderAbility.SharedHttpServers]: Resources.abilitySharedHttpServersName,
    [ProviderAbility.OwnServersSwitch]: Resources.abilityOwnServersSwitchName,
    [ProviderAbility.OwnServersList]: Resources.abilityOwnServersListName,
    [ProviderAbility.SignIn]: Resources.abilitySignInName,
    [ProviderAbility.SignOut]: Resources.abilitySignOutName,
    [ProviderAbility.SeveralAccounts]: Resources.abilitySeveralAccountsName,
    [ProviderAbility.Account]: Resources.abilityAccountName,
    [ProviderAbility.Install]: Resources.abilityInstallName,
    [ProviderAbility.CompactCommand]: Resources.abilityCompactCommandName,
    [ProviderAbility.ListedCommands]: Resources.abilityListedCommandsName,
    [ProviderAbility.BuiltInCommands]: Resources.abilityBuiltInCommandsName,
    [ProviderAbility.CustomCommands]: Resources.abilityCustomCommandsName,
    [ProviderAbility.LogoutCommand]: Resources.abilityLogoutCommandName
  };

  public static readonly commands: readonly ProviderAbility[] = [ProviderAbility.CompactCommand, ProviderAbility.ListedCommands, ProviderAbility.BuiltInCommands, ProviderAbility.CustomCommands, ProviderAbility.LogoutCommand];

  public readonly cells: Readonly<Record<ProviderAbility, AbilityCell>>;

  public constructor(cells: Readonly<Record<ProviderAbility, AbilityCell>>) {
    for (const ability of Object.values(ProviderAbility))
      if (!(cells[ability] instanceof AbilityCell))
        throw new ArgumentException(Resources.formatAbilityMissing(ability), Resources.cellsField);
    if (Object.keys(cells).length !== Object.values(ProviderAbility).length)
      throw new ArgumentException(Resources.unknownAbility, Resources.cellsField);

    this.cells = Object.freeze({ ...cells });
  }

  public cellOf(ability: ProviderAbility): AbilityCell {
    return this.cells[ability];
  }

  public static fromJson(value: unknown, path?: string): ProviderAbilities {
    const cells = JsonReader.fromValue(value, path).readObject(Resources.cellsField);
    return new ProviderAbilities(Object.fromEntries(Object.keys(cells.toJson()).map(t => {
      const cell = cells.readObject(t);
      return [t, AbilityCell.fromJson(cell.toJson(), cell.path)];
    })) as Record<ProviderAbility, AbilityCell>);
  }

  public toJson(): JsonObject {
    return { [Resources.cellsField]: Object.fromEntries(Object.values(ProviderAbility).map(t => [t, this.cells[t].toJson()])) };
  }
}
