/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateStopException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UpdateStopExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("EEXIST: file already exists");

    const failure = new UpdateStopException("Another update of TeamRun is under way.", new ExceptionOptions(cause));

    Assert.areEqual("Another update of TeamRun is under way.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("UpdateStopException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
