/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";
import { type Socket, connect } from "node:net";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Event, Hello, MethodName, ProtocolVersion, Response, WireDecoder } from "@noldova/teamrun-protocol";
import { ConnectionException, EndpointKind, InvalidOperationException, RuntimeClient, RuntimeServer } from "@noldova/teamrun-runtime";

import { RecordingClientListener } from "../../fixtures/recording-client-listener.fixture.js";
import { RuntimeTestHost } from "../../fixtures/runtime-test-host.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class RuntimeServerTests {
  @TestMethod
  public async reportsTheRequestAfterFlushingItsResponse(): Promise<void> {
    await using host = new RuntimeTestHost();
    const sent: string[] = [];
    const server = new RuntimeServer(EndpointKind.Tcp, "unused", "token", host.createDispatcher(), {
      onSessionCountChanged: () => undefined,
      onResponseSent: request => sent.push(request.method)
    });
    const endpoint = await server.start();
    try {
      const client = await RuntimeClient.connect(endpoint, "token", "fixture", new RecordingClientListener(), host.timings);
      try {
        const response = await client.call(MethodName.ProviderList, null);
        await Wait.until(() => sent.length === 1);
        Assert.isFalse(response.hasErrors);
        Assert.areEqual("ProviderList", sent[0]);
      }
      finally {
        client.close();
      }
    }
    finally {
      await server.stop();
    }
  }

  @TestMethod
  @TestData(0)
  @TestData(2)
  public async refusesOtherMinorVersions(minor: number): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    const lock = await service.start();
    const hello = new Hello(new ProtocolVersion(0, minor), lock.token, "incompatible");

    const result = await RuntimeServerTests.exchange(lock.endpoint.port ?? 0, hello.toText());

    Assert.areEqual(ErrorCode.VersionMismatch, RuntimeServerTests.info(new WireDecoder(), result).name);
  }

  @TestMethod
  public async refusesBadHellosAndClosesTheSession(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    const lock = await service.start();
    const decoder = new WireDecoder();

    const badToken = await Assert.throwsAsync(() => RuntimeClient.connect(lock.endpoint, "wrong", "bad", new RecordingClientListener(), host.timings), ConnectionException);
    const notHello = await RuntimeServerTests.exchange(lock.endpoint.port ?? 0, "{\"kind\":\"Event\",\"name\":\"x\",\"payload\":null}");
    const garbage = await RuntimeServerTests.exchange(lock.endpoint.port ?? 0, "not json");
    const futureVersion = await RuntimeServerTests.exchange(lock.endpoint.port ?? 0, new Hello(new ProtocolVersion(ProtocolVersion.current.major + 1, 0), lock.token, "future").toText());
    await Wait.until(() => service.clientCount === 0);
    await host.shutdown();

    Assert.areEqual(ErrorCode.Unauthorized, badToken.info?.name);
    Assert.areEqual("The capability token does not match this runtime.", badToken.message);
    Assert.areEqual(ErrorCode.Unauthorized, RuntimeServerTests.info(decoder, notHello).name);
    Assert.areEqual(ErrorCode.InvalidParams, RuntimeServerTests.info(decoder, garbage).name);
    Assert.areEqual(ErrorCode.VersionMismatch, RuntimeServerTests.info(decoder, futureVersion).name);
    Assert.areEqual(`${ProtocolVersion.current.major + 1}.0`, RuntimeServerTests.info(decoder, futureVersion).arguments[0]);
  }

  @TestMethod
  public async answersRequestsAndRejectsOtherMessagesAfterTheHello(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    const lock = await service.start();
    const listener = new RecordingClientListener();
    const client = await host.connect(service, "chat", listener);
    const raw = await RuntimeServerTests.open(lock.endpoint.port ?? 0);
    const rawLines: string[] = [];
    raw.on("data", (chunk: string) => rawLines.push(...chunk.split("\n").filter(t => t.length > 0)));
    raw.write(`${new Hello(ProtocolVersion.current, lock.token, "raw").toText()}\n`);
    await Wait.until(() => rawLines.length === 1);

    const providers = await client.call(MethodName.ProviderList, null);
    raw.write(`${new Event("stray", null).toText()}\n`);
    raw.write("garbage after hello\n");
    await Wait.until(() => rawLines.length === 3);
    const unknown = await client.call("nope/nothing", null);
    raw.destroy();
    await Wait.until(() => service.clientCount === 1);
    await host.shutdown();

    const decoder = new WireDecoder();
    Assert.isFalse(providers.hasErrors);
    Assert.areEqual("[{\"id\":\"fake\",\"displayName\":\"Fake provider\",\"effortLevels\":[\"low\",\"high\"],\"supportsResume\":true,\"supportsSignInCheck\":true,\"supportsFork\":false}]", JSON.stringify(providers.payload));
    Assert.areEqual("Only requests are accepted after the hello.", RuntimeServerTests.info(decoder, [rawLines[1] ?? ""]).message);
    Assert.areEqual("The message could not be read.", RuntimeServerTests.info(decoder, [rawLines[2] ?? ""]).message);
    Assert.areEqual(ErrorCode.UnknownMethod, unknown.info?.name);
    Assert.isTrue(client.version?.equals(ProtocolVersion.current) ?? false);
  }

  @TestMethod
  public async listensOnASocketPathAndRefusesADoubleStart(): Promise<void> {
    await using host = new RuntimeTestHost();
    const settings = host.createSettings(null, EndpointKind.Socket);
    const service = host.createService(settings);
    const lock = await service.start();
    const client = await host.connect(service);
    const secondServer = new RuntimeServer(EndpointKind.Socket, settings.socketPath, "token", host.createDispatcher(), { onSessionCountChanged: () => undefined });
    const stalePath = host.directory.resolve("stale.sock");
    writeFileSync(stalePath, "stale");
    const staleServer = new RuntimeServer(EndpointKind.Socket, stalePath, "token", host.createDispatcher("c"), { onSessionCountChanged: () => undefined });

    try {
      const models = await client.call(MethodName.ProviderListModels, { provider: "fake", providerAccountId: null });
      const inUse = await Assert.throwsAsync(() => secondServer.start(), Error);
      await Assert.throwsAsync(() => staleServer.start(), Error);
      const blankPath = Assert.throws(() => new RuntimeServer(EndpointKind.Tcp, " ", "t", host.createDispatcher("a"), { onSessionCountChanged: () => undefined }), ArgumentException);
      const blankToken = Assert.throws(() => new RuntimeServer(EndpointKind.Tcp, "p", "", host.createDispatcher("b"), { onSessionCountChanged: () => undefined }), ArgumentException);

      Assert.areEqual(EndpointKind.Socket, lock.endpoint.kind);
      Assert.areEqual(settings.socketPath, lock.endpoint.path);
      Assert.areEqual("[\"fake-model\"]", JSON.stringify(models.payload));
      Assert.isTrue(inUse.message.includes("EADDRINUSE"), inUse.message);
      Assert.isTrue(existsSync(stalePath));
      Assert.areEqual("path", blankPath.parameterName);
      Assert.areEqual("token", blankToken.parameterName);
    }
    finally {
      await secondServer.stop();
      await staleServer.stop();
    }
  }

  @TestMethod
  public async cannotBeStartedTwiceAndStopsIdempotently(): Promise<void> {
    await using host = new RuntimeTestHost();
    const server = new RuntimeServer(EndpointKind.Tcp, "unused", "token", host.createDispatcher(), { onSessionCountChanged: () => undefined });

    await server.stop();
    const endpoint = await server.start();
    const twice = Assert.throws(() => server.start(), InvalidOperationException);
    const raw = await RuntimeServerTests.open(endpoint.port ?? 0);
    raw.write(`${new Hello(ProtocolVersion.current, "token", "raw").toText()}\n`);
    await Wait.until(() => server.authenticatedCount === 1);
    const authenticated = server.authenticatedCount;
    raw.destroy();
    await Wait.until(() => server.sessionCount === 0);
    await server.stop();
    await server.stop();
    await host.shutdown();

    Assert.areEqual(EndpointKind.Tcp, endpoint.kind);
    Assert.areEqual("The runtime server was already started.", twice.message);
    Assert.areEqual(1, authenticated);
    Assert.isNull(server.endpoint);
    Assert.areEqual(0, server.sessionCount);
    Assert.areEqual(0, server.authenticatedCount);
  }

  private static async exchange(port: number, line: string): Promise<string[]> {
    const socket = await RuntimeServerTests.open(port);
    const lines: string[] = [];
    socket.on("data", (chunk: string) => lines.push(...chunk.split("\n").filter(t => t.length > 0)));
    const closed = new Promise<void>(resolve => socket.on("close", () => resolve()));
    socket.write(`${line}\n`);
    await closed;

    return lines;
  }

  private static open(port: number): Promise<Socket> {
    return new Promise(resolve => {
      const socket = connect(port, "127.0.0.1", () => resolve(socket));
      socket.setEncoding("utf8");
    });
  }

  private static info(decoder: WireDecoder, lines: readonly string[]): { name: string; message: string; arguments: readonly string[] } {
    const response = decoder.decodeText(lines[0] ?? "");
    if (!(response instanceof Response) || response.info === null)
      throw new Error("Expected a failed response.");

    return response.info;
  }
}
