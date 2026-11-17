/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CmdletParameters } from "@noldova/teamrun.providers";

@TestClass
export class CmdletParametersTests {
  @TestMethod
  public keepsEveryParameter(): void {
    const parameters = new CmdletParameters(["-raw", "-force"], ["-path"]);

    Assert.areEqual("-raw,-force", parameters.switches.join(","));
    Assert.areEqual("-path", parameters.values.join(","));
  }
}
