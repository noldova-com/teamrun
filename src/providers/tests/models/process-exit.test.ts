/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessExit } from "@noldova/teamrun-providers";

@TestClass
export class ProcessExitTests {
  @TestMethod
  public keepsCodeAndSignal(): void {
    const exit = new ProcessExit(null, "SIGKILL");

    Assert.isNull(exit.code);
    Assert.areEqual("SIGKILL", exit.signal);
  }
}
