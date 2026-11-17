/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessNotStartedException, RuntimeException, RuntimePartException } from "@noldova/teamrun.runtime";

@TestClass
export class RuntimeExceptionTests {
  @TestMethod
  public carriesACauseOnlyWhenGivenOne(): void {
    const refusal = { reason: "busy" };

    const withCause = new ProcessNotStartedException("tool", refusal);
    const withoutCause = new RuntimePartException("not ready");

    Assert.isInstanceOf(withCause, RuntimeException);
    Assert.isInstanceOf(withCause, Exception);
    Assert.areEqual(refusal, withCause.cause);
    Assert.isInstanceOf(withoutCause, RuntimeException);
    Assert.isInstanceOf(withoutCause, Exception);
    Assert.isFalse(Object.hasOwn(withoutCause, "cause"));
  }
}
