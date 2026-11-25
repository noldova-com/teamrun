/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PendingRequest } from "@noldova/teamrun.providers";

@TestClass
export class PendingRequestTests {
  @TestMethod
  public async completesFailsAndStopsWhileAbortingTheDelay(): Promise<void> {
    const completed = Promise.withResolvers<JsonValue>();
    const failed = Promise.withResolvers<JsonValue>();
    const stopped = Promise.withResolvers<JsonValue>();
    const completedDelay = new AbortController();
    const failedDelay = new AbortController();
    const stoppedDelay = new AbortController();
    const completing = new PendingRequest("a", completed, completedDelay);
    const failing = new PendingRequest("b", failed, failedDelay);
    const stopping = new PendingRequest("c", stopped, stoppedDelay);

    const failure = Assert.throwsAsync(() => failed.promise, Error);
    completing.complete({ ok: true });
    failing.fail(new Error("no"));
    stopping.stopTimer();
    const abortedBeforeSettling = [completedDelay, failedDelay, stoppedDelay].map(t => t.signal.aborted).join(",");
    stopping.complete("late");

    Assert.areEqual("true,true,true", abortedBeforeSettling);
    Assert.areEqual("{\"ok\":true}", JSON.stringify(await completed.promise));
    Assert.areEqual("no", (await failure).message);
    Assert.areEqual("\"late\"", JSON.stringify(await stopped.promise));
    Assert.areEqual("a", completing.method);
  }
}
