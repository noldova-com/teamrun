/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class DataExceptionTests {
  @TestMethod
  public isAnExceptionWithTheGivenMessageAndCause(): void {
    const cause = new Error("disk full");
    const exception = new DataException("The write failed.", new ExceptionOptions(cause));

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("The write failed.", exception.message);
    Assert.areEqual(cause, exception.cause);
  }
}
