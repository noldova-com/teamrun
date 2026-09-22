/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Event, Hello, ProtocolVersion, Response } from "@noldova/teamrun-protocol";
import { ConnectionException, RuntimeClient, RuntimeTimings } from "@noldova/teamrun-runtime";

import { RawServer } from "../../fixtures/raw-server.fixture.js";
import { RecordingClientListener } from "../../fixtures/recording-client-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class RuntimeClientTests {
  private static readonly timings: RuntimeTimings = new RuntimeTimings(200, 200, 1000, 20);

  @TestMethod
  @TestData(0, 0)
  @TestData(0, 2)
  @TestData(1, 1)
  public async rejectsIncompatibleWelcomeVersionsBeforeDeliveringEvents(major: number, minor: number): Promise<void> {
    await using server = new RawServer();
    const version = new ProtocolVersion(major, minor);
    server.linesOnConnect = [
      new Event("before-welcome", null).toText(),
      Response.success(null, version.toJson()).toText(),
      new Event("after-refusal", null).toText()
    ];
    const listener = new RecordingClientListener();
    const endpoint = await server.start();

    const failure = await Assert.throwsAsync(() => RuntimeClient.connect(endpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    await Wait.until(() => listener.disconnections === 1);

    Assert.areEqual(ErrorCode.VersionMismatch, failure.info?.name);
    Assert.areEqual("0.1", failure.info?.arguments[0]);
    Assert.areEqual(version.toString(), failure.info?.arguments[1]);
    Assert.areEqual(0, listener.events.length);
  }

  @TestMethod
  @TestData(null)
  @TestData({ major: 0, minor: "1" })
  public async rejectsMalformedWelcomeVersionsWithoutAnUnhandledError(payload: JsonValue): Promise<void> {
    await using server = new RawServer();
    server.linesOnConnect = [Response.success(null, payload).toText()];
    const listener = new RecordingClientListener();
    const endpoint = await server.start();

    const failure = await Assert.throwsAsync(() => RuntimeClient.connect(endpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    await Wait.until(() => listener.disconnections === 1);

    Assert.areEqual(ErrorCode.InvalidParams, failure.info?.name);
    Assert.areEqual("The runtime returned an invalid protocol version.", failure.message);
  }

  @TestMethod
  public async rejectsPendingCallsAfterAnEstablishedConnectionResets(): Promise<void> {
    await using server = new RawServer();
    server.linesOnConnect = [Response.success(null, ProtocolVersion.current.toJson()).toText()];
    const endpoint = await server.start();
    const listener = new RecordingClientListener();
    const client = await RuntimeClient.connect(endpoint, "t", "c", listener, new RuntimeTimings(200, 5000, 1000, 20));
    try {
      const pending = Assert.throwsAsync(() => client.call("never/answered", null), ConnectionException);
      await Wait.until(() => server.received.length === 2);
      server.sockets[0]?.resetAndDestroy();
      const failure = await pending;
      await Wait.until(() => listener.disconnections === 1);
      Assert.areEqual("The connection to the runtime is closed.", failure.message);
      Assert.isFalse(client.isConnected);
    }
    finally {
      client.close();
    }
  }

  @TestMethod
  public async reportsConnectionFailures(): Promise<void> {
    await using server = new RawServer();
    const endpoint = await server.start();
    await server.stop();
    await using silent = new RawServer();
    const silentEndpoint = await silent.start();
    await using refusing = new RawServer();
    refusing.linesOnConnect = [Response.failure(null, new ServiceResponseInfo(ErrorCode.Unauthorized, "go away")).toText()];
    const refusingEndpoint = await refusing.start();
    const listener = new RecordingClientListener();

    const refused = await Assert.throwsAsync(() => RuntimeClient.connect(endpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    const timedOut = await Assert.throwsAsync(() => RuntimeClient.connect(silentEndpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    const rejected = await Assert.throwsAsync(() => RuntimeClient.connect(refusingEndpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    await silent.stop();
    await refusing.stop();

    Assert.isNull(refused.info);
    Assert.areEqual("The runtime did not answer the hello in time.", timedOut.message);
    Assert.areEqual("go away", rejected.message);
    Assert.areEqual(ErrorCode.Unauthorized, rejected.info?.name);
    Assert.areEqual(1, silent.received.length);
    Assert.isTrue(silent.received[0]?.includes("\"kind\":\"Hello\"") ?? false);
    await Assert.throwsAsync(() => RuntimeClient.connect(endpoint, "t", " ", listener, RuntimeClientTests.timings), ArgumentException);
  }

  @TestMethod
  public async ignoresNoiseAndTimesOutCalls(): Promise<void> {
    await using server = new RawServer();
    server.linesOnConnect = [
      "garbage",
      new Hello(ProtocolVersion.current, "t", "server").toText(),
      Response.success("unknown-9", null).toText(),
      Response.success(null, ProtocolVersion.current.toJson()).toText(),
      Response.success(null, new ProtocolVersion(9, 9).toJson()).toText(),
      new Event("custom/event", { a: 1 }).toText()
    ];
    const endpoint = await server.start();
    const listener = new RecordingClientListener();

    const client = await RuntimeClient.connect(endpoint, "t", "c", listener, RuntimeClientTests.timings);
    await Wait.until(() => listener.events.length === 1);
    const timedOut = await Assert.throwsAsync(() => client.call("slow/method", null), ConnectionException);
    server.write(Response.success("c-1", "late").toText());
    const answered = client.call("fast/method", { x: 1 });
    await Wait.until(() => server.received.length === 3);
    server.write(Response.success("c-2", "ok").toText());
    const response = await answered;
    client.close();
    await Wait.until(() => listener.disconnections === 1);
    const afterClose = await Assert.throwsAsync(() => client.call("any", null), ConnectionException);
    await server.stop();

    Assert.areEqual("custom/event", listener.events[0]?.name);
    Assert.areEqual("The runtime did not answer slow/method within the timeout.", timedOut.message);
    Assert.areEqual("ok", response.payload);
    Assert.isFalse(client.isConnected);
    Assert.areEqual("The connection to the runtime is closed.", afterClose.message);
    Assert.isTrue(client.version?.equals(ProtocolVersion.current) ?? false);
  }

  @TestMethod
  public async failsPendingCallsWhenTheRuntimeDisappears(): Promise<void> {
    await using server = new RawServer();
    server.linesOnConnect = [Response.success(null, ProtocolVersion.current.toJson()).toText()];
    const endpoint = await server.start();
    const listener = new RecordingClientListener();
    const client = await RuntimeClient.connect(endpoint, "t", "c", listener, new RuntimeTimings(200, 5000, 1000, 20));

    const pending = Assert.throwsAsync(() => client.call("never/answered", null), ConnectionException);
    await Wait.until(() => server.received.length === 2);
    await server.stop();
    const failure = await pending;
    await Wait.until(() => listener.disconnections === 1);

    Assert.areEqual("The connection to the runtime is closed.", failure.message);
  }

  @TestMethod
  public async treatsAResetAsADisconnection(): Promise<void> {
    await using server = new RawServer();
    server.resetOnConnect = true;
    const endpoint = await server.start();
    const listener = new RecordingClientListener();

    const failure = await Assert.throwsAsync(() => RuntimeClient.connect(endpoint, "t", "c", listener, RuntimeClientTests.timings), ConnectionException);
    await server.stop();

    Assert.isNull(failure.info);
  }
}
