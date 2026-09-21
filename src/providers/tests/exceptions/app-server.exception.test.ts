/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppServerException, JsonRpcError } from "@noldova/teamrun-providers";

@TestClass
export class AppServerExceptionTests {
  @TestMethod
  public composesTheMessageFromTheMethodAndTheError(): void {
    const error = new JsonRpcError(-32000, "denied", { detail: 1 });

    const exception = new AppServerException("turn/start", error);

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("turn/start: denied (code -32000)", exception.message);
    Assert.areEqual("turn/start", exception.method);
    Assert.areEqual(error, exception.error);
  }
}
