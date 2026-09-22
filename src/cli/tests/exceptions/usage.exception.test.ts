/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UsageException } from "@noldova/teamrun-cli";

@TestClass
export class UsageExceptionTests {
  @TestMethod
  public carriesTheMessage(): void {
    const exception = new UsageException("missing");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("missing", exception.message);
  }
}
