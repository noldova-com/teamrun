/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectoryOwnedException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DataDirectoryOwnedExceptionTests {
  @TestMethod
  public namesTheOwnedDirectoryAndKeepsTheCause(): void {
    const cause = new Error("database is locked");
    const exception = new DataDirectoryOwnedException("/data/teamrun", new ExceptionOptions(cause));

    Assert.areEqual("Another TeamRun runtime owns the data directory /data/teamrun.", exception.message);
    Assert.areEqual("/data/teamrun", exception.root);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("DataDirectoryOwnedException", exception.name);
    Assert.isInstanceOf(exception, Exception);
  }
}
