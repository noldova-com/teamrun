/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import "@noldova/context.core";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { type ILog, Resources as CoreResources } from "@noldova/teamrun.core";
import { McpServer, McpToolCallParams, McpToolListParams, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { RuntimePartException } from "../exceptions/runtime-part.exception.js";
import type { IMcpEndpointHost } from "../interfaces/i-mcp-endpoint-host.js";
import { Resources } from "../resources.js";
import { McpHttpTransport } from "./mcp-http-transport.js";

export class McpHttpEndpoint {
  private readonly log: ILog;
  private readonly server: Server;
  private host: IMcpEndpointHost | null = null;
  private port: number = 0;

  public constructor(log: ILog, server: Server = createServer()) {
    this.log = log;
    this.server = server;
    server.on(Resources.requestEvent, (request: IncomingMessage, response: ServerResponse) => {
      void this.handle(request, response).catch(() => response.destroy());
    });
  }

  public async listenAsync(port: number = 0): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.server.once(Resources.errorEvent, reject);
      this.server.listen(port, Resources.loopbackAddress, () => {
        this.server.off(Resources.errorEvent, reject);
        this.server.on(Resources.errorEvent, (error: unknown) => this.log.write(Resources.formatEndpointFailed(CoreResources.formatFailureKind(error))));
        resolve();
      });
    });
    const address = this.server.address();
    if (Object.isNull(address) || Object.isString(address))
      throw new RuntimePartException(Resources.mcpEndpointWithoutPort);
    this.port = address.port;
    return Resources.formatMcpEndpointUrl(this.port);
  }

  public serve(host: IMcpEndpointHost): void {
    this.host = host;
  }

  public async closeAsync(): Promise<void> {
    if (!this.server.listening)
      return;

    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.headers.host !== Resources.formatLoopbackHost(this.port) || !Object.isUndefined(request.headers.origin)) {
      response.writeHead(Resources.forbiddenStatus).end();
      return;
    }
    if (request.url !== Resources.mcpEndpointPath) {
      response.writeHead(Resources.notFoundStatus).end();
      return;
    }
    const token = Resources.bearerPattern.exec(request.headers.authorization ?? String.empty)?.[1] ?? null;
    const host = this.host;
    if (Object.isNull(token) || Object.isNull(host) || !(await host.acceptsSessionTokenAsync(token))) {
      response.writeHead(Resources.unauthorizedStatus, { [Resources.wwwAuthenticateHeader]: Resources.bearerScheme }).end();
      return;
    }
    if (request.method !== Resources.postMethod) {
      response.writeHead(Resources.methodNotAllowedStatus, { [Resources.allowHeader]: Resources.postMethod }).end();
      return;
    }

    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
    const server = new McpServer({
      listToolsAsync: signal => host.listMcpToolsAsync(new McpToolListParams(token), signal),
      callToolAsync: (name, input, signal) => host.callMcpToolAsync(new McpToolCallParams(token, name, input), signal)
    }, ProtocolResources.protocolVersion);
    response.once(Resources.closeEvent, () => void server.close());
    await server.connect(new McpHttpTransport(transport));
    await transport.handleRequest(request, response);
  }
}
