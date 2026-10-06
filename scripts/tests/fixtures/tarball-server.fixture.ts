/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export default class TarballServerFixture {
  private static readonly HOST: string = "127.0.0.1";

  private readonly server: Server;
  private readonly files: Map<string, Buffer> = new Map();

  public readonly requests: string[] = [];

  private constructor(server: Server) {
    this.server = server;
  }

  public static async startAsync(): Promise<TarballServerFixture> {
    const server = createServer();
    const fixture = new TarballServerFixture(server);
    server.on("request", (request, response) => {
      const url = request.url ?? "";
      fixture.requests.push(url);
      const file = fixture.files.get(url);
      if (file === undefined)
        response.writeHead(404).end();
      else
        response.end(file);
    });
    await new Promise<void>(resolve => server.listen(0, TarballServerFixture.HOST, resolve));
    return fixture;
  }

  public static async locateClosedAsync(file: string): Promise<string> {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, TarballServerFixture.HOST, resolve));
    const address: AddressInfo | string | null = server.address();
    const port = address !== null && typeof address === "object" ? address.port : 0;
    await new Promise<void>(resolve => server.close(() => resolve()));
    return `http://${TarballServerFixture.HOST}:${port}/${file}`;
  }

  public static hash(data: Buffer): string {
    return createHash("sha512").update(data).digest("base64");
  }

  public locate(file: string): string {
    const address: AddressInfo | string | null = this.server.address();
    const port = address !== null && typeof address === "object" ? address.port : 0;
    return `http://${TarballServerFixture.HOST}:${port}/${file}`;
  }

  public publish(file: string, data: Buffer): string {
    this.files.set(`/${file}`, data);
    return this.locate(file);
  }

  public lock(file: string, data: Buffer, fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return { ...fields, resolved: this.publish(file, data), integrity: `sha512-${TarballServerFixture.hash(data)}` };
  }

  public async disposeAsync(): Promise<void> {
    const closed = new Promise<void>(resolve => this.server.close(() => resolve()));
    this.server.closeAllConnections();
    await closed;
  }
}
