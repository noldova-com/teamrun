/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpSetting } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpSettingTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual(JSON.stringify(["AsProvider", "On", "Off"]), JSON.stringify(Object.values(SharedMcpSetting)));
  }
}
