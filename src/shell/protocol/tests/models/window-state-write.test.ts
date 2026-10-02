/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowStateKey, WindowStateWrite } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WindowStateWriteTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"device\":\"d1\",\"window\":\"main\",\"value\":{\"width\":1280}}";
    const write = WindowStateWrite.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(new WindowStateWrite(new WindowStateKey("d1", "main"), { width: 1280 }).toJson()));
    Assert.areEqual("main", write.key.window);
    Assert.areEqual(text, JSON.stringify(write.toJson()));
  }

  @TestMethod
  @TestData("{\"device\":\"d1\",\"window\":\"main\"}", "$.value")
  @TestData("{\"device\":\"d1\",\"window\":\"main\",\"value\":[]}", "$.value")
  @TestData("{\"device\":\"\",\"window\":\"main\",\"value\":{}}", "$.device")
  @TestData("{\"device\":\"d1\",\"window\":\"main\",\"value\":{},\"extra\":1}", "$.extra")
  public rejectsAWriteThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => WindowStateWrite.fromJson(JSON.parse(text)), JsonException).path);
  }
}
