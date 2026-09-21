/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { SampleException } from "../fixtures/sample-exception.fixture.js";

@TestClass
export class ExceptionTests {
  @TestMethod
  public setsNameToTheConcreteClassName(): void {
    Assert.areEqual("SampleException", new SampleException("message").name);
  }

  @TestMethod
  public preservesTheMessage(): void {
    Assert.areEqual("the reason", new SampleException("the reason").message);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("root cause");
    const exception = new SampleException("outer", new ExceptionOptions(cause));

    Assert.areEqual<unknown>(cause, exception.cause);
  }

  @TestMethod
  public hasNoCauseWhenNoneIsGiven(): void {
    Assert.isUndefined(new SampleException("message").cause);
  }

  @TestMethod
  public isAnError(): void {
    Assert.isInstanceOf(new SampleException("message"), Error);
  }
}
