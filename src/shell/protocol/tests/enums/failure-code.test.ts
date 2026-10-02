/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode } from "@noldova/teamrun-shell-protocol";

@TestClass
export class FailureCodeTests {
  @TestMethod
  public namesEveryCodeByItsMember(): void {
    Assert.areEqual(
      "InvalidMessage,FrameTooLarge,UnsupportedVersion,BuildMismatch,PreShellData,Unauthorized,UnknownMethod,InvalidParams,NotFound,Conflict,Cancelled,DeadlineExceeded,Unavailable,Internal",
      Object.values(FailureCode).join(","));
  }
}
