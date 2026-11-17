/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccountInfo, McpServerConfig, McpServerStatus, McpSetServersResult, ModelInfo, PermissionMode, SDKControlGetContextUsageResponse,
  SDKControlGetUsageResponse, SDKMessage, SlashCommand } from "@anthropic-ai/claude-agent-sdk";

export interface IClaudeQuery extends AsyncIterable<SDKMessage> {
  interrupt(): Promise<unknown>;
  accountInfo(): Promise<AccountInfo>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedCommands(): Promise<SlashCommand[]>;
  getContextUsage(options?: { detail?: "summary" | "full" }): Promise<SDKControlGetContextUsageResponse>;
  getSettings(): Promise<{ applied?: { effort?: unknown } }>;
  usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET(options?: { skipBehaviors?: boolean }): Promise<SDKControlGetUsageResponse>;
  stopTask(taskId: string): Promise<void>;
  applyFlagSettings(settings: { env?: Record<string, string> }): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  close(): void;
}
