/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IToolHandler,
  type ToolCall,
  ToolContent,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { type IWindowsService, RequestDispatcher, Resources as CoreResources } from "@noldova/teamrun.core";
import { ErrorCode, type PanelName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class PanelTool implements IToolHandler {
  private static readonly REFUSED: readonly string[] = [ErrorCode.InvalidParams, ErrorCode.NotFound, ErrorCode.Conflict];

  private readonly moduleId: string;
  private readonly windows: IWindowsService;
  private readonly open: boolean;

  public constructor(moduleId: string, windows: IWindowsService, open: boolean) {
    this.moduleId = moduleId;
    this.windows = windows;
    this.open = open;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const panel = call.arguments[Resources.panelArgument] as PanelName;
    const chatId = call.arguments[Resources.chatIdArgument];
    const conversationId = typeof chatId === "string" ? chatId : null;
    try {
      await this.windows.requestAsync(panel, conversationId, this.open, call.scope.split(CoreResources.toolScopeSeparator)[0]!, call.signal);
      return new ToolResult([ToolContent.fromText(Resources.formatPanelAnswer(panel, conversationId, this.open), null)]);
    }
    catch (error) {
      const info = RequestDispatcher.describe(error);
      throw new ToolFailureException(new ToolFailure(PanelTool.REFUSED.includes(info.name) ? ToolFailureCode.Refused : ToolFailureCode.Unavailable,
        info.message, Resources.formatQualifiedName(this.moduleId, info.name)));
    }
  }
}
