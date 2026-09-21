/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ThreadStartResult } from "@noldova/teamrun-providers";

@TestClass
export class ThreadStartResultTests {
  @TestMethod
  public readsTheThreadWithAnOptionalEffort(): void {
    const withEffort = ThreadStartResult.fromJson({ thread: { id: "t-1" }, model: "gpt", reasoningEffort: "high" });
    const withoutEffort = ThreadStartResult.fromJson({ thread: { id: "t-2" }, model: "gpt" });

    Assert.areEqual("t-1", withEffort.threadId);
    Assert.areEqual("high", withEffort.reasoningEffort);
    Assert.isNull(withoutEffort.reasoningEffort);
    Assert.areEqual("threadId", Assert.throws(() => new ThreadStartResult("", "m", null), ArgumentException).parameterName);
    Assert.areEqual("model", Assert.throws(() => new ThreadStartResult("t", " ", null), ArgumentException).parameterName);
  }
}
