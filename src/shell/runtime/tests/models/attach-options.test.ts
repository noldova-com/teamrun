/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AttachOptions } from "@noldova/teamrun-shell-runtime";

@TestClass
export class AttachOptionsTests {
  @TestMethod
  public startsAndTakesOverByDefault(): void {
    const options = new AttachOptions();

    Assert.isTrue(options.start);
    Assert.isTrue(options.takeOver);
  }

  @TestMethod
  public keepsWhatItIsGiven(): void {
    const options = new AttachOptions(false, false);

    Assert.isFalse(options.start);
    Assert.isFalse(options.takeOver);
  }
}
