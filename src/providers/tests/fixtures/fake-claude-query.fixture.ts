/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccountInfo, ModelInfo, Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/teamrun-foundation-core";
import type { IClaudeQuery } from "@noldova/teamrun-providers";

import { FailureStep } from "./failure-step.fixture.js";
import { ToolAskStep } from "./tool-ask-step.fixture.js";
import { WaitForInterruptStep } from "./wait-for-interrupt-step.fixture.js";

export type FakeQueryStep = SDKMessage | ToolAskStep | FailureStep | WaitForInterruptStep;

export class FakeClaudeQuery implements IClaudeQuery {
  public readonly steps: readonly FakeQueryStep[];
  public options: Options | null = null;
  public accountInfoResult: AccountInfo = {};
  public accountInfoFailure: Error | null = null;
  public models: ModelInfo[] = ["fable", "opus", "sonnet", "haiku"].map(value => ({ value, displayName: value, description: "Fixture model", supportedEffortLevels: ["low", "medium", "high"] }));
  public modelsFailure: Error | null = null;
  public modelsHang: boolean = false;
  public interruptFailure: Error | null = null;
  public closeFailure: Error | null = null;
  public readonly stderrLines: string[] = [];
  public interruptCount: number = 0;
  public closeCount: number = 0;
  private readonly interrupted: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(steps: readonly FakeQueryStep[]) {
    this.steps = steps;
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<SDKMessage> {
    for (const line of this.stderrLines)
      this.options?.stderr?.(line);
    for (const step of this.steps) {
      if (step instanceof ToolAskStep) {
        step.result = await this.askTool(step);
        continue;
      }
      if (step instanceof FailureStep)
        throw step.error;
      if (step instanceof WaitForInterruptStep) {
        await this.waitForInterruptOrAbort();
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
    return Promise.resolve(undefined);
  }

  public accountInfo(): Promise<AccountInfo> {
    if (!Object.isNull(this.accountInfoFailure))
      return Promise.reject(this.accountInfoFailure);

    return Promise.resolve(this.accountInfoResult);
  }

  public close(): void {
    this.closeCount += 1;
    if (!Object.isNull(this.closeFailure))
      throw this.closeFailure;
  }

  public supportedModels(): Promise<ModelInfo[]> {
    if (!Object.isNull(this.modelsFailure))
      return Promise.reject(this.modelsFailure);
    return this.modelsHang ? new Promise(() => {}) : Promise.resolve(this.models);
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

    return canUseTool(step.toolName, step.input, { signal: new AbortController().signal, toolUseID: "tu-fake", requestId: "req-fake" });
  }
}
