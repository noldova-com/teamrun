/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UnsupportedServerRequestException } from "@noldova/teamrun.providers";

@TestClass
export class UnsupportedServerRequestExceptionTests {
  @TestMethod
  public namesTheMethod(): void {
    const exception = new UnsupportedServerRequestException("item/tool/call");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("UnsupportedServerRequestException", exception.name);
    Assert.areEqual("item/tool/call", exception.method);
    Assert.areEqual("TeamRun does not handle the server request item/tool/call.", exception.message);
  }
}
