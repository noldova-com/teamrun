/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestingExceptionTests {
  @TestMethod
  public carriesTheViolationMessage(): void {
    Assert.areEqual("violation", new TestingException("violation").message);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("cause");

    Assert.areEqual<unknown>(cause, new TestingException("violation", new ExceptionOptions(cause)).cause);
  }

  @TestMethod
  public setsTheName(): void {
    Assert.areEqual("TestingException", new TestingException("violation").name);
  }

  @TestMethod
  public isAnException(): void {
    Assert.isInstanceOf(new TestingException("violation"), Exception);
  }
}
