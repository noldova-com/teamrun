/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, type OutgoingHttpHeaders, request } from "node:http";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ILog } from "@noldova/teamrun.core";
import { McpHttpEndpoint, RuntimePartException } from "@noldova/teamrun.runtime";

import { FakeMcpEndpointHost } from "../fixtures/fake-mcp-endpoint-host.fixture.js";
import { PipeAddressServer } from "../fixtures/pipe-address-server.fixture.js";
import { RefusingServer } from "../fixtures/refusing-server.fixture.js";

type Answer = { readonly status: number; readonly headers: Readonly<Record<string, string | string[] | undefined>>; readonly body: string };

@TestClass
export class McpHttpEndpointTests {
  @TestMethod
  public async servesTheTokensMemberTheToolsOverStreamableHttpWithJsonAnswers(): Promise<void> {
    const endpoint = new McpHttpEndpoint(new RecordingLines());
    const host = new FakeMcpEndpointHost();
    try {
      const url = await endpoint.listenAsync();
      endpoint.serve(host);

      const initialized = await McpHttpEndpointTests.post(url, { jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } } });
      const notified = await McpHttpEndpointTests.post(url, { jsonrpc: "2.0", method: "notifications/initialized" });
      const listed = await McpHttpEndpointTests.post(url, { jsonrpc: "2.0", id: 2, method: "tools/list" });
      const called = await McpHttpEndpointTests.post(url, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "teamrun_open_panel", arguments: { panel: "teammates" } } });

      Assert.areEqual(200, initialized.status);
      Assert.areEqual("teamrun", JsonReader.parse(initialized.body).readObject("result").readObject("serverInfo").readString("name"));
      Assert.areEqual(202, notified.status);
      Assert.areEqual(JSON.stringify({ result: { tools: [{ name: "teamrun_open_panel", description: "Opens a panel", inputSchema: { type: "object" } }] }, jsonrpc: "2.0", id: 2 }),
        JSON.stringify(McpHttpEndpointTests.ordered(listed.body)));
      Assert.areEqual(JSON.stringify({ result: { content: [{ type: "text", text: "called teamrun_open_panel" }], isError: false }, jsonrpc: "2.0", id: 3 }),
        JSON.stringify(McpHttpEndpointTests.ordered(called.body)));
      Assert.areEqual("session-token", host.listed.join(","));
      Assert.areEqual(JSON.stringify([{ token: "session-token", name: "teamrun_open_panel", input: { panel: "teammates" } }]), JSON.stringify(host.calls));
      Assert.areEqual(4, host.checked.length);
    }
    finally {
      await endpoint.closeAsync();
    }
  }

  @TestMethod
  public async refusesAMissingMalformedOrRefusedTokenAndEveryTokenBeforeItServesWith401(): Promise<void> {
    const endpoint = new McpHttpEndpoint(new RecordingLines());
    const host = new FakeMcpEndpointHost();
    try {
      const url = await endpoint.listenAsync();
      const early = await McpHttpEndpointTests.send(url, "POST", { authorization: "Bearer session-token" });
      endpoint.serve(host);

      const answers = [
        await McpHttpEndpointTests.send(url, "POST", {}),
        await McpHttpEndpointTests.send(url, "POST", { authorization: "Basic c2Vzc2lvbi10b2tlbg==" }),
        await McpHttpEndpointTests.send(url, "POST", { authorization: "Bearer" }),
        await McpHttpEndpointTests.send(url, "POST", { authorization: "Bearer session-token extra" }),
        await McpHttpEndpointTests.send(url, "POST", { authorization: "Bearer expired-or-revoked" })
      ];

      for (const answer of [early, ...answers]) {
        Assert.areEqual(401, answer.status);
        Assert.areEqual("Bearer", answer.headers["www-authenticate"]);
        Assert.areEqual("", answer.body);
      }
      Assert.areEqual("expired-or-revoked", host.checked.join(","));
      Assert.areEqual(0, host.listed.length + host.calls.length);
    }
    finally {
      await endpoint.closeAsync();
    }
  }

  @TestMethod
  public async refusesAnotherHostOrAnyOriginWith403AnotherPathWith404AndAMethodButPostWith405(): Promise<void> {
    const endpoint = new McpHttpEndpoint(new RecordingLines());
    const host = new FakeMcpEndpointHost();
    try {
      const url = await endpoint.listenAsync();
      const port = new URL(url).port;
      endpoint.serve(host);
      const token = { authorization: "Bearer session-token" };

      const otherHost = await McpHttpEndpointTests.send(url, "POST", { ...token, host: `localhost:${port}` });
      const otherPort = await McpHttpEndpointTests.send(url, "POST", { ...token, host: "127.0.0.1:1" });
      const origin = await McpHttpEndpointTests.send(url, "POST", { ...token, origin: "http://127.0.0.1" });
      const path = await McpHttpEndpointTests.send(`http://127.0.0.1:${port}/other`, "POST", token);
      const get = await McpHttpEndpointTests.send(url, "GET", token);
      const remove = await McpHttpEndpointTests.send(url, "DELETE", token);

      Assert.areEqual("403,403,403,404,405,405", [otherHost, otherPort, origin, path, get, remove].map(t => t.status).join(","));
      Assert.areEqual("POST", get.headers["allow"]);
      Assert.areEqual("POST", remove.headers["allow"]);
      Assert.areEqual("session-token,session-token", host.checked.join(","));
    }
    finally {
      await endpoint.closeAsync();
    }
  }

  @TestMethod
  public async listensOnlyOnTheLoopbackAddressOnAPortTheSystemPicksUntilItCloses(): Promise<void> {
    const first = new McpHttpEndpoint(new RecordingLines());
    const second = new McpHttpEndpoint(new RecordingLines());
    await new McpHttpEndpoint(new RecordingLines()).closeAsync();

    const firstUrl = await first.listenAsync();
    const secondUrl = await second.listenAsync();
    await first.closeAsync();
    await first.closeAsync();
    const closed = await McpHttpEndpointTests.failure(firstUrl);
    await second.closeAsync();

    Assert.isTrue(/^http:\/\/127\.0\.0\.1:[1-9]\d*\/mcp$/.test(firstUrl), firstUrl);
    Assert.isTrue(/^http:\/\/127\.0\.0\.1:[1-9]\d*\/mcp$/.test(secondUrl), secondUrl);
    Assert.areNotEqual(firstUrl, secondUrl);
    Assert.areEqual("ECONNREFUSED", closed);
  }

  @TestMethod
  public async answersOnTheServerItIsGivenAndLogsTheErrorsItRaisesOnceItListens(): Promise<void> {
    const log = new RecordingLines();
    const server = createServer();
    const endpoint = new McpHttpEndpoint(log, server);
    try {
      const url = await endpoint.listenAsync();
      endpoint.serve(new FakeMcpEndpointHost());
      server.emit("error", new Error("The server failed."));

      Assert.areEqual(1, server.listenerCount("error"));
      Assert.areEqual("TeamRun's MCP endpoint failed while listening (Error).", log.lines.join("\n"));
      Assert.areEqual(401, (await McpHttpEndpointTests.send(url, "POST", {})).status);
    }
    finally {
      await endpoint.closeAsync();
    }
  }

  @TestMethod
  public async rejectsWithTheServersListenErrorOrWhenItListensOnAnAddressWithoutAPort(): Promise<void> {
    const refusing = new RefusingServer();
    const piped = new McpHttpEndpoint(new RecordingLines(), new PipeAddressServer());
    try {
      const refused = await new McpHttpEndpoint(new RecordingLines(), refusing).listenAsync().then(() => null, (error: unknown) => error);
      const unported = await piped.listenAsync().then(() => null, (error: unknown) => error);

      Assert.areEqual(refusing.failure, refused);
      Assert.areEqual("TeamRun's MCP endpoint listened on an address without a port.", unported instanceof RuntimePartException ? unported.message : String(unported));
    }
    finally {
      await piped.closeAsync();
    }
  }

  @TestMethod
  public async destroysTheConnectionOfARequestItCouldntAnswer(): Promise<void> {
    const endpoint = new McpHttpEndpoint(new RecordingLines());
    const host = new FakeMcpEndpointHost();
    try {
      const url = await endpoint.listenAsync();
      endpoint.serve(host);
      host.failure = new Error("The host failed.");

      Assert.areEqual("ECONNRESET", await McpHttpEndpointTests.failure(url, { authorization: "Bearer session-token" }));
    }
    finally {
      await endpoint.closeAsync();
    }
  }

  private static post(url: string, message: object): Promise<Answer> {
    return McpHttpEndpointTests.send(url, "POST", { authorization: "Bearer session-token" }, JSON.stringify(message));
  }

  private static send(url: string, method: string, headers: OutgoingHttpHeaders, body: string = "{}"): Promise<Answer> {
    return new Promise((resolve, reject) => {
      const sent = request(url, { method, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } }, response => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { text += chunk; });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: text }));
      });
      sent.on("error", reject);
      sent.end(method === "POST" ? body : undefined);
    });
  }

  private static async failure(url: string, headers: OutgoingHttpHeaders = {}): Promise<string> {
    try {
      await McpHttpEndpointTests.send(url, "POST", headers);
    }
    catch (error) {
      return error instanceof Error && "code" in error ? String(error.code) : String.empty;
    }
    throw new Error("The request did not fail.");
  }

  private static ordered(body: string): object {
    const reader = JsonReader.parse(body);
    return { result: reader.readValue("result"), jsonrpc: reader.readString("jsonrpc"), id: reader.readInteger("id") };
  }
}

class RecordingLines implements ILog {
  public readonly lines: string[] = [];

  public write(message: string): void {
    this.lines.push(message);
  }
}
