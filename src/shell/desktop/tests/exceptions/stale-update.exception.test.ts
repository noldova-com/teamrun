/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StaleUpdateException, UpdateHandoffException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class StaleUpdateExceptionTests {
  @TestMethod
  public carriesItsMessageAndCauseAsAHandoffFailure(): void {
    const cause = new Error("The hash changed.");

    const failure = new StaleUpdateException("The update changed before it could be installed.", new ExceptionOptions(cause));

    Assert.areEqual("The update changed before it could be installed.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("StaleUpdateException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
