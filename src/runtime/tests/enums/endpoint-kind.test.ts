/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EndpointKind } from "@noldova/teamrun-runtime";

@TestClass
export class EndpointKindTests {
  @TestMethod
  public namesBothKinds(): void {
    Assert.areEqual("Tcp,Socket", Object.values(EndpointKind).join(","));
  }
}
