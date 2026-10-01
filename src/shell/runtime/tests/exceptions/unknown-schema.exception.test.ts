/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UnknownSchemaException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class UnknownSchemaExceptionTests {
  @TestMethod
  public keepsTheReason(): void {
    const exception = new UnknownSchemaException("newer");

    Assert.areEqual("newer", exception.message);
    Assert.areEqual("UnknownSchemaException", exception.name);
  }
}
