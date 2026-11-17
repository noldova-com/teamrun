/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InvalidOperationException } from "@noldova/teamrun.providers";

@TestClass
export class InvalidOperationExceptionTests {
  @TestMethod
  public carriesTheMessage(): void {
    const exception = new InvalidOperationException("too early");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("InvalidOperationException", exception.name);
    Assert.areEqual("too early", exception.message);
  }
}
