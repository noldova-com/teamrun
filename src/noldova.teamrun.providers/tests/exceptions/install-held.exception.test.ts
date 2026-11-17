/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallHeldException } from "@noldova/teamrun.providers";

@TestClass
export class InstallHeldExceptionTests {
  @TestMethod
  public keepsTheRefusedRenamesMessageCodeAndError(): void {
    const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });

    const exception = new InstallHeldException(refused.message, "EPERM", refused);

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("InstallHeldException", exception.name);
    Assert.areEqual("EPERM: operation not permitted", exception.message);
    Assert.areEqual("EPERM", exception.code);
    Assert.areEqual(refused, exception.cause);
  }
}
