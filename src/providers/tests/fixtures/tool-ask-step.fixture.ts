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
  public result: PermissionResult | null = null;

  public constructor(toolName: string, input: Record<string, unknown>) {
    this.toolName = toolName;
    this.input = input;
  }
}
