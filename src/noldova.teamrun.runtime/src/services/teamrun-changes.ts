/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import { Harness, MethodName } from "@noldova/teamrun.protocol";

import { ChangeGuard } from "../enums/change-guard.js";
import { TeamRunChange } from "../models/teamrun-change.js";
import { Resources } from "../resources.js";

export class TeamRunChanges {
  private static readonly DEADLINE: number = 30_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;
  private static readonly CHAT: ReadonlyMap<string, string> = new Map([[Resources.chatIdArgument, Resources.conversationIdField]]);
  private static readonly MEMBER: ReadonlyMap<string, string> = new Map([
    [Resources.chatIdArgument, Resources.conversationIdField], [Resources.teammateIdArgument, Resources.teammateIdField]
  ]);
  private static readonly TEAMMATE: ReadonlyMap<string, string> = new Map([
    [Resources.nameArgument, Resources.nameField], [Resources.roleArgument, Resources.roleField], [Resources.providerIdArgument, Resources.providerIdField],
    [Resources.modelArgument, Resources.modelField], [Resources.effortArgument, Resources.effortField],
    [Resources.contextWindowArgument, Resources.contextWindowField]
  ]);

  public static readonly all: readonly TeamRunChange[] = [
    new TeamRunChange(TeamRunChanges.changing(Resources.listProjectsTool, Resources.openProjectTool,
      Resources.openProjectTitle, Resources.openProjectDescription,
      { [Resources.folderArgument]: TeamRunChanges.text(Resources.folderDescription) }, [Resources.folderArgument]),
    MethodName.ProjectOpen, new Map([[Resources.folderArgument, Resources.rootPathField]])),
    new TeamRunChange(TeamRunChanges.changing(Resources.listProjectsTool, Resources.forgetProjectTool,
      Resources.forgetProjectTitle, Resources.forgetProjectDescription,
      { [Resources.projectIdArgument]: TeamRunChanges.text(Resources.changedProjectIdDescription) }, [Resources.projectIdArgument], ToolRisk.High),
    MethodName.ProjectForget, new Map([[Resources.projectIdArgument, Resources.projectIdField]]), true, ChangeGuard.OwnProject),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.createChatTool, Resources.createChatTitle, Resources.createChatDescription, {
      [Resources.projectIdArgument]: TeamRunChanges.text(Resources.newChatProjectIdDescription),
      [Resources.titleArgument]: TeamRunChanges.text(Resources.newChatTitleDescription)
    }, []), MethodName.ConversationCreate, new Map([
      [Resources.projectIdArgument, Resources.projectIdField], [Resources.titleArgument, Resources.titleField]
    ]), false, ChangeGuard.None, { [Resources.titleField]: null, [Resources.projectIdField]: null }),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.renameChatTool, Resources.renameChatTitle, Resources.renameChatDescription, {
      [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription),
      [Resources.titleArgument]: TeamRunChanges.text(Resources.chatTitleDescription)
    }, [Resources.chatIdArgument, Resources.titleArgument]), MethodName.ConversationRename, new Map([
      [Resources.chatIdArgument, Resources.conversationIdField], [Resources.titleArgument, Resources.titleField]
    ])),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.moveChatTool, Resources.moveChatTitle, Resources.moveChatDescription, {
      [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription),
      [Resources.projectIdArgument]: TeamRunChanges.text(Resources.targetProjectIdDescription)
    }, [Resources.chatIdArgument, Resources.projectIdArgument]), MethodName.ConversationMove, new Map([
      [Resources.chatIdArgument, Resources.conversationIdField], [Resources.projectIdArgument, Resources.projectIdField]
    ]), false, ChangeGuard.ChatFiles),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.deleteChatTool, Resources.deleteChatTitle, Resources.deleteChatDescription,
      { [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription) }, [Resources.chatIdArgument], ToolRisk.High),
    MethodName.ConversationDelete, TeamRunChanges.CHAT, true, ChangeGuard.OwnChat),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.addTeammateToChatTool,
      Resources.addTeammateToChatTitle, Resources.addTeammateToChatDescription,
      TeamRunChanges.member(), [Resources.chatIdArgument, Resources.teammateIdArgument]), MethodName.ConversationAddMember, TeamRunChanges.MEMBER),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.removeTeammateFromChatTool, Resources.removeTeammateFromChatTitle,
      Resources.removeTeammateFromChatDescription, TeamRunChanges.member(), [Resources.chatIdArgument, Resources.teammateIdArgument], ToolRisk.Medium),
    MethodName.ConversationRemoveMember, TeamRunChanges.MEMBER, true, ChangeGuard.OwnMembership),
    new TeamRunChange(TeamRunChanges.changing(Resources.listChatsTool, Resources.cancelRepliesTool,
      Resources.cancelRepliesTitle, Resources.cancelRepliesDescription,
      { [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription) }, [Resources.chatIdArgument], ToolRisk.Medium),
    MethodName.ConversationCancel, TeamRunChanges.CHAT, true, ChangeGuard.None, {}, false),
    new TeamRunChange(TeamRunChanges.changing(Resources.listTeammatesTool, Resources.createTeammateTool,
      Resources.createTeammateTitle, Resources.createTeammateDescription,
      TeamRunChanges.teammate({}), [Resources.nameArgument, Resources.providerIdArgument], ToolRisk.Medium),
    MethodName.TeammateCreate, TeamRunChanges.TEAMMATE, true, ChangeGuard.None, {
      [Resources.roleField]: null, [Resources.harnessField]: Harness.Provider, [Resources.modelField]: null, [Resources.effortField]: null
    }),
    new TeamRunChange(TeamRunChanges.changing(Resources.listTeammatesTool, Resources.updateTeammateTool,
      Resources.updateTeammateTitle, Resources.updateTeammateDescription,
      TeamRunChanges.teammate({ [Resources.teammateIdArgument]: TeamRunChanges.text(Resources.teammateIdDescription) }), [Resources.teammateIdArgument],
      ToolRisk.Medium),
    MethodName.TeammateUpdate, new Map([...TeamRunChanges.TEAMMATE, [Resources.teammateIdArgument, Resources.teammateIdField]]), true),
    new TeamRunChange(TeamRunChanges.changing(Resources.listTeammatesTool, Resources.deleteTeammateTool,
      Resources.deleteTeammateTitle, Resources.deleteTeammateDescription,
      { [Resources.teammateIdArgument]: TeamRunChanges.text(Resources.teammateIdDescription) }, [Resources.teammateIdArgument], ToolRisk.High),
    MethodName.TeammateDelete, new Map([[Resources.teammateIdArgument, Resources.teammateIdField]]), true, ChangeGuard.Caller)
  ];

  public static readonly send: IToolDescriptor = TeamRunChanges.changing(Resources.listMessagesTool, Resources.sendMessageTool,
      Resources.sendMessageTitle, Resources.sendMessageDescription, {
    [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription),
    [Resources.textArgument]: TeamRunChanges.text(Resources.messageTextDescription),
    [Resources.wakeWhenDoneArgument]: { type: "boolean", description: Resources.wakeWhenDoneDescription }
  }, [Resources.chatIdArgument, Resources.textArgument], ToolRisk.Medium);

  private static changing(nextTool: string, name: string, title: string, description: string, properties: JsonObject, required: readonly string[],
    risk: ToolRisk = ToolRisk.Low): IToolDescriptor {
    return {
      name,
      title,
      description,
      inputSchema: { type: "object", properties, required: [...required], additionalProperties: false },
      hints: { isReadOnly: false, isDestructive: risk !== ToolRisk.Low, isOpenWorld: false },
      risk: { default: risk, maximum: risk },
      marksSending: true,
      deadline: { default: TeamRunChanges.DEADLINE, maximum: TeamRunChanges.MAXIMUM_DEADLINE },
      nextTool
    };
  }

  private static member(): JsonObject {
    return {
      [Resources.chatIdArgument]: TeamRunChanges.text(Resources.chatIdDescription),
      [Resources.teammateIdArgument]: TeamRunChanges.text(Resources.teammateIdDescription)
    };
  }

  private static teammate(properties: JsonObject): JsonObject {
    return {
      ...properties,
      [Resources.nameArgument]: TeamRunChanges.text(Resources.teammateNameDescription),
      [Resources.roleArgument]: TeamRunChanges.text(Resources.roleDescription),
      [Resources.providerIdArgument]: TeamRunChanges.text(Resources.teammateProviderDescription),
      [Resources.modelArgument]: TeamRunChanges.text(Resources.modelDescription),
      [Resources.effortArgument]: TeamRunChanges.text(Resources.effortDescription),
      [Resources.contextWindowArgument]: { type: ["integer", "null"], minimum: 1, description: Resources.contextWindowDescription }
    };
  }

  private static text(description: string): JsonObject {
    return { type: "string", minLength: 1, description };
  }
}
