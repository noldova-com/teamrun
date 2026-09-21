/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { JsonException } from "@noldova/teamrun-foundation-json";

@TestClass
export class JsonExceptionTests {
  @TestMethod
  public isAnExceptionCarryingThePath(): void {
    const exception = new JsonException("The field is required.", "$.id");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("$.id: The field is required.", exception.message);
    Assert.areEqual("$.id", exception.path);
    Assert.isUndefined(exception.cause);
  }

  @TestMethod
  public preservesTheCause(): void {
    const cause = new Error("bad json");
    const exception = new JsonException("The text is not valid JSON.", "$", new ExceptionOptions(cause));

    Assert.areEqual(cause, exception.cause);
  }
}
