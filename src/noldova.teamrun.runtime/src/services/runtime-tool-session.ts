/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IToolCallOptions,
  PermissionDecision,
  type PermissionRecord,
  type ToolContent,
  ToolContentKind,
  type ToolDescriptor,
  ToolFailure,
  type ToolResult,
  type ToolSession
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { type ITimer, type ITurnToolSession, NodeTimer, ToolCallRecord } from "@noldova/teamrun.core";
import { McpServer, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { ServedCalls } from "./served-calls.js";

export class RuntimeToolSession implements ITurnToolSession {
  private readonly session: ToolSession;
  private readonly openPage: ((signal: AbortSignal) => Promise<void>) | null;
  private readonly timer: ITimer;
  private readonly record: (call: ToolCallRecord) => void;
  private readonly calls: ServedCalls;

  public constructor(session: ToolSession, openPage: ((signal: AbortSignal) => Promise<void>) | null = null, timer: ITimer = new NodeTimer(),
    record: (call: ToolCallRecord) => void = () => undefined, calls: ServedCalls = new ServedCalls()) {
    this.session = session;
    this.openPage = openPage;
    this.timer = timer;
    this.record = record;
    this.calls = calls;
  }

  public get id(): string {
    return this.session.id;
  }

  public listToolsAsync(): Promise<readonly JsonObject[]> {
    return Promise.resolve(this.session.listTools().filter(t => RuntimeToolSession.isServed(t.name)).map(t => RuntimeToolSession.describe(t)));
  }

  public async callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    if (!RuntimeToolSession.isServed(name))
      return McpServer.toolError(ProtocolResources.formatMcpToolFailure(Resources.refusedFailure, null, Resources.formatNotTeamRunTool(name)));

    const callId = this.calls.open(name, input);
    const result = await this.callAgainOnOpenPageAsync(name, input, signal, callId).finally(() => this.calls.close(callId));
    if (Resources.browserTools.includes(name))
      this.record(RuntimeToolSession.recordOf(name, input, result));
    return result.isFailure ? RuntimeToolSession.fail(result) : RuntimeToolSession.answer(name, result);
  }

  public end(): void {
    this.session.end();
  }

  private async callAgainOnOpenPageAsync(name: string, input: JsonObject, signal: AbortSignal, callId: string): Promise<ToolResult | ToolFailure> {
    const result = await this.session.callAsync(name, input, RuntimeToolSession.optionsOf(signal, callId));
    if (!RuntimeToolSession.isPageClosed(result) || Object.isNull(this.openPage))
      return result;
    const ends = this.timer.now() + Math.max(0, ...this.session.listTools().filter(t => t.name === name).map(t => t.deadline.default));
    try {
      await this.openPage(signal);
    }
    catch (error) {
      return new ToolFailure(result.code, Resources.formatPageNotOpened(result.message, error instanceof Error ? error.message : String(error)),
        result.moduleCode, result.content);
    }
    return this.callOnceThePageShowsAsync(name, input, signal, callId, ends);
  }

  private async callOnceThePageShowsAsync(name: string, input: JsonObject, signal: AbortSignal, callId: string, ends: number): Promise<ToolResult | ToolFailure> {
    const result = await this.session.callAsync(name, input, RuntimeToolSession.optionsOf(signal, callId));
    if (!RuntimeToolSession.isPageClosed(result) || this.timer.now() + Resources.pageShowStep > ends)
      return result;
    try {
      await this.timer.delayAsync(Resources.pageShowStep, signal);
    }
    catch {
      return result;
    }
    return this.callOnceThePageShowsAsync(name, input, signal, callId, ends);
  }

  private static optionsOf(signal: AbortSignal, callId: string): IToolCallOptions {
    const options: IToolCallOptions & { readonly callId: string } = { signal, callId };
    return options;
  }

  private static isPageClosed(result: ToolResult | ToolFailure): result is ToolFailure {
    return result.isFailure && result.moduleCode === Resources.browserViewClosedCode;
  }

  private static isServed(name: string): boolean {
    return name.startsWith(Resources.toolPrefix) || [...Resources.terminalTools, ...Resources.computerUseTools, ...Resources.browserTools, ...Resources.gitTools]
      .includes(name);
  }

  private static describe(tool: ToolDescriptor): JsonObject {
    return {
      name: tool.name,
      ...Object.isNull(tool.title) ? {} : { title: tool.title },
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...Object.isNull(tool.outputSchema) || !RuntimeToolSession.servesFields(tool.name) ? {} : { outputSchema: tool.outputSchema },
      annotations: {
        readOnlyHint: tool.hints.isReadOnly === true,
        destructiveHint: tool.hints.isDestructive === true,
        openWorldHint: tool.hints.isOpenWorld === true
      }
    };
  }

  private static answer(name: string, result: ToolResult): JsonObject {
    const content = result.content.length === 0 && !Object.isNull(result.structured)
      ? [{ type: ProtocolResources.mcpTextType, text: JSON.stringify(result.structured) }]
      : result.content.map(t => RuntimeToolSession.contentOf(t));
    return {
      content,
      ...Object.isNull(result.structured) || !RuntimeToolSession.servesFields(name) ? {} : { structuredContent: result.structured },
      isError: false
    };
  }

  private static recordOf(name: string, input: JsonObject, result: ToolResult | ToolFailure): ToolCallRecord {
    const [image] = result.content.flatMap(t => Object.isNull(t.mimeType) ? [] : [{ data: t.value, mediaType: t.mimeType }]);
    const fields = result.isFailure
      ? { [ProtocolResources.failureField]: { [ProtocolResources.failureCodeField]: result.code, [ProtocolResources.failureModuleCodeField]: result.moduleCode } }
      : result.structured ?? {};
    const decided = result.requests.find(t => !RuntimeToolSession.isAllowed(t)) ?? result.requests.at(-1);
    const permission = Object.isUndefined(decided) ? null : { id: decided.id, risk: decided.risk, decision: decided.decision, isRemembered: decided.isRemembered };
    return new ToolCallRecord(name, input, fields, image ?? null, permission);
  }

  private static isAllowed(request: PermissionRecord): boolean {
    return request.decision === PermissionDecision.AllowedOnce || request.decision === PermissionDecision.AllowedAlways;
  }

  private static servesFields(name: string): boolean {
    return [...Resources.terminalTools, ...Resources.computerUseTools].includes(name);
  }

  private static fail(failure: ToolFailure): JsonObject {
    const text = ProtocolResources.formatMcpToolFailure(failure.code, failure.moduleCode, failure.message);
    return { content: [{ type: ProtocolResources.mcpTextType, text }, ...failure.content.map(t => RuntimeToolSession.contentOf(t))], isError: true };
  }

  private static contentOf(content: ToolContent): JsonObject {
    return content.kind === ToolContentKind.Image
      ? { type: Resources.mcpImageType, data: content.value, mimeType: content.mimeType }
      : { type: ProtocolResources.mcpTextType, text: content.value };
  }
}
