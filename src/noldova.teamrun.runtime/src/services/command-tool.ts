/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ICliCommandHandler, UsageException } from "@noldova/desktop.cli";
import { FailureCode } from "@noldova/desktop.protocol";
import {
  type IToolHandler,
  MethodFailureException,
  type ToolCall,
  ToolContent,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult
} from "@noldova/desktop.runtime";
import "@noldova/context.core";

import type { TeamRunTool } from "../models/teamrun-tool.js";
import { Resources } from "../resources.js";

export class CommandTool implements IToolHandler {
  private static readonly REFUSED: readonly string[] = [FailureCode.InvalidParams, FailureCode.NotFound, FailureCode.Conflict, FailureCode.Unauthorized];

  private readonly moduleId: string;
  private readonly tool: TeamRunTool;
  private readonly handler: ICliCommandHandler;

  public constructor(moduleId: string, tool: TeamRunTool, handler: ICliCommandHandler) {
    this.moduleId = moduleId;
    this.tool = tool;
    this.handler = handler;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    try {
      const lines: string[] = [];
      const result = await this.handler.handleAsync(this.tool.toValues(call.arguments), call.signal, {
        writeLine: text => {
          lines.push(text);
        },
        askAsync: () => Promise.resolve(null),
        onEvent: () => new DisposableStack()
      });
      return new ToolResult([ToolContent.fromText([...lines, result.text].join("\n"), Resources.formatToolOrigin(this.tool.descriptor.name))]);
    }
    catch (error) {
      throw new ToolFailureException(this.toFailure(error));
    }
  }

  private toFailure(error: unknown): ToolFailure {
    if (error instanceof MethodFailureException) {
      const code = CommandTool.REFUSED.includes(error.failure.code) ? ToolFailureCode.Refused : ToolFailureCode.Unavailable;
      return new ToolFailure(code, error.failure.message, Resources.formatQualifiedName(this.moduleId, error.failure.code));
    }

    return new ToolFailure(error instanceof UsageException ? ToolFailureCode.Refused : ToolFailureCode.Unavailable,
      error instanceof Error ? error.message : String(error));
  }
}
