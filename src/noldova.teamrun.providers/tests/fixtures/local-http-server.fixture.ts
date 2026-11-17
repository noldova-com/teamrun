/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export class LocalHttpServer implements AsyncDisposable {
  private readonly server: Server;
  private readonly answers: Map<string, { readonly status: number; readonly body: Buffer; readonly sized: boolean; readonly cut: boolean; readonly location?: string; readonly closed?: () => void; readonly type?: string }> =
    new Map();

  public readonly requests: string[] = [];

  private constructor() {
    this.server = createServer((request, response) => {
      const path = request.url ?? "/";
      this.requests.push(`${path} ${request.headers["accept-encoding"] ?? ""}`);
      const answer = this.answers.get(path);
      response.statusCode = answer?.status ?? 404;
      if (answer?.location !== undefined)
        response.setHeader("location", answer.location);
      if (answer?.type !== undefined)
        response.setHeader("content-type", answer.type);
      if (answer?.cut === true) {
        response.setHeader("content-length", answer.body.length * 2);
        response.write(answer.body, () => response.destroy());
        return;
      }
      if (answer?.closed !== undefined) {
        response.once("close", answer.closed);
        const write = (error?: Error | null): void => {
          if (Object.isNullOrUndefined(error) && !response.destroyed)
            response.write(answer.body, write);
        };
        write();
        return;
      }
      if (answer?.sized === false)
        response.write(answer.body);
      response.end(answer?.status === 204 || answer?.sized === false ? undefined : answer?.body);
    });
  }

  public static async start(): Promise<LocalHttpServer> {
    const host = new LocalHttpServer();
    await new Promise<void>(resolve => host.server.listen(0, "localhost", resolve));
    return host;
  }

  public url(path: string): string {
    const { address, family, port } = this.server.address() as AddressInfo;
    return `http://${family === "IPv6" ? `[${address}]` : address}:${port}${path}`;
  }

  public serve(path: string, body: Buffer, status: number = 200, sized: boolean = true): this {
    this.answers.set(path, { status, body, sized, cut: false });
    return this;
  }

  public serveTyped(path: string, body: Buffer, type: string, status: number = 200): this {
    this.answers.set(path, { status, body, sized: true, cut: false, type });
    return this;
  }

  public redirect(path: string, location: string): this {
    this.answers.set(path, { status: 302, body: Buffer.alloc(0), sized: true, cut: false, location });
    return this;
  }

  public cut(path: string, body: Buffer): this {
    this.answers.set(path, { status: 200, body, sized: true, cut: true });
    return this;
  }

  public endless(path: string, body: Buffer): Promise<void> {
    return new Promise<void>(resolve => {
      this.answers.set(path, { status: 200, body, sized: false, cut: false, closed: resolve });
    });
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.server.closeAllConnections();
    await new Promise(resolve => this.server.close(resolve));
  }
}
