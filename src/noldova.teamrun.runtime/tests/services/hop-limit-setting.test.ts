/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { IModuleSettings } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { HopLimitSetting } from "@noldova/teamrun.runtime";

@TestClass
export class HopLimitSettingTests {
  @TestMethod
  public readsTheTeammateHandOffLimitAtEachCallAndStartsNoOneOnAValueThatIsNotANumber(): void {
    const reads: string[] = [];
    let value: JsonValue = 4;
    const settings = { read: (name: string) => { reads.push(name); return value; } } as IModuleSettings;
    const read = HopLimitSetting.readerOf(settings);

    Assert.areEqual(0, reads.length);
    Assert.areEqual(4, read());
    value = 0;
    Assert.areEqual(0, read());
    value = 7;
    Assert.areEqual(7, read());
    value = "4";
    Assert.areEqual(0, read());
    Assert.areEqual("teamrun.chainHopLimit,teamrun.chainHopLimit,teamrun.chainHopLimit,teamrun.chainHopLimit", reads.join(","));
  }
}
