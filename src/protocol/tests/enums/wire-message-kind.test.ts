/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class WireMessageKindTests {
  @TestMethod
  public namesTheFourKinds(): void {
    Assert.areEqual("Hello", WireMessageKind.Hello);
    Assert.areEqual("Request", WireMessageKind.Request);
    Assert.areEqual("Response", WireMessageKind.Response);
    Assert.areEqual("Event", WireMessageKind.Event);
    Assert.areEqual(4, Object.values(WireMessageKind).length);
  }
}
