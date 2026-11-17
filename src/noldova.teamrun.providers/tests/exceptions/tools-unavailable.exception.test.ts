/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ToolsUnavailableException, ProvidersException } from "@noldova/teamrun.providers";

@TestClass
export class ToolsUnavailableExceptionTests {
  @TestMethod
  public carriesItsNameMessageAndCause(): void {
    const cause = new Error("cause");

    const exception = new ToolsUnavailableException("failed", cause);

    Assert.isInstanceOf(exception, ProvidersException);
    Assert.areEqual("ToolsUnavailableException", exception.name);
    Assert.areEqual("failed", exception.message);
    Assert.areEqual(cause, exception.cause);
  }
}
