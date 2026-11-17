/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { McpHttpTransport } from "@noldova/teamrun.runtime";

import { RecordingSdkTransport } from "../fixtures/recording-sdk-transport.fixture.js";

@TestClass
export class McpHttpTransportTests {
  @TestMethod
  public async handsTheServerEachMessageAndTheCloseOnceItListensAndStartsAndClosesTheTransport(): Promise<void> {
    const sdk = new RecordingSdkTransport();
    const transport = new McpHttpTransport(sdk);
    const heard: unknown[] = [];
    let closes = 0;

    McpHttpTransportTests.receive(sdk, { jsonrpc: "2.0", method: "notifications/initialized" });
    McpHttpTransportTests.hangUp(sdk);
    transport.onmessage = t => heard.push(t);
    transport.onclose = () => closes++;
    await transport.start();
    McpHttpTransportTests.receive(sdk, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    McpHttpTransportTests.hangUp(sdk);
    await transport.close();

    Assert.areEqual(JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]), JSON.stringify(heard));
    Assert.areEqual(1, closes);
    Assert.areEqual(1, sdk.starts);
    Assert.areEqual(1, sdk.closes);
  }

  @TestMethod
  public async sendsAJsonRpcAnswerAndRejectsAMessageThatIsntJsonRpcWithoutSendingIt(): Promise<void> {
    const sdk = new RecordingSdkTransport();
    const transport = new McpHttpTransport(sdk);

    await transport.send({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
    await transport.send({ jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } });
    const refused = await transport.send({ jsonrpc: "1.0", id: 3, result: {} }).then(() => null, (error: unknown) => error);

    Assert.areEqual(JSON.stringify([{ jsonrpc: "2.0", id: 1, result: { tools: [] } }, { jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } }]),
      JSON.stringify(sdk.sent));
    Assert.isTrue(refused instanceof Error);
  }

  private static receive(sdk: RecordingSdkTransport, message: JSONRPCMessage): void {
    const handler = sdk.onmessage;
    Assert.isDefined(handler);
    handler(message);
  }

  private static hangUp(sdk: RecordingSdkTransport): void {
    const handler = sdk.onclose;
    Assert.isDefined(handler);
    handler();
  }
}
