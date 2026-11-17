/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpPermissionSwitch } from "@noldova/teamrun.providers";

@TestClass
export class AcpPermissionSwitchTests {
  @TestMethod
  public keepsItsPartsAndRefusesABlankOne(): void {
    const permission = new AcpPermissionSwitch("allow_all", "allow_all", "on", "off");

    Assert.areEqual("allow_all,allow_all,on,off", [permission.optionId, permission.mode, permission.onValue, permission.offValue].join(","));
    Assert.areEqual("optionId", Assert.throws(() => new AcpPermissionSwitch(" ", "m", "on", "off"), ArgumentException).parameterName);
    Assert.areEqual("mode", Assert.throws(() => new AcpPermissionSwitch("o", "", "on", "off"), ArgumentException).parameterName);
    Assert.areEqual("onValue", Assert.throws(() => new AcpPermissionSwitch("o", "m", "", "off"), ArgumentException).parameterName);
    Assert.areEqual("offValue", Assert.throws(() => new AcpPermissionSwitch("o", "m", "on", " "), ArgumentException).parameterName);
  }
}
