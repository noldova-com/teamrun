/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProgramException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class ProgramExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("spawn /usr/bin/gdbus ENOENT");

    const failure = new ProgramException("/usr/bin/gdbus failed: spawn /usr/bin/gdbus ENOENT", new ExceptionOptions(cause));

    Assert.areEqual("/usr/bin/gdbus failed: spawn /usr/bin/gdbus ENOENT", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("ProgramException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
