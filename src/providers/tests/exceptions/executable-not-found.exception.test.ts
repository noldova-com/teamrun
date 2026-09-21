/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ExecutableNotFoundException } from "@noldova/teamrun-providers";

@TestClass
export class ExecutableNotFoundExceptionTests {
  @TestMethod
  public carriesTheMessage(): void {
    const exception = new ExecutableNotFoundException("missing");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("missing", exception.message);
  }
}
