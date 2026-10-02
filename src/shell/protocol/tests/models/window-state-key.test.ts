/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowStateKey } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WindowStateKeyTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"device\":\"d1\",\"window\":\"main\"}";

    Assert.areEqual(text, JSON.stringify(new WindowStateKey("d1", "main").toJson()));
    Assert.areEqual(text, JSON.stringify(WindowStateKey.fromJson(JSON.parse(text)).toJson()));
  }

  @TestMethod
  @TestData(" ", "main")
  @TestData("d1", "")
  public needsADeviceAndAWindow(device: string, window: string): void {
    Assert.throws(() => new WindowStateKey(device, window), ArgumentException);
  }

  @TestMethod
  @TestData("{\"window\":\"main\"}", "$.device")
  @TestData("{\"device\":\"d1\",\"window\":\" \"}", "$.window")
  @TestData("{\"device\":\"d1\",\"window\":\"main\",\"screen\":1}", "$.screen")
  public rejectsAKeyThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => WindowStateKey.fromJson(JSON.parse(text)), JsonException).path);
  }
}
