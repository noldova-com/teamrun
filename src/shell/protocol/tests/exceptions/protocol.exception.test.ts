/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, ProtocolException } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ProtocolExceptionTests {
  @TestMethod
  public carriesTheCodeTheMessageAndTheCause(): void {
    const cause = new Error("cause");
    const exception = new ProtocolException(FailureCode.FrameTooLarge, "Too large.", new ExceptionOptions(cause));

    Assert.areEqual(FailureCode.FrameTooLarge, exception.code);
    Assert.areEqual("Too large.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("ProtocolException", exception.name);
    Assert.isInstanceOf(exception, Exception);
  }
}
