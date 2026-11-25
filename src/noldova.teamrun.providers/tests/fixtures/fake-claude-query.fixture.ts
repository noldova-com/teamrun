/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccountInfo, McpServerConfig, McpServerStatus, McpSetServersResult, ModelInfo, Options, PermissionMode, SDKControlGetContextUsageResponse, SDKControlGetUsageResponse, SDKMessage, SDKUserMessage, SlashCommand }
  from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import type { IClaudeQuery } from "@noldova/teamrun.providers";

import { FailureStep } from "./failure-step.fixture.js";
import { GateStep } from "./gate-step.fixture.js";
import { StampedStep } from "./stamped-step.fixture.js";
import { ToolAskStep } from "./tool-ask-step.fixture.js";
import { WaitForCloseStep } from "./wait-for-close-step.fixture.js";
import { WaitForInputStep } from "./wait-for-input-step.fixture.js";
import { WaitForStopStep } from "./wait-for-stop-step.fixture.js";
import { WaitForInterruptStep } from "./wait-for-interrupt-step.fixture.js";

export type FakeQueryStep = SDKMessage | ToolAskStep | FailureStep | WaitForInterruptStep | WaitForStopStep | WaitForInputStep | WaitForCloseStep | StampedStep | GateStep;

export class FakeClaudeQuery implements IClaudeQuery {
  public readonly steps: readonly FakeQueryStep[];
  public options: Options | null = null;
  public prompt: string | AsyncIterable<SDKUserMessage> | null = null;
  public readonly inputs: SDKUserMessage[] = [];
  public accountInfoResult: AccountInfo = {};
  public accountInfoFailure: Error | null = null;
  public accountInfoHang: boolean = false;
  public accountInfoReads: number = 0;
  public models: ModelInfo[] = ["fable", "opus", "sonnet", "haiku"].map(value => ({ value, displayName: value, description: "Fixture model", supportedEffortLevels: ["low", "medium", "high"] }));
  public modelsFailure: Error | null = null;
  public modelsHang: boolean = false;
  public commands: SlashCommand[] = [];
  public commandsFailure: Error | null = null;
  public commandsHang: boolean = false;
  public commandsPending: PromiseWithResolvers<SlashCommand[]> | null = null;
  public commandReads: number = 0;
  public settingsResult: { applied?: { effort?: unknown } } = {};
  public settingsFailure: Error | null = null;
  public settingsThrow: Error | null = null;
  public settingsCount: number = 0;
  public contextUsageResult: unknown = {};
  public contextUsageFailure: Error | null = null;
  public contextUsageHang: boolean = false;
  public contextUsageDetail: string | undefined = undefined;
  public planUsageResult: unknown = {};
  public planUsageFailure: Error | null = null;
  public planUsageHang: boolean = false;
  public interruptFailure: Error | null = null;
  public interruptHang: boolean = false;
  public closeFailure: Error | null = null;
  public stopTaskFailure: Error | null = null;
  public stopTaskGate: GateStep | null = null;
  public flagSettingsFailure: Error | null = null;
  public readonly flagSettings: { env?: Record<string, string> }[] = [];
  public readonly permissionModes: PermissionMode[] = [];
  public readonly permissionModeFailures: Map<PermissionMode, Error> = new Map();
  public readonly permissionModeHangs: Set<PermissionMode> = new Set();
  public readonly modesAtInputs: string[] = [];
  public serversFailure: Error | null = null;
  public serversErrors: Record<string, string> = {};
  public readonly servers: Record<string, McpServerConfig>[] = [];
  public serverStatuses: McpServerStatus[] = [];
  public readonly laterServerStatuses: McpServerStatus[][] = [];
  public serverStatusReads: number = 0;
  public serverStatusFailure: Error | null = null;
  public serverStatusGate: GateStep | null = null;
  public serverStatusAnswers: number = 0;
  public readonly stoppedTasks: string[] = [];
  public readonly stderrLines: string[] = [];
  public interruptCount: number = 0;
  public closeCount: number = 0;
  private readonly interrupted: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly stopped: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly closed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private inputChanged: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private answered: number = 0;

  public constructor(steps: readonly FakeQueryStep[]) {
    this.steps = steps;
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<SDKMessage> {
    for (const line of this.stderrLines)
      this.options?.stderr?.(line);
    if (!Object.isNull(this.prompt) && !Object.isString(this.prompt))
      void this.read(this.prompt);
    for (const step of this.steps) {
      if (step instanceof WaitForInputStep) {
        while (this.inputs.length <= this.answered)
          await this.inputChanged.promise;
        this.answered += 1;
        continue;
      }
      if (step instanceof GateStep) {
        await step.opened;
        continue;
      }
      if (step instanceof WaitForCloseStep) {
        await this.waitForCloseOrAbort();
        continue;
      }
      if (step instanceof StampedStep) {
        const uuid = this.inputs[this.answered - 1]?.uuid ?? this.inputs.at(-1)?.uuid;
        yield Object.isUndefined(uuid) ? step.message : { ...step.message, user_message_uuid: uuid };
        continue;
      }
      if (step instanceof ToolAskStep) {
        const asking = this.askTool(step).then(t => step.result = t);
        if (step.isBackground)
          step.answered = asking;
        else
          await asking;
        continue;
      }
      if (step instanceof FailureStep)
        throw step.error;
      if (step instanceof WaitForInterruptStep) {
        await this.waitForInterruptOrAbort();
        continue;
      }
      if (step instanceof WaitForStopStep) {
        await this.stopped.promise;
        continue;
      }

      yield step;
    }
  }

  public interrupt(): Promise<unknown> {
    if (!Object.isNull(this.interruptFailure))
      return Promise.reject(this.interruptFailure);

    this.interruptCount += 1;
    this.interrupted.resolve();
    return this.interruptHang ? new Promise<unknown>(() => undefined) : Promise.resolve(undefined);
  }

  public stopTask(taskId: string): Promise<void> {
    if (!Object.isNull(this.stopTaskFailure))
      return Promise.reject(this.stopTaskFailure);

    this.stoppedTasks.push(taskId);
    this.stopped.resolve();
    return this.stopTaskGate?.opened ?? Promise.resolve();
  }

  public applyFlagSettings(settings: { env?: Record<string, string> }): Promise<void> {
    if (!Object.isNull(this.flagSettingsFailure))
      return Promise.reject(this.flagSettingsFailure);

    this.flagSettings.push(settings);
    return Promise.resolve();
  }

  public setPermissionMode(mode: PermissionMode): Promise<void> {
    const failure = this.permissionModeFailures.get(mode);
    if (!Object.isUndefined(failure))
      return Promise.reject(failure);
    if (this.permissionModeHangs.has(mode))
      return new Promise<void>(() => undefined);
    this.permissionModes.push(mode);
    return Promise.resolve();
  }

  public setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult> {
    if (!Object.isNull(this.serversFailure))
      return Promise.reject(this.serversFailure);

    this.servers.push(servers);
    return Promise.resolve({ added: Object.keys(servers).filter(t => !Object.hasOwn(this.serversErrors, t)), removed: [], errors: this.serversErrors });
  }

  public async mcpServerStatus(): Promise<McpServerStatus[]> {
    this.serverStatusReads += 1;
    await this.serverStatusGate?.opened;
    const statuses = this.serverStatuses;
    this.serverStatuses = this.laterServerStatuses.shift() ?? statuses;
    this.serverStatusAnswers += 1;
    if (!Object.isNull(this.serverStatusFailure))
      throw this.serverStatusFailure;
    return statuses;
  }

  public accountInfo(): Promise<AccountInfo> {
    this.accountInfoReads++;
    if (!Object.isNull(this.accountInfoFailure))
      return Promise.reject(this.accountInfoFailure);

    return this.accountInfoHang ? new Promise(() => {}) : Promise.resolve(this.accountInfoResult);
  }

  public close(): void {
    this.closeCount += 1;
    this.closed.resolve();
    if (!Object.isNull(this.closeFailure))
      throw this.closeFailure;
  }

  public supportedModels(): Promise<ModelInfo[]> {
    if (!Object.isNull(this.modelsFailure))
      return Promise.reject(this.modelsFailure);
    return this.modelsHang ? new Promise(() => {}) : Promise.resolve(this.models);
  }

  public supportedCommands(): Promise<SlashCommand[]> {
    this.commandReads += 1;
    if (!Object.isNull(this.commandsFailure))
      return Promise.reject(this.commandsFailure);
    if (!Object.isNull(this.commandsPending))
      return this.commandsPending.promise;
    return this.commandsHang ? new Promise(() => {}) : Promise.resolve(this.commands);
  }

  public getContextUsage(options?: { detail?: "summary" | "full" }): Promise<SDKControlGetContextUsageResponse> {
    this.contextUsageDetail = options?.detail;
    if (!Object.isNull(this.contextUsageFailure))
      return Promise.reject(this.contextUsageFailure);
    return this.contextUsageHang ? new Promise(() => {}) : Promise.resolve(this.contextUsageResult as SDKControlGetContextUsageResponse);
  }

  public getSettings(): Promise<{ applied?: { effort?: unknown } }> {
    this.settingsCount += 1;
    if (!Object.isNull(this.settingsThrow))
      throw this.settingsThrow;
    return Object.isNull(this.settingsFailure) ? Promise.resolve(this.settingsResult) : Promise.reject(this.settingsFailure);
  }

  public usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET(): Promise<SDKControlGetUsageResponse> {
    if (!Object.isNull(this.planUsageFailure))
      return Promise.reject(this.planUsageFailure);
    return this.planUsageHang ? new Promise(() => {}) : Promise.resolve(this.planUsageResult as SDKControlGetUsageResponse);
  }

  private async read(prompt: AsyncIterable<SDKUserMessage>): Promise<void> {
    for await (const message of prompt) {
      this.modesAtInputs.push(this.permissionModes.join(","));
      this.inputs.push(message);
      const changed = this.inputChanged;
      this.inputChanged = Promise.withResolvers<void>();
      changed.resolve();
    }
  }

  private waitForCloseOrAbort(): Promise<void> {
    const signal = this.options?.abortController?.signal;
    const aborted = new Promise<void>(resolve => signal?.addEventListener("abort", () => resolve(), { once: true }));
    return Promise.race([this.closed.promise, aborted]);
  }

  private waitForInterruptOrAbort(): Promise<void> {
    const signal = this.options?.abortController?.signal;
    if (Object.isUndefined(signal))
      return this.interrupted.promise;

    const aborted = new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted by the controller")), { once: true }));
    return Promise.race([this.interrupted.promise, aborted]);
  }

  private askTool(step: ToolAskStep): ReturnType<NonNullable<Options["canUseTool"]>> {
    const canUseTool = this.options?.canUseTool;
    if (Object.isUndefined(canUseTool))
      throw new Error("The fake query has no options with canUseTool.");

    return canUseTool(step.toolName, step.input, { signal: step.controller.signal, toolUseID: step.toolUseId, requestId: "req-fake",
      ...step.agentId === undefined ? {} : { agentID: step.agentId } });
  }
}
