/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SenderInfo } from "@noldova/teamrun-shell-desktop";

@TestClass
export class SenderInfoTests {
  @TestMethod
  public keepsTheFrameAndItsContents(): void {
    const sender = new SenderInfo("file:///index.html", false, 3);

    Assert.areEqual("file:///index.html", sender.frameUrl);
    Assert.isFalse(sender.isTopLevel);
    Assert.areEqual(3, sender.contentsId);
  }
}
