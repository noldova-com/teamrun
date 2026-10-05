/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceIdentityException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class DeviceIdentityExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("The folder is read-only.");

    const failure = new DeviceIdentityException("The device identity could not be kept.", new ExceptionOptions(cause));

    Assert.areEqual("The device identity could not be kept.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("DeviceIdentityException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
