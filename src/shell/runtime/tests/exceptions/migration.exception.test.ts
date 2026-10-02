/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MigrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class MigrationExceptionTests {
  @TestMethod
  public namesTheFailedMigrationAndKeepsTheCause(): void {
    const cause = new Error("no such table");
    const exception = new MigrationException("create-layout", new ExceptionOptions(cause));

    Assert.areEqual("The migration create-layout of the shell database failed and was rolled back.", exception.message);
    Assert.areEqual("create-layout", exception.migrationId);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("MigrationException", exception.name);
  }
}
