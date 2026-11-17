/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import { PanelName } from "@noldova/teamrun.protocol";

import { TeamRunTool } from "../models/teamrun-tool.js";
import { Resources } from "../resources.js";

export class TeamRunTools {
  private static readonly READ_DEADLINE: number = 30_000;
  private static readonly CHECK_DEADLINE: number = 60_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;
  private static readonly MESSAGE_LIMIT: number = 20;

  public static readonly all: readonly TeamRunTool[] = [
    new TeamRunTool(TeamRunTools.reading(Resources.listProjectsTool, Resources.listProjectsTitle, Resources.listProjectsDescription, {}),
      Resources.listProjectsCommand),
    new TeamRunTool(TeamRunTools.reading(Resources.listChatsTool, Resources.listChatsTitle, Resources.listChatsDescription,
      { [Resources.projectIdArgument]: TeamRunTools.text(Resources.projectIdDescription) }),
    Resources.listChatsCommand, new Map([[Resources.projectIdArgument, Resources.projectValue]])),
    new TeamRunTool(TeamRunTools.reading(Resources.listMessagesTool, Resources.listMessagesTitle, Resources.listMessagesDescription, {
      [Resources.chatIdArgument]: TeamRunTools.text(Resources.chatIdDescription),
      [Resources.beforeArgument]: TeamRunTools.integer(Resources.beforeDescription, 1),
      [Resources.limitArgument]: { ...TeamRunTools.integer(Resources.limitDescription, 1), default: TeamRunTools.MESSAGE_LIMIT }
    }, [Resources.chatIdArgument]), Resources.listMessagesCommand, new Map([
      [Resources.chatIdArgument, Resources.chatIdValue], [Resources.beforeArgument, Resources.beforeValue], [Resources.limitArgument, Resources.limitValue]
    ]), { [Resources.limitValue]: TeamRunTools.MESSAGE_LIMIT }),
    new TeamRunTool(TeamRunTools.reading(Resources.listApprovalsTool, Resources.listApprovalsTitle, Resources.listApprovalsDescription, {
      [Resources.chatIdArgument]: TeamRunTools.text(Resources.chatIdDescription),
      [Resources.pendingArgument]: { type: "boolean", description: Resources.pendingDescription }
    }, [Resources.chatIdArgument]), Resources.listApprovalsCommand, new Map([
      [Resources.chatIdArgument, Resources.chatIdValue], [Resources.pendingArgument, Resources.pendingValue]
    ])),
    new TeamRunTool(TeamRunTools.reading(Resources.listProvidersTool, Resources.listProvidersTitle, Resources.listProvidersDescription, {}),
      Resources.listProvidersCommand),
    new TeamRunTool({
      ...TeamRunTools.reading(Resources.checkProviderTool, Resources.checkProviderTitle, Resources.checkProviderDescription,
        { [Resources.providerIdArgument]: TeamRunTools.text(Resources.providerIdDescription) }, [Resources.providerIdArgument]),
      hints: { isReadOnly: false, isDestructive: false, isOpenWorld: true },
      isResumable: true,
      deadline: { default: TeamRunTools.CHECK_DEADLINE, maximum: TeamRunTools.MAXIMUM_DEADLINE }
    }, Resources.checkProviderCommand, new Map([[Resources.providerIdArgument, Resources.providerIdValue]])),
    new TeamRunTool(TeamRunTools.reading(Resources.listTeammatesTool, Resources.listTeammatesTitle, Resources.listTeammatesDescription, {}),
      Resources.listTeammatesCommand)
  ];

  public static readonly openPanel: IToolDescriptor = TeamRunTools.panel(Resources.openPanelTool, Resources.openPanelTitle, Resources.openPanelDescription);
  public static readonly closePanel: IToolDescriptor = TeamRunTools.panel(Resources.closePanelTool, Resources.closePanelTitle, Resources.closePanelDescription);

  private static reading(name: string, title: string, description: string, properties: JsonObject, required: readonly string[] = []): IToolDescriptor {
    return {
      name,
      title,
      description,
      inputSchema: { type: "object", properties, required: [...required], additionalProperties: false },
      hints: { isReadOnly: true, isDestructive: false, isOpenWorld: false },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      deadline: { default: TeamRunTools.READ_DEADLINE, maximum: TeamRunTools.MAXIMUM_DEADLINE }
    };
  }

  private static panel(name: string, title: string, description: string): IToolDescriptor {
    return {
      ...TeamRunTools.reading(name, title, description, {
        [Resources.panelArgument]: { type: "string", enum: Object.values(PanelName), description: Resources.panelDescription },
        [Resources.chatIdArgument]: TeamRunTools.text(Resources.panelChatIdDescription)
      }, [Resources.panelArgument]),
      hints: { isReadOnly: false, isDestructive: false, isOpenWorld: false },
      isResumable: true
    };
  }

  private static text(description: string): JsonObject {
    return { type: "string", minLength: 1, description };
  }

  private static integer(description: string, minimum: number): JsonObject {
    return { type: "integer", minimum, description };
  }
}
