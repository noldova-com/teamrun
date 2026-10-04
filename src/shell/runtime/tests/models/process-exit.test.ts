/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessExit } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ProcessExitTests {
  @TestMethod
  public isCleanOnlyWhenTheProgramExitedWithCodeZero(): void {
    const clean = new ProcessExit(0, null);
    const failed = new ProcessExit(2, null);
    const ended = new ProcessExit(null, "SIGTERM");

    Assert.isTrue(clean.isClean);
    Assert.isFalse(failed.isClean);
    Assert.isFalse(ended.isClean);
    Assert.areEqual(2, failed.code);
    Assert.isNull(failed.signal);
    Assert.isNull(ended.code);
    Assert.areEqual("SIGTERM", ended.signal);
  }

  @TestMethod
  public rejectsAnExitWithBothOrNeitherACodeAndASignal(): void {
    Assert.areEqual("code", Assert.throws(() => new ProcessExit(1, "SIGKILL"), ArgumentException).parameterName);
    Assert.areEqual("code", Assert.throws(() => new ProcessExit(null, null), ArgumentException).parameterName);
  }
}
