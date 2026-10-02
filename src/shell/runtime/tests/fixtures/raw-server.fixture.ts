/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Server, type Socket, createServer } from "node:net";

import { Endpoint } from "@noldova/teamrun-shell-runtime";

export class RawServerFixture implements AsyncDisposable {
  private readonly server: Server;
  private readonly sockets: Set<Socket> = new Set();

  public readonly frames: string[] = [];
  public readonly endpoint: Endpoint;

  private constructor(server: Server, endpoint: Endpoint) {
    this.server = server;
    this.endpoint = endpoint;
  }

  public static async startAsync(reply: (frame: string, index: number) => readonly string[] | null): Promise<RawServerFixture> {
    let fixture: RawServerFixture | null = null;
    const server = createServer(socket => {
      fixture?.sockets.add(socket);
      socket.setEncoding("utf8");
      let pending = "";
      socket.on("data", (chunk: string) => {
        pending += chunk;
        let index = pending.indexOf("\n");
        while (index >= 0) {
          const frame = pending.slice(0, index);
          pending = pending.slice(index + 1);
          fixture?.frames.push(frame);
          const replies = reply(frame, (fixture?.frames.length ?? 1) - 1);
          if (replies === null)
            socket.resetAndDestroy();
          else
            for (const text of replies)
              socket.write(`${text}\n`);
          index = pending.indexOf("\n");
        }
      });
      socket.on("error", () => socket.destroy());
      socket.on("close", () => fixture?.sockets.delete(socket));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("The raw server has no port.");
    fixture = new RawServerFixture(server, Endpoint.tcp(address.port));
    return fixture;
  }

  public static readId(frame: string): string {
    const value: unknown = JSON.parse(frame);
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string")
      throw new Error(`The frame ${frame} has no id.`);
    return value.id;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const socket of this.sockets)
      socket.destroy();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}
