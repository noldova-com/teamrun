/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateHandoffException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UpdateHandoffExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateHandoffException("The AppImage could not be replaced with the update.", new ExceptionOptions(cause));

    Assert.areEqual("The AppImage could not be replaced with the update.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("UpdateHandoffException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
