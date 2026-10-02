/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiscoveryFormatException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DiscoveryFormatExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new SyntaxError("Unexpected token");
    const exception = new DiscoveryFormatException("not valid", new ExceptionOptions(cause));

    Assert.areEqual("not valid", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("DiscoveryFormatException", exception.name);
  }
}
