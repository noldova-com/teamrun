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
import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
import { ConnectionException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ConnectionExceptionTests {
  @TestMethod
  public carriesTheRuntimesFailure(): void {
    const failure = new Failure(FailureCode.Unauthorized, "The capability token is not valid for this runtime.");

    const exception = new ConnectionException(failure.message, failure);

    Assert.areEqual("The capability token is not valid for this runtime.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.areEqual("ConnectionException", exception.name);
  }

  @TestMethod
  public hasNoFailureWhenTheRuntimeGaveNone(): void {
    const cause = new Error("ECONNREFUSED");

    const exception = new ConnectionException("The runtime cannot be reached.", null, new ExceptionOptions(cause));

    Assert.isNull(exception.failure);
    Assert.areEqual(cause, exception.cause);
    Assert.isNull(new ConnectionException("closed").failure);
  }
}
