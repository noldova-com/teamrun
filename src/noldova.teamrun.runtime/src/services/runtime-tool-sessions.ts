/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolsContext } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";
import { type ITimer, type ITurnToolSession, type ITurnToolSessions, type IWindowsService, NodeTimer, type ToolCallRecord } from "@noldova/teamrun.core";
import { PanelName, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { RuntimeToolSession } from "./runtime-tool-session.js";
import { ServedCalls } from "./served-calls.js";

export class RuntimeToolSessions implements ITurnToolSessions {
  public readonly approvedTools: readonly string[];
  public readonly endpoint: string | null;
  private readonly tools: IToolsContext;
  private readonly windows: IWindowsService | null;
  private readonly timer: ITimer;
  private readonly calls: ServedCalls;

  public constructor(tools: IToolsContext, approvedTools: readonly string[], endpoint: string | null = null,
    windows: IWindowsService | null = null, timer: ITimer = new NodeTimer(), calls: ServedCalls = new ServedCalls()) {
    this.tools = tools;
    this.approvedTools = [...approvedTools];
    this.endpoint = endpoint;
    this.windows = windows;
    this.timer = timer;
    this.calls = calls;
  }

  public open(scope: string, conversationId: string, workFolder: string, projectId: string | null, agentName: string,
    record: (call: ToolCallRecord) => void): ITurnToolSession {
    const windows = this.windows;
    return new RuntimeToolSession(this.tools.openSession(scope, RuntimeToolSessions.bindings(conversationId, workFolder, projectId, agentName)),
      Object.isNull(windows) ? null : async signal => {
        await windows.requestAsync(PanelName.Page, conversationId, true, conversationId, signal);
      }, this.timer, record, this.calls);
  }

  private static bindings(conversationId: string, workFolder: string, projectId: string | null, agentName: string): JsonObject {
    return {
      [Resources.terminalFolderBinding]: workFolder,
      [Resources.terminalSharedBinding]: [],
      [Resources.terminalOwnerBinding]: `${ProtocolResources.chatTerminalOwnerPrefix}${conversationId}`,
      [Resources.gitFolderBinding]: workFolder,
      [Resources.browserPageBinding]: conversationId,
      [Resources.browserProfileBinding]: projectId ?? ProtocolResources.projectlessPageProfile,
      [Resources.browserAgentBinding]: agentName
    };
  }
}
