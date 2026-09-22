/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SenderInfo } from "@noldova/teamrun-desktop";

@TestClass
export class SenderInfoTests {
  @TestMethod
  public keepsItsValues(): void {
    const sender = new SenderInfo("file:///app/index.html", true);

    Assert.areEqual("file:///app/index.html", sender.frameUrl);
    Assert.isTrue(sender.isTopLevel);
  }
}
