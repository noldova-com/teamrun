/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Response } from "@noldova/teamrun-protocol";
import { PendingCall } from "@noldova/teamrun-runtime";

@TestClass
export class PendingCallTests {
  @TestMethod
  public async settlesAndClearsTheTimer(): Promise<void> {
    let fired = 0;
    const completed = Promise.withResolvers<Response>();
    const failed = Promise.withResolvers<Response>();
    const completing = new PendingCall("a", completed, setTimeout(() => fired += 1, 5));
    const failing = new PendingCall("b", failed, setTimeout(() => fired += 1, 5));
    const failure = Assert.throwsAsync(() => failed.promise, Error);

    completing.complete(Response.success("r", null));
    failing.fail(new Error("no"));
    await new Promise(resolve => setTimeout(resolve, 20));

    Assert.areEqual("r", (await completed.promise).id);
    Assert.areEqual("no", (await failure).message);
    Assert.areEqual("a", completing.method);
    Assert.areEqual(0, fired);
  }
}
