/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NoRuntimeException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class NoRuntimeExceptionTests {
  @TestMethod
  public namesTheDataDirectory(): void {
    const exception = new NoRuntimeException("/home/person/.noldova/teamrun");

    Assert.areEqual("No runtime is running for /home/person/.noldova/teamrun.", exception.message);
    Assert.areEqual("/home/person/.noldova/teamrun", exception.root);
    Assert.areEqual("NoRuntimeException", exception.name);
  }
}
