/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpRequestException } from "@noldova/teamrun.providers";

@TestClass
export class AcpRequestExceptionTests {
  @TestMethod
  public keepsTheAgentsMessageAndItsErrorCode(): void {
    const exception = new AcpRequestException("Authentication required", -32000);

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("AcpRequestException", exception.name);
    Assert.areEqual("Authentication required", exception.message);
    Assert.areEqual(-32000, exception.code);
    Assert.isNull(new AcpRequestException("No code", null).code);
  }
}
