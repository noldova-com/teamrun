/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PreShellData } from "@noldova/teamrun-shell-protocol";
import { PreShellDataFoundException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class PreShellDataFoundExceptionTests {
  @TestMethod
  public namesWhereTheOldDataIs(): void {
    const data = new PreShellData("/home/person/.noldova/teamrun");

    const exception = new PreShellDataFoundException(data);

    Assert.areEqual("The data directory /home/person/.noldova/teamrun holds data from a TeamRun release that predates the shell.", exception.message);
    Assert.areEqual(data, exception.data);
    Assert.areEqual("PreShellDataFoundException", exception.name);
  }
}
