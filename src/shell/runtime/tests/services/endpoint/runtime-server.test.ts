/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

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
  MethodFailureException,
  Refusal,
  ServerSettings
} from "@noldova/teamrun-shell-runtime";

import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";

@TestClass
export class RuntimeServerTests {
  private static readonly MOVE: QualifiedName = new QualifiedName("notes", "move");
  private static readonly LARGE: QualifiedName = new QualifiedName("notes", "large");
  private static readonly BROKEN: QualifiedName = new QualifiedName("notes", "broken");
  @TestMethod
  public answersTheHandshakeWithItsIdentityAndServesRequests(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(64 * 1024, 100, 1_000, 2_000), async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("desktop");
      const silent = await fixture.connectAsync();
      await silent.waitForCloseAsync();
      connection.sendMessages(new Request("desktop:1", RuntimeServerFixture.ECHO, { path: "notes.md" }));
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
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const [connection, answer] = await fixture.handshakeAsync("desktop", RuntimeServerFixture.IDENTITY, "guess");

      RuntimeServerFixture.assertFailure(answer, FailureCode.Unauthorized, "The capability token is not valid for this runtime.", "desktop:0");
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public requiresTheHandshakeFirstAndIgnoresWhatFollows(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.connectAsync();

      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.ECHO, null), new Request("tester:2", RuntimeServerFixture.ECHO, null));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "A connection must begin with a handshake.", null);
      await connection.waitForCloseAsync();
      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
    });
  }

  @TestMethod
  public closesAConnectionThatSendsNoHandshakeInTime(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 100, 1_000, 1_000), async fixture => {
      const connection = await fixture.connectAsync();

      await connection.waitForCloseAsync();

      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);
      Assert.areEqual(2, fixture.changes);
    });
  }

  @TestMethod
  public endsAConnectionWhoseFirstFrameIsInvalid(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const connection = await fixture.connectAsync();

      connection.send("not json\n");

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public keepsAnAuthenticatedConnectionAfterAnInvalidFrame(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.authenticateAsync();

      connection.send(`{"kind":"Unknown"}\n${new Request("tester:1", RuntimeServerFixture.ECHO, 1).toText()}\n`);

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      Assert.areEqual("{\"client\":\"tester\",\"payload\":1}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public endsAConnectionThatSendsAnOversizedFrame(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.send("x".repeat(2_048));

      const response = await connection.readResponseAsync();
      Assert.areEqual(FailureCode.FrameTooLarge, response.failure?.code);
      Assert.isNull(response.id);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public answersAnAnswerItCannotSendWithAFailureAndKeepsTheConnection(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerTests.LARGE, { handleAsync: () => Promise.resolve("x".repeat(2_048)) });
      fixture.methods.register(RuntimeServerTests.BROKEN, { handleAsync: () => Promise.resolve(RuntimeServerTests.loop()) });
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerTests.LARGE, null),
        new Request("tester:2", RuntimeServerTests.BROKEN, null),
        new Request("tester:3", RuntimeServerFixture.ECHO, 1));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.FrameTooLarge, "A frame exceeds the maximum length of 1024 characters.", "tester:1");
      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Internal, "The runtime failed to handle the request.", "tester:2");
      Assert.areEqual("{\"client\":\"tester\",\"payload\":1}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public logsAnEventItCannotSendAndSendsItToNoClient(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      const first = await fixture.authenticateAsync("first");
      const second = await fixture.authenticateAsync("second");

      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "x".repeat(2_048)));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, RuntimeServerTests.loop()));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "small"));

      Assert.areEqual("\"small\"|\"small\"", `${JSON.stringify((await first.readEventAsync()).payload)}|${JSON.stringify((await second.readEventAsync()).payload)}`);
      const entries = fixture.diagnostics.text.split("The runtime sent the event notes.echo to no client: ").slice(1);
      Assert.areEqual(2, entries.length);
      Assert.areEqual("ProtocolException: A frame exceeds the maximum length of 1024 characters.\n", entries[0]);
      Assert.isTrue(entries[1]?.startsWith("TypeError: Converting circular structure to JSON") === true);
      Assert.isFalse(first.isClosed || second.isClosed);
    });
  }

  @TestMethod
  public answersUnknownMethodsAndUnexpectedMessages(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerFixture.ECHO, null),
        new Handshake("tester:2", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, "tester"),
        new Event(RuntimeServerFixture.ECHO, null),
        Response.success("tester:3", null),
        new Cancel("tester:9"));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.UnknownMethod, "The method notes.echo is not registered.", "tester:1");
      for (let index = 0; index < 3; index++)
        RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "Only requests and cancellations may follow the handshake.", null);
      connection.sendMessages(new Request("tester:4", RuntimeServerFixture.ECHO, null));
      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.UnknownMethod, "The method notes.echo is not registered.", "tester:4");
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public endsRequestsAtTheirDeadline(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(64 * 1024, 1_000, 100, 200), async fixture => {
      fixture.methods.register(RuntimeServerFixture.WAIT, RuntimeServerFixture.createWaitHandler([]));
      const connection = await fixture.authenticateAsync();
      const started = Date.now();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerFixture.WAIT, null, 20),
        new Request("tester:2", RuntimeServerFixture.WAIT, null),
        new Request("tester:3", RuntimeServerFixture.WAIT, null, 60_000));

      for (const id of ["tester:1", "tester:2", "tester:3"])
        RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.DeadlineExceeded, "The request did not finish within its time limit.", id);
      Assert.isTrue(Date.now() - started < 2_000, "the maximum limits the requested time");
    });
  }

  @TestMethod
  public describesHandlerFailures(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
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
  public letsAnotherBuildOnlyAskItToStop(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.stop, RuntimeServerFixture.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("older", RuntimeServerFixture.OTHER_IDENTITY);
      connection.sendMessages(new Request("older:1", RuntimeServerFixture.ECHO, null), new Request("older:2", ShellMethods.stop, { policy: "IfIdle" }));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "not for other builds"));

      Assert.areEqual(
        `{"kind":"Response","id":"older:0","failure":{"code":"BuildMismatch","message":"Another build of TeamRun owns this data directory.",`
        + `"details":{"identity":{"productVersion":"1.2.3","protocolVersion":1,"fingerprint":"server-build"},"executablePath":"/opt/teamrun/teamrun"}}}`,
        answer.toText());
      RuntimeServerFixture.assertFailure(
        await connection.readResponseAsync(),
        FailureCode.BuildMismatch,
        "A connection from another build may only ask the runtime to stop.",
        "older:1");
      Assert.areEqual("{\"client\":\"older\",\"payload\":{\"policy\":\"IfIdle\"}}", JSON.stringify((await connection.readResponseAsync()).payload));
      connection.sendMessages(new Request("older:3", ShellMethods.stop, { policy: "IfIdle" }));
      Assert.areEqual("older:3", (await connection.readResponseAsync()).id);
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public answersALaterProtocolVersionWithTheHandover(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const later = new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion + 1, "later-build");

      const [connection, answer] = await fixture.handshakeAsync("later", later);

      Assert.areEqual(FailureCode.BuildMismatch, answer.failure?.code);
      Assert.areEqual(JSON.stringify(new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE).toJson()), JSON.stringify(answer.failure?.details));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public servesOnlyTheRefusalsMethodUntilItAdmits(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerTests.MOVE, RuntimeServerFixture.ECHO_HANDLER);
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [refused, answer] = await fixture.handshakeAsync("desktop");
      refused.sendMessages(new Request("desktop:1", RuntimeServerFixture.ECHO, null), new Request("desktop:2", RuntimeServerTests.MOVE, null));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "not for refused connections"));

      Assert.areEqual(JSON.stringify(Response.failure("desktop:0", failure).toJson()), JSON.stringify(answer.toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("desktop:1", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual("desktop:2", (await refused.readResponseAsync()).id);
      fixture.server.admit();
      await refused.waitForCloseAsync();
      await Assert.throwsAsync(() => refused.readTextAsync(), Error);
      const admitted = await fixture.authenticateAsync("desktop");
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "for everyone"));
      Assert.areEqual("\"for everyone\"", JSON.stringify((await admitted.readEventAsync()).payload));
    });
  }

  @TestMethod
  public servesStopButNoOtherMethodToARefusedConnection(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.methods.register(ShellMethods.stop, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.settings, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [refused] = await fixture.handshakeAsync("desktop");
      refused.sendMessages(
        new Request("desktop:1", ShellMethods.settings, null),
        new Request("desktop:2", RuntimeServerFixture.ECHO, null),
        new Request("desktop:3", ShellMethods.stop, { policy: "StopWork" }));

      Assert.areEqual(JSON.stringify(Response.failure("desktop:1", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("desktop:2", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual("{\"client\":\"desktop\",\"payload\":{\"policy\":\"StopWork\"}}", JSON.stringify((await refused.readResponseAsync()).payload));
    });
  }

  @TestMethod
  public listensOnALocalSocketAndRemovesItWhenClosed(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\teamrun-test-${path.basename(folder)}` : path.join(folder, "runtime.sock");
      if (process.platform !== "win32")
        await writeFile(socketPath, "stale");
      const fixture = new RuntimeServerFixture();
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);

      fixture.endpoint = await fixture.server.listenSocketAsync(socketPath);
      const connection = await fixture.authenticateAsync();
      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.ECHO, 7));

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
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const listening = fixture.server.listenTcpAsync();
      const closed = new Promise<void>(resolve => process.nextTick(() => process.nextTick(() => void fixture.server.closeAsync().then(resolve))));

      const exception = await Assert.throwsAsync(() => listening, ConnectionException);
      await closed;

      Assert.areEqual("The runtime's local endpoint has no address.", exception.message);
    }, false);
  }

  @TestMethod
  public closesConnectionsThatDoNotEndWithinTheGrace(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      await fixture.connectAsync(true);
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 1);
      const started = Date.now();

      await fixture.server.closeAsync();
      await fixture.server.closeAsync();

      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);
      Assert.isTrue(Date.now() - started >= 1_900, "the server waits for the grace before closing");
    });
  }

  private static loop(): JsonValue[] {
    const loop: JsonValue[] = [];
    loop.push(loop);
    return loop;
  }

  private static async runInFolderAsync(test: (folder: string) => Promise<void>): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("tr-srv-");
    await test(folder.path);
  }
}
