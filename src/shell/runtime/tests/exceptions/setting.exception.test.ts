/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode } from "@noldova/teamrun-shell-protocol";
import { MethodFailureException, SettingException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class SettingExceptionTests {
  @TestMethod
  public answersWithItsMessageAndCodeAsAMethodFailure(): void {
    const exception = new SettingException("The setting chat.send is not declared.", FailureCode.NotFound);

    Assert.areEqual("The setting chat.send is not declared.", exception.message);
    Assert.areEqual(FailureCode.NotFound, exception.failure.code);
    Assert.areEqual("The setting chat.send is not declared.", exception.failure.message);
    Assert.isInstanceOf(exception, MethodFailureException);
    Assert.areEqual("SettingException", exception.name);
  }
}
