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
import { ProductFileException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ProductFileExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new SyntaxError("Unexpected end of JSON input");

    const exception = new ProductFileException("The product file is not valid.", new ExceptionOptions(cause));

    Assert.areEqual("The product file is not valid.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ProductFileException", exception.name);
  }
}
