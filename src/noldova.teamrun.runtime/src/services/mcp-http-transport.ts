/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import type { JsonObject } from "@noldova/context.json";
import type { IMcpTransport } from "@noldova/teamrun.protocol";

export class McpHttpTransport implements IMcpTransport {
  private readonly transport: Pick<StreamableHTTPServerTransport, "onmessage" | "onclose" | "start" | "send" | "close">;

  public onmessage?: ((message: unknown) => void) | undefined;
  public onclose?: (() => void) | undefined;

  public constructor(transport: Pick<StreamableHTTPServerTransport, "onmessage" | "onclose" | "start" | "send" | "close">) {
    this.transport = transport;
    transport.onmessage = message => this.onmessage?.(message);
    transport.onclose = () => this.onclose?.();
  }

  public start(): Promise<void> {
    return this.transport.start();
  }

  public async send(message: JsonObject): Promise<void> {
    await this.transport.send(JSONRPCMessageSchema.parse(message));
  }

  public close(): Promise<void> {
    return this.transport.close();
  }
}
