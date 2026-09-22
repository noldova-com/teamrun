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
import { ConnectionException } from "@noldova/teamrun-runtime";

@TestClass
export class ConnectionExceptionTests {
  @TestMethod
  public carriesTheRefusalWhenThereIsOne(): void {
    const info = new ServiceResponseInfo("unauthorized", "no");
    const refused = new ConnectionException("refused", info);
    const local = new ConnectionException("closed", null);

    Assert.isInstanceOf(refused, Exception);
    Assert.areEqual("refused", refused.message);
    Assert.areEqual(info, refused.info);
    Assert.isNull(local.info);
  }
}
