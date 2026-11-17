/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallFailedException, ProvidersException } from "@noldova/teamrun.providers";

@TestClass
export class ProvidersExceptionTests {
  @TestMethod
  public isTheBaseOfTheProvidersExceptionsAndKeepsTheirCause(): void {
    const cause = new Error("EACCES");

    const exception = new InstallFailedException("not placed", cause);

    Assert.isInstanceOf(exception, ProvidersException);
    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual(cause, exception.cause);
  }

  @TestMethod
  public hasNoCauseWhenNoneIsGiven(): void {
    const exception = new InstallFailedException("not placed");

    Assert.isFalse(Object.hasOwn(exception, "cause"));
  }
}
