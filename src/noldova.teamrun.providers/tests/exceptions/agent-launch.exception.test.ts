/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AgentLaunchException, ProvidersException } from "@noldova/teamrun.providers";

@TestClass
export class AgentLaunchExceptionTests {
  @TestMethod
  public carriesItsNameMessageAndCause(): void {
    const cause = new Error("cause");

    const exception = new AgentLaunchException("failed", cause);

    Assert.isInstanceOf(exception, ProvidersException);
    Assert.areEqual("AgentLaunchException", exception.name);
    Assert.areEqual("failed", exception.message);
    Assert.areEqual(cause, exception.cause);
  }
}
