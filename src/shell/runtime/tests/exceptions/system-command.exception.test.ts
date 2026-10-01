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
import { SystemCommandException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class SystemCommandExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("exit 5");
    const exception = new SystemCommandException("icacls.exe failed", new ExceptionOptions(cause));

    Assert.areEqual("icacls.exe failed", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("SystemCommandException", exception.name);
  }
}
