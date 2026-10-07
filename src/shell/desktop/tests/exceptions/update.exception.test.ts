/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UpdateExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("net::ERR_INTERNET_DISCONNECTED");

    const failure = new UpdateException("The download was interrupted.", new ExceptionOptions(cause));

    Assert.areEqual("The download was interrupted.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("UpdateException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
