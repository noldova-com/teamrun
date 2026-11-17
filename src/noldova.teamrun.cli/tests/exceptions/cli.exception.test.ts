/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliException, CliPartException } from "@noldova/teamrun.cli";

@TestClass
export class CliExceptionTests {
  @TestMethod
  public isTheBaseOfTheCliExceptions(): void {
    const exception = new CliPartException("teamrun.listChats");

    Assert.isInstanceOf(exception, CliException);
    Assert.isInstanceOf(exception, Exception);
    Assert.isFalse(Object.hasOwn(exception, "cause"));
    Assert.areEqual("teamrun.listChats", exception.method);
    Assert.areEqual("The runtime part answered teamrun.listChats with something other than a list.", exception.message);
  }
}
