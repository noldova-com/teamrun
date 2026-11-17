/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StressChatImage } from "@noldova/teamrun.runtime/development";

@TestClass
export class StressChatImageTests {
  @TestMethod
  public keepsItsNameSizeAndTransparency(): void {
    const image = new StressChatImage("transparent.png", 512, 256, true);

    Assert.areEqual("transparent.png", image.name);
    Assert.areEqual(512, image.width);
    Assert.areEqual(256, image.height);
    Assert.isTrue(image.isTransparent);
  }
}
