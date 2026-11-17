/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpRegistryException, ProvidersException } from "@noldova/teamrun.providers";

@TestClass
export class AcpRegistryExceptionTests {
  @TestMethod
  public carriesItsNameMessageAndCause(): void {
    const cause = new Error("cause");

    const exception = new AcpRegistryException("failed", cause);

    Assert.isInstanceOf(exception, ProvidersException);
    Assert.areEqual("AcpRegistryException", exception.name);
    Assert.areEqual("failed", exception.message);
    Assert.areEqual(cause, exception.cause);
  }
}
