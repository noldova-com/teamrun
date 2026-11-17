/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";

export class RecordingSdkTransport implements Pick<StreamableHTTPServerTransport, "onmessage" | "onclose" | "start" | "send" | "close"> {
  public readonly sent: JSONRPCMessage[] = [];
  public starts: number = 0;
  public closes: number = 0;

  public onmessage: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined = undefined;
  public onclose: (() => void) | undefined = undefined;

  public start(): Promise<void> {
    this.starts++;
    return Promise.resolve();
  }

  public send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  public close(): Promise<void> {
    this.closes++;
    return Promise.resolve();
  }
}
