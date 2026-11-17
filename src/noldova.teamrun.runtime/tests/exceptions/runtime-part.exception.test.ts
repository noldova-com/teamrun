/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeException, RuntimePartException } from "@noldova/teamrun.runtime";

@TestClass
export class RuntimePartExceptionTests {
  @TestMethod
  public carriesTheMessage(): void {
    const exception = new RuntimePartException("stopped");

    Assert.isInstanceOf(exception, RuntimeException);
    Assert.isInstanceOf(exception, Exception);
    Assert.isFalse(Object.hasOwn(exception, "cause"));
    Assert.areEqual("RuntimePartException", exception.name);
    Assert.areEqual("stopped", exception.message);
  }
}
