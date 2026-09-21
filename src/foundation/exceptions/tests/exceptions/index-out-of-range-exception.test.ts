/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions, IndexOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class IndexOutOfRangeExceptionTests {
  @TestMethod
  public defaultsTheMessage(): void {
    Assert.areEqual("The index must be within the valid range.", new IndexOutOfRangeException().message);
  }

  @TestMethod
  public acceptsACustomMessageAndCause(): void {
    const cause = new Error("cause");
    const failure = new IndexOutOfRangeException("Invalid index.", new ExceptionOptions(cause));

    Assert.areEqual("Invalid index.", failure.message);
    Assert.areEqual(cause, failure.cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("IndexOutOfRangeException", new IndexOutOfRangeException().name);
  }

  @TestMethod
  public isAnException(): void {
    Assert.isInstanceOf(new IndexOutOfRangeException(), Exception);
  }
}
