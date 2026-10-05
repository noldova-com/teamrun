/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowStateException, WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class WindowStateUnavailableExceptionTests {
  @TestMethod
  public isAWindowStateFailureWithItsMessageAndCause(): void {
    const cause = new Error("No runtime is connected.");

    const failure = new WindowStateUnavailableException("The window's layout is not available.", new ExceptionOptions(cause));

    Assert.areEqual("The window's layout is not available.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("WindowStateUnavailableException", failure.name);
    Assert.isInstanceOf(failure, WindowStateException);
  }
}
