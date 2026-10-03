/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SettingLocality } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingLocalityTests {
  @TestMethod
  public namesEveryLocalityByItsMember(): void {
    Assert.areEqual("Device,Shared", Object.values(SettingLocality).join(","));
  }
}
