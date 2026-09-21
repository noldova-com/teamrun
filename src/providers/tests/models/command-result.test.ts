/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandResult } from "@noldova/teamrun-providers";

@TestClass
export class CommandResultTests {
  @TestMethod
  public reportsSuccessAndPrefersStandardOutput(): void {
    const success = new CommandResult(0, null, " out \n", "err", false);
    const failure = new CommandResult(1, null, "", " err ", false);
    const timedOut = new CommandResult(0, "SIGTERM", "x", "", true);

    Assert.isTrue(success.succeeded);
    Assert.areEqual("out", success.output);
    Assert.isFalse(failure.succeeded);
    Assert.areEqual("err", failure.output);
    Assert.isFalse(timedOut.succeeded);
    Assert.areEqual("SIGTERM", timedOut.signal);
  }
}
