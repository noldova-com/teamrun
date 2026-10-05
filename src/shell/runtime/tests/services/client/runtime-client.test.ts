/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity,
  Event,
  Failure,
  FailureCode,
  PreShellData,
  Request,
  Response,
  ShellMethods,
  StopPolicy
} from "@noldova/teamrun-shell-protocol";
import { ClientSettings, ConnectionException, type RequestContext, Refusal, RuntimeClient } from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "../../fixtures/client-listener.fixture.js";
import { RawServerFixture } from "../../fixtures/raw-server.fixture.js";
import { RuntimeClientFixture } from "../../fixtures/runtime-client.fixture.js";
import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";

@TestClass
export class RuntimeClientTests {
  @TestMethod
  public callsTheRuntimeAndReceivesItsEvents(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeServerFixture.ECHO, { handleAsync: (context: RequestContext) => Promise.resolve(context.payload) });

      const client = await RuntimeClientFixture.connectAsync(fixture, listener);
      const response = await client.callAsync(RuntimeServerFixture.ECHO, { path: "notes.md" });
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "changed"));
      await listener.waitForEventsAsync(1);

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
      const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeServerFixture.ECHO, null), ConnectionException);
      Assert.areEqual("The connection to the runtime is closed.", exception.message);
    });
  }

  @TestMethod
  public async connectsThroughALocalSocket(): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("tr-cli-");
    await using fixture = new RuntimeServerFixture();
    const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\teamrun-client-${path.basename(folder.path)}` : path.join(folder.path, "runtime.sock");
    fixture.endpoint = await fixture.server.listenSocketAsync(socketPath);

    const client = await RuntimeClientFixture.connectAsync(fixture, new ClientListenerFixture());

    Assert.isTrue(client.isConnected);
    Assert.isNull(client.handover);
  }

  @TestMethod
  public cancelsACallThroughItsSignal(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      const started = Promise.withResolvers<void>();
      fixture.methods.register(RuntimeServerFixture.WAIT, {
        handleAsync: async (context: RequestContext): Promise<JsonValue> => {
          started.resolve();
          await once(context.signal, "abort");
          return null;
        }
      });
      const client = await RuntimeClientFixture.connectAsync(fixture, listener);
      const controller = new AbortController();

      const call = client.callAsync(RuntimeServerFixture.WAIT, null, 5_000, controller.signal);
      await started.promise;
      controller.abort();
      const response = await call;
      const early = await client.callAsync(RuntimeServerFixture.WAIT, null, 5_000, controller.signal);

      Assert.areEqual(FailureCode.Cancelled, response.failure?.code);
      Assert.areEqual("desktop:2", early.id);
      Assert.areEqual(FailureCode.Cancelled, early.failure?.code);
      Assert.areEqual("The request was cancelled.", early.failure?.message);
    });
  }

  @TestMethod
  public learnsWhichBuildOwnsTheRuntime(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      const client = await RuntimeClient.connectAsync(
        RuntimeClientFixture.endpointOf(fixture),
        RuntimeServerFixture.TOKEN,
        RuntimeServerFixture.OTHER_IDENTITY,
        "older",
        listener,
        RuntimeClientFixture.SETTINGS);

      Assert.areEqual("server-build", client.handover?.identity.fingerprint);
      Assert.areEqual(RuntimeServerFixture.EXECUTABLE, client.handover?.executablePath);
      Assert.isNull(client.preShellData);
    });
  }

  @TestMethod
  public learnsWhereDataFromBeforeTheShellIs(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      fixture.server.refuse(new Refusal(new Failure(FailureCode.PreShellData, "Move it.", new PreShellData("/data").toJson()), ShellMethods.moveAside));

      const client = await RuntimeClientFixture.connectAsync(fixture, listener);

      Assert.areEqual("/data", client.preShellData?.location);
      Assert.isNull(client.handover);
    });
  }

  @TestMethod
  public rejectsAWrongTokenWithTheRuntimesFailure(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(RuntimeClientFixture.endpointOf(fixture), "guess", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS),
        ConnectionException);

      Assert.areEqual("The capability token is not valid for this runtime.", exception.message);
      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
      Assert.areEqual(0, listener.disconnections);
    });
  }

  @TestMethod
  public rejectsAnUnreachableRuntime(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      const endpoint = RuntimeClientFixture.endpointOf(fixture);
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
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(RuntimeClientFixture.endpointOf(fixture), RuntimeServerFixture.TOKEN, RuntimeServerFixture.IDENTITY, " ", listener),
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
    const early = new Event(RuntimeServerFixture.ECHO, "early").toText();
    const late = new Event(RuntimeServerFixture.ECHO, "late").toText();
    return RuntimeClientFixture.runRawAsync(
      (frame, index) => index === 0
        ? [early, RuntimeClientFixture.AUTHENTICATED]
        : [Response.success("someone:1", null).toText(), new Request("runtime:1", RuntimeServerFixture.ECHO, null).toText(), late, Response.success(RawServerFixture.readId(frame), 1).toText()],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS);

        const response = await client.callAsync(RuntimeServerFixture.ECHO, null);

        Assert.areEqual("1", JSON.stringify(response.payload));
        Assert.areEqual("[\"late\"]", JSON.stringify(listener.events.map(t => t.payload)));
      });
  }

  @TestMethod
  public disconnectsFromARuntimeThatSendsAnInvalidFrame(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : ["{\"kind\":"],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS);

        const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeServerFixture.ECHO, null), ConnectionException);

        Assert.areEqual("The connection to the runtime is closed.", exception.message);
        Assert.areEqual(1, listener.disconnections);
        Assert.areEqual(`${FailureCode.InvalidMessage}|The frame is not a valid message.`, `${listener.failure?.code}|${listener.failure?.message}`);
      });
  }

  @TestMethod
  public disconnectsFromARuntimeThatSendsAFrameOverTheLimitAndSaysWhy(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : ["x".repeat(2_048)],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, new ClientSettings(300, 1_000, 50, 1_024));

        await Assert.throwsAsync(() => client.callAsync(RuntimeServerFixture.ECHO, null), ConnectionException);

        Assert.areEqual(1, listener.disconnections);
        Assert.areEqual(`${FailureCode.FrameTooLarge}|A frame exceeds the maximum length of 1024 characters.`, `${listener.failure?.code}|${listener.failure?.message}`);
      });
  }

  @TestMethod
  public answersARequestTooLargeToSendWithAFailureAndLeavesNoCallBehind(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : [Response.success(RawServerFixture.readId(frame), 1).toText()],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, new ClientSettings(300, 1_000, 50, 1_024));

        const loop: JsonValue[] = [];
        loop.push(loop);

        const large = await client.callAsync(RuntimeServerFixture.ECHO, "x".repeat(2_048));
        const invalid = Assert.throws(() => client.callAsync(RuntimeServerFixture.ECHO, null, 1.5), ArgumentOutOfRangeException);
        Assert.throws(() => client.callAsync(RuntimeServerFixture.ECHO, loop), TypeError);
        const small = await client.callAsync(RuntimeServerFixture.ECHO, null);
        client.close();
        await listener.disconnectedAsync;
        const closed = Assert.throws(() => client.callAsync(RuntimeServerFixture.ECHO, null, 0), ArgumentOutOfRangeException);

        Assert.areEqual(`desktop:1|${FailureCode.FrameTooLarge}|A frame exceeds the maximum length of 1024 characters.`, `${large.id}|${large.failure?.code}|${large.failure?.message}`);
        Assert.areEqual("timeoutMilliseconds|timeoutMilliseconds", `${String(invalid.parameterName)}|${String(closed.parameterName)}`);
        Assert.areEqual("desktop:3|1", `${small.id}|${JSON.stringify(small.payload)}`);
        Assert.areEqual(2, server.frames.length);
        Assert.isNull(listener.failure);
      });
  }

  @TestMethod
  public asksTheRuntimeToStopOrToMoveOldDataAside(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : [Response.success(RawServerFixture.readId(frame), null).toText()],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS);

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
    await RuntimeClientFixture.runRawAsync(reply, async (server, listener) => {
      const exception = await Assert.throwsAsync(
        () => RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS),
        ConnectionException);

      Assert.areEqual(message, exception.message);
      Assert.areEqual(code, exception.failure?.code ?? null);
      Assert.areEqual(0, listener.disconnections);
    });
  }
}
