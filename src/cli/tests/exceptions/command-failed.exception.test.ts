/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandFailedException } from "@noldova/teamrun-cli";

@TestClass
export class CommandFailedExceptionTests {
  @TestMethod
  public formatsTheFailure(): void {
    const info = new ServiceResponseInfo("NotFound", "gone");

    const exception = new CommandFailedException(info);

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("Error (NotFound): gone", exception.message);
    Assert.areEqual(info, exception.info);
  }
}
