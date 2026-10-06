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
import { AddonLoadException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class AddonLoadExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("The specified module could not be found.");

    const exception = new AddonLoadException("The runtime could not load its Windows addon.", new ExceptionOptions(cause));

    Assert.areEqual("The runtime could not load its Windows addon.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("AddonLoadException", exception.name);
  }
}
