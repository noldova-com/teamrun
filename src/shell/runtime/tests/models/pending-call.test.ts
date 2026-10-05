/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, type RequestContext, RuntimeClient } from "@noldova/teamrun-shell-runtime";

import { RuntimeClientFixture } from "../fixtures/runtime-client.fixture.js";
import { RuntimeServerFixture } from "../fixtures/runtime-server.fixture.js";

@TestClass
export class PendingCallTests {
  @TestMethod
  public rejectsPendingCallsWhenTheConnectionCloses(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeServerFixture.WAIT, { handleAsync: (context: RequestContext) => once(context.signal, "abort").then(() => null) });
      const client = await RuntimeClientFixture.connectAsync(fixture, listener);

      const call = client.callAsync(RuntimeServerFixture.WAIT, null);
      client.close();

      const exception = await Assert.throwsAsync(() => call, ConnectionException);

      Assert.areEqual("The connection to the runtime is closed.", exception.message);
      Assert.areEqual(FailureCode.Disconnected, exception.failure?.code);
    });
  }

  @TestMethod
  public givesUpOnACallTheRuntimeDoesNotAnswer(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : [],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "desktop", listener, RuntimeClientFixture.SETTINGS);
        const started = Date.now();

        const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeServerFixture.ECHO, null, 50), ConnectionException);

        Assert.areEqual("The runtime did not answer notes.echo in time.", exception.message);
        Assert.isNull(exception.failure);
        Assert.isTrue(Date.now() - started >= 90, "the client waits for the time limit and the grace");
        Assert.isTrue(client.isConnected);
      });
  }
}
