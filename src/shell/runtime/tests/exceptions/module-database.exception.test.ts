/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ModuleDatabaseException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ModuleDatabaseExceptionTests {
  @TestMethod
  public keepsTheReason(): void {
    const exception = new ModuleDatabaseException("The module notes has no database.");

    Assert.areEqual("The module notes has no database.", exception.message);
    Assert.areEqual("ModuleDatabaseException", exception.name);
  }
}
