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
import { ProcessStartException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ProcessStartExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("ENOENT");

    const exception = new ProcessStartException("git could not be started.", new ExceptionOptions(cause));

    Assert.areEqual("git could not be started.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ProcessStartException", exception.name);
  }
}
