/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestingException, TestMethod, TestTimeoutException } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestTimeoutExceptionTests {
  @TestMethod
  public carriesTheTimeout(): void {
    Assert.areEqual(250, new TestTimeoutException(250).timeoutMilliseconds);
  }

  @TestMethod
  public usesTheCanonicalMessage(): void {
    Assert.areEqual("The test did not settle within the allotted timeout.", new TestTimeoutException(250).message);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");

    Assert.areEqual<unknown>(cause, new TestTimeoutException(250, new ExceptionOptions(cause)).cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("TestTimeoutException", new TestTimeoutException(250).name);
  }

  @TestMethod
  public isATestingException(): void {
    Assert.isInstanceOf(new TestTimeoutException(250), TestingException);
  }

  @TestMethod
  public rejectsAnInvalidTimeout(): void {
    const exception = Assert.throws(() => new TestTimeoutException(0), ArgumentOutOfRangeException);

    Assert.areEqual("timeoutMilliseconds", exception.parameterName);
    Assert.throws(() => new TestTimeoutException(0.5), ArgumentOutOfRangeException);
  }
}
