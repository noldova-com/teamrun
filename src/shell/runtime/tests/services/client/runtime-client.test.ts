/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity,
  Event,
  Failure,
  FailureCode,
  PreShellData,
  QualifiedName,
  Request,
  Response,
  ShellMethods,
  StopPolicy
} from "@noldova/teamrun-shell-protocol";
import { ClientSettings, ConnectionException, Endpoint, type RequestContext, Refusal, RuntimeClient } from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "../../fixtures/client-listener.fixture.js";
import { RawServerFixture } from "../../fixtures/raw-server.fixture.js";
import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";

@TestClass
export class RuntimeClientTests {
  private static readonly ECHO: QualifiedName = new QualifiedName("notes", "echo");
  private static readonly WAIT: QualifiedName = new QualifiedName("notes", "wait");
  private static readonly SETTINGS: ClientSettings = new ClientSettings(300, 1_000, 50);
  private static readonly AUTHENTICATED: string = Response.success("desktop:0", RuntimeServerFixture.IDENTITY.toJson()).toText();

  @TestMethod
  public callsTheRuntimeAndReceivesItsEvents(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeClientTests.ECHO, { handleAsync: (context: RequestContext) => Promise.resolve(context.payload) });

      const client = await RuntimeClientTests.connectAsync(fixture, listener);
      const response = await client.callAsync(RuntimeClientTests.ECHO, { path: "notes.md" });
      fixture.server.broadcast(new Event(RuntimeClientTests.ECHO, "changed"));
      await RuntimeClientTests.waitForAsync(() => listener.events.length === 1);

      Assert.areEqual("desktop", client.clientName);
      Assert.isTrue(client.isConnected);
      Assert.isNull(client.handover);
      Assert.isNull(client.preShellData);
      Assert.areEqual("desktop:1", response.id);
      Assert.areEqual("{\"path\":\"notes.md\"}", JSON.stringify(response.payload));
      Assert.areEqual("\"changed\"", JSON.stringify(listener.events[0]?.payload));
      client.close();
      await listener.disconnectedAsync;
      Assert.isFalse(client.isConnected);
      Assert.areEqual(1, listener.disconnections);
      const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeClientTests.ECHO, null), ConnectionException);
      Assert.areEqual("The connection to the runtime is closed.", exception.message);
    });
  }

  @TestMethod
  public async connectsThroughALocalSocket(): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("tr-cli-");
    await using fixture = new RuntimeServerFixture();
    const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\teamrun-client-${path.basename(folder.path)}` : path.join(folder.path, "runtime.sock");
    fixture.endpoint = await fixture.server.listenSocketAsync(socketPath);

    const client = await RuntimeClientTests.connectAsync(fixture, new ClientListenerFixture());

    Assert.isTrue(client.isConnected);
    Assert.isNull(client.handover);
  }

  @TestMethod
  public cancelsACallThroughItsSignal(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeClientTests.WAIT, {
        handleAsync: async (context: RequestContext): Promise<JsonValue> => {
          await once(context.signal, "abort");
          return null;
        }
      });
      const client = await RuntimeClientTests.connectAsync(fixture, listener);
      const controller = new AbortController();

      const call = client.callAsync(RuntimeClientTests.WAIT, null, 5_000, controller.signal);
      await delay(50);
      controller.abort();
      const response = await call;
      const early = await client.callAsync(RuntimeClientTests.WAIT, null, 5_000, controller.signal);

      Assert.areEqual(FailureCode.Cancelled, response.failure?.code);
      Assert.areEqual("desktop:2", early.id);
      Assert.areEqual(FailureCode.Cancelled, early.failure?.code);
      Assert.areEqual("The request was cancelled.", early.failure?.message);
    });
  }

  @TestMethod
  public rejectsPendingCallsWhenTheConnectionCloses(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeClientTests.WAIT, { handleAsync: (context: RequestContext) => once(context.signal, "abort").then(() => null) });
      const client = await RuntimeClientTests.connectAsync(fixture, listener);

      const call = client.callAsync(RuntimeClientTests.WAIT, null);
      client.close();

      Assert.areEqual("The connection to the runtime is closed.", (await Assert.throwsAsync(() => call, ConnectionException)).message);
    });
  }

  @TestMethod
  public learnsWhichBuildOwnsTheRuntime(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      const client = await RuntimeClient.connectAsync(
        RuntimeClientTests.endpointOf(fixture),
        RuntimeServerFixture.TOKEN,
        RuntimeServerFixture.OTHER_IDENTITY,
        "older",
        listener,
        RuntimeClientTests.SETTINGS);

      Assert.areEqual("server-build", client.handover?.identity.fingerprint);
      Assert.areEqual(RuntimeServerFixture.EXECUTABLE, client.handover?.executablePath);
      Assert.isNull(client.preShellData);
    });
  }

  @TestMethod
  public learnsWhereDataFromBeforeTheShellIs(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      fixture.server.refuse(new Refusal(new Failure(FailureCode.PreShellData, "Move it.", new PreShellData("/data").toJson()), ShellMethods.moveAside));

      const client = await RuntimeClientTests.connectAsync(fixture, listener);

      Assert.areEqual("/data", client.preShellData?.location);
      Assert.isNull(client.handover);
    });
  }

  @TestMethod
  public rejectsAWrongTokenWithTheRuntimesFailure(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(RuntimeClientTests.endpointOf(fixture), "guess", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS),
        ConnectionException);

      Assert.areEqual("The capability token is not valid for this runtime.", exception.message);
      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
      Assert.areEqual(0, listener.disconnections);
    });
  }

  @TestMethod
  public rejectsAnUnreachableRuntime(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      const endpoint = RuntimeClientTests.endpointOf(fixture);
      await fixture.server.closeAsync();

      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(endpoint, RuntimeServerFixture.TOKEN, RuntimeServerFixture.IDENTITY, "desktop", listener),
        ConnectionException);

      Assert.areEqual(`The runtime at ${endpoint.toString()} cannot be reached.`, exception.message);
      Assert.isNull(exception.failure);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  @TestMethod
  public requiresAClientName(): Promise<void> {
    return RuntimeClientTests.runAsync(async (fixture, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(RuntimeClientTests.endpointOf(fixture), RuntimeServerFixture.TOKEN, RuntimeServerFixture.IDENTITY, " ", listener),
        ArgumentException);

      Assert.areEqual("clientName", exception.parameterName);
    });
  }

  @TestMethod
  public rejectsAHandshakeThatIsNotAnsweredInTime(): Promise<void> {
    return RuntimeClientTests.assertRefusedAsync(() => [], "The runtime did not answer the handshake in time.", null);
  }

  @TestMethod
  public rejectsARuntimeThatClosesDuringTheHandshake(): Promise<void> {
    return RuntimeClientTests.assertRefusedAsync(() => null, "The runtime closed the connection during the handshake.", null);
  }

  @TestMethod
  public rejectsARuntimeOfAnotherIdentity(): Promise<void> {
    const other = new BuildIdentity("1.2.3", BuildIdentity.supportedProtocolVersion, "impostor");
    return RuntimeClientTests.assertRefusedAsync(
      () => [Response.success("desktop:0", other.toJson()).toText()],
      "The runtime answered the handshake with another build's identity.",
      null);
  }

  @TestMethod
  public rejectsFailuresWithoutTheirDetails(): Promise<void> {
    return Promise.all([FailureCode.BuildMismatch, FailureCode.PreShellData, FailureCode.Internal].map(code => RuntimeClientTests.assertRefusedAsync(
      () => [Response.failure("desktop:0", new Failure(code, "No details.")).toText()],
      "No details.",
      code))).then(() => undefined);
  }

  @TestMethod
  public rejectsAConnectionLevelFailure(): Promise<void> {
    return Promise.all([
      RuntimeClientTests.assertRefusedAsync(
        () => [Response.failure(null, new Failure(FailureCode.FrameTooLarge, "Too large.")).toText()],
        "Too large.",
        FailureCode.FrameTooLarge),
      RuntimeClientTests.assertRefusedAsync(() => ["{\"kind\":\"Response\",\"id\":null,\"payload\":1}"], "The runtime closed the connection during the handshake.", null),
      RuntimeClientTests.assertRefusedAsync(() => ["not json"], "The runtime closed the connection during the handshake.", null)
    ]).then(() => undefined);
  }

  @TestMethod
  public ignoresWhatItDidNotAskForAndDeliversEventsOnlyOnceConnected(): Promise<void> {
    const early = new Event(RuntimeClientTests.ECHO, "early").toText();
    const late = new Event(RuntimeClientTests.ECHO, "late").toText();
    return RuntimeClientTests.runRawAsync(
      (frame, index) => index === 0
        ? [early, RuntimeClientTests.AUTHENTICATED]
        : [Response.success("someone:1", null).toText(), new Request("runtime:1", RuntimeClientTests.ECHO, null).toText(), late, Response.success(RawServerFixture.readId(frame), 1).toText()],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS);

        const response = await client.callAsync(RuntimeClientTests.ECHO, null);

        Assert.areEqual("1", JSON.stringify(response.payload));
        Assert.areEqual("[\"late\"]", JSON.stringify(listener.events.map(t => t.payload)));
      });
  }

  @TestMethod
  public disconnectsFromARuntimeThatSendsAnInvalidFrame(): Promise<void> {
    return RuntimeClientTests.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientTests.AUTHENTICATED] : ["{\"kind\":"],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS);

        const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeClientTests.ECHO, null), ConnectionException);

        Assert.areEqual("The connection to the runtime is closed.", exception.message);
        Assert.areEqual(1, listener.disconnections);
      });
  }

  @TestMethod
  public givesUpOnACallTheRuntimeDoesNotAnswer(): Promise<void> {
    return RuntimeClientTests.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientTests.AUTHENTICATED] : [],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS);
        const started = Date.now();

        const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeClientTests.ECHO, null, 50), ConnectionException);

        Assert.areEqual("The runtime did not answer notes.echo in time.", exception.message);
        Assert.isTrue(Date.now() - started >= 90, "the client waits for the time limit and the grace");
        Assert.isTrue(client.isConnected);
      });
  }

  @TestMethod
  public asksTheRuntimeToStopOrToMoveOldDataAside(): Promise<void> {
    return RuntimeClientTests.runRawAsync(
      (frame, index) => index === 0 ? [RuntimeClientTests.AUTHENTICATED] : [Response.success(RawServerFixture.readId(frame), null).toText()],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS);

        Assert.isFalse((await client.stopAsync(StopPolicy.StopWork)).hasFailed);
        Assert.isFalse((await client.moveAsideAsync()).hasFailed);

        Assert.areEqual(
          `{"kind":"Handshake","id":"desktop:0","identity":${JSON.stringify(RuntimeServerFixture.IDENTITY.toJson())},"token":"token","client":"desktop"}`,
          server.frames[0]);
        Assert.areEqual("{\"kind\":\"Request\",\"id\":\"desktop:1\",\"method\":\"shell.stop\",\"payload\":{\"policy\":\"StopWork\"},\"timeoutMilliseconds\":1000}", server.frames[1]);
        Assert.areEqual("{\"kind\":\"Request\",\"id\":\"desktop:2\",\"method\":\"shell.moveAside\",\"payload\":null,\"timeoutMilliseconds\":1000}", server.frames[2]);
      });
  }

  private static async assertRefusedAsync(
    reply: (frame: string, index: number) => readonly string[] | null,
    message: string,
    code: FailureCode | null): Promise<void> {
    await RuntimeClientTests.runRawAsync(reply, async (server, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientTests.SETTINGS),
        ConnectionException);

      Assert.areEqual(message, exception.message);
      Assert.areEqual(code, exception.failure?.code ?? null);
      Assert.areEqual(0, listener.disconnections);
    });
  }

  private static connectAsync(fixture: RuntimeServerFixture, listener: ClientListenerFixture): Promise<RuntimeClient> {
    return RuntimeClient.connectAsync(
      RuntimeClientTests.endpointOf(fixture),
      RuntimeServerFixture.TOKEN,
      RuntimeServerFixture.IDENTITY,
      "desktop",
      listener,
      RuntimeClientTests.SETTINGS);
  }

  private static endpointOf(fixture: RuntimeServerFixture): Endpoint {
    if (fixture.endpoint === null)
      throw new Error("The server is not listening.");
    return fixture.endpoint;
  }

  private static async waitForAsync(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 3_000;
    while (!condition()) {
      if (Date.now() >= deadline)
        throw new Error("The condition did not hold in time.");
      await delay(10);
    }
  }

  private static async runAsync(test: (fixture: RuntimeServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeServerFixture.startAsync();
    await test(fixture, new ClientListenerFixture());
  }

  private static async runRawAsync(
    reply: (frame: string, index: number) => readonly string[] | null,
    test: (server: RawServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using server = await RawServerFixture.startAsync(reply);
    await test(server, new ClientListenerFixture());
  }
}
