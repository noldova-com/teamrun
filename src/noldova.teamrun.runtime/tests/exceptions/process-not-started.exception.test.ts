/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessNotStartedException, RuntimeException } from "@noldova/teamrun.runtime";

@TestClass
export class ProcessNotStartedExceptionTests {
  @TestMethod
  public carriesItsNameProgramMessageAndTheRefusedValue(): void {
    const refusal = { reason: "busy" };

    const exception = new ProcessNotStartedException("tool", refusal);

    Assert.isInstanceOf(exception, RuntimeException);
    Assert.areEqual("ProcessNotStartedException", exception.name);
    Assert.areEqual("tool", exception.program);
    Assert.areEqual("Noldova Desktop refused to start the program tool with a value that isn't an error.", exception.message);
    Assert.areEqual(refusal, exception.cause);
  }
}
