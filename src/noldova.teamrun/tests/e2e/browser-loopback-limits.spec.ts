/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";

import { type Page, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { LinkedSite } from "./fixtures/linked-site.ts";
import { LocalServer } from "./fixtures/local-server.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const LOCAL_DATA: string = "local-data";
const LOCAL_HELLO: string = "local-hello";
const WEBSOCKET_GUID: string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class LoopbackService {
  public readonly hits: string[] = [];
  private readonly sockets: Socket[] = [];
  private readonly server: Server;
  public readonly port: number;

  private constructor(server: Server, port: number) {
    this.server = server;
    this.port = port;
  }

  public get name(): string {
    return `app.test:${String(this.port)}`;
  }

  public static async startAsync(): Promise<LoopbackService> {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const service = new LoopbackService(server, typeof address === "object" && address !== null ? address.port : 0);
    server.on("request", (request, response) => {
      service.hits.push(`${request.method ?? ""} ${request.url ?? ""}`);
      response.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      response.end(LOCAL_DATA);
    });
    server.on("upgrade", (request, socket: Socket) => {
      service.hits.push(`upgrade ${request.url ?? ""}`);
      service.sockets.push(socket);
      const accept = createHash("sha1").update(`${String(request.headers["sec-websocket-key"])}${WEBSOCKET_GUID}`).digest("base64");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      socket.write(Buffer.concat([Buffer.from([0x81, LOCAL_HELLO.length]), Buffer.from(LOCAL_HELLO)]));
    });
    return service;
  }

  public closeAsync(): Promise<void> {
    for (const socket of this.sockets)
      socket.destroy();
    return LocalServer.closeAsync(this.server);
  }
}

const servePageAsync = async (script: string): Promise<[Server, string]> => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><title>Waiting</title><h1>Local page</h1><script>${script}</script>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return [server, `http://127.0.0.1:${String(typeof address === "object" && address !== null ? address.port : 0)}`];
};

const allowByNavigationAsync = async (app: TeamRunApp, page: Page, address: string): Promise<string | undefined> => {
  await app.submitAsync(`${CodexDouble.NAVIGATE_PREFIX}${address}`);
  await expect(page.getByText("Codex is waiting for your answer", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tree").locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").click();
  const card = page.locator("nol-permission-card").filter({ has: page.getByRole("button", { name: "Allow this site for the workspace", exact: true }) });
  await card.getByRole("button", { name: "Allow this site for the workspace", exact: true }).click({ timeout: 60_000 });
  const navigated = (): string | undefined => (existsSync(app.codexLog) ? readFileSync(app.codexLog, "utf8").split("\n") : [])
    .find(t => t.includes(`${CodexDouble.NAVIGATE_PREFIX}${address} `));
  await expect.poll(navigated, TeamRunApp.pollOf(60_000)).toBeDefined();
  return navigated();
};

test("limit: a page's request to a name that resolves to this computer reaches it, and the page reads the answer, until Noldova Desktop refuses it", async ({ app }) => {
  const service = await LoopbackService.startAsync();
  const [pageServer, origin] = await servePageAsync(`fetch("http://${service.name}/data").then(t => t.text()).then(t => { document.title = "Read " + t; }, `
    + "e => { document.title = \"Failed \" + e; });");
  try {
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(origin);

    await LinkedSite.openAsync(page, `${origin}/`, `Read ${LOCAL_DATA}`);

    expect(service.hits).toEqual(["GET /data"]);
  }
  finally {
    await LocalServer.closeAsync(pageServer);
    await service.closeAsync();
  }
});

test("a navigation to an allowed name that resolves to this computer is refused before anything reaches it", async ({ app }) => {
  const service = await LoopbackService.startAsync();
  try {
    const page = await app.openChatAsync();

    const navigated = await allowByNavigationAsync(app, page, `http://${service.name}/`);
    const resolved = await app.electronApp.evaluate(({ webContents }, host) => Promise.all(webContents.getAllWebContents()
      .filter(t => !t.getURL().startsWith("file:"))
      .map(async t => (await t.session.resolveHost(host)).endpoints.map(endpoint => endpoint.address).join(" "))), "app.test");

    expect([navigated?.endsWith(` ${CodexDouble.NAVIGATE_OPENED}`), service.hits, [...new Set(resolved)]]).toEqual([false, [], ["127.0.0.1"]]);
  }
  finally {
    await service.closeAsync();
  }
});

test("limit: a named local page's WebSocket to an allowed name that resolves to this computer connects, until Noldova Desktop refuses it", async ({ app }) => {
  const service = await LoopbackService.startAsync();
  const [pageServer, origin] = await servePageAsync(`const socket = new WebSocket("ws://${service.name}/socket"); `
    + "socket.onmessage = e => { document.title = \"Heard \" + e.data; }; socket.onerror = () => { document.title = \"Failed\"; };");
  try {
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(origin);
    await allowByNavigationAsync(app, page, `http://${service.name}/`);
    await page.getByRole("tab", { name: "New tab", exact: true }).click();
    await page.getByRole("button", { name: "Close New tab", exact: true }).click();
    await expect(page.getByRole("tab", { name: "New tab", exact: true })).toHaveCount(0);

    await LinkedSite.openAsync(page, `${origin}/`, `Heard ${LOCAL_HELLO}`);

    expect(service.hits).toEqual(["upgrade /socket"]);
  }
  finally {
    await LocalServer.closeAsync(pageServer);
    await service.closeAsync();
  }
});
