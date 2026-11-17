/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpTransport } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpTransportTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual(JSON.stringify(["Stdio", "Http"]), JSON.stringify(Object.values(SharedMcpTransport)));
  }
}
