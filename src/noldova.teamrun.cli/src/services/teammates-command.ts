/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { CliCommandResult } from "@noldova/desktop.cli";
import {
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  ConversationMember,
  Message,
  MethodName,
  Organization,
  PlanUsage,
  ProjectListing,
  Provider,
  Teammate,
  TeammateUsage
} from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class TeammatesCommand extends TeamRunCommand {
  public readonly name: string = Resources.teammatesCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(_values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const teammates = await this.client.listAsync(MethodName.TeammateList, null, signal, t => Teammate.fromJson(t));
    const providers = await this.client.listAsync(MethodName.ProviderList, null, signal, t => Provider.fromJson(t));
    const chats: { chat: Conversation; members: readonly string[] }[] = [];
    const projects = await this.client.listAsync(MethodName.ProjectList, null, signal, t => ProjectListing.fromJson(t).project);
    for (const projectId of [...projects.map(t => t.id), null])
      for (const chat of await this.client.listAsync(MethodName.ConversationList, new ConversationListParams(projectId).toJson(), signal, t => Conversation.fromJson(t))) {
        const members = await this.client.listAsync(MethodName.ConversationListMembers, new ConversationIdParams(chat.id).toJson(), signal,
          t => ConversationMember.fromJson(t));
        chats.push({ chat, members: members.map(t => t.teammateId) });
      }
    const open = await this.client.listAsync(MethodName.MessageListOpen, null, signal, t => Message.fromJson(t));
    const usage = await this.client.listAsync(MethodName.TeammateUsageList, null, signal, t => TeammateUsage.fromJson(t));
    const plans = await this.client.listAsync(MethodName.PlanUsageList, null, signal, t => PlanUsage.fromJson(t));
    const organizations = await this.client.listAsync(MethodName.OrganizationList, null, signal, t => Organization.fromJson(t));
    const rows: JsonObject[] = [];
    const lines: string[] = [];
    for (const teammate of teammates) {
      const provider = providers.find(t => t.id === teammate.providerId) ?? null;
      const joined = chats.filter(t => t.members.includes(teammate.id)).map(t => t.chat);
      const answering = open.some(t => t.teammateId === teammate.id);
      const used = usage.filter(t => t.teammateId === teammate.id);
      const read = Object.isNull(provider) ? null : plans.find(t => t.providerId === provider.id && t.kind === provider.kind) ?? null;
      const windows = read?.windows ?? [];
      const placed = organizations.filter(t => t.placements.some(u => u.teammateId === teammate.id));
      rows.push({
        [Resources.idField]: teammate.id,
        [Resources.nameField]: teammate.name,
        [Resources.roleField]: teammate.role,
        [Resources.harnessField]: teammate.harness,
        [Resources.providerField]: Object.isNull(provider) ? null : TeammatesCommand.reported({
          [Resources.idField]: provider.id, [Resources.kindField]: provider.kind, [Resources.labelField]: provider.label,
          [Resources.emailField]: provider.identity?.email, [Resources.userNameField]: provider.identity?.userName,
          [Resources.planField]: String.isNullOrWhitespace(provider.identity?.plan ?? "") ? read?.plan : provider.identity?.plan,
          [Resources.organizationField]: provider.identity?.organization
        }),
        [Resources.modelField]: teammate.model,
        [Resources.effortField]: teammate.effort,
        [Resources.chatsField]: joined.map(t => ({ [Resources.idField]: t.id, [Resources.titleField]: t.title })),
        [Resources.answeringField]: answering,
        [Resources.usageField]: used.map(t => TeammatesCommand.reported({
          [Resources.chatIdField]: t.conversationId, [Resources.inputTokensField]: t.usage.inputTokens, [Resources.outputTokensField]: t.usage.outputTokens,
          [Resources.costUsdField]: t.usage.costUsd, [Resources.contextTokensField]: t.usage.context?.usedTokens,
          [Resources.contextWindowField]: t.usage.context?.windowTokens
        })),
        [Resources.planWindowsField]: windows.map(t => TeammatesCommand.reported(t.toJson())),
        [Resources.organizationsField]: placed.map(t => {
          const department = TeammatesCommand.departmentOf(t, teammate.id);
          const managerId = t.managerOf(teammate.id);
          return {
            [Resources.idField]: t.id, [Resources.nameField]: t.name, [Resources.departmentField]: department,
            [Resources.managerField]: Object.isNull(managerId) ? null
              : { [Resources.idField]: managerId, [Resources.nameField]: teammates.find(u => u.id === managerId)?.name ?? null }
          };
        })
      });
      lines.push(Resources.formatTeammate(teammate, provider, joined, answering));
      for (const reply of used) {
        const line = Resources.formatTeammateUsage(joined.find(t => t.id === reply.conversationId)?.title ?? null, reply);
        if (!Object.isNull(line))
          lines.push(line);
      }
      if (windows.length > 0)
        lines.push(Resources.formatPlanWindows(windows));
      for (const organization of placed) {
        const managerId = organization.managerOf(teammate.id);
        lines.push(Resources.formatTeammatePlace(organization.name, TeammatesCommand.departmentOf(organization, teammate.id),
          Object.isNull(managerId) ? null : teammates.find(t => t.id === managerId)?.name ?? managerId));
      }
    }
    return new CliCommandResult(rows, Resources.formatList(lines));
  }

  private static departmentOf(organization: Organization, teammateId: string): string | null {
    const departmentId = organization.departmentOf(teammateId);
    return organization.departments.find(t => t.id === departmentId)?.name ?? null;
  }
}
