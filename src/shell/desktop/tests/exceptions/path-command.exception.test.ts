/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PathCommandException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class PathCommandExceptionTests {
  @TestMethod
  public carriesItsMessageAndCause(): void {
    const cause = new Error("EACCES: permission denied, symlink");

    const failure = new PathCommandException("The teamrun command could not be linked at /usr/local/bin/teamrun.", new ExceptionOptions(cause));

    Assert.areEqual("The teamrun command could not be linked at /usr/local/bin/teamrun.", failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("PathCommandException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
