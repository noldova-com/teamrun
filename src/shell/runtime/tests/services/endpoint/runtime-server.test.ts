/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity,
  Cancel,
  Event,
  Failure,
  FailureCode,
  Handshake,
  ProtocolException,
  QualifiedName,
  Request,
  Response,
  RuntimeHandover,
  ShellMethods
} from "@noldova/teamrun-shell-protocol";
import {
  ConnectionException,
  type IMethodHandler,
  MethodFailureException,
  Refusal,
  type RequestContext,
  ServerSettings
} from "@noldova/teamrun-shell-runtime";

import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";

@TestClass
export class RuntimeServerTests {
  private static readonly ECHO: QualifiedName = new QualifiedName("notes", "echo");
  private static readonly WAIT: QualifiedName = new QualifiedName("notes", "wait");
  private static readonly MOVE: QualifiedName = new QualifiedName("notes", "move");
  private static readonly ECHO_HANDLER: IMethodHandler = {
    handleAsync: (context: RequestContext) => Promise.resolve({ client: context.client, payload: context.payload })
  };

  @TestMethod
  public answersTheHandshakeWithItsIdentityAndServesRequests(): Promise<void> {
    return RuntimeServerTests.runAsync(new ServerSettings(64 * 1024, 100, 1_000, 2_000), async fixture => {
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("desktop");
      await delay(200);
      connection.sendMessages(new Request("desktop:1", RuntimeServerTests.ECHO, { path: "notes.md" }));
      const response = await connection.readResponseAsync();

      Assert.areEqual("desktop:0", answer.id);
      Assert.areEqual(JSON.stringify(RuntimeServerFixture.IDENTITY.toJson()), JSON.stringify(answer.payload));
      Assert.areEqual("desktop:1", response.id);
      Assert.areEqual("{\"client\":\"desktop\",\"payload\":{\"path\":\"notes.md\"}}", JSON.stringify(response.payload));
      Assert.areEqual(1, fixture.server.sessionCount);
    });
  }

  @TestMethod
  public refusesAWrongToken(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const [connection, answer] = await fixture.handshakeAsync("desktop", RuntimeServerFixture.IDENTITY, "guess");

      RuntimeServerTests.assertFailure(answer, FailureCode.Unauthorized, "The capability token is not valid for this runtime.", "desktop:0");
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public requiresTheHandshakeFirstAndIgnoresWhatFollows(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);
      const connection = await fixture.connectAsync();

      connection.sendMessages(new Request("tester:1", RuntimeServerTests.ECHO, null), new Request("tester:2", RuntimeServerTests.ECHO, null));

      RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "A connection must begin with a handshake.", null);
      await connection.waitForCloseAsync();
      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
    });
  }

  @TestMethod
  public closesAConnectionThatSendsNoHandshakeInTime(): Promise<void> {
    return RuntimeServerTests.runAsync(new ServerSettings(1_024, 100, 1_000, 1_000), async fixture => {
      const connection = await fixture.connectAsync();

      await connection.waitForCloseAsync();

      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
      await RuntimeServerTests.waitForAsync(() => fixture.server.sessionCount === 0);
      Assert.areEqual(2, fixture.changes);
    });
  }

  @TestMethod
  public endsAConnectionWhoseFirstFrameIsInvalid(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const connection = await fixture.connectAsync();

      connection.send("not json\n");

      RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public keepsAnAuthenticatedConnectionAfterAnInvalidFrame(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);
      const connection = await fixture.authenticateAsync();

      connection.send(`{"kind":"Unknown"}\n${new Request("tester:1", RuntimeServerTests.ECHO, 1).toText()}\n`);

      RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      Assert.areEqual("{\"client\":\"tester\",\"payload\":1}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public endsAConnectionThatSendsAnOversizedFrame(): Promise<void> {
    return RuntimeServerTests.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.send("x".repeat(2_048));

      const response = await connection.readResponseAsync();
      Assert.areEqual(FailureCode.FrameTooLarge, response.failure?.code);
      Assert.isNull(response.id);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public answersUnknownMethodsAndUnexpectedMessages(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerTests.ECHO, null),
        new Handshake("tester:2", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, "tester"),
        new Event(RuntimeServerTests.ECHO, null),
        Response.success("tester:3", null),
        new Cancel("tester:9"));

      RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.UnknownMethod, "The method notes.echo is not registered.", "tester:1");
      for (let index = 0; index < 3; index++)
        RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "Only requests and cancellations may follow the handshake.", null);
      await delay(50);
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public cancelsARequestAndRefusesADuplicateId(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const signals: AbortSignal[] = [];
      fixture.methods.register(RuntimeServerTests.WAIT, RuntimeServerTests.createWaitHandler(signals));
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(new Request("tester:1", RuntimeServerTests.WAIT, null), new Request("tester:1", RuntimeServerTests.WAIT, null));
      RuntimeServerTests.assertFailure(
        await connection.readResponseAsync(),
        FailureCode.InvalidMessage,
        "A request with the id tester:1 is already running on this connection.",
        "tester:1");
      connection.sendMessages(new Cancel("tester:1"));

      RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.Cancelled, "The request was cancelled.", "tester:1");
      Assert.areEqual(1, signals.length);
      Assert.areEqual(true, signals[0]?.aborted);
      await delay(50);
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public endsRequestsAtTheirDeadline(): Promise<void> {
    return RuntimeServerTests.runAsync(new ServerSettings(64 * 1024, 1_000, 100, 200), async fixture => {
      fixture.methods.register(RuntimeServerTests.WAIT, RuntimeServerTests.createWaitHandler([]));
      const connection = await fixture.authenticateAsync();
      const started = Date.now();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerTests.WAIT, null, 20),
        new Request("tester:2", RuntimeServerTests.WAIT, null),
        new Request("tester:3", RuntimeServerTests.WAIT, null, 60_000));

      for (const id of ["tester:1", "tester:2", "tester:3"])
        RuntimeServerTests.assertFailure(await connection.readResponseAsync(), FailureCode.DeadlineExceeded, "The request did not finish within its time limit.", id);
      Assert.isTrue(Date.now() - started < 2_000, "the maximum limits the requested time");
    });
  }

  @TestMethod
  public describesHandlerFailures(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.NotFound, "The note does not exist.", { path: "notes.md" });
      const failures: Record<string, () => never> = {
        method: () => { throw new MethodFailureException(failure); },
        protocol: () => { throw new ProtocolException(FailureCode.Conflict, "The note changed."); },
        json: () => { throw new JsonException("The path must be a string.", "$.path"); },
        other: () => { throw new Error("secret detail"); }
      };
      for (const [member, raise] of Object.entries(failures))
        fixture.methods.register(new QualifiedName("fail", member), { handleAsync: () => Promise.resolve().then(raise) });
      fixture.methods.register(new QualifiedName("fail", "sync"), { handleAsync: (): Promise<JsonValue> => { throw new Error("thrown synchronously"); } });
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(...["method", "protocol", "json", "other", "sync"].map(t => new Request(t, new QualifiedName("fail", t), null)));
      const responses = new Map<string | null, Response>();
      for (let index = 0; index < 5; index++) {
        const response = await connection.readResponseAsync();
        responses.set(response.id, response);
      }

      Assert.areEqual(JSON.stringify(Response.failure("method", failure).toJson()), JSON.stringify(responses.get("method")?.toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("protocol", new Failure(FailureCode.Conflict, "The note changed.")).toJson()), JSON.stringify(responses.get("protocol")?.toJson()));
      Assert.areEqual(FailureCode.InvalidParams, responses.get("json")?.failure?.code);
      for (const id of ["other", "sync"])
        Assert.areEqual(JSON.stringify(Response.failure(id, new Failure(FailureCode.Internal, "The runtime failed to handle the request.")).toJson()), JSON.stringify(responses.get(id)?.toJson()));
    });
  }

  @TestMethod
  public abortsRunningRequestsWhenTheConnectionCloses(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const signals: AbortSignal[] = [];
      fixture.methods.register(RuntimeServerTests.WAIT, RuntimeServerTests.createWaitHandler(signals));
      const connection = await fixture.authenticateAsync();
      connection.sendMessages(new Request("tester:1", RuntimeServerTests.WAIT, null));
      await RuntimeServerTests.waitForAsync(() => signals.length === 1);

      connection.reset();

      await RuntimeServerTests.waitForAsync(() => fixture.server.sessionCount === 0);
      Assert.areEqual(true, signals[0]?.aborted);
    });
  }

  @TestMethod
  public letsAnotherBuildOnlyAskItToStop(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.stop, RuntimeServerTests.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("older", RuntimeServerFixture.OTHER_IDENTITY);
      connection.sendMessages(new Request("older:1", RuntimeServerTests.ECHO, null), new Request("older:2", ShellMethods.stop, { policy: "IfIdle" }));
      fixture.server.broadcast(new Event(RuntimeServerTests.ECHO, "not for other builds"));

      Assert.areEqual(
        `{"kind":"Response","id":"older:0","failure":{"code":"BuildMismatch","message":"Another build of TeamRun owns this data directory.",`
        + `"details":{"identity":{"productVersion":"1.2.3","protocolVersion":1,"fingerprint":"server-build"},"executablePath":"/opt/teamrun/teamrun"}}}`,
        answer.toText());
      RuntimeServerTests.assertFailure(
        await connection.readResponseAsync(),
        FailureCode.BuildMismatch,
        "A connection from another build may only ask the runtime to stop.",
        "older:1");
      Assert.areEqual("{\"client\":\"older\",\"payload\":{\"policy\":\"IfIdle\"}}", JSON.stringify((await connection.readResponseAsync()).payload));
      await delay(50);
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public answersALaterProtocolVersionWithTheHandover(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const later = new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion + 1, "later-build");

      const [connection, answer] = await fixture.handshakeAsync("later", later);

      Assert.areEqual(FailureCode.BuildMismatch, answer.failure?.code);
      Assert.areEqual(JSON.stringify(new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE).toJson()), JSON.stringify(answer.failure?.details));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public servesOnlyTheRefusalsMethodUntilItAdmits(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerTests.MOVE, RuntimeServerTests.ECHO_HANDLER);
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [refused, answer] = await fixture.handshakeAsync("desktop");
      refused.sendMessages(new Request("desktop:1", RuntimeServerTests.ECHO, null), new Request("desktop:2", RuntimeServerTests.MOVE, null));
      fixture.server.broadcast(new Event(RuntimeServerTests.ECHO, "not for refused connections"));

      Assert.areEqual(JSON.stringify(Response.failure("desktop:0", failure).toJson()), JSON.stringify(answer.toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("desktop:1", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual("desktop:2", (await refused.readResponseAsync()).id);
      fixture.server.admit();
      await refused.waitForCloseAsync();
      await Assert.throwsAsync(() => refused.readTextAsync(), Error);
      const admitted = await fixture.authenticateAsync("desktop");
      fixture.server.broadcast(new Event(RuntimeServerTests.ECHO, "for everyone"));
      Assert.areEqual("\"for everyone\"", JSON.stringify((await admitted.readEventAsync()).payload));
    });
  }

  @TestMethod
  public listensOnALocalSocketAndRemovesItWhenClosed(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\teamrun-test-${path.basename(folder)}` : path.join(folder, "runtime.sock");
      if (process.platform !== "win32")
        await writeFile(socketPath, "stale");
      const fixture = new RuntimeServerFixture();
      fixture.methods.register(RuntimeServerTests.ECHO, RuntimeServerTests.ECHO_HANDLER);

      fixture.endpoint = await fixture.server.listenSocketAsync(socketPath);
      const connection = await fixture.authenticateAsync();
      connection.sendMessages(new Request("tester:1", RuntimeServerTests.ECHO, 7));

      Assert.areEqual(socketPath, fixture.endpoint.path);
      Assert.areEqual("{\"client\":\"tester\",\"payload\":7}", JSON.stringify((await connection.readResponseAsync()).payload));
      await fixture[Symbol.asyncDispose]();
      Assert.isFalse(existsSync(socketPath));
    });
  }

  @TestMethod
  public rejectsASocketPathTooLongForTheSystem(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const socketPath = path.join(folder, "x".repeat(104));
      const fixture = new RuntimeServerFixture();

      const exception = await Assert.throwsAsync(() => fixture.server.listenSocketAsync(socketPath), ArgumentException);

      Assert.areEqual(`The local socket path "${socketPath}" exceeds 103 bytes; use a data directory with a shorter path. (Parameter 'path')`, exception.message);
      await fixture.server.closeAsync();
    });
  }

  @TestMethod
  public rejectsAnEndpointItCannotListenOn(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const fixture = new RuntimeServerFixture();

      await Assert.throwsAsync(() => fixture.server.listenSocketAsync(path.join(folder, "missing", "r.sock")), Error);
    });
  }

  @TestMethod
  public failsToListenWhenClosedWhileStarting(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      const listening = fixture.server.listenTcpAsync();
      const closed = new Promise<void>(resolve => process.nextTick(() => process.nextTick(() => void fixture.server.closeAsync().then(resolve))));

      const exception = await Assert.throwsAsync(() => listening, ConnectionException);
      await closed;

      Assert.areEqual("The runtime's local endpoint has no address.", exception.message);
    }, false);
  }

  @TestMethod
  public closesConnectionsThatDoNotEndWithinTheGrace(): Promise<void> {
    return RuntimeServerTests.runAsync(undefined, async fixture => {
      await fixture.connectAsync(true);
      await RuntimeServerTests.waitForAsync(() => fixture.server.sessionCount === 1);
      const started = Date.now();

      await fixture.server.closeAsync();
      await fixture.server.closeAsync();

      await RuntimeServerTests.waitForAsync(() => fixture.server.sessionCount === 0);
      Assert.isTrue(Date.now() - started >= 1_900, "the server waits for the grace before closing");
    });
  }

  private static createWaitHandler(signals: AbortSignal[]): IMethodHandler {
    return {
      handleAsync: async (context: RequestContext): Promise<JsonValue> => {
        signals.push(context.signal);
        await once(context.signal, "abort");
        return "late";
      }
    };
  }

  private static assertFailure(response: Response, code: FailureCode, message: string, id: string | null): void {
    Assert.areEqual(id, response.id);
    Assert.areEqual(code, response.failure?.code);
    Assert.areEqual(message, response.failure?.message);
  }

  private static async waitForAsync(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 3_000;
    while (!condition()) {
      if (Date.now() >= deadline)
        throw new Error("The condition did not hold in time.");
      await delay(10);
    }
  }

  private static async runAsync(settings: ServerSettings | undefined, test: (fixture: RuntimeServerFixture) => Promise<void>, listen: boolean = true): Promise<void> {
    await using fixture = listen ? await RuntimeServerFixture.startAsync(settings) : new RuntimeServerFixture(settings);
    await test(fixture);
  }

  private static async runInFolderAsync(test: (folder: string) => Promise<void>): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("tr-srv-");
    await test(folder.path);
  }

}
