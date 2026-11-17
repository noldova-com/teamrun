/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonException, JsonReader, type JsonValue } from "@noldova/context.json";

import { McpRequestException } from "../exceptions/mcp-request.exception.js";
import type { IMcpToolHost } from "../interfaces/i-mcp-tool-host.js";
import type { IMcpTransport } from "../interfaces/i-mcp-transport.js";
import { Resources } from "../resources.js";

export class McpServer {
  private readonly host: IMcpToolHost;
  private readonly version: string;
  private readonly instructions: string | null;
  private readonly calls: { key: string; abort: AbortController }[] = [];
  private transport: IMcpTransport | null = null;

  public constructor(host: IMcpToolHost, version: string, instructions: string | null = null) {
    this.host = host;
    this.version = version;
    this.instructions = instructions;
  }

  public static toolError(text: string): JsonObject {
    return {
      [Resources.contentField]: [{ [Resources.typeField]: Resources.mcpTextType, [Resources.textField]: text }],
      [Resources.mcpIsErrorField]: true
    };
  }

  public async connect(transport: IMcpTransport): Promise<void> {
    this.transport = transport;
    transport.onmessage = message => this.receive(message);
    transport.onclose = () => this.abortAll();
    await transport.start();
  }

  public async close(): Promise<void> {
    this.abortAll();
    await this.transport?.close();
  }

  private receive(message: unknown): void {
    const value = McpServer.asObject(message);
    if (!Object.isNull(value) && (Object.hasOwn(value, Resources.mcpResultField) || Object.hasOwn(value, Resources.mcpErrorField)))
      return;

    const method = value?.[Resources.methodField];
    const id = McpServer.idOf(value);
    if (Object.isNull(value) || value[Resources.mcpVersionField] !== Resources.mcpJsonRpcVersion || typeof method !== "string"
      || (Object.hasOwn(value, Resources.idField) && Object.isNull(id))) {
      void this.send(McpServer.failure(id, Resources.mcpInvalidRequestCode, Resources.mcpInvalidRequest));
      return;
    }

    const params = value[Resources.mcpParamsField] ?? null;
    if (Object.isNull(id))
      this.notice(method, params);
    else
      void this.handle(id, method, params);
  }

  private notice(method: string, params: JsonValue): void {
    if (method !== Resources.mcpCancelledNotification)
      return;

    const id = McpServer.idOf(McpServer.asObject(params), Resources.mcpRequestIdField);
    if (!Object.isNull(id))
      for (const call of this.calls.filter(t => t.key === JSON.stringify(id)))
        call.abort.abort();
  }

  private async handle(id: string | number, method: string, params: JsonValue): Promise<void> {
    const key = JSON.stringify(id);
    const abort = new AbortController();
    const call = { key, abort };
    this.calls.push(call);
    try {
      const result = await this.answer(method, params, abort.signal);
      if (!abort.signal.aborted)
        await this.send({ [Resources.mcpVersionField]: Resources.mcpJsonRpcVersion, [Resources.idField]: id, [Resources.mcpResultField]: result });
    }
    catch (error) {
      if (!abort.signal.aborted)
        await this.send(McpServer.failure(id, ...McpServer.describe(error)));
    }
    finally {
      this.calls.splice(this.calls.indexOf(call), 1);
    }
  }

  private async answer(method: string, params: JsonValue, signal: AbortSignal): Promise<JsonObject> {
    switch (method) {
      case Resources.mcpInitializeMethod:
        return this.initialize(params);
      case Resources.mcpPingMethod:
        return {};
      case Resources.mcpToolsListMethod:
        return { [Resources.mcpToolsField]: [...await this.host.listToolsAsync(signal)] };
      case Resources.mcpToolsCallMethod:
        return this.call(params, signal);
      default:
        throw new McpRequestException(Resources.mcpUnknownMethodCode, Resources.formatMcpUnknownMethod(method));
    }
  }

  private initialize(params: JsonValue): JsonObject {
    const requested = JsonReader.fromValue(params).readOptionalString(Resources.mcpProtocolVersionField);
    const version = Resources.mcpProtocolVersions.find(t => t === requested) ?? Resources.mcpProtocolVersions[0]!;
    return {
      [Resources.mcpProtocolVersionField]: version,
      [Resources.mcpCapabilitiesField]: { [Resources.mcpToolsField]: { [Resources.mcpListChangedField]: false } },
      [Resources.mcpServerInfoField]: { [Resources.nameField]: Resources.mcpServerName, [Resources.versionField]: this.version },
      ...Object.isNull(this.instructions) ? {} : { [Resources.mcpInstructionsField]: this.instructions }
    };
  }

  private async call(params: JsonValue, signal: AbortSignal): Promise<JsonObject> {
    const reader = JsonReader.fromValue(params);
    const name = reader.readNonBlankString(Resources.nameField);
    const input = reader.hasField(Resources.argumentsField) ? reader.readNullableObject(Resources.argumentsField)?.toJson() ?? {} : {};
    try {
      return await this.host.callToolAsync(name, input, signal);
    }
    catch (error) {
      return McpServer.toolError(error instanceof Error ? error.message : String(error));
    }
  }

  private abortAll(): void {
    for (const call of this.calls)
      call.abort.abort();
  }

  private async send(message: JsonObject): Promise<void> {
    await this.transport?.send(message).catch(() => undefined);
  }

  private static describe(error: unknown): [number, string] {
    if (error instanceof McpRequestException)
      return [error.code, error.message];
    if (error instanceof JsonException)
      return [Resources.mcpInvalidParamsCode, error.message];

    return [Resources.mcpInternalErrorCode, error instanceof Error ? error.message : String(error)];
  }

  private static failure(id: string | number | null, code: number, message: string): JsonObject {
    return {
      [Resources.mcpVersionField]: Resources.mcpJsonRpcVersion,
      [Resources.idField]: id,
      [Resources.mcpErrorField]: { [Resources.mcpCodeField]: code, [Resources.messageField]: message }
    };
  }

  private static asObject(value: unknown): JsonObject | null {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value) ? value as JsonObject : null;
  }

  private static idOf(value: JsonObject | null, field: string = Resources.idField): string | number | null {
    const id = value?.[field];
    return typeof id === "string" || (typeof id === "number" && Number.isSafeInteger(id)) ? id : null;
  }
}
