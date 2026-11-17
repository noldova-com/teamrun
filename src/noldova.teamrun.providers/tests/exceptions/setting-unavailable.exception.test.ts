/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SettingUnavailableException, ProvidersException } from "@noldova/teamrun.providers";

@TestClass
export class SettingUnavailableExceptionTests {
  @TestMethod
  public carriesItsNameMessageAndCause(): void {
    const cause = new Error("cause");

    const exception = new SettingUnavailableException("failed", cause);

    Assert.isInstanceOf(exception, ProvidersException);
    Assert.areEqual("SettingUnavailableException", exception.name);
    Assert.areEqual("failed", exception.message);
    Assert.areEqual(cause, exception.cause);
  }
}
