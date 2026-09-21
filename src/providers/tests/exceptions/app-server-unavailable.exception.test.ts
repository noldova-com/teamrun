/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppServerUnavailableException } from "@noldova/teamrun-providers";

@TestClass
export class AppServerUnavailableExceptionTests {
  @TestMethod
  public carriesTheMessage(): void {
    const exception = new AppServerUnavailableException("gone");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("gone", exception.message);
  }
}
