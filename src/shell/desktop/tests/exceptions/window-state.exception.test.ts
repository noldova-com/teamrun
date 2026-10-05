/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowStateException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class WindowStateExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("The runtime refused the layout.");

    const failure = new WindowStateException("The window's layout could not be kept.", new ExceptionOptions(cause));

    Assert.areEqual("The window's layout could not be kept.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("WindowStateException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
