/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { McpServer } from "@noldova/teamrun.protocol";

import { FakeMcpToolHost } from "../fixtures/fake-mcp-tool-host.fixture.js";
import { RecordingMcpTransport } from "../fixtures/recording-mcp-transport.fixture.js";

@TestClass
export class McpServerTests {
  @TestMethod
  public async initializesWithTheClientsVersionTheToolsCapabilityAndItsInstructions(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1.2.3", "Use teamrun_list_chats.").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {} } });

    Assert.isTrue(transport.started);
    Assert.areEqual(JSON.stringify({
      jsonrpc: "2.0", id: 1, result: {
        protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "teamrun", version: "1.2.3" },
        instructions: "Use teamrun_list_chats."
      }
    }), JSON.stringify(await transport.next()));
  }

  @TestMethod
  public async answersAnUnknownVersionWithItsLatestAndGivesNoInstructionsWithoutThem(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1.2.3").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: "a", method: "initialize", params: { protocolVersion: "1999-01-01" } });

    const result = (await transport.next())["result"] as Record<string, unknown>;
    Assert.areEqual("2025-11-25", result["protocolVersion"]);
    Assert.isFalse(Object.hasOwn(result, "instructions"));
  }

  @TestMethod
  public async answersPingAndListsTheHostsTools(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "ping" });
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor: "ignored" } });

    Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), JSON.stringify(await transport.answerTo(1)));
    Assert.areEqual(JSON.stringify({
      jsonrpc: "2.0", id: 2, result: { tools: [{ name: "teamrun_list_chats", description: "Lists the chats.", inputSchema: { type: "object" } }] }
    }), JSON.stringify(await transport.answerTo(2)));
  }

  @TestMethod
  public async callsTheHostsToolWithItsArgumentsOrNone(): Promise<void> {
    const host = new FakeMcpToolHost();
    const transport = new RecordingMcpTransport();
    await new McpServer(host, "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "teamrun_list_chats", arguments: { project_id: "p1" } } });
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "teamrun_list_chats" } });
    transport.deliver({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "teamrun_list_chats", arguments: null } });

    Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "{\"project_id\":\"p1\"}" }], isError: false } }),
      JSON.stringify(await transport.answerTo(1)));
    await transport.next(3);
    Assert.areEqual(JSON.stringify([{ project_id: "p1" }, {}, {}]), JSON.stringify(host.calls.map(t => t.input)));
  }

  @TestMethod
  public async turnsAHostsCallFailureIntoAToolError(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: FakeMcpToolHost.brokenTool, arguments: {} } });
    transport.deliver({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: FakeMcpToolHost.throwingTool } });

    Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 4, result: { content: [{ type: "text", text: "The runtime stopped." }], isError: true } }),
      JSON.stringify(await transport.answerTo(4)));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "The host broke." }], isError: true }), JSON.stringify((await transport.answerTo(5))["result"]));
  }

  @TestMethod
  public async answersJsonRpcErrorsForUnknownMethodsBadParamsAndAFailedListing(): Promise<void> {
    const host = new FakeMcpToolHost();
    host.listFailure = new Error("No running turn.");
    const transport = new RecordingMcpTransport();
    await new McpServer(host, "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "resources/list" });
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { arguments: {} } });
    transport.deliver({ jsonrpc: "2.0", id: 3, method: "tools/list" });

    Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "TeamRun's MCP server has no method resources/list." } }),
      JSON.stringify(await transport.answerTo(1)));
    const invalid = (await transport.answerTo(2))["error"] as Record<string, unknown>;
    Assert.areEqual(-32602, invalid["code"]);
    Assert.isTrue(String(invalid["message"]).includes("name"));
    Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: 3, error: { code: -32603, message: "No running turn." } }), JSON.stringify(await transport.answerTo(3)));
    Assert.areEqual(0, host.calls.length);
  }

  @TestMethod
  public async describesAListingFailureThatIsNotAnError(): Promise<void> {
    const host = new FakeMcpToolHost();
    host.listFailure = "The runtime went away.";
    const transport = new RecordingMcpTransport();
    await new McpServer(host, "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    Assert.areEqual(JSON.stringify({ code: -32603, message: "The runtime went away." }), JSON.stringify((await transport.next())["error"]));
  }

  @TestMethod
  public async refusesMessagesThatAreNotRequestsAndIgnoresResponsesAndOtherNotices(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 9, result: {} });
    transport.deliver({ jsonrpc: "2.0", id: 9, error: { code: 1, message: "no" } });
    transport.deliver({ jsonrpc: "2.0", method: "notifications/initialized" });
    transport.deliver([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
    transport.deliver({ jsonrpc: "1.0", id: 5, method: "ping" });
    transport.deliver({ jsonrpc: "2.0", id: 1.5, method: "ping" });
    transport.deliver({ jsonrpc: "2.0", id: 6 });

    await transport.next(4);
    Assert.areEqual(JSON.stringify([null, 5, null, 6]), JSON.stringify(transport.sent.map(t => t["id"])));
    Assert.isTrue(transport.sent.every(t => (t["error"] as Record<string, unknown>)["code"] === -32600));
  }

  @TestMethod
  public async withdrawsACancelledCallWithoutAnsweringIt(): Promise<void> {
    const host = new FakeMcpToolHost();
    const transport = new RecordingMcpTransport();
    await new McpServer(host, "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: "slow", method: "tools/call", params: { name: FakeMcpToolHost.slowTool, arguments: {} } });
    transport.deliver({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "other" } });
    transport.deliver({ jsonrpc: "2.0", method: "notifications/cancelled", params: {} });
    Assert.isFalse(host.calls[0]!.signal.aborted);
    transport.deliver({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "slow", reason: "The person stopped it." } });
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "ping" });

    Assert.areEqual(2, (await transport.next())["id"]);
    Assert.isTrue(host.calls[0]!.signal.aborted);
    Assert.areEqual(1, transport.sent.length);
  }

  @TestMethod
  public async withdrawsEveryCallInFlightUnderACancelledIdADuplicateIncluded(): Promise<void> {
    const host = new FakeMcpToolHost();
    const transport = new RecordingMcpTransport();
    await new McpServer(host, "1").connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: "dup", method: "tools/call", params: { name: FakeMcpToolHost.slowTool } });
    transport.deliver({ jsonrpc: "2.0", id: "dup", method: "tools/call", params: { name: FakeMcpToolHost.slowTool } });
    transport.deliver({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "dup" } });
    transport.deliver({ jsonrpc: "2.0", id: 3, method: "ping" });

    Assert.areEqual(3, (await transport.next())["id"]);
    Assert.areEqual(2, host.calls.length);
    Assert.isTrue(host.calls.every(t => t.signal.aborted));
    Assert.areEqual(1, transport.sent.length);
  }

  @TestMethod
  public async abortsItsCallsWhenTheTransportClosesOrTheServerCloses(): Promise<void> {
    const host = new FakeMcpToolHost();
    const transport = new RecordingMcpTransport();
    const server = new McpServer(host, "1");
    await server.connect(transport);

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: FakeMcpToolHost.slowTool } });
    transport.onclose?.();
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: FakeMcpToolHost.slowTool } });
    await server.close();

    Assert.isTrue(host.calls.every(t => t.signal.aborted));
    Assert.isTrue(transport.closed);
    Assert.areEqual(0, transport.sent.length);
  }

  @TestMethod
  public async keepsServingAfterASendFails(): Promise<void> {
    const transport = new RecordingMcpTransport();
    await new McpServer(new FakeMcpToolHost(), "1").connect(transport);
    transport.failsSends = true;

    transport.deliver({ jsonrpc: "2.0", id: 1, method: "ping" });
    transport.deliver("not an object");
    await transport.until(() => transport.sendAttempts === 2);
    transport.failsSends = false;
    transport.deliver({ jsonrpc: "2.0", id: 2, method: "ping" });

    Assert.areEqual(2, (await transport.next())["id"]);
  }

  @TestMethod
  public async closesWithoutATransport(): Promise<void> {
    await new McpServer(new FakeMcpToolHost(), "1").close();
  }

  @TestMethod
  public makesAToolErrorFromText(): void {
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Denied." }], isError: true }), JSON.stringify(McpServer.toolError("Denied.")));
  }
}
