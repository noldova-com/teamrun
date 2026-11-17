/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CoreException, Resources, TimeoutException } from "@noldova/teamrun.core";

@TestClass
export class TimeoutExceptionTests {
  @TestMethod
  public carriesTheMessageAndNamesItsKindForALogLine(): void {
    const exception = new TimeoutException("The ACP agent did not answer session.delete in time.");

    Assert.isInstanceOf(exception, CoreException);
    Assert.areEqual("TimeoutException", exception.name);
    Assert.areEqual("The ACP agent did not answer session.delete in time.", exception.message);
    Assert.areEqual("TimeoutException", Resources.formatFailureKind(exception));
  }
}
