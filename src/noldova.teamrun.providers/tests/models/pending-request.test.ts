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
  public async completesFailsAndStopsWhileClearingTheTimer(): Promise<void> {
    let fired = 0;
    const completed = Promise.withResolvers<JsonValue>();
    const failed = Promise.withResolvers<JsonValue>();
    const completing = new PendingRequest("a", completed, setTimeout(() => fired += 1, 5));
    const failing = new PendingRequest("b", failed, setTimeout(() => fired += 1, 5));
    const stopped = Promise.withResolvers<JsonValue>();
    const stopping = new PendingRequest("c", stopped, setTimeout(() => fired += 1, 5));

    const failure = Assert.throwsAsync(() => failed.promise, Error);
    completing.complete({ ok: true });
    failing.fail(new Error("no"));
    stopping.stopTimer();
    await new Promise(resolve => setTimeout(resolve, 20));
    stopping.complete("late");

    Assert.areEqual("{\"ok\":true}", JSON.stringify(await completed.promise));
    Assert.areEqual("no", (await failure).message);
    Assert.areEqual("\"late\"", JSON.stringify(await stopped.promise));
    Assert.areEqual("a", completing.method);
    Assert.areEqual(0, fired);
  }
}
