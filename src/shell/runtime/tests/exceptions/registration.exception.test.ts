/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RegistrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RegistrationExceptionTests {
  @TestMethod
  public keepsTheMessage(): void {
    const exception = new RegistrationException("The method notes.open is already registered.");

    Assert.areEqual("The method notes.open is already registered.", exception.message);
    Assert.areEqual("RegistrationException", exception.name);
  }
}
