/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Socket, connect, createServer } from "node:net";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event } from "@noldova/teamrun-protocol";
import { ClientSession, type ISessionListener } from "@noldova/teamrun-runtime";

import { RawServer } from "../../fixtures/raw-server.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class ClientSessionTests {
  @TestMethod
  public async refusesAcknowledgementsWhenTheTransportCannotFlush(): Promise<void> {
    const socket = new Socket();
    const session = new ClientSession(socket, { onLine: () => undefined, onClosed: () => undefined });
    await Assert.throwsAsync(() => session.writeAndFlush(new Event("not-connected", null)), Error);
    await Wait.until(() => session.isClosed);
    await Assert.throwsAsync(() => session.writeAndFlush(new Event("closed", null)), Error);
  }
  @TestMethod
  public async readsLinesWritesMessagesAndReportsTheClose(): Promise<void> {
    const lines: string[] = [];
    let closed = 0;
    const holder: { session: ClientSession | null } = { session: null };
    const listener: ISessionListener = {
      onLine: (_session, line) => lines.push(line),
      onClosed: () => closed += 1
    };
    const server = createServer(socket => {
      holder.session = new ClientSession(socket, listener);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const port = RawServer.readPort(server);
    const received: string[] = [];
    const client = await ClientSessionTests.open(port);
    client.on("data", (chunk: string) => received.push(...chunk.split("\n").filter(t => t.length > 0)));

    client.write("first\nsec");
    client.write("ond\n");
    await Wait.until(() => lines.length === 2);
    const current = holder.session;
    if (current === null)
      throw new Error("Expected a session.");
    current.authenticate("tester");
    current.write(new Event("hello/world", null));
    await Wait.until(() => received.length === 1);
    client.resetAndDestroy();
    await Wait.until(() => closed === 1);
    current.write(new Event("late", null));
    current.close();
    await new Promise<void>(resolve => server.close(() => resolve()));

    Assert.areEqual("first,second", lines.join(","));
    Assert.isTrue(current.isAuthenticated);
    Assert.areEqual("tester", current.name);
    Assert.isTrue(received[0]?.includes("hello/world") ?? false);
    Assert.isTrue(current.isClosed);
    Assert.areEqual(1, closed);
  }

  private static open(port: number): Promise<Socket> {
    return new Promise(resolve => {
      const socket = connect(port, "127.0.0.1", () => resolve(socket));
      socket.setEncoding("utf8");
    });
  }
}
