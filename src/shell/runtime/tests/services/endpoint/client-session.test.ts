/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Cancel, FailureCode, Request } from "@noldova/teamrun-shell-protocol";

import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";

@TestClass
export class ClientSessionTests {
  @TestMethod
  public cancelsARequestAndRefusesADuplicateId(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const signals: AbortSignal[] = [];
      fixture.methods.register(RuntimeServerFixture.WAIT, RuntimeServerFixture.createWaitHandler(signals));
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.WAIT, null), new Request("tester:1", RuntimeServerFixture.WAIT, null));
      RuntimeServerFixture.assertFailure(
        await connection.readResponseAsync(),
        FailureCode.InvalidMessage,
        "A request with the id tester:1 is already running on this connection.",
        "tester:1");
      connection.sendMessages(new Cancel("tester:1"));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Cancelled, "The request was cancelled.", "tester:1");
      Assert.areEqual(1, signals.length);
      Assert.areEqual(true, signals[0]?.aborted);
      connection.sendMessages(new Request("tester:2", RuntimeServerFixture.ECHO, null));
      Assert.areEqual("tester:2", (await connection.readResponseAsync()).id);
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public abortsRunningRequestsWhenTheConnectionCloses(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const signals: AbortSignal[] = [];
      const started = Promise.withResolvers<void>();
      fixture.methods.register(RuntimeServerFixture.WAIT, RuntimeServerFixture.createWaitHandler(signals, started));
      const connection = await fixture.authenticateAsync();
      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.WAIT, null));
      await started.promise;

      connection.reset();

      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);
      Assert.areEqual(true, signals[0]?.aborted);
    });
  }
}
