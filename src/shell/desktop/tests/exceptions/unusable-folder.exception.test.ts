/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UnusableFolderException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UnusableFolderExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("Failed to set path");

    const failure = new UnusableFolderException("TeamRun cannot use the data folder /home/person/data: Error: Failed to set path", new ExceptionOptions(cause));

    Assert.areEqual("TeamRun cannot use the data folder /home/person/data: Error: Failed to set path", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("UnusableFolderException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
