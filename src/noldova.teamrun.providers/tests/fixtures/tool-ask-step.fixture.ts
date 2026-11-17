/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";

export class ToolAskStep {
  public readonly toolName: string;
  public readonly input: Record<string, unknown>;
  public readonly toolUseId: string;
  public readonly agentId: string | undefined;
  public readonly isBackground: boolean;
  public readonly controller: AbortController = new AbortController();
  public result: PermissionResult | null = null;
  public answered: Promise<unknown> = Promise.resolve();

  public constructor(toolName: string, input: Record<string, unknown>, toolUseId: string = "tu-fake", agentId?: string, isBackground: boolean = false) {
    this.toolName = toolName;
    this.input = input;
    this.toolUseId = toolUseId;
    this.agentId = agentId;
    this.isBackground = isBackground;
  }
}
