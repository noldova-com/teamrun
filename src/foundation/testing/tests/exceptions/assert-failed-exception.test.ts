/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, AssertFailedException, TestClass, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class AssertFailedExceptionTests {
  @TestMethod
  public defaultsTheMessage(): void {
    Assert.areEqual("Assertion failed.", new AssertFailedException().message);
  }

  @TestMethod
  public carriesTheExpectedAndActualValues(): void {
    const exception = new AssertFailedException("mismatch", 1, 2);

    Assert.areEqual("mismatch", exception.message);
    Assert.areEqual<unknown>(1, exception.expected);
    Assert.areEqual<unknown>(2, exception.actual);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");
    const exception = new AssertFailedException("mismatch", 1, 2, new ExceptionOptions(cause));

    Assert.areEqual<unknown>(cause, exception.cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("AssertFailedException", new AssertFailedException().name);
  }

  @TestMethod
  public isATestingException(): void {
    Assert.isInstanceOf(new AssertFailedException(), TestingException);
  }
}
