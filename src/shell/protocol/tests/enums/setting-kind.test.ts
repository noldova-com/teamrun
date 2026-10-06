/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SettingKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("Boolean,Choice,Number,Text,Modules,KeyBindings,Languages,Action", Object.values(SettingKind).join(","));
  }
}
