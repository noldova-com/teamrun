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
import { LaunchException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class LaunchExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("ENOENT");

    const exception = new LaunchException("The runtime could not be started with node.", new ExceptionOptions(cause));

    Assert.areEqual("The runtime could not be started with node.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("LaunchException", exception.name);
  }
}
