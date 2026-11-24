/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { ToolFailureCode } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { PageRequest } from "@noldova/teamrun.protocol";

import { PageException } from "../../exceptions/pages/page.exception.js";
import { PagesResources } from "./pages-resources.js";

export class PageServer {
  private readonly server: Server;
  private readonly readAsync: (id: string, version: number | null) => Promise<string>;
  private readonly failed: (error: unknown) => void;
  private readonly secret: Buffer = randomBytes(PagesResources.secretBytes);
  private port: number = 0;

  public constructor(readAsync: (id: string, version: number | null) => Promise<string>, failed: (error: unknown) => void, server: Server = createServer()) {
    this.readAsync = readAsync;
    this.failed = failed;
    this.server = server;
    server.on(PagesResources.requestEvent, (request: IncomingMessage, response: ServerResponse) => void this.handleAsync(request, response));
  }

  public get origin(): string {
    return PagesResources.formatOrigin(this.port);
  }

  public get isListening(): boolean {
    return this.server.listening;
  }

  public async listenAsync(): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.server.once(PagesResources.errorEvent, reject);
      this.server.listen(0, PagesResources.loopbackAddress, () => {
        this.server.off(PagesResources.errorEvent, reject);
        this.server.on(PagesResources.errorEvent, this.failed);
        resolve();
      });
    });
    const address = this.server.address();
    if (Object.isNull(address) || Object.isString(address)) {
      await this.closeAsync();
      throw new PageException(ToolFailureCode.Unavailable, PagesResources.serverWithoutPort);
    }
    this.port = address.port;
    return this.origin;
  }

  public addressOf(id: string, version: number | null): string {
    return PagesResources.formatAddress(this.origin, id, this.keyOf(id), version);
  }

  public async closeAsync(): Promise<void> {
    if (!this.server.listening)
      return;

    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private async handleAsync(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.headers.host !== PagesResources.formatHost(this.port)) {
      PageServer.refuse(response, PagesResources.forbiddenStatus);
      return;
    }
    if (request.method !== PagesResources.getMethod) {
      response.setHeader(PagesResources.allowHeader, PagesResources.getMethod);
      PageServer.refuse(response, PagesResources.methodNotAllowedStatus);
      return;
    }
    const wanted = this.wanted(String(request.url));
    if (Object.isNull(wanted)) {
      PageServer.refuse(response, PagesResources.notFoundStatus);
      return;
    }
    let html: string;
    try {
      html = await this.readAsync(wanted.pageId, wanted.version);
    }
    catch (error) {
      PageServer.refuse(response, error instanceof PageException ? PagesResources.notFoundStatus : PagesResources.serverErrorStatus);
      return;
    }
    response.writeHead(PagesResources.okStatus, { ...PagesResources.pageHeaders, [PagesResources.contentTypeHeader]: PagesResources.htmlType }).end(html);
  }

  private wanted(url: string): PageRequest | null {
    const at = url.indexOf(PagesResources.querySeparator);
    const id = PagesResources.pagePath.exec(at < 0 ? url : url.slice(0, at))?.[1];
    if (Object.isUndefined(id) || at < 0)
      return null;
    const parameters = new URLSearchParams(url.slice(at + 1));
    const names = [...parameters.keys()];
    const key = parameters.get(PagesResources.keyParameter);
    const version = parameters.get(PagesResources.versionParameter);
    if (names.some(t => t !== PagesResources.keyParameter && t !== PagesResources.versionParameter) || new Set(names).size !== names.length || Object.isNull(key))
      return null;
    if (!Object.isNull(version) && !PagesResources.versionText.test(version))
      return null;
    return this.isKeyOf(id, key) ? new PageRequest(id, Object.isNull(version) ? null : Number(version)) : null;
  }

  private keyOf(id: string): string {
    return createHmac(PagesResources.keyAlgorithm, this.secret).update(id).digest(PagesResources.keyEncoding);
  }

  private isKeyOf(id: string, key: string): boolean {
    const expected = Buffer.from(this.keyOf(id));
    const given = Buffer.from(key);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private static refuse(response: ServerResponse, status: number): void {
    response.writeHead(status, PagesResources.refusalHeaders).end();
  }
}
